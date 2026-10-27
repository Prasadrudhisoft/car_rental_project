// ─────────────────────────────────────────────────────────────────────────────
// BookingDetailPanel.jsx
// Full booking detail: customer info, trip details, payment status,
// pricing breakdown, inspections, damage claim, cancel.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { StatusBadge, InfoRow, Field, FormInput } from './VendorShared';
import InspectionPanel from './InspectionPanel';
import { recordOfflinePayment, cancelBooking, raiseDamageClaim } from '../../services/api';

export default function BookingDetailPanel({ booking, onClose, onRefresh, showToast }) {
    const pricing    = booking.pricing_snapshot || {};
    const grandTotal = parseFloat(pricing.grand_total || booking.total_amount || 0);
    const advancePct = 30;
    const advanceAmt = Math.round(grandTotal * advancePct / 100);
    const remaining  = grandTotal - advanceAmt;

    const advancePaid    = pricing.advance_paid    || booking.payment_captured || false;
    const remainingPaid  = pricing.remaining_paid  || false;
    const fullPaid       = pricing.full_payment_paid || (advancePaid && remainingPaid);
    const deposit        = parseFloat(pricing.security_deposit || booking.deposit_amount || 0);

    const customer     = booking.customer     || {};
    const customerName  = customer.full_name  || booking.customer_name  || '—';
    const customerEmail = customer.email      || booking.customer_email || '—';
    const customerPhone = customer.phone      || booking.customer_phone || '—';

    const pickupInsp       = (booking.inspections || []).find(i => i.inspection_type === 'PICKUP');
    const returnInsp       = (booking.inspections || []).find(i => i.inspection_type === 'RETURN');
    const canCreateReturn  = ['ACTIVE'].includes(booking.status);
    const canCancel        = ['PENDING', 'CONFIRMED'].includes(booking.status);
    const canPayRemaining  = advancePaid && !remainingPaid && !fullPaid && ['CONFIRMED', 'ACTIVE'].includes(booking.status);

    const [showPayForm,    setShowPayForm]    = useState(false);
    const [payMethod,      setPayMethod]      = useState('cash');
    const [payLoading,     setPayLoading]     = useState(false);
    const [cancelConfirm,  setCancelConfirm]  = useState(false);
    const [cancelReason,   setCancelReason]   = useState('');
    const [cancelLoading,  setCancelLoading]  = useState(false);
    const [damageForm,     setDamageForm]     = useState({ notes: '', amount: '' });
    const [damageLoading,  setDamageLoading]  = useState(false);

    const handleRecordPayment = async () => {
        setPayLoading(true);
        try {
            const { data } = await recordOfflinePayment(booking.id, payMethod);
            showToast(data.message || 'Payment recorded.');
            setShowPayForm(false);
            onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Could not record payment.', 'error'); }
        setPayLoading(false);
    };

    const handleCancel = async () => {
        setCancelLoading(true);
        try {
            await cancelBooking(booking.id, cancelReason || 'Vendor cancelled');
            showToast('Booking cancelled.');
            setCancelConfirm(false);
            onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Could not cancel.', 'error'); }
        setCancelLoading(false);
    };

    const handleDamageClaim = async () => {
        if (!damageForm.amount) { showToast('Enter claim amount.', 'error'); return; }
        setDamageLoading(true);
        try {
            await raiseDamageClaim(booking.id, damageForm);
            showToast('Damage claim raised.');
            setDamageForm({ notes: '', amount: '' });
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        setDamageLoading(false);
    };

    return (
        <div className="vd-detail-panel">
            {/* Head */}
            <div className="vd-detail-panel__head">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--vt2)', flexShrink: 0 }}>
                        CAR
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{booking.vehicle_display || 'Vehicle'}</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                            <StatusBadge status={booking.status} />
                            {booking.payment_captured && <span className="vd-flag vd-flag--ok">Payment Captured</span>}
                            {booking.agreement_signed && <span className="vd-flag vd-flag--ok">Agreement Signed</span>}
                            {booking.deposit_held     && <span className="vd-flag vd-flag--warn">Deposit Held</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>₹{parseFloat(booking.total_amount || 0).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 11, color: 'var(--vm)' }}>{booking.booking_ref}</div>
                    </div>
                </div>
                <button className="vd-close-btn" onClick={onClose}>← Back to List</button>
            </div>

            {/* Info grid */}
            <div className="vd-detail-panel__grid">
                {/* Customer */}
                <div className="vd-info-group">
                    <div className="vd-info-group__title">Customer</div>
                    <InfoRow label="Name"  value={customerName}  />
                    <InfoRow label="Email" value={customerEmail} />
                    <InfoRow label="Phone" value={customerPhone} />
                </div>

                {/* Trip */}
                <div className="vd-info-group">
                    <div className="vd-info-group__title">Trip Details</div>
                    <InfoRow label="Pickup"   value={`${booking.pickup_date}${booking.pickup_time ? ' @ ' + booking.pickup_time : ''}`} />
                    <InfoRow label="Return"   value={`${booking.return_date}${booking.return_time ? ' @ ' + booking.return_time : ''}`} />
                    <InfoRow label="Duration" value={`${booking.rental_days} day(s)`} />
                </div>

                {/* Payment status */}
                <div className="vd-info-group">
                    <div className="vd-info-group__title">Payment Status</div>
                    <InfoRow label="Grand Total"        value={`₹${grandTotal.toLocaleString('en-IN')}`} highlight />
                    <InfoRow label={`Advance (${advancePct}%)`} value={advancePaid ? `Paid — ₹${advanceAmt.toLocaleString('en-IN')}` : `Due — ₹${advanceAmt.toLocaleString('en-IN')}`} />
                    <InfoRow label="Remaining (70%)"    value={(fullPaid || remainingPaid) ? `Paid — ₹${remaining.toLocaleString('en-IN')}` : `Due — ₹${remaining.toLocaleString('en-IN')}`} />
                    <InfoRow label="Security Deposit"   value={`₹${deposit.toLocaleString('en-IN')} (${booking.deposit_released ? 'Released' : booking.deposit_held ? 'Held' : 'Pending'})`} />

                    {canPayRemaining && !showPayForm && (
                        <button className="vd-btn vd-btn--outline vd-btn--sm" style={{ marginTop: 8 }} onClick={() => setShowPayForm(true)}>
                            Record Remaining Payment
                        </button>
                    )}
                    {showPayForm && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #6EE7B7', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                            <strong style={{ fontSize: 13 }}>Record ₹{remaining.toLocaleString('en-IN')} received</strong>
                            <Field label="Payment Method">
                                <select className="vd-input vd-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                    <option value="cash">Cash</option>
                                    <option value="upi">UPI</option>
                                    <option value="online">Online</option>
                                </select>
                            </Field>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="vd-btn vd-btn--success vd-btn--sm" onClick={handleRecordPayment} disabled={payLoading}>
                                    {payLoading ? 'Recording…' : 'Confirm Received'}
                                </button>
                                <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => setShowPayForm(false)}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pricing breakdown */}
                <div className="vd-info-group">
                    <div className="vd-info-group__title">Pricing Breakdown</div>
                    <InfoRow label="Daily Rate"   value={`₹${parseFloat(pricing.daily_rate  || 0).toLocaleString('en-IN')}/day`} />
                    <InfoRow label="Base Rental"  value={`₹${parseFloat(pricing.base_amount || 0).toLocaleString('en-IN')}`} />
                    <InfoRow label="GST (18%)"    value={`₹${parseFloat(pricing.gst_amount  || 0).toLocaleString('en-IN')}`} />
                </div>
            </div>

            {/* Inspections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vm)' }}>Inspections</div>
                <div className="vd-inspection-grid">
                    <InspectionPanel
                        key={`pickup-${pickupInsp?.id}-${pickupInsp?.is_locked}`}
                        bookingId={booking.id}
                        inspectionType="PICKUP"
                        existingInspection={pickupInsp}
                        canCreate={false}
                        showToast={showToast}
                        onRefresh={onRefresh}
                    />
                    <InspectionPanel
                        key={`return-${returnInsp?.id}-${returnInsp?.is_locked}`}
                        bookingId={booking.id}
                        inspectionType="RETURN"
                        existingInspection={returnInsp}
                        canCreate={canCreateReturn}
                        showToast={showToast}
                        onRefresh={onRefresh}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="vd-booking-actions">
                {booking.status === 'COMPLETED' && (
                    <div className="vd-action-block">
                        <p className="vd-action-label">Raise Damage Claim</p>
                        <div className="vd-fg vd-fg--2">
                            <Field label="Notes">
                                <textarea className="vd-input vd-textarea" value={damageForm.notes} onChange={e => setDamageForm(p => ({ ...p, notes: e.target.value }))} />
                            </Field>
                            <FormInput label="Amount (₹)" type="number" value={damageForm.amount} onChange={e => setDamageForm(p => ({ ...p, amount: e.target.value }))} />
                        </div>
                        <button className="vd-btn vd-btn--danger vd-btn--sm" onClick={handleDamageClaim} disabled={damageLoading}>
                            {damageLoading ? '…' : 'Raise Claim'}
                        </button>
                    </div>
                )}
                {canCancel && !cancelConfirm && (
                    <button className="vd-btn vd-btn--danger-outline vd-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setCancelConfirm(true)}>
                        Cancel Booking
                    </button>
                )}
                {cancelConfirm && (
                    <div className="vd-cancel-confirm" style={{ marginLeft: 'auto' }}>
                        <input className="vd-input" placeholder="Reason (optional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} style={{ width: 200 }} />
                        <button className="vd-btn vd-btn--danger vd-btn--sm" onClick={handleCancel} disabled={cancelLoading}>
                            {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
                        </button>
                        <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => setCancelConfirm(false)}>Keep It</button>
                    </div>
                )}
            </div>
        </div>
    );
}