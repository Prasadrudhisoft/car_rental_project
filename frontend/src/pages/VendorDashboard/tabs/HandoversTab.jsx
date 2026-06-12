// ─────────────────────────────────────────────────────────────────────────────
// tabs/HandoversTab.jsx
// Desktop: full DataTable. Mobile (≤768px): tappable cards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import DataTable from '../../../components/common/DataTable';
import { StatusBadge } from '../VendorShared';
import { HANDOVER_STATUS_CLR } from '../vendorConstants';

// ── Status options ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
    { value: '',          label: 'All'       },
    { value: 'EXPECTED',  label: 'Expected'  },
    { value: 'RECEIVED',  label: 'Received'  },
    { value: 'HELD',      label: 'Held'      },
    { value: 'SUBLISTED', label: 'Sublisted' },
    { value: 'RETRIEVED', label: 'Retrieved' },
];

// ── Mobile handover card ──────────────────────────────────────────────────────
function MobileHandoverCard({ handover: h, onSelectHandover }) {
    const sc = HANDOVER_STATUS_CLR[h.status] || { bg: '#F3F4F6', color: '#6B7280' };

    return (
        <button
            className="cd-mob-booking-card"
            onClick={() => onSelectHandover(h)}
            aria-label={`Manage handover ${h.booking_ref}`}
        >
            {/* Row 1: vehicle + status */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--head">
                <span className="cd-mob-booking-card__vehicle" style={{ fontWeight: 700, fontSize: 14, color: 'var(--vt)' }}>
                    {h.vehicle_display || `Handover #${h.id}`}
                </span>
                <span className="vd-badge" style={{ background: sc.bg, color: sc.color, fontSize: 10, padding: '2px 8px' }}>
                    {h.status}
                </span>
            </div>

            {/* Row 2: booking ref + from vendor */}
            <div className="cd-mob-booking-card__row" style={{ gap: 8 }}>
                <span className="cd-mob-booking-card__ref">{h.booking_ref}</span>
                {h.originating_vendor_name && (
                    <span style={{ fontSize: 12, color: 'var(--vt2)' }}>
                        from {h.originating_vendor_name}
                    </span>
                )}
            </div>

            {/* Row 3: return point + days held + flags + chevron */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--footer">
                <span className="cd-mob-booking-card__dates">
                    {h.return_point_name ? `📍 ${h.return_point_name}` : ''}
                    {h.days_held ? ` · ${h.days_held}d held` : ''}
                    {h.handover_photos_uploaded  ? ' · 📷 ✓' : ''}
                    {h.full_inspection_done      ? ' · Inspected' : ''}
                </span>
                <span className="cd-mob-booking-card__chevron" aria-hidden="true">›</span>
            </div>
        </button>
    );
}

// ── Mobile list ───────────────────────────────────────────────────────────────
function MobileHandoverList({ handovers, onSelectHandover }) {
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const filtered = useMemo(() => {
        let result = handovers;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                h =>
                    (h.vehicle_display           || '').toLowerCase().includes(q) ||
                    (h.booking_ref               || '').toLowerCase().includes(q) ||
                    (h.originating_vendor_name   || '').toLowerCase().includes(q),
            );
        }
        if (statusFilter) {
            result = result.filter(h => h.status === statusFilter);
        }
        return result;
    }, [handovers, search, statusFilter]);

    return (
        <div className="cd-mob-bookings">
            <div className="cd-mob-bookings__search-wrap">
                <svg className="cd-mob-bookings__search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                    className="cd-mob-bookings__search vd-mob-search"
                    type="search"
                    placeholder="Search handovers…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search handovers"
                />
            </div>

            <div className="cd-mob-bookings__pills" role="group" aria-label="Filter by status">
                {STATUS_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        className={`cd-mob-bookings__pill vd-mob-pill${statusFilter === opt.value ? ' cd-mob-bookings__pill--active vd-mob-pill--active' : ''}`}
                        onClick={() => setStatusFilter(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {(search || statusFilter) && (
                <p className="cd-mob-bookings__count">
                    {filtered.length} of {handovers.length} handover{handovers.length !== 1 ? 's' : ''}
                </p>
            )}

            {filtered.length === 0 ? (
                <div className="vd-empty" style={{ padding: '40px 24px' }}>
                    <span style={{ fontSize: 32 }}>📦</span>
                    <p>No handovers match your search.</p>
                </div>
            ) : (
                <div className="cd-mob-bookings__list">
                    {filtered.map((h, i) => (
                        <MobileHandoverCard key={h.id ?? i} handover={h} onSelectHandover={onSelectHandover} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Desktop columns ───────────────────────────────────────────────────────────
const columns = [
    {
        key: 'vehicle_display', label: 'Vehicle', sortable: true, width: 180,
        render: (v, row) => (
            <div className="dt-cell-stack">
                <span className="dt-cell-stack__primary">{v || '—'}</span>
                <span className="dt-cell-stack__secondary">{row.booking_ref}</span>
            </div>
        ),
    },
    { key: 'originating_vendor_name', label: 'From Vendor',  sortable: true, width: 160, render: v => v || '—' },
    { key: 'return_point_name',       label: 'Return Point', sortable: true, width: 140, render: v => v ? `📍 ${v}` : '—' },
    {
        key: 'status', label: 'Status', sortable: true, width: 110,
        render: val => <StatusBadge status={val} statusMap={HANDOVER_STATUS_CLR} />,
    },
    {
        key: 'days_held', label: 'Days Held', sortable: true, width: 90, align: 'center',
        render: v => v
            ? <span style={{ color: v > 3 ? '#D97706' : 'inherit', fontWeight: v > 3 ? 700 : 400 }}>{v}d</span>
            : '—',
    },
    {
        key: 'handover_photos_uploaded', label: 'Photos', sortable: false, width: 70, align: 'center',
        render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : '—',
    },
    {
        key: 'full_inspection_done', label: 'Inspected', sortable: false, width: 80, align: 'center',
        render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : '—',
    },
];

// ── Main export ───────────────────────────────────────────────────────────────
export default function HandoversTab({ handovers, onSelectHandover }) {
    return (
        <div className="vd-section">
            {/* Desktop */}
            <div className="cd-bookings-desktop">
                <DataTable
                    columns={columns}
                    data={handovers}
                    searchable
                    searchKeys={['vehicle_display', 'booking_ref', 'originating_vendor_name']}
                    searchPlaceholder="Search handovers…"
                    filters={[{
                        key: 'status', label: 'Status',
                        options: STATUS_OPTIONS,
                        colorMap: HANDOVER_STATUS_CLR,
                    }]}
                    onRowAction={row => onSelectHandover(row)}
                    actionLabel="Manage Handover"
                    emptyIcon="📦"
                    emptyMessage="No handovers assigned."
                    pageSize={15}
                />
            </div>

            {/* Mobile */}
            <div className="cd-bookings-mobile">
                <MobileHandoverList handovers={handovers} onSelectHandover={onSelectHandover} />
            </div>
        </div>
    );
}