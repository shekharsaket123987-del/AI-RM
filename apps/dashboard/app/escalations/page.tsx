"use client";

import { useEffect, useState } from "react";
import { api, type Escalation } from "../../lib/api";

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    api.listEscalations().then(setEscalations).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function act(fn: () => Promise<unknown>) {
    await fn();
    load();
  }

  return (
    <div>
      <h1>Escalation Inbox</h1>
      <p className="subtitle">PRD section 15.2 — every row carries the full escalation payload.</p>
      {loading && <p>Loading…</p>}
      {!loading &&
        escalations.map((e) => (
          <div className="card" key={e.id} style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <span className={`badge badge-${e.level}`}>{e.level}</span>{" "}
                <strong>{e.clientId}</strong> — {e.triggerRuleId}
              </div>
              <div className="meta">{new Date(e.createdAt).toLocaleString()} · status: {e.status}</div>
            </div>

            <p><strong>Client's concern:</strong> "{e.clientConcern}"</p>
            <p><strong>Conversation summary:</strong> {e.conversationSummary}</p>
            <p><strong>Why a human is needed:</strong> {e.whyHumanNeeded}</p>
            <p><strong>Recommended owner:</strong> {e.recommendedOwner}</p>
            <p><strong>What the client was told:</strong> "{e.whatClientWasTold}"</p>
            {e.assignedTo && <p><strong>Assigned to:</strong> {e.assignedTo}</p>}
            {e.resolutionNote && <p><strong>Resolution:</strong> {e.resolutionNote}</p>}
            {e.linkedEscalationId && <p className="meta">Linked to repeat escalation {e.linkedEscalationId}</p>}

            <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <input
                placeholder="Assign to (e.g. Dt. Neha)"
                style={{ width: 200 }}
                value={assignDrafts[e.id] ?? ""}
                onChange={(ev) => setAssignDrafts({ ...assignDrafts, [e.id]: ev.target.value })}
              />
              <button onClick={() => act(() => api.assignEscalation(e.id, assignDrafts[e.id] ?? ""))}>Assign</button>

              <input
                placeholder="Resolution note"
                style={{ width: 240 }}
                value={noteDrafts[e.id] ?? ""}
                onChange={(ev) => setNoteDrafts({ ...noteDrafts, [e.id]: ev.target.value })}
              />
              <button
                className="primary"
                onClick={() => act(() => api.resolveEscalation(e.id, noteDrafts[e.id] ?? ""))}
              >
                Resolve
              </button>
              <button onClick={() => act(() => api.reopenEscalation(e.id))}>Reopen</button>
              <button onClick={() => act(() => api.closeEscalation(e.id))}>Close</button>
            </div>
          </div>
        ))}
      {!loading && escalations.length === 0 && <p>No escalations yet.</p>}
    </div>
  );
}
