// ─────────────────────────────────────────────────────────────────────────────
// ConfirmBookingPage.jsx  (Step 4/5 — Confirm & Pay)
// Route: /book/confirm  (RequireAuth)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useNavigate }                from 'react-router-dom';
import { useBooking }                 from '../../context/BookingContext';
import { useAuth }                    from '../../context/AuthContext';
import { createBooking, dummyPayment } from '../../services/api';
import Navbar                         from '../../components/common/Navbar';
import { WizardProgress, buildSteps } from './BookingShared';
import { calcNights }                 from './bookingConstants';
import { BookingReviewCard, PaymentSummary } from './ConfirmComponents';
import './ConfirmBookingPage.css';
import '../BookingWizard.css';

export default function ConfirmBookingPage() {
    const navigate             = useNavigate();
    const { booking, reset }   = useBooking();
    const { user }             = useAuth();

    const [loading,        setLoading]        = useState(false);
    const [error,          setError]          = useState('');
    const [success,        setSuccess]        = useState(null);
    const [paymentType,    setPaymentType]    = useState('advance');
    const [paymentMethod,  setPaymentMethod]  = useState('online');

    useEffect(() => {
        if (!booking.selectedVehicle || !user) navigate('/');
    }, [booking.selectedVehicle, user, navigate]);

    if (!booking.selectedVehicle || !user) return null;

    const v      = booking.selectedVehicle;
    const p      = booking.pricingBreakdown;
    const nights = calcNights(booking.pickupDate, booking.returnDate);

    const grandTotal     = p ? parseFloat(p.grand_total) : 0;
    const advanceAmount  = Math.round(grandTotal * 30 / 100);
    const remainingAmount = grandTotal - advanceAmount;
    const payableNow     = paymentType === 'full' ? grandTotal : advanceAmount;

    // ── Confirm + pay ─────────────────────────────────────────────────────────
    const handleBookingWithPayment = async () => {
        setLoading(true);
        setError('');
        try {
            // 1. Create booking (PENDING)
            const { data } = await createBooking({
                vehicle_id:       v.id,
                pickup_date:      booking.pickupDate,
                return_date:      booking.returnDate,
                pickup_time:      booking.pickupTime      || null,
                return_time:      booking.returnTime      || null,
                pickup_location:  booking.pickupLocation?.id,
                return_location:  booking.returnLocation?.id || null,
                addons:           booking.selectedAddons  || [],
                one_way_fee:      booking.oneWayFee       || 0,
                promo_code:       booking.promoCode       || undefined,
            });

            // 2. Process payment immediately
            const paymentData = await dummyPayment(data.booking_id, {
                payment_type: paymentType,
                method:       paymentMethod,
            });

            setSuccess({ ...data, payment: paymentData.data });
            reset();
        } catch (err) {
            const d = err.response?.data;
            setError(
                typeof d === 'object'
                    ? Object.values(d).flat().join(' ')
                    : 'Booking or payment failed. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    // ── Success screen ────────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="confirm-page">
                <Navbar />
                <div className="confirm-page__inner">
                    <div className="confirm-success">
                        <div className="confirm-success__icon">🎉</div>
                        <h1>Booking &amp; Payment Complete!</h1>
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
                                    <small> (Payable before or at drop-off)</small>
                                </p>
                            )}
                        </div>
                        <div className="confirm-success__note">
                            A confirmation email has been sent to <strong>{user.email}</strong>.
                            Please carry your driving licence at pickup.
                        </div>
                        <button
                            className="confirm-success__dashboard"
                            onClick={() => navigate('/customer')}
                        >
                            View My Bookings →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main confirm page ─────────────────────────────────────────────────────
    const steps = buildSteps('confirm', booking.isDifferentReturn);

    return (
        <div className="confirm-page">
            <Navbar />
            <div className="confirm-page__inner">
                <WizardProgress steps={steps} />

                <h1 className="confirm-page__title">Review &amp; Complete Payment</h1>

                <div className="confirm-page__layout">
                    {/* Left — booking details */}
                    <BookingReviewCard
                        booking={booking}
                        vehicle={v}
                        user={user}
                        nights={nights}
                        pricing={p}
                    />

                    {/* Right — payment */}
                    <PaymentSummary
                        pricing={p}
                        grandTotal={grandTotal}
                        advanceAmount={advanceAmount}
                        remainingAmount={remainingAmount}
                        paymentType={paymentType}
                        setPaymentType={setPaymentType}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        payableNow={payableNow}
                        loading={loading}
                        error={error}
                        onConfirm={handleBookingWithPayment}
                    />
                </div>
            </div>
        </div>
    );
}