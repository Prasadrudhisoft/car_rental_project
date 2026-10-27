// Route: /book/confirm  (RequireAuth role=customer)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate }                from 'react-router-dom';
import { useBooking }                 from '../../context/BookingContext';
import { useAuth }                    from '../../context/AuthContext';
import { createBooking, getActiveAgreement } from '../../services/api';
import { payBooking, loadPaymentConfig, paymentErrorMessage } from '../../services/payments';
import Navbar                         from '../../components/common/Navbar';
import { AgreementPreviewModal }      from '../../components/agreements/AgreementModal';
import { WizardProgress, buildSteps } from './BookingShared';
import { calcNights }                 from './bookingConstants';
import { BookingReviewCard, PaymentSummary } from './ConfirmComponents';
import ModifyBookingModal             from './ModifyBookingModal';
import './ConfirmBookingPage.css';
import '../BookingWizard.css';

export default function ConfirmBookingPage() {
    const navigate = useNavigate();
    const { booking, update, reset } = useBooking();
    const { user } = useAuth();

    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState('');
    const [paymentType, setPaymentType] = useState('advance');
    const [payCfg, setPayCfg]           = useState(null);
    const [agreement, setAgreement]     = useState(null);
    const [agreementError, setAgreementError] = useState('');
    const [agreed, setAgreed]           = useState(false);
    const [showAgreement, setShowAgreement] = useState(false);
    const [showModify, setShowModify]   = useState(false);
    const completedRef = useRef(false);

    useEffect(() => {
        if (completedRef.current) return;
        if (booking.isDifferentReturn && !booking.returnLocation && booking.selectedVehicle) {
            navigate('/book/return-vendor'); return;
        }
        if (!booking.selectedVehicle || !user) navigate('/');
    }, [booking.selectedVehicle, booking.isDifferentReturn, booking.returnLocation, user, navigate]);

    useEffect(() => {
        getActiveAgreement().then(({ data }) => setAgreement(data))
            .catch(() => setAgreementError('Could not load the Rental Agreement. Please refresh.'));
        loadPaymentConfig().then(setPayCfg).catch(() => setPayCfg({ mode: 'unavailable' }));
    }, []);

    if (!booking.selectedVehicle || !user) return null;

    const v = booking.selectedVehicle;
    const p = booking.pricingBreakdown;
    const nights = calcNights(booking.pickupDate, booking.returnDate);

    // every number below comes from the server quote — no arithmetic here
    const grandTotal      = p ? parseFloat(p.grand_total) : 0;
    const advanceAmount   = p ? parseFloat(p.advance_amount) : 0;
    const remainingAmount = p ? parseFloat(p.remaining_amount) : 0;
    const payableNow      = paymentType === 'full' ? grandTotal : advanceAmount;

    const finish = (toast, toastType = 'success') => {
        completedRef.current = true;
        navigate('/customer?tab=bookings', { replace: true, state: { toast, toastType } });
        reset();
    };

    const handlePay = async () => {
        if (!agreed || !agreement) { setError('Please accept the Rental Agreement to continue.'); return; }
        setLoading(true); setError('');

        let created;
        try {
            const { data } = await createBooking({
                vehicle_id: v.id, pickup_date: booking.pickupDate, return_date: booking.returnDate,
                pickup_time: booking.pickupTime || null, return_time: booking.returnTime || null,
                pickup_location: booking.pickupLocation?.id, return_location: booking.returnLocation?.id || null,
                addons: booking.selectedAddons || [], promo_code: booking.promoCode || undefined,
                agreement_accepted: true, agreement_version_id: agreement.id,
            });
            created = data;
        } catch (err) {
            const d = err.response?.data;
            if (d?.code === 'agreement_outdated') {
                setAgreed(false);
                getActiveAgreement().then(({ data }) => setAgreement(data)).catch(() => {});
            }
            if (d?.code === 'promo_invalid') update({ promoCode: '' });
            setError(d?.error || (d && typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Could not create the booking.'));
            setLoading(false);
            return;
        }

        // the server is the source of truth: never charge an amount the customer did not see
        const serverTotal = parseFloat(created.pricing.grand_total);
        if (Math.abs(serverTotal - grandTotal) > 0.009) {
            setLoading(false);
            finish(`The price changed to ₹${serverTotal.toLocaleString('en-IN')}. Review it and complete payment from My Bookings.`, 'error');
            return;
        }

        try {
            const res = await payBooking({ bookingId: created.booking_id, paymentType });
            finish(`Booking ${created.booking_ref} confirmed. ₹${parseFloat(res.amount_paid ?? payableNow).toLocaleString('en-IN')} received.`);
        } catch (err) {
            setLoading(false);
            finish(`Booking ${created.booking_ref} saved as Pending — ${paymentErrorMessage(err)} Complete payment from this page.`, 'error');
        }
    };

    return (
        <div className="confirm-page">
            <Navbar />
            <div className="confirm-page__inner">
                <WizardProgress steps={buildSteps('confirm', booking.isDifferentReturn)} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h1 className="confirm-page__title">Review &amp; Complete Payment</h1>
                    <button className="wizard-btn--back" onClick={() => setShowModify(true)}>✎ Modify booking details</button>
                </div>

                <div className="confirm-page__layout">
                    <BookingReviewCard booking={booking} vehicle={v} user={user} nights={nights} pricing={p} />
                    <PaymentSummary
                        pricing={p} grandTotal={grandTotal} advanceAmount={advanceAmount}
                        remainingAmount={remainingAmount} paymentType={paymentType} setPaymentType={setPaymentType}
                        payableNow={payableNow} loading={loading} error={error} onConfirm={handlePay}
                        agreement={agreement} agreementError={agreementError} agreed={agreed} setAgreed={setAgreed}
                        onViewAgreement={() => setShowAgreement(true)}
                        unavailable={p?.available === false} mode={payCfg?.mode}
                    />
                </div>
            </div>

            {showAgreement && agreement && <AgreementPreviewModal version={agreement} onClose={() => setShowAgreement(false)} />}
            {showModify && <ModifyBookingModal onClose={() => setShowModify(false)} />}
        </div>
    );
}