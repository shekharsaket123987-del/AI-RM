const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  profession?: string | null;
  location?: string | null;
  clientType: string;
}

export interface Escalation {
  id: string;
  clientId: string;
  level: "L1" | "L2" | "L3";
  triggerRuleId: string;
  clientConcern: string;
  conversationSummary: string;
  relevantContext?: string | null;
  whyHumanNeeded: string;
  recommendedOwner: string;
  whatClientWasTold: string;
  status: string;
  assignedTo?: string | null;
  resolutionNote?: string | null;
  linkedEscalationId?: string | null;
  createdAt: string;
}

export interface ConversationTurn {
  id: string;
  direction: "inbound" | "outbound";
  message: string;
  intent?: string | null;
  level?: string | null;
  createdAt: string;
}

export interface MemoryNote {
  id: string;
  note: string;
  category: string;
  expiryDate?: string | null;
}

export interface KbEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  owner: string;
  active: boolean;
}

export const api = {
  listClients: () => req<Client[]>("/clients"),
  getClient: (id: string) =>
    req<{ bundle: any; conversation: ConversationTurn[]; memoryNotes: MemoryNote[] }>(`/clients/${id}`),
  deleteMemoryNote: (clientId: string, noteId: string) =>
    req(`/clients/${clientId}/memory-notes/${noteId}`, { method: "DELETE" }),

  listEscalations: () => req<Escalation[]>("/escalations"),
  assignEscalation: (id: string, assignedTo: string) =>
    req(`/escalations/${id}/assign`, { method: "POST", body: JSON.stringify({ assignedTo }) }),
  resolveEscalation: (id: string, resolutionNote: string) =>
    req(`/escalations/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolutionNote }) }),
  reopenEscalation: (id: string) => req(`/escalations/${id}/reopen`, { method: "POST" }),
  closeEscalation: (id: string) => req(`/escalations/${id}/close`, { method: "POST" }),

  listKb: () => req<KbEntry[]>("/kb"),
  createKb: (entry: { category: string; question: string; answer: string; owner: string }) =>
    req("/kb", { method: "POST", body: JSON.stringify(entry) }),
  toggleKb: (id: string, active: boolean) => req(`/kb/${id}/toggle`, { method: "POST", body: JSON.stringify({ active }) }),

  setTakeover: (clientId: string, active: boolean, setBy: string) =>
    req(`/takeover/${clientId}`, { method: "POST", body: JSON.stringify({ active, setBy }) }),
  takeoverReply: (clientId: string, message: string, sentBy: string) =>
    req(`/takeover/${clientId}/reply`, { method: "POST", body: JSON.stringify({ message, sentBy }) }),

  sendMessage: (phone: string, message: string) =>
    req<{
      reply: string;
      intent: string;
      level: string;
      escalationId?: string;
      memoryNotesSaved: string[];
      kbChunkIdsUsed: string[];
      usedFixedTemplate: boolean;
      postCheckPassed: boolean;
      takeoverActive?: boolean;
    }>("/messages", { method: "POST", body: JSON.stringify({ phone, message }) }),
};
