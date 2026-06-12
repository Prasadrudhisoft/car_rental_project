// ─────────────────────────────────────────────────────────────────────────────
// tabs/ReviewsTab.jsx
// Pending reviews — bookings the customer can still leave a review for.
// Desktop: DataTable. Mobile (≤768px): tappable cards, no horizontal scroll.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import DataTable from '../../../components/common/DataTable';

// ── Mobile card ───────────────────────────────────────────────────────────────
function MobilePendingCard({ review, onWriteReview }) {
    return (
        <button
            className="cd-mob-booking-card"
            onClick={() => onWriteReview(review)}
            aria-label={`Write review for ${review.booking_ref}`}
        >
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--head">
                <span className="cd-mob-booking-card__ref">{review.booking_ref}</span>
                <span className="cd-mob-review-write-badge">Write ★</span>
            </div>
            <div className="cd-mob-booking-card__row">
                <span className="cd-mob-booking-card__vehicle">
                    {review.vehicle_display || '—'}
                </span>
            </div>
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--footer">
                <span className="cd-mob-booking-card__dates">
                    {review.vendor_name
                        ? `${review.vendor_name}${review.return_date ? ' · Returned ' + review.return_date : ''}`
                        : review.return_date
                            ? `Returned ${review.return_date}`
                            : '—'}
                </span>
                <span className="cd-mob-booking-card__chevron" aria-hidden="true">›</span>
            </div>
        </button>
    );
}

// ── Mobile list ───────────────────────────────────────────────────────────────
function MobilePendingList({ pendingReviews, onWriteReview }) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return pendingReviews;
        const q = search.toLowerCase();
        return pendingReviews.filter(
            r =>
                (r.booking_ref      || '').toLowerCase().includes(q) ||
                (r.vehicle_display  || '').toLowerCase().includes(q) ||
                (r.vendor_name      || '').toLowerCase().includes(q),
        );
    }, [pendingReviews, search]);

    return (
        <div className="cd-mob-bookings">
            <div className="cd-mob-bookings__search-wrap">
                <svg className="cd-mob-bookings__search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                    className="cd-mob-bookings__search"
                    type="search"
                    placeholder="Search pending reviews…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search pending reviews"
                />
            </div>

            {search && (
                <p className="cd-mob-bookings__count">
                    {filtered.length} of {pendingReviews.length} pending
                </p>
            )}

            {filtered.length === 0 ? (
                <div className="cd-empty" style={{ padding: '40px 24px' }}>
                    <span className="cd-empty__icon">⭐</span>
                    <p>No reviews match your search.</p>
                </div>
            ) : (
                <div className="cd-mob-bookings__list">
                    {filtered.map((r, i) => (
                        <MobilePendingCard
                            key={r.booking_id ?? i}
                            review={r}
                            onWriteReview={onWriteReview}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ReviewsTab({ pendingReviews, onWriteReview }) {
    const columns = [
        {
            key: 'booking_ref', label: 'Booking', sortable: true, width: 140,
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
            render: v => v || '—',
        },
        {
            key: 'return_date', label: 'Returned', sortable: true, width: 110,
            render: v => v || '—',
        },
        {
            key: 'vendor_name', label: 'Vendor', sortable: true, width: 160,
            render: v => v || '—',
        },
    ];

    if (pendingReviews.length === 0) {
        return (
            <div className="cd-section">
                <div className="cd-empty">
                    <div className="cd-empty__icon">
                        <span className="icon-star"></span>
                    </div>
                    <h3>All caught up!</h3>
                    <p>No pending reviews. Check "My Reviews" to see what you've submitted.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cd-section">
            {/* Desktop */}
            <div className="cd-bookings-desktop">
                <DataTable
                    columns={columns}
                    data={pendingReviews}
                    searchable
                    searchKeys={['booking_ref', 'vehicle_display', 'vendor_name']}
                    searchPlaceholder="Search pending reviews…"
                    onRowAction={row => onWriteReview(row)}
                    actionLabel="Write Review"
                    emptyIcon="⭐"
                    emptyMessage="No pending reviews."
                    pageSize={15}
                />
            </div>

            {/* Mobile */}
            <div className="cd-bookings-mobile">
                <MobilePendingList
                    pendingReviews={pendingReviews}
                    onWriteReview={onWriteReview}
                />
            </div>
        </div>
    );
}