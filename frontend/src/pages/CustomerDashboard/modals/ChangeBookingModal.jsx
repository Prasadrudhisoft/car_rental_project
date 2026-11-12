import React, { useEffect, useState } from 'react';
import {
    quoteBookingModification,
    applyBookingModification,
    payBookingModification,
} from '../../../services/api';

const inr = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const errMsg = e =>
    e?.response?.data?.detail || e?.response?.data?.error || 'Something went wrong. Please try again.';

/**
 * Customer: change dates (or upgrade, when vehicleId is passed) on a CONFIRMED booking.
 * Step 1 "edit"  -> live quote -> Confirm.
 * Step 2 "pay"   -> only when the new price is higher; the change applies once the top-up is paid.
 */
export default function ChangeBookingModal({ booking, detail, vehicleId, onClose, onRefresh, showToast }) {
    const src = { ...booking, ...(detail || {}) };
    const [pickup, setPickup] = useState(src.pickup_date || '');
    const [ret,    setRet]    = useState(src.return_date || '');
    const [quote,  setQuote]  = useState(null);
    const [busy,   setBusy]   = useState(false);
    const [error,  setError]  = useState('');
    const [step,   setStep]   = useState('edit');      // 'edit' | 'pay'
    const [due,    setDue]    = useState(0);

    const today   = new Date().toISOString().slice(0, 10);
    const invalid = !pickup || !ret || ret < pickup || pickup < today;
    const unchanged = pickup === src.pickup_date && ret === src.return_date && !vehicleId;

    const body = {
        pickup_date: pickup,
        return_date: ret,
        pickup_time: src.pickup_time || undefined,
        return_time: src.return_time || undefined,
        vehicle_id:  vehicleId || undefined,
    };

    // Live quote (debounced, ignores stale responses).
    useEffect(() => {
        if (step !== 'edit') return undefined;
        setQuote(null);
        setError('');
        if (invalid) return undefined;
        let live = true;
        const t = setTimeout(async () => {
            setBusy(true);
            try {
                const { data } = await quoteBookingModification(booking.id, body);
                if (live) setQuote(data);
            } catch (e) {
                if (live) setError(errMsg(e));
            } finally {
                if (live) setBusy(false);
            }
        }, 350);
        return () => { live = false; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickup, ret, vehicleId, booking.id, step]);

    const amountDue = Number(quote?.amount_due_now || 0);
    const refundDue = Number(quote?.refund_due || 0);

    const confirm = async () => {
        setBusy(true);
        setError('');
        try {
            const { data } = await applyBookingModification(booking.id, body);
            if (data.status === 'payment_required') {
                setDue(Number(data.amount_due));
                setStep('pay');
            } else {
                const r = Number(data.refund_due || 0);
                showToast(r > 0 ? `Booking updated. ${inr(r)} refund is due to you.` : 'Booking updated.');
                onRefresh?.();
                onClose();
            }
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    const pay = async () => {
        setBusy(true);
        setError('');
        try {
            const { data } = await payBookingModification(booking.id, { method: 'online' });
            showToast(data?.message || 'Payment received. Your booking has been updated.');
            onRefresh?.();
            onClose();
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
            <div className="cd-modal" onClick={e => e.stopPropagation()}>
                <div className="cd-modal__head">
                    <h3 className="cd-modal__title">{step === 'pay' ? 'Pay the difference' : vehicleId ? 'Upgrade vehicle' : 'Change booking dates'}</h3>
                    <button className="cd-modal__close" onClick={onClose} disabled={busy}>&times;</button>
                </div>

                <div className="cd-modal__body">
                    {step === 'edit' && (
                        <>
                            <div className="cd-fg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                                    Pickup date
                                    <input type="date" className="cd-input" min={today} value={pickup}
                                        onChange={e => setPickup(e.target.value)} />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
                                    Return date
                                    <input type="date" className="cd-input" min={pickup || today} value={ret}
                                        onChange={e => setRet(e.target.value)} />
                                </label>
                            </div>

                            {ret && pickup && ret < pickup && (
                                <p style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>Return date must be on or after pickup.</p>
                            )}
                            {error && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
                            {busy && !quote && !error && <p style={{ fontSize: 12, marginTop: 8 }}>Calculating…</p>}

                            {quote && (
                                <div className="cd-payment-breakdown" style={{ marginTop: 14 }}>
                                    <div className="cd-payment-breakdown__row"><span>Current total</span><strong>{inr(quote.old_total)}</strong></div>
                                    <div className="cd-payment-breakdown__row"><span>New total</span><strong>{inr(quote.new_total)}</strong></div>
                                    {Number(quote.modification_fee) > 0 && (
                                        <div className="cd-payment-breakdown__row"><span>Change fee</span><strong>{inr(quote.modification_fee)}</strong></div>
                                    )}
                                    <div className="cd-payment-breakdown__divider" />
                                    {amountDue > 0 && <div className="cd-payment-breakdown__row"><span>To pay now</span><strong>{inr(amountDue)}</strong></div>}
                                    {amountDue === 0 && refundDue > 0 && <div className="cd-payment-breakdown__row"><span>Refund due to you</span><strong style={{ color: '#059669' }}>{inr(refundDue)}</strong></div>}
                                    {amountDue === 0 && refundDue === 0 && <div className="cd-payment-breakdown__row"><span>No price difference</span><strong>{inr(0)}</strong></div>}
                                    {!quote.free_window && <small style={{ color: 'var(--cd-muted)' }}>The free-change window has ended, so a change fee applies.</small>}
                                    {quote.available === false && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>Not available for these dates.</p>}
                                </div>
                            )}
                        </>
                    )}

                    {step === 'pay' && (
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <p style={{ color: 'var(--cd-muted)' }}>Your new dates are held until the extra amount is paid.</p>
                            <h2 style={{ margin: '10px 0' }}>{inr(due)}</h2>
                            {error && <p style={{ color: '#EF4444', fontSize: 12 }}>{error}</p>}
                        </div>
                    )}
                </div>

                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose} disabled={busy}>
                        {step === 'pay' ? 'Keep original booking' : 'Cancel'}
                    </button>
                    {step === 'edit' ? (
                        <button className="cd-btn cd-btn--primary" onClick={confirm}
                            disabled={busy || !quote || invalid || unchanged || quote.available === false}>
                            {busy && quote ? 'Saving…' : amountDue > 0 ? 'Continue to payment' : 'Confirm change'}
                        </button>
                    ) : (
                        <button className="cd-btn cd-btn--primary" onClick={pay} disabled={busy}>
                            {busy ? 'Processing…' : `Pay ${inr(due)}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
