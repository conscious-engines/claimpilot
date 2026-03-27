"use client";

import { useState, useRef, useEffect } from "react";
import type { ViewRole } from "@/app/page";

const roles: { id: ViewRole; name: string; desc: string }[] = [
  { id: "claimant",   name: "Claimant",    desc: "Chat & claim journey" },
  { id: "operations", name: "Operations",  desc: "Claims dashboard" },
  { id: "management", name: "Management",  desc: "Portfolio metrics" },
];

export default function Header({
  role,
  setRole,
}: {
  role: ViewRole;
  setRole: (r: ViewRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = roles.find((r) => r.id === role)!;

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100, height: 60,
      background: "#1e293b", display: "flex", alignItems: "center",
      padding: "0 24px", justifyContent: "space-between",
      boxShadow: "0 1px 3px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.08)",
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Logo mark */}
        <div style={{
          width: 34, height: 34, background: "#0d9488", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 17, color: "#fff", letterSpacing: "-0.5px" }}>
          ClaimPilot
        </span>
      </div>

      {/* Role selector */}
      <div style={{ position: "relative" }} ref={ref}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginRight: 8 }}>Viewing as</span>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 18px", background: "rgba(255,255,255,0.1)",
            border: "none", borderRadius: 20, color: "#fff",
            fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          {current.name}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {open && (
          <div className="animate-fade-in" style={{
            position: "absolute", top: "calc(100% + 8px)", left: "50%",
            transform: "translateX(-50%)", background: "#fff", borderRadius: 20,
            boxShadow: "0 2px 6px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.12)",
            minWidth: 300, padding: 8, zIndex: 200,
          }}>
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "10px 12px", border: "none",
                  background: role === r.id ? "#ccfbf1" : "transparent",
                  borderRadius: 16, cursor: "pointer", textAlign: "left",
                  fontFamily: "inherit", transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: role === r.id ? "#0d9488" : "#f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <RoleIcon id={r.id} active={role === r.id} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 1 }}>{r.desc}</div>
                </div>
                {role === r.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>POC v0.2</span>
    </header>
  );
}

function RoleIcon({ id, active }: { id: ViewRole; active: boolean }) {
  const c = active ? "#fff" : "#475569";
  if (id === "claimant") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
  if (id === "operations") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
