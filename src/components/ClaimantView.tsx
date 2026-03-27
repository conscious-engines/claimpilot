"use client";

import { useState, useRef, useEffect } from "react";
import { claims, claimantConversation } from "@/data/claims";

const activeClaim = claims[0];

export default function ClaimantView() {
  const [visibleCount, setVisibleCount] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messages = claimantConversation;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleCount, isTyping]);

  function advanceConversation() {
    if (visibleCount >= messages.length) return;
    const next = messages[visibleCount];
    if (next.role === "assistant") {
      setIsTyping(true);
      setTimeout(() => { setIsTyping(false); setVisibleCount((c) => c + 1); }, 1500);
    } else {
      setVisibleCount((c) => c + 1);
    }
  }

  useEffect(() => {
    if (visibleCount >= messages.length) return;
    const last = messages[visibleCount - 1];
    const next = messages[visibleCount];
    if (last?.role === "user" && next?.role === "assistant") {
      const t = setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => { setIsTyping(false); setVisibleCount((c) => c + 1); }, 1800);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [visibleCount, messages]);

  return (
    <div style={{
      maxWidth: 520, margin: "0 auto",
      height: "calc(100vh - 60px)",
      display: "flex", flexDirection: "column",
      background: "#fff",
    }}>
      {/* Chat header */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "#ccfbf1", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 13, fontWeight: 700,
          color: "#0d9488", flexShrink: 0,
        }}>CP</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.3px" }}>
            ClaimPilot Assistant
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeClaim.vehicle} &middot; {activeClaim.registration}
          </div>
        </div>
        <StatusBadge status={activeClaim.status} />
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "20px 16px",
        display: "flex", flexDirection: "column",
        gap: 16, background: "#f8fafc",
      }}>
        {messages.slice(0, visibleCount).map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={chatEndRef} />
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid #e2e8f0",
        background: "#fff", flexShrink: 0,
        boxShadow: "0 -1px 4px rgba(15,23,42,0.03)",
      }}>
        {visibleCount < messages.length ? (
          <button
            onClick={advanceConversation}
            style={{
              width: "100%", padding: "11px 18px",
              background: "#0d9488", color: "#fff", border: "none",
              borderRadius: 24, fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0f766e")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#0d9488")}
          >
            Continue
            <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 8 }}>
              {visibleCount} / {messages.length}
            </span>
          </button>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13, color: "#94a3b8", padding: "8px 0" }}>
            Claim closed — cashless repair complete, vehicle delivered
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: (typeof claimantConversation)[0] }) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Document upload — standalone attachment card
  if (message.format === "doc_upload") {
    const isAssistant = !isUser;
    const iconBg = isAssistant ? "#ccfbf1" : "#fee2e2";
    const iconColor = isAssistant ? "#0d9488" : "#dc2626";
    const borderRadius = isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px";
    const fileSize = isAssistant ? "118 KB" : "284 KB";

    return (
      <div className="animate-fade-in" style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
        <div style={{ maxWidth: "80%" }}>
          <div style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
              <div style={{
                width: 40, height: 48, borderRadius: 6,
                background: iconBg,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="9" y1="13" x2="15" y2="13"/>
                  <line x1="9" y1="17" x2="12" y2="17"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {message.content}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>PDF · {fileSize}</div>
              </div>
            </div>
            <div style={{
              borderTop: "1px solid #f1f5f9", padding: "6px 16px",
              background: "#f8fafc",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 4, color: isAssistant ? "#0d9488" : "#16a34a" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {isAssistant ? "Shared" : "Sent"}
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{time}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Photo message
  if (message.format === "photo" && message.images) {
    return (
      <div className="animate-fade-in" style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ maxWidth: "80%" }}>
          <div style={{
            background: "#0d9488",
            borderRadius: "16px 16px 4px 16px",
            overflow: "hidden", padding: 6,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
              {message.images.map((img, i) => (
                <div key={i} style={{
                  aspectRatio: "1", borderRadius: 8, background: "#0f766e",
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      const p = (e.target as HTMLImageElement).parentElement!;
                      (e.target as HTMLImageElement).style.display = "none";
                      p.innerHTML = `<span style="font-size:11px;color:rgba(255,255,255,0.6);padding:8px">Photo ${i + 1}</span>`;
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ padding: "6px 6px 2px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                {message.images.length} photos
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{time}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular text message
  return (
    <div className="animate-fade-in" style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "85%",
        padding: "12px 16px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? "#0d9488" : "#f1f5f9",
        color: isUser ? "#fff" : "#0f172a",
        fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
      }}>
        {message.content}
        <div style={{ fontSize: 10, marginTop: 6, color: isUser ? "rgba(255,255,255,0.5)" : "#94a3b8" }}>
          {time}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="animate-fade-in" style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{
        padding: "14px 16px", borderRadius: "18px 18px 18px 4px",
        background: "#f1f5f9", display: "flex", gap: 4, alignItems: "center",
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "#94a3b8",
            animation: "bounce-dot 1.2s infinite",
            animationDelay: `${i * 0.2}s`,
          }}/>
        ))}
      </div>
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
    <span style={{
      display: "inline-block", padding: "5px 12px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
      whiteSpace: "nowrap", letterSpacing: "0.2px", flexShrink: 0,
    }}>
      {status}
    </span>
  );
}
