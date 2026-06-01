// ─────────────────────────────────────────────────────────────────────────────
// ConfirmComponents.jsx
// Two sub-components used exclusively by ConfirmBookingPage:
//   • BookingReviewCard  — left column: vehicle / trip / addons / renter
//   • PaymentSummary     — right column: amounts + payment type/method picker
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { segIcon } from './bookingConstants';

// ── BookingReviewCard ─────────────────────────────────────────────────────────
/**
 * Renders the full left-column booking detail card on the confirm page.
 */
export function BookingReviewCard({ booking, vehicle: v, user, nights }) {
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
                            ? [['🏁 Return Vendor', `${booking.returnLocation?.name || '—'}, ${booking.returnCity?.name || ''}`]]
                            : []),
                        ['📅 Pickup',  `${booking.pickupDate}${booking.pickupTime ? ' @ ' + booking.pickupTime : ''}`],
                        ['📅 Return',  `${booking.returnDate}${booking.returnTime ? ' @ ' + booking.returnTime : ''}`],
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
/**
 * Renders the right-column sticky payment summary with payment
 * type (advance vs full) and method (online vs cash) selectors.
 */
export function PaymentSummary({
    pricing,
    grandTotal,
    advanceAmount,
    remainingAmount,
    paymentType,
    setPaymentType,
    paymentMethod,
    setPaymentMethod,
    payableNow,
    loading,
    error,
    onConfirm,
}) {
    return (
        <aside className="confirm-summary">
            <h3>Payment Summary</h3>

            {pricing && (
                <>
                    {/* Amounts */}
                    <div className="confirm-summary__lines">
                        <div className="confirm-summary__line">
                            <span>Grand Total</span>
                            <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="confirm-summary__line">
                            <span>Advance (30%)</span>
                            <span>₹{advanceAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="confirm-summary__line">
                            <span>Remaining (70%)</span>
                            <span>₹{remainingAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="confirm-summary__deposit">
                            🔒 Security deposit: ₹{parseFloat(pricing.security_deposit).toLocaleString('en-IN')}
                            <small> (refundable)</small>
                        </div>
                    </div>

                    {/* Payment type */}
                    <div className="payment-type-section">
                        <p className="payment-type-label">Pay now:</p>
                        <div className="payment-type-buttons">
                            <button
                                className={`payment-type-btn${paymentType === 'advance' ? ' active' : ''}`}
                                onClick={() => setPaymentType('advance')}
                            >
                                Advance (30%)<br />
                                <small>₹{advanceAmount.toLocaleString('en-IN')}</small>
                            </button>
                            <button
                                className={`payment-type-btn${paymentType === 'full' ? ' active' : ''}`}
                                onClick={() => setPaymentType('full')}
                            >
                                Full Payment<br />
                                <small>₹{grandTotal.toLocaleString('en-IN')}</small>
                            </button>
                        </div>
                    </div>

                    {/* Payment method */}
                    <div className="payment-method-section">
                        <p className="payment-method-label">Payment method:</p>
                        <div className="payment-method-buttons">
                            <button
                                className={`payment-method-btn${paymentMethod === 'online' ? ' active' : ''}`}
                                onClick={() => setPaymentMethod('online')}
                            >
                                💳 Online (UPI/Cards)
                            </button>
                            <button
                                className={`payment-method-btn${paymentMethod === 'cash' ? ' active' : ''}`}
                                onClick={() => setPaymentMethod('cash')}
                            >
                                💵 Cash at Pickup
                            </button>
                        </div>
                    </div>
                </>
            )}

            {error && <div className="wizard-error">{error}</div>}

            <button className="confirm-cta" onClick={onConfirm} disabled={loading}>
                {loading ? (
                    <span className="confirm-cta__loading">
                        <span className="confirm-cta__spinner" /> Processing Payment...
                    </span>
                ) : `Pay ₹${payableNow.toLocaleString('en-IN')} & Confirm Booking`}
            </button>

            <p className="confirm-terms">
                By confirming you agree to the rental agreement terms.
                Free cancellation up to 48 hours before pickup.
            </p>
        </aside>
    );
}