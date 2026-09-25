import { getClientByPhone } from "../db/sourceDb.js";
import { audit } from "../db/aiDb.js";

/**
 * PRD section 11.1 / 19: a client is identified only on an exact phone
 * match. Unknown numbers get a generic reply and see no data at all.
 */
export async function identifyClient(phone: string) {
  const client = await getClientByPhone(phone);
  if (!client) {
    await audit({ actor: "ai", action: "read", detail: `Unknown number ${phone} — no data returned` });
    return null;
  }
  return client;
}

export const UNKNOWN_NUMBER_REPLY =
  "Hi! I couldn't match this number to a Fitelo account. If you're a Fitelo client, " +
  "please message from the number registered with us, or reach out to our support team.";
