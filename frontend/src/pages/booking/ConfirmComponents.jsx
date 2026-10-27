// ─────────────────────────────────────────────────────────────────────────────
// ConfirmComponents.jsx
// Two sub-components used exclusively by ConfirmBookingPage:
//   • BookingReviewCard  — left column: vehicle / trip / addons / renter
//   • PaymentSummary     — right column: amounts + payment type/method picker
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { segIcon } from './bookingConstants';

// ── BookingReviewCard ─────────────────────────────────────────────────────────
const fmtPoint = loc => (loc ? [loc.name, loc.address].filter(Boolean).join(', ') || '—' : '—');

export function BookingReviewCard({ booking, vehicle: v, user, nights, pricing }) {
    return (
        <div className="confirm-card">

            {/* Vehicle */}
            <section className="confirm-section">
                <h3>Vehicle</h3>
                <div className="confirm-vehicle">
                    <span className="confirm-vehicle__icon">{segIcon(v.segment)}</span>
                    <div>
                        <strong>{v.year} {v.make} {v.model}</strong>
                        <p>⛽ {v.fuel_type} · ⚙️ {v.transmission} · 💺 {v.capacity} seats</p>
                        <p>🏪 {v.vendor_profile?.business_name || 'Vendor'}</p>
                        {pricing?.min_driver_age && (
                            <p style={{ fontSize: 11, color: 'var(--wz-muted)', marginTop: 2 }}>
                                Minimum driver age: {pricing.min_driver_age}+
                            </p>
                        )}
                    </div>
                    {v.is_certified && <span className="confirm-cert">🏅 Certified</span>}
                </div>
            </section>

            {/* Trip details */}
            <section className="confirm-section">
                <h3>Trip Details</h3>
                <div className="confirm-details">
                    {[
                        ['📍 Pickup Vendor',  `${booking.pickupLocation?.name || '—'}, ${booking.pickupCity?.name || ''}`],
                        ...(booking.isDifferentReturn
                            ? [['🏁 Drop Point', `${booking.returnLocation?.name || '—'}${booking.returnLocation?.address ? ', ' + booking.returnLocation.address : ''}, ${booking.returnCity?.name || ''}`]]
                            : []),
                        ['📍 Pickup Point', fmtPoint(booking.pickupLocation)],
                        ...(booking.isDifferentReturn ? [['🏁 Drop Point', fmtPoint(booking.returnLocation)]] : []),
                        ['⏱ Duration', `${nights} day${nights > 1 ? 's' : ''}`],
                    ].map(([label, value]) => (
                        <div key={label} className="confirm-detail-row">
                            <span>{label}</span>
                            <strong>{value}</strong>
                        </div>
                    ))}
                </div>
            </section>

            {/* Add-ons */}
            {booking.selectedAddons?.length > 0 && (
                <section className="confirm-section">
                    <h3>Selected Add-ons</h3>
                    <div className="confirm-addons">
                        {booking.selectedAddons.map(k => (
                            <span key={k} className="confirm-addon-tag">
                                {k.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* Renter */}
            <section className="confirm-section">
                <h3>Renter Details</h3>
                <div className="confirm-user-info">
                    <span>👤</span>
                    <div>
                        <strong>{user.full_name}</strong>
                        <p>{user.email}</p>
                        {user.phone && <p>{user.phone}</p>}
                    </div>
                </div>
            </section>
        </div>
    );
}

// ── PaymentSummary ────────────────────────────────────────────────────────────
const inr = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function PaymentSummary({
    pricing, grandTotal, advanceAmount, remainingAmount,
    paymentType, setPaymentType, payableNow, loading, error, onConfirm,
    agreement, agreementError, agreed, setAgreed, onViewAgreement, unavailable, mode,
}) {
    const discount = parseFloat(pricing?.discount_amount || 0);
    const blocked  = mode === 'unavailable';
    return (
        <aside className="confirm-summary">
            <h3>Payment Summary</h3>

            {mode === 'dummy' && (
                <div className="wizard-error" style={{ background: '#FEF3C7', borderColor: '#FCD34D', color: '#92400E' }}>
                    TEST MODE — no real money is charged.
                </div>
            )}
            {blocked && <div className="wizard-error">Online payments are temporarily unavailable. Please try again later.</div>}

            {pricing && (
                <>
                    <div className="confirm-summary__lines">
                        {discount > 0 && (
                            <div className="confirm-summary__line confirm-summary__line--discount">
                                <span>Promo {pricing.promo_code}</span><span>−{inr(discount)}</span>
                            </div>
                        )}
                        <div className="confirm-summary__line"><span>Grand Total (incl. GST)</span><span>{inr(grandTotal)}</span></div>
                        <div className="confirm-summary__line"><span>Advance ({pricing.advance_pct}%)</span><span>{inr(advanceAmount)}</span></div>
                        <div className="confirm-summary__line"><span>Remaining ({100 - pricing.advance_pct}%)</span><span>{inr(remainingAmount)}</span></div>
                        <div className="confirm-summary__deposit">
                            🔒 Security deposit: {inr(pricing.security_deposit)}<small> (refundable)</small>
                        </div>
                    </div>

                    <div className="payment-type-section">
                        <p className="payment-type-label">Pay now:</p>
                        <div className="payment-type-buttons">
                            <button className={`payment-type-btn${paymentType === 'advance' ? ' active' : ''}`}
                                    onClick={() => setPaymentType('advance')}>
                                Advance Payment<br /><small>{inr(advanceAmount)}</small>
                            </button>
                            <button className={`payment-type-btn${paymentType === 'full' ? ' active' : ''}`}
                                    onClick={() => setPaymentType('full')}>
                                Full Payment<br /><small>{inr(grandTotal)}</small>
                            </button>
                        </div>
                    </div>
                    <div className="confirm-summary__deposit">💳 Online payment only (UPI / Cards / Net Banking)</div>
                </>
            )}

            <label className="confirm-agreement">
                <input type="checkbox" checked={!!agreed} disabled={!agreement} onChange={e => setAgreed(e.target.checked)} />
                <span>
                    I agree to the{' '}
                    <button type="button" className="confirm-agreement__link" onClick={onViewAgreement} disabled={!agreement}>
                        Rental Agreement and Terms &amp; Conditions
                    </button>
                    {agreement ? ` (${agreement.version_tag})` : ''}.
                </span>
            </label>
            {agreementError && <div className="wizard-error">{agreementError}</div>}
            {!agreed && !agreementError && <p className="confirm-agreement-hint">Please accept the agreement to enable payment.</p>}

            {unavailable && <div className="wizard-error">This vehicle is not available for the selected dates. Use “Modify booking details”.</div>}
            {error && <div className="wizard-error">{error}</div>}

            <button className="confirm-cta" onClick={onConfirm}
                    disabled={loading || !agreed || !agreement || unavailable || blocked}>
                {loading
                    ? <span className="confirm-cta__loading"><span className="confirm-cta__spinner" /> Processing…</span>
                    : `Pay ${inr(payableNow)} & Confirm Booking`}
            </button>
            <p className="confirm-terms">Free cancellation up to {pricing?.cancellation_free_hours ?? 48} hours before pickup.</p>
        </aside>
    );
}