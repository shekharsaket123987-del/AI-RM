// Thin client for the Telegram Bot API — a free, zero-verification channel
// used for personal testing before real WhatsApp Business access is sorted.

function config() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set. See apps/backend/.env.example.");
  }
  return { botToken };
}

/** Sends a plain text Telegram message to the given chat. */
export async function sendTelegramText(chatId: number | string, text: string): Promise<void> {
  if (!text) return;
  const { botToken } = config();

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram send failed (${res.status}): ${errText}`);
  }
}
