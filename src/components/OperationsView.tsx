"use client";

import { useState } from "react";
import { claims, formatAmount, formatDateTime } from "@/data/claims";
import type { Claim, Email } from "@/types";

const shadow = "0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.03)";
const shadowMd = "0 2px 8px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)";

export default function OperationsView() {
  const allTimeline = claims
    .flatMap((c) => c.timeline)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.5px" }}>
        Operations Dashboard
      </h2>
      <p style={{ fontSize: 14, color: "#475569", marginBottom: 28 }}>
        Active claims and system integrations
      </p>

      {/* Claims grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
          gap: 16,
          marginBottom: 36,
        }}
      >
        {claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} />
        ))}
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 36 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.3px" }}>
          Integration Activity Log
        </h3>
        <div>
          {allTimeline.map((event) => (
            <TimelineItem key={`${event.claim_id}-${event.id}`} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClaimCard({ claim }: { claim: Claim }) {
  const [emailsOpen, setEmailsOpen] = useState(false);
  const receivedDocs = claim.documents.filter(
    (d) => d.status === "received" || d.status === "auto_verified"
  ).length;
  const totalDocs = claim.documents.filter((d) => d.status !== "not_required").length;

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 28,
        padding: 24,
        boxShadow: shadow,
        transition: "box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = shadowMd)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = shadow)}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0d9488", fontFamily: "monospace", marginBottom: 2 }}>
            {claim.id}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px" }}>{claim.vehicle}</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 1 }}>{claim.registration}</div>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      {/* Incident */}
      <p style={{ fontSize: 13, color: "#475569", marginBottom: 14, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {claim.incident}
      </p>

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, marginBottom: 14 }}>
        <Detail label="Insurer" value={claim.insurer} />
        <Detail label="Estimated" value={formatAmount(claim.estimated_amount)} />
        <Detail label="Claimant" value={claim.claimant_name} />
        <Detail label="Surveyor" value={claim.surveyor || "Not assigned"} muted={!claim.surveyor} />
      </div>

      {/* Documents */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eef2f7" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
          Documents: {receivedDocs} / {totalDocs} collected
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {claim.documents
            .filter((d) => d.status !== "not_required")
            .map((doc) => (
              <DocChip key={doc.id} name={doc.name} status={doc.status} />
            ))}
        </div>
      </div>

      {/* Email trail */}
      {claim.emails.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eef2f7" }}>
          <div
            onClick={() => setEmailsOpen(!emailsOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "#475569",
              userSelect: "none",
            }}
          >
            <span>Email Trail ({claim.emails.length})</span>
            <span style={{ marginLeft: "auto", fontSize: 10, transition: "transform 0.2s", transform: emailsOpen ? "rotate(180deg)" : "none" }}>
              ▾
            </span>
          </div>
          {emailsOpen && (
            <div className="animate-fade-in" style={{ paddingTop: 8 }}>
              {claim.emails.map((email) => (
                <EmailItem key={email.id} email={email} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmailItem({ email }: { email: Email }) {
  const [expanded, setExpanded] = useState(false);
  const isSent = email.direction === "sent";

  return (
    <div
      style={{
        border: "1px solid #eef2f7",
        borderRadius: 16,
        marginBottom: 8,
        overflow: "hidden",
        transition: "box-shadow 0.2s ease",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        style={{
          padding: "10px 12px",
          cursor: "pointer",
          background: "#ffffff",
          borderLeft: `3px solid ${isSent ? "#2563eb" : "#16a34a"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              background: isSent ? "#dbeafe" : "#dcfce7",
              color: isSent ? "#2563eb" : "#16a34a",
            }}
          >
            {email.direction}
          </span>
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 500,
              background: "#f1f5f9",
              color: "#475569",
            }}
          >
            {email.type}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8", fontFamily: "monospace", whiteSpace: "nowrap" }}>
            {formatDateTime(email.timestamp)}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>
          {email.subject}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#94a3b8" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{email.from}</span>
          <span>→</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{email.to}</span>
        </div>
      </div>
      {expanded && (
        <div
          className="animate-fade-in"
          style={{ padding: 12, background: "#f8fafc", borderTop: "1px solid #eef2f7" }}
        >
          <pre style={{ fontSize: 12, lineHeight: 1.6, color: "#0f172a", whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, background: "none" }}>
            {email.body}
          </pre>
        </div>
      )}
    </div>
  );
}

function DocChip({ name, status }: { name: string; status: string }) {
  const label = name
    .replace("Registration Certificate (RC)", "RC")
    .replace("Driving License", "DL")
    .replace("Insurance Policy Copy", "Policy")
    .replace("Damage Photographs", "Photos")
    .replace("Signed Claim Form", "Claim Form")
    .replace("Repair Estimate", "Repair Est.")
    .replace("Surveyor Report", "Survey Rpt.")
    .replace("FIR Copy", "FIR")
    .replace("Medical Report", "Medical")
    .replace("Road Accident Report", "Road Rpt.")
    .replace("Port Incident Report", "Port Rpt.")
    .replace("Final Repair Invoice", "Invoice");

  const ok = status === "received" || status === "auto_verified";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 14,
        fontSize: 11,
        fontWeight: 500,
        background: ok ? "#dcfce7" : "#fef3c7",
        color: ok ? "#16a34a" : "#d97706",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: ok ? "#16a34a" : "#d97706",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

function Detail({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.3px", fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, marginTop: 1, color: muted ? "#94a3b8" : "#0f172a" }}>{value}</div>
    </div>
  );
}

const dotColors: Record<string, string> = {
  filing:        "#0d9488",
  integration:   "#2563eb",
  email:         "#3b82f6",
  verification:  "#16a34a",
  assignment:    "#7c3aed",
  documentation: "#d97706",
  scheduling:    "#2563eb",
  inspection:    "#7c3aed",
  approval:      "#16a34a",
  repair:        "#d97706",
  settlement:    "#16a34a",
  risk:          "#dc2626",
};

function TimelineItem({
  event,
}: {
  event: { type: string; description: string; claim_id: string; timestamp: string };
}) {
  return (
    <div
      style={{
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 13,
        borderBottom: "1px solid #eef2f7",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span
        style={{
          fontSize: 11,
          color: "#94a3b8",
          whiteSpace: "nowrap",
          minWidth: 110,
          fontFamily: "monospace",
        }}
      >
        {formatDateTime(event.timestamp)}
      </span>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotColors[event.type] || "#94a3b8",
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1 }}>{event.description}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#0d9488",
          background: "#ccfbf1",
          padding: "2px 8px",
          borderRadius: 10,
          whiteSpace: "nowrap",
        }}
      >
        {event.claim_id}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    New:           { bg: "#dbeafe", color: "#2563eb" },
    "In Progress": { bg: "#fef3c7", color: "#d97706" },
    "In Repair":   { bg: "#ede9fe", color: "#7c3aed" },
    Settled:       { bg: "#dcfce7", color: "#16a34a" },
  };
  const s = map[status] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 13px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
        letterSpacing: "0.2px",
      }}
    >
      {status}
    </span>
  );
}
