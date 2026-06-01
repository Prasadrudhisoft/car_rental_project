// ─────────────────────────────────────────────────────────────────────────────
// tabs/ReviewsTab.jsx
// Summary stats card + DataTable + ordering buttons.
// Owns its own review fetch (triggered by ordering toggle).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import DataTable from '../../../components/common/DataTable';
import { SectionCard } from '../VendorShared';
import ReviewDetailModal from '../modals/ReviewDetailModal';
import { fetchVendorReviews } from '../../../services/api';
import { fmtDate } from '../vendorConstants';

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

    const columns = [
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
            render: v => (
                <span style={{ display: 'inline-flex', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} style={{ fontSize: 14, color: n <= (v || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>
                    ))}
                </span>
            ),
        },
        {
            key: 'vehicle_rating', label: 'Vehicle ★', sortable: true, width: 130,
            render: v => (
                <span style={{ display: 'inline-flex', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} style={{ fontSize: 14, color: n <= (v || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>
                    ))}
                </span>
            ),
        },
        {
            key: 'review_text', label: 'Review', sortable: false,
            render: v => v
                ? <span style={{ fontSize: 12, color: 'var(--vt2)', fontStyle: 'italic', display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{v}"</span>
                : <span style={{ color: 'var(--vm)', fontSize: 11 }}>No text</span>,
        },
        { key: 'created_at', label: 'Date', sortable: true, width: 110, render: v => fmtDate(v) },
    ];

    return (
        <div className="vd-section">
            {selectedReview && (
                <ReviewDetailModal review={selectedReview} onClose={() => setSelectedReview(null)} />
            )}

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
                            [reviews.length,                                                                                            'Total',    '#1D4ED8'],
                            [(reviews.reduce((s, r) => s + (r.vendor_rating || 0), 0) / reviews.length).toFixed(1),                    'Avg Rating','#E8A020'],
                            [reviews.filter(r => (r.vendor_rating || 0) >= 4).length,                                                  'Positive', '#059669'],
                            [reviews.filter(r => (r.vendor_rating || 0) <= 2).length,                                                  'Critical', '#EF4444'],
                        ].map(([v, l, color]) => (
                            <div key={l} style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color }}>{v}</div>
                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--vm)', marginTop: 3 }}>{l}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {loading
                ? <div className="vd-loading"><div className="vd-spinner" /> Loading reviews…</div>
                : (
                    <DataTable
                        columns={columns}
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
                )
            }
        </div>
    );
}