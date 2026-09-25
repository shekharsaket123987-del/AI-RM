"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Client } from "../../lib/api";

interface Turn {
  who: "client" | "buddy";
  text: string;
  meta?: string;
}

export default function SimulatePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [phone, setPhone] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listClients().then((cs) => {
      setClients(cs);
      if (cs[0]) setPhone(cs[0].phone);
    });
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [turns]);

  async function send() {
    if (!input.trim() || !phone) return;
    const text = input.trim();
    setInput("");
    setTurns((t) => [...t, { who: "client", text }]);
    setSending(true);
    try {
      const result = await api.sendMessage(phone, text);
      if (result.takeoverActive) {
        setTurns((t) => [...t, { who: "buddy", text: "(Human takeover is active — the AI is holding its reply. Reply from the client's page instead.)" }]);
      } else {
        const metaParts = [result.intent, result.level];
        if (result.escalationId) metaParts.push(`escalation ${result.escalationId.slice(0, 8)}`);
        if (result.usedFixedTemplate) metaParts.push("fixed template");
        if (!result.postCheckPassed) metaParts.push("post-check blocked draft");
        if (result.kbChunkIdsUsed.length) metaParts.push(`KB: ${result.kbChunkIdsUsed.join(", ")}`);
        if (result.memoryNotesSaved.length) metaParts.push(`memory saved: ${result.memoryNotesSaved.length}`);
        setTurns((t) => [...t, { who: "buddy", text: result.reply, meta: metaParts.join(" · ") }]);
      }
    } catch (e) {
      setTurns((t) => [...t, { who: "buddy", text: `Error: ${(e as Error).message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Simulate WhatsApp</h1>
      <p className="subtitle">Stands in for the WhatsApp Business API webhook (PRD section 22) — same backend endpoint either way.</p>

      <div className="row" style={{ marginBottom: 12 }}>
        <select value={phone} onChange={(e) => { setPhone(e.target.value); setTurns([]); }} style={{ maxWidth: 320 }}>
          {clients.map((c) => (
            <option key={c.id} value={c.phone}>{c.name} — {c.phone}</option>
          ))}
        </select>
      </div>

      <div className="chat" ref={chatRef}>
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.who === "client" ? "inbound" : "outbound"}`}>
            {t.text}
            {t.meta && <div className="meta">{t.meta}</div>}
          </div>
        ))}
        {turns.length === 0 && <p className="meta">Pick a client and send a message to try a scenario.</p>}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <input
          placeholder="Type a message… e.g. 'Can I have rice?' or 'Can I stop my BP medicine?'"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="primary" disabled={sending} onClick={send}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
