import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { createBooking, dummyPayment } from '../services/api';
import Navbar from '../components/common/Navbar';
import './ConfirmBookingPage.css';
import './BookingWizard.css';

const SEG_ICON = s =>
    s === 'luxury' ? '🏎️' : s === 'suv' ? '🚙' : s === 'van' ? '🚐' : '🚗';

export default function ConfirmBookingPage() {
    const navigate = useNavigate();
    const { booking, reset } = useBooking();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [paymentType, setPaymentType] = useState('advance'); // 'advance' or 'full'
    const [paymentMethod, setPaymentMethod] = useState('online');

    useEffect(() => {
        if (!booking.selectedVehicle || !user) {
            navigate('/');
        }
    }, [booking.selectedVehicle, user, navigate]);

    if (!booking.selectedVehicle || !user) return null;

    const v = booking.selectedVehicle;
    const p = booking.pricingBreakdown;
    const nights = Math.max(1, Math.round(
        (new Date(booking.returnDate) - new Date(booking.pickupDate)) / 86400000
    ));

    const grandTotal = p ? parseFloat(p.grand_total) : 0;
    const advanceAmount = Math.round(grandTotal * 30 / 100);
    const remainingAmount = grandTotal - advanceAmount;

    const payableNow = paymentType === 'full' ? grandTotal : advanceAmount;

    const handleBookingWithPayment = async () => {
        setLoading(true);
        setError('');

        try {
            // 1. Create the booking first (PENDING status)
            const { data } = await createBooking({
                vehicle_id: v.id,
                pickup_date: booking.pickupDate,
                return_date: booking.returnDate,
                pickup_time: booking.pickupTime || null,
                return_time: booking.returnTime || null,
                pickup_location: booking.pickupLocation?.id,
                return_location: booking.returnLocation?.id || null,
                addons: booking.selectedAddons || [],
                one_way_fee: booking.oneWayFee || 0,
                promo_code: booking.promoCode || undefined,
            });

            // 2. Immediately process payment
            const paymentData = await dummyPayment(data.booking_id, {
                payment_type: paymentType,
                method: paymentMethod
            });

            setSuccess({
                ...data,
                payment: paymentData.data
            });
            reset();
        } catch (err) {
            const d = err.response?.data;
            setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Booking or payment failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Success screen
    if (success) {
        return (
            <div className="confirm-page">
                <Navbar />
                <div className="confirm-page__inner">
                    <div className="confirm-success">
                        <div className="confirm-success__icon">🎉</div>
                        <h1>Booking & Payment Complete!</h1>
                        <p>Your rental has been successfully booked and your payment has been processed.</p>
                        <div className="confirm-success__ref">
                            Booking Reference: {success.booking_ref}
                        </div>
                        <div className="confirm-success__payment">
                            <p>Payment Details:</p>
                            <p>Amount Paid: ₹{success.payment.amount_paid}</p>
                            <p>Payment Method: {success.payment.payment_type} via {success.payment.method}</p>
                            {success.payment.remaining_amount > 0 && (
                                <p className="confirm-success__remaining">
                                    Remaining Balance: ₹{success.payment.remaining_amount}
                                    <small>(Payable before or at drop-off)</small>
                                </p>
                            )}
                        </div>
                        <div className="confirm-success__note">
                            A confirmation email has been sent to <strong>{user.email}</strong>.
                            Please carry your driving licence at pickup.
                        </div>
                        <button className="confirm-success__dashboard" onClick={() => navigate('/customer')}>
                            View My Bookings →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="confirm-page">
            <Navbar />
            <div className="confirm-page__inner">

                {/* Progress */}
                <div className="wizard-progress">
                    <div className="wizard-progress__step done"><span>✓</span> Car</div>
                    <div className="wizard-progress__step done"><span>✓</span> Vendor</div>
                    {booking.isDifferentReturn && <div className="wizard-progress__step done"><span>✓</span> Return</div>}
                    <div className="wizard-progress__step done"><span>✓</span> Add-ons</div>
                    <div className="wizard-progress__step active">
                        <span>{booking.isDifferentReturn ? 5 : 4}</span> Confirm & Pay
                    </div>
                </div>

                <h1 className="confirm-page__title">Review & Complete Payment</h1>

                <div className="confirm-page__layout">
                    {/* Left side - Booking details */}
                    <div className="confirm-card">
                        {/* Vehicle */}
                        <section className="confirm-section">
                            <h3>Vehicle</h3>
                            <div className="confirm-vehicle">
                                <span className="confirm-vehicle__icon">{SEG_ICON(v.segment)}</span>
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
                                    ['📍 Pickup Vendor', `${booking.pickupLocation?.name || '—'}, ${booking.pickupCity?.name || ''}`],
                                    ...(booking.isDifferentReturn ? [['🏁 Return Vendor', `${booking.returnLocation?.name || '—'}, ${booking.returnCity?.name || ''}`]] : []),
                                    ['📅 Pickup', `${booking.pickupDate}${booking.pickupTime ? ' @ ' + booking.pickupTime : ''}`],
                                    ['📅 Return', `${booking.returnDate}${booking.returnTime ? ' @ ' + booking.returnTime : ''}`],
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

                    {/* Right side - Payment summary */}
                    <aside className="confirm-summary">
                        <h3>Payment Summary</h3>

                        {p && (
                            <>
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
                                        🔒 Security deposit: ₹{parseFloat(p.security_deposit).toLocaleString('en-IN')}
                                        <small> (refundable)</small>
                                    </div>
                                </div>

                                {/* Payment Type Selection */}
                                <div className="payment-type-section">
                                    <p className="payment-type-label">Pay now:</p>
                                    <div className="payment-type-buttons">
                                        <button
                                            className={`payment-type-btn ${paymentType === 'advance' ? 'active' : ''}`}
                                            onClick={() => setPaymentType('advance')}
                                        >
                                            Advance (30%)<br />
                                            <small>₹{advanceAmount.toLocaleString('en-IN')}</small>
                                        </button>
                                        <button
                                            className={`payment-type-btn ${paymentType === 'full' ? 'active' : ''}`}
                                            onClick={() => setPaymentType('full')}
                                        >
                                            Full Payment<br />
                                            <small>₹{grandTotal.toLocaleString('en-IN')}</small>
                                        </button>
                                    </div>
                                </div>

                                {/* Payment Method Selection */}
                                <div className="payment-method-section">
                                    <p className="payment-method-label">Payment method:</p>
                                    <div className="payment-method-buttons">
                                        <button
                                            className={`payment-method-btn ${paymentMethod === 'online' ? 'active' : ''}`}
                                            onClick={() => setPaymentMethod('online')}
                                        >
                                            💳 Online (UPI/Cards)
                                        </button>
                                        <button
                                            className={`payment-method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                                            onClick={() => setPaymentMethod('cash')}
                                        >
                                            💵 Cash at Pickup
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {error && <div className="wizard-error">{error}</div>}

                        <button className="confirm-cta" onClick={handleBookingWithPayment} disabled={loading}>
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
                </div>
            </div>
        </div>
    );
}