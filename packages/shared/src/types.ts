import type { EscalationLevel, EscalationStatus } from "./escalation";

export interface ClientContextBundle {
  client: {
    id: string;
    name: string;
    phone: string;
    age?: number;
    profession?: string;
    location?: string;
  };
  plan: {
    planName: string;
    startDate: string;
    endDate: string;
    status: string;
    paymentStatus: string;
  } | null;
  stage: string;
  dietitian: { name: string } | null;
  counselling: {
    lifestyle?: string;
    goals?: string;
    preferences?: string;
    allergies?: string;
    // Medical/medication are intentionally NOT included in the default bundle.
    // They are fetched separately and filtered per PRD section 19.
  } | null;
  currentDiet: {
    week: number;
    content: string;
    publishedDate: string;
  } | null;
  recentFollowups: {
    date: string;
    status: string;
    weightKg?: number;
    adherencePct?: number;
    notes?: string;
    nextFocus?: string;
  }[];
  nextFollowup: { date: string; dietitianName: string } | null;
  progress: {
    startWeightKg?: number;
    latestWeightKg?: number;
    targetWeightKg?: number;
    changeKg?: number;
    changeDirection?: "loss" | "gain" | "none";
  } | null;
  officialFeedback: { rating: number; comment?: string; date: string }[];
  memoryNotes: {
    id: string;
    note: string;
    category: "event" | "goal" | "preference" | "concern";
    expiryDate?: string;
  }[];
  openEscalations: { id: string; level: EscalationLevel; status: EscalationStatus; label: string }[];
  restrictedFieldsAvailable: boolean; // true if medical/medication exist on file (not their content)
  plateauDetected: boolean;
}

export interface KbChunk {
  id: string;
  category: string;
  question: string;
  answer: string;
  owner: string;
  active: boolean;
}

export interface ClassifyResult {
  intent: string;
  level: EscalationLevel;
  confidence: number;
  entities: Record<string, string>;
  clientLanguage: "en" | "hi" | "hinglish";
}

export interface PipelineResult {
  reply: string;
  intent: string;
  level: EscalationLevel;
  escalationId?: string;
  memoryNotesSaved: string[];
  kbChunkIdsUsed: string[];
  usedFixedTemplate: boolean;
  postCheckPassed: boolean;
}
