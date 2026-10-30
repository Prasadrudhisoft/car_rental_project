// ─────────────────────────────────────────────────────────────────────────────
// AdminAssignmentCard.jsx
// Drag-drop target card for a single admin. Shows assigned vendor chips
// with an unassign (✕) button on each chip.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { StatusBadge } from "./AdminShared";
import { VENDOR_STATUS_CLR, getVendorPK, getAdminPK } from "./adminConstants";

export default function AdminAssignmentCard({
    admin,
    assignments,
    vendors,
    onUnassign,
    onDrop,
}) {
    const [dragOver, setDragOver] = useState(false);

    const adminPK = getAdminPK(admin);

    // Build the set of vendor User PKs currently assigned to this admin
    const myVendorPKs = new Set(
        assignments
            .filter((a) => a.is_active && Number(a.admin) === adminPK)
            .map((a) => Number(a.vendor))
            .filter(Boolean),
    );

    const myVendors = vendors.filter((v) => {
        const pk = getVendorPK(v);
        return pk != null && myVendorPKs.has(pk);
    });

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { setDragOver(false); onDrop(e, adminPK); }}
            style={{
                background:   dragOver ? "var(--teal-light)" : "var(--vs2)",
                border:       `2px dashed ${dragOver ? "var(--teal-primary)" : "var(--vbdr)"}`,
                borderRadius: 12,
                padding:      14,
                display:      "flex",
                flexDirection: "column",
                gap:          10,
                minHeight:    140,
                transition:   "all .18s",
                boxShadow:    dragOver ? "0 0 0 3px rgba(13,184,158,.15)" : "none",
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
                        {admin.scope === "superadmin" ? "👑 Super Admin" : "🎯 Assigned Admin"}
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
                    myVendors.map((vendor) => {
                        const vpk = getVendorPK(vendor);
                        return (
                            <div
                                key={vendor.id}
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "4px 10px 4px 8px",
                                    background: "var(--vs)", border: "1px solid var(--vbdr)",
                                    borderRadius: 999, fontSize: 11, fontWeight: 600, color: "var(--vt2)",
                                }}
                            >
                                <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {vendor.business_name}
                                </span>
                                <StatusBadge status={vendor.status} colorMap={VENDOR_STATUS_CLR} size="sm" />
                                <button
                                    onClick={() => onUnassign(vpk)}
                                    style={{ background: "none", border: "none", color: "#EF4444", fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1, opacity: 0.7, fontFamily: 'inherit' }}
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
