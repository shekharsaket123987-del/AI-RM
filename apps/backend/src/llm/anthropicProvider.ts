import Anthropic from "@anthropic-ai/sdk";
import type { ClassifyResult } from "@aihb/shared";
import type { GenerateReplyResult, LlmProvider, PostCheckResult, ReplyToolCall } from "./provider.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  return new Anthropic({ apiKey });
}

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_message",
  description: "Classify a client's WhatsApp message.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        description:
          "One short snake_case label, e.g. greeting, schedule_question, food_question, adherence_difficulty, " +
          "diet_change_request, plateau, poor_progress, demotivation, complaint, low_rating, human_request, " +
          "medication_question, medical_question, data_gap, general_kb_question, other.",
      },
      level: {
        type: "string",
        enum: ["L0", "L1", "L2", "L3"],
        description:
          "L0 the Buddy can fully handle. L1 monitor. L2 a human should act. L3 outside the Buddy's safe authority " +
          "(medication, symptoms, safety, serious complaints). If unsure between two levels, pick the higher one.",
      },
      confidence: { type: "number", description: "0 to 1." },
      clientLanguage: { type: "string", enum: ["en", "hi", "hinglish"] },
      entities: {
        type: "object",
        description: "Any useful extracted entities as short string key/values, e.g. {\"food\":\"rice\"}.",
        additionalProperties: { type: "string" },
      },
    },
    required: ["intent", "level", "confidence", "clientLanguage"],
  },
};

const REPLY_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_escalation",
    description:
      "Raise something to a human. Use whenever the message needs a dietitian or RM per your scope rules. " +
      "This does not send the client anything itself — say what you're doing in your reply text separately.",
    input_schema: {
      type: "object",
      properties: {
        triggerRuleId: { type: "string", description: "e.g. R-DIET-CHANGE, R-MEDICATION, R-COMPLAINT, R-HUMAN-REQUEST." },
        clientConcern: { type: "string", description: "The client's concern, in their own words." },
        whyHumanNeeded: { type: "string" },
        recommendedOwner: { type: "string", enum: ["dietitian", "rm", "dietitian+rm"] },
      },
      required: ["triggerRuleId", "clientConcern", "whyHumanNeeded", "recommendedOwner"],
    },
  },
  {
    name: "save_memory_note",
    description:
      "Save a short note about something the client said (an event, goal, preference or concern) so future " +
      "conversations have continuity. Only save what the client actually said, never a guess.",
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string" },
        category: { type: "string", enum: ["event", "goal", "preference", "concern"] },
        expiryHintDays: { type: "number", description: "Optional. Omit to use the 60-day default." },
      },
      required: ["note", "category"],
    },
  },
  {
    name: "log_buddy_feedback",
    description: "Log the client's answer to a Buddy check-in question, separate from official feedback.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        response: { type: "string" },
      },
      required: ["question", "response"],
    },
  },
];

export const anthropicProvider: LlmProvider = {
  async classify({ message, contextSummary }) {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "You classify inbound WhatsApp messages for a health-coaching AI assistant. " +
        "Use the classify_message tool. When unsure between two escalation levels, always pick the higher one.",
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "tool", name: "classify_message" },
      messages: [
        {
          role: "user",
          content: `Client context summary:\n${contextSummary}\n\nMessage: "${message}"`,
        },
      ],
    });

    const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) {
      return { intent: "other", level: "L1", confidence: 0, entities: {}, clientLanguage: "en" };
    }
    const input = toolUse.input as Record<string, unknown>;
    return {
      intent: String(input.intent ?? "other"),
      level: (input.level as ClassifyResult["level"]) ?? "L1",
      confidence: typeof input.confidence === "number" ? input.confidence : 0.5,
      entities: (input.entities as Record<string, string>) ?? {},
      clientLanguage: (input.clientLanguage as ClassifyResult["clientLanguage"]) ?? "en",
    };
  },

  async generateReply({ systemPrompt, contextBundle, conversationHistory, message }) {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: `${systemPrompt}\n\n--- CONTEXT BUNDLE (source of truth; do not use anything outside it) ---\n${contextBundle}`,
      tools: REPLY_TOOLS,
      messages: [
        ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: message },
      ],
    });

    const toolCalls: ReplyToolCall[] = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ tool: b.name as ReplyToolCall["tool"], input: b.input as Record<string, unknown> }));

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return { text, toolCalls };
  },

  async postCheck({ draftReply, contextBundle }) {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "You are a strict safety reviewer for a health-coaching AI assistant's draft replies. " +
        "Fail the reply if it: gives medical or medication advice, diagnoses, changes or invents diet content, " +
        "states a number/date/fact not present in the context bundle, promises an unconfirmed human action or time, " +
        "claims to be human or the dietitian, or is emotionally manipulative. " +
        'Respond with the check_reply tool.',
      tools: [
        {
          name: "check_reply",
          description: "Report the safety check result.",
          input_schema: {
            type: "object",
            properties: {
              pass: { type: "boolean" },
              reason: { type: "string", description: "Required if pass is false." },
            },
            required: ["pass"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "check_reply" },
      messages: [
        {
          role: "user",
          content: `Context bundle:\n${contextBundle}\n\nDraft reply:\n"${draftReply}"`,
        },
      ],
    });

    const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return { pass: false, reason: "Post-check produced no verdict." };
    const input = toolUse.input as Record<string, unknown>;
    return { pass: Boolean(input.pass), reason: input.reason ? String(input.reason) : undefined };
  },
};
