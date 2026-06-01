// ─────────────────────────────────────────────────────────────────────────────
// tabs/MyReviewsTab.jsx
// All reviews the customer has already submitted.
// "View Review" button opens ViewReviewModal in the parent.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import DataTable from '../../../components/common/DataTable';
import { fmtDate } from '../cdConstants';

function Stars({ value }) {
    return (
        <span style={{ display: 'inline-flex', gap: 1 }}>
            {[1, 2, 3, 4, 5].map(n => (
                <span
                    key={n}
                    style={{ fontSize: 14, color: n <= (value || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}
                >
                    ★
                </span>
            ))}
        </span>
    );
}

export default function MyReviewsTab({ submittedReviews, loading, onViewReview }) {
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
    );
}