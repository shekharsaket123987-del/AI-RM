import { saveMemoryNote, logBuddyFeedback, audit } from "../db/aiDb.js";
import type { ReplyToolCall } from "../llm/provider.js";

/**
 * Executes the tool calls the model made while drafting a reply.
 * These are the ONLY write actions the model can trigger (PRD section 11.1):
 * save_memory_note and log_buddy_feedback. create_escalation is deliberately
 * NOT executed from here — escalation creation is decided in code from the
 * rule engine (see escalation/engine.ts + runPipeline.ts), not left to model
 * discretion, per section 15: "The AI does not judge clinical severity."
 */
export async function executeToolCalls(clientId: string, sourceMessageId: string, toolCalls: ReplyToolCall[]) {
  const savedMemoryNoteIds: string[] = [];

  for (const call of toolCalls) {
    if (call.tool === "save_memory_note") {
      const note = String(call.input.note ?? "").trim();
      const category = (call.input.category as string) ?? "event";
      if (!note) continue;
      const expiryHintDays = typeof call.input.expiryHintDays === "number" ? call.input.expiryHintDays : undefined;
      const expiryDate = expiryHintDays ? new Date(Date.now() + expiryHintDays * 24 * 60 * 60 * 1000) : undefined;
      const created = await saveMemoryNote({
        clientId,
        note,
        category: category as "event" | "goal" | "preference" | "concern",
        sourceMessageId,
        expiryDate,
      });
      savedMemoryNoteIds.push(created.id);
      await audit({ clientId, actor: "ai", action: "memory_write", detail: note });
    } else if (call.tool === "log_buddy_feedback") {
      const question = String(call.input.question ?? "");
      const response = String(call.input.response ?? "");
      if (question && response) {
        await logBuddyFeedback({ clientId, question, response });
        await audit({ clientId, actor: "ai", action: "buddy_feedback", detail: `${question} -> ${response}` });
      }
    }
    // create_escalation tool calls from the model are intentionally ignored — see comment above.
  }

  return { savedMemoryNoteIds };
}

const FORGET_PATTERN = /\b(forget (that|it|this)|don'?t remember this)\b/i;

export function isForgetRequest(message: string): boolean {
  return FORGET_PATTERN.test(message);
}
