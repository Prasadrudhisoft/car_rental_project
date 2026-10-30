// ─────────────────────────────────────────────────────────────────────────────
// VehicleDetailModal.jsx
// Full vehicle review sheet: pipeline progress, document checklist,
// photo strip, status change, certification, VAHAN check, blacklist.
//
// NEW: pending-edit approval panel. When a vendor submits changes to an
// already-reviewed vehicle, the backend stages them (pending_changes) and
// sets needs_review=True instead of applying them. This panel shows the
// old → new diff and lets the admin Approve & Apply or Reject.
// Also shows a re-verification panel when odometer distance crosses the
// configured threshold.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { StatusBadge } from "../AdminShared";
import { DocPreviewRow } from "../MediaComponents";
import {
    VEHICLE_STATUS_CLR,
    REQUIRED_DOCS,
    PIPELINE_STEPS,
    fmtDatetime,
} from "../adminConstants";

export default function VehicleDetailModal({
    vehicle: v,
    onClose,
    docNotes,
    setDocNotes,
    blacklistReasons,
    setBlacklistReasons,
    onDocReview,
    onBlacklist,
    onSetStatus,
    onVahanCheck,
    onApproveEdit,
    onRejectEdit,
    onCompleteReverification,
    setVehiclePhotoLightbox,
}) {
    const docMap     = Object.fromEntries((v.documents || []).map((d) => [d.doc_type, d]));
    const [openDoc, setOpenDoc] = useState(null);
    const approvedCount = REQUIRED_DOCS.filter(({ key }) => docMap[key]?.status === "approved").length;
    const allApproved   = approvedCount === REQUIRED_DOCS.length;
    const firstPending  = REQUIRED_DOCS.find(({ key }) => docMap[key]?.status !== "approved")?.key;
    const activeKey     = openDoc ?? firstPending;
    const canReview     = v.status !== "PENDING_DOCS";
    const photoCount = (v.photos || []).length;
    const currentStep = PIPELINE_STEPS.find((p) => p.status === v.status)?.step ?? 0;

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" style={{ maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>

                {/* Head */}
                <div className="admin-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                            {v.year} {v.make} {v.model}
                        </h2>
                        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <span className="vcard-v2__plate">{v.plate_number}</span>
                            <StatusBadge status={v.status} colorMap={VEHICLE_STATUS_CLR} />
                            {v.is_blacklisted && <span className="admin-blacklisted-badge">🚫 Blacklisted</span>}
                            {v.is_certified   && <span className="admin-certified-badge">✅ Certified</span>}
                            {v.needs_review && (
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: "#FEF3C7", color: "#D97706", border: "1px solid #FCD34D" }}>
                                    ✏️ Vendor Changes Pending
                                </span>
                            )}
                            {v.needs_reverification && (
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: "#FEE2E2", color: "#EF4444", border: "1px solid #FCA5A5" }}>
                                    🔁 Re-verification Due
                                </span>
                            )}
                            <span style={{ fontSize: 11, color: "var(--vm)" }}>
                                {v.vendor?.vendor_profile?.business_name || v.vendor?.email} · {v.city?.name}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--vm)", fontFamily: 'inherit', flexShrink: 0 }}>
                        ✕ Close
                    </button>
                </div>

                {/* Pipeline */}
                {v.status !== "INACTIVE" && (
                    <div className="vcard-pipeline" style={{ padding: "10px 20px", borderBottom: "1px solid var(--vbdr)" }}>
                        {PIPELINE_STEPS.map((step, idx) => {
                            const done   = step.step < currentStep;
                            const active = step.step === currentStep;
                            return (
                                <React.Fragment key={step.status}>
                                    <div className={`vcard-pipeline__step ${done ? "done" : active ? "active" : "future"}`}>
                                        <div className="vcard-pipeline__dot">{done ? "✓" : step.step}</div>
                                        <span>{step.label}</span>
                                    </div>
                                    {idx < PIPELINE_STEPS.length - 1 && (
                                        <div className={`vcard-pipeline__line ${done ? "done" : ""}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {/* ── Pending vendor edit / re-verification panels ── */}
                {(v.needs_review || v.needs_reverification) && (
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--vbdr)", display: "flex", flexDirection: "column", gap: 10 }}>

                        {v.needs_review && (
                            <div className="vcard-action-block" style={{ background: "#FFFBEB", borderColor: "#FCD34D" }}>
                                <div className="vcard-action-block__hd">✏️ Vendor Changes — Awaiting Your Approval</div>
                                {v.last_edited_at && (
                                    <p style={{ fontSize: 11, color: "var(--vm)", margin: "4px 0" }}>
                                        Submitted {fmtDatetime(v.last_edited_at)}. Live values shown throughout this modal
                                        are unchanged until you approve.
                                    </p>
                                )}
                                {(v.pending_changes_readable || []).length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
                                        {v.pending_changes_readable.map((c) => (
                                            <div key={c.field} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, background: "#fff", border: "1px solid #FCD34D", borderRadius: 6, padding: "6px 10px" }}>
                                                <strong>{c.label}</strong>
                                                <span>
                                                    <s style={{ opacity: 0.6 }}>{c.old_value ?? "—"}</s>
                                                    {" → "}
                                                    <strong style={{ color: "#B45309" }}>{c.new_value ?? "—"}</strong>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                    <button className="admin-btn admin-btn--success admin-btn--sm" onClick={() => onApproveEdit(v.id)}>
                                        ✓ Approve &amp; Apply
                                    </button>
                                    <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => onRejectEdit(v.id)}>
                                        ✕ Reject
                                    </button>
                                </div>
                            </div>
                        )}

                        {v.needs_reverification && (
                            <div className="vcard-action-block" style={{ background: "#FEE2E2", borderColor: "#FCA5A5" }}>
                                <div className="vcard-action-block__hd">🔁 Odometer Re-verification Due</div>
                                <p style={{ fontSize: 12, color: "#7F1D1D", margin: "4px 0 8px" }}>
                                    Current odometer: {v.current_odometer?.toLocaleString("en-IN") ?? "—"} km ·
                                    {" "}Last verified: {v.last_verified_odometer?.toLocaleString("en-IN") ?? "—"} km
                                </p>
                                <button className="admin-btn admin-btn--success admin-btn--sm" onClick={() => onCompleteReverification(v.id)}>
                                    ✓ Confirm Re-verified
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="vcard-v2__body" style={{ maxHeight: "60vh", overflowY: "auto" }}>

                    {/* Documents column */}
                                        <div className="vcard-v2__docs-col">
                        <div className="vcard-v2__col-hd">
                            <span>📄 Document approval</span>
                            <span className="vcard-v2__col-sub">{approvedCount}/{REQUIRED_DOCS.length} approved</span>
                        </div>

                        {!canReview && (
                            <div className="admin-config-notice">The vendor has not submitted this vehicle yet. Documents can be reviewed after submission.</div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {REQUIRED_DOCS.map(({ key, label }, i) => {
                                const doc  = docMap[key];
                                const st   = doc?.status;                       // approved | rejected | pending | undefined
                                const col  = st === "approved" ? { bg: "#D1FAE5", fg: "#059669" }
                                           : st === "rejected" ? { bg: "#FEE2E2", fg: "#DC2626" }
                                           : st === "pending"  ? { bg: "#FEF3C7", fg: "#B45309" }
                                           :                     { bg: "#F3F4F6", fg: "#6B7280" };
                                const open = activeKey === key;
                                return (
                                    <div key={key} style={{ border: `1px solid ${open ? col.fg : "var(--vbdr)"}`, borderRadius: 12, background: "var(--vs)" }}>
                                        <button type="button" onClick={() => setOpenDoc(open ? "" : key)}
                                                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "none", border: 0, textAlign: "left", cursor: "pointer" }}>
                                            <span style={{ width: 28, height: 28, borderRadius: "50%", background: col.bg, color: col.fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                                                {st === "approved" ? "✓" : st === "rejected" ? "✕" : i + 1}
                                            </span>
                                            <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{label}</span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: col.fg, textTransform: "capitalize" }}>{st || "Not uploaded"}</span>
                                        </button>

                                        {open && (
                                            <div style={{ padding: "4px 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                                                {!doc ? (
                                                    <span style={{ fontSize: 12, color: "var(--vm)" }}>The vendor has not uploaded this document.</span>
                                                ) : (
                                                    <>
                                                        <DocPreviewRow doc={doc} />
                                                        {doc.expiry_date && <span style={{ fontSize: 12, color: "var(--vt2)" }}>Expiry date: <strong>{doc.expiry_date}</strong></span>}
                                                        {doc.admin_note && st === "rejected" && (
                                                            <span style={{ fontSize: 12, color: "#B45309" }}>Last rejection note: {doc.admin_note}</span>
                                                        )}
                                                        <input className="admin-note-input" style={{ width: "100%" }}
                                                               placeholder="Reason (required to reject)…"
                                                               value={docNotes[doc.id] || ""}
                                                               onChange={(e) => setDocNotes((p) => ({ ...p, [doc.id]: e.target.value }))} />
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button className="admin-btn admin-btn--success" disabled={!canReview || st === "approved"}
                                                                    onClick={() => onDocReview(doc.id, "approve")}>✓ Approve</button>
                                                            <button className="admin-btn admin-btn--danger" disabled={!canReview || st === "rejected" || !(docNotes[doc.id] || "").trim()}
                                                                    onClick={() => onDocReview(doc.id, "reject")}>✕ Reject</button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* final stage: locked until every document is approved */}
                            <div style={{ border: `1px dashed ${allApproved ? "#059669" : "var(--vbdr2)"}`, borderRadius: 12, padding: "10px 12px", background: allApproved ? "#F0FDF4" : "var(--vs2)", fontSize: 12, color: allApproved ? "#059669" : "var(--vm)", fontWeight: 600 }}>
                                {v.status === "LIVE" ? "🟢 All documents approved — vehicle is LIVE."
                                  : allApproved ? "✓ All approved — moving to LIVE automatically."
                                  : `🔒 Final stage (LIVE) unlocks after all ${REQUIRED_DOCS.length} documents are approved.`}
                            </div>
                        </div>

                        {/* photo strip: keep the existing photo pill + thumbnails block here, unchanged */}
                    </div>

                    {/* Actions column */}
                    <div className="vcard-v2__actions-col">

                        {/* Status change */}
                        <div className="vcard-action-block">
                            <div className="vcard-action-block__hd">🔄 Change Status</div>
                            <select
                                className="vcard-status-select"
                                value={v.status}
                                style={{ borderColor: (VEHICLE_STATUS_CLR[v.status]?.color || "#9CA3AF") + "80", color: VEHICLE_STATUS_CLR[v.status]?.color || "var(--vt)", background: VEHICLE_STATUS_CLR[v.status]?.bg || "var(--vs2)" }}
                                onChange={(e) => {
                                    const ns = e.target.value;
                                    if (ns === v.status) return;
                                    const note = window.prompt(`Note for ${v.status} → ${ns}:`, "") ?? "";
                                    onSetStatus(v.id, ns, note);
                                }}
                            >
                                <option value="PENDING_DOCS">⏳ Pending Docs</option>
                                <option value="DOCS_SUBMITTED">📄 Docs Submitted</option>
                                <option value="ADMIN_APPROVED">✅ Admin Approved</option>
                                <option value="LIVE">🟢 Live</option>
                                <option value="INACTIVE">🔴 Inactive</option>
                            </select>
                        </div>


                        {/* VAHAN */}
                        <div className="vcard-action-block">
                            <div className="vcard-action-block__hd">🔍 VAHAN Verification</div>
                            <button className="admin-btn admin-btn--ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onVahanCheck(v.id)}>
                                Run VAHAN Check
                            </button>
                            
                        </div>

                        {/* Blacklist */}
                        {!v.is_blacklisted ? (
                            <div className="vcard-action-block vcard-action-block--danger">
                                <div className="vcard-action-block__hd">🚫 Blacklist Vehicle</div>
                                <input
                                    className="admin-note-input"
                                    placeholder="Reason…"
                                    style={{ width: "100%", boxSizing: "border-box" }}
                                    value={blacklistReasons[v.id] || ""}
                                    onChange={(e) => setBlacklistReasons((p) => ({ ...p, [v.id]: e.target.value }))}
                                />
                                <button className="admin-btn admin-btn--danger" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={() => onBlacklist(v.id)}>
                                    Blacklist &amp; Deactivate
                                </button>
                            </div>
                        ) : (
                            <div className="vcard-action-block" style={{ background: "#FEE2E2", borderColor: "#FCA5A5" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C" }}>🚫 Blacklisted</div>
                                <div style={{ fontSize: 11, color: "#7F1D1D" }}>{v.blacklist_reason || "No reason recorded."}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}