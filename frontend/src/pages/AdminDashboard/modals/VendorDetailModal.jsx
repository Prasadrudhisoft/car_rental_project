// ─────────────────────────────────────────────────────────────────────────────
// VendorDetailModal.jsx
// Full vendor profile sheet with KYC checklist, bank details, and action
// buttons (approve / reject / suspend / reinstate / request-info).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { StatusBadge } from "../AdminShared";
import { KYCDocumentCell } from "../MediaComponents";
import { VENDOR_STATUS_CLR, fmtDate, getKYCStatus } from "../adminConstants";

export default function VendorDetailModal({ vendor: v, onClose, onAction }) {
    const [note, setNote] = useState(v.admin_note || "");
    const [busy, setBusy]  = useState(false);
    const kycStatus = getKYCStatus(v);

    const handleAction = async (action) => {
        setBusy(true);
        await onAction(v.id, action, note);
        setBusy(false);
    };

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>

                {/* Head */}
                <div className="admin-modal__head">
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="admin-vendor-card__avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
                            {v.business_name?.[0]?.toUpperCase() || "V"}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{v.business_name}</h2>
                            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                                <StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} />
                                <span style={{ fontSize: 12, color: "var(--vm)" }}>{v.email}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--vm)", fontFamily: "Inter,sans-serif" }}>
                        ✕ Close
                    </button>
                </div>

                {/* KYC banner */}
                <div className={`admin-kyc-banner ${kycStatus.complete ? "admin-kyc-banner--ok" : "admin-kyc-banner--warn"}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{kycStatus.complete ? "✅" : "⚠️"}</span>
                        <div>
                            <strong style={{ fontSize: 13 }}>
                                KYC: {kycStatus.done}/{kycStatus.total} complete
                                {kycStatus.complete ? " — Ready for Approval" : ""}
                            </strong>
                            <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                                {[
                                    [kycStatus.checks.identity, "Identity"],
                                    [kycStatus.checks.bank,     "Bank"],
                                    [kycStatus.checks.city,     "City"],
                                    [kycStatus.checks.location, "Map Pin"],
                                    [kycStatus.checks.document, "KYC Doc"],
                                ].map(([done, label]) => (
                                    <span key={label} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: done ? "#D1FAE5" : "#FEE2E2", color: done ? "#059669" : "#EF4444" }}>
                                        {done ? "✓" : "✗"} {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="admin-modal__body">

                    {/* Left col */}
                    <div className="admin-modal__col">
                        <div className="admin-modal__section-label">Business Info</div>
                        {[
                            ["Business Name", v.business_name],
                            ["GSTIN",         v.gstin || "—"],
                            ["Rating",        v.rating > 0 ? `⭐ ${v.rating} (${v.total_reviews})` : "No reviews"],
                            ["Member Since",  fmtDate(v.created_at)],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span><strong>{val}</strong>
                            </div>
                        ))}

                        <div className="admin-modal__section-label" style={{ marginTop: 14 }}>Contact & Address</div>
                        {[
                            ["Email",  v.email],
                            ["Phone",  v.phone],
                            ["City",   v.city_name || "—"],
                            ["State",  v.state     || "—"],
                            ["PIN",    v.pincode   || "—"],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span><strong>{val}</strong>
                            </div>
                        ))}
                        {v.latitude && v.longitude && (
                            <div className="admin-modal__row">
                                <span>Map Pin</span>
                                <a href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--teal-primary)", fontWeight: 600 }}>
                                    📍 View ↗
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Right col */}
                    <div className="admin-modal__col">
                        <div className="admin-modal__section-label">Identity & KYC</div>
                        {[
                            ["Aadhaar", v.aadhaar_number ? `••••••${v.aadhaar_number.slice(-4)}` : "—"],
                            ["PAN",     v.pan_number || "—"],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span><strong>{val}</strong>
                            </div>
                        ))}
                        <div className="admin-modal__row" style={{ alignItems: "flex-start" }}>
                            <span>KYC Document</span>
                            <KYCDocumentCell url={v.kyc_document} />
                        </div>

                        <div className="admin-modal__section-label" style={{ marginTop: 14 }}>Bank Details</div>
                        {[
                            ["Account Name", v.bank_account_name || "—"],
                            ["Account No.",  v.bank_account_no ? `••••${v.bank_account_no.slice(-4)}` : "—"],
                            ["IFSC",         v.bank_ifsc || "—"],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span><strong>{val}</strong>
                            </div>
                        ))}

                        <div className="admin-modal__section-label" style={{ marginTop: 14 }}>Admin Action</div>
                        <textarea className="admin-modal__note" placeholder="Add an admin note…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                        <div className="admin-modal__actions">
                            {v.status === "pending" && (
                                <>
                                    <button className={`admin-btn admin-btn--success${!kycStatus.complete ? " admin-btn--dim" : ""}`} onClick={() => handleAction("approve")} disabled={busy}>{busy ? "…" : "✓ Approve"}</button>
                                    <button className="admin-btn admin-btn--warning" onClick={() => handleAction("more_info")} disabled={busy}>📋 Request Info</button>
                                    <button className="admin-btn admin-btn--danger"  onClick={() => handleAction("reject")}   disabled={busy}>{busy ? "…" : "✕ Reject"}</button>
                                </>
                            )}
                            {v.status === "more_info" && (
                                <>
                                    <button className="admin-btn admin-btn--success" onClick={() => handleAction("approve")} disabled={busy}>{busy ? "…" : "✓ Approve"}</button>
                                    <button className="admin-btn admin-btn--danger"  onClick={() => handleAction("reject")}  disabled={busy}>{busy ? "…" : "✕ Reject"}</button>
                                </>
                            )}
                            {v.status === "approved" && (
                                <button className="admin-btn admin-btn--warning" onClick={() => handleAction("suspend")} disabled={busy}>{busy ? "…" : "⚠ Suspend"}</button>
                            )}
                            {(v.status === "suspended" || v.status === "rejected") && (
                                <button className="admin-btn admin-btn--success" onClick={() => handleAction("reinstate")} disabled={busy}>{busy ? "…" : "↩ Reinstate"}</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
