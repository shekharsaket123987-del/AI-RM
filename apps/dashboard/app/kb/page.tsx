"use client";

import { useEffect, useState } from "react";
import { api, type KbEntry } from "../../lib/api";

const EMPTY = { category: "", question: "", answer: "", owner: "" };

export default function KbPage() {
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY);

  function load() {
    setLoading(true);
    api.listKb().then(setEntries).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function add() {
    if (!draft.category || !draft.question || !draft.answer || !draft.owner) return;
    await api.createKb(draft);
    setDraft(EMPTY);
    load();
  }

  return (
    <div>
      <h1>Knowledge Base</h1>
      <p className="subtitle">PRD section 14 — curated, versioned Q&A. Only active entries are retrievable by the Buddy.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Add entry</h2>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 8 }}>
          <input placeholder="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          <input placeholder="Owner" value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
        </div>
        <textarea
          placeholder="Question"
          value={draft.question}
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          style={{ marginBottom: 8 }}
        />
        <textarea placeholder="Answer" value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
        <button className="primary" style={{ marginTop: 8 }} onClick={add}>Add entry</button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && (
        <table>
          <thead>
            <tr><th>Category</th><th>Question</th><th>Answer</th><th>Owner</th><th>Active</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.category}</td>
                <td>{e.question}</td>
                <td>{e.answer}</td>
                <td>{e.owner}</td>
                <td>
                  <button onClick={async () => { await api.toggleKb(e.id, !e.active); load(); }}>
                    {e.active ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
