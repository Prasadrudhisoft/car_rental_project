import React, { useState } from 'react';
import { vendorRescheduleBooking, vendorMarkNoShow } from '../../services/api';

const errMsg = e =>
    e?.response?.data?.detail || e?.response?.data?.error || 'Something went wrong.';

/**
 * Vendor actions for a CONFIRMED booking: reschedule (reason required) and mark no-show.
 * The server enforces the no-show grace period; the button only appears once pickup time has passed.
 */
export default function VendorBookingActions({ booking, onRefresh, showToast }) {
    const [mode,    setMode]    = useState(null);              // null | 'reschedule' | 'noshow'
    const [pickup,  setPickup]  = useState(booking.pickup_date || '');
    const [ret,     setRet]     = useState(booking.return_date || '');
    const [reason,  setReason]  = useState('');
    const [busy,    setBusy]    = useState(false);

    if (booking.status !== 'CONFIRMED') return null;

    const today = new Date().toISOString().slice(0, 10);
    const pickupPassed =
        new Date(`${booking.pickup_date}T${booking.pickup_time || '00:00:00'}`) <= new Date();
    const unchanged = pickup === booking.pickup_date && ret === booking.return_date;

    const run = async (fn, okText) => {
        setBusy(true);
        try {
            await fn();
            showToast(okText);
            setMode(null);
            onRefresh();
        } catch (e) {
            showToast(errMsg(e), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="vd-action-block">
            <p className="vd-action-label">Manage booking</p>

            {!mode && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="vd-btn vd-btn--outline vd-btn--sm" onClick={() => setMode('reschedule')}>
                        Reschedule
                    </button>
                    {pickupPassed && (
                        <button className="vd-btn vd-btn--danger-outline vd-btn--sm" onClick={() => setMode('noshow')}>
                            Mark no-show
                        </button>
                    )}
                </div>
            )}

            {mode === 'reschedule' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>New pickup date
                            <input type="date" className="vd-input" min={today} value={pickup}
                                onChange={e => setPickup(e.target.value)} />
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>New return date
                            <input type="date" className="vd-input" min={pickup || today} value={ret}
                                onChange={e => setRet(e.target.value)} />
                        </label>
                    </div>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>Reason
                        <textarea className="vd-input vd-textarea" rows={2} value={reason}
                            placeholder="Why is the booking being moved?"
                            onChange={e => setReason(e.target.value)} />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="vd-btn vd-btn--success vd-btn--sm"
                            disabled={busy || unchanged || !reason.trim() || !pickup || !ret || ret < pickup}
                            onClick={() => run(
                                () => vendorRescheduleBooking(booking.id, { pickup_date: pickup, return_date: ret, reason }),
                                'Booking rescheduled.',
                            )}>
                            {busy ? 'Saving…' : 'Confirm reschedule'}
                        </button>
                        <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => setMode(null)} disabled={busy}>Cancel</button>
                    </div>
                </div>
            )}

            {mode === 'noshow' && (
                <div className="vd-cancel-confirm">
                    <span style={{ fontSize: 12 }}>
                        The customer did not collect the vehicle. Dates are released and the advance is retained.
                    </span>
                    <button className="vd-btn vd-btn--danger vd-btn--sm" disabled={busy}
                        onClick={() => run(() => vendorMarkNoShow(booking.id), 'Booking marked as no-show.')}>
                        {busy ? 'Saving…' : 'Yes, mark no-show'}
                    </button>
                    <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => setMode(null)} disabled={busy}>Keep it</button>
                </div>
            )}
        </div>
    );
}
