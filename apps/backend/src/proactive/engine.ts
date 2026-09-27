// Proactive milestone engine: an hourly scan (this is the stand-in for the
// hourly Google Sheet poll) that detects, per client, the most advanced
// "worth telling the client about" milestone and messages them ONCE per
// milestone reached. This is separate from runPipeline (reactive replies) —
// nothing here runs in response to an inbound message.
//
// Milestones are intentionally ordered. If a client is already past a
// milestone (e.g. counselling is booked), we don't re-send the earlier one.

import * as sourceDb from "../db/sourceDb.js";
import { getProactiveMilestone, setProactiveMilestone, getChannelIdentity, logConversationTurn, audit } from "../db/aiDb.js";
import { sendTelegramText } from "../telegram/client.js";

const MILESTONES = ["payment_no_counselling", "counselling_booked"] as const;
type Milestone = (typeof MILESTONES)[number];

function milestoneIndex(m: string | undefined | null): number {
  if (!m) return -1;
  const i = MILESTONES.indexOf(m as Milestone);
  return i;
}

async function computeMilestone(clientId: string): Promise<Milestone | null> {
  const plan = await sourceDb.getPlan(clientId);
  if (!plan) return null; // not paid yet — nothing to say

  const counselling = await sourceDb.getCounselling(clientId);
  if (counselling?.status === "booked" || counselling?.status === "completed") {
    return "counselling_booked";
  }
  return "payment_no_counselling";
}

async function buildMessage(milestone: Milestone, clientId: string): Promise<string> {
  const client = await sourceDb.getClientById(clientId);
  const name = client?.name?.split(" ")[0] ?? "there";

  if (milestone === "payment_no_counselling") {
    return (
      `Hi ${name} \u{1F44B} I'm your Fitelo Health Buddy, an AI assistant. ` +
      `You can download the Fitelo app here: https://fitelo.co/app. ` +
      `Next step is booking your counselling session — want me to share how?`
    );
  }

  // counselling_booked
  const counselling = await sourceDb.getCounselling(clientId);
  const dietitian = await sourceDb.getDietitianAssignment(clientId);
  const coachName = dietitian?.dietitianName ?? "your coach";
  const when = counselling?.scheduledAt
    ? counselling.scheduledAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "your scheduled time";
  return (
    `Hi ${name}, you're booked for counselling on ${when} with ${coachName}. ` +
    `Keep your usual meal timings handy for the session — any questions before then, just message me.`
  );
}

async function notifyClient(clientId: string, message: string) {
  const telegram = await getChannelIdentity(clientId, "telegram");
  if (!telegram) {
    console.log(`[proactive] No known channel for client ${clientId} yet — skipping send (message would have been: "${message}")`);
    return false;
  }
  await sendTelegramText(telegram.externalId, message);
  return true;
}

/** Scans every client once and sends at most one message per client — only if their milestone has advanced since last notified. */
export async function runProactiveScan(): Promise<{ checked: number; notified: number }> {
  const clients = await sourceDb.listClients();
  let notified = 0;

  for (const client of clients) {
    const milestone = await computeMilestone(client.id);
    if (!milestone) continue;

    const existing = await getProactiveMilestone(client.id);
    if (milestoneIndex(existing?.milestone) >= milestoneIndex(milestone)) continue; // already notified at this level or beyond

    const message = await buildMessage(milestone, client.id);
    const sent = await notifyClient(client.id, message);

    if (sent) {
      await logConversationTurn({ clientId: client.id, direction: "outbound", message, intent: `proactive_${milestone}`, level: "L0" });
      await audit({ clientId: client.id, actor: "ai", action: "reply", detail: `Proactive milestone message: ${milestone}` });
      await setProactiveMilestone(client.id, milestone);
      notified++;
    }
    // If not sent (no channel identity known yet — e.g. a Telegram user who
    // hasn't messaged the bot at all, which platform rules don't allow us to
    // push to anyway), we deliberately DON'T record the milestone, so the
    // next hourly scan retries once a channel becomes known.
  }

  return { checked: clients.length, notified };
}
