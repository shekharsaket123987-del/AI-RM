import { POST_CHECK_VIOLATION_PATTERNS } from "@aihb/shared";
import type { LlmProvider } from "../llm/provider.js";

export interface CombinedPostCheckResult {
  pass: boolean;
  reason?: string;
}

/**
 * PRD section 18, layer 4: "A second, cheaper model plus rules check the
 * draft reply ... A failed check blocks the draft, sends a safe fallback."
 * Regex runs first (cheap, deterministic); the model pass catches anything
 * the regex list doesn't cover.
 */
export async function runPostCheck(
  provider: LlmProvider,
  draftReply: string,
  contextBundle: string
): Promise<CombinedPostCheckResult> {
  for (const rule of POST_CHECK_VIOLATION_PATTERNS) {
    if (rule.pattern.test(draftReply)) {
      return { pass: false, reason: `${rule.id}: ${rule.reason}` };
    }
  }

  const modelResult = await provider.postCheck({ draftReply, contextBundle });
  return modelResult;
}
