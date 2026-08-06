// ─────────────────────────────────────────────────────────────────────────────
// AddonsPage.jsx  (Step 3/4 — Add-ons & Pricing)
// Route: /book/addons
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useNavigate }                from 'react-router-dom';
import { useBooking }                 from '../../context/BookingContext';
import { useAuth }                    from '../../context/AuthContext';
import { calculatePrice, validatePromo } from '../../services/api';
import { WizardShell, WizardProgress, buildSteps, useAuthModal } from './BookingShared';
import { calcNights, segIcon }        from './bookingConstants';
import { AddonGrid, PromoSection, PriceSummary } from './AddonsComponents';
import './AddonsPage.css';
import '../BookingWizard.css';

export default function AddonsPage() {
    const navigate             = useNavigate();
    const { booking, update }  = useBooking();
    const { user }             = useAuth();
    const { openAuth, AuthModalEl } = useAuthModal(() => navigate('/book/confirm'));

    const [pricing,       setPricing]       = useState(null);
    const [loadingPrice,  setLoadingPrice]  = useState(false);
    const [priceError,    setPriceError]    = useState('');
    const [promoCode,     setPromoCode]     = useState('');
    const [promoMsg,      setPromoMsg]      = useState('');
    const [promoLoading,  setPromoLoading]  = useState(false);
    const [addons,        setAddons]        = useState([]);

    useEffect(() => {
        if (!booking.selectedVehicle) navigate('/');
    }, [booking.selectedVehicle, navigate]);

    const v      = booking.selectedVehicle;
    const nights = calcNights(booking.pickupDate, booking.returnDate);

    // Recalculate price whenever addons change
    useEffect(() => {
        if (!v) return;
        const fetchPrice = async () => {
            setLoadingPrice(true); setPriceError('');
            try {
                const { data } = await calculatePrice({
                    vehicle_id:  v.id,
                    pickup_date: booking.pickupDate,
                    return_date: booking.returnDate,
                    pickup_time: booking.pickupTime  || null,
                    return_time: booking.returnTime  || null,
                    addons,
                    one_way_fee: booking.oneWayFee   || 0,
                });
                setPricing(data);
                update({ pricingBreakdown: data, selectedAddons: addons });
            } catch {
                setPriceError('Could not calculate price. Please check your connection.');
                setPricing(null);
            } finally { setLoadingPrice(false); }
        };
        fetchPrice();
    }, [addons, v?.id, booking.pickupDate, booking.returnDate, booking.oneWayFee]); // eslint-disable-line

    if (!v) return null;

    // ── Addon toggle — enforces insurance mutual exclusion ────────────────────
    const toggleAddon = key => {
        if (key === 'insurance_basic' && addons.includes('insurance_comprehensive')) {
            setAddons(p => p.filter(k => k !== 'insurance_comprehensive').concat(key));
            return;
        }
        if (key === 'insurance_comprehensive' && addons.includes('insurance_basic')) {
            setAddons(p => p.filter(k => k !== 'insurance_basic').concat(key));
            return;
        }
        setAddons(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    // ── Promo ─────────────────────────────────────────────────────────────────
    const handleApplyPromo = async () => {
        if (!promoCode.trim()) return;
        setPromoLoading(true); setPromoMsg('');
        try {
            const { data } = await validatePromo(promoCode.trim(), v.id);
            setPromoMsg(`✅ Promo applied! Discount: ₹${data.discount_amount || data.discount_value}`);
            update({ promoCode: promoCode.trim(), promoDiscount: data.discount_amount || 0 });
        } catch (err) {
            setPromoMsg(`❌ ${err.response?.data?.error || 'Invalid or expired promo code.'}`);
        } finally { setPromoLoading(false); }
    };

    // ── CTA ───────────────────────────────────────────────────────────────────
    const handleConfirm = () => {
        if (!user) { openAuth(); return; }
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
                        <div className="addons-recap__icon">{segIcon(v.segment)}</div>
                        <div className="addons-recap__details">
                            <h2>{v.year} {v.make} {v.model}</h2>
                            <div className="addons-recap__meta">
                                ⛽ {v.fuel_type} · ⚙️ {v.transmission} · 💺 {v.capacity} seats
                            </div>
                            <div className="addons-recap__vendor">
                                🏪 {v.vendor_profile?.business_name || 'Selected Vendor'} ·{' '}
                                <span className="addons-recap__rate">
                                    ₹{parseInt(v.daily_rate).toLocaleString('en-IN')}/day
                                </span>
                            </div>
                        </div>
                        <button className="addons-recap__change" onClick={() => navigate('/book/select-vendor')}>
                            ← Change
                        </button>
                    </div>

                    {/* Trip recap strip */}
                    <div className="addons-trip-recap">
                        <div className="addons-trip-recap__item">
                            <span>📍 Pickup</span>
                            <strong>
                                {booking.pickupLocation?.name}, {booking.pickupCity?.name}
                            </strong>
                        </div>
                        {booking.isDifferentReturn && booking.returnLocation && (
                            <div className="addons-trip-recap__item">
                                <span>🏁 Return</span>
                                <strong>
                                    {booking.returnLocation.name}, {booking.returnCity?.name}
                                </strong>
                            </div>
                        )}
                        <div className="addons-trip-recap__item">
                            <span>📅 From</span>
                            <strong>
                                {booking.pickupDate}{booking.pickupTime ? ` @ ${booking.pickupTime}` : ''}
                            </strong>
                        </div>
                        <div className="addons-trip-recap__item">
                            <span>📅 To</span>
                            <strong>
                                {booking.returnDate}{booking.returnTime ? ` @ ${booking.returnTime}` : ''}
                            </strong>
                        </div>
                        <div className="addons-trip-recap__item">
                            <span>⏱ Duration</span>
                            <strong>{nights} day{nights > 1 ? 's' : ''}</strong>
                        </div>
                    </div>

                    {/* Add-ons grid */}
                    <AddonGrid
                        addons={addons}
                        onToggle={toggleAddon}
                        addonPrices={pricing?.addon_breakdown}
                    />

                    {/* Promo */}
                    <PromoSection
                        promoCode={promoCode}
                        onCodeChange={setPromoCode}
                        onApply={handleApplyPromo}
                        loading={promoLoading}
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
                        promoDiscount={booking.promoDiscount || 0}
                        isLoggedIn={!!user}
                        ctaDisabled={loadingPrice || !pricing || (pricing?.min_rental_days > 1 && nights < pricing.min_rental_days)}
                        onCTA={handleConfirm}
                    />
                </aside>
            </div>

            {AuthModalEl}
        </WizardShell>
    );
}