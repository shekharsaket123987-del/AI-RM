import { ESCALATION_RULES, EMERGENCY_TEMPLATE, type EscalationRule } from "@aihb/shared";

/**
 * PRD section 18, layer 2: "A rules engine scans every inbound message for
 * L3 keywords and intents ... A match forces an escalation and a fixed
 * template reply." This runs BEFORE the model is called at all, so an L3
 * keyword hit never depends on the model behaving correctly.
 */
export interface PreCheckResult {
  matchedRule: EscalationRule | null;
  fixedReply: string | null;
}

export function runSafetyPreCheck(message: string): PreCheckResult {
  const l3Rules = ESCALATION_RULES.filter((r) => r.level === "L3" && r.keywords);
  for (const rule of l3Rules) {
    for (const pattern of rule.keywords ?? []) {
      if (pattern.test(message)) {
        const fixedReply = rule.id === "R-SAFETY" ? EMERGENCY_TEMPLATE : buildFixedReplyForRule(rule);
        return { matchedRule: rule, fixedReply };
      }
    }
  }
  return { matchedRule: null, fixedReply: null };
}

function buildFixedReplyForRule(rule: EscalationRule): string {
  if (rule.id === "R-MEDICATION") {
    return "I wouldn't recommend changing or stopping medication yourself. I'll raise this so you get the right guidance.";
  }
  if (rule.id === "R-MEDICAL") {
    return "That's something your dietitian or doctor should answer. I'm raising it now.";
  }
  return "That's outside what I can safely help with. I'm raising it for the team right now.";
}
