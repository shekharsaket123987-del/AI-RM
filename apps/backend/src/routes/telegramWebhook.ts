import { Router } from "express";
import { runPipeline } from "../pipeline/runPipeline.js";
import { sendTelegramText } from "../telegram/client.js";
import { identifyClient } from "../pipeline/identifyClient.js";
import { setChannelIdentity } from "../db/aiDb.js";

export const telegramWebhookRouter = Router();

// Same "process once" reasoning as the WhatsApp/Twilio webhooks.
const seenUpdateIds = new Set<number>();

// Single-test-user simplification: every Telegram chat that messages this
// bot is treated as the one seeded test client. Real per-client identity
// (matching a client's real phone number) isn't needed until this moves
// beyond a personal dummy test.
const TEST_CLIENT_PHONE = process.env.TELEGRAM_TEST_CLIENT_PHONE || "+916280087198";

telegramWebhookRouter.post("/", (req, res) => {
  res.sendStatus(200); // Telegram retries on non-2xx/slow responses, same as Meta.

  const update = req.body;
  const updateId = update?.update_id as number | undefined;
  const message = update?.message;
  const chatId = message?.chat?.id as number | undefined;
  const text = message?.text as string | undefined;

  if (updateId === undefined || !chatId || !text) return;
  if (seenUpdateIds.has(updateId)) return;
  seenUpdateIds.add(updateId);

  handleInboundMessage(chatId, text).catch((err) => console.error("Failed to handle inbound Telegram message:", err));
});

async function handleInboundMessage(chatId: number, text: string) {
  const client = await identifyClient(TEST_CLIENT_PHONE);
  if (client) {
    await setChannelIdentity(client.id, "telegram", String(chatId));
  }

  const result = await runPipeline(TEST_CLIENT_PHONE, text);
  if (result.takeoverActive) return; // a human is handling this chat; the AI stays silent.
  if (result.reply) {
    await sendTelegramText(chatId, result.reply);
  }
}
