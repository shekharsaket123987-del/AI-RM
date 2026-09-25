import { Router } from "express";
import { runPipeline } from "../pipeline/runPipeline.js";
import { sendWhatsAppText } from "../whatsapp/client.js";

export const whatsappWebhookRouter = Router();

// Meta redelivers webhooks on any non-2xx or slow response — this in-memory
// set gives "process each message exactly once" for a single-process
// prototype (PRD section 22). A real deployment would use a persistent
// store (e.g. a unique constraint on message id) instead.
const seenMessageIds = new Set<string>();

// Step 1 of Meta's setup: they GET this URL with a challenge to prove you
// own it. Reply with hub.challenge if the verify token matches.
whatsappWebhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Step 2: real inbound messages land here. Reply 200 immediately (Meta
// retries aggressively on timeouts/non-2xx), then process and send the
// reply asynchronously — mirrors the "time out and send a safe fallback"
// and "process exactly once" requirements in PRD section 22.
whatsappWebhookRouter.post("/", (req, res) => {
  res.sendStatus(200);

  const entries = req.body?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      for (const msg of messages) {
        if (seenMessageIds.has(msg.id)) continue;
        seenMessageIds.add(msg.id);
        handleInboundMessage(msg).catch((err) => console.error("Failed to handle inbound WhatsApp message:", err));
      }
    }
  }
});

async function handleInboundMessage(msg: any) {
  const from: string = msg.from; // digits only, no "+", e.g. "919810000001"
  const phone = `+${from}`;

  let text: string | null = null;
  if (msg.type === "text") {
    text = msg.text?.body ?? null;
  } else {
    // PRD section 16.4: acknowledge non-text and route rather than guessing.
    await sendWhatsAppText(
      from,
      "I can only read text messages right now — could you type that out? If it's a photo or voice note, I've flagged it for the team."
    );
    return;
  }

  if (!text) return;

  const result = await runPipeline(phone, text);
  if (result.takeoverActive) return; // a human is handling this chat; the AI stays silent.
  if (result.reply) {
    await sendWhatsAppText(from, result.reply);
  }
}
