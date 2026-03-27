"use client";

import { claims, agentDecisions, formatAmount, formatDateTime } from "@/data/claims";

export default function ManagementView() {
  const totalEstimated = claims.reduce((s, c) => s + c.estimated_amount, 0);
  const settledClaims = claims.filter((c) => c.settled_amount !== null);
  const totalSettled = settledClaims.reduce((s, c) => s + (c.settled_amount || 0), 0);

  const statusCounts: Record<string, number> = {};
  claims.forEach((c) => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  const avgResolution =
    settledClaims.length > 0
      ? Math.round(
          settledClaims.reduce((sum, c) => {
            const filed = new Date(c.filed_date).getTime();
            const last = c.timeline[c.timeline.length - 1];
            const resolved = new Date(last.timestamp).getTime();
            return sum + (resolved - filed) / (1000 * 60 * 60 * 24);
          }, 0) / settledClaims.length
        )
      : 0;

  const statusConfig: Record<string, { color: string; bar: string }> = {
    New:           { color: "#2563eb", bar: "#3b82f6" },
    "In Progress": { color: "#d97706", bar: "#f59e0b" },
    "In Repair":   { color: "#7c3aed", bar: "#8b5cf6" },
    Settled:       { color: "#16a34a", bar: "#22c55e" },
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.5px" }}>
        Management Metrics
      </h2>
      <p style={{ fontSize: 14, color: "#475569", marginBottom: 28 }}>
        Portfolio overview and agent performance
      </p>

      {/* Metrics — flat row style matching original */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 0,
          marginBottom: 36,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {[
          { label: "Total Claims", value: String(claims.length), accent: "#0d9488" },
          { label: "Total Estimated", value: formatAmount(totalEstimated), accent: "#0d9488" },
          { label: "Total Settled", value: formatAmount(totalSettled), accent: "#16a34a" },
          { label: "Avg Resolution", value: `${avgResolution} days`, accent: "#7c3aed" },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              padding: "16px 0",
              borderBottom: "1px solid #e2e8f0",
              paddingRight: 24,
            }}
          >
            <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
              {m.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.5px", color: m.accent }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div style={{ marginBottom: 36 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.3px" }}>
          Claims by Status
        </h3>
        <div
          style={{
            display: "flex",
            height: 8,
            borderRadius: 4,
            overflow: "hidden",
            gap: 2,
            marginBottom: 12,
          }}
        >
          {(["New", "In Progress", "In Repair", "Settled"] as const).map((s) => {
            const count = statusCounts[s] || 0;
            if (count === 0) return null;
            return (
              <div
                key={s}
                style={{
                  width: `${(count / claims.length) * 100}%`,
                  background: statusConfig[s].bar,
                  borderRadius: 4,
                  transition: "width 0.3s ease",
                }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {(["New", "In Progress", "In Repair", "Settled"] as const).map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusConfig[s].bar }} />
              <span>{s} ({statusCounts[s] || 0})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent decisions */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.3px" }}>
          Agent Decisions Log
        </h3>
        <div>
          {agentDecisions.map((d, i) => (
            <AgentDecisionRow key={i} decision={d} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentDecisionRow({
  decision,
}: {
  decision: { type: string; action: string; claim_id: string; timestamp: string };
}) {
  const typeBadge: Record<string, { bg: string; color: string }> = {
    scheduling:    { bg: "#dbeafe", color: "#2563eb" },
    integration:   { bg: "#ede9fe", color: "#7c3aed" },
    risk:          { bg: "#fee2e2", color: "#dc2626" },
    repair:        { bg: "#fef3c7", color: "#d97706" },
    settlement:    { bg: "#dcfce7", color: "#16a34a" },
    approval:      { bg: "#dcfce7", color: "#16a34a" },
    documentation: { bg: "#fef3c7", color: "#d97706" },
  };
  const s = typeBadge[decision.type] || { bg: "#f1f5f9", color: "#475569" };

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
          fontSize: 10,
          fontWeight: 600,
          padding: "3px 8px",
          borderRadius: 10,
          textTransform: "uppercase",
          letterSpacing: "0.3px",
          whiteSpace: "nowrap",
          background: s.bg,
          color: s.color,
        }}
      >
        {decision.type}
      </span>
      <span style={{ flex: 1 }}>{decision.action}</span>
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
        {decision.claim_id}
      </span>
      <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
        {formatDateTime(decision.timestamp)}
      </span>
    </div>
  );
}
