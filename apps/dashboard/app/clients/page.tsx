"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Client } from "../../lib/api";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listClients().then(setClients).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Clients</h1>
      <p className="subtitle">Read-only client list from the Source zone (PRD section 20).</p>
      {loading && <p>Loading…</p>}
      {!loading && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>{c.clientType}</td>
                <td>{c.location}</td>
                <td><Link href={`/clients/${c.id}`}>View 360 →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
