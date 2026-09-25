import { Router } from "express";
import { runPipeline } from "../pipeline/runPipeline.js";
import { sendTwilioWhatsAppText } from "../whatsapp/twilioClient.js";

export const twilioWebhookRouter = Router();

// Same "process once" reasoning as the Meta webhook (routes/whatsappWebhook.ts).
const seenMessageSids = new Set<string>();

// Twilio POSTs form-encoded fields (not JSON) to this URL for every inbound
// WhatsApp Sandbox message: From="whatsapp:+91...", Body="<text>", MessageSid="...".
// Configure this as the "WHEN A MESSAGE COMES IN" webhook in the Twilio
// Console's Sandbox settings.
twilioWebhookRouter.post("/", (req, res) => {
  // Twilio expects a 200 (empty TwiML is fine) quickly; process async after.
  res.type("text/xml").send("<Response></Response>");

  const messageSid = req.body?.MessageSid as string | undefined;
  const from = req.body?.From as string | undefined; // "whatsapp:+919810000001"
  const body = req.body?.Body as string | undefined;

  if (!messageSid || !from || !body) return;
  if (seenMessageSids.has(messageSid)) return;
  seenMessageSids.add(messageSid);

  handleInboundMessage(from, body).catch((err) => console.error("Failed to handle inbound Twilio WhatsApp message:", err));
});

async function handleInboundMessage(from: string, body: string) {
  const phone = from.replace(/^whatsapp:/, ""); // -> "+919810000001", matches our seeded client phones

  const result = await runPipeline(phone, body);
  if (result.takeoverActive) return; // a human is handling this chat; the AI stays silent.
  if (result.reply) {
    await sendTwilioWhatsAppText(from, result.reply);
  }
}
