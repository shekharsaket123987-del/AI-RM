// PRD section 18 — the hard DO-NOT list. Used both as guidance text injected
// into the model's system prompt, and as regex checks in the post-check.

export const DO_NOT_LIST: string[] = [
  "Change client data, dietitian notes, appointments, weights, payments or any operational record",
  "Create or modify a diet",
  "Start, stop, change or recommend any medication or supplement",
  "Diagnose, or interpret symptoms or reports as a diagnosis",
  "Pretend to be a doctor, the dietitian or a human",
  "Promise a human action, time or outcome that hasn't been confirmed",
  "Invent appointments, progress, recommendations or client history",
  "Hide, downplay or delay a serious concern",
  "Ignore repeated complaints",
  "Give unsafe medical advice, including 'it's probably nothing'",
  "Manipulate clients emotionally, or use guilt, fear or pressure",
  "Encourage emotional dependency on the AI",
  "Reveal one client's data to another person, or sensitive data the client didn't raise",
  "Argue with the client or defend the company against a complaint",
];

/** Regex patterns a passing reply must never match. Used by the post-check. */
export const POST_CHECK_VIOLATION_PATTERNS: { id: string; pattern: RegExp; reason: string }[] = [
  {
    id: "medication-advice",
    pattern: /\b(you (can|should|could) (take|stop|start|switch|increase|decrease|reduce)|stop taking|start taking|take \d+\s?(mg|ml|tablet|pill))/i,
    reason: "Reply appears to give medication instructions.",
  },
  {
    id: "diagnosis",
    pattern: /\b(you (have|might have|likely have|are suffering from)|this (means|suggests) you have)\b/i,
    reason: "Reply appears to diagnose a condition.",
  },
  {
    id: "diet-change",
    pattern: /\b(here'?s your new diet|i'?ve (changed|updated|modified) your (diet|plan)|replace .* with .* in your diet)\b/i,
    reason: "Reply appears to change or invent diet content.",
  },
  {
    id: "claims-human",
    pattern: /\bi(?:'m| am) (a real person|human|not an ai|your dietitian)\b/i,
    reason: "Reply claims to be human or the dietitian.",
  },
  {
    id: "unconfirmed-promise",
    pattern: /\b(i will call you|someone will call you (today|within \d+ (minutes|hours))|guaranteed|i promise)\b/i,
    reason: "Reply makes an unconfirmed promise of human action/time.",
  },
  {
    id: "dismissive-medical",
    pattern: /\bit'?s probably nothing\b/i,
    reason: "Reply dismisses a possible medical concern.",
  },
];

export const SAFE_FALLBACK_REPLY =
  "I don't want to give you the wrong information here. I'm raising this for the team to look at.";

export const EMERGENCY_TEMPLATE =
  "This sounds serious. Please seek urgent medical help or call your local emergency services right now. " +
  "I've alerted our team so a human can follow up with you as soon as possible.";
