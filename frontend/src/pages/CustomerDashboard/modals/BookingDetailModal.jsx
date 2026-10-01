import React, { useState } from 'react';
import { cancelBooking } from '../../../services/api';
import { AgreementViewModal, AgreementPreviewModal } from '../../../components/agreements/AgreementModal';
import BookingLocationMap from '../../../components/common/BookingLocationMap';
import { StatusBadge, InfoRow } from '../cdShared';
import { fmtDatetime } from '../cdConstants';
import InspectionPanel from '../InspectionPanel';
import PaymentModal    from './PaymentModal';
import InvoiceModal    from './InvoiceModal';

const SEG_ICON = seg =>
    seg === 'luxury' ? '🏎️' : seg === 'suv' ? '🚙' : seg === 'van' ? '🚐' : '🚗';

export default function BookingDetailModal({
    booking, detail, loading: detailLoading,
    onRefresh, showToast, onClose,
}) {
    const [showPayment,   setShowPayment]   = useState(false);
    const [showInvoice,   setShowInvoice]   = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [cancelReason,  setCancelReason]  = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);

    const pricing       = detail?.pricing_snapshot || {};
    const v             = detail?.vehicle   || {};
    const vendor        = detail?.vendor    || {};
    const grandTotal    = parseFloat(pricing.grand_total || detail?.total_amount || 0);
    const advancePct    = 30;
    const advanceAmt    = Math.round((grandTotal * advancePct) / 100);
    const remaining     = grandTotal - advanceAmt;
    const advancePaid   = pricing.advance_paid   || detail?.payment_captured || false;
    const remainingPaid = pricing.remaining_paid || false;
    const fullPaid      = pricing.full_payment_paid || (advancePaid && remainingPaid);
    const deposit       = parseFloat(pricing.security_deposit || detail?.deposit_amount || 0);

    const fmtLoc  = l => (l ? [l.name, l.address].filter(Boolean).join(', ') : '');
    const hasDrop = !!(detail?.is_one_way && detail?.return_location_detail);
    const canPayNow  = !fullPaid && advancePaid && !remainingPaid;
    const canCancel  = ['PENDING', 'CONFIRMED'].includes(booking.status);

    const canCreatePickupInsp =
        ['CONFIRMED'].includes(booking.status) &&
        detail?.agreement_signed &&
        !(detail?.inspections || []).find(i => i.inspection_type === 'PICKUP');

    const pickupInsp = (detail?.inspections || []).find(i => i.inspection_type === 'PICKUP');
    const returnInsp = (detail?.inspections || []).find(i => i.inspection_type === 'RETURN');

    const handleCancel = async () => {
        setCancelLoading(true);
        try {
            const { data } = await cancelBooking(
                booking.id,
                cancelReason || 'Customer requested cancellation',
            );
            showToast(`Booking cancelled. Refund: ₹${data.refund_amount}`);
            setCancelConfirm(false);
            onRefresh();
        } catch (e) {
            showToast(e.response?.data?.error || 'Could not cancel.', 'error');
        } finally {
            setCancelLoading(false);
        }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div
                className="cd-modal cd-modal--lg"
                style={{ maxWidth: 860, maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="cd-modal__head" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 15, fontWeight: 700, color: 'var(--cd-acc)',
                        }}>
                            {booking.booking_ref}
                        </span>
                        <StatusBadge status={booking.status} />
                        {detail?.agreement_signed && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                borderRadius: 999, background: '#D1FAE5',
                                color: '#059669', border: '1px solid #6EE7B7',
                            }}>
                                ✍ Signed
                            </span>
                        )}
                        {booking.is_one_way && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                borderRadius: 999, background: '#EDE9FE',
                                color: '#7C3AED', border: '1px solid #C4B5FD',
                            }}>
                                ONE-WAY
                            </span>
                        )}
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>

                {/* Scrollable body */}
                <div style={{
                    overflowY: 'auto', flex: 1,
                    padding: '18px 24px',
                    display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                    {detailLoading && (
                        <div className="cd-detail-loading">
                            <div className="cd-spinner" /> Loading details…
                        </div>
                    )}

                    {!detailLoading && detail && (
                        <>
                            {/* Vehicle summary card */}
                            <div className="cd-detail-vehicle-card">
                                <div className="cd-detail-vehicle-icon">
                                    <span style={{ fontSize: 40 }}>{SEG_ICON(v.segment)}</span>
                                </div>
                                <div className="cd-detail-vehicle-info">
                                    <h4>{v.year} {v.make} {v.model}</h4>
                                    <div className="cd-detail-vehicle-meta">
                                        <span>{v.plate_number}</span>
                                        <span>{v.fuel_type}</span>
                                        <span>{v.transmission}</span>
                                        <span>{v.capacity} seats</span>
                                        {v.is_certified && <span className="cd-cert-tag">Certified</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 4 }}>
                                        {vendor.vendor_profile?.business_name || vendor.full_name || '—'}
                                    </div>
                                </div>
                                <div className="cd-detail-status-col">
                                    <StatusBadge status={booking.status} />
                                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>
                                        ₹{parseFloat(detail.total_amount || 0).toLocaleString('en-IN')}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--cd-muted)' }}>Total</div>
                                </div>
                            </div>

                            {/* Detail grid */}
                            <div className="cd-detail-grid">
                                {/* Trip details */}
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Trip Details</div>
                                    <InfoRow label="Booking Ref" value={booking.booking_ref} />
                                    <InfoRow
                                        label="Pickup"
                                        value={`${detail.pickup_date}${detail.pickup_time ? ' @ ' + detail.pickup_time : ''}`}
                                    />
                                    <InfoRow
                                        label="Return"
                                        value={`${detail.return_date}${detail.return_time ? ' @ ' + detail.return_time : ''}`}
                                    />
                                    <InfoRow label="Duration" value={`${detail.rental_days} day(s)`} />
                                    <InfoRow label="Pickup At"  value={detail.pickup_location_detail?.name || '—'} />
                                        {detail.is_one_way && (
                                        <InfoRow label="Return At" value={detail.return_location_detail?.name || '—'} />)}
                                </div>

                                {/* Payment status */}
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Payment Status</div>
                                    <InfoRow
                                        label="Grand Total"
                                        value={`₹${grandTotal.toLocaleString('en-IN')}`}
                                        highlight
                                    />
                                    <InfoRow
                                        label={`Advance (${advancePct}%)`}
                                        value={advancePaid
                                            ? `Paid — ₹${advanceAmt.toLocaleString('en-IN')}`
                                            : `Due — ₹${advanceAmt.toLocaleString('en-IN')}`}
                                    />
                                    <InfoRow
                                        label="Remaining (70%)"
                                        value={(fullPaid || remainingPaid)
                                            ? `Paid — ₹${remaining.toLocaleString('en-IN')}`
                                            : `Due — ₹${remaining.toLocaleString('en-IN')}`}
                                    />
                                    <InfoRow
                                        label="Security Deposit"
                                        value={`₹${deposit.toLocaleString('en-IN')} (${detail.deposit_released ? 'Released' : detail.deposit_held ? 'Held' : 'Pending'})`}
                                    />
                                    {detail.invoice && (
                                        <button
                                            className="cd-btn cd-btn--outline cd-btn--sm"
                                            style={{ marginTop: 8 }}
                                            onClick={() => setShowInvoice(true)}
                                        >
                                            View Invoice
                                        </button>
                                    )}
                                </div>

                                {/* Agreement */}
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Rental Agreement</div>
                                    <InfoRow label="Status" value={detail.agreement_signed ? 'Accepted' : 'Not Accepted'} />
                                    {detail.agreement_signed_at && (
                                        <InfoRow label="Accepted On" value={fmtDatetime(detail.agreement_signed_at)} />
                                    )}
                                    {detail.agreement_acceptance?.version_tag && (
                                        <InfoRow label="Version" value={detail.agreement_acceptance.version_tag} />
                                    )}
                                    <button
                                        className="cd-btn cd-btn--ghost cd-btn--sm"
                                        onClick={() => setShowViewModal(true)}
                                    >
                                        View Agreement
                                    </button>
                                </div>

                                {/* Pricing breakdown */}
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Pricing Breakdown</div>
                                    <InfoRow
                                        label="Daily Rate"
                                        value={`₹${parseFloat(pricing.daily_rate || 0).toLocaleString('en-IN')}/day`}
                                    />
                                    <InfoRow
                                        label="Base Rental"
                                        value={`₹${parseFloat(pricing.base_amount || 0).toLocaleString('en-IN')}`}
                                    />
                                    <InfoRow
                                        label="GST (18%)"
                                        value={`₹${parseFloat(pricing.gst_amount || 0).toLocaleString('en-IN')}`}
                                    />
                                </div>
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">
                                        {hasDrop ? 'Pickup & Drop Points' : 'Pickup & Return Point'}
                                    </div>
                                    <InfoRow label="Pickup Point" value={fmtLoc(detail.pickup_location_detail)} />
                                    {hasDrop && (
                                        <InfoRow label="Drop Point" value={fmtLoc(detail.return_location_detail)} />
                                    )}
                                    <BookingLocationMap
                                        pickup={detail.pickup_location_detail}
                                        drop={hasDrop ? detail.return_location_detail : null}
                                    />
                                </div>
                            </div>

                            {/* Inspections */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{
                                    fontSize: 12, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.6px',
                                    color: 'var(--cd-muted)',
                                }}>
                                    Inspections
                                </div>
                                <div className="cd-inspection-grid">
                                    <InspectionPanel
                                        key={`pickup-${pickupInsp?.id}-${pickupInsp?.is_locked}`}
                                        bookingId={booking.id}
                                        inspectionType="PICKUP"
                                        existingInspection={pickupInsp}
                                        canCreate={canCreatePickupInsp}
                                        showToast={showToast}
                                        onRefresh={onRefresh}
                                    />
                                    <InspectionPanel
                                        key={`return-${returnInsp?.id}-${returnInsp?.is_locked}`}
                                        bookingId={booking.id}
                                        inspectionType="RETURN"
                                        existingInspection={returnInsp}
                                        canCreate={false}
                                        showToast={showToast}
                                        onRefresh={onRefresh}
                                    />
                                </div>
                            </div>

                            {/* Action bar */}
                            <div className="cd-booking-actions">
                                {canPayNow && (
                                    <div className="cd-action-block">
                                        <p className="cd-action-label">Outstanding Balance</p>
                                        <button
                                            className="cd-btn cd-btn--primary cd-btn--sm"
                                            onClick={() => setShowPayment(true)}
                                        >
                                            Pay Remaining ₹{remaining.toLocaleString('en-IN')}
                                        </button>
                                    </div>
                                )}
                                {canCancel && !cancelConfirm && (
                                    <button
                                        className="cd-btn cd-btn--danger-outline cd-btn--sm"
                                        style={{ marginLeft: 'auto' }}
                                        onClick={() => setCancelConfirm(true)}
                                    >
                                        Cancel Booking
                                    </button>
                                )}
                                {cancelConfirm && (
                                    <div className="cd-cancel-confirm" style={{ marginLeft: 'auto' }}>
                                        <input
                                            className="cd-input"
                                            placeholder="Reason (optional)"
                                            value={cancelReason}
                                            onChange={e => setCancelReason(e.target.value)}
                                        />
                                        <button
                                            className="cd-btn cd-btn--danger cd-btn--sm"
                                            onClick={handleCancel}
                                            disabled={cancelLoading}
                                        >
                                            {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
                                        </button>
                                        <button
                                            className="cd-btn cd-btn--ghost cd-btn--sm"
                                            onClick={() => setCancelConfirm(false)}
                                        >
                                            Keep It
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer close */}
                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button>
                </div>

                {/* Nested modals */}
                {showViewModal && (detail?.agreement_signed
                    ? (
                        <AgreementViewModal
                            booking={booking}
                            acceptance={detail.agreement_acceptance || {
                                agreement_version_id: null,
                                accepted_at:  detail.agreement_signed_at,
                                otp_verified: true,
                                booking_ref:  booking.booking_ref,
                                user_email:   null,
                            }}
                            onClose={() => setShowViewModal(false)}
                        />
                    ) : (
                        <AgreementPreviewModal onClose={() => setShowViewModal(false)} />
                    )
                )}
                {showPayment && (
                    <PaymentModal
                        booking={booking}
                        detail={detail}
                        onClose={() => setShowPayment(false)}
                        onSuccess={onRefresh}
                        showToast={showToast}
                    />
                )}
                {showInvoice && detail?.invoice && (
                    <InvoiceModal
                        invoice={detail.invoice}
                        booking={booking}
                        onClose={() => setShowInvoice(false)}
                    />
                )}
            </div>
        </div>
    );
}