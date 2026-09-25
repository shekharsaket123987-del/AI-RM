import { findRule, higherLevel, type EscalationLevel } from "@aihb/shared";
import {
  countRecentEscalationsByTrigger,
  createEscalation,
  findRecentEscalationByTrigger,
  updateEscalation,
} from "../db/aiDb.js";

export interface RaiseEscalationParams {
  clientId: string;
  triggerRuleId: string;
  level: EscalationLevel;
  clientConcern: string;
  conversationSummary: string;
  relevantContext?: string;
  whyHumanNeeded: string;
  recommendedOwner: string;
  whatClientWasTold: string;
}

/**
 * PRD section 15.3 lifecycle + repeat-trigger linking: "A repeat of the same
 * trigger within 14 days links to the earlier escalation and raises its
 * priority by one level." L1 auto-upgrades to L2 after 2+ occurrences in 14
 * days (section 15.1).
 */
export async function raiseEscalation(params: RaiseEscalationParams) {
  if (params.level === "L0") return null; // L0 never creates an escalation.

  const priorCount = await countRecentEscalationsByTrigger(params.clientId, params.triggerRuleId, 14);
  let effectiveLevel: EscalationLevel = params.level;
  let linkedEscalationId: string | undefined;

  if (priorCount > 0) {
    const prior = await findRecentEscalationByTrigger(params.clientId, params.triggerRuleId, 14);
    linkedEscalationId = prior?.id;
    // L1 -> L2 auto-upgrade on repeat; any other level bumps one step via higherLevel.
    const bumped: EscalationLevel = effectiveLevel === "L1" ? "L2" : effectiveLevel === "L2" ? "L3" : effectiveLevel;
    effectiveLevel = higherLevel(effectiveLevel, bumped);
  }

  const rule = findRule(params.triggerRuleId);
  const escalation = await createEscalation({
    clientId: params.clientId,
    level: effectiveLevel as "L1" | "L2" | "L3",
    triggerRuleId: params.triggerRuleId,
    clientConcern: params.clientConcern,
    conversationSummary: params.conversationSummary,
    relevantContext: params.relevantContext,
    whyHumanNeeded: params.whyHumanNeeded,
    recommendedOwner: rule?.recommendedOwner ?? params.recommendedOwner,
    whatClientWasTold: params.whatClientWasTold,
    linkedEscalationId,
  });

  return escalation;
}

export async function assignEscalation(id: string, assignedTo: string) {
  return updateEscalation(id, { status: "assigned", assignedTo });
}

export async function progressEscalation(id: string) {
  return updateEscalation(id, { status: "in_progress" });
}

export async function resolveEscalation(id: string, resolutionNote: string) {
  return updateEscalation(id, { status: "resolved", resolutionNote });
}

export async function reopenEscalation(id: string) {
  return updateEscalation(id, { status: "reopened" });
}

export async function closeEscalation(id: string) {
  return updateEscalation(id, { status: "closed" });
}
