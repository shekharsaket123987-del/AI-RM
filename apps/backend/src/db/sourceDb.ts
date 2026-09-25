// Read-only access to the "Source zone" (PRD section 20/21). This module
// intentionally exposes ONLY getters — there is no update/create/delete
// function anywhere in this file, and nothing else in the app imports the
// generated Prisma client directly. That's the "enforced by design, not by
// prompt" read-only rule from PRD section 11.1: even if a bug tried to
// write, there is no code path that could do it.
//
// In production this module's internals would be swapped for a Google
// Sheets reader (viewer-only service account) and later a SELECT-only DB
// role or GET-only API client — per the migration path in section 21. The
// function signatures below are the "read adapter interface" the rest of
// the app depends on, so that swap never touches pipeline code.

import { PrismaClient } from "../generated/sourceClient/index.js";

const prisma = new PrismaClient();

export async function getClientByPhone(phone: string) {
  return prisma.client.findUnique({ where: { phone } });
}

export async function getClientById(id: string) {
  return prisma.client.findUnique({ where: { id } });
}

export async function listClients() {
  return prisma.client.findMany({ orderBy: { name: "asc" } });
}

export async function getPlan(clientId: string) {
  return prisma.plan.findUnique({ where: { clientId } });
}

export async function getCounselling(clientId: string) {
  return prisma.counselling.findUnique({ where: { clientId } });
}

export async function getDietitianAssignment(clientId: string) {
  return prisma.dietitianAssignment.findUnique({ where: { clientId } });
}

export async function getCurrentDiet(clientId: string) {
  return prisma.diet.findFirst({ where: { clientId, isCurrent: true } });
}

export async function getFollowups(clientId: string, take = 5) {
  return prisma.followup.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
    take,
  });
}

export async function getNextFollowup(clientId: string) {
  return prisma.followup.findFirst({
    where: { clientId, status: "scheduled" },
    orderBy: { date: "asc" },
  });
}

export async function getFeedback(clientId: string, take = 5) {
  return prisma.feedback.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
    take,
  });
}

export async function getAppointments(clientId: string) {
  return prisma.appointment.findMany({ where: { clientId }, orderBy: { date: "desc" } });
}
