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
import React from "react";
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
    certifyForms,
    setCertifyForms,
    blacklistReasons,
    setBlacklistReasons,
    onDocReview,
    onCertify,
    onBlacklist,
    onSetStatus,
    onVahanCheck,
    onApproveEdit,
    onRejectEdit,
    onCompleteReverification,
    setVehiclePhotoLightbox,
}) {
    const docMap     = Object.fromEntries((v.documents || []).map((d) => [d.doc_type, d]));
    const requiredOk = ["rc", "insurance", "puc"].every((k) => docMap[k]?.status === "approved");
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
                            <span>📄 Documents</span>
                            <span className="vcard-v2__col-sub">
                                {(v.documents || []).filter((d) => d.status === "approved").length}/{(v.documents || []).length} approved
                            </span>
                        </div>
                        <div className="vcard-doclist">
                            {REQUIRED_DOCS.map(({ key, label, required }) => {
                                const doc = docMap[key];
                                const sc  = doc
                                    ? doc.status === "approved" ? { bg: "#D1FAE5", color: "#059669" }
                                    : doc.status === "rejected" ? { bg: "#FEE2E2", color: "#EF4444" }
                                    :                             { bg: "#FEF3C7", color: "#D97706" }
                                    : { bg: "#F3F4F6", color: "#9CA3AF" };
                                return (
                                    <div key={key} className="vcard-doclist__row">
                                        <div className="vcard-doclist__indicator" style={{ background: sc.bg, color: sc.color }}>
                                            {!doc ? "—" : doc.status === "approved" ? "✓" : doc.status === "rejected" ? "✕" : "⏳"}
                                        </div>
                                        <div className="vcard-doclist__info">
                                            <span className="vcard-doclist__name">
                                                {label}{required && <span className="vcard-doclist__req">*</span>}
                                            </span>
                                            {!doc
                                                ? <span className="vcard-doclist__missing">Not uploaded</span>
                                                : <span className="vcard-doclist__status" style={{ color: sc.color }}>{doc.status}{doc.expiry_date && ` · exp ${doc.expiry_date}`}</span>
                                            }
                                        </div>
                                        {doc?.file && (
                                            <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                                                <DocPreviewRow doc={doc} />
                                            </div>
                                        )}
                                        {doc && (
                                            <div className="admin-doc-actions" style={{ flexShrink: 0 }}>
                                                <input
                                                    className="admin-doc-note-input"
                                                    placeholder="Note…"
                                                    value={docNotes[doc.id] || ""}
                                                    onChange={(e) => setDocNotes((p) => ({ ...p, [doc.id]: e.target.value }))}
                                                />
                                                {doc.status !== "approved" && (
                                                    <button className="admin-btn admin-btn--xs admin-btn--success" onClick={() => onDocReview(doc.id, "approve")}>✓</button>
                                                )}
                                                {doc.status !== "rejected" && (
                                                    <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => onDocReview(doc.id, "reject")}>✕</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Photo strip */}
                        <div className="vcard-photo-pill" style={{ borderColor: photoCount >= 10 ? "#6EE7B7" : "#FCD34D", color: photoCount >= 10 ? "#059669" : "#D97706", background: photoCount >= 10 ? "#D1FAE5" : "#FEF3C7" }}>
                            📷 {photoCount} photo{photoCount !== 1 ? "s" : ""} (min 10) {photoCount >= 10 ? "✓" : "⚠"}
                        </div>
                        {(v.photos || []).length > 0 && (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                                {v.photos.map((ph, i) => (
                                    <div key={ph.id} onClick={() => setVehiclePhotoLightbox({ photos: v.photos, index: i })} style={{ cursor: "pointer", borderRadius: 6, overflow: "hidden", border: `2px solid ${ph.is_cover ? "var(--teal-primary)" : "var(--vbdr)"}` }}>
                                        <img src={ph.image} alt={ph.angle} style={{ width: 56, height: 42, objectFit: "cover", display: "block" }} />
                                    </div>
                                ))}
                            </div>
                        )}
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

                        {/* Certification */}
                        {v.status === "ADMIN_APPROVED" && (
                            <div className="vcard-action-block vcard-action-block--cert">
                                <div className="vcard-action-block__hd">🔧 Mechanic Certification</div>
                                <div className="admin-form-field">
                                    <label>Certification Date</label>
                                    <input type="date" onChange={(e) => setCertifyForms((p) => ({ ...p, [v.id]: { ...(p[v.id] || {}), cert_date: e.target.value } }))} />
                                </div>
                                <div className="admin-form-field">
                                    <label>Odometer (km)</label>
                                    <input type="number" placeholder="e.g. 24500" onChange={(e) => setCertifyForms((p) => ({ ...p, [v.id]: { ...(p[v.id] || {}), odometer_at_cert: e.target.value } }))} />
                                </div>
                                <div className="admin-form-field">
                                    <label>Cert Report</label>
                                    <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setCertifyForms((p) => ({ ...p, [v.id]: { ...(p[v.id] || {}), file: e.target.files[0] } }))} />
                                </div>
                                <button className="admin-btn admin-btn--success" style={{ width: "100%", justifyContent: "center" }} onClick={() => onCertify(v.id)} disabled={!requiredOk}>
                                    ✓ Certify &amp; Set LIVE
                                </button>
                            </div>
                        )}

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