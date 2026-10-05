// ─────────────────────────────────────────────────────────────────────────────
// UserDetailModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { KYC_STATUS_CLR, fmtDate } from "../adminConstants";

export default function UserDetailModal({ user: u, onClose }) {
    const kyc     = KYC_STATUS_CLR[u.kyc_status] || KYC_STATUS_CLR.pending;
    const hasProf = u.driving_licence !== undefined;

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal user-modal" onClick={(e) => e.stopPropagation()}>

                {/* Head */}
                <div className="admin-modal__head">
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="user-modal__avatar">{u.full_name?.[0]?.toUpperCase() || "?"}</div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{u.full_name || "—"}</h2>
                            <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: "var(--vm)" }}>{u.email}</span>
                                {u.phone && <span style={{ fontSize: 12, color: "var(--vm)" }}>· {u.phone}</span>}
                                {u.kyc_status && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: kyc.bg, color: kyc.color }}>
                                        KYC {u.kyc_status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--vm)", fontFamily: 'inherit', flexShrink: 0 }}>
                        ✕ Close
                    </button>
                </div>

                <div className="user-modal__body">
                    {/* Left col */}
                    <div className="user-modal__col">
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">👤 Account Details</div>
                            <div className="bk-modal__rows">
                                {[["Full Name", u.full_name || "—"], ["Email", u.email], ["Phone", u.phone || "—"], ["Member Since", fmtDate(u.date_joined)]].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row"><span>{l}</span><strong>{val}</strong></div>
                                ))}
                                <div className="bk-modal__row">
                                    <span>Email</span>
                                    <strong style={{ color: u.is_email_verified ? "#059669" : "#EF4444" }}>
                                        {u.is_email_verified ? "✓ Verified" : "✕ Not verified"}
                                    </strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Phone</span>
                                    <strong style={{ color: u.is_phone_verified ? "#059669" : "#EF4444" }}>
                                        {u.is_phone_verified ? "✓ Verified" : "✕ Not verified"}
                                    </strong>
                                </div>
                            </div>
                        </div>
                        {hasProf && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">🪪 Identity & KYC</div>
                                <div className="bk-modal__rows">
                                    {[
                                        ["Aadhaar", u.aadhaar_number ? `••••••••${u.aadhaar_number.slice(-4)}` : "—"],
                                        ["PAN",     u.pan_number || "—"],
                                        ["DOB",     fmtDate(u.date_of_birth)],
                                    ].map(([l, val]) => (
                                        <div key={l} className="bk-modal__row"><span>{l}</span><strong>{val}</strong></div>
                                    ))}
                                    <div className="bk-modal__row">
                                        <span>KYC Status</span>
                                        <strong style={{ color: kyc.color }}>{u.kyc_status || "pending"}</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right col */}
                    <div className="user-modal__col">
                        {hasProf && (
                            <>
                                <div className="bk-modal__section">
                                    <div className="bk-modal__section-hd">🚗 Driving Licence</div>
                                    <div className="bk-modal__rows">
                                        {[["Licence No.", u.driving_licence || "—"], ["Expiry", u.dl_expiry ? fmtDate(u.dl_expiry) : "—"]].map(([l, val]) => {
                                            const expired = l === "Expiry" && u.dl_expiry && new Date(u.dl_expiry) < new Date();
                                            return (
                                                <div key={l} className="bk-modal__row">
                                                    <span>{l}</span>
                                                    <strong style={{ color: expired ? "#EF4444" : "inherit" }}>{val}{expired ? " ⚠ Expired" : ""}</strong>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="bk-modal__section">
                                    <div className="bk-modal__section-hd">⭐ Loyalty & Bookings</div>
                                    <div className="user-modal__stats">
                                        {[
                                            [(u.loyalty_points || 0).toLocaleString("en-IN"), "Loyalty Points", "#D97706"],
                                            [u.total_bookings  ?? "—", "Total Bookings", "#1D4ED8"],
                                            [u.active_bookings ?? "—", "Active Now",     "#059669"],
                                        ].map(([val, lbl, color]) => (
                                            <div key={lbl} className="user-modal__stat">
                                                <span className="user-modal__stat-val" style={{ color }}>{val}</span>
                                                <span className="user-modal__stat-lbl">{lbl}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
