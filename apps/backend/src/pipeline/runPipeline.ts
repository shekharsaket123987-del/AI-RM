import { findRule, higherLevel, SAFE_FALLBACK_REPLY, type EscalationLevel, type PipelineResult } from "@aihb/shared";
import { identifyClient, UNKNOWN_NUMBER_REPLY } from "./identifyClient.js";
import { buildContextBundle, renderContextBundle } from "./contextBuilder.js";
import { retrieveKbChunks } from "./kbRetrieval.js";
import { runSafetyPreCheck } from "./safetyPreCheck.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { runPostCheck } from "./postCheck.js";
import { executeToolCalls, isForgetRequest } from "./tools.js";
import { raiseEscalation } from "../escalation/engine.js";
import { anthropicProvider } from "../llm/anthropicProvider.js";
import type { LlmProvider } from "../llm/provider.js";
import {
  audit,
  deleteMemoryNote,
  getActiveMemoryNotes,
  getRecentConversation,
  getTakeoverState,
  logConversationTurn,
} from "../db/aiDb.js";

const provider: LlmProvider = anthropicProvider;

function buildConversationSummary(history: { direction: string; message: string }[]): string {
  return history
    .slice(-6)
    .map((h) => `${h.direction === "inbound" ? "Client" : "Buddy"}: ${h.message}`)
    .join("\n");
}

export async function runPipeline(phone: string, message: string): Promise<PipelineResult & { takeoverActive?: boolean }> {
  const client = await identifyClient(phone);
  if (!client) {
    return {
      reply: UNKNOWN_NUMBER_REPLY,
      intent: "unknown_number",
      level: "L0",
      memoryNotesSaved: [],
      kbChunkIdsUsed: [],
      usedFixedTemplate: true,
      postCheckPassed: true,
    };
  }

  const takeover = await getTakeoverState(client.id);
  await logConversationTurn({ clientId: client.id, direction: "inbound", message });

  if (takeover?.active) {
    await audit({ clientId: client.id, actor: "ai", action: "read", detail: "Takeover active — AI held reply" });
    return {
      reply: "",
      intent: "n/a",
      level: "L0",
      memoryNotesSaved: [],
      kbChunkIdsUsed: [],
      usedFixedTemplate: false,
      postCheckPassed: true,
      takeoverActive: true,
    };
  }

  // "Forget that" — short-circuits the pipeline, per PRD section 13.
  if (isForgetRequest(message)) {
    const notes = await getActiveMemoryNotes(client.id, 1);
    if (notes[0]) {
      await deleteMemoryNote(notes[0].id);
      await audit({ clientId: client.id, actor: "ai", action: "memory_delete", detail: notes[0].note });
    }
    const reply = "Done — I've forgotten that.";
    await logConversationTurn({ clientId: client.id, direction: "outbound", message: reply, intent: "forget_request", level: "L0" });
    return { reply, intent: "forget_request", level: "L0", memoryNotesSaved: [], kbChunkIdsUsed: [], usedFixedTemplate: true, postCheckPassed: true };
  }

  // Layer 2 safety pre-check — runs before the model ever sees the message.
  const preCheck = runSafetyPreCheck(message);
  if (preCheck.matchedRule && preCheck.fixedReply) {
    const rule = preCheck.matchedRule;
    const history = await getRecentConversation(client.id, 6);
    const escalation = await raiseEscalation({
      clientId: client.id,
      triggerRuleId: rule.id,
      level: rule.level,
      clientConcern: message,
      conversationSummary: buildConversationSummary(history),
      whyHumanNeeded: rule.description,
      recommendedOwner: rule.recommendedOwner,
      whatClientWasTold: preCheck.fixedReply,
    });
    await logConversationTurn({
      clientId: client.id,
      direction: "outbound",
      message: preCheck.fixedReply,
      intent: rule.label,
      level: rule.level,
    });
    await audit({ clientId: client.id, actor: "ai", action: "escalate", detail: `${rule.id} (pre-check keyword match)` });
    return {
      reply: preCheck.fixedReply,
      intent: rule.label,
      level: rule.level,
      escalationId: escalation?.id,
      memoryNotesSaved: [],
      kbChunkIdsUsed: [],
      usedFixedTemplate: true,
      postCheckPassed: true,
    };
  }

  // Build read-only context + KB grounding.
  const bundle = await buildContextBundle(client.id);
  const contextText = renderContextBundle(bundle);
  await audit({ clientId: client.id, actor: "ai", action: "read", detail: "Loaded context bundle" });

  const kbChunks = await retrieveKbChunks(message, 3);
  const kbText = kbChunks.length
    ? "\n\nKnowledge base chunks (cite by id if used):\n" + kbChunks.map((c) => `[${c.id}] Q: ${c.question}\nA: ${c.answer}`).join("\n\n")
    : "\n\nNo matching knowledge base entries were found for this message.";

  const contextBundleForModel = contextText + kbText;

  const classification = await provider.classify({ message, contextSummary: contextText });

  // Bias low-confidence classifications to the next level up (PRD section 23).
  let level: EscalationLevel = classification.level;
  if (classification.confidence < 0.5) {
    const bumped: EscalationLevel = level === "L0" ? "L1" : level === "L1" ? "L2" : level === "L2" ? "L3" : "L3";
    level = higherLevel(level, bumped);
  }

  // Map intent -> a specific trigger rule (the rules engine decides escalation, not the model).
  const matchedRule = findRule(
    ["R-DIET-CHANGE", "R-COMPLAINT", "R-LOW-RATING", "R-HUMAN-REQUEST", "R-PLATEAU", "R-ADHERENCE", "R-DEMOTIVATION", "R-DATA-GAP"].find(
      (id) => findRule(id)?.intents?.includes(classification.intent)
    ) ?? ""
  );
  if (matchedRule) level = higherLevel(level, matchedRule.level);
  if (bundle.plateauDetected && classification.intent !== "poor_progress") {
    level = higherLevel(level, "L2");
  }

  const history = await getRecentConversation(client.id, 20);
  const conversationHistory = history
    .filter((h) => h.message.trim().length > 0)
    .map((h) => ({ role: (h.direction === "inbound" ? "user" : "assistant") as "user" | "assistant", content: h.message }));

  const systemPrompt = buildSystemPrompt({ ...classification, level });

  const draft = await provider.generateReply({
    systemPrompt,
    contextBundle: contextBundleForModel,
    conversationHistory: conversationHistory.slice(0, -1), // last item is the inbound msg we just logged
    message,
  });

  let finalReply = draft.text || SAFE_FALLBACK_REPLY;
  let postCheckPassed = true;

  const postCheckResult = await runPostCheck(provider, finalReply, contextBundleForModel);
  if (!postCheckResult.pass) {
    postCheckPassed = false;
    finalReply = SAFE_FALLBACK_REPLY;
    level = higherLevel(level, "L2");
    await audit({ clientId: client.id, actor: "ai", action: "postcheck_fail", detail: postCheckResult.reason });
  }

  let escalationId: string | undefined;
  if (level !== "L0") {
    const ruleId = !postCheckPassed ? "R-POSTCHECK-FAIL" : matchedRule?.id ?? preCheckFallbackRuleId(classification.intent, level);
    const rule = findRule(ruleId);
    const escalation = await raiseEscalation({
      clientId: client.id,
      triggerRuleId: ruleId,
      level,
      clientConcern: message,
      conversationSummary: buildConversationSummary(history),
      relevantContext: contextText,
      whyHumanNeeded: rule?.description ?? postCheckResult.reason ?? "Outside the Buddy's authority.",
      recommendedOwner: rule?.recommendedOwner ?? "rm",
      whatClientWasTold: finalReply,
    });
    escalationId = escalation?.id;
    await audit({ clientId: client.id, actor: "ai", action: "escalate", detail: ruleId });
  }

  const { savedMemoryNoteIds } = postCheckPassed
    ? await executeToolCalls(client.id, "latest", draft.toolCalls)
    : { savedMemoryNoteIds: [] as string[] };

  await logConversationTurn({
    clientId: client.id,
    direction: "outbound",
    message: finalReply,
    intent: classification.intent,
    level,
    sourcesUsed: kbChunks.map((c) => c.id),
  });

  return {
    reply: finalReply,
    intent: classification.intent,
    level,
    escalationId,
    memoryNotesSaved: savedMemoryNoteIds,
    kbChunkIdsUsed: kbChunks.map((c) => c.id),
    usedFixedTemplate: false,
    postCheckPassed,
  };
}

function preCheckFallbackRuleId(intent: string, level: EscalationLevel): string {
  if (level === "L1") return "R-DATA-GAP";
  return "R-HUMAN-REQUEST";
}
