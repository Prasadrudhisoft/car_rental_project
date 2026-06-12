// ─────────────────────────────────────────────────────────────────────────────
// tabs/BookingsTab.jsx
// Customer bookings list rendered as a DataTable on desktop.
// On mobile (≤768px): renders compact tappable cards instead — no horizontal
// scroll. Full details are available in BookingDetailModal via onViewBooking.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import DataTable from '../../../components/common/DataTable';
import { StatusBadge } from '../cdShared';
import { STATUS_CLR, fmtDate } from '../cdConstants';

// ── Mobile-only booking card ──────────────────────────────────────────────────
function MobileBookingCard({ booking, onViewBooking }) {
    const vehicle =
        booking.vehicle_display ||
        `${booking.vehicle?.make || ''} ${booking.vehicle?.model || ''}`.trim() ||
        '—';
    const plate = booking.vehicle?.plate_number || '';

    return (
        <button
            className="cd-mob-booking-card"
            onClick={() => onViewBooking(booking)}
            aria-label={`View booking ${booking.booking_ref}`}
        >
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--head">
                <span className="cd-mob-booking-card__ref">{booking.booking_ref}</span>
                <StatusBadge status={booking.status} />
            </div>

            <div className="cd-mob-booking-card__row">
                <span className="cd-mob-booking-card__vehicle">{vehicle}</span>
                {plate && (
                    <span className="cd-mob-booking-card__plate">{plate}</span>
                )}
            </div>

            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--footer">
                <span className="cd-mob-booking-card__dates">
                    {booking.pickup_date || '—'}
                    {' → '}
                    {booking.return_date || '—'}
                    {booking.rental_days ? ` · ${booking.rental_days}d` : ''}
                </span>
                <span className="cd-mob-booking-card__chevron" aria-hidden="true">›</span>
            </div>
        </button>
    );
}

// ── Mobile filter / search bar ────────────────────────────────────────────────
const STATUS_OPTIONS = [
    { value: '',          label: 'All'       },
    { value: 'PENDING',   label: 'Pending'   },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'ACTIVE',    label: 'Active'    },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

function MobileBookingList({ bookings, onViewBooking }) {
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const filtered = useMemo(() => {
        let result = bookings;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                b =>
                    (b.booking_ref || '').toLowerCase().includes(q) ||
                    (b.vehicle_display || '').toLowerCase().includes(q) ||
                    (b.vehicle?.make || '').toLowerCase().includes(q) ||
                    (b.vehicle?.model || '').toLowerCase().includes(q),
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
                    className="cd-mob-bookings__search"
                    type="search"
                    placeholder="Search bookings…"
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
                        className={`cd-mob-bookings__pill${statusFilter === opt.value ? ' cd-mob-bookings__pill--active' : ''}`}
                        onClick={() => setStatusFilter(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Result count */}
            {(search || statusFilter) && (
                <p className="cd-mob-bookings__count">
                    {filtered.length} of {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                </p>
            )}

            {/* Cards */}
            {filtered.length === 0 ? (
                <div className="cd-empty" style={{ padding: '40px 24px' }}>
                    <span className="cd-empty__icon">📅</span>
                    <p>No bookings match your search.</p>
                </div>
            ) : (
                <div className="cd-mob-bookings__list">
                    {filtered.map((b, i) => (
                        <MobileBookingCard
                            key={b.id ?? i}
                            booking={b}
                            onViewBooking={onViewBooking}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function BookingsTab({ bookings, onViewBooking }) {
    const columns = [
        {
            key: 'booking_ref', label: 'Booking Ref', sortable: true, width: 150,
            render: v => (
                <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--cd-acc)',
                }}>
                    {v}
                </span>
            ),
        },
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">
                        {v || `${row.vehicle?.make || ''} ${row.vehicle?.model || ''}`.trim() || '—'}
                    </span>
                    <span
                        className="dt-cell-stack__secondary"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}
                    >
                        {row.vehicle?.plate_number || ''}
                    </span>
                </div>
            ),
        },
        {
            key: 'status', label: 'Status', sortable: true, width: 110,
            render: val => <StatusBadge status={val} />,
        },
        { key: 'pickup_date',  label: 'Pickup',  sortable: true, width: 100, render: v => v || '—' },
        { key: 'return_date',  label: 'Return',  sortable: true, width: 100, render: v => v || '—' },
        {
            key: 'rental_days', label: 'Days', sortable: true,
            width: 55, align: 'center', render: v => v ?? '—',
        },
        {
            key: 'payment_captured', label: 'Paid', sortable: true,
            width: 55, align: 'center',
            render: v => v
                ? <span style={{ color: '#059669', fontWeight: 700, fontSize: 13 }}>✓</span>
                : <span style={{ color: '#EF4444', fontSize: 13 }}>✕</span>,
        },
        {
            key: 'agreement_signed', label: 'Signed', sortable: true,
            width: 65, align: 'center',
            render: v => v
                ? <span style={{ color: '#059669', fontWeight: 700 }}>✍</span>
                : <span style={{ color: '#D1D5DB' }}>—</span>,
        },
        {
            key: 'created_at', label: 'Booked On', sortable: true, width: 110,
            render: v => fmtDate(v),
        },
    ];

    return (
        <div className="cd-section">
            {/* Desktop table — hidden on mobile via CSS */}
            <div className="cd-bookings-desktop">
                <DataTable
                    columns={columns}
                    data={bookings}
                    searchable
                    searchKeys={['booking_ref', 'vehicle_display', 'status']}
                    searchPlaceholder="Search by booking ref, vehicle…"
                    filters={[
                        {
                            key: 'status', label: 'Status',
                            options: [
                                { value: '',          label: 'All Bookings' },
                                { value: 'PENDING',   label: 'Pending',   color: '#D97706' },
                                { value: 'CONFIRMED', label: 'Confirmed', color: '#1D4ED8' },
                                { value: 'ACTIVE',    label: 'Active',    color: '#059669' },
                                { value: 'COMPLETED', label: 'Completed', color: '#6B7280' },
                                { value: 'CANCELLED', label: 'Cancelled', color: '#EF4444' },
                            ],
                            colorMap: STATUS_CLR,
                        },
                        {
                            key: 'payment_captured', label: 'Payment',
                            options: [
                                { value: '',      label: 'All'    },
                                { value: 'true',  label: 'Paid'   },
                                { value: 'false', label: 'Unpaid' },
                            ],
                        },
                    ]}
                    onRowAction={row => onViewBooking(row)}
                    actionLabel="View Booking"
                    emptyIcon="📅"
                    emptyMessage="No bookings yet. Browse cars and make your first booking."
                    pageSize={15}
                />
            </div>

            {/* Mobile card list — shown only on mobile via CSS */}
            <div className="cd-bookings-mobile">
                <MobileBookingList bookings={bookings} onViewBooking={onViewBooking} />
            </div>
        </div>
    );
}