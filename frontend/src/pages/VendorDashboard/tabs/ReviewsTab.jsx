// ─────────────────────────────────────────────────────────────────────────────
// tabs/ReviewsTab.jsx
// Summary stats card + DataTable + ordering buttons.
// Desktop: full DataTable. Mobile (≤768px): tappable review cards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import DataTable from '../../../components/common/DataTable';
import { SectionCard } from '../VendorShared';
import { fetchVendorReviews } from '../../../services/api';
import { fmtDate } from '../vendorConstants';

function Stars({ value, size = 14 }) {
    return (
        <span style={{ display: 'inline-flex', gap: 1 }}>
            {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ fontSize: size, color: n <= (value || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>
            ))}
        </span>
    );
}

// ── Mobile review card ────────────────────────────────────────────────────────
function MobileReviewCard({ review: r, onSelectReview }) {
    const ratingColor = (r.vendor_rating || 0) >= 4 ? '#059669'
                      : (r.vendor_rating || 0) === 3 ? '#D97706'
                      : '#EF4444';
    const ratingBg    = (r.vendor_rating || 0) >= 4 ? '#D1FAE5'
                      : (r.vendor_rating || 0) === 3 ? '#FEF3C7'
                      : '#FEE2E2';

    return (
        <button
            className="cd-mob-booking-card"
            onClick={() => onSelectReview(r)}
            aria-label={`View review from ${r.customer_name || 'customer'}`}
        >
            {/* Row 1: customer + overall rating chip */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--head">
                <span className="cd-mob-booking-card__vehicle" style={{ fontWeight: 700 }}>
                    {r.customer_name || '—'}
                </span>
                <span style={{
                    fontSize: 11, fontWeight: 800, padding: '2px 8px',
                    borderRadius: 999, background: ratingBg, color: ratingColor,
                    flexShrink: 0,
                }}>
                    ★ {r.vendor_rating || 0}/5
                </span>
            </div>

            {/* Row 2: vehicle */}
            {r.vehicle_display && (
                <div className="cd-mob-booking-card__row">
                    <span style={{ fontSize: 12, color: 'var(--vt2)' }}>{r.vehicle_display}</span>
                </div>
            )}

            {/* Row 3: inline star ratings */}
            <div className="cd-mob-booking-card__row" style={{ gap: 16 }}>
                <span className="cd-mob-review-rating-group">
                    <span className="cd-mob-review-rating-lbl">Vendor</span>
                    <Stars value={r.vendor_rating} />
                </span>
                <span className="cd-mob-review-rating-group">
                    <span className="cd-mob-review-rating-lbl">Vehicle</span>
                    <Stars value={r.vehicle_rating} />
                </span>
            </div>

            {/* Row 4: review excerpt + date + chevron */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--footer">
                <span className="cd-mob-booking-card__dates" style={{ fontStyle: r.review_text ? 'italic' : 'normal' }}>
                    {r.review_text
                        ? `"${r.review_text.slice(0, 50)}${r.review_text.length > 50 ? '…' : '"'}`
                        : fmtDate(r.created_at)}
                </span>
                <span className="cd-mob-booking-card__chevron" aria-hidden="true">›</span>
            </div>
        </button>
    );
}

// ── Rating filter options ─────────────────────────────────────────────────────
const RATING_OPTIONS = [
    { value: '',  label: 'All' },
    { value: '5', label: '5 ★' },
    { value: '4', label: '4 ★' },
    { value: '3', label: '3 ★' },
    { value: '2', label: '2 ★' },
    { value: '1', label: '1 ★' },
];

// ── Mobile review list ────────────────────────────────────────────────────────
function MobileReviewList({ reviews, onSelectReview }) {
    const [search,       setSearch]       = useState('');
    const [ratingFilter, setRatingFilter] = useState('');

    const filtered = useMemo(() => {
        let result = reviews;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                r =>
                    (r.customer_name   || '').toLowerCase().includes(q) ||
                    (r.vehicle_display || '').toLowerCase().includes(q) ||
                    (r.review_text     || '').toLowerCase().includes(q),
            );
        }
        if (ratingFilter) {
            result = result.filter(r => String(r.vendor_rating) === ratingFilter);
        }
        return result;
    }, [reviews, search, ratingFilter]);

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
                    placeholder="Search reviews…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search reviews"
                />
            </div>

            <div className="cd-mob-bookings__pills" role="group" aria-label="Filter by rating">
                {RATING_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        className={`cd-mob-bookings__pill vd-mob-pill${ratingFilter === opt.value ? ' cd-mob-bookings__pill--active vd-mob-pill--active' : ''}`}
                        onClick={() => setRatingFilter(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {(search || ratingFilter) && (
                <p className="cd-mob-bookings__count">
                    {filtered.length} of {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                </p>
            )}

            {filtered.length === 0 ? (
                <div className="vd-empty" style={{ padding: '40px 24px' }}>
                    <span style={{ fontSize: 32 }}>💬</span>
                    <p>No reviews match your search.</p>
                </div>
            ) : (
                <div className="cd-mob-bookings__list">
                    {filtered.map((r, i) => (
                        <MobileReviewCard key={r.id ?? i} review={r} onSelectReview={onSelectReview} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Desktop columns ───────────────────────────────────────────────────────────
const desktopColumns = [
    {
        key: 'customer_name', label: 'Customer', sortable: true, width: 150,
        render: (v, row) => (
            <div className="dt-cell-stack">
                <span className="dt-cell-stack__primary">{v || '—'}</span>
                <span className="dt-cell-stack__secondary">{row.vehicle_display || '—'}</span>
            </div>
        ),
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
            ? <span style={{ fontSize: 12, color: 'var(--vt2)', fontStyle: 'italic', display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{v}"</span>
            : <span style={{ color: 'var(--vm)', fontSize: 11 }}>No text</span>,
    },
    { key: 'created_at', label: 'Date', sortable: true, width: 110, render: v => fmtDate(v) },
];

// ── Main export ───────────────────────────────────────────────────────────────
export default function ReviewsTab({ userId, profile, initialReviews, initialOrdering }) {
    const [reviews,        setReviews]        = useState(initialReviews || []);
    const [ordering,       setOrdering]       = useState(initialOrdering || 'recency');
    const [loading,        setLoading]        = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);

    const changeOrdering = async (val) => {
        setOrdering(val);
        setLoading(true);
        try {
            const { data } = await fetchVendorReviews(userId, val);
            setReviews(data.results || data);
        } catch { setReviews([]); }
        finally { setLoading(false); }
    };

    return (
        <div className="vd-section">
            {/* Summary card */}
            <SectionCard
                title="Customer Reviews"
                subtitle={`What customers say about ${profile?.business_name || 'your business'}`}
                action={
                    <div style={{ display: 'flex', gap: 6 }}>
                        {[['recency', '🕐 Newest'], ['rating', '★ Rating']].map(([val, label]) => (
                            <button
                                key={val}
                                className={`vd-btn vd-btn--sm ${ordering === val ? 'vd-btn--primary' : 'vd-btn--ghost'}`}
                                onClick={() => changeOrdering(val)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                }
            >
                {reviews.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                        {[
                            [reviews.length, 'Total', '#1D4ED8'],
                            [(reviews.reduce((s, r) => s + (r.vendor_rating || 0), 0) / reviews.length).toFixed(1), 'Avg Rating', '#E8A020'],
                            [reviews.filter(r => (r.vendor_rating || 0) >= 4).length, 'Positive', '#059669'],
                            [reviews.filter(r => (r.vendor_rating || 0) <= 2).length, 'Critical', '#EF4444'],
                        ].map(([v, l, color]) => (
                            <div key={l} style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color }}>{v}</div>
                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--vm)', marginTop: 3 }}>{l}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {loading ? (
                <div className="vd-loading"><div className="vd-spinner" /> Loading reviews…</div>
            ) : (
                <>
                    {/* Desktop */}
                    <div className="cd-bookings-desktop">
                        <DataTable
                            columns={desktopColumns}
                            data={reviews}
                            searchable
                            searchKeys={['customer_name', 'vehicle_display', 'review_text']}
                            searchPlaceholder="Search reviews…"
                            filters={[{
                                key: 'vendor_rating', label: 'Rating',
                                options: [{ value: '', label: 'All Ratings' }, ...[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} ★` }))],
                            }]}
                            onRowAction={row => setSelectedReview(row)}
                            actionLabel="View Review"
                            emptyIcon="💬"
                            emptyMessage="No reviews yet."
                            pageSize={20}
                        />
                    </div>

                    {/* Mobile */}
                    <div className="cd-bookings-mobile">
                        <MobileReviewList reviews={reviews} onSelectReview={setSelectedReview} />
                    </div>
                </>
            )}
        </div>
    );
}