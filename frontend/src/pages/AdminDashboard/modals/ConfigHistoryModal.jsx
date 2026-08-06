// ─────────────────────────────────────────────────────────────────────────────
// ConfigHistoryModal.jsx
// Shows the change_log audit trail for a single ConfigSetting.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { fmtDatetime } from "../adminConstants";

export default function ConfigHistoryModal({ setting, history, loading, onClose }) {
    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Change History</h2>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--vm)" }}>
                            {setting?.display_name} <code style={{ fontSize: 10 }}>{setting?.key}</code>
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--vm)", fontFamily: "Inter,sans-serif" }}>
                        ✕ Close
                    </button>
                </div>
                <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
                    {loading && (
                        <div className="admin-loading" style={{ padding: 40 }}>
                            <div className="admin-loading__spinner" /><span>Loading history…</span>
                        </div>
                    )}
                    {!loading && history.length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--vm)", fontSize: 13, fontStyle: "italic", padding: "24px 0" }}>
                            No changes recorded yet.
                        </p>
                    )}
                    {!loading && history.map((h) => (
                           <div key={h.id} style={{ background: "var(--vs2)", border: "1px solid var(--vbdr)", borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                                <span>
                                    <strong style={{ color: "#EF4444" }}>{h.old_value}</strong>
                                    {" → "}
                                    <strong style={{ color: "#059669" }}>{h.new_value}</strong>
                                </span>
                                <span style={{ color: "var(--vm)", flexShrink: 0 }}>{fmtDatetime(h.changed_at)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--vt2)" }}>
                                By {h.changed_by || "—"}
                                {h.change_reason ? ` · "${h.change_reason}"` : ""}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}