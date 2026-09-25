// The "AI zone" (PRD section 20). The only store the AI (and this app) ever
// writes to. Full CRUD lives here because this data is owned by the Buddy,
// unlike sourceDb.ts which is deliberately read-only.

import { PrismaClient } from "../generated/aizoneClient/index.js";

export const aiDb = new PrismaClient();

export async function logConversationTurn(params: {
  clientId: string;
  direction: "inbound" | "outbound";
  message: string;
  intent?: string;
  level?: string;
  sourcesUsed?: string[];
}) {
  return aiDb.conversation.create({
    data: {
      clientId: params.clientId,
      direction: params.direction,
      message: params.message,
      intent: params.intent,
      level: params.level,
      sourcesUsed: params.sourcesUsed ? JSON.stringify(params.sourcesUsed) : null,
    },
  });
}

export async function getRecentConversation(clientId: string, take = 20) {
  const rows = await aiDb.conversation.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.reverse();
}

export async function saveMemoryNote(params: {
  clientId: string;
  note: string;
  category: "event" | "goal" | "preference" | "concern";
  sourceMessageId?: string;
  expiryDate?: Date;
  sensitivity?: string;
}) {
  const expiryDate = params.expiryDate ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  return aiDb.memoryNote.create({
    data: {
      clientId: params.clientId,
      note: params.note,
      category: params.category,
      sourceMessageId: params.sourceMessageId,
      expiryDate,
      sensitivity: params.sensitivity ?? "normal",
    },
  });
}

export async function getActiveMemoryNotes(clientId: string, limit = 3) {
  const now = new Date();
  return aiDb.memoryNote.findMany({
    where: {
      clientId,
      deleted: false,
      OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function deleteMemoryNote(id: string) {
  return aiDb.memoryNote.update({ where: { id }, data: { deleted: true } });
}

export async function createEscalation(params: {
  clientId: string;
  level: "L1" | "L2" | "L3";
  triggerRuleId: string;
  clientConcern: string;
  conversationSummary: string;
  relevantContext?: string;
  whyHumanNeeded: string;
  recommendedOwner: string;
  whatClientWasTold: string;
  linkedEscalationId?: string;
}) {
  return aiDb.escalation.create({ data: params });
}

export async function findRecentEscalationByTrigger(clientId: string, triggerRuleId: string, sinceDays = 14) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return aiDb.escalation.findFirst({
    where: { clientId, triggerRuleId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
}

export async function countRecentEscalationsByTrigger(clientId: string, triggerRuleId: string, sinceDays = 14) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return aiDb.escalation.count({ where: { clientId, triggerRuleId, createdAt: { gte: since } } });
}

export async function listOpenEscalations(clientId?: string) {
  return aiDb.escalation.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      status: { in: ["open", "assigned", "in_progress", "reopened"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllEscalations() {
  return aiDb.escalation.findMany({ orderBy: { createdAt: "desc" } });
}

export async function updateEscalation(
  id: string,
  data: Partial<{
    status: string;
    assignedTo: string;
    resolutionNote: string;
  }>
) {
  return aiDb.escalation.update({ where: { id }, data });
}

export async function logBuddyFeedback(params: { clientId: string; question: string; response: string }) {
  return aiDb.buddyFeedback.create({ data: params });
}

export async function getTakeoverState(clientId: string) {
  return aiDb.takeoverState.findUnique({ where: { clientId } });
}

export async function setTakeoverState(clientId: string, active: boolean, setBy?: string) {
  return aiDb.takeoverState.upsert({
    where: { clientId },
    update: { active, setBy },
    create: { clientId, active, setBy },
  });
}

export async function audit(params: { clientId?: string; actor: string; action: string; detail?: string }) {
  return aiDb.auditLog.create({ data: params });
}

export async function listActiveKbEntries() {
  return aiDb.kbEntry.findMany({ where: { active: true } });
}

export async function listAllKbEntries() {
  return aiDb.kbEntry.findMany({ orderBy: { category: "asc" } });
}

export async function createKbEntry(params: {
  category: string;
  question: string;
  answer: string;
  owner: string;
}) {
  return aiDb.kbEntry.create({ data: params });
}

export async function setKbEntryActive(id: string, active: boolean) {
  return aiDb.kbEntry.update({ where: { id }, data: { active } });
}
