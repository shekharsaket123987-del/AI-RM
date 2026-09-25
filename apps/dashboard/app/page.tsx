"use client";

import { useEffect, useState } from "react";
import { api, type Escalation } from "../lib/api";

export default function OverviewPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listEscalations()
      .then(setEscalations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const open = escalations.filter((e) => ["open", "assigned", "in_progress", "reopened"].includes(e.status));
  const openByLevel = (level: string) => open.filter((e) => e.level === level).length;
  const overSla = open.filter((e) => {
    const hours = (Date.now() - new Date(e.createdAt).getTime()) / 36e5;
    const limit = e.level === "L3" ? 0.5 : e.level === "L2" ? 4 : 24;
    return hours > limit;
  }).length;

  return (
    <div>
      <h1>Overview</h1>
      <p className="subtitle">PRD section 24 — what humans need to see, at a glance.</p>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#c53030" }}>Backend not reachable: {error}</p>}
      {!loading && !error && (
        <>
          <div className="grid">
            <div className="stat">
              <div className="num">{open.length}</div>
              <div className="label">Open escalations</div>
            </div>
            <div className="stat">
              <div className="num level-L3">{openByLevel("L3")}</div>
              <div className="label">L3 open now</div>
            </div>
            <div className="stat">
              <div className="num level-L2">{openByLevel("L2")}</div>
              <div className="label">L2 open</div>
            </div>
            <div className="stat">
              <div className="num level-L1">{openByLevel("L1")}</div>
              <div className="label">L1 watch-list</div>
            </div>
            <div className="stat">
              <div className="num">{overSla}</div>
              <div className="label">Unresolved past SLA</div>
            </div>
          </div>

          <h2>Most recent escalations</h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Level</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {escalations.slice(0, 8).map((e) => (
                <tr key={e.id}>
                  <td>{e.clientId}</td>
                  <td><span className={`badge badge-${e.level}`}>{e.level}</span></td>
                  <td>{e.triggerRuleId}</td>
                  <td>{e.status}</td>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {escalations.length === 0 && (
                <tr><td colSpan={5}>No escalations yet — try the Simulate page.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
