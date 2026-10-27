import React, { useState, useEffect } from 'react';
import { payBooking, loadPaymentConfig, paymentErrorMessage } from '../../../services/payments';

const inr = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PaymentModal({ booking, detail, onClose, onSuccess, showToast }) {
    const ps = detail?.payment_summary || {};
    const [type, setType]       = useState(ps.next_type === 'remaining' ? 'remaining' : 'advance');
    const [loading, setLoading] = useState(false);
    const [mode, setMode]       = useState(null);
    useEffect(() => { loadPaymentConfig().then(c => setMode(c.mode)).catch(() => setMode('unavailable')); }, []);

    if (!ps.next_type) {
        return (
            <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="cd-modal">
                    <div className="cd-modal__head"><h3 className="cd-modal__title">Payment</h3>
                        <button className="cd-modal__close" onClick={onClose}>&times;</button></div>
                    <div className="cd-modal__body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                        <h3>{ps.fully_paid ? 'Fully Paid' : 'No payment due'}</h3>
                        <p style={{ color: 'var(--cd-muted)', marginTop: 8 }}>Total {inr(ps.total)}.</p>
                    </div>
                    <div className="cd-modal__foot"><button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button></div>
                </div>
            </div>
        );
    }

    const amount = { advance: ps.advance_amount, full: ps.total, remaining: ps.remaining_amount }[type];

    const handlePay = async () => {
        setLoading(true);
        try {
            const res = await payBooking({ bookingId: booking.id, paymentType: type });
            showToast(`${inr(res.amount_paid)} received.`);
            onSuccess?.();
            onClose();
        } catch (e) {
            showToast(paymentErrorMessage(e), 'error');
            onSuccess?.();
        } finally { setLoading(false); }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal">
                <div className="cd-modal__head"><h3 className="cd-modal__title">Payment</h3>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button></div>
                <div className="cd-modal__body">
                    {mode === 'dummy' && <div className="cd-error" style={{ background: '#FEF3C7', color: '#92400E' }}>TEST MODE — no real money is charged.</div>}
                    {mode === 'unavailable' && <div className="cd-error">Online payments are temporarily unavailable.</div>}
                    <div className="cd-payment-breakdown">
                        <div className="cd-payment-breakdown__row"><span>Grand Total</span><strong>{inr(ps.total)}</strong></div>
                        <div className="cd-payment-breakdown__row"><span>Already paid</span><strong>{inr(ps.amount_paid)}</strong></div>
                        <div className="cd-payment-breakdown__divider" />
                        {ps.next_type === 'advance' ? (
                            <div className="cd-payment-modes">
                                {[['advance', `Advance Payment (${ps.advance_pct}%)`, ps.advance_amount],
                                  ['full', 'Full Payment', ps.total]].map(([val, label, amt]) => (
                                    <button key={val} className={`cd-payment-mode${type === val ? ' active' : ''}`} onClick={() => setType(val)}>
                                        <div><strong>{label}</strong><small>{inr(amt)}</small></div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="cd-payment-breakdown__row"><span>Remaining balance</span><strong>{inr(ps.remaining_amount)}</strong></div>
                        )}
                    </div>
                    <p className="cd-payment-note">💳 Online payment only (UPI / Cards / Net Banking).</p>
                </div>
                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button>
                    <button className="cd-btn cd-btn--primary" onClick={handlePay} disabled={loading || mode === 'unavailable'}>
                        {loading ? 'Processing…' : `Pay ${inr(amount)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}