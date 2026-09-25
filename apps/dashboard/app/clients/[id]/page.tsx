"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getClient>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [takeoverBusy, setTakeoverBusy] = useState(false);

  function load() {
    setLoading(true);
    api.getClient(clientId).then(setData).finally(() => setLoading(false));
  }

  useEffect(load, [clientId]);

  async function toggleTakeover(active: boolean) {
    setTakeoverBusy(true);
    await api.setTakeover(clientId, active, "Saket");
    setTakeoverBusy(false);
  }

  async function deleteNote(noteId: string) {
    await api.deleteMemoryNote(clientId, noteId);
    load();
  }

  if (loading) return <p>Loading…</p>;
  if (!data) return <p>Client not found.</p>;

  const { bundle, conversation, memoryNotes } = data;

  return (
    <div>
      <h1>{bundle.client.name}</h1>
      <p className="subtitle">{bundle.client.id} · {bundle.client.phone} · stage: {bundle.stage}</p>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="primary" disabled={takeoverBusy} onClick={() => toggleTakeover(true)}>
          Take over chat
        </button>
        <button disabled={takeoverBusy} onClick={() => toggleTakeover(false)}>
          Hand back to AI
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Profile & plan</h2>
          {bundle.plan && (
            <p>{bundle.plan.planName} · {bundle.plan.status} · {bundle.plan.startDate.slice(0, 10)} → {bundle.plan.endDate.slice(0, 10)}</p>
          )}
          {bundle.dietitian && <p>Dietitian: {bundle.dietitian.name}</p>}
          {bundle.progress && (
            <p>
              Progress: {bundle.progress.startWeightKg}kg → {bundle.progress.latestWeightKg}kg
              {" "}({bundle.progress.changeDirection} of {bundle.progress.changeKg}kg)
            </p>
          )}
          {bundle.restrictedFieldsAvailable && (
            <p style={{ color: "#c53030" }}>Restricted medical/medication fields on file (content hidden here).</p>
          )}
          {bundle.plateauDetected && <p style={{ color: "#c05621" }}>Plateau detected in recent follow-ups.</p>}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Memory notes</h2>
          {memoryNotes.length === 0 && <p className="meta">None yet.</p>}
          {memoryNotes.map((n) => (
            <div key={n.id} style={{ marginBottom: 8 }}>
              <span className="badge" style={{ background: "#eef0f2" }}>{n.category}</span> {n.note}
              <button style={{ marginLeft: 8 }} onClick={() => deleteNote(n.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <h2>Conversation</h2>
      <div className="chat">
        {conversation.map((c) => (
          <div key={c.id} className={`bubble ${c.direction}`}>
            {c.message}
            {c.intent && <div className="meta" style={{ color: c.direction === "inbound" ? "#cbd5e1" : "#667085" }}>{c.intent} {c.level ? `· ${c.level}` : ""}</div>}
          </div>
        ))}
        {conversation.length === 0 && <p className="meta">No conversation yet. Try the Simulate page.</p>}
      </div>
    </div>
  );
}
