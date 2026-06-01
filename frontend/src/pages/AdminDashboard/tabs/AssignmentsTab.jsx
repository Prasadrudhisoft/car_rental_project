// ─────────────────────────────────────────────────────────────────────────────
// AssignmentsTab.jsx
// Superadmin: full vendor-admin assignment management (matrix + table view).
// Assigned admin: read-only list of their assigned vendors.
//
// Three assignment methods:
//   1. Per-row dropdown  → assignVendorToAdmin()
//   2. Checkbox bulk     → bulkAssignVendors()
//   3. Drag-and-drop     → assignVendorToAdmin()
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
    getAdminList,
    getAdminVendors,
    getAllAssignments,
    assignVendorToAdmin,
    bulkAssignVendors,
    unassignVendor,
    getAssignmentHistory,
} from "../../../services/api";
import DataTable from "../../../components/common/DataTable";
import AdminAssignmentCard from "../AdminAssignmentCard";
import { StatusBadge } from "../AdminShared";
import {
    VENDOR_STATUS_CLR,
    fmtDate,
    fmtDatetime,
    getVendorPK,
    getAdminPK,
} from "../adminConstants";

export default function AssignmentsTab({ myProfile }) {
    const isSuperAdmin = myProfile?.scope === "superadmin";

    // ── Data ──────────────────────────────────────────────────────────────────
    const [admins,      setAdmins]      = useState([]);
    const [vendors,     setVendors]     = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [busy,        setBusy]        = useState(false);
    const [error,       setError]       = useState("");

    // ── Selection — plain object { [vendorPK]: true } avoids Set/React pitfalls
    const [selectedMap,  setSelectedMap]  = useState({});
    const [bulkAdminPK,  setBulkAdminPK]  = useState("");
    const [pickAdminMap, setPickAdminMap] = useState({});  // { [vendorPK]: adminPK string }

    // ── UI ────────────────────────────────────────────────────────────────────
    const [searchQ,    setSearchQ]    = useState("");
    const [historyV,   setHistoryV]   = useState(null);
    const [historyData,setHistoryData]= useState([]);
    const [viewMode,   setViewMode]   = useState("matrix");

    const selectedCount = Object.keys(selectedMap).length;

    // ── Load ──────────────────────────────────────────────────────────────────
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
            setSelectedMap({});
            setBulkAdminPK("");
        } catch (e) {
            setError(e.response?.data?.detail || e.message || "Failed to load.");
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const assignedPKs = new Set(
        assignments
            .filter((a) => a.is_active)
            .map((a) => Number(a.vendor))
            .filter(Boolean),
    );

    const unassigned = vendors.filter((v) => {
        const pk = getVendorPK(v);
        if (pk == null) return true;   // fail-open: show as unassigned if PK unknown
        return !assignedPKs.has(pk);
    });

    const filteredUnassigned = unassigned.filter(
        (v) =>
            !searchQ ||
            v.business_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
            (v.email ?? "").toLowerCase().includes(searchQ.toLowerCase()),
    );

    // ── Checkbox helpers ──────────────────────────────────────────────────────
    const toggleVendor = (vpk) => {
        if (vpk == null) return;
        const key = String(vpk);
        setSelectedMap((prev) => {
            const next = { ...prev };
            next[key] ? delete next[key] : (next[key] = true);
            return next;
        });
    };

    const selectAll = () => {
        const next = {};
        filteredUnassigned.forEach((v) => {
            const pk = getVendorPK(v);
            if (pk != null) next[String(pk)] = true;
        });
        setSelectedMap(next);
    };

    const clearSelection = () => { setSelectedMap({}); setBulkAdminPK(""); };

    const isSelected = (v) => {
        const pk = getVendorPK(v);
        return pk != null && Boolean(selectedMap[String(pk)]);
    };

    // ── Per-row dropdown helpers ──────────────────────────────────────────────
    const getPickAdmin  = (v)       => pickAdminMap[String(getVendorPK(v))] ?? "";
    const setPickAdmin  = (v, val)  => setPickAdminMap((p) => ({ ...p, [String(getVendorPK(v))]: val }));
    const clearPickAdmin = (v)      => setPickAdminMap((p) => { const n = { ...p }; delete n[String(getVendorPK(v))]; return n; });

    // ── API actions ───────────────────────────────────────────────────────────
    const handleAssign = async (vendorPKs, adminPK) => {
        const validPKs = vendorPKs.filter((pk) => pk != null && !isNaN(pk) && pk > 0);
        if (!validPKs.length || !adminPK) return;
        setBusy(true);
        try {
            if (validPKs.length === 1) await assignVendorToAdmin(validPKs[0], adminPK);
            else                       await bulkAssignVendors(validPKs, adminPK);
            clearSelection();
            await load();
        } catch (e) {
            alert(e.response?.data?.error || e.response?.data?.detail || "Assignment failed.");
        }
        setBusy(false);
    };

    const handleUnassign = async (vpk) => {
        if (!window.confirm("Remove this vendor assignment?")) return;
        setBusy(true);
        try {
            await unassignVendor(vpk);
            await load();
        } catch (e) {
            alert(e.response?.data?.error || "Failed.");
        }
        setBusy(false);
    };

    const handleDrop = (e, adminPK) => {
        e.preventDefault();
        try {
            const { vendorPK } = JSON.parse(e.dataTransfer.getData("application/json"));
            if (vendorPK && adminPK) handleAssign([Number(vendorPK)], adminPK);
        } catch { /* ignore bad drag data */ }
    };

    const showHistory = async (v) => {
        setHistoryV(v);
        try {
            const r = await getAssignmentHistory(getVendorPK(v));
            setHistoryData(r.data);
        } catch { setHistoryData([]); }
    };

    // ── Table view columns ────────────────────────────────────────────────────
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
        { key: "assigned_at",      label: "Since",  sortable: true, width: 120, render: (v) => fmtDate(v)    },
        { key: "assigned_by_name", label: "By",     sortable: true, width: 130, render: (v) => v || "—"      },
        {
            key: "is_active", label: "Status", sortable: true, width: 90,
            render: (v) => (
                <span className="admin-status-badge admin-status-badge--sm" style={
                    v ? { background: "#D1FAE5", color: "#059669", border: "1px solid #6EE7B740" }
                      : { background: "#F3F4F6", color: "#9CA3AF", border: "1px solid #E5E7EB"  }
                }>
                    {v ? "● Active" : "○ Ended"}
                </span>
            ),
        },
    ];

    // ── Non-superadmin view (read-only) ───────────────────────────────────────
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
                        {vendors.filter((v) => assignedPKs.has(getVendorPK(v))).map((v) => (
                            <div key={v.id} style={{ background: "var(--vs)", border: "1px solid var(--vbdr)", borderRadius: 12, padding: "14px 16px" }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{v.business_name}</div>
                                <div style={{ fontSize: 11, color: "var(--vt2)", marginTop: 4 }}>{v.email}</div>
                                <div style={{ marginTop: 6 }}><StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} /></div>
                            </div>
                        ))}
                        {vendors.filter((v) => assignedPKs.has(getVendorPK(v))).length === 0 && (
                            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--vm)", fontSize: 13 }}>
                                No vendors assigned yet. Contact a superadmin.
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Superadmin view ───────────────────────────────────────────────────────
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Vendor–Admin Assignments</h3>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--vm)" }}>
                        ① Tick checkboxes → bulk-assign bar &nbsp;·&nbsp; ② Drag onto admin card &nbsp;·&nbsp; ③ Per-row dropdown
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)", color: "#92400E", border: "1px solid #FCD34D" }}>
                        👑 Super Admin
                    </span>
                    <div style={{ display: "flex", border: "1px solid var(--vbdr2)", borderRadius: 8, overflow: "hidden" }}>
                        {[["matrix", "⊞ Matrix"], ["table", "≡ Table"]].map(([m, lbl]) => (
                            <button key={m} onClick={() => setViewMode(m)} style={{ padding: "6px 13px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "Inter,sans-serif", borderRight: m === "matrix" ? "1px solid var(--vbdr2)" : "none", background: viewMode === m ? "var(--teal-primary)" : "var(--vs2)", color: viewMode === m ? "#fff" : "var(--vm)" }}>
                                {lbl}
                            </button>
                        ))}
                    </div>
                    <button onClick={load} disabled={busy} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--vbdr2)", background: "var(--vs2)", color: "var(--vt2)", cursor: "pointer", fontFamily: "Inter,sans-serif" }}>
                        ↺ Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#B91C1C", padding: "10px 16px", borderRadius: 10, fontSize: 13 }}>⚠ {error}</div>
            )}

            {/* KPI strip */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                    ["👥", "Admins",     admins.length,                      "#1D4ED8"],
                    ["🏪", "Vendors",    vendors.length,                     "#0DB89E"],
                    ["✅", "Assigned",   vendors.length - unassigned.length, "#059669"],
                    ["⚠️","Unassigned",  unassigned.length,                  unassigned.length > 0 ? "#D97706" : "#9CA3AF"],
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
                    {/* Admin cards grid */}
                    <div className="admin-section-card">
                        <div className="admin-section-card__header">
                            <div>
                                <h3>Admin Assignment Map</h3>
                                <p>Drag vendors from the list below onto a card, or use the per-row dropdown.</p>
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
                            {admins.map((admin) => (
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
                                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--vm)", fontSize: 13 }}>No admin accounts found.</div>
                            )}
                        </div>
                    </div>

                    {/* Unassigned vendors panel */}
                    {unassigned.length > 0 && (
                        <div className="admin-section-card">
                            <div className="admin-section-card__header">
                                <div>
                                    <h3>⚠ Unassigned Vendors ({unassigned.length})</h3>
                                    <p>Tick checkboxes to bulk-assign, drag onto a card above, or use the per-row dropdown.</p>
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
                                onChange={(e) => setSearchQ(e.target.value)}
                                style={{ background: "var(--vs2)", border: "1px solid var(--vbdr2)", borderRadius: 8, color: "var(--vt)", padding: "7px 12px", fontSize: 12, outline: "none", fontFamily: "Inter,sans-serif", maxWidth: 320, transition: "border-color .14s" }}
                            />

                            {/* Bulk-assign toolbar — visible when ≥1 vendor selected */}
                            {selectedCount > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--teal-light)", border: "1px solid rgba(13,184,158,.35)", borderRadius: 10, padding: "10px 14px" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-dark)", whiteSpace: "nowrap" }}>
                                        📦 {selectedCount} vendor{selectedCount !== 1 ? "s" : ""} selected
                                    </span>
                                    <select
                                        value={bulkAdminPK}
                                        onChange={(e) => setBulkAdminPK(e.target.value)}
                                        style={{ background: "var(--vs)", border: "1px solid var(--vbdr2)", borderRadius: 8, color: "var(--vt)", padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: "Inter,sans-serif", flex: 1, minWidth: 180, cursor: "pointer" }}
                                    >
                                        <option value="">— Assign all selected to… —</option>
                                        {admins.map((a) => (
                                            <option key={a.id} value={String(getAdminPK(a))}>
                                                {a.full_name || a.email}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        disabled={!bulkAdminPK || busy}
                                        onClick={() => {
                                            const pks = Object.keys(selectedMap).map(Number).filter((pk) => !isNaN(pk) && pk > 0);
                                            handleAssign(pks, Number(bulkAdminPK));
                                        }}
                                        style={{ background: bulkAdminPK ? "var(--teal-primary)" : "#9CA3AF", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: bulkAdminPK ? "pointer" : "not-allowed", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap", transition: "background .14s" }}
                                    >
                                        {busy ? "…" : `Assign ${selectedCount} →`}
                                    </button>
                                    <button onClick={clearSelection} style={{ padding: "6px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid rgba(13,184,158,.4)", background: "transparent", color: "var(--teal-dark)", cursor: "pointer", fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}>
                                        ✕ Deselect
                                    </button>
                                </div>
                            )}

                            {/* Vendor rows */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto" }}>
                                {filteredUnassigned.map((v) => {
                                    const vpk  = getVendorPK(v);
                                    const sel  = isSelected(v);
                                    const pick = getPickAdmin(v);
                                    return (
                                        <div
                                            key={v.id}
                                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: sel ? "var(--teal-light)" : "var(--vs)", border: `1px solid ${sel ? "var(--teal-primary)" : "var(--vbdr)"}`, borderRadius: 10, flexWrap: "wrap", transition: "all .14s" }}
                                        >
                                            {/* Method 2: checkbox */}
                                            <input
                                                type="checkbox"
                                                checked={sel}
                                                onChange={() => toggleVendor(vpk)}
                                                style={{ width: 15, height: 15, accentColor: "var(--teal-primary)", flexShrink: 0, cursor: "pointer" }}
                                            />

                                            {/* Method 3: drag handle */}
                                            <div
                                                draggable
                                                onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({ vendorPK: vpk }))}
                                                style={{ fontSize: 18, color: "var(--vm)", cursor: "grab", userSelect: "none", flexShrink: 0, lineHeight: 1 }}
                                                title="Drag to assign"
                                            >⠿</div>

                                            {/* Vendor info */}
                                            <div style={{ flex: 1, minWidth: 120 }}>
                                                <strong style={{ fontSize: 13, fontWeight: 700, display: "block" }}>{v.business_name}</strong>
                                                <span style={{ fontSize: 11, color: "var(--vt2)" }}>{v.email}{v.city_name ? ` · ${v.city_name}` : ""}</span>
                                            </div>

                                            <StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} />

                                            {/* Method 1: per-row dropdown */}
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                <select
                                                    value={pick}
                                                    onChange={(e) => setPickAdmin(v, e.target.value)}
                                                    style={{ background: "var(--vs2)", border: "1px solid var(--vbdr2)", borderRadius: 7, color: "var(--vt)", padding: "5px 8px", fontSize: 12, outline: "none", fontFamily: "Inter,sans-serif", minWidth: 160, cursor: "pointer" }}
                                                >
                                                    <option value="">— Assign to admin —</option>
                                                    {admins.map((a) => (
                                                        <option key={a.id} value={String(getAdminPK(a))}>
                                                            {a.full_name || a.email}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    disabled={!pick || busy}
                                                    onClick={() => { handleAssign([vpk], Number(pick)); clearPickAdmin(v); }}
                                                    style={{ background: pick ? "var(--teal-primary)" : "#9CA3AF", color: "#fff", border: "none", borderRadius: 7, padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: pick ? "pointer" : "not-allowed", opacity: pick ? 1 : 0.4, fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}
                                                >
                                                    {busy ? "…" : "Assign"}
                                                </button>
                                            </div>

                                            {/* History */}
                                            <button onClick={() => showHistory(v)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid var(--vbdr2)", background: "var(--vs2)", color: "var(--vt2)", cursor: "pointer", fontFamily: "Inter,sans-serif", flexShrink: 0 }}>
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
                /* Table view */
                <DataTable
                    columns={asgCols}
                    data={assignments}
                    searchable
                    searchKeys={["vendor_business", "vendor_email", "admin_name", "admin_email"]}
                    searchPlaceholder="Search by vendor or admin…"
                    filters={[{ key: "is_active", label: "Status", options: [{ value: "", label: "All" }, { value: "true", label: "Active" }, { value: "false", label: "Ended" }] }]}
                    extraActions={[
                        { label: "📋 History", className: "dt-action-btn--secondary", onClick: (row) => showHistory({ id: row.id, user_id: row.vendor, business_name: row.vendor_business }) },
                        { label: "✕ Remove",  className: "dt-action-btn--danger",    show: (row) => row.is_active, onClick: (row) => handleUnassign(Number(row.vendor)) },
                    ]}
                    emptyIcon="🔗"
                    emptyMessage="No assignments found."
                    pageSize={25}
                />
            )}

            {/* History modal */}
            {historyV && (
                <div className="admin-modal-overlay" onClick={() => setHistoryV(null)}>
                    <div className="admin-modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal__head">
                            <div>
                                <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 800 }}>Assignment History</h3>
                                <p style={{ margin: 0, fontSize: 12, color: "var(--vm)" }}>{historyV.business_name || historyV.vendor_business || "Vendor"}</p>
                            </div>
                            <button onClick={() => setHistoryV(null)} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: "var(--vm)", fontFamily: "Inter,sans-serif" }}>✕ Close</button>
                        </div>
                        <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {historyData.length === 0 ? (
                                <p style={{ textAlign: "center", color: "var(--vm)", fontSize: 13, fontStyle: "italic", padding: "20px 0" }}>No history found.</p>
                            ) : historyData.map((h) => (
                                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, padding: "11px 14px", background: h.is_active ? "var(--teal-light)" : "var(--vs2)", border: `1px solid ${h.is_active ? "var(--teal-primary)" : "var(--vbdr)"}`, borderRadius: 10, flexWrap: "wrap" }}>
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
