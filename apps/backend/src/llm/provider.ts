import type { ClassifyResult } from "@aihb/shared";

export interface ReplyToolCall {
  tool: "create_escalation" | "save_memory_note" | "log_buddy_feedback";
  input: Record<string, unknown>;
}

export interface GenerateReplyResult {
  text: string;
  toolCalls: ReplyToolCall[];
}

export interface PostCheckResult {
  pass: boolean;
  reason?: string;
}

/**
 * Provider interface — PRD section 23: "Keep the provider behind an
 * interface so it can be swapped." classify/generateReply/postCheck are the
 * only three model calls in the pipeline; everything else (facts, rules,
 * permissions) is code (section 23 diagram).
 */
export interface LlmProvider {
  classify(input: { message: string; contextSummary: string }): Promise<ClassifyResult>;

  generateReply(input: {
    systemPrompt: string;
    contextBundle: string;
    conversationHistory: { role: "user" | "assistant"; content: string }[];
    message: string;
  }): Promise<GenerateReplyResult>;

  postCheck(input: { draftReply: string; contextBundle: string }): Promise<PostCheckResult>;
}
