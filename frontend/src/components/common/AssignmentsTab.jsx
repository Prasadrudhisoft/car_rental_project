import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    getAdminList,
    getAdminVendors,
    getAllAssignments,
    getAssignmentHistory,
    assignVendorToAdmin,
    unassignVendor,
    bulkAssignVendors,
    getMyAdminProfile,
    updateMyAdminProfile,
} from '../../services/api';
import DataTable from './DataTable';
import './AssignmentsTab.css';

// ── Helpers ────────────────────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}
function fmtDatetime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

const VENDOR_STATUS_CLR = {
    approved:  { bg: '#D1FAE5', color: '#059669' },
    pending:   { bg: '#FEF3C7', color: '#D97706' },
    rejected:  { bg: '#FEE2E2', color: '#B91C1C' },
    suspended: { bg: '#FEE2E2', color: '#EF4444' },
    more_info: { bg: '#EDE9FE', color: '#7C3AED' },
};

function StatusBadge({ status, map }) {
    const s = map?.[status] || { bg: '#F3F4F6', color: '#6B7280' };
    return (
        <span className="asgn-badge" style={{ background: s.bg, color: s.color, borderColor: s.color + '40' }}>
            {status?.replace(/_/g, ' ')}
        </span>
    );
}

// ── Scope pill ─────────────────────────────────────────────────────────
function ScopePill({ scope }) {
    const isSuper = scope === 'superadmin';
    return (
        <span className={`asgn-scope-pill ${isSuper ? 'asgn-scope-pill--super' : 'asgn-scope-pill--assigned'}`}>
            {isSuper ? '👑 Super Admin' : '🎯 Assigned Admin'}
        </span>
    );
}

// ── Admin Card ─────────────────────────────────────────────────────────
function AdminCard({ admin, assignments, vendors, onDrop, onAssign, onUnassign, isSelected, onSelect, selectedVendors }) {
    const [dragOver, setDragOver] = useState(false);
    const myVendorIds = new Set(
        assignments.filter(a => a.admin === admin.user_id || a.admin_email === admin.email).map(a => a.vendor)
    );
    const myVendors = vendors.filter(v => myVendorIds.has(v.user));

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        onDrop(data.vendorId, admin.user_id);
    };

    return (
        <div
            className={`asgn-admin-card ${dragOver ? 'asgn-admin-card--drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
        >
            {/* Card header */}
            <div className="asgn-admin-card__head">
                <div className="asgn-admin-card__avatar">
                    {(admin.full_name || admin.email || 'A')[0].toUpperCase()}
                </div>
                <div className="asgn-admin-card__info">
                    <strong>{admin.full_name || admin.email}</strong>
                    <span>{admin.email}</span>
                </div>
                <div className="asgn-admin-card__badges">
                    <ScopePill scope={admin.scope} />
                    <span className="asgn-vendor-count">
                        {myVendors.length} vendor{myVendors.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Bulk-assign button when vendors are selected */}
            {selectedVendors.length > 0 && (
                <button
                    className="asgn-bulk-assign-btn"
                    onClick={() => onAssign(selectedVendors, admin.user_id)}
                >
                    ＋ Assign {selectedVendors.length} selected vendor{selectedVendors.length !== 1 ? 's' : ''} here
                </button>
            )}

            {/* Vendor chips */}
            <div className="asgn-vendor-chips">
                {myVendors.length === 0 ? (
                    <div className="asgn-empty-chips">
                        {dragOver ? '📥 Drop vendor here' : 'No vendors assigned — drag one here'}
                    </div>
                ) : (
                    myVendors.map(v => (
                        <div key={v.id} className="asgn-vendor-chip">
                            <span className="asgn-vendor-chip__name">{v.business_name}</span>
                            <StatusBadge status={v.status} map={VENDOR_STATUS_CLR} />
                            <button
                                className="asgn-vendor-chip__remove"
                                title="Remove assignment"
                                onClick={() => onUnassign(v.user)}
                            >✕</button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ── Unassigned Vendor Row ──────────────────────────────────────────────
function UnassignedVendorRow({ vendor, admins, onAssign, isSelected, onToggleSelect }) {
    const [pickAdmin, setPickAdmin] = useState('');
    return (
        <div className={`asgn-unassigned-row ${isSelected ? 'asgn-unassigned-row--selected' : ''}`}>
            <input
                type="checkbox"
                className="asgn-checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(vendor.user)}
            />
            <div
                className="asgn-drag-handle"
                draggable
                onDragStart={e => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ vendorId: vendor.user }));
                }}
                title="Drag to an admin card above"
            >
                ⠿
            </div>
            <div className="asgn-unassigned-row__info">
                <strong>{vendor.business_name}</strong>
                <span>{vendor.email} · {vendor.city_name || '—'}</span>
            </div>
            <StatusBadge status={vendor.status} map={VENDOR_STATUS_CLR} />
            <div className="asgn-quick-assign">
                <select
                    className="asgn-admin-select"
                    value={pickAdmin}
                    onChange={e => setPickAdmin(e.target.value)}
                >
                    <option value="">— Assign to admin —</option>
                    {admins.map(a => (
                        <option key={a.id} value={a.user_id}>{a.full_name || a.email}</option>
                    ))}
                </select>
                <button
                    className="asgn-assign-btn"
                    disabled={!pickAdmin}
                    onClick={() => { onAssign([vendor.user], parseInt(pickAdmin)); setPickAdmin(''); }}
                >
                    Assign
                </button>
            </div>
        </div>
    );
}

// ── History Modal ──────────────────────────────────────────────────────
function HistoryModal({ vendorName, history, onClose }) {
    return (
        <div className="asgn-modal-overlay" onClick={onClose}>
            <div className="asgn-modal" onClick={e => e.stopPropagation()}>
                <div className="asgn-modal__head">
                    <div>
                        <h3>Assignment History</h3>
                        <p>{vendorName}</p>
                    </div>
                    <button onClick={onClose}>✕ Close</button>
                </div>
                <div className="asgn-modal__body">
                    {history.length === 0 ? (
                        <p className="asgn-modal__empty">No assignment history found.</p>
                    ) : history.map(h => (
                        <div key={h.id} className={`asgn-history-row ${h.is_active ? 'asgn-history-row--active' : ''}`}>
                            <div className="asgn-history-row__left">
                                <span className="asgn-history-admin">{h.admin_name || h.admin_email}</span>
                                {h.is_active && <span className="asgn-active-dot">● Active</span>}
                            </div>
                            <div className="asgn-history-row__right">
                                <span>Assigned: {fmtDatetime(h.assigned_at)}</span>
                                {h.deactivated_at && (
                                    <span style={{ color: '#EF4444' }}>Ended: {fmtDatetime(h.deactivated_at)}</span>
                                )}
                                {h.assigned_by_name && (
                                    <span style={{ color: '#9CA3AF' }}>By: {h.assigned_by_name}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Admin Scope Editor ─────────────────────────────────────────────────
function AdminScopeEditor({ admin, onSave, onClose }) {
    const [scope, setScope] = useState(admin.scope);
    const [displayName, setDisplayName] = useState(admin.display_name || '');
    const [notes, setNotes] = useState(admin.notes || '');
    const [busy, setBusy] = useState(false);

    const handleSave = async () => {
        setBusy(true);
        await onSave(admin.id, { scope, display_name: displayName, notes });
        setBusy(false);
        onClose();
    };

    return (
        <div className="asgn-modal-overlay" onClick={onClose}>
            <div className="asgn-modal asgn-modal--sm" onClick={e => e.stopPropagation()}>
                <div className="asgn-modal__head">
                    <div>
                        <h3>Edit Admin Scope</h3>
                        <p>{admin.full_name || admin.email}</p>
                    </div>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className="asgn-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="asgn-form-field">
                        <label>Scope</label>
                        <div className="asgn-scope-options">
                            {[['superadmin', '👑 Super Admin', 'Full platform access — sees all vendors, vehicles, bookings'],
                              ['assigned_admin', '🎯 Assigned Admin', 'Scoped access — only sees their assigned vendors']].map(([val, label, desc]) => (
                                <label key={val} className={`asgn-scope-option ${scope === val ? 'selected' : ''}`}>
                                    <input type="radio" name="scope" value={val} checked={scope === val} onChange={() => setScope(val)} />
                                    <div>
                                        <strong>{label}</strong>
                                        <span>{desc}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="asgn-form-field">
                        <label>Display Name</label>
                        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. South Region Admin" />
                    </div>
                    <div className="asgn-form-field">
                        <label>Notes</label>
                        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes about this admin's responsibilities…" />
                    </div>
                    <div className="asgn-modal__actions">
                        <button className="asgn-save-btn" onClick={handleSave} disabled={busy}>
                            {busy ? '…' : 'Save Changes'}
                        </button>
                        <button className="asgn-cancel-btn" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main AssignmentsTab ────────────────────────────────────────────────
export default function AssignmentsTab({ myProfile }) {
    const isSuperAdmin = myProfile?.scope === 'superadmin';

    const [admins, setAdmins] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    // UI state
    const [selectedVendors, setSelectedVendors] = useState([]);
    const [historyVendor, setHistoryVendor] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'table'
    const [searchVendor, setSearchVendor] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [adminRes, vendorRes, assignRes] = await Promise.all([
                getAdminList(),
                getAdminVendors(),
                getAllAssignments(),
            ]);
            setAdmins(adminRes.data);
            setVendors(vendorRes.data.results || vendorRes.data);
            setAssignments(assignRes.data);
        } catch (e) {
            setError(e.response?.data?.detail || e.message || 'Failed to load assignment data.');
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Vendors with no active assignment
    const assignedVendorIds = new Set(assignments.filter(a => a.is_active).map(a => a.vendor));
    const unassignedVendors = vendors.filter(v => !assignedVendorIds.has(v.user));
    const filteredUnassigned = unassignedVendors.filter(v =>
        !searchVendor ||
        v.business_name?.toLowerCase().includes(searchVendor.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchVendor.toLowerCase())
    );

    // Handlers
    const handleAssign = async (vendorIds, adminId) => {
        if (vendorIds.length === 0 || !adminId) return;
        setBusy(true);
        try {
            if (vendorIds.length === 1) {
                await assignVendorToAdmin(vendorIds[0], adminId);
            } else {
                await bulkAssignVendors(vendorIds, adminId);
            }
            setSelectedVendors([]);
            await load();
        } catch (e) {
            alert(e.response?.data?.error || 'Assignment failed.');
        }
        setBusy(false);
    };

    const handleUnassign = async (vendorId) => {
        if (!window.confirm('Remove this vendor assignment?')) return;
        setBusy(true);
        try {
            await unassignVendor(vendorId);
            await load();
        } catch (e) {
            alert(e.response?.data?.error || 'Unassignment failed.');
        }
        setBusy(false);
    };

    const handleDrop = async (vendorId, adminId) => {
        await handleAssign([vendorId], adminId);
    };

    const handleShowHistory = async (vendor) => {
        setHistoryVendor(vendor);
        try {
            const res = await getAssignmentHistory(vendor.user);
            setHistoryData(res.data);
        } catch { setHistoryData([]); }
    };

    const handleSaveAdminScope = async (profileId, data) => {
        // PATCH /api/users/admin/admins/{id}/ — superadmin updates another admin's profile
        try {
            const { default: axios } = await import('axios');
            const token = localStorage.getItem('access_token');
            await axios.patch(`/api/users/admin/admins/${profileId}/`, data, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await load();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update admin profile.');
        }
    };

    const toggleVendorSelect = (vendorUserId) => {
        setSelectedVendors(prev =>
            prev.includes(vendorUserId)
                ? prev.filter(id => id !== vendorUserId)
                : [...prev, vendorUserId]
        );
    };

    const selectAllUnassigned = () => {
        setSelectedVendors(filteredUnassigned.map(v => v.user));
    };

    // Table columns for assignment overview
    const assignmentColumns = [
        {
            key: 'vendor_business', label: 'Vendor', sortable: true, width: 200,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v}</span>
                    <span className="dt-cell-stack__secondary">{row.vendor_email}</span>
                </div>
            ),
        },
        {
            key: 'admin_name', label: 'Managing Admin', sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v}</span>
                    <span className="dt-cell-stack__secondary">{row.admin_email}</span>
                </div>
            ),
        },
        {
            key: 'assigned_at', label: 'Since', sortable: true, width: 120,
            render: v => fmtDate(v),
        },
        {
            key: 'assigned_by_name', label: 'Assigned By', sortable: true, width: 140,
            render: v => v || <span style={{ color: '#9CA3AF' }}>—</span>,
        },
        {
            key: 'is_active', label: 'Status', sortable: true, width: 90,
            render: v => (
                <span className={`asgn-badge ${v ? 'asgn-badge--active' : 'asgn-badge--inactive'}`}>
                    {v ? '● Active' : '○ Ended'}
                </span>
            ),
        },
    ];

    if (!isSuperAdmin) {
        // Assigned admin: read-only view of own vendors
        return (
            <div className="asgn-tab">
                <div className="asgn-tab__header">
                    <div>
                        <h2>My Assigned Vendors</h2>
                        <p>Vendors you are responsible for managing.</p>
                    </div>
                    <ScopePill scope="assigned_admin" />
                </div>
                {loading ? (
                    <div className="asgn-loading"><div className="asgn-spinner" />Loading…</div>
                ) : (
                    <div className="asgn-readonly-grid">
                        {vendors.filter(v => assignedVendorIds.has(v.user)).map(v => (
                            <div key={v.id} className="asgn-readonly-card">
                                <div className="asgn-readonly-card__name">{v.business_name}</div>
                                <div className="asgn-readonly-card__meta">
                                    <span>{v.email}</span>
                                    <span>{v.city_name || '—'}</span>
                                    <StatusBadge status={v.status} map={VENDOR_STATUS_CLR} />
                                </div>
                            </div>
                        ))}
                        {vendors.length === 0 && (
                            <div className="asgn-empty">
                                <span>🎯</span>
                                <p>No vendors have been assigned to you yet. Contact a superadmin.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Superadmin full management UI
    return (
        <div className="asgn-tab">
            {/* Header */}
            <div className="asgn-tab__header">
                <div>
                    <h2>Vendor–Admin Assignments</h2>
                    <p>Assign vendors to admins. Each admin sees only their assigned vendors and related customers.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ScopePill scope="superadmin" />
                    <div className="asgn-view-toggle">
                        <button className={viewMode === 'matrix' ? 'active' : ''} onClick={() => setViewMode('matrix')}>
                            ⊞ Matrix
                        </button>
                        <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
                            ≡ Table
                        </button>
                    </div>
                    <button className="asgn-refresh-btn" onClick={load} disabled={busy}>↺ Refresh</button>
                </div>
            </div>

            {error && (
                <div className="asgn-error">⚠ {error} <button onClick={load}>Retry</button></div>
            )}
            {loading ? (
                <div className="asgn-loading"><div className="asgn-spinner" />Loading assignment data…</div>
            ) : (
                <>
                    {/* ── Summary strip ── */}
                    <div className="asgn-summary-strip">
                        {[
                            ['👥', 'Total Admins', admins.length, '#1D4ED8'],
                            ['🏪', 'Total Vendors', vendors.length, '#0DB89E'],
                            ['✅', 'Assigned', vendors.length - unassignedVendors.length, '#059669'],
                            ['⚠️', 'Unassigned', unassignedVendors.length, unassignedVendors.length > 0 ? '#D97706' : '#9CA3AF'],
                        ].map(([icon, label, val, color]) => (
                            <div key={label} className="asgn-summary-card">
                                <span className="asgn-summary-icon">{icon}</span>
                                <span className="asgn-summary-val" style={{ color }}>{val}</span>
                                <span className="asgn-summary-lbl">{label}</span>
                            </div>
                        ))}
                    </div>

                    {viewMode === 'matrix' ? (
                        <>
                            {/* ── Admin cards matrix ── */}
                            <div className="asgn-section">
                                <div className="asgn-section__head">
                                    <h3>Admin Assignment Map</h3>
                                    <p>Drag vendors from below onto an admin card, or use the quick-assign dropdown.</p>
                                </div>
                                <div className="asgn-admin-grid">
                                    {admins.map(admin => (
                                        <AdminCard
                                            key={admin.id}
                                            admin={admin}
                                            assignments={assignments}
                                            vendors={vendors}
                                            onDrop={handleDrop}
                                            onAssign={handleAssign}
                                            onUnassign={handleUnassign}
                                            selectedVendors={selectedVendors}
                                            onSelect={() => {}}
                                        />
                                    ))}
                                    {admins.length === 0 && (
                                        <div className="asgn-empty">
                                            <span>👤</span>
                                            <p>No admin accounts found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Unassigned vendors ── */}
                            {unassignedVendors.length > 0 && (
                                <div className="asgn-section">
                                    <div className="asgn-section__head">
                                        <div>
                                            <h3>⚠ Unassigned Vendors ({unassignedVendors.length})</h3>
                                            <p>These vendors have no managing admin. Assign them by dragging to a card above or using the dropdown.</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {selectedVendors.length > 0 && (
                                                <span className="asgn-selected-count">
                                                    {selectedVendors.length} selected
                                                </span>
                                            )}
                                            <button className="asgn-select-all-btn" onClick={selectAllUnassigned}>
                                                ☑ Select All
                                            </button>
                                            {selectedVendors.length > 0 && (
                                                <button className="asgn-clear-sel-btn" onClick={() => setSelectedVendors([])}>
                                                    ✕ Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="asgn-search-row">
                                        <input
                                            className="asgn-search-input"
                                            placeholder="Search unassigned vendors…"
                                            value={searchVendor}
                                            onChange={e => setSearchVendor(e.target.value)}
                                        />
                                    </div>

                                    <div className="asgn-unassigned-list">
                                        {filteredUnassigned.map(v => (
                                            <UnassignedVendorRow
                                                key={v.id}
                                                vendor={v}
                                                admins={admins}
                                                onAssign={handleAssign}
                                                isSelected={selectedVendors.includes(v.user)}
                                                onToggleSelect={toggleVendorSelect}
                                            />
                                        ))}
                                        {filteredUnassigned.length === 0 && searchVendor && (
                                            <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                                                No unassigned vendors match "{searchVendor}".
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Admin profiles ── */}
                            <div className="asgn-section">
                                <div className="asgn-section__head">
                                    <h3>Admin Accounts</h3>
                                    <p>Manage admin scopes — superadmin has full access; assigned admin sees only their vendors.</p>
                                </div>
                                <div className="asgn-admin-profiles-list">
                                    {admins.map(admin => (
                                        <div key={admin.id} className="asgn-admin-profile-row">
                                            <div className="asgn-admin-profile-row__avatar">
                                                {(admin.full_name || admin.email || 'A')[0].toUpperCase()}
                                            </div>
                                            <div className="asgn-admin-profile-row__info">
                                                <strong>{admin.full_name || admin.email}</strong>
                                                <span>{admin.email}</span>
                                                {admin.display_name && (
                                                    <span className="asgn-display-name">{admin.display_name}</span>
                                                )}
                                            </div>
                                            <ScopePill scope={admin.scope} />
                                            <span className="asgn-vendor-count-pill">
                                                {admin.assigned_vendor_count} vendors
                                            </span>
                                            <button
                                                className="asgn-edit-btn"
                                                onClick={() => setEditingAdmin(admin)}
                                            >
                                                ✏ Edit Scope
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* ── Table view ── */
                        <div className="asgn-section">
                            <DataTable
                                columns={assignmentColumns}
                                data={assignments}
                                searchable
                                searchKeys={['vendor_business', 'vendor_email', 'admin_name', 'admin_email']}
                                searchPlaceholder="Search by vendor or admin…"
                                filters={[{
                                    key: 'is_active',
                                    label: 'Status',
                                    options: [
                                        { value: '', label: 'All' },
                                        { value: 'true', label: 'Active' },
                                        { value: 'false', label: 'Ended' },
                                    ],
                                }]}
                                extraActions={[
                                    {
                                        label: '📋 History',
                                        className: 'dt-action-btn--secondary',
                                        onClick: (row) => handleShowHistory({ user: row.vendor, business_name: row.vendor_business }),
                                    },
                                    {
                                        label: '✕ Remove',
                                        className: 'dt-action-btn--danger',
                                        show: (row) => row.is_active,
                                        onClick: (row) => handleUnassign(row.vendor),
                                    },
                                ]}
                                emptyIcon="🔗"
                                emptyMessage="No assignments found."
                                pageSize={25}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Modals */}
            {historyVendor && (
                <HistoryModal
                    vendorName={historyVendor.business_name || historyVendor.vendor_business}
                    history={historyData}
                    onClose={() => { setHistoryVendor(null); setHistoryData([]); }}
                />
            )}
            {editingAdmin && (
                <AdminScopeEditor
                    admin={editingAdmin}
                    onSave={handleSaveAdminScope}
                    onClose={() => setEditingAdmin(null)}
                />
            )}
        </div>
    );
}