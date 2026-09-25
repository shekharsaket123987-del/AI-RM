import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "AI Health Buddy — RM Dashboard" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav className="sidenav">
            <div className="brand">Fitelo AI Health Buddy</div>
            <Link href="/">Overview</Link>
            <Link href="/escalations">Escalation Inbox</Link>
            <Link href="/clients">Clients</Link>
            <Link href="/kb">Knowledge Base</Link>
            <Link href="/simulate">Simulate WhatsApp</Link>
          </nav>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
