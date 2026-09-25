import type { ClientContextBundle } from "@aihb/shared";
import * as sourceDb from "../db/sourceDb.js";
import { getActiveMemoryNotes, listOpenEscalations } from "../db/aiDb.js";
import { computeProgress, isPlateau } from "./computeFacts.js";

/**
 * PRD section 7: the AI *reads* the client's stage, it never sets it.
 * This is derived purely from what data exists, not stored anywhere.
 */
function deriveStage(params: {
  hasPlan: boolean;
  counsellingStatus?: string;
  hasDietitian: boolean;
  hasCurrentDiet: boolean;
  completedFollowups: number;
}): string {
  if (!params.hasPlan) return "payment_account";
  if (params.counsellingStatus !== "completed") return "counselling";
  if (!params.hasDietitian) return "dietitian_assignment_pending";
  if (!params.hasCurrentDiet) return "diet_pending";
  if (params.completedFollowups === 0) return "plan_start";
  return "weekly_followups";
}

export async function buildContextBundle(clientId: string): Promise<ClientContextBundle> {
  const client = await sourceDb.getClientById(clientId);
  if (!client) throw new Error(`Unknown client ${clientId}`);

  const [plan, counselling, dietitianAssignment, currentDiet, followups, nextFollowup, feedback, memoryNotes, openEscalations] =
    await Promise.all([
      sourceDb.getPlan(clientId),
      sourceDb.getCounselling(clientId),
      sourceDb.getDietitianAssignment(clientId),
      sourceDb.getCurrentDiet(clientId),
      sourceDb.getFollowups(clientId, 5),
      sourceDb.getNextFollowup(clientId),
      sourceDb.getFeedback(clientId, 3),
      getActiveMemoryNotes(clientId, 3),
      listOpenEscalations(clientId),
    ]);

  const completedFollowups = followups.filter((f) => f.status === "completed");
  const followupsAsc = [...completedFollowups].reverse();
  const progress = computeProgress(followupsAsc, undefined);

  const stage = deriveStage({
    hasPlan: !!plan,
    counsellingStatus: counselling?.status,
    hasDietitian: !!dietitianAssignment,
    hasCurrentDiet: !!currentDiet,
    completedFollowups: completedFollowups.length,
  });

  return {
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      age: client.age ?? undefined,
      profession: client.profession ?? undefined,
      location: client.location ?? undefined,
    },
    plan: plan
      ? {
          planName: plan.planName,
          startDate: plan.startDate.toISOString(),
          endDate: plan.endDate.toISOString(),
          status: plan.status,
          paymentStatus: plan.paymentStatus,
        }
      : null,
    stage,
    dietitian: dietitianAssignment ? { name: dietitianAssignment.dietitianName } : null,
    // Restricted: medicalHistory / medication are deliberately NOT surfaced here
    // (PRD section 19 minimum-exposure rule). restrictedFieldsAvailable just
    // tells the pipeline whether such fields exist on file, without leaking content.
    counselling: counselling
      ? {
          lifestyle: counselling.lifestyle ?? undefined,
          goals: counselling.goals ?? undefined,
          preferences: counselling.preferences ?? undefined,
          allergies: counselling.allergies ?? undefined,
        }
      : null,
    currentDiet: currentDiet
      ? { week: currentDiet.week, content: currentDiet.content, publishedDate: currentDiet.publishedDate.toISOString() }
      : null,
    recentFollowups: completedFollowups.slice(0, 2).map((f) => ({
      date: f.date.toISOString(),
      status: f.status,
      weightKg: f.weightKg ?? undefined,
      adherencePct: f.adherencePct ?? undefined,
      notes: f.notes ?? undefined,
      nextFocus: f.nextFocus ?? undefined,
    })),
    nextFollowup: nextFollowup ? { date: nextFollowup.date.toISOString(), dietitianName: dietitianAssignment?.dietitianName ?? "" } : null,
    progress: Object.keys(progress).length ? progress : null,
    officialFeedback: feedback.map((f) => ({ rating: f.rating, comment: f.comment ?? undefined, date: f.date.toISOString() })),
    memoryNotes: memoryNotes.map((m) => ({
      id: m.id,
      note: m.note,
      category: m.category as ClientContextBundle["memoryNotes"][number]["category"],
      expiryDate: m.expiryDate?.toISOString(),
    })),
    openEscalations: openEscalations.map((e) => ({
      id: e.id,
      level: e.level as ClientContextBundle["openEscalations"][number]["level"],
      status: e.status as ClientContextBundle["openEscalations"][number]["status"],
      label: e.triggerRuleId,
    })),
    restrictedFieldsAvailable: !!(counselling?.medicalHistory || counselling?.medication),
    plateauDetected: isPlateau(completedFollowups),
  };
}

export function isClientInPlateau(followupsDesc: { weightKg?: number | null }[]) {
  return isPlateau(followupsDesc);
}

/** Renders the bundle as plain text for the model's context window. */
export function renderContextBundle(bundle: ClientContextBundle): string {
  const lines: string[] = [];
  lines.push(`Client: ${bundle.client.name} (id: ${bundle.client.id})`);
  if (bundle.plan) {
    lines.push(`Plan: ${bundle.plan.planName}, ${bundle.plan.startDate.slice(0, 10)} to ${bundle.plan.endDate.slice(0, 10)}, status ${bundle.plan.status}`);
  }
  lines.push(`Stage: ${bundle.stage}`);
  if (bundle.dietitian) lines.push(`Dietitian: ${bundle.dietitian.name}`);
  if (bundle.currentDiet) {
    lines.push(`Current diet (week ${bundle.currentDiet.week}, published ${bundle.currentDiet.publishedDate.slice(0, 10)}):\n${bundle.currentDiet.content}`);
  } else {
    lines.push("Current diet: not yet published.");
  }
  if (bundle.counselling) {
    const c = bundle.counselling;
    lines.push(
      `Counselling notes: lifestyle=${c.lifestyle ?? "n/a"}; goals=${c.goals ?? "n/a"}; preferences=${c.preferences ?? "n/a"}; allergies=${c.allergies ?? "n/a"}`
    );
  }
  if (bundle.recentFollowups.length) {
    lines.push("Recent follow-ups:");
    for (const f of bundle.recentFollowups) {
      lines.push(`  - ${f.date.slice(0, 10)} (${f.status}): weight ${f.weightKg ?? "n/a"}kg, adherence ${f.adherencePct ?? "n/a"}%, notes: ${f.notes ?? "none"}`);
    }
  }
  if (bundle.nextFollowup) lines.push(`Next follow-up: ${bundle.nextFollowup.date} with ${bundle.nextFollowup.dietitianName}`);
  if (bundle.progress) {
    lines.push(
      `Progress: start ${bundle.progress.startWeightKg}kg -> latest ${bundle.progress.latestWeightKg}kg (${bundle.progress.changeDirection} of ${bundle.progress.changeKg}kg)`
    );
  }
  if (bundle.officialFeedback.length) {
    lines.push(`Recent feedback ratings: ${bundle.officialFeedback.map((f) => f.rating).join(", ")}`);
  }
  if (bundle.memoryNotes.length) {
    lines.push("Buddy memory notes:");
    for (const m of bundle.memoryNotes) lines.push(`  - [${m.category}] ${m.note}`);
  }
  if (bundle.openEscalations.length) {
    lines.push(`Open escalations: ${bundle.openEscalations.map((e) => `${e.label} (${e.level}, ${e.status})`).join("; ")}`);
  }
  lines.push(
    `Restricted medical/medication fields on file: ${bundle.restrictedFieldsAvailable ? "yes (content withheld — escalate any medical/medication question)" : "no"}`
  );
  if (bundle.plateauDetected) {
    lines.push("Progress note: the last two follow-ups show under 0.3kg change (possible plateau).");
  }
  return lines.join("\n");
}
