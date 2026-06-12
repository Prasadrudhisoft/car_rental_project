// ─────────────────────────────────────────────────────────────────────────────
// tabs/MyReviewsTab.jsx
// All reviews the customer has already submitted.
// Desktop: DataTable. Mobile (≤768px): star-rating cards, no horizontal scroll.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import DataTable from '../../../components/common/DataTable';
import { fmtDate } from '../cdConstants';

function Stars({ value, size = 14 }) {
    return (
        <span style={{ display: 'inline-flex', gap: 1 }}>
            {[1, 2, 3, 4, 5].map(n => (
                <span
                    key={n}
                    style={{ fontSize: size, color: n <= (value || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}
                >
                    ★
                </span>
            ))}
        </span>
    );
}

// ── Mobile card ───────────────────────────────────────────────────────────────
function MobileReviewCard({ review, onViewReview }) {
    const date = review.created_at
        ? fmtDate(review.created_at)
        : review.return_date || '—';

    return (
        <button
            className="cd-mob-booking-card"
            onClick={() => onViewReview(review)}
            aria-label={`View review for ${review.booking_ref}`}
        >
            {/* Row 1: ref + submitted badge */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--head">
                <span className="cd-mob-booking-card__ref">{review.booking_ref}</span>
                <span className="cd-mob-review-submitted-badge">✓ Submitted</span>
            </div>

            {/* Row 2: vehicle */}
            <div className="cd-mob-booking-card__row">
                <span className="cd-mob-booking-card__vehicle">
                    {review.vehicle_display || '—'}
                </span>
            </div>

            {/* Row 3: star ratings side by side */}
            <div className="cd-mob-booking-card__row" style={{ gap: 14 }}>
                <span className="cd-mob-review-rating-group">
                    <span className="cd-mob-review-rating-lbl">Vendor</span>
                    <Stars value={review.vendor_rating} />
                </span>
                <span className="cd-mob-review-rating-group">
                    <span className="cd-mob-review-rating-lbl">Vehicle</span>
                    <Stars value={review.vehicle_rating} />
                </span>
            </div>

            {/* Row 4: excerpt + date + chevron */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--footer">
                <span className="cd-mob-booking-card__dates">
                    {review.review_text
                        ? `"${review.review_text.slice(0, 48)}${review.review_text.length > 48 ? '…' : ''}"`
                        : date}
                </span>
                <span className="cd-mob-booking-card__chevron" aria-hidden="true">›</span>
            </div>
        </button>
    );
}

// ── Mobile list with search + star filter ─────────────────────────────────────
const RATING_OPTIONS = [
    { value: '',  label: 'All' },
    { value: '5', label: '5 ★' },
    { value: '4', label: '4 ★' },
    { value: '3', label: '3 ★' },
    { value: '2', label: '2 ★' },
    { value: '1', label: '1 ★' },
];

function MobileReviewList({ submittedReviews, onViewReview }) {
    const [search,        setSearch]        = useState('');
    const [ratingFilter,  setRatingFilter]  = useState('');

    const filtered = useMemo(() => {
        let result = submittedReviews;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                r =>
                    (r.booking_ref     || '').toLowerCase().includes(q) ||
                    (r.vehicle_display || '').toLowerCase().includes(q) ||
                    (r.review_text     || '').toLowerCase().includes(q),
            );
        }
        if (ratingFilter) {
            result = result.filter(r => String(r.vendor_rating) === ratingFilter);
        }
        return result;
    }, [submittedReviews, search, ratingFilter]);

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
                    placeholder="Search your reviews…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search reviews"
                />
            </div>

            {/* Rating filter pills */}
            <div className="cd-mob-bookings__pills" role="group" aria-label="Filter by rating">
                {RATING_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        className={`cd-mob-bookings__pill${ratingFilter === opt.value ? ' cd-mob-bookings__pill--active' : ''}`}
                        onClick={() => setRatingFilter(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {(search || ratingFilter) && (
                <p className="cd-mob-bookings__count">
                    {filtered.length} of {submittedReviews.length} review{submittedReviews.length !== 1 ? 's' : ''}
                </p>
            )}

            {filtered.length === 0 ? (
                <div className="cd-empty" style={{ padding: '40px 24px' }}>
                    <span className="cd-empty__icon">💬</span>
                    <p>No reviews match your search.</p>
                </div>
            ) : (
                <div className="cd-mob-bookings__list">
                    {filtered.map((r, i) => (
                        <MobileReviewCard
                            key={r.id ?? i}
                            review={r}
                            onViewReview={onViewReview}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Desktop columns ───────────────────────────────────────────────────────────
const columns = [
    {
        key: 'booking_ref', label: 'Booking', sortable: true, width: 140,
        render: v => (
            <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12, fontWeight: 700, color: 'var(--cd-acc)',
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
        key: 'vendor_rating', label: 'Vendor ★', sortable: true, width: 130,
        render: v => <Stars value={v} />,
    },
    {
        key: 'vehicle_rating', label: 'Vehicle ★', sortable: true, width: 130,
        render: v => <Stars value={v} />,
    },
    {
        key: 'review_text', label: 'Review', sortable: false,
        render: v => v
            ? (
                <span style={{
                    fontSize: 12, color: 'var(--cd-txt2)', fontStyle: 'italic',
                    display: 'block', maxWidth: 220,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    "{v}"
                </span>
            )
            : <span style={{ color: 'var(--cd-muted)', fontSize: 11 }}>No text</span>,
    },
    {
        key: 'created_at', label: 'Date', sortable: true, width: 110,
        render: (v, row) => v ? fmtDate(v) : (row.return_date || '—'),
    },
    {
        key: '__status__', label: 'Status', sortable: false, width: 90,
        render: () => (
            <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 999,
                background: '#D1FAE5', color: '#059669',
                border: '1px solid #6EE7B7',
            }}>
                ✓ Submitted
            </span>
        ),
    },
];

// ── Main export ───────────────────────────────────────────────────────────────
export default function MyReviewsTab({ submittedReviews, loading, onViewReview }) {
    if (loading) {
        return (
            <div className="cd-section">
                <div className="cd-loading">
                    <div className="cd-spinner" /> Loading your reviews…
                </div>
            </div>
        );
    }

    if (submittedReviews.length === 0) {
        return (
            <div className="cd-section">
                <div className="cd-empty">
                    <div className="cd-empty__icon"><span className="icon-star"></span></div>
                    <h3>No reviews submitted yet</h3>
                    <p>After completing a trip, you'll be able to leave a review. Your submitted reviews will appear here.</p>
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
                    data={submittedReviews}
                    searchable
                    searchKeys={['booking_ref', 'vehicle_display', 'review_text']}
                    searchPlaceholder="Search your reviews…"
                    filters={[{
                        key: 'vendor_rating', label: 'Rating',
                        options: [
                            { value: '', label: 'All Ratings' },
                            ...[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} ★` })),
                        ],
                    }]}
                    onRowAction={row => onViewReview(row)}
                    actionLabel="View Review"
                    emptyIcon="💬"
                    emptyMessage="No reviews found."
                    pageSize={15}
                />
            </div>

            {/* Mobile */}
            <div className="cd-bookings-mobile">
                <MobileReviewList
                    submittedReviews={submittedReviews}
                    onViewReview={onViewReview}
                />
            </div>
        </div>
    );
}