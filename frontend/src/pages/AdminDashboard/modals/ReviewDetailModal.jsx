// ─────────────────────────────────────────────────────────────────────────────
// ReviewDetailModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { StarDisplay } from "../AdminShared";
import { fmtDate } from "../adminConstants";

export default function ReviewDetailModal({ review: r, onClose }) {
    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal__head">
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Review — {r.customer_name}</h2>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--vm)", fontFamily: "Inter,sans-serif" }}>
                        ✕ Close
                    </button>
                </div>
                <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        {[["Vendor Rating", r.vendor_rating], ["Vehicle Rating", r.vehicle_rating]].map(([lbl, val]) => (
                            <div key={lbl}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--vm)", marginBottom: 6 }}>{lbl}</div>
                                <StarDisplay value={val || 0} size={20} />
                            </div>
                        ))}
                    </div>
                    {[["Customer", r.customer_name || "—"], ["Vehicle", r.vehicle_display || "—"], ["Date", fmtDate(r.created_at)]].map(([l, val]) => (
                        <div key={l} className="admin-modal__row"><span>{l}</span><strong>{val}</strong></div>
                    ))}
                    {r.review_text && (
                        <div style={{ background: "var(--vs2)", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "12px 16px", fontSize: 13, fontStyle: "italic", color: "var(--vt2)", lineHeight: 1.65 }}>
                            "{r.review_text}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
