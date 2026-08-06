import React, { useState } from 'react';
import { dummyPayment } from '../../../services/api';

export default function PaymentModal({ booking, detail, onClose, onSuccess, showToast }) {
    const [method,  setMethod]  = useState('online');
    const [loading, setLoading] = useState(false);

    const pricing       = detail?.pricing_snapshot || {};
    const grandTotal    = parseFloat(pricing.grand_total || booking.total_amount || 0);
    const deposit       = parseFloat(pricing.security_deposit || detail?.deposit_amount || 0);
    const advancePct    = 30;
    const advanceAmt    = Math.round((grandTotal * advancePct) / 100);
    const remaining     = grandTotal - advanceAmt;
    const advancePaid   = pricing.advance_paid   || false;
    const remainingPaid = pricing.remaining_paid || false;
    const fullPaid      = pricing.full_payment_paid || (advancePaid && remainingPaid);
    const canPayRemaining = advancePaid && !remainingPaid && !fullPaid;
    const payableNow    = canPayRemaining ? remaining : advanceAmt;

    const handlePay = async () => {
        setLoading(true);
        try {
            const pt = canPayRemaining ? 'remaining' : 'advance';
            const { data } = await dummyPayment(booking.id, { payment_type: pt, method });
            showToast(data.message || 'Payment successful!');
            onSuccess?.();
            onClose();
        } catch (e) {
            showToast(e.response?.data?.error || 'Payment failed.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Already fully paid
    if (fullPaid || (advancePaid && remainingPaid)) {
        return (
            <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="cd-modal">
                    <div className="cd-modal__head">
                        <h3 className="cd-modal__title">Payment</h3>
                        <button className="cd-modal__close" onClick={onClose}>&times;</button>
                    </div>
                    <div className="cd-modal__body" style={{ alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: '#D1FAE5', border: '2px solid #6EE7B7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 14px', fontSize: 24,
                        }}>✓</div>
                        <h3 style={{ fontWeight: 700 }}>Fully Paid</h3>
                        <p style={{ color: 'var(--cd-muted)', marginTop: 8 }}>
                            Grand Total ₹{grandTotal.toLocaleString('en-IN')} — all payments received.
                        </p>
                    </div>
                    <div className="cd-modal__foot">
                        <button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal">
                <div className="cd-modal__head">
                    <h3 className="cd-modal__title">Payment</h3>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>

                <div className="cd-modal__body">
                    {/* Breakdown */}
                    <div className="cd-payment-breakdown">
                        <div className="cd-payment-breakdown__row">
                            <span>Grand Total</span>
                            <strong>₹{grandTotal.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="cd-payment-breakdown__row">
                            <span>Security Deposit</span>
                            <span className="cd-muted-val">₹{deposit.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="cd-payment-breakdown__divider" />
                        <div
                            className="cd-payment-breakdown__row"
                            style={advancePaid ? { opacity: 0.5 } : {}}
                        >
                            <span>Advance ({advancePct}%)</span>
                            <strong style={advancePaid ? { color: '#059669' } : {}}>
                                {advancePaid ? 'Paid' : `₹${advanceAmt.toLocaleString('en-IN')}`}
                            </strong>
                        </div>
                        <div
                            className="cd-payment-breakdown__row"
                            style={remainingPaid ? { opacity: 0.5 } : {}}
                        >
                            <span>Remaining (70%)</span>
                            <strong style={remainingPaid ? { color: '#059669' } : {}}>
                                {remainingPaid ? 'Paid' : `₹${remaining.toLocaleString('en-IN')}`}
                            </strong>
                        </div>
                    </div>

                    {/* Payment method */}
                    <div style={{ marginTop: 16 }}>
                        <p style={{
                            fontSize: 12, fontWeight: 700,
                            color: 'var(--cd-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.5px', marginBottom: 8,
                        }}>
                            Payment Method
                        </p>
                        <div className="cd-payment-modes">
                            {[
                                ['online', 'Online Payment', 'UPI, Cards, Net Banking'],
                                ['cash',   'Cash',           'Pay at vendor location'],
                            ].map(([val, label, sub]) => (
                                <button
                                    key={val}
                                    className={`cd-payment-mode${method === val ? ' active' : ''}`}
                                    onClick={() => setMethod(val)}
                                >
                                    <span className={`payment-icon ${val}`}></span>
                                    <div>
                                        <strong>{label}</strong>
                                        <small>{sub}</small>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="cd-btn cd-btn--primary"
                        onClick={handlePay}
                        disabled={loading}
                    >
                        {loading ? 'Processing…' : `Pay ₹${payableNow.toLocaleString('en-IN')} Now`}
                    </button>
                </div>
            </div>
        </div>
    );
}