// ─────────────────────────────────────────────────────────────────────────────
// tabs/ReviewsTab.jsx
// Pending reviews — bookings the customer can still leave a review for.
// "Write Review" button opens WriteReviewModal in the parent.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import DataTable from '../../../components/common/DataTable';

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
    );
}