import React, { useState, useEffect, useRef } from 'react';
import { useNavigate }                from 'react-router-dom';
import { useBooking }                 from '../../context/BookingContext';
import { useAuth }                    from '../../context/AuthContext';
import { createBooking, dummyPayment, getActiveAgreement } from '../../services/api';
import Navbar                         from '../../components/common/Navbar';
import { AgreementPreviewModal }      from '../../components/agreements/AgreementModal';
import { WizardProgress, buildSteps } from './BookingShared';
import { calcNights }                 from './bookingConstants';
import { BookingReviewCard, PaymentSummary } from './ConfirmComponents';
import ModifyBookingModal from './ModifyBookingModal';
import './ConfirmBookingPage.css';
import '../BookingWizard.css';

export default function ConfirmBookingPage() {
    const navigate             = useNavigate();
    const { booking, reset }   = useBooking();
    const { user }             = useAuth();

    const [loading,        setLoading]        = useState(false);
    const [error,          setError]          = useState('');
    const [paymentType,    setPaymentType]    = useState('advance');
    const paymentMethod = 'online';
    const [agreement,      setAgreement]      = useState(null);
    const [agreementError, setAgreementError] = useState('');
    const [agreed,         setAgreed]         = useState(false);
    const [showAgreement,  setShowAgreement]  = useState(false);
    const completedRef = useRef(false);
    const [showModify, setShowModify] = useState(false);

    useEffect(() => {
        if (completedRef.current) return;
        if (booking.isDifferentReturn && !booking.returnLocation && booking.selectedVehicle) {
            navigate('/book/return-vendor'); return;
        }
        if (!booking.selectedVehicle || !user) navigate('/');
    }, [booking.selectedVehicle, booking.isDifferentReturn, booking.returnLocation, user, navigate]);

    useEffect(() => {
        getActiveAgreement()
            .then(({ data }) => setAgreement(data))
            .catch(() => setAgreementError('Could not load the Rental Agreement. Please refresh.'));
    }, []);

    if (!booking.selectedVehicle || !user) return null;

    const v      = booking.selectedVehicle;
    const p      = booking.pricingBreakdown;
    const nights = calcNights(booking.pickupDate, booking.returnDate);

    const grandTotal      = p ? parseFloat(p.grand_total) : 0;
    const advanceAmount   = Math.round(grandTotal * 30 / 100);
    const remainingAmount = grandTotal - advanceAmount;
    const payableNow      = paymentType === 'full' ? grandTotal : advanceAmount;

    const handleBookingWithPayment = async () => {
        if (!agreed || !agreement) {
            setError('Please accept the Rental Agreement to continue.');
            return;
        }
        setLoading(true);
        setError('');
        try {
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
                agreement_accepted:   true,
                agreement_version_id: agreement.id,
            });

            await dummyPayment(data.booking_id, {
                payment_type: paymentType,
                method:       paymentMethod,
            });

            completedRef.current = true;
            navigate('/customer?tab=bookings', {
                replace: true,
                state: { toast: `Booking ${data.booking_ref} confirmed. Payment received.` },
            });
            reset();
        } catch (err) {
            const d = err.response?.data;
            if (d?.code === 'agreement_outdated') {
                setAgreed(false);
                getActiveAgreement().then(({ data }) => setAgreement(data)).catch(() => {});
            }
            setError(
                typeof d === 'object' && d
                    ? (d.error || Object.values(d).flat().join(' '))
                    : 'Booking or payment failed. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const steps = buildSteps('confirm', booking.isDifferentReturn);

    return (
        <div className="confirm-page">
            <Navbar />
            <div className="confirm-page__inner">
                <WizardProgress steps={steps} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h1 className="confirm-page__title">Review &amp; Complete Payment</h1>
                    <button className="wizard-btn--back" onClick={() => setShowModify(true)}>✎ Modify booking details</button>
                </div>

                <div className="confirm-page__layout">
                    <BookingReviewCard
                        booking={booking}
                        vehicle={v}
                        user={user}
                        nights={nights}
                        pricing={p}
                    />

                    <PaymentSummary
                        pricing={p}
                        grandTotal={grandTotal}
                        advanceAmount={advanceAmount}
                        remainingAmount={remainingAmount}
                        paymentType={paymentType}
                        unavailable={p?.available === false}
                        paymentMethod={paymentMethod}
                        payableNow={payableNow}
                        loading={loading}
                        error={error}
                        onConfirm={handleBookingWithPayment}
                        agreement={agreement}
                        agreementError={agreementError}
                        agreed={agreed}
                        setAgreed={setAgreed}
                        onViewAgreement={() => setShowAgreement(true)}
                    />
                </div>
            </div>

            {showAgreement && agreement && (
                <AgreementPreviewModal version={agreement} onClose={() => setShowAgreement(false)} />
            )}
            {showModify && <ModifyBookingModal onClose={() => setShowModify(false)} />}
        </div>
    );
}