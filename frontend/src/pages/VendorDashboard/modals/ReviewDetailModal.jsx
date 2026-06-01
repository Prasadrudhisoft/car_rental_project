// ─────────────────────────────────────────────────────────────────────────────
// ReviewDetailModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { fmtDate } from '../vendorConstants';

function Stars({ value, size = 18 }) {
    return (
        <span style={{ display: 'inline-flex', gap: 1 }}>
            {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ fontSize: size, color: n <= (value || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>
            ))}
        </span>
    );
}

export default function ReviewDetailModal({ review: r, onClose }) {
    const ratingColor = (r.vendor_rating || 0) >= 4 ? '#059669' : (r.vendor_rating || 0) === 3 ? '#D97706' : '#EF4444';
    const ratingBg    = (r.vendor_rating || 0) >= 4 ? '#D1FAE5' : (r.vendor_rating || 0) === 3 ? '#FEF3C7' : '#FEE2E2';

    return (
        <div className="vd-modal-overlay" onClick={onClose}>
            <div className="vd-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="vd-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                            Review from {r.customer_name || 'Customer'}
                        </h2>
                        <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: 'var(--vm)' }}>{r.vehicle_display || '—'}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 999, background: ratingBg, color: ratingColor }}>
                                ★ {r.vendor_rating || 0}/5
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="vd-close-btn">✕ Close</button>
                </div>

                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vm)', marginBottom: 6 }}>Vendor Rating</div>
                            <Stars value={r.vendor_rating} />
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vm)', marginBottom: 6 }}>Vehicle Rating</div>
                            <Stars value={r.vehicle_rating} />
                        </div>
                    </div>

                    {[['Customer', r.customer_name || '—'], ['Vehicle', r.vehicle_display || '—'], ['Date', fmtDate(r.created_at)]].map(([l, v]) => (
                        <div key={l} className="vd-info-pair">
                            <span>{l}</span><strong>{v}</strong>
                        </div>
                    ))}

                    {r.review_text && (
                        <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontStyle: 'italic', color: 'var(--vt2)', lineHeight: 1.65 }}>
                            "{r.review_text}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}