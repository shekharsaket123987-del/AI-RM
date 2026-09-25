// Sends WhatsApp replies via Twilio's REST API when using the Twilio
// Sandbox for WhatsApp (the zero-business-verification alternative to
// Meta's Cloud API — see apps/backend/src/routes/twilioWebhook.ts).

function config() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!accountSid || !authToken || !from) {
    throw new Error(
      "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM are not set. See apps/backend/.env.example."
    );
  }
  return { accountSid, authToken, from };
}

/** `to` should already be in "whatsapp:+91..." form (Twilio's own format). */
export async function sendTwilioWhatsAppText(to: string, body: string): Promise<void> {
  if (!body) return;
  const { accountSid, authToken, from } = config();

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio send failed (${res.status}): ${errText}`);
  }
}
