export type EscalationLevel = "L0" | "L1" | "L2" | "L3";

export type EscalationStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "reopened";

export interface EscalationRule {
  id: string;
  level: EscalationLevel;
  label: string;
  /** Matched against the raw message text (case-insensitive substrings / regex). */
  keywords?: RegExp[];
  /** Matched against classifier-produced intents. */
  intents?: string[];
  description: string;
  recommendedOwner: "dietitian" | "rm" | "dietitian+rm";
}

// PRD section 15.1 — trigger rules. When two rules match, the higher level wins.
export const ESCALATION_RULES: EscalationRule[] = [
  {
    id: "R-SAFETY",
    level: "L3",
    label: "Safety / self-harm / emergency symptom",
    keywords: [
      /chest pain/i,
      /faint(ed|ing)?/i,
      /severe (vomit|dizz)/i,
      /(blood in|coughing blood|vomiting blood)/i,
      /suicid|self.?harm|end my life|kill myself/i,
      /can'?t breathe|difficulty breathing/i,
      /\bmar dena\b|\bkhatam\b.*(zindagi|life)/i,
    ],
    description: "Emergency or self-harm language. No advice — fixed holding message + instant alert.",
    recommendedOwner: "rm",
  },
  {
    id: "R-MEDICATION",
    level: "L3",
    label: "Medication question",
    keywords: [/medicine|medication|dosage|dose\b|tablet|insulin|\bpill\b|dawai|dawa\b/i],
    intents: ["medication_question"],
    description: "Any question about starting, stopping or changing medication.",
    recommendedOwner: "dietitian+rm",
  },
  {
    id: "R-MEDICAL",
    level: "L3",
    label: "Medical / clinical question",
    keywords: [/diagnos|symptom|blood pressure reading|sugar level|report\b/i],
    intents: ["medical_question"],
    description: "Clinical question outside the Buddy's authority.",
    recommendedOwner: "dietitian+rm",
  },
  {
    id: "R-DIET-CHANGE",
    level: "L2",
    label: "Diet-change request",
    intents: ["diet_change_request"],
    description: "Client wants their diet changed. Only the dietitian can do this.",
    recommendedOwner: "dietitian",
  },
  {
    id: "R-COMPLAINT",
    level: "L2",
    label: "Complaint (service or dietitian)",
    intents: ["complaint"],
    description: "Service or dietitian complaint. RM owns resolution.",
    recommendedOwner: "rm",
  },
  {
    id: "R-LOW-RATING",
    level: "L2",
    label: "Low feedback rating",
    intents: ["low_rating"],
    description: "Rating of 2 or below, or repeated poor feedback.",
    recommendedOwner: "rm",
  },
  {
    id: "R-HUMAN-REQUEST",
    level: "L2",
    label: "Client asked for a human",
    intents: ["human_request"],
    description: "Client explicitly asked to talk to a person.",
    recommendedOwner: "rm",
  },
  {
    id: "R-PLATEAU",
    level: "L2",
    label: "Plateau / poor progress",
    intents: ["plateau", "poor_progress"],
    description: "Two or more follow-ups with under 0.3kg change, or repeated poor progress.",
    recommendedOwner: "dietitian",
  },
  {
    id: "R-ADHERENCE",
    level: "L1",
    label: "Adherence difficulty",
    intents: ["adherence_difficulty"],
    description: "One-off difficulty following the diet. Auto-upgrades to L2 after 2+ occurrences in 14 days.",
    recommendedOwner: "dietitian",
  },
  {
    id: "R-DEMOTIVATION",
    level: "L1",
    label: "Demotivation / low mood",
    intents: ["demotivation"],
    description: "Client seems demotivated. Auto-upgrades to L2 if it persists 7+ days.",
    recommendedOwner: "dietitian",
  },
  {
    id: "R-DATA-GAP",
    level: "L1",
    label: "Data gap",
    intents: ["data_gap"],
    description: "Data is missing or contradictory; the Buddy can't answer confidently.",
    recommendedOwner: "rm",
  },
  {
    id: "R-POSTCHECK-FAIL",
    level: "L2",
    label: "Draft reply failed the safety post-check",
    description: "The model's draft reply was blocked before sending and needs human review.",
    recommendedOwner: "rm",
  },
];

export function findRule(id: string): EscalationRule | undefined {
  return ESCALATION_RULES.find((r) => r.id === id);
}

export const LEVEL_RANK: Record<EscalationLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
};

export function higherLevel(a: EscalationLevel, b: EscalationLevel): EscalationLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}
