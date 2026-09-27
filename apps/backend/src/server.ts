import "dotenv/config";
import express from "express";
import cors from "cors";
import { messageRouter } from "./routes/message.js";
import { escalationsRouter } from "./routes/escalations.js";
import { clientsRouter } from "./routes/clients.js";
import { kbRouter } from "./routes/kb.js";
import { takeoverRouter } from "./routes/takeover.js";
import { whatsappWebhookRouter } from "./routes/whatsappWebhook.js";
import { twilioWebhookRouter } from "./routes/twilioWebhook.js";
import { telegramWebhookRouter } from "./routes/telegramWebhook.js";
import { proactiveRouter } from "./routes/proactive.js";
import { runProactiveScan } from "./proactive/engine.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded webhooks

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/messages", messageRouter);
app.use("/api/escalations", escalationsRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/kb", kbRouter);
app.use("/api/takeover", takeoverRouter);
app.use("/webhook", whatsappWebhookRouter); // Meta Cloud API (needs business verification)
app.use("/webhook/twilio", twilioWebhookRouter); // Twilio Sandbox (no verification needed)
app.use("/webhook/telegram", telegramWebhookRouter); // Telegram Bot API (free, no verification)
app.use("/api/proactive", proactiveRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`AI Health Buddy backend listening on http://localhost:${port}`);
});

// Stand-in for the hourly Google Sheet poll (PRD-style scheduler, section 22).
// Runs once on boot too, so a fresh start doesn't wait an hour for the first pass.
const HOUR = 60 * 60 * 1000;
runProactiveScan()
  .then((r) => console.log(`[proactive] initial scan: checked ${r.checked}, notified ${r.notified}`))
  .catch((err) => console.error("[proactive] initial scan failed:", err));
setInterval(() => {
  runProactiveScan()
    .then((r) => console.log(`[proactive] hourly scan: checked ${r.checked}, notified ${r.notified}`))
    .catch((err) => console.error("[proactive] hourly scan failed:", err));
}, HOUR);
