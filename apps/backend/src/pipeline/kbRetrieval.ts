import type { KbChunk } from "@aihb/shared";
import { listActiveKbEntries } from "../db/aiDb.js";

// Simple keyword-overlap scoring — good enough to demo grounded retrieval
// without standing up pgvector (PRD section 22/26 Phase 2 upgrade path).
// Every reply logs which chunk IDs it used (section 14 KB rules).

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "i", "my", "me", "you", "your", "to", "for", "of", "in", "on",
  "and", "or", "can", "will", "it", "what", "when", "how", "with", "have", "has", "this", "that",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export async function retrieveKbChunks(query: string, topK = 3): Promise<KbChunk[]> {
  const entries = await listActiveKbEntries();
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  const scored = entries.map((e) => {
    const entryTokens = tokenize(`${e.question} ${e.answer}`);
    let score = 0;
    for (const t of entryTokens) if (queryTokens.has(t)) score += 1;
    return { entry: e, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({
      id: s.entry.id,
      category: s.entry.category,
      question: s.entry.question,
      answer: s.entry.answer,
      owner: s.entry.owner,
      active: s.entry.active,
    }));
}
