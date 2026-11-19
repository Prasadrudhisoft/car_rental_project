import React, { useState } from 'react';
import { vendorMarkNoShow, recordOfflinePayment } from '../../services/api';
import BookingChangeModal from '../../components/common/BookingChangeModal';

const errMsg = e => e?.response?.data?.detail || e?.response?.data?.error || 'Something went wrong.';

export default function VendorBookingActions({ booking, onRefresh, showToast }) {
    const [mode, setMode] = useState(null);                // null | 'change' | 'noshow'
    const [busy, setBusy] = useState(false);
    const [method, setMethod] = useState('cash');
    if (booking.status !== 'CONFIRMED') return null;

    const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const pickupDayOver = booking.pickup_date < todayStr;     // server enforces the same rule
    const pending = booking.pending_modification;

    const run = async (fn, okText) => {
        setBusy(true);
        try { await fn(); showToast(okText); setMode(null); onRefresh(); }
        catch (e) { showToast(errMsg(e), 'error'); }
        finally { setBusy(false); }
    };

    return (
        <div className="vd-action-block">
            <p className="vd-action-label">Manage booking</p>

            {pending && (
                <div className="vd-cancel-confirm">
                    <span style={{ fontSize: 12 }}>Change awaiting customer payment of ₹{Number(pending.amount_due).toLocaleString('en-IN')}.</span>
                    <select className="vd-input" style={{ width: 90 }} value={method} onChange={e => setMethod(e.target.value)}>
                        <option value="cash">Cash</option><option value="upi">UPI</option>
                    </select>
                    <button className="vd-btn vd-btn--success vd-btn--sm" disabled={busy}
                            onClick={() => run(() => recordOfflinePayment(booking.id, method, 'modification'), 'Payment recorded, booking updated.')}>
                        Record payment received
                    </button>
                </div>
            )}

            {!mode && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!pickupDayOver && <button className="vd-btn vd-btn--outline vd-btn--sm" onClick={() => setMode('change')}>Change dates / vehicle / location</button>}
                    {pickupDayOver && <button className="vd-btn vd-btn--danger-outline vd-btn--sm" onClick={() => setMode('noshow')}>Mark no-show</button>}
                </div>
            )}

            {mode === 'change' && (
                <BookingChangeModal role="vendor" booking={booking} onClose={() => setMode(null)}
                                    onRefresh={onRefresh} showToast={showToast} />
            )}

            {mode === 'noshow' && (
                <div className="vd-cancel-confirm">
                    <span style={{ fontSize: 12 }}>The customer did not collect the vehicle on the pickup date. Dates are released and the advance is retained.</span>
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