// Thin client for the WhatsApp Cloud API (PRD section 22 — "Meta Cloud API
// direct"). This is the one piece of the pipeline that actually talks to
// Meta; everything upstream (runPipeline) is transport-agnostic.

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

function config() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set. See apps/backend/.env.example."
    );
  }
  return { accessToken, phoneNumberId };
}

/** Sends a plain text WhatsApp message. `to` is whatever Meta sent as the inbound "from" (digits only, no +). */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  if (!body) return;
  const { accessToken, phoneNumberId } = config();

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${errText}`);
  }
}
