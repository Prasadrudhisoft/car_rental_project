/**
 * AdminDashboard.jsx — Complete, self-contained implementation
 *
 * Tabs: overview · vendors · vehicles · bookings · users · locations ·
 *       logistics · config · promos · agreements · reviews · assignments
 *
 * Scope system:
 *   superadmin     → full platform access
 *   assigned_admin → sees only assigned vendors + their customers/bookings
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    getAdminStats,
    getAdminAnalytics,
    getAdminVendors,
    adminVendorAction,
    getAdminVehicles,
    getAdminVehicleStats,
    reviewDoc,
    certifyVehicle,
    blacklistVehicle,
    vahanCheck,
    setVehicleStatus,
    getAdminBookings,
    getAdminUsers,
    getConfigSettings,
    updateConfigSetting,
    getSegmentConfigs,
    updateSegmentConfig,
    getLocations,
    createLocation,
    deleteLocation,
    getCities,
    createCity,
    deleteCity,
    getCityPairFees,
    createCityPairFee,
    deleteCityPairFee,
    getAdminPromos,
    createPromo,
    deletePromo,
    getReturnPoints,
    createReturnPoint,
    deleteReturnPoint,
    getAdminLogisticsOverview,
    getAdminLogisticsStats,
    getAdminNetworkList,
    getAdminAgreementVersions,
    createAgreementVersion,
    updateAgreementVersion,
    activateAgreementVersion,
    getAdminAcceptances,
    fetchVendorReviews,
    getMyAdminProfile,
    getAdminList,
    getAllAssignments,
    getAssignmentHistory,
    assignVendorToAdmin,
    unassignVendor,
    bulkAssignVendors,
} from "../services/api";
import { Sidebar } from "../components/common/Navbar";
import Navbar from "../components/common/Navbar";
import DataTable from "../components/common/DataTable";
import "./AdminDashboard.css";
import "../components/common/DataTable.css";

// ─────────────────────────────────────────────────────────────────────────────
// COLOUR MAPS
// ─────────────────────────────────────────────────────────────────────────────
const VENDOR_STATUS_CLR = {
    approved: { bg: "#D1FAE5", color: "#059669" },
    pending: { bg: "#FEF3C7", color: "#D97706" },
    suspended: { bg: "#FEE2E2", color: "#EF4444" },
    rejected: { bg: "#FEE2E2", color: "#B91C1C" },
    more_info: { bg: "#EDE9FE", color: "#7C3AED" },
};
const VEHICLE_STATUS_CLR = {
    LIVE: { bg: "#D1FAE5", color: "#059669" },
    PENDING_DOCS: { bg: "#FEF3C7", color: "#D97706" },
    DOCS_SUBMITTED: { bg: "#DBEAFE", color: "#1D4ED8" },
    ADMIN_APPROVED: { bg: "#EDE9FE", color: "#7C3AED" },
    CERTIFIED: { bg: "#D1FAE5", color: "#059669" },
    INACTIVE: { bg: "#FEE2E2", color: "#EF4444" },
};
const BOOKING_STATUS_CLR = {
    PENDING: { bg: "#FEF3C7", color: "#D97706" },
    CONFIRMED: { bg: "#DBEAFE", color: "#1D4ED8" },
    ACTIVE: { bg: "#D1FAE5", color: "#059669" },
    COMPLETED: { bg: "#F3F4F6", color: "#6B7280" },
    CANCELLED: { bg: "#FEE2E2", color: "#EF4444" },
};
const HANDOVER_STATUS_CLR = {
    EXPECTED: { bg: "#FEF3C7", color: "#D97706" },
    RECEIVED: { bg: "#DBEAFE", color: "#1D4ED8" },
    INSPECTED: { bg: "#EDE9FE", color: "#7C3AED" },
    HELD: { bg: "#F3F4F6", color: "#6B7280" },
    SUBLISTED: { bg: "#D1FAE5", color: "#059669" },
    RETRIEVED: { bg: "#F3F4F6", color: "#9CA3AF" },
};
const KYC_STATUS_CLR = {
    pending: { bg: "#FEF3C7", color: "#D97706" },
    verified: { bg: "#D1FAE5", color: "#059669" },
    rejected: { bg: "#FEE2E2", color: "#EF4444" },
};

// ─────────────────────────────────────────────────────────────────────────────
// TINY UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};
const fmtDatetime = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

function getKYCStatus(vendor) {
    const checks = {
        bank: !!vendor.bank_account_no,
        city: !!vendor.city_id,
        location: !!(vendor.latitude && vendor.longitude),
        document: !!vendor.kyc_document,
        identity: !!(vendor.aadhaar_number || vendor.pan_number),
    };
    const done = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { checks, done, total, complete: done === total };
}

function getVendorPK(v) {
    if (v == null) return null;

    // Try user_id first (from VendorProfileFullSerializer)
    if (v.user_id !== undefined && v.user_id !== null) {
        const pk = Number(v.user_id);
        if (!isNaN(pk) && pk > 0) return pk;
    }

    // Try id field (might be User PK or VendorProfile PK)
    if (v.id !== undefined && v.id !== null) {
        const pk = Number(v.id);
        if (!isNaN(pk) && pk > 0) return pk;
    }

    // Fallback: nested user object
    if (v.user !== undefined && v.user !== null) {
        if (typeof v.user === "object" && v.user.id !== undefined) {
            const pk = Number(v.user.id);
            if (!isNaN(pk) && pk > 0) return pk;
        }
        if (typeof v.user !== "object") {
            const pk = Number(v.user);
            if (!isNaN(pk) && pk > 0) return pk;
        }
    }

    // Debug logging
    console.warn("[AssignmentsTab] Cannot extract vendor PK from:", v);
    return null;
}

function getAdminPK(a) {
    if (a == null) return null;
    if (a.user_id != null) return Number(a.user_id);
    if (a.id != null) return Number(a.id);
    return null;
}

function getAssignmentVendorPK(a) {
    return Number(a.vendor) || null;
}

function getAssignmentAdminPK(a) {
    return Number(a.admin) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status, colorMap, size = "md" }) {
    const s = colorMap?.[status] || { bg: "#F3F4F6", color: "#6B7280" };
    return (
        <span
            className={`admin-status-badge admin-status-badge--${size}`}
            style={{
                color: s.color,
                background: s.bg,
                border: `1px solid ${s.color}30`,
            }}
        >
            {status?.replace(/_/g, " ")}
        </span>
    );
}

function SectionCard({ title, subtitle, children, action }) {
    return (
        <div className="admin-section-card">
            <div className="admin-section-card__header">
                <div>
                    <h3>{title}</h3>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

function InlineForm({ fields, onSubmit, submitLabel = "+ Add", loading }) {
    const [vals, setVals] = useState(() =>
        Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""])),
    );
    const reset = () =>
        setVals(Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""])));
    return (
        <form
            className="admin-inline-form"
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit(vals);
                reset();
            }}
        >
            {fields.map((f) => (
                <div key={f.key} className="admin-form-field">
                    <label>{f.label}</label>
                    {f.type === "select" ? (
                        <select
                            value={vals[f.key]}
                            required={f.required}
                            onChange={(e) =>
                                setVals((p) => ({ ...p, [f.key]: e.target.value }))
                            }
                        >
                            <option value="">Select {f.label}</option>
                            {f.options?.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={f.type || "text"}
                            value={vals[f.key]}
                            step={f.step}
                            placeholder={f.placeholder}
                            required={f.required}
                            onChange={(e) =>
                                setVals((p) => ({ ...p, [f.key]: e.target.value }))
                            }
                        />
                    )}
                </div>
            ))}
            <button type="submit" className="admin-form-submit" disabled={loading}>
                {loading ? "…" : submitLabel}
            </button>
        </form>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO LIGHTBOX
// ─────────────────────────────────────────────────────────────────────────────
function PhotoLightbox({ photos, initialIndex = 0, onClose }) {
    const [idx, setIdx] = useState(initialIndex);
    useEffect(() => {
        const h = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight")
                setIdx((i) => Math.min(i + 1, photos.length - 1));
            if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [photos.length, onClose]);

    const src = photos[idx]?.image || photos[idx]?.url || photos[idx];
    const label = photos[idx]?.angle || photos[idx]?.label || "";
    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0,0,0,.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 16,
            }}
        >
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: 20,
                    right: 24,
                    background: "rgba(255,255,255,.12)",
                    border: "1px solid rgba(255,255,255,.2)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "6px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                ✕ Close
            </button>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", alignItems: "center", gap: 16 }}
            >
                <button
                    onClick={() => setIdx((i) => Math.max(i - 1, 0))}
                    disabled={idx === 0}
                    style={{
                        background: "rgba(255,255,255,.12)",
                        border: "1px solid rgba(255,255,255,.2)",
                        color: "#fff",
                        borderRadius: 8,
                        padding: "10px 18px",
                        fontSize: 20,
                        cursor: idx === 0 ? "not-allowed" : "pointer",
                        opacity: idx === 0 ? 0.3 : 1,
                    }}
                >
                    ‹
                </button>
                <div style={{ textAlign: "center" }}>
                    <img
                        src={src}
                        alt={label}
                        style={{
                            maxWidth: "min(80vw,960px)",
                            maxHeight: "72vh",
                            objectFit: "contain",
                            borderRadius: 12,
                        }}
                    />
                    {label && (
                        <div
                            style={{
                                marginTop: 10,
                                fontSize: 12,
                                color: "rgba(255,255,255,.6)",
                                textTransform: "capitalize",
                            }}
                        >
                            {label} · {idx + 1}/{photos.length}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setIdx((i) => Math.min(i + 1, photos.length - 1))}
                    disabled={idx === photos.length - 1}
                    style={{
                        background: "rgba(255,255,255,.12)",
                        border: "1px solid rgba(255,255,255,.2)",
                        color: "#fff",
                        borderRadius: 8,
                        padding: "10px 18px",
                        fontSize: 20,
                        cursor: idx === photos.length - 1 ? "not-allowed" : "pointer",
                        opacity: idx === photos.length - 1 ? 0.3 : 1,
                    }}
                >
                    ›
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC DOC CELL
// ─────────────────────────────────────────────────────────────────────────────
function KYCDocumentCell({ url }) {
    const [open, setOpen] = useState(false);
    if (!url)
        return (
            <span style={{ color: "#EF4444", fontSize: 11, fontWeight: 600 }}>
                Not uploaded
            </span>
        );
    const isImg = /\.(jpg|jpeg|png|webp)$/i.test(url);
    const isPDF = url.toLowerCase().includes(".pdf");
    return (
        <>
            {isImg ? (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        alignItems: "flex-start",
                    }}
                >
                    <div
                        onClick={() => setOpen(true)}
                        style={{
                            cursor: "pointer",
                            borderRadius: 6,
                            overflow: "hidden",
                            border: "1px solid var(--vbdr)",
                            display: "inline-block",
                        }}
                    >
                        <img
                            src={url}
                            alt="KYC"
                            style={{
                                width: 72,
                                height: 52,
                                objectFit: "cover",
                                display: "block",
                            }}
                        />
                    </div>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            fontSize: 10,
                            color: "var(--teal-primary)",
                            textDecoration: "underline",
                        }}
                    >
                        Open ↗
                    </a>
                </div>
            ) : isPDF ? (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-doc-link"
                >
                    <span>📄</span>
                    <span>PDF</span>
                </a>
            ) : (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-doc-link"
                >
                    <span>📎</span>
                    <span>File</span>
                </a>
            )}
            {open && (
                <PhotoLightbox
                    photos={[{ image: url, label: "KYC Document" }]}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOC PREVIEW ROW
// ─────────────────────────────────────────────────────────────────────────────
function DocPreviewRow({ doc }) {
    const [open, setOpen] = useState(false);
    if (!doc?.file) return null;
    const isImg = /\.(jpg|jpeg|png|webp)$/i.test(doc.file);
    const isPDF = doc.file.toLowerCase().includes(".pdf");
    const dc =
        doc.status === "approved"
            ? { bg: "#D1FAE5", color: "#059669" }
            : doc.status === "rejected"
                ? { bg: "#FEE2E2", color: "#EF4444" }
                : { bg: "#FEF3C7", color: "#D97706" };
    return (
        <>
            {open && isImg && (
                <PhotoLightbox
                    photos={[{ image: doc.file, label: doc.doc_type }]}
                    onClose={() => setOpen(false)}
                />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {isImg ? (
                    <div
                        onClick={() => setOpen(true)}
                        style={{
                            cursor: "pointer",
                            borderRadius: 5,
                            overflow: "hidden",
                            border: "1px solid var(--vbdr)",
                            flexShrink: 0,
                        }}
                    >
                        <img
                            src={doc.file}
                            alt={doc.doc_type}
                            style={{
                                width: 48,
                                height: 36,
                                objectFit: "cover",
                                display: "block",
                            }}
                        />
                    </div>
                ) : isPDF ? (
                    <a
                        href={doc.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            fontSize: 10,
                            color: "var(--teal-primary)",
                            background: "#E6F7F5",
                            padding: "2px 7px",
                            borderRadius: 4,
                            fontWeight: 600,
                            textDecoration: "none",
                        }}
                    >
                        📄 PDF
                    </a>
                ) : (
                    <a
                        href={doc.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 10, color: "var(--teal-primary)" }}
                    >
                        View
                    </a>
                )}
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: dc.bg,
                        color: dc.color,
                    }}
                >
                    {doc.status}
                </span>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE INDICATOR  (hero banner badge)
// ─────────────────────────────────────────────────────────────────────────────
function ScopeIndicator({ profile }) {
    if (!profile) return null;
    const isSuper = profile.scope === "superadmin";
    return (
        <div className="admin-scope-indicator">
            {isSuper ? (
                <span className="admin-scope-indicator--super">
                    👑 Super Admin — Full Platform Access
                </span>
            ) : (
                <span className="admin-scope-indicator--assigned">
                    🎯 Assigned Admin
                    {profile.assigned_vendor_count != null && (
                        <>
                            {" "}
                            · {profile.assigned_vendor_count} vendor
                            {profile.assigned_vendor_count !== 1 ? "s" : ""}
                        </>
                    )}
                    {profile.display_name ? ` · ${profile.display_name}` : ""}
                </span>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function VendorDetailModal({ vendor: v, onClose, onAction }) {
    const [note, setNote] = useState(v.admin_note || "");
    const [busy, setBusy] = useState(false);
    const kycStatus = getKYCStatus(v);
    const handleAction = async (action) => {
        setBusy(true);
        await onAction(v.id, action, note);
        setBusy(false);
    };
    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                <div className="admin-modal__head">
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                            className="admin-vendor-card__avatar"
                            style={{ width: 48, height: 48, fontSize: 18 }}
                        >
                            {v.business_name?.[0]?.toUpperCase() || "V"}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                                {v.business_name}
                            </h2>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 4,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                }}
                            >
                                <StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} />
                                <span style={{ fontSize: 12, color: "var(--vm)" }}>
                                    {v.email}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "1px solid var(--vbdr)",
                            borderRadius: 8,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--vm)",
                            fontFamily: "Inter,sans-serif",
                        }}
                    >
                        ✕ Close
                    </button>
                </div>

                {/* KYC banner */}
                <div
                    className={`admin-kyc-banner ${kycStatus.complete ? "admin-kyc-banner--ok" : "admin-kyc-banner--warn"}`}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>
                            {kycStatus.complete ? "✅" : "⚠️"}
                        </span>
                        <div>
                            <strong style={{ fontSize: 13 }}>
                                KYC: {kycStatus.done}/{kycStatus.total} complete
                                {kycStatus.complete ? " — Ready for Approval" : ""}
                            </strong>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 5,
                                    flexWrap: "wrap",
                                }}
                            >
                                {[
                                    [kycStatus.checks.identity, "Identity"],
                                    [kycStatus.checks.bank, "Bank"],
                                    [kycStatus.checks.city, "City"],
                                    [kycStatus.checks.location, "Map Pin"],
                                    [kycStatus.checks.document, "KYC Doc"],
                                ].map(([done, label]) => (
                                    <span
                                        key={label}
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: "2px 8px",
                                            borderRadius: 5,
                                            background: done ? "#D1FAE5" : "#FEE2E2",
                                            color: done ? "#059669" : "#EF4444",
                                        }}
                                    >
                                        {done ? "✓" : "✗"} {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="admin-modal__body">
                    {/* Left col */}
                    <div className="admin-modal__col">
                        <div className="admin-modal__section-label">Business Info</div>
                        {[
                            ["Business Name", v.business_name],
                            ["GSTIN", v.gstin || "—"],
                            [
                                "Rating",
                                v.rating > 0
                                    ? `⭐ ${v.rating} (${v.total_reviews})`
                                    : "No reviews",
                            ],
                            ["Member Since", fmtDate(v.created_at)],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span>
                                <strong>{val}</strong>
                            </div>
                        ))}
                        <div
                            className="admin-modal__section-label"
                            style={{ marginTop: 14 }}
                        >
                            Contact & Address
                        </div>
                        {[
                            ["Email", v.email],
                            ["Phone", v.phone],
                            ["City", v.city_name || "—"],
                            ["State", v.state || "—"],
                            ["PIN", v.pincode || "—"],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span>
                                <strong>{val}</strong>
                            </div>
                        ))}
                        {v.latitude && v.longitude && (
                            <div className="admin-modal__row">
                                <span>Map Pin</span>
                                <a
                                    href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontSize: 12,
                                        color: "var(--teal-primary)",
                                        fontWeight: 600,
                                    }}
                                >
                                    📍 View ↗
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Right col */}
                    <div className="admin-modal__col">
                        <div className="admin-modal__section-label">Identity & KYC</div>
                        {[
                            [
                                "Aadhaar",
                                v.aadhaar_number ? `••••••${v.aadhaar_number.slice(-4)}` : "—",
                            ],
                            ["PAN", v.pan_number || "—"],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span>
                                <strong>{val}</strong>
                            </div>
                        ))}
                        <div
                            className="admin-modal__row"
                            style={{ alignItems: "flex-start" }}
                        >
                            <span>KYC Document</span>
                            <KYCDocumentCell url={v.kyc_document} />
                        </div>

                        <div
                            className="admin-modal__section-label"
                            style={{ marginTop: 14 }}
                        >
                            Bank Details
                        </div>
                        {[
                            ["Account Name", v.bank_account_name || "—"],
                            [
                                "Account No.",
                                v.bank_account_no ? `••••${v.bank_account_no.slice(-4)}` : "—",
                            ],
                            ["IFSC", v.bank_ifsc || "—"],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row">
                                <span>{l}</span>
                                <strong>{val}</strong>
                            </div>
                        ))}

                        <div
                            className="admin-modal__section-label"
                            style={{ marginTop: 14 }}
                        >
                            Admin Action
                        </div>
                        <textarea
                            className="admin-modal__note"
                            placeholder="Add an admin note…"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                        />
                        <div className="admin-modal__actions">
                            {v.status === "pending" && (
                                <>
                                    <button
                                        className={`admin-btn admin-btn--success${!kycStatus.complete ? " admin-btn--dim" : ""}`}
                                        onClick={() => handleAction("approve")}
                                        disabled={busy}
                                    >
                                        {busy ? "…" : "✓ Approve"}
                                    </button>
                                    <button
                                        className="admin-btn admin-btn--warning"
                                        onClick={() => handleAction("more_info")}
                                        disabled={busy}
                                    >
                                        📋 Request Info
                                    </button>
                                    <button
                                        className="admin-btn admin-btn--danger"
                                        onClick={() => handleAction("reject")}
                                        disabled={busy}
                                    >
                                        {busy ? "…" : "✕ Reject"}
                                    </button>
                                </>
                            )}
                            {v.status === "more_info" && (
                                <>
                                    <button
                                        className="admin-btn admin-btn--success"
                                        onClick={() => handleAction("approve")}
                                        disabled={busy}
                                    >
                                        {busy ? "…" : "✓ Approve"}
                                    </button>
                                    <button
                                        className="admin-btn admin-btn--danger"
                                        onClick={() => handleAction("reject")}
                                        disabled={busy}
                                    >
                                        {busy ? "…" : "✕ Reject"}
                                    </button>
                                </>
                            )}
                            {v.status === "approved" && (
                                <button
                                    className="admin-btn admin-btn--warning"
                                    onClick={() => handleAction("suspend")}
                                    disabled={busy}
                                >
                                    {busy ? "…" : "⚠ Suspend"}
                                </button>
                            )}
                            {(v.status === "suspended" || v.status === "rejected") && (
                                <button
                                    className="admin-btn admin-btn--success"
                                    onClick={() => handleAction("reinstate")}
                                    disabled={busy}
                                >
                                    {busy ? "…" : "↩ Reinstate"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_DOCS = [
    { key: "rc", label: "RC Book", required: true },
    { key: "insurance", label: "Insurance", required: true },
    { key: "puc", label: "PUC Certificate", required: true },
    { key: "fitness", label: "Fitness Cert", required: false },
];
const PIPELINE_STEPS = [
    { status: "PENDING_DOCS", label: "Pending Docs", step: 1 },
    { status: "DOCS_SUBMITTED", label: "Docs Submitted", step: 2 },
    { status: "ADMIN_APPROVED", label: "Admin Approved", step: 3 },
    { status: "LIVE", label: "Live", step: 4 },
];

function VehicleDetailModal({
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
    setVehiclePhotoLightbox,
}) {
    const docMap = Object.fromEntries(
        (v.documents || []).map((d) => [d.doc_type, d]),
    );
    const requiredOk = ["rc", "insurance", "puc"].every(
        (k) => docMap[k]?.status === "approved",
    );
    const photoCount = (v.photos || []).length;
    const currentStep =
        PIPELINE_STEPS.find((p) => p.status === v.status)?.step ?? 0;

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div
                className="admin-modal"
                style={{ maxWidth: 1000 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Head */}
                <div className="admin-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                            {v.year} {v.make} {v.model}
                        </h2>
                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 6,
                                flexWrap: "wrap",
                                alignItems: "center",
                            }}
                        >
                            <span className="vcard-v2__plate">{v.plate_number}</span>
                            <StatusBadge status={v.status} colorMap={VEHICLE_STATUS_CLR} />
                            {v.is_blacklisted && (
                                <span className="admin-blacklisted-badge">🚫 Blacklisted</span>
                            )}
                            {v.is_certified && (
                                <span className="admin-certified-badge">✅ Certified</span>
                            )}
                            <span style={{ fontSize: 11, color: "var(--vm)" }}>
                                {v.vendor?.vendor_profile?.business_name || v.vendor?.email} ·{" "}
                                {v.city?.name}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "1px solid var(--vbdr)",
                            borderRadius: 8,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--vm)",
                            fontFamily: "Inter,sans-serif",
                            flexShrink: 0,
                        }}
                    >
                        ✕ Close
                    </button>
                </div>

                {/* Pipeline */}
                {v.status !== "INACTIVE" && (
                    <div
                        className="vcard-pipeline"
                        style={{
                            padding: "10px 20px",
                            borderBottom: "1px solid var(--vbdr)",
                        }}
                    >
                        {PIPELINE_STEPS.map((step, idx) => {
                            const done = step.step < currentStep;
                            const active = step.step === currentStep;
                            return (
                                <React.Fragment key={step.status}>
                                    <div
                                        className={`vcard-pipeline__step ${done ? "done" : active ? "active" : "future"}`}
                                    >
                                        <div className="vcard-pipeline__dot">
                                            {done ? "✓" : step.step}
                                        </div>
                                        <span>{step.label}</span>
                                    </div>
                                    {idx < PIPELINE_STEPS.length - 1 && (
                                        <div
                                            className={`vcard-pipeline__line ${done ? "done" : ""}`}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                <div
                    className="vcard-v2__body"
                    style={{ maxHeight: "65vh", overflowY: "auto" }}
                >
                    {/* Docs col */}
                    <div className="vcard-v2__docs-col">
                        <div className="vcard-v2__col-hd">
                            <span>📄 Documents</span>
                            <span className="vcard-v2__col-sub">
                                {
                                    (v.documents || []).filter((d) => d.status === "approved")
                                        .length
                                }
                                /{(v.documents || []).length} approved
                            </span>
                        </div>
                        <div className="vcard-doclist">
                            {REQUIRED_DOCS.map(({ key, label, required }) => {
                                const doc = docMap[key];
                                const sc = doc
                                    ? doc.status === "approved"
                                        ? { bg: "#D1FAE5", color: "#059669" }
                                        : doc.status === "rejected"
                                            ? { bg: "#FEE2E2", color: "#EF4444" }
                                            : { bg: "#FEF3C7", color: "#D97706" }
                                    : { bg: "#F3F4F6", color: "#9CA3AF" };
                                return (
                                    <div key={key} className="vcard-doclist__row">
                                        <div
                                            className="vcard-doclist__indicator"
                                            style={{ background: sc.bg, color: sc.color }}
                                        >
                                            {!doc
                                                ? "—"
                                                : doc.status === "approved"
                                                    ? "✓"
                                                    : doc.status === "rejected"
                                                        ? "✕"
                                                        : "⏳"}
                                        </div>
                                        <div className="vcard-doclist__info">
                                            <span className="vcard-doclist__name">
                                                {label}
                                                {required && (
                                                    <span className="vcard-doclist__req">*</span>
                                                )}
                                            </span>
                                            {!doc ? (
                                                <span className="vcard-doclist__missing">
                                                    Not uploaded
                                                </span>
                                            ) : (
                                                <span
                                                    className="vcard-doclist__status"
                                                    style={{ color: sc.color }}
                                                >
                                                    {doc.status}
                                                    {doc.expiry_date && ` · exp ${doc.expiry_date}`}
                                                </span>
                                            )}
                                        </div>
                                        {doc?.file && (
                                            <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                                                <DocPreviewRow doc={doc} />
                                            </div>
                                        )}
                                        {doc && (
                                            <div
                                                className="admin-doc-actions"
                                                style={{ flexShrink: 0 }}
                                            >
                                                <input
                                                    className="admin-doc-note-input"
                                                    placeholder="Note…"
                                                    value={docNotes[doc.id] || ""}
                                                    onChange={(e) =>
                                                        setDocNotes((p) => ({
                                                            ...p,
                                                            [doc.id]: e.target.value,
                                                        }))
                                                    }
                                                />
                                                {doc.status !== "approved" && (
                                                    <button
                                                        className="admin-btn admin-btn--xs admin-btn--success"
                                                        onClick={() => onDocReview(doc.id, "approve")}
                                                    >
                                                        ✓
                                                    </button>
                                                )}
                                                {doc.status !== "rejected" && (
                                                    <button
                                                        className="admin-btn admin-btn--xs admin-btn--danger"
                                                        onClick={() => onDocReview(doc.id, "reject")}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Photo strip */}
                        <div
                            className="vcard-photo-pill"
                            style={{
                                borderColor: photoCount >= 10 ? "#6EE7B7" : "#FCD34D",
                                color: photoCount >= 10 ? "#059669" : "#D97706",
                                background: photoCount >= 10 ? "#D1FAE5" : "#FEF3C7",
                            }}
                        >
                            📷 {photoCount} photo{photoCount !== 1 ? "s" : ""} (min 10){" "}
                            {photoCount >= 10 ? "✓" : "⚠"}
                        </div>
                        {(v.photos || []).length > 0 && (
                            <div
                                style={{
                                    display: "flex",
                                    gap: 5,
                                    flexWrap: "wrap",
                                    marginTop: 4,
                                }}
                            >
                                {v.photos.map((ph, i) => (
                                    <div
                                        key={ph.id}
                                        onClick={() =>
                                            setVehiclePhotoLightbox({ photos: v.photos, index: i })
                                        }
                                        style={{
                                            cursor: "pointer",
                                            borderRadius: 6,
                                            overflow: "hidden",
                                            border: `2px solid ${ph.is_cover ? "var(--teal-primary)" : "var(--vbdr)"}`,
                                        }}
                                    >
                                        <img
                                            src={ph.image}
                                            alt={ph.angle}
                                            style={{
                                                width: 56,
                                                height: 42,
                                                objectFit: "cover",
                                                display: "block",
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions col */}
                    <div className="vcard-v2__actions-col">
                        {/* Status change */}
                        <div className="vcard-action-block">
                            <div className="vcard-action-block__hd">🔄 Change Status</div>
                            <select
                                className="vcard-status-select"
                                value={v.status}
                                style={{
                                    borderColor:
                                        (VEHICLE_STATUS_CLR[v.status]?.color || "#9CA3AF") + "80",
                                    color: VEHICLE_STATUS_CLR[v.status]?.color || "var(--vt)",
                                    background: VEHICLE_STATUS_CLR[v.status]?.bg || "var(--vs2)",
                                }}
                                onChange={(e) => {
                                    const ns = e.target.value;
                                    if (ns === v.status) return;
                                    const note =
                                        window.prompt(`Note for ${v.status} → ${ns}:`, "") ?? "";
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
                                <div className="vcard-action-block__hd">
                                    🔧 Mechanic Certification
                                </div>
                                <div className="admin-form-field">
                                    <label>Certification Date</label>
                                    <input
                                        type="date"
                                        onChange={(e) =>
                                            setCertifyForms((p) => ({
                                                ...p,
                                                [v.id]: {
                                                    ...(p[v.id] || {}),
                                                    cert_date: e.target.value,
                                                },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="admin-form-field">
                                    <label>Odometer (km)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 24500"
                                        onChange={(e) =>
                                            setCertifyForms((p) => ({
                                                ...p,
                                                [v.id]: {
                                                    ...(p[v.id] || {}),
                                                    odometer_at_cert: e.target.value,
                                                },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="admin-form-field">
                                    <label>Cert Report</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.png"
                                        onChange={(e) =>
                                            setCertifyForms((p) => ({
                                                ...p,
                                                [v.id]: { ...(p[v.id] || {}), file: e.target.files[0] },
                                            }))
                                        }
                                    />
                                </div>
                                <button
                                    className="admin-btn admin-btn--success"
                                    style={{ width: "100%", justifyContent: "center" }}
                                    onClick={() => onCertify(v.id)}
                                    disabled={!requiredOk}
                                >
                                    ✓ Certify &amp; Set LIVE
                                </button>
                            </div>
                        )}

                        {/* VAHAN */}
                        <div className="vcard-action-block">
                            <div className="vcard-action-block__hd">
                                🔍 VAHAN Verification
                            </div>
                            <button
                                className="admin-btn admin-btn--ghost"
                                style={{ width: "100%", justifyContent: "center" }}
                                onClick={() => onVahanCheck(v.id)}
                            >
                                Run VAHAN Check
                            </button>
                        </div>

                        {/* Blacklist */}
                        {!v.is_blacklisted ? (
                            <div className="vcard-action-block vcard-action-block--danger">
                                <div className="vcard-action-block__hd">
                                    🚫 Blacklist Vehicle
                                </div>
                                <input
                                    className="admin-note-input"
                                    placeholder="Reason…"
                                    style={{ width: "100%", boxSizing: "border-box" }}
                                    value={blacklistReasons[v.id] || ""}
                                    onChange={(e) =>
                                        setBlacklistReasons((p) => ({
                                            ...p,
                                            [v.id]: e.target.value,
                                        }))
                                    }
                                />
                                <button
                                    className="admin-btn admin-btn--danger"
                                    style={{
                                        width: "100%",
                                        justifyContent: "center",
                                        marginTop: 6,
                                    }}
                                    onClick={() => onBlacklist(v.id)}
                                >
                                    Blacklist &amp; Deactivate
                                </button>
                            </div>
                        ) : (
                            <div
                                className="vcard-action-block"
                                style={{ background: "#FEE2E2", borderColor: "#FCA5A5" }}
                            >
                                <div
                                    style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C" }}
                                >
                                    🚫 Blacklisted
                                </div>
                                <div style={{ fontSize: 11, color: "#7F1D1D" }}>
                                    {v.blacklist_reason || "No reason recorded."}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
const ADDON_LABELS = {
    insurance_basic: "Basic Insurance",
    insurance_comprehensive: "Comprehensive Insurance",
    personal_accident: "Personal Accident",
    child_seat: "Child Seat",
    gps: "GPS Device",
    additional_driver: "Additional Driver",
};

function BookingDetailModal({ booking: b, onClose }) {
    const ps = b.pricing_snapshot || {};
    const pymtSt = !b.payment_captured
        ? { label: "Unpaid", color: "#EF4444", bg: "#FEE2E2" }
        : ps.full_payment_paid
            ? { label: "Fully Paid", color: "#059669", bg: "#D1FAE5" }
            : ps.advance_paid
                ? { label: "Advance Paid", color: "#D97706", bg: "#FEF3C7" }
                : { label: "Paid", color: "#059669", bg: "#D1FAE5" };
    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div
                className="admin-modal bk-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="admin-modal__head bk-modal__head">
                    <div className="bk-modal__ref-block">
                        <span className="bk-modal__ref">{b.booking_ref}</span>
                        <StatusBadge status={b.status} colorMap={BOOKING_STATUS_CLR} />
                        <span
                            className="bk-modal__pay-badge"
                            style={{ color: pymtSt.color, background: pymtSt.bg }}
                        >
                            {pymtSt.label}
                        </span>
                        {b.is_one_way && (
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    background: "#EDE9FE",
                                    color: "#7C3AED",
                                }}
                            >
                                ONE-WAY
                            </span>
                        )}
                        {b.agreement_signed && (
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    background: "#D1FAE5",
                                    color: "#059669",
                                }}
                            >
                                ✍ Signed
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "1px solid var(--vbdr)",
                            borderRadius: 8,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--vm)",
                            fontFamily: "Inter,sans-serif",
                            flexShrink: 0,
                        }}
                    >
                        ✕ Close
                    </button>
                </div>
                <div className="bk-modal__body">
                    {/* Left col */}
                    <div className="bk-modal__col">
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">👤 Customer</div>
                            <div className="bk-modal__rows">
                                {[
                                    ["Name", b.customer_name || "—"],
                                    ["Email", b.customer_email || "—"],
                                    ["Phone", b.customer_phone || "—"],
                                ].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row">
                                        <span>{l}</span>
                                        <strong>{val}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🚗 Vehicle</div>
                            <div className="bk-modal__rows">
                                {[
                                    ["Vehicle", b.vehicle_display || "—"],
                                    ["Vendor", b.vendor_name || "—"],
                                    ["Segment", b.vehicle?.segment || "—"],
                                    ["Plate", b.vehicle?.plate_number || "—"],
                                ].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row">
                                        <span>{l}</span>
                                        <strong style={{ textTransform: "capitalize" }}>
                                            {val}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">📍 Trip Details</div>
                            <div className="bk-modal__rows">
                                {[
                                    [
                                        "Pickup",
                                        `${b.pickup_date}${b.pickup_time ? ` at ${b.pickup_time}` : ""}`,
                                    ],
                                    [
                                        "Return",
                                        `${b.return_date}${b.return_time ? ` at ${b.return_time}` : ""}`,
                                    ],
                                    [
                                        "Duration",
                                        `${b.rental_days} day${b.rental_days !== 1 ? "s" : ""}`,
                                    ],
                                    ["Location", b.pickup_location_detail?.name || "—"],
                                ].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row">
                                        <span>{l}</span>
                                        <strong>{val}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {b.status === "CANCELLED" && b.cancellation_reason && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">❌ Cancellation</div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#7F1D1D",
                                        background: "#FEE2E2",
                                        borderRadius: 8,
                                        padding: "8px 12px",
                                    }}
                                >
                                    {b.cancellation_reason}
                                </div>
                            </div>
                        )}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🕐 Timeline</div>
                            <div className="bk-modal__rows">
                                {[
                                    ["Created", fmtDatetime(b.created_at)],
                                    ["Updated", fmtDatetime(b.updated_at)],
                                ].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row">
                                        <span>{l}</span>
                                        <strong>{val}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right col */}
                    <div className="bk-modal__col">
                        <div className="bk-modal__section bk-modal__section--pricing">
                            <div className="bk-modal__section-hd">💰 Pricing Breakdown</div>
                            <div className="bk-price-table">
                                {ps.daily_rate && (
                                    <div className="bk-price-row">
                                        <span>Daily Rate</span>
                                        <span>
                                            ₹{parseFloat(ps.daily_rate).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                )}
                                {ps.base_amount && (
                                    <div className="bk-price-row">
                                        <span>Base Amount</span>
                                        <span>
                                            ₹{parseFloat(ps.base_amount).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                )}
                                {parseFloat(ps.addon_total || 0) > 0 && (
                                    <div className="bk-price-row">
                                        <span>Add-ons</span>
                                        <span>
                                            ₹{parseFloat(ps.addon_total).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                )}
                                {ps.cgst_amount && (
                                    <div className="bk-price-row bk-price-row--tax">
                                        <span>CGST</span>
                                        <span>
                                            ₹{parseFloat(ps.cgst_amount).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                )}
                                {ps.sgst_amount && (
                                    <div className="bk-price-row bk-price-row--tax">
                                        <span>SGST</span>
                                        <span>
                                            ₹{parseFloat(ps.sgst_amount).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                )}
                                <div className="bk-price-row bk-price-row--total">
                                    <span>Grand Total</span>
                                    <span>
                                        ₹{parseFloat(b.total_amount || 0).toLocaleString("en-IN")}
                                    </span>
                                </div>
                                <div className="bk-price-row">
                                    <span>Security Deposit</span>
                                    <span>
                                        ₹
                                        {parseFloat(
                                            b.deposit_amount || ps.security_deposit || 0,
                                        ).toLocaleString("en-IN")}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🏦 Deposit & Payment</div>
                            <div className="bk-modal__rows">
                                {[
                                    [
                                        "Payment Captured",
                                        b.payment_captured ? "✓ Yes" : "✕ No",
                                        b.payment_captured ? "#059669" : "#EF4444",
                                    ],
                                    [
                                        "Deposit Held",
                                        b.deposit_held ? "🔒 Held" : "—",
                                        b.deposit_held ? "#D97706" : "#9CA3AF",
                                    ],
                                    [
                                        "Deposit Released",
                                        b.deposit_released ? "✓ Released" : "—",
                                        b.deposit_released ? "#059669" : "#9CA3AF",
                                    ],
                                    [
                                        "Agreement Signed",
                                        b.agreement_signed ? "✓ Signed" : "—",
                                        b.agreement_signed ? "#059669" : "#9CA3AF",
                                    ],
                                ].map(([l, val, color]) => (
                                    <div key={l} className="bk-modal__row">
                                        <span>{l}</span>
                                        <strong style={{ color }}>{val}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {(b.addons || []).length > 0 && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">➕ Add-ons</div>
                                <div className="bk-addons">
                                    {b.addons.map((a, i) => (
                                        <div key={i} className="bk-addon-row">
                                            <span>{ADDON_LABELS[a.addon_type] || a.addon_type}</span>
                                            <span>
                                                ₹{parseFloat(a.price).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function UserDetailModal({ user: u, onClose }) {
    const kyc = KYC_STATUS_CLR[u.kyc_status] || KYC_STATUS_CLR.pending;
    const hasProf = u.driving_licence !== undefined;
    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div
                className="admin-modal user-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="admin-modal__head">
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="user-modal__avatar">
                            {u.full_name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                                {u.full_name || "—"}
                            </h2>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 5,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                }}
                            >
                                <span style={{ fontSize: 12, color: "var(--vm)" }}>
                                    {u.email}
                                </span>
                                {u.phone && (
                                    <span style={{ fontSize: 12, color: "var(--vm)" }}>
                                        · {u.phone}
                                    </span>
                                )}
                                {u.kyc_status && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: "2px 8px",
                                            borderRadius: 999,
                                            background: kyc.bg,
                                            color: kyc.color,
                                        }}
                                    >
                                        KYC {u.kyc_status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "1px solid var(--vbdr)",
                            borderRadius: 8,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--vm)",
                            fontFamily: "Inter,sans-serif",
                            flexShrink: 0,
                        }}
                    >
                        ✕ Close
                    </button>
                </div>
                <div className="user-modal__body">
                    <div className="user-modal__col">
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">👤 Account Details</div>
                            <div className="bk-modal__rows">
                                {[
                                    ["Full Name", u.full_name || "—"],
                                    ["Email", u.email],
                                    ["Phone", u.phone || "—"],
                                    ["Member Since", fmtDate(u.date_joined)],
                                ].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row">
                                        <span>{l}</span>
                                        <strong>{val}</strong>
                                    </div>
                                ))}
                                <div className="bk-modal__row">
                                    <span>Email</span>
                                    <strong
                                        style={{
                                            color: u.is_email_verified ? "#059669" : "#EF4444",
                                        }}
                                    >
                                        {u.is_email_verified ? "✓ Verified" : "✕ Not verified"}
                                    </strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Phone</span>
                                    <strong
                                        style={{
                                            color: u.is_phone_verified ? "#059669" : "#EF4444",
                                        }}
                                    >
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
                                        [
                                            "Aadhaar",
                                            u.aadhaar_number
                                                ? `••••••••${u.aadhaar_number.slice(-4)}`
                                                : "—",
                                        ],
                                        ["PAN", u.pan_number || "—"],
                                        ["DOB", fmtDate(u.date_of_birth)],
                                    ].map(([l, val]) => (
                                        <div key={l} className="bk-modal__row">
                                            <span>{l}</span>
                                            <strong>{val}</strong>
                                        </div>
                                    ))}
                                    <div className="bk-modal__row">
                                        <span>KYC Status</span>
                                        <strong style={{ color: kyc.color }}>
                                            {u.kyc_status || "pending"}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="user-modal__col">
                        {hasProf && (
                            <>
                                <div className="bk-modal__section">
                                    <div className="bk-modal__section-hd">🚗 Driving Licence</div>
                                    <div className="bk-modal__rows">
                                        {[
                                            ["Licence No.", u.driving_licence || "—"],
                                            ["Expiry", u.dl_expiry ? fmtDate(u.dl_expiry) : "—"],
                                        ].map(([l, val]) => {
                                            const expired =
                                                l === "Expiry" &&
                                                u.dl_expiry &&
                                                new Date(u.dl_expiry) < new Date();
                                            return (
                                                <div key={l} className="bk-modal__row">
                                                    <span>{l}</span>
                                                    <strong
                                                        style={{ color: expired ? "#EF4444" : "inherit" }}
                                                    >
                                                        {val}
                                                        {expired ? " ⚠ Expired" : ""}
                                                    </strong>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="bk-modal__section">
                                    <div className="bk-modal__section-hd">
                                        ⭐ Loyalty & Bookings
                                    </div>
                                    <div className="user-modal__stats">
                                        <div className="user-modal__stat">
                                            <span
                                                className="user-modal__stat-val"
                                                style={{ color: "#D97706" }}
                                            >
                                                {(u.loyalty_points || 0).toLocaleString("en-IN")}
                                            </span>
                                            <span className="user-modal__stat-lbl">
                                                Loyalty Points
                                            </span>
                                        </div>
                                        <div className="user-modal__stat">
                                            <span
                                                className="user-modal__stat-val"
                                                style={{ color: "#1D4ED8" }}
                                            >
                                                {u.total_bookings ?? "—"}
                                            </span>
                                            <span className="user-modal__stat-lbl">
                                                Total Bookings
                                            </span>
                                        </div>
                                        <div className="user-modal__stat">
                                            <span
                                                className="user-modal__stat-val"
                                                style={{ color: "#059669" }}
                                            >
                                                {u.active_bookings ?? "—"}
                                            </span>
                                            <span className="user-modal__stat-lbl">Active Now</span>
                                        </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function StarDisplay({ value, size = 14 }) {
    return (
        <span style={{ display: "inline-flex", gap: 1 }}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span
                    key={n}
                    style={{
                        fontSize: size,
                        color: n <= value ? "#E8A020" : "#E5E7EB",
                        lineHeight: 1,
                    }}
                >
                    ★
                </span>
            ))}
        </span>
    );
}

function ReviewDetailModal({ review: r, onClose }) {
    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div
                className="admin-modal"
                style={{ maxWidth: 560 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="admin-modal__head">
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                        Review — {r.customer_name}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "1px solid var(--vbdr)",
                            borderRadius: 8,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--vm)",
                            fontFamily: "Inter,sans-serif",
                        }}
                    >
                        ✕ Close
                    </button>
                </div>
                <div
                    style={{
                        padding: "18px 24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                    }}
                >
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        <div>
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    color: "var(--vm)",
                                    marginBottom: 6,
                                }}
                            >
                                Vendor Rating
                            </div>
                            <StarDisplay value={r.vendor_rating || 0} size={20} />
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    color: "var(--vm)",
                                    marginBottom: 6,
                                }}
                            >
                                Vehicle Rating
                            </div>
                            <StarDisplay value={r.vehicle_rating || 0} size={20} />
                        </div>
                    </div>
                    {[
                        ["Customer", r.customer_name || "—"],
                        ["Vehicle", r.vehicle_display || "—"],
                        ["Date", fmtDate(r.created_at)],
                    ].map(([l, val]) => (
                        <div key={l} className="admin-modal__row">
                            <span>{l}</span>
                            <strong>{val}</strong>
                        </div>
                    ))}
                    {r.review_text && (
                        <div
                            style={{
                                background: "var(--vs2)",
                                border: "1px solid var(--vbdr)",
                                borderRadius: 8,
                                padding: "12px 16px",
                                fontSize: 13,
                                fontStyle: "italic",
                                color: "var(--vt2)",
                                lineHeight: 1.65,
                            }}
                        >
                            "{r.review_text}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ASSIGNMENT CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function AdminAssignmentCard({ admin, assignments, vendors, onUnassign, onDrop }) {
    const [dragOver, setDragOver] = useState(false);
 
    const adminPK = getAdminPK(admin);
 
    // Build Set of vendor User PKs assigned to this admin
    const myVendorPKs = new Set(
        assignments
            .filter(a => a.is_active && getAssignmentAdminPK(a) === adminPK)
            .map(a => getAssignmentVendorPK(a))
            .filter(Boolean)
    );
 
    // Match vendors using the safe PK extractor
    const myVendors = vendors.filter(v => {
        const pk = getVendorPK(v);
        return pk != null && myVendorPKs.has(pk);
    });
 
    return (
        <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { setDragOver(false); onDrop(e, adminPK); }}
            style={{
                background:   dragOver ? "var(--teal-light)" : "var(--vs2)",
                border:       `2px dashed ${dragOver ? "var(--teal-primary)" : "var(--vbdr)"}`,
                borderRadius: 12, padding: 14,
                display: "flex", flexDirection: "column", gap: 10,
                minHeight: 140, transition: "all .18s",
                boxShadow: dragOver ? "0 0 0 3px rgba(13,184,158,.15)" : "none",
            }}
        >
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: "linear-gradient(135deg,#DBEAFE,#BFDBFE)",
                    color: "#1D4ED8", fontSize: 14, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid #BFDBFE",
                }}>
                    {(admin.full_name || admin.email || "A")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13, fontWeight: 700, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {admin.full_name || admin.email}
                    </strong>
                    <span style={{ fontSize: 11, color: "var(--vt2)" }}>{admin.email}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                    <span style={{
                        padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                        ...(admin.scope === "superadmin"
                            ? { background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }
                            : { background: "#EDE9FE", color: "#6D28D9", border: "1px solid #C4B5FD" }),
                    }}>
                        {admin.scope === "superadmin" ? "👑 Super" : "🎯 Assigned"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--vm)", background: "var(--vs)", padding: "2px 7px", borderRadius: 999, border: "1px solid var(--vbdr)" }}>
                        {myVendors.length} vendor{myVendors.length !== 1 ? "s" : ""}
                    </span>
                </div>
            </div>
 
            {/* Assigned vendor chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 30 }}>
                {myVendors.length === 0 ? (
                    <span style={{ fontSize: 11, color: "var(--vm)", fontStyle: "italic", padding: "8px 6px", width: "100%", textAlign: "center" }}>
                        {dragOver ? "📥 Drop vendor here" : "No vendors — drag one here"}
                    </span>
                ) : (
                    myVendors.map(vendor => {
                        const vpk = getVendorPK(vendor);
                        return (
                            <div key={vendor.id} style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "4px 10px 4px 8px",
                                background: "var(--vs)", border: "1px solid var(--vbdr)",
                                borderRadius: 999, fontSize: 11, fontWeight: 600, color: "var(--vt2)",
                            }}>
                                <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {vendor.business_name}
                                </span>
                                <StatusBadge status={vendor.status} colorMap={VENDOR_STATUS_CLR} size="sm" />
                                <button
                                    onClick={() => onUnassign(vpk)}
                                    style={{ background: "none", border: "none", color: "#EF4444", fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1, opacity: 0.7, fontFamily: "Inter,sans-serif" }}
                                    title="Remove assignment"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function AssignmentsTab({ myProfile }) {
    const isSuperAdmin = myProfile?.scope === "superadmin";
 
    // ── Data state ────────────────────────────────────────────────
    const [admins,      setAdmins]      = useState([]);
    const [vendors,     setVendors]     = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [busy,        setBusy]        = useState(false);
    const [error,       setError]       = useState("");
 
    // ── Selection state ───────────────────────────────────────────
    // selectedIds: Set of vendor User PKs (integers). Using a Set
    // guarantees no duplicates and O(1) membership checks.
    // We store it as a plain object key { [pk]: true } instead of
    // a JS Set to avoid React's stale-closure pitfalls with Sets.
    const [selectedMap, setSelectedMap] = useState({});  // { [vendorPK]: true }
    const selectedCount = Object.keys(selectedMap).length;
 
    // ── Per-vendor admin picker state ─────────────────────────────
    // Key: String(vendorPK), Value: String(adminPK)
    const [pickAdminMap, setPickAdminMap] = useState({});
 
    // ── Bulk-assign admin picker ──────────────────────────────────
    const [bulkAdminPK, setBulkAdminPK] = useState("");
 
    // ── UI state ──────────────────────────────────────────────────
    const [searchQ,     setSearchQ]     = useState("");
    const [historyV,    setHistoryV]    = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [viewMode,    setViewMode]    = useState("matrix");
 
    // ── Load all data ─────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [aRes, vRes, asRes] = await Promise.all([
                getAdminList(),
                getAdminVendors(),
                getAllAssignments(),
            ]);
            setAdmins(aRes.data);
            setVendors(vRes.data.results ?? vRes.data);
            setAssignments(asRes.data);
            // Clear selections on reload
            setSelectedMap({});
            setBulkAdminPK("");
        } catch (e) {
            setError(e.response?.data?.detail || e.message || "Failed to load.");
        }
        setLoading(false);
    }, []);
 
    useEffect(() => { load(); }, [load]);
 
    // ── Derived: which vendor PKs are already assigned ────────────
    const assignedPKs = new Set(
        assignments
            .filter(a => a.is_active)
            .map(a => getAssignmentVendorPK(a))
            .filter(Boolean)
    );
 
    const unassigned = vendors.filter(v => {
    const pk = getVendorPK(v);
    if (pk == null) return true;          // ← key change: null PK → show as unassigned
    return !assignedPKs.has(pk);
});
 
    const filteredUnassigned = unassigned.filter(v =>
        !searchQ ||
        v.business_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
        (v.email ?? v.user?.email ?? "").toLowerCase().includes(searchQ.toLowerCase())
    );
 
    // ── Checkbox helpers ──────────────────────────────────────────
 
    const toggleVendor = (vendorPK) => {
    if (vendorPK == null || vendorPK === 0 || isNaN(vendorPK)) {
        console.error("Invalid vendor PK:", vendorPK);
        return;
    }
    const key = String(vendorPK);
    setSelectedMap(prev => {
        const next = { ...prev };
        if (next[key]) delete next[key];
        else next[key] = true;
        return next;
    });
};
 
    const selectAll = () => {
        const next = {};
        filteredUnassigned.forEach(v => {
            const pk = getVendorPK(v);
            if (pk != null) next[String(pk)] = true;
        });
        setSelectedMap(next);
    };
 
    const clearSelection = () => {
        setSelectedMap({});
        setBulkAdminPK("");
    };
 
    const isSelected = (v) => {
        const pk = getVendorPK(v);
        if (pk == null) return false;
        return Boolean(selectedMap[String(pk)]);
    };
 
    // ── Per-vendor dropdown helpers ───────────────────────────────
 
    const getPickAdmin = (v) => pickAdminMap[String(getVendorPK(v))] ?? "";
    const setPickAdmin = (v, value) =>
        setPickAdminMap(prev => ({ ...prev, [String(getVendorPK(v))]: value }));
    const clearPickAdmin = (v) =>
        setPickAdminMap(prev => {
            const next = { ...prev };
            delete next[String(getVendorPK(v))];
            return next;
        });
 
    // ── API action: assign one or many vendors to an admin ────────
    const handleAssign = async (vendorPKs, adminPK) => {
        if (!vendorPKs.length || !adminPK) return;
        setBusy(true);
        try {
            if (vendorPKs.length === 1) {
                // Method 1 (direct) and Method 3 (drag-drop): single assign
                await assignVendorToAdmin(vendorPKs[0], adminPK);
            } else {
                // Method 2 (bulk): bulk assign
                await bulkAssignVendors(vendorPKs, adminPK);
            }
            clearSelection();
            await load();
        } catch (e) {
            alert(e.response?.data?.error || e.response?.data?.detail || "Assignment failed.");
        }
        setBusy(false);
    };
 
    // ── API action: remove an assignment ─────────────────────────
    const handleUnassign = async (vendorPK) => {
        if (!window.confirm("Remove this vendor assignment?")) return;
        setBusy(true);
        try {
            await unassignVendor(vendorPK);
            await load();
        } catch (e) {
            alert(e.response?.data?.error || e.response?.data?.detail || "Failed.");
        }
        setBusy(false);
    };
 
    // ── Drag-drop handler ─────────────────────────────────────────
    const handleDrop = (e, adminPK) => {
        e.preventDefault();
        try {
            const { vendorPK } = JSON.parse(e.dataTransfer.getData("application/json"));
            if (vendorPK && adminPK) handleAssign([Number(vendorPK)], adminPK);
        } catch { /* ignore bad drag data */ }
    };
 
    // ── History modal ─────────────────────────────────────────────
    const showHistory = async (v) => {
        setHistoryV(v);
        try {
            const r = await getAssignmentHistory(getVendorPK(v));
            setHistoryData(r.data);
        } catch { setHistoryData([]); }
    };
 
    // ── Table-view columns ────────────────────────────────────────
    const asgCols = [
        {
            key: "vendor_business", label: "Vendor", sortable: true, width: 200,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.vendor_email}</span>
                </div>
            ),
        },
        {
            key: "admin_name", label: "Admin", sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.admin_email}</span>
                </div>
            ),
        },
        { key: "assigned_at",      label: "Since",  sortable: true, width: 120, render: v => fmtDate(v) },
        { key: "assigned_by_name", label: "By",     sortable: true, width: 130, render: v => v || "—"   },
        {
            key: "is_active", label: "Status", sortable: true, width: 90,
            render: v => (
                <span className="admin-status-badge admin-status-badge--sm" style={
                    v ? { background: "#D1FAE5", color: "#059669", border: "1px solid #6EE7B740" }
                      : { background: "#F3F4F6", color: "#9CA3AF", border: "1px solid #E5E7EB"  }
                }>
                    {v ? "● Active" : "○ Ended"}
                </span>
            ),
        },
    ];
 
    // ── Non-superadmin view ───────────────────────────────────────
    if (!isSuperAdmin) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>My Assigned Vendors</h3>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--vm)" }}>Vendors you are responsible for managing.</p>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#EDE9FE", color: "#6D28D9", border: "1px solid #C4B5FD" }}>
                        🎯 Assigned Admin
                    </span>
                </div>
                {loading ? (
                    <div className="admin-loading"><div className="admin-loading__spinner" />Loading…</div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
                        {vendors
                            .filter(v => assignedPKs.has(getVendorPK(v)))
                            .map(v => (
                                <div key={v.id} style={{ background: "var(--vs)", border: "1px solid var(--vbdr)", borderRadius: 12, padding: "14px 16px" }}>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{v.business_name}</div>
                                    <div style={{ fontSize: 11, color: "var(--vt2)", marginTop: 4 }}>{v.email}</div>
                                    <div style={{ marginTop: 6 }}><StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} /></div>
                                </div>
                            ))}
                        {vendors.filter(v => assignedPKs.has(getVendorPK(v))).length === 0 && (
                            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--vm)", fontSize: 13 }}>
                                No vendors assigned yet. Contact a superadmin.
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
 
    // ═══════════════════════════════════════════════════════════════
    // SUPERADMIN VIEW
    // ═══════════════════════════════════════════════════════════════
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
 
            {/* Page header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Vendor–Admin Assignments</h3>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--vm)" }}>
                        ① Tick checkboxes → bulk-assign bar appears &nbsp;·&nbsp;
                        ② Drag a vendor onto an admin card &nbsp;·&nbsp;
                        ③ Use the per-row dropdown
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)", color: "#92400E", border: "1px solid #FCD34D" }}>
                        👑 Super Admin
                    </span>
                    <div style={{ display: "flex", border: "1px solid var(--vbdr2)", borderRadius: 8, overflow: "hidden" }}>
                        {[["matrix","⊞ Matrix"], ["table","≡ Table"]].map(([m, lbl]) => (
                            <button key={m} onClick={() => setViewMode(m)} style={{
                                padding: "6px 13px", fontSize: 12, fontWeight: 600, border: "none",
                                cursor: "pointer", fontFamily: "Inter,sans-serif",
                                borderRight: m === "matrix" ? "1px solid var(--vbdr2)" : "none",
                                background: viewMode === m ? "var(--teal-primary)" : "var(--vs2)",
                                color:      viewMode === m ? "#fff" : "var(--vm)",
                            }}>{lbl}</button>
                        ))}
                    </div>
                    <button onClick={load} disabled={busy} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--vbdr2)", background: "var(--vs2)", color: "var(--vt2)", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
                        ↺ Refresh
                    </button>
                </div>
            </div>
 
            {error && (
                <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#B91C1C", padding: "10px 16px", borderRadius: 10, fontSize: 13 }}>
                    ⚠ {error}
                </div>
            )}
 
            {/* KPI strip */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                    ["👥", "Admins",     admins.length,                      "#1D4ED8"],
                    ["🏪", "Vendors",    vendors.length,                     "#0DB89E"],
                    ["✅", "Assigned",   vendors.length - unassigned.length, "#059669"],
                    ["⚠️", "Unassigned", unassigned.length,                  unassigned.length > 0 ? "#D97706" : "#9CA3AF"],
                ].map(([icon, lbl, val, color]) => (
                    <div key={lbl} style={{ flex: 1, minWidth: 90, background: "var(--vs)", border: "1px solid var(--vbdr)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textAlign: "center" }}>
                        <span style={{ fontSize: 18 }}>{icon}</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{val}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--vm)" }}>{lbl}</span>
                    </div>
                ))}
            </div>
 
            {loading ? (
                <div className="admin-loading"><div className="admin-loading__spinner" />Loading assignment data…</div>
            ) : viewMode === "matrix" ? (
                <>
                    {/* ── Admin cards grid (drag-drop targets) ── */}
                    <div className="admin-section-card">
                        <div className="admin-section-card__header">
                            <div>
                                <h3>Admin Assignment Map</h3>
                                <p>Drag vendors from the list below onto a card, or use the per-row dropdown.</p>
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
                            {admins.map(admin => (
                                <AdminAssignmentCard
                                    key={admin.id}
                                    admin={admin}
                                    assignments={assignments}
                                    vendors={vendors}
                                    onUnassign={handleUnassign}
                                    onDrop={handleDrop}
                                />
                            ))}
                            {admins.length === 0 && (
                                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--vm)", fontSize: 13 }}>
                                    No admin accounts found.
                                </div>
                            )}
                        </div>
                    </div>
 
                    {/* ── Unassigned vendors panel ── */}
                    {unassigned.length > 0 && (
                        <div className="admin-section-card">
                            <div className="admin-section-card__header">
                                <div>
                                    <h3>⚠ Unassigned Vendors ({unassigned.length})</h3>
                                    <p>Select with checkboxes to bulk-assign, drag to a card above, or pick per row.</p>
                                </div>
                                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                                    {selectedCount > 0 && (
                                        <>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-primary)", background: "var(--teal-light)", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(13,184,158,.3)", whiteSpace: "nowrap" }}>
                                                {selectedCount} selected
                                            </span>
                                            <button onClick={clearSelection} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid var(--vbdr2)", background: "var(--vs2)", color: "var(--vt2)", cursor: "pointer", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}>
                                                ✕ Clear
                                            </button>
                                        </>
                                    )}
                                    <button onClick={selectAll} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid var(--vbdr2)", background: "var(--vs2)", color: "var(--vt2)", cursor: "pointer", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}>
                                        ☑ Select All
                                    </button>
                                </div>
                            </div>
 
                            {/* Search */}
                            <input
                                placeholder="Search unassigned vendors…"
                                value={searchQ}
                                onChange={e => setSearchQ(e.target.value)}
                                style={{ background: "var(--vs2)", border: "1px solid var(--vbdr2)", borderRadius: 8, color: "var(--vt)", padding: "7px 12px", fontSize: 12, outline: "none", fontFamily: "Inter,sans-serif", maxWidth: 320, transition: "border-color .14s" }}
                            />
 
                            {/* ── METHOD 2: Bulk-assign toolbar ── */}
                            {selectedCount > 0 && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                                    background: "var(--teal-light)", border: "1px solid rgba(13,184,158,.35)",
                                    borderRadius: 10, padding: "10px 14px",
                                }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-dark)", whiteSpace: "nowrap" }}>
                                        📦 {selectedCount} vendor{selectedCount !== 1 ? "s" : ""} selected
                                    </span>
                                    <select
                                        value={bulkAdminPK}
                                        onChange={e => setBulkAdminPK(e.target.value)}
                                        style={{ background: "var(--vs)", border: "1px solid var(--vbdr2)", borderRadius: 8, color: "var(--vt)", padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: "Inter,sans-serif", flex: 1, minWidth: 180, cursor: "pointer" }}
                                    >
                                        <option value="">— Assign all selected to… —</option>
                                        {admins.map(a => (
                                            <option key={a.id} value={String(getAdminPK(a))}>
                                                {a.full_name || a.email}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        disabled={!bulkAdminPK || busy}
                                        onClick={() => {
                                            const vendorPKs = Object.keys(selectedMap)
                                                .map(Number)
                                                .filter(pk => !isNaN(pk) && pk > 0);
                                            if (!vendorPKs.length) {
                                                alert("No valid vendors selected. Please apply the backend serializer patch first.");
                                                return;
                                            }
                                            handleAssign(vendorPKs, Number(bulkAdminPK));
                                        }}
                                        style={{
                                            background: bulkAdminPK ? "var(--teal-primary)" : "#9CA3AF",
                                            color: "#fff", border: "none", borderRadius: 8,
                                            padding: "7px 16px", fontSize: 12, fontWeight: 700,
                                            cursor: bulkAdminPK ? "pointer" : "not-allowed",
                                            fontFamily: "Inter,sans-serif", whiteSpace: "nowrap", transition: "background .14s",
                                        }}
                                    >
                                        {busy ? "…" : `Assign ${selectedCount} →`}
                                    </button>
                                    <button onClick={clearSelection} style={{ padding: "6px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid rgba(13,184,158,.4)", background: "transparent", color: "var(--teal-dark)", cursor: "pointer", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}>
                                        ✕ Deselect
                                    </button>
                                </div>
                            )}
 
                            {/* Vendor list rows */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto" }}>
                                {filteredUnassigned.map(v => {
                                    const vpk      = getVendorPK(v);
                                    const selected = isSelected(v);
                                    const pick     = getPickAdmin(v);
                                    const email    = v.email ?? v.user?.email ?? "";
 
                                    return (
                                        <div
                                            key={v.id}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 10,
                                                padding: "10px 12px",
                                                background: selected ? "var(--teal-light)" : "var(--vs)",
                                                border: `1px solid ${selected ? "var(--teal-primary)" : "var(--vbdr)"}`,
                                                borderRadius: 10, flexWrap: "wrap", transition: "all .14s",
                                            }}
                                        >
                                            {/* ── METHOD 2: Checkbox ── */}
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => toggleVendor(vpk)}
                                                style={{ width: 15, height: 15, accentColor: "var(--teal-primary)", flexShrink: 0, cursor: "pointer" }}
                                            />
 
                                            {/* ── METHOD 3: Drag handle ── */}
                                            <div
                                                draggable
                                                onDragStart={e =>
                                                    e.dataTransfer.setData(
                                                        "application/json",
                                                        JSON.stringify({ vendorPK: vpk })
                                                    )
                                                }
                                                style={{ fontSize: 18, color: "var(--vm)", cursor: "grab", userSelect: "none", flexShrink: 0, lineHeight: 1 }}
                                                title="Drag to assign"
                                            >⠿</div>
 
                                            {/* Vendor info */}
                                            <div style={{ flex: 1, minWidth: 120 }}>
                                                <strong style={{ fontSize: 13, fontWeight: 700, display: "block" }}>
                                                    {v.business_name}
                                                </strong>
                                                <span style={{ fontSize: 11, color: "var(--vt2)" }}>
                                                    {email}{v.city_name ? ` · ${v.city_name}` : ""}
                                                </span>
                                            </div>
 
                                            <StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} />
 
                                            {/* ── METHOD 1: Per-row dropdown ── */}
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                <select
                                                    value={pick}
                                                    onChange={e => setPickAdmin(v, e.target.value)}
                                                    style={{ background: "var(--vs2)", border: "1px solid var(--vbdr2)", borderRadius: 7, color: "var(--vt)", padding: "5px 8px", fontSize: 12, outline: "none", fontFamily: "Inter,sans-serif", minWidth: 160, cursor: "pointer" }}
                                                >
                                                    <option value="">— Assign to admin —</option>
                                                    {admins.map(a => (
                                                        <option key={a.id} value={String(getAdminPK(a))}>
                                                            {a.full_name || a.email}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    disabled={!pick || busy}
                                                    onClick={() => {
                                                        handleAssign([vpk], Number(pick));
                                                        clearPickAdmin(v);
                                                    }}
                                                    style={{
                                                        background: pick ? "var(--teal-primary)" : "#9CA3AF",
                                                        color: "#fff", border: "none", borderRadius: 7,
                                                        padding: "5px 13px", fontSize: 12, fontWeight: 700,
                                                        cursor: pick ? "pointer" : "not-allowed",
                                                        opacity: pick ? 1 : 0.4,
                                                        fontFamily: "Inter,sans-serif", whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {busy ? "…" : "Assign"}
                                                </button>
                                            </div>
 
                                            {/* History */}
                                            <button
                                                onClick={() => showHistory(v)}
                                                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid var(--vbdr2)", background: "var(--vs2)", color: "var(--vt2)", cursor: "pointer", fontFamily: "Inter,sans-serif", flexShrink: 0 }}
                                            >
                                                📋 History
                                            </button>
                                        </div>
                                    );
                                })}
 
                                {filteredUnassigned.length === 0 && (
                                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--vm)", fontSize: 13, fontStyle: "italic" }}>
                                        {searchQ ? "No vendors match your search." : "All vendors are assigned! 🎉"}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
 
                    {unassigned.length === 0 && !loading && (
                        <div className="admin-empty">
                            <span>✅</span>
                            <p>All vendors are currently assigned to an admin.</p>
                        </div>
                    )}
                </>
            ) : (
                /* ── Table view ── */
                <DataTable
                    columns={asgCols}
                    data={assignments}
                    searchable
                    searchKeys={["vendor_business", "vendor_email", "admin_name", "admin_email"]}
                    searchPlaceholder="Search by vendor or admin…"
                    filters={[{
                        key: "is_active", label: "Status",
                        options: [{ value: "", label: "All" }, { value: "true", label: "Active" }, { value: "false", label: "Ended" }],
                    }]}
                    extraActions={[
                        {
                            label: "📋 History",
                            className: "dt-action-btn--secondary",
                            onClick: row => showHistory({ id: row.id, user: row.vendor, user_id: row.vendor, business_name: row.vendor_business }),
                        },
                        {
                            label: "✕ Remove",
                            className: "dt-action-btn--danger",
                            show: row => row.is_active,
                            onClick: row => handleUnassign(Number(row.vendor)),
                        },
                    ]}
                    emptyIcon="🔗"
                    emptyMessage="No assignments found."
                    pageSize={25}
                />
            )}
 
            {/* History modal */}
            {historyV && (
                <div className="admin-modal-overlay" onClick={() => setHistoryV(null)}>
                    <div className="admin-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="admin-modal__head">
                            <div>
                                <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 800 }}>Assignment History</h3>
                                <p style={{ margin: 0, fontSize: 12, color: "var(--vm)" }}>
                                    {historyV.business_name || historyV.vendor_business || "Vendor"}
                                </p>
                            </div>
                            <button onClick={() => setHistoryV(null)} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: "var(--vm)", fontFamily: "Inter,sans-serif" }}>
                                ✕ Close
                            </button>
                        </div>
                        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {historyData.length === 0 ? (
                                <p style={{ textAlign: "center", color: "var(--vm)", fontSize: 13, fontStyle: "italic", padding: "20px 0" }}>No history found.</p>
                            ) : historyData.map(h => (
                                <div key={h.id} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14,
                                    padding: "11px 14px",
                                    background: h.is_active ? "var(--teal-light)" : "var(--vs2)",
                                    border: `1px solid ${h.is_active ? "var(--teal-primary)" : "var(--vbdr)"}`,
                                    borderRadius: 10, flexWrap: "wrap",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <strong style={{ fontSize: 13, fontWeight: 700 }}>{h.admin_name || h.admin_email}</strong>
                                        {h.is_active && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--teal-primary)" }}>● Active</span>}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: "var(--vt2)", textAlign: "right" }}>
                                        <span>Assigned: {fmtDatetime(h.assigned_at)}</span>
                                        {h.deactivated_at && <span style={{ color: "#EF4444" }}>Ended: {fmtDatetime(h.deactivated_at)}</span>}
                                        {h.assigned_by_name && <span style={{ color: "#9CA3AF" }}>By: {h.assigned_by_name}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const [tab, setTab] = useState("overview");

    // Profile / scope
    const [myProfile, setMyProfile] = useState(null);

    // Data
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [vendors, setVendors] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [vehicleStats, setVehicleStats] = useState(null);
    const [vehicleFilter, setVehicleFilter] = useState("");
    const [bookings, setBookings] = useState([]);
    const [users, setUsers] = useState([]);
    const [configs, setConfigs] = useState([]);
    const [segments, setSegments] = useState([]);
    const [locations, setLocations] = useState([]);
    const [cities, setCities] = useState([]);
    const [cityPairFees, setCityPairFees] = useState([]);
    const [promos, setPromos] = useState([]);
    const [returnPoints, setReturnPoints] = useState([]);
    const [handovers, setHandovers] = useState([]);
    const [logisticsStats, setLogisticsStats] = useState(null);
    const [network, setNetwork] = useState([]);
    const [agreements, setAgreements] = useState([]);
    const [acceptances, setAcceptances] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [reviewVendors, setReviewVendors] = useState([]);
    const [selectedReviewVendorId, setSelectedReviewVendorId] = useState("");
    const [reviewOrdering, setReviewOrdering] = useState("recency");
    const [reviewsLoading, setReviewsLoading] = useState(false);

    // Agreement form
    const [showCreateAgreement, setShowCreateAgreement] = useState(false);
    const [editingVersion, setEditingVersion] = useState(null);
    const [agreementFormLoading, setAgreementFormLoading] = useState(false);
    const emptyAgreementForm = {
        version_tag: "",
        title: "Rental Agreement – Terms & Conditions",
        summary: "",
        content: "",
        effective_from: "",
    };
    const [agreementForm, setAgreementForm] = useState(emptyAgreementForm);

    // UI
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [formLoading, setFormLoading] = useState(false);

    // Vehicle action state
    const [docNotes, setDocNotes] = useState({});
    const [certifyForms, setCertifyForms] = useState({});
    const [blacklistReasons, setBlacklistReasons] = useState({});

    // Modals
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedReview, setSelectedReview] = useState(null);
    const [vehiclePhotoLightbox, setVehiclePhotoLightbox] = useState(null);

    // ── Fetch admin profile on mount ──────────────────────────────────────
    useEffect(() => {
        getMyAdminProfile()
            .then((res) => setMyProfile(res.data))
            .catch(() =>
                setMyProfile({
                    scope: "superadmin",
                    assigned_vendor_count: null,
                    display_name: "",
                }),
            );
    }, []);

    // ── Tab data loading ──────────────────────────────────────────────────
    const loadTab = useCallback(
        async (t) => {
            if (t === "assignments") {
                setLoading(false);
                return;
            }
            setLoading(true);
            setError("");
            try {
                switch (t) {
                    case "overview": {
                        const [s, a] = await Promise.all([
                            getAdminStats(),
                            getAdminAnalytics(),
                        ]);
                        setStats(s.data);
                        setAnalytics(a.data);
                        break;
                    }
                    case "vendors": {
                        const { data } = await getAdminVendors();
                        setVendors(data.results || data);
                        break;
                    }
                    case "vehicles": {
                        const [v, s] = await Promise.all([
                            getAdminVehicles(vehicleFilter || ""),
                            getAdminVehicleStats(),
                        ]);
                        setVehicles(v.data.results || v.data);
                        setVehicleStats(s.data);
                        break;
                    }
                    case "bookings": {
                        const { data } = await getAdminBookings();
                        setBookings(data.results || data);
                        break;
                    }
                    case "users": {
                        const { data } = await getAdminUsers({ role: "customer" });
                        setUsers(data.results || data);
                        break;
                    }
                    case "config": {
                        const [c, sg] = await Promise.all([
                            getConfigSettings(),
                            getSegmentConfigs(),
                        ]);
                        setConfigs(c.data.results || c.data);
                        setSegments(sg.data.results || sg.data);
                        break;
                    }
                    case "locations": {
                        const [l, c, cp] = await Promise.all([
                            getLocations(),
                            getCities(),
                            getCityPairFees(),
                        ]);
                        setLocations(l.data.results || l.data);
                        setCities(c.data.results || c.data);
                        setCityPairFees(cp.data.results || cp.data);
                        break;
                    }
                    case "logistics": {
                        const [h, ls, nw, rp, c] = await Promise.all([
                            getAdminLogisticsOverview(),
                            getAdminLogisticsStats(),
                            getAdminNetworkList(),
                            getReturnPoints(),
                            getCities(),
                        ]);
                        setHandovers(h.data.results || h.data);
                        setLogisticsStats(ls.data);
                        setNetwork(nw.data.results || nw.data);
                        setReturnPoints(rp.data.results || rp.data);
                        setCities(c.data.results || c.data);
                        break;
                    }
                    case "promos": {
                        const { data } = await getAdminPromos();
                        setPromos(data.results || data);
                        break;
                    }
                    case "agreements": {
                        const [av, ac] = await Promise.all([
                            getAdminAgreementVersions(),
                            getAdminAcceptances(),
                        ]);
                        setAgreements(av.data.results || av.data);
                        setAcceptances(ac.data.results || ac.data);
                        break;
                    }
                    case "reviews": {
                        setReviewsLoading(true);
                        try {
                            const vRes = await getAdminVendors();
                            const vList = vRes.data.results || vRes.data;
                            setReviewVendors(vList);
                            if (vList.length > 0 && vList[0]?.user) {
                                const rRes = await fetchVendorReviews(vList[0].user, "recency");
                                setReviews(rRes.data.results || rRes.data);
                                setSelectedReviewVendorId(String(vList[0].user));
                            }
                        } catch {
                            setReviews([]);
                        } finally {
                            setReviewsLoading(false);
                        }
                        break;
                    }
                    default:
                        break;
                }
            } catch (e) {
                setError(
                    `Failed to load ${t}: ${e.response?.data?.detail || e.message || "Unknown error"}`,
                );
            }
            setLoading(false);
        },
        [vehicleFilter],
    );

    useEffect(() => {
        loadTab(tab);
    }, [tab, loadTab]);
    useEffect(() => {
        if (tab === "vehicles") loadTab("vehicles");
    }, [vehicleFilter]);

    // ── Action handlers ───────────────────────────────────────────────────
    const handleVendorAction = async (id, action, note = "") => {
        const statusMap = {
            approve: "approved",
            reject: "rejected",
            suspend: "suspended",
            reinstate: "approved",
            more_info: "more_info",
        };
        try {
            await adminVendorAction(id, action, note);
            const newStatus = statusMap[action];
            setVendors((p) =>
                p.map((v) =>
                    v.id === id
                        ? { ...v, status: newStatus || v.status, admin_note: note }
                        : v,
                ),
            );
            setSelectedVendor((prev) =>
                prev?.id === id
                    ? { ...prev, status: newStatus || prev.status, admin_note: note }
                    : prev,
            );
        } catch (e) {
            alert(e.response?.data?.error || "Action failed.");
        }
    };

    const handleDocReview = async (docId, action) => {
        try {
            await reviewDoc(docId, action, docNotes[docId] || "");
            const updater = (docs) =>
                (docs || []).map((d) =>
                    d.id === docId ? { ...d, status: action } : d,
                );
            setVehicles((p) =>
                p.map((v) => ({ ...v, documents: updater(v.documents) })),
            );
            setSelectedVehicle((prev) =>
                prev ? { ...prev, documents: updater(prev.documents) } : prev,
            );
            setDocNotes((p) => ({ ...p, [docId]: "" }));
        } catch {
            alert("Review failed.");
        }
    };

    const handleCertify = async (vehicleId) => {
        const f = certifyForms[vehicleId] || {};
        if (!f.cert_date || !f.odometer_at_cert) {
            alert("Cert date and odometer required.");
            return;
        }
        const fd = new FormData();
        fd.append("cert_date", f.cert_date);
        fd.append("odometer_at_cert", f.odometer_at_cert);
        if (f.file) fd.append("file", f.file);
        try {
            await certifyVehicle(vehicleId, fd);
            await loadTab("vehicles");
            alert("Vehicle certified → LIVE!");
        } catch (e) {
            alert(e.response?.data?.error || "Certification failed.");
        }
    };

    const handleBlacklist = async (vehicleId) => {
        const reason = blacklistReasons[vehicleId];
        if (!reason) {
            alert("Enter a reason.");
            return;
        }
        try {
            await blacklistVehicle(vehicleId, reason);
            const update = (v) =>
                v.id === vehicleId
                    ? { ...v, status: "INACTIVE", is_blacklisted: true }
                    : v;
            setVehicles((p) => p.map(update));
            setSelectedVehicle((prev) => (prev ? update(prev) : prev));
        } catch {
            alert("Blacklist failed.");
        }
    };

    const handleSetVehicleStatus = async (vehicleId, newStatus, note = "") => {
        try {
            const { data } = await setVehicleStatus(vehicleId, newStatus, note);
            const update = (v) =>
                v.id === vehicleId ? { ...v, status: data.new_status } : v;
            setVehicles((p) => p.map(update));
            setSelectedVehicle((prev) => (prev ? update(prev) : prev));
        } catch (e) {
            alert(e.response?.data?.error || "Status change failed.");
        }
    };

    const handleVahanCheck = async (vehicleId) => {
        try {
            const { data } = await vahanCheck(vehicleId);
            alert(`VAHAN: ${data.vahan_result?.message || "Completed"}.`);
            await loadTab("vehicles");
        } catch {
            alert("VAHAN check failed.");
        }
    };

    const handleConfigSave = async (setting) => {
        try {
            await updateConfigSetting(setting.id, setting.value);
            alert("Saved.");
        } catch {
            alert("Save failed.");
        }
    };

    const handleSegmentSave = async (seg) => {
        try {
            await updateSegmentConfig(seg.id, {
                security_deposit: seg.security_deposit,
                min_driver_age: seg.min_driver_age,
                min_rental_days: seg.min_rental_days,
            });
            alert("Segment saved.");
        } catch {
            alert("Save failed.");
        }
    };

    const handleAddCity = async (v) => {
        setFormLoading(true);
        try {
            await createCity(v);
            await loadTab("locations");
        } catch (e) {
            alert(JSON.stringify(e.response?.data || "Failed."));
        }
        setFormLoading(false);
    };
    const handleDeleteCity = async (id) => {
        if (!window.confirm("Delete?")) return;
        try {
            await deleteCity(id);
            setCities((p) => p.filter((c) => c.id !== id));
        } catch {
            alert("Failed.");
        }
    };
    const handleAddLocation = async (v) => {
        setFormLoading(true);
        try {
            await createLocation(v);
            await loadTab("locations");
        } catch (e) {
            alert(JSON.stringify(e.response?.data || "Failed."));
        }
        setFormLoading(false);
    };
    const handleDeleteLocation = async (id) => {
        if (!window.confirm("Delete?")) return;
        try {
            await deleteLocation(id);
            setLocations((p) => p.filter((l) => l.id !== id));
        } catch {
            alert("Failed.");
        }
    };
    const handleAddCityPairFee = async (v) => {
        setFormLoading(true);
        try {
            await createCityPairFee(v);
            await loadTab("locations");
        } catch {
            alert("Failed.");
        }
        setFormLoading(false);
    };
    const handleDeleteCityPairFee = async (id) => {
        if (!window.confirm("Delete?")) return;
        try {
            await deleteCityPairFee(id);
            setCityPairFees((p) => p.filter((f) => f.id !== id));
        } catch {
            alert("Failed.");
        }
    };
    const handleAddPromo = async (v) => {
        setFormLoading(true);
        try {
            await createPromo(v);
            await loadTab("promos");
        } catch (e) {
            alert(JSON.stringify(e.response?.data || "Failed."));
        }
        setFormLoading(false);
    };
    const handleDeletePromo = async (id) => {
        if (!window.confirm("Delete?")) return;
        try {
            await deletePromo(id);
            setPromos((p) => p.filter((x) => x.id !== id));
        } catch {
            alert("Failed.");
        }
    };
    const handleAddReturnPoint = async (v) => {
        setFormLoading(true);
        try {
            await createReturnPoint(v);
            const r = await getReturnPoints();
            setReturnPoints(r.data.results || r.data);
        } catch (e) {
            alert(JSON.stringify(e.response?.data || "Failed."));
        }
        setFormLoading(false);
    };
    const handleDeleteReturnPoint = async (id) => {
        if (!window.confirm("Delete?")) return;
        try {
            await deleteReturnPoint(id);
            setReturnPoints((p) => p.filter((r) => r.id !== id));
        } catch {
            alert("Failed.");
        }
    };

    const handleCreateAgreement = async (e) => {
        e.preventDefault();
        if (!agreementForm.version_tag || !agreementForm.content) {
            alert("version_tag and content required.");
            return;
        }
        setAgreementFormLoading(true);
        try {
            await createAgreementVersion({
                ...agreementForm,
                effective_from:
                    agreementForm.effective_from || new Date().toISOString(),
            });
            await loadTab("agreements");
            setShowCreateAgreement(false);
            setAgreementForm(emptyAgreementForm);
        } catch (e) {
            alert(JSON.stringify(e.response?.data || "Failed."));
        }
        setAgreementFormLoading(false);
    };
    const handleUpdateAgreement = async (e) => {
        e.preventDefault();
        if (!editingVersion) return;
        setAgreementFormLoading(true);
        try {
            await updateAgreementVersion(editingVersion.id, {
                title: editingVersion.title,
                summary: editingVersion.summary,
                content: editingVersion.content,
                effective_from: editingVersion.effective_from,
            });
            await loadTab("agreements");
            setEditingVersion(null);
        } catch (e) {
            alert(e.response?.data?.error || "Failed.");
        }
        setAgreementFormLoading(false);
    };
    const handleActivateAgreement = async (id, tag) => {
        if (!window.confirm(`Activate ${tag}?`)) return;
        try {
            await activateAgreementVersion(id);
            await loadTab("agreements");
        } catch (e) {
            alert(e.response?.data?.error || "Failed.");
        }
    };

    const vendorColumns = [
        {
            key: "business_name",
            label: "Business",
            sortable: true,
            width: 220,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v}</span>
                    <span className="dt-cell-stack__secondary">{row.email}</span>
                </div>
            ),
        },
        {
            key: "city_name",
            label: "City",
            sortable: true,
            width: 110,
            render: (v) => v || "—",
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            width: 120,
            render: (v) => <StatusBadge status={v} colorMap={VENDOR_STATUS_CLR} />,
        },
        {
            key: "kyc",
            label: "KYC",
            sortable: false,
            width: 90,
            render: (_, row) => {
                const k = getKYCStatus(row);
                return (
                    <span style={{ fontSize: 11, fontWeight: 700, color: k.complete ? "#059669" : "#D97706" }}>
                        {k.done}/{k.total} {k.complete ? "✓" : "⚠"}
                    </span>
                );
            },
        },
        {
            key: "rating",
            label: "Rating",
            sortable: true,
            width: 80,
            render: (v) => (v > 0 ? `⭐ ${v}` : "—"),
        },
        {
            key: "created_at",
            label: "Joined",
            sortable: true,
            width: 110,
            render: (v) => fmtDate(v),
        },
    ];
    const vehicleColumns = [
        {
            key: "make",
            label: "Vehicle",
            sortable: true,
            width: 200,
            render: (_, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{row.year} {row.make} {row.model}</span>
                    <span className="dt-cell-stack__secondary dt-mono">{row.plate_number}</span>
                </div>
            ),
        },
        {
            key: "vendor",
            label: "Vendor",
            sortable: false,
            width: 160,
            render: (_, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{row.vendor?.vendor_profile?.business_name || row.vendor?.email || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.city?.name || "—"}</span>
                </div>
            ),
        },
        {
            key: "segment",
            label: "Segment",
            sortable: true,
            width: 100,
            render: (v) => <span style={{ textTransform: "capitalize" }}>{v || "—"}</span>,
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            width: 130,
            render: (v) => <StatusBadge status={v} colorMap={VEHICLE_STATUS_CLR} />,
        },
        {
            key: "daily_rate",
            label: "Rate/Day",
            sortable: true,
            width: 100,
            align: "right",
            render: (v) => <span className="dt-currency">₹{parseInt(v || 0).toLocaleString("en-IN")}</span>,
        },
        {
            key: "documents",
            label: "Docs",
            sortable: false,
            width: 70,
            align: "center",
            render: (docs) => {
                const a = (docs || []).filter((d) => d.status === "approved").length;
                const t = (docs || []).length;
                return <span style={{ fontSize: 11, fontWeight: 700, color: a >= 3 ? "#059669" : "#D97706" }}>{a}/{t}</span>;
            },
        },
        {
            key: "photos",
            label: "Photos",
            sortable: false,
            width: 70,
            align: "center",
            render: (photos) => {
                const n = (photos || []).length;
                return <span style={{ fontSize: 11, fontWeight: 700, color: n >= 10 ? "#059669" : "#D97706" }}>{n}{n >= 10 ? " ✓" : " ⚠"}</span>;
            },
        },
        {
            key: "is_certified",
            label: "Cert",
            sortable: true,
            width: 55,
            align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontSize: 14 }}>✓</span> : <span style={{ color: "#D1D5DB" }}>—</span>,
        },
    ];
    const bookingColumns = [
        {
            key: "booking_ref",
            label: "Ref",
            sortable: true,
            width: 140,
            render: (v) => <span className="dt-mono">{v}</span>,
        },
        {
            key: "customer_name",
            label: "Customer",
            sortable: true,
            width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.customer_email}</span>
                </div>
            ),
        },
        {
            key: "vehicle_display",
            label: "Vehicle",
            sortable: true,
            width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary dt-mono">{row.vehicle?.plate_number || "—"}</span>
                </div>
            ),
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            width: 110,
            render: (v) => <StatusBadge status={v} colorMap={BOOKING_STATUS_CLR} />,
        },
        { key: "pickup_date", label: "Pickup", sortable: true, width: 100, render: (v) => v || "—" },
        { key: "rental_days", label: "Days", sortable: true, width: 60, align: "center", render: (v) => v ?? "—" },
        {
            key: "total_amount",
            label: "Total",
            sortable: true,
            width: 110,
            align: "right",
            render: (v) => <span className="dt-currency">₹{parseFloat(v || 0).toLocaleString("en-IN")}</span>,
        },
        {
            key: "payment_captured",
            label: "Paid",
            sortable: true,
            width: 60,
            align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontWeight: 700, fontSize: 13 }}>✓</span> : <span style={{ color: "#EF4444", fontSize: 13 }}>✕</span>,
        },
        { key: "created_at", label: "Created", sortable: true, width: 110, render: (v) => fmtDate(v) },
    ];
    const userColumns = [
        {
            key: "full_name",
            label: "Name",
            sortable: true,
            width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.email}</span>
                </div>
            ),
        },
        { key: "phone", label: "Phone", sortable: false, width: 130, render: (v) => v || "—" },
        {
            key: "kyc_status",
            label: "KYC",
            sortable: true,
            width: 100,
            render: (v) => {
                const s = KYC_STATUS_CLR[v] || KYC_STATUS_CLR.pending;
                return <span className="dt-badge" style={{ background: s.bg, color: s.color, borderColor: s.color + "40" }}>{v || "pending"}</span>;
            },
        },
        {
            key: "is_email_verified", label: "Email ✓", sortable: true, width: 80, align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontWeight: 700 }}>✓</span> : <span style={{ color: "#EF4444" }}>✕</span>,
        },
        {
            key: "is_phone_verified", label: "Phone ✓", sortable: true, width: 80, align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontWeight: 700 }}>✓</span> : <span style={{ color: "#EF4444" }}>✕</span>,
        },
        { key: "total_bookings", label: "Bookings", sortable: true, width: 80, align: "center", render: (v) => v ?? "—" },
        { key: "loyalty_points", label: "Points", sortable: true, width: 80, align: "right", render: (v) => (v != null ? v.toLocaleString("en-IN") : "—") },
        { key: "date_joined", label: "Joined", sortable: true, width: 100, render: (v) => fmtDate(v) },
    ];
    const reviewColumns = [
        {
            key: "customer_name",
            label: "Customer",
            sortable: true,
            width: 160,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.vehicle_display || "—"}</span>
                </div>
            ),
        },
        { key: "vendor_rating", label: "Vendor ★", sortable: true, width: 120, render: (v) => <StarDisplay value={v || 0} size={14} /> },
        { key: "vehicle_rating", label: "Vehicle ★", sortable: true, width: 120, render: (v) => <StarDisplay value={v || 0} size={14} /> },
        {
            key: "review_text",
            label: "Review",
            sortable: false,
            render: (v) => v
                ? <span style={{ fontSize: 12, color: "var(--vt2)", fontStyle: "italic", display: "block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{v}"</span>
                : <span style={{ color: "var(--vm)", fontSize: 11 }}>No text</span>,
        },
        { key: "created_at", label: "Date", sortable: true, width: 110, render: (v) => fmtDate(v) },
    ];
    const acceptanceColumns = [
        { key: "version_tag", label: "Version", sortable: true, width: 110, render: (v) => <span className="dt-mono">{v}</span> },
        {
            key: "user_name", label: "User", sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.user_email}</span>
                </div>
            ),
        },
        {
            key: "booking_ref", label: "Booking", sortable: true, width: 130,
            render: (v) => v ? <span className="dt-mono" style={{ color: "var(--teal-primary)" }}>{v}</span> : "—",
        },
        {
            key: "acceptance_method", label: "Method", sortable: true, width: 110,
            render: (v) => (
                <span className="dt-badge" style={v === "otp_sign" ? { background: "#DBEAFE", color: "#1D4ED8", borderColor: "#93C5FD" } : { background: "#F3F4F6", color: "#6B7280", borderColor: "#E5E7EB" }}>
                    {v === "otp_sign" ? "OTP Sign" : "Checkbox"}
                </span>
            ),
        },
        {
            key: "otp_verified", label: "OTP ✓", sortable: true, width: 70, align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontWeight: 700 }}>✓</span> : <span style={{ color: "#9CA3AF" }}>—</span>,
        },
        { key: "accepted_at", label: "Signed At", sortable: true, width: 140, render: (v) => fmtDatetime(v) },
        { key: "ip_address", label: "IP", sortable: false, width: 120, render: (v) => v ? <span style={{ fontFamily: "monospace", fontSize: 11 }}>{v}</span> : "—" },
    ];
    const handoverColumns = [
        { key: "vehicle_display", label: "Vehicle", sortable: true, width: 180, render: (v) => v || "—" },
        { key: "booking_ref", label: "Booking", sortable: true, width: 130, render: (v) => <span className="dt-mono">{v || "—"}</span> },
        { key: "originating_vendor_name", label: "From Vendor", sortable: true, width: 160, render: (v) => v || "—" },
        { key: "return_point_name", label: "Return Point", sortable: true, width: 140, render: (v) => v ? `📍 ${v}` : "—" },
        { key: "status", label: "Status", sortable: true, width: 110, render: (v) => <StatusBadge status={v} colorMap={HANDOVER_STATUS_CLR} /> },
        {
            key: "days_held", label: "Days Held", sortable: true, width: 90, align: "center",
            render: (v) => v ? <span style={{ color: v > 3 ? "#D97706" : "inherit" }}>{v}d</span> : "—",
        },
    ];

    const TAB_LABELS = {
        overview: "Overview", vendors: "Vendors", vehicles: "Vehicles",
        bookings: "Bookings", users: "Users", locations: "Locations",
        logistics: "Logistics", config: "Config", promos: "Promos",
        agreements: "Agreements", reviews: "Reviews", assignments: "Assignments",
    };

    return (
        <div className="admin-dash">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />

            {selectedVendor && (
                <VendorDetailModal vendor={selectedVendor} onClose={() => setSelectedVendor(null)} onAction={handleVendorAction} />
            )}
            {selectedBooking && (
                <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
            )}
            {selectedUser && (
                <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
            )}
            {selectedReview && (
                <ReviewDetailModal review={selectedReview} onClose={() => setSelectedReview(null)} />
            )}
            {selectedVehicle && (
                <VehicleDetailModal
                    vehicle={selectedVehicle}
                    onClose={() => setSelectedVehicle(null)}
                    docNotes={docNotes} setDocNotes={setDocNotes}
                    certifyForms={certifyForms} setCertifyForms={setCertifyForms}
                    blacklistReasons={blacklistReasons} setBlacklistReasons={setBlacklistReasons}
                    onDocReview={handleDocReview} onCertify={handleCertify}
                    onBlacklist={handleBlacklist} onSetStatus={handleSetVehicleStatus}
                    onVahanCheck={handleVahanCheck} setVehiclePhotoLightbox={setVehiclePhotoLightbox}
                />
            )}
            {vehiclePhotoLightbox && (
                <PhotoLightbox photos={vehiclePhotoLightbox.photos} initialIndex={vehiclePhotoLightbox.index} onClose={() => setVehiclePhotoLightbox(null)} />
            )}

            <div className="page-shell">
                <div className="admin-dash__inner">
                    <div className="admin-dash__hero">
                        <div className="admin-dash__hero-banner" />
                        <div className="admin-dash__hero-body">
                            <div className="admin-dash__hero-left">
                                <div className="admin-dash__hero-icon">⚙️</div>
                                <div className="admin-dash__hero-info">
                                    <div className="admin-dash__hero-title">Control Centre</div>
                                    <div className="admin-dash__hero-sub">
                                        Vendors · Vehicles · Bookings · Locations · Logistics · Config
                                    </div>
                                    <ScopeIndicator profile={myProfile} />
                                </div>
                            </div>
                            {stats && (
                                <div className="cd__kpis">
                                    {[
                                        [stats.total_users ?? stats.total_customers, "Users", "#1D4ED8"],
                                        [stats.total_vendors ?? stats.assigned_vendors, "Vendors", "#0DB89E"],
                                        [stats.pending_vendors, "Pending", "#D97706"],
                                        [stats.total_vehicles, "Vehicles", "#059669"],
                                        [stats.total_bookings, "Bookings", "#6B7280"],
                                        [stats.active_bookings, "Active", "#059669"],
                                        ...(myProfile?.scope === "superadmin" && stats.unassigned_vendors != null
                                            ? [[stats.unassigned_vendors, "Unassigned", stats.unassigned_vendors > 0 ? "#EF4444" : "#9CA3AF"]]
                                            : []),
                                    ].map(([v, l, color]) => (
                                        <div key={l} className="cd__kpi">
                                            <span className="cd__kpi-val" style={{ color }}>{v ?? "—"}</span>
                                            <span className="cd__kpi-lbl">{l}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="admin-sec-hd">
                        <h2>{TAB_LABELS[tab]}</h2>
                    </div>

                    {loading && (
                        <div className="admin-loading">
                            <div className="admin-loading__spinner" />
                            <span>Loading {tab}…</span>
                        </div>
                    )}
                    {error && (
                        <div className="admin-error">
                            <span>⚠ {error}</span>
                            <button onClick={() => loadTab(tab)}>↺ Retry</button>
                        </div>
                    )}

                    {!loading && tab === "overview" && analytics && (
                        <div className="admin-section">
                            <div className="admin-kpi-grid">
                                {[
                                    ["💰", "Total Revenue", `₹${parseFloat(analytics.total_revenue || 0).toLocaleString("en-IN")}`, "#0DB89E"],
                                    ["🏦", "Platform Commission", `₹${parseFloat(analytics.platform_revenue || 0).toLocaleString("en-IN")}`, "#8B5CF6"],
                                    ["📋", "Total Bookings", analytics.total_bookings, "#3B82F6"],
                                ].map(([icon, label, value, color]) => (
                                    <div key={label} className="admin-kpi-card">
                                        <div className="admin-kpi-card__icon" style={{ background: `${color}15`, color }}>{icon}</div>
                                        <div><p>{label}</p><h2 style={{ color }}>{value ?? "—"}</h2></div>
                                    </div>
                                ))}
                            </div>
                            <div className="admin-two-col">
                                {analytics.city_demand?.length > 0 && (
                                    <SectionCard title="City-wise Demand" subtitle="Top performing cities">
                                        <div className="admin-data-table">
                                            <div className="admin-data-table__header"><span>City</span><span>Bookings</span><span>Revenue</span></div>
                                            {analytics.city_demand.map((c, i) => (
                                                <div key={c.city} className="admin-data-table__row">
                                                    <span><span className="admin-rank">#{i + 1}</span> {c.city}</span>
                                                    <span><span className="admin-badge admin-badge--blue">{c.count}</span></span>
                                                    <span className="admin-currency">₹{parseFloat(c.revenue || 0).toLocaleString("en-IN")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                                {analytics.vendor_league?.length > 0 && (
                                    <SectionCard title="Top Vendors" subtitle="By total revenue">
                                        <div className="admin-data-table">
                                            <div className="admin-data-table__header"><span>Vendor</span><span>Bookings</span><span>Revenue</span></div>
                                            {analytics.vendor_league.map((v, i) => (
                                                <div key={v.vendor_id} className="admin-data-table__row">
                                                    <span><span className="admin-rank">#{i + 1}</span> {v.name}</span>
                                                    <span><span className="admin-badge admin-badge--blue">{v.count}</span></span>
                                                    <span className="admin-currency">₹{parseFloat(v.revenue || 0).toLocaleString("en-IN")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                            </div>
                            {analytics.monthly_trend?.length > 0 && (
                                <SectionCard title="Monthly Booking Trend">
                                    <div className="admin-trend-chart">
                                        {analytics.monthly_trend.map((m) => {
                                            const maxC = Math.max(...analytics.monthly_trend.map((x) => x.count));
                                            const pct = maxC > 0 ? (m.count / maxC) * 100 : 0;
                                            return (
                                                <div key={m.month} className="admin-trend-bar-wrap">
                                                    <div className="admin-trend-bar-track">
                                                        <div className="admin-trend-bar" style={{ height: `${pct}%` }} />
                                                    </div>
                                                    <span>{m.month?.slice(5)}</span>
                                                    <span className="admin-trend-count">{m.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            )}
                        </div>
                    )}

                    {!loading && tab === "vendors" && (
                        <div className="admin-section">
                            <DataTable
                                columns={vendorColumns}
                                data={vendors}
                                searchable
                                searchKeys={["business_name", "email", "phone", "city_name"]}
                                searchPlaceholder="Search vendors by name, email, phone, city…"
                                filters={[{
                                    key: "status", label: "Status", colorMap: VENDOR_STATUS_CLR,
                                    options: [
                                        { value: "", label: "All Statuses" }, { value: "pending", label: "Pending" },
                                        { value: "approved", label: "Approved" }, { value: "more_info", label: "More Info" },
                                        { value: "rejected", label: "Rejected" }, { value: "suspended", label: "Suspended" },
                                    ],
                                }]}
                                onRowAction={(row) => setSelectedVendor(row)}
                                actionLabel="View Details"
                                emptyIcon="🏪"
                                emptyMessage="No vendors found."
                                pageSize={25}
                            />
                        </div>
                    )}

                    {!loading && tab === "vehicles" && (
                        <div className="admin-section">
                            {vehicleStats && (
                                <div className="admin-stats-row">
                                    {Object.entries(vehicleStats).map(([s, count]) => {
                                        const vc = VEHICLE_STATUS_CLR[s] || { color: "#9CA3AF" };
                                        return (
                                            <div key={s} className="admin-mini-stat" style={{ borderColor: vc.color + "60", cursor: "pointer", outline: vehicleFilter === s ? `2px solid ${vc.color}` : "none" }}
                                                onClick={() => setVehicleFilter((p) => (p === s ? "" : s))}>
                                                <span style={{ color: vc.color, fontWeight: 800, fontSize: 17 }}>{count}</span>
                                                <span>{s.replace(/_/g, " ")}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <DataTable
                                columns={vehicleColumns}
                                data={vehicles}
                                searchable
                                searchKeys={["make", "model", "plate_number", "year"]}
                                searchPlaceholder="Search by make, model, plate number…"
                                filters={[
                                    {
                                        key: "status", label: "Status", colorMap: VEHICLE_STATUS_CLR,
                                        options: [
                                            { value: "", label: "All" }, { value: "PENDING_DOCS", label: "Pending Docs" },
                                            { value: "DOCS_SUBMITTED", label: "Docs Submitted" }, { value: "ADMIN_APPROVED", label: "Admin Approved" },
                                            { value: "LIVE", label: "Live" }, { value: "INACTIVE", label: "Inactive" },
                                        ],
                                    },
                                    {
                                        key: "segment", label: "Segment",
                                        options: [
                                            { value: "", label: "All Segments" }, { value: "hatchback", label: "Hatchback" },
                                            { value: "sedan", label: "Sedan" }, { value: "suv", label: "SUV" },
                                            { value: "luxury", label: "Luxury" }, { value: "van", label: "Van" },
                                        ],
                                    },
                                ]}
                                onRowAction={(row) => setSelectedVehicle(row)}
                                actionLabel="Review Vehicle"
                                emptyIcon="🚗"
                                emptyMessage="No vehicles found."
                                pageSize={20}
                            />
                        </div>
                    )}

                    {!loading && tab === "bookings" && (
                        <div className="admin-section">
                            <DataTable
                                columns={bookingColumns}
                                data={bookings}
                                searchable
                                searchKeys={["booking_ref", "customer_name", "customer_email", "vehicle_display"]}
                                searchPlaceholder="Search by ref, customer, vehicle…"
                                filters={[
                                    {
                                        key: "status", label: "Status", colorMap: BOOKING_STATUS_CLR,
                                        options: [
                                            { value: "", label: "All" }, { value: "PENDING", label: "Pending" },
                                            { value: "CONFIRMED", label: "Confirmed" }, { value: "ACTIVE", label: "Active" },
                                            { value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" },
                                        ],
                                    },
                                    {
                                        key: "payment_captured", label: "Payment",
                                        options: [{ value: "", label: "All" }, { value: "true", label: "Paid" }, { value: "false", label: "Unpaid" }],
                                    },
                                ]}
                                onRowAction={(row) => setSelectedBooking(row)}
                                actionLabel="View Booking"
                                emptyIcon="📋"
                                emptyMessage="No bookings found."
                                pageSize={25}
                            />
                        </div>
                    )}

                    {!loading && tab === "users" && (
                        <div className="admin-section">
                            <DataTable
                                columns={userColumns}
                                data={users.filter((u) => u.role === "customer")}
                                searchable
                                searchKeys={["full_name", "email", "phone"]}
                                searchPlaceholder="Search by name, email or phone…"
                                filters={[{
                                    key: "kyc_status", label: "KYC Status", colorMap: KYC_STATUS_CLR,
                                    options: [{ value: "", label: "All" }, { value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }],
                                }]}
                                onRowAction={(row) => setSelectedUser(row)}
                                actionLabel="View User"
                                emptyIcon="👤"
                                emptyMessage="No customers found."
                                pageSize={25}
                            />
                        </div>
                    )}

                    {!loading && tab === "locations" && (
                        <div className="admin-section">
                            <SectionCard title="Cities" subtitle="Add operating cities first.">
                                <InlineForm
                                    fields={[
                                        { key: "name", label: "City Name", required: true, placeholder: "e.g. Mumbai" },
                                        { key: "state", label: "State", required: true, placeholder: "e.g. Maharashtra" },
                                        { key: "latitude", label: "Latitude", type: "number", step: "0.000001" },
                                        { key: "longitude", label: "Longitude", type: "number", step: "0.000001" },
                                    ]}
                                    onSubmit={handleAddCity}
                                    submitLabel="+ Add City"
                                    loading={formLoading}
                                />
                                <div className="admin-data-table" style={{ marginTop: 12 }}>
                                    <div className="admin-data-table__header"><span>City</span><span>State</span><span>Coords</span><span></span></div>
                                    {cities.length === 0 && <div className="admin-table-empty">No cities yet.</div>}
                                    {cities.map((c) => (
                                        <div key={c.id} className="admin-data-table__row">
                                            <span><strong>{c.name}</strong></span>
                                            <span>{c.state}</span>
                                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>{c.latitude ? `${c.latitude}, ${c.longitude}` : "—"}</span>
                                            <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDeleteCity(c.id)}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>

                            <SectionCard title="Pickup / Dropoff Locations">
                                <DataTable
                                    columns={[
                                        { key: "name", label: "Name", sortable: true, render: (v) => <strong>{v}</strong> },
                                        { key: "city_name", label: "City", sortable: true, render: (_, row) => row.city?.name || row.city_name || "—" },
                                        { key: "location_type", label: "Type", sortable: true, width: 120, render: (v) => <span className="admin-badge admin-badge--gray">{v}</span> },
                                        { key: "address", label: "Address", sortable: false, render: (v) => v || "—" },
                                    ]}
                                    data={locations}
                                    searchable
                                    searchKeys={["name", "city_name", "address"]}
                                    searchPlaceholder="Search locations…"
                                    emptyIcon="📍"
                                    emptyMessage="No locations yet."
                                    pageSize={15}
                                    extraActions={[{ label: "✕ Delete", className: "dt-action-btn--danger", onClick: (row) => handleDeleteLocation(row.id) }]}
                                />
                            </SectionCard>

                            <SectionCard title="One-Way City Pair Fees">
                                <InlineForm
                                    fields={[
                                        { key: "from_city", label: "From City", type: "select", required: true, options: cities.map((c) => ({ value: c.id, label: c.name })) },
                                        { key: "to_city", label: "To City", type: "select", required: true, options: cities.map((c) => ({ value: c.id, label: c.name })) },
                                        { key: "fee", label: "Fee (₹)", type: "number", required: true, step: "0.01" },
                                    ]}
                                    onSubmit={handleAddCityPairFee}
                                    submitLabel="+ Add Fee"
                                    loading={formLoading}
                                />
                                <DataTable
                                    columns={[
                                        { key: "from_city_name", label: "From", sortable: true, render: (_, r) => r.from_city_name || r.from_city },
                                        { key: "to_city_name", label: "To", sortable: true, render: (_, r) => `→ ${r.to_city_name || r.to_city}` },
                                        { key: "fee", label: "Fee", sortable: true, align: "right", width: 120, render: (v) => <span className="admin-currency">₹{parseFloat(v).toLocaleString("en-IN")}</span> },
                                    ]}
                                    data={cityPairFees}
                                    searchable={false}
                                    emptyIcon="💸"
                                    emptyMessage="No city pair fees yet."
                                    pageSize={15}
                                    extraActions={[{ label: "✕ Delete", className: "dt-action-btn--danger", onClick: (row) => handleDeleteCityPairFee(row.id) }]}
                                />
                            </SectionCard>
                        </div>
                    )}

                    {!loading && tab === "logistics" && (
                        <div className="admin-section">
                            {logisticsStats && (
                                <div className="admin-stats-row">
                                    {[
                                        ["🕐", "Expected", logisticsStats.expected, "#D97706"],
                                        ["📥", "Received", logisticsStats.received, "#1D4ED8"],
                                        ["🔒", "Held", logisticsStats.held, "#D97706"],
                                        ["🟢", "Sub-listed", logisticsStats.sublisted, "#059669"],
                                        ["🤝", "Network", logisticsStats.network_vendors, "#7C3AED"],
                                        ["📍", "Ret. Points", logisticsStats.return_points, "#0DB89E"],
                                    ].map(([icon, label, val, color]) => (
                                        <div key={label} className="admin-mini-stat" style={{ borderColor: color + "50" }}>
                                            <span>{icon}</span>
                                            <span style={{ color, fontWeight: 800, fontSize: 17 }}>{val ?? 0}</span>
                                            <span style={{ fontSize: 10 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <SectionCard title="Return Points" subtitle="Designated drop-off points for one-way returns.">
                                <InlineForm
                                    fields={[
                                        { key: "name", label: "Name", required: true },
                                        { key: "city", label: "City", type: "select", required: true, options: cities.map((c) => ({ value: c.id, label: c.name })) },
                                        { key: "point_type", label: "Type", type: "select", required: true, options: [{ value: "partner_vendor", label: "Partner Vendor Lot" }, { value: "parking", label: "Paid Parking" }] },
                                        { key: "address", label: "Address" },
                                    ]}
                                    onSubmit={handleAddReturnPoint}
                                    submitLabel="+ Add Return Point"
                                    loading={formLoading}
                                />
                            </SectionCard>
                            <DataTable
                                columns={handoverColumns}
                                data={handovers}
                                searchable
                                searchKeys={["vehicle_display", "booking_ref", "originating_vendor_name"]}
                                searchPlaceholder="Search handovers…"
                                filters={[{
                                    key: "status", label: "Status", colorMap: HANDOVER_STATUS_CLR,
                                    options: [{ value: "", label: "All" }, { value: "EXPECTED", label: "Expected" }, { value: "RECEIVED", label: "Received" }, { value: "HELD", label: "Held" }, { value: "SUBLISTED", label: "Sublisted" }],
                                }]}
                                emptyIcon="🔄"
                                emptyMessage="No active handovers."
                                pageSize={15}
                            />
                            {network.length > 0 && (
                                <SectionCard title="Vendor Network">
                                    <DataTable
                                        columns={[
                                            { key: "business_name", label: "Vendor", sortable: true },
                                            { key: "city_name", label: "City", sortable: true, width: 120 },
                                            { key: "max_vehicles", label: "Max", sortable: true, width: 70, align: "center" },
                                            { key: "current_held_count", label: "Held", sortable: true, width: 70, align: "center", render: (v, row) => <span className={`admin-badge ${v >= row.max_vehicles ? "admin-badge--red" : "admin-badge--blue"}`}>{v}/{row.max_vehicles}</span> },
                                            { key: "is_active", label: "Status", sortable: true, width: 90, render: (v) => <span className={`admin-badge ${v ? "admin-badge--green" : "admin-badge--gray"}`}>{v ? "Active" : "Inactive"}</span> },
                                        ]}
                                        data={network}
                                        searchable={false}
                                        emptyIcon="🤝"
                                        emptyMessage="No network vendors."
                                        pageSize={10}
                                    />
                                </SectionCard>
                            )}
                        </div>
                    )}

                    {!loading && tab === "config" && (
                        <div className="admin-section">
                            <SectionCard title="Platform Configuration" subtitle="Live settings — changes affect all future bookings immediately.">
                                <div className="admin-config-notice">⚠ These are live settings. Changes take effect immediately.</div>
                                <div className="admin-config-list">
                                    {configs.map((c) => (
                                        <div key={c.id} className="admin-config-row">
                                            <div className="admin-config-info">
                                                <strong>{c.display_name}</strong>
                                                <span>{c.description}</span>
                                                <code>{c.key} <span className="admin-type-chip">{c.value_type}</span></code>
                                            </div>
                                            <div className="admin-config-edit">
                                                {c.is_editable ? (
                                                    <>
                                                        <input value={c.value} onChange={(e) => setConfigs((p) => p.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} />
                                                        <button className="admin-btn admin-btn--success admin-btn--sm" onClick={() => handleConfigSave(c)}>Save</button>
                                                    </>
                                                ) : (
                                                    <span className="admin-config-locked">🔒 {c.value}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                            <SectionCard title="Vehicle Segment Configuration">
                                <div className="admin-segment-grid">
                                    {segments.map((seg) => (
                                        <div key={seg.id} className="admin-segment-card">
                                            <div className="admin-segment-card__header"><strong>{seg.display_name}</strong></div>
                                            <div className="admin-segment-card__fields">
                                                {[["Security Deposit (₹)", "security_deposit"], ["Min Driver Age", "min_driver_age"], ["Min Rental Days", "min_rental_days"]].map(([lbl, field]) => (
                                                    <div key={field} className="admin-form-field">
                                                        <label>{lbl}</label>
                                                        <input type="number" value={seg[field]} onChange={(e) => setSegments((p) => p.map((x) => x.id === seg.id ? { ...x, [field]: e.target.value } : x))} />
                                                    </div>
                                                ))}
                                            </div>
                                            <button className="admin-btn admin-btn--success admin-btn--sm admin-segment-save" onClick={() => handleSegmentSave(seg)}>Save Changes</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    )}

                    {!loading && tab === "promos" && (
                        <div className="admin-section">
                            <SectionCard title="Create Promo Code">
                                <InlineForm
                                    fields={[
                                        { key: "code", label: "Code", required: true, placeholder: "FIRST50" },
                                        { key: "discount_type", label: "Type", type: "select", required: true, default: "flat", options: [{ value: "flat", label: "Flat (₹)" }, { value: "percentage", label: "Percentage (%)" }] },
                                        { key: "discount_value", label: "Discount", type: "number", required: true },
                                        { key: "max_uses", label: "Max Uses", type: "number" },
                                        { key: "valid_from", label: "Valid From", type: "datetime-local", required: true },
                                        { key: "valid_until", label: "Valid Until", type: "datetime-local", required: true },
                                    ]}
                                    onSubmit={handleAddPromo}
                                    submitLabel="+ Create Promo"
                                    loading={formLoading}
                                />
                            </SectionCard>
                            <DataTable
                                columns={[
                                    { key: "code", label: "Code", sortable: true, render: (v) => <span className="dt-mono">{v}</span> },
                                    { key: "discount_type", label: "Type", sortable: true, width: 120, render: (_, row) => row.discount_type === "flat" ? `₹${row.discount_value} off` : `${row.discount_value}% off` },
                                    { key: "redemption_count", label: "Used", sortable: true, width: 90, align: "center", render: (v, row) => `${v || row.times_used || 0} / ${row.max_redemptions || row.max_uses || "∞"}` },
                                    { key: "valid_from", label: "From", sortable: true, width: 110, render: (v) => v?.slice(0, 10) || "—" },
                                    { key: "valid_until", label: "Until", sortable: true, width: 110, render: (v) => v?.slice(0, 10) || "—" },
                                ]}
                                data={promos}
                                searchable
                                searchKeys={["code"]}
                                searchPlaceholder="Search promo codes…"
                                emptyIcon="🎁"
                                emptyMessage="No promo codes yet."
                                pageSize={15}
                                extraActions={[{ label: "✕ Delete", className: "dt-action-btn--danger", onClick: (row) => handleDeletePromo(row.id) }]}
                            />
                        </div>
                    )}

                    {!loading && tab === "agreements" && (
                        <div className="admin-section">
                            <SectionCard
                                title="Agreement Versions"
                                subtitle="Only one version can be active at a time."
                                action={
                                    <button className="admin-btn admin-btn--primary" onClick={() => { setShowCreateAgreement((v) => !v); setEditingVersion(null); }}>
                                        {showCreateAgreement ? "✕ Cancel" : "+ New Version"}
                                    </button>
                                }
                            >
                                {showCreateAgreement && (
                                    <form onSubmit={handleCreateAgreement} style={{ background: "#F8FAFB", border: "1px solid #E8EDF2", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "#0DB89E" }}>New Draft Version</div>
                                        <div className="admin-inline-form">
                                            <div className="admin-form-field">
                                                <label>Version Tag *</label>
                                                <input type="text" placeholder="e.g. v2.0" value={agreementForm.version_tag} onChange={(e) => setAgreementForm((p) => ({ ...p, version_tag: e.target.value }))} required />
                                            </div>
                                            <div className="admin-form-field">
                                                <label>Title</label>
                                                <input type="text" value={agreementForm.title} onChange={(e) => setAgreementForm((p) => ({ ...p, title: e.target.value }))} />
                                            </div>
                                            <div className="admin-form-field">
                                                <label>Effective From</label>
                                                <input type="datetime-local" value={agreementForm.effective_from} onChange={(e) => setAgreementForm((p) => ({ ...p, effective_from: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Summary</label>
                                            <input type="text" value={agreementForm.summary} onChange={(e) => setAgreementForm((p) => ({ ...p, summary: e.target.value }))} />
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Content * (Markdown)</label>
                                            <textarea rows={10} value={agreementForm.content} required onChange={(e) => setAgreementForm((p) => ({ ...p, content: e.target.value }))} style={{ background: "#fff", border: "1px solid #D5DEE8", borderRadius: 8, color: "#111827", padding: "10px 12px", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "DM Mono,monospace", width: "100%", boxSizing: "border-box" }} />
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>{agreementFormLoading ? "…" : "+ Create Draft"}</button>
                                            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setShowCreateAgreement(false)}>Cancel</button>
                                        </div>
                                    </form>
                                )}

                                {editingVersion && (
                                    <form onSubmit={handleUpdateAgreement} style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#D97706" }}>Editing {editingVersion.version_tag}</div>
                                        <div className="admin-form-field">
                                            <label>Title</label>
                                            <input type="text" value={editingVersion.title} onChange={(e) => setEditingVersion((p) => ({ ...p, title: e.target.value }))} />
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Summary</label>
                                            <input type="text" value={editingVersion.summary || ""} onChange={(e) => setEditingVersion((p) => ({ ...p, summary: e.target.value }))} />
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Content</label>
                                            <textarea rows={10} value={editingVersion.content} onChange={(e) => setEditingVersion((p) => ({ ...p, content: e.target.value }))} style={{ background: "#fff", border: "1px solid #D5DEE8", borderRadius: 8, color: "#111827", padding: "10px 12px", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "DM Mono,monospace", width: "100%", boxSizing: "border-box" }} />
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>{agreementFormLoading ? "…" : "Save Changes"}</button>
                                            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditingVersion(null)}>Cancel</button>
                                        </div>
                                    </form>
                                )}

                                <div className="admin-card-list">
                                    {agreements.map((v) => (
                                        <div key={v.id} style={{ background: v.is_active ? "#E6F7F5" : "#F8FAFB", border: `1px solid ${v.is_active ? "rgba(13,184,158,.35)" : "#E8EDF2"}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                                                    <span style={{ fontFamily: "DM Mono,monospace", fontSize: 14, fontWeight: 700, color: v.is_active ? "#0A9E87" : "#111827" }}>{v.version_tag}</span>
                                                    {v.is_active && <span style={{ background: "#0DB89E", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>LIVE</span>}
                                                    <span style={{ background: v.acceptance_count > 0 ? "#DBEAFE" : "#F3F4F6", color: v.acceptance_count > 0 ? "#1D4ED8" : "#6B7280", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{v.acceptance_count} signed</span>
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{v.title}</div>
                                                {v.summary && <div style={{ fontSize: 12, color: "#6B7280", maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.summary}</div>}
                                            </div>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                {!v.is_active && <button className="admin-btn admin-btn--success" onClick={() => handleActivateAgreement(v.id, v.version_tag)}>✓ Activate</button>}
                                                <button className="admin-btn admin-btn--ghost" onClick={() => { setEditingVersion({ ...v }); setShowCreateAgreement(false); }}>✏ Edit</button>
                                            </div>
                                        </div>
                                    ))}
                                    {agreements.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: "var(--vm)", fontSize: 13 }}>No agreement versions yet.</div>}
                                </div>
                            </SectionCard>

                            <SectionCard title="Acceptance Audit Log" subtitle="Immutable record of every customer who signed.">
                                <DataTable
                                    columns={acceptanceColumns}
                                    data={acceptances}
                                    searchable
                                    searchKeys={["user_name", "user_email", "booking_ref", "version_tag"]}
                                    searchPlaceholder="Search by user, booking ref, version…"
                                    filters={[{
                                        key: "agreement_version_id", label: "Version",
                                        options: [{ value: "", label: "All Versions" }, ...agreements.map((v) => ({ value: String(v.id), label: `${v.version_tag} (${v.acceptance_count})` }))],
                                    }]}
                                    emptyIcon="📋"
                                    emptyMessage="No acceptances found."
                                    pageSize={25}
                                />
                            </SectionCard>
                        </div>
                    )}

                    {!loading && tab === "reviews" && (
                        <div className="admin-section">
                            <div className="cd-filter-bar cd-filter-bar--dropdown" style={{ gap: 12 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--vm)" }}>Vendor</label>
                                    <select
                                        className="admin-search-input"
                                        style={{ width: 260, height: 36, cursor: "pointer" }}
                                        value={selectedReviewVendorId}
                                        onChange={async (e) => {
                                            const id = e.target.value;
                                            setSelectedReviewVendorId(id);
                                            setReviewsLoading(true);
                                            try {
                                                const { data } = await fetchVendorReviews(id, reviewOrdering);
                                                setReviews(data.results || data);
                                            } catch { setReviews([]); }
                                            finally { setReviewsLoading(false); }
                                        }}
                                    >
                                        <option value="">— Select a vendor —</option>
                                        {reviewVendors.map((v) => (
                                            <option key={v.id} value={v.user}>{v.business_name}{v.rating > 0 ? ` (★ ${v.rating})` : ""}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--vm)" }}>Sort</label>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        {[["recency", "🕐 Newest"], ["rating", "★ Rating"]].map(([val, lbl]) => (
                                            <button key={val}
                                                className={`admin-btn admin-btn--sm ${reviewOrdering === val ? "admin-btn--primary" : "admin-btn--ghost"}`}
                                                onClick={async () => {
                                                    setReviewOrdering(val);
                                                    if (!selectedReviewVendorId) return;
                                                    setReviewsLoading(true);
                                                    try {
                                                        const { data } = await fetchVendorReviews(selectedReviewVendorId, val);
                                                        setReviews(data.results || data);
                                                    } catch { setReviews([]); }
                                                    finally { setReviewsLoading(false); }
                                                }}
                                            >{lbl}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {!selectedReviewVendorId ? (
                                <div className="admin-empty"><span>⭐</span><p>Select a vendor above to view their customer reviews.</p></div>
                            ) : reviewsLoading ? (
                                <div className="admin-loading"><div className="admin-loading__spinner" />Loading reviews…</div>
                            ) : (
                                <DataTable
                                    columns={reviewColumns}
                                    data={reviews}
                                    searchable
                                    searchKeys={["customer_name", "vehicle_display", "review_text"]}
                                    searchPlaceholder="Search reviews…"
                                    filters={[{ key: "vendor_rating", label: "Rating", options: [{ value: "", label: "All Ratings" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ★` }))] }]}
                                    onRowAction={(row) => setSelectedReview(row)}
                                    actionLabel="View Review"
                                    emptyIcon="💬"
                                    emptyMessage="No reviews for this vendor."
                                    pageSize={20}
                                />
                            )}
                        </div>
                    )}

                    {tab === "assignments" && (
                        <div className="admin-section">
                            <AssignmentsTab myProfile={myProfile} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}