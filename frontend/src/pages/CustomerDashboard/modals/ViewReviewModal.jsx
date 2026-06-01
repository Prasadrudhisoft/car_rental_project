// ─────────────────────────────────────────────────────────────────────────────
// modals/ViewReviewModal.jsx
// Read-only display of a customer's previously submitted review.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { fmtDate } from '../cdConstants';

function Stars({ value, size = 20 }) {
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

export default function ViewReviewModal({ review: r, onClose }) {
    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Your Review</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>
                            {r.vehicle_display} · {r.booking_ref}
                        </p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>

                {/* Body */}
                <div className="cd-modal__body">
                    {/* Star ratings */}
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                        <div>
                            <p className="cd-review-label">Vendor Rating</p>
                            <Stars value={r.vendor_rating} />
                        </div>
                        <div>
                            <p className="cd-review-label">Vehicle Rating</p>
                            <Stars value={r.vehicle_rating} />
                        </div>
                    </div>

                    {/* Meta rows */}
                    <div className="cd-info-row cd-info-row--bordered">
                        <span className="cd-info-row__lbl">Vehicle</span>
                        <strong>{r.vehicle_display || '—'}</strong>
                    </div>
                    <div className="cd-info-row cd-info-row--bordered">
                        <span className="cd-info-row__lbl">Submitted</span>
                        <strong>
                            {r.created_at
                                ? fmtDate(r.created_at)
                                : r.return_date ? `Returned: ${r.return_date}` : '—'}
                        </strong>
                    </div>

                    {/* Review text */}
                    {r.review_text && (
                        <div style={{
                            background: 'var(--cd-surf2)',
                            border: '1px solid var(--cd-bdr)',
                            borderRadius: 8, padding: '12px 16px',
                            fontSize: 13, fontStyle: 'italic',
                            color: 'var(--cd-txt2)', lineHeight: 1.65,
                        }}>
                            "{r.review_text}"
                        </div>
                    )}

                    {/* Status badge */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: '3px 10px', borderRadius: 999,
                            background: '#D1FAE5', color: '#059669',
                            border: '1px solid #6EE7B7',
                        }}>
                            ✓ Submitted
                        </span>
                    </div>
                </div>

                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}