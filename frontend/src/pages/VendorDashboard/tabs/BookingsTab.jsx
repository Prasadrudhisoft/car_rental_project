// ─────────────────────────────────────────────────────────────────────────────
// tabs/BookingsTab.jsx
// Desktop: full DataTable. Mobile (≤768px): tappable cards — no horizontal scroll.
// Tapping a card opens BookingDetailPanel via onOpenBooking (existing flow).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import DataTable from '../../../components/common/DataTable';
import { StatusBadge } from '../VendorShared';
import { STATUS_CLR } from '../vendorConstants';

// ── Status filter options ─────────────────────────────────────────────────────
const STATUS_OPTIONS = [
    { value: '',          label: 'All'       },
    { value: 'PENDING',   label: 'Pending'   },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'ACTIVE',    label: 'Active'    },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

// ── Mobile card ───────────────────────────────────────────────────────────────
function MobileBookingCard({ booking: b, onOpenBooking }) {
    const customer = b.customer_name || b.customer?.full_name || '—';
    const amount   = parseFloat(b.total_amount || 0).toLocaleString('en-IN');

    return (
        <button
            className="cd-mob-booking-card"
            onClick={() => onOpenBooking(b)}
            aria-label={`View booking ${b.booking_ref}`}
        >
            {/* Row 1: ref + status */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--head">
                <span className="cd-mob-booking-card__ref">{b.booking_ref}</span>
                <StatusBadge status={b.status} />
            </div>

            {/* Row 2: customer name + amount */}
            <div className="cd-mob-booking-card__row" style={{ justifyContent: 'space-between' }}>
                <span className="cd-mob-booking-card__vehicle">{customer}</span>
                <span className="vd-mob-booking-card__amount">₹{amount}</span>
            </div>

            {/* Row 3: vehicle */}
            {b.vehicle_display && (
                <div className="cd-mob-booking-card__row">
                    <span style={{ fontSize: 12, color: 'var(--vt2)' }}>{b.vehicle_display}</span>
                </div>
            )}

            {/* Row 4: dates + flags + chevron */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--footer">
                <span className="cd-mob-booking-card__dates">
                    {b.pickup_date || '—'}{' → '}{b.return_date || '—'}
                    {b.rental_days ? ` · ${b.rental_days}d` : ''}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {b.payment_captured && (
                        <span className="vd-mob-flag vd-mob-flag--ok">Paid</span>
                    )}
                    {b.agreement_signed && (
                        <span className="vd-mob-flag vd-mob-flag--ok">Signed</span>
                    )}
                    <span className="cd-mob-booking-card__chevron" aria-hidden="true">›</span>
                </div>
            </div>
        </button>
    );
}

// ── Mobile list ───────────────────────────────────────────────────────────────
function MobileBookingList({ bookings, onOpenBooking }) {
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const filtered = useMemo(() => {
        let result = bookings;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                b =>
                    (b.booking_ref          || '').toLowerCase().includes(q) ||
                    (b.customer_name        || '').toLowerCase().includes(q) ||
                    (b.customer?.full_name  || '').toLowerCase().includes(q) ||
                    (b.vehicle_display      || '').toLowerCase().includes(q),
            );
        }
        if (statusFilter) {
            result = result.filter(b => b.status === statusFilter);
        }
        return result;
    }, [bookings, search, statusFilter]);

    return (
        <div className="cd-mob-bookings">
            {/* Search */}
            <div className="cd-mob-bookings__search-wrap">
                <svg className="cd-mob-bookings__search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                    className="cd-mob-bookings__search vd-mob-search"
                    type="search"
                    placeholder="Search by ref, customer, vehicle…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search bookings"
                />
            </div>

            {/* Status pills */}
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
                    {filtered.length} of {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                </p>
            )}

            {filtered.length === 0 ? (
                <div className="vd-empty" style={{ padding: '40px 24px' }}>
                    <span style={{ fontSize: 32 }}>📅</span>
                    <p>No bookings match your search.</p>
                </div>
            ) : (
                <div className="cd-mob-bookings__list">
                    {filtered.map((b, i) => (
                        <MobileBookingCard key={b.id ?? i} booking={b} onOpenBooking={onOpenBooking} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Desktop columns ───────────────────────────────────────────────────────────
const columns = [
    {
        key: 'booking_ref', label: 'Booking Ref', sortable: true, width: 150,
        render: v => (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--vacc)' }}>{v}</span>
        ),
    },
    {
        key: 'customer_name', label: 'Customer', sortable: true, width: 180,
        render: (v, row) => (
            <div className="dt-cell-stack">
                <span className="dt-cell-stack__primary">{v || row.customer?.full_name || '—'}</span>
                <span className="dt-cell-stack__secondary">{row.customer_email || row.customer?.email || ''}</span>
            </div>
        ),
    },
    { key: 'vehicle_display', label: 'Vehicle', sortable: true, width: 170, render: v => v || '—' },
    {
        key: 'status', label: 'Status', sortable: true, width: 110,
        render: val => <StatusBadge status={val} />,
    },
    { key: 'pickup_date', label: 'Pickup', sortable: true, width: 100, render: v => v || '—' },
    { key: 'return_date', label: 'Return', sortable: true, width: 100, render: v => v || '—' },
    { key: 'rental_days', label: 'Days', sortable: true, width: 60, align: 'center', render: v => v ?? '—' },
    {
        key: 'total_amount', label: 'Total', sortable: true, width: 110, align: 'right',
        render: v => <span className="dt-currency">₹{parseFloat(v || 0).toLocaleString('en-IN')}</span>,
    },
    {
        key: 'payment_captured', label: 'Paid', sortable: true, width: 60, align: 'center',
        render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : <span style={{ color: '#EF4444' }}>✕</span>,
    },
    {
        key: 'agreement_signed', label: 'Signed', sortable: true, width: 65, align: 'center',
        render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : <span style={{ color: '#D1D5DB' }}>—</span>,
    },
];

// ── Main export ───────────────────────────────────────────────────────────────
export default function BookingsTab({ bookings, onOpenBooking }) {
    return (
        <div className="vd-section">
            {/* Desktop */}
            <div className="cd-bookings-desktop">
                <DataTable
                    columns={columns}
                    data={bookings}
                    searchable
                    searchKeys={['booking_ref', 'customer_name', 'customer_email', 'vehicle_display']}
                    searchPlaceholder="Search by ref, customer, vehicle…"
                    filters={[{
                        key: 'status', label: 'Status',
                        options: STATUS_OPTIONS,
                        colorMap: STATUS_CLR,
                    }]}
                    onRowAction={row => onOpenBooking(row)}
                    actionLabel="View Booking"
                    emptyIcon="📅"
                    emptyMessage="No bookings yet."
                    pageSize={20}
                />
            </div>

            {/* Mobile */}
            <div className="cd-bookings-mobile">
                <MobileBookingList bookings={bookings} onOpenBooking={onOpenBooking} />
            </div>
        </div>
    );
}