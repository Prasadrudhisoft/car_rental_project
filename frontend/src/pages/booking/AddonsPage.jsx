import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { calculatePrice } from '../../services/api';
import { WizardShell, WizardProgress, buildSteps, useAuthModal } from './BookingShared';
import { calcNights, segIcon } from './bookingConstants';
import { AddonGrid, PromoSection, PriceSummary } from './AddonsComponents';
import ModifyBookingModal from './ModifyBookingModal';
import './AddonsPage.css';
import '../BookingWizard.css';

export default function AddonsPage() {
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const { user } = useAuth();
    const { openAuth, AuthModalEl } = useAuthModal(() => navigate('/book/confirm'));

    const [pricing, setPricing] = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [priceError, setPriceError] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoMsg, setPromoMsg] = useState('');
    const [addons, setAddons] = useState([]);
    const [showModify, setShowModify] = useState(false);
    const [appliedPromo, setAppliedPromo] = useState('');

    useEffect(() => {
        if (!booking.selectedVehicle) navigate('/');
    }, [booking.selectedVehicle, navigate]);

    const v = booking.selectedVehicle;
    const nights = calcNights(booking.pickupDate, booking.returnDate);

    // Recalculate price whenever add-ons, return city, or promo code changes.
    useEffect(() => {
        if (!v) return;

        const fetchPrice = async () => {
            setLoadingPrice(true);
            setPriceError('');

            try {
                const { data } = await calculatePrice({
                    vehicle_id: v.id,
                    pickup_date: booking.pickupDate,
                    return_date: booking.returnDate,
                    pickup_time: booking.pickupTime || null,
                    return_time: booking.returnTime || null,
                    addons,
                    return_city_id: booking.isDifferentReturn
                        ? booking.returnCity?.id
                        : undefined,
                    promo_code: appliedPromo || undefined,
                });

                setPricing(data);

                update({
                    pricingBreakdown: data,
                    selectedAddons: addons,
                    promoCode: data.promo_code || '',
                });

                if (data.promo_error) {
                    setPromoMsg(`❌ ${data.promo_error}`);
                    setAppliedPromo(''); // Re-price without the invalid code.
                } else if (data.promo_code) {
                    setPromoMsg(
                        `✅ ${data.promo_code} applied — you save ₹${parseFloat(
                            data.discount_amount
                        ).toLocaleString('en-IN')}`
                    );
                }

                if (data.available === false) {
                    setPriceError(
                        'This vehicle is not available for the selected dates. Modify your booking or choose another vehicle.'
                    );
                }
            } catch {
                setPriceError(
                    'Could not calculate price. Please check your connection.'
                );
                setPricing(null);
            } finally {
                setLoadingPrice(false);
            }
        };

        fetchPrice();
    }, [
        addons,
        v?.id,
        booking.pickupDate,
        booking.returnDate,
        booking.pickupTime,
        booking.returnTime,
        booking.returnCity,
        booking.isDifferentReturn,
        appliedPromo,
    ]);

    if (!v) return null;

    // ── Add-on toggle — enforces insurance mutual exclusion ────────────────────
    const toggleAddon = key => {
        if (
            key === 'insurance_basic' &&
            addons.includes('insurance_comprehensive')
        ) {
            setAddons(p =>
                p.filter(k => k !== 'insurance_comprehensive').concat(key)
            );
            return;
        }

        if (
            key === 'insurance_comprehensive' &&
            addons.includes('insurance_basic')
        ) {
            setAddons(p =>
                p.filter(k => k !== 'insurance_basic').concat(key)
            );
            return;
        }

        setAddons(prev =>
            prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key]
        );
    };

    // ── Promo ─────────────────────────────────────────────────────────────────
    const handleApplyPromo = () => {
        const code = promoCode.trim().toUpperCase();
        if (!code) return;

        setPromoMsg('');
        setAppliedPromo(code);
    };

    const handleRemovePromo = () => {
        setAppliedPromo('');
        setPromoCode('');
        setPromoMsg('');
    };

    // ── CTA ───────────────────────────────────────────────────────────────────
    const handleConfirm = () => {
        if (!user) {
            openAuth();
            return;
        }

        if (booking.isDifferentReturn && !booking.returnLocation) {
            navigate('/book/return-vendor');
            return;
        }

        navigate('/book/confirm');
    };

    const steps = buildSteps('addons', booking.isDifferentReturn);

    return (
        <WizardShell onLoginClick={openAuth} className="addons-page">
            <WizardProgress steps={steps} />

            <div className="addons-page__layout">
                {/* ── Left column ── */}
                <div className="addons-page__left">
                    {/* Vehicle recap */}
                    <div className="addons-recap">
                        <div className="addons-recap__icon">
                            {segIcon(v.segment)}
                        </div>

                        <div className="addons-recap__details">
                            <h2>
                                {v.year} {v.make} {v.model}
                            </h2>

                            <div className="addons-recap__meta">
                                ⛽ {v.fuel_type} · ⚙️ {v.transmission} · 💺{' '}
                                {v.capacity} seats
                            </div>

                            <div className="addons-recap__vendor">
                                🏪{' '}
                                {v.vendor_profile?.business_name ||
                                    'Selected Vendor'}{' '}
                                ·{' '}
                                <span className="addons-recap__rate">
                                    ₹
                                    {parseInt(v.daily_rate).toLocaleString(
                                        'en-IN'
                                    )}
                                    /day
                                </span>
                            </div>
                        </div>

                        <button
                            className="addons-recap__change"
                            onClick={() =>
                                navigate('/book/select-vendor')
                            }
                        >
                            ← Change
                        </button>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                        }}
                    >
                        <button
                            className="addons-recap__change"
                            onClick={() => setShowModify(true)}
                        >
                            ✎ Modify booking details
                        </button>
                    </div>

                    {/* Trip recap strip */}
                    <div className="addons-trip-recap">
                        <div className="addons-trip-recap__item">
                            <span>📍 Pickup</span>
                            <strong>
                                {[
                                    booking.pickupLocation?.name,
                                    booking.pickupLocation?.address,
                                ]
                                    .filter(Boolean)
                                    .join(', ') || '—'}
                            </strong>
                        </div>

                        {booking.isDifferentReturn &&
                            booking.returnLocation && (
                                <div className="addons-trip-recap__item">
                                    <span>🏁 Return</span>
                                    <strong>
                                        {[
                                            booking.returnLocation.name,
                                            booking.returnLocation.address,
                                        ]
                                            .filter(Boolean)
                                            .join(', ')}
                                    </strong>
                                </div>
                            )}

                        <div className="addons-trip-recap__item">
                            <span>📅 From</span>
                            <strong>
                                {booking.pickupDate}
                                {booking.pickupTime
                                    ? ` @ ${booking.pickupTime}`
                                    : ''}
                            </strong>
                        </div>

                        <div className="addons-trip-recap__item">
                            <span>📅 To</span>
                            <strong>
                                {booking.returnDate}
                                {booking.returnTime
                                    ? ` @ ${booking.returnTime}`
                                    : ''}
                            </strong>
                        </div>

                        <div className="addons-trip-recap__item">
                            <span>⏱ Duration</span>
                            <strong>
                                {nights} day{nights > 1 ? 's' : ''}
                            </strong>
                        </div>
                    </div>

                    {/* Add-ons grid */}
                    {/* <AddonGrid
                        addons={addons}
                        onToggle={toggleAddon}
                        addonPrices={pricing?.addon_breakdown}
                    /> */}

                    {/* Promo */}
                    <PromoSection
                        promoCode={promoCode}
                        onCodeChange={setPromoCode}
                        onApply={handleApplyPromo}
                        onRemove={handleRemovePromo}
                        applied={pricing?.promo_code}
                        loading={loadingPrice}
                        message={promoMsg}
                    />
                </div>

                {/* ── Right column: price summary ── */}
                <aside className="addons-page__summary">
                    <PriceSummary
                        pricing={pricing}
                        loadingPrice={loadingPrice}
                        priceError={priceError}
                        nights={nights}
                        vehicle={v}
                        addons={addons}
                        isLoggedIn={!!user}
                        ctaDisabled={
                            loadingPrice ||
                            !pricing ||
                            (pricing?.min_rental_days > 1 &&
                                nights < pricing.min_rental_days) ||
                            pricing?.available === false
                        }
                        onCTA={handleConfirm}
                    />
                </aside>
            </div>

            {showModify && (
                <ModifyBookingModal
                    onClose={() => setShowModify(false)}
                />
            )}

            {AuthModalEl}
        </WizardShell>
    );
}