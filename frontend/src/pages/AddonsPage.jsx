import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { calculatePrice, validatePromo } from '../services/api';
import Navbar from '../components/common/Navbar';
import AuthModal from '../components/auth/AuthModal';
import './AddonsPage.css';
import './BookingWizard.css';

const ADDON_CATALOG = [
    { key: 'insurance_basic',         icon: '🛡️', label: 'Basic Insurance',       desc: 'Third-party liability cover' },
    { key: 'insurance_comprehensive', icon: '🛡️', label: 'Comprehensive Insurance', desc: 'Full damage + theft cover' },
    { key: 'personal_accident',       icon: '🏥', label: 'Personal Accident',       desc: 'Driver & all passengers covered' },
    { key: 'child_seat',              icon: '👶', label: 'Child Seat',              desc: 'Safety-certified baby/child seat' },
    { key: 'gps',                     icon: '📡', label: 'GPS Device',              desc: 'Built-in navigation device' },
    { key: 'additional_driver',       icon: '👤', label: 'Additional Driver',       desc: 'Add a second authorised driver' },
];

const SEG_ICON = s =>
    s === 'luxury' ? '🏎️' : s === 'suv' ? '🚙' : s === 'van' ? '🚐' : '🚗';

export default function AddonsPage() {
    const navigate  = useNavigate();
    const { booking, update } = useBooking();
    const { user }  = useAuth();
    const [showAuth, setShowAuth]         = useState(false);
    const [pricing, setPricing]           = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [priceError, setPriceError]     = useState('');
    const [promoCode, setPromoCode]       = useState('');
    const [promoMsg, setPromoMsg]         = useState('');
    const [promoLoading, setPromoLoading] = useState(false);
    const [addons, setAddons]             = useState([]);

    useEffect(() => {
        if (!booking.selectedVehicle) navigate('/');
    }, [booking.selectedVehicle, navigate]);

    const v = booking.selectedVehicle;
    

    const nights = Math.max(1, Math.round(
        (new Date(booking.returnDate) - new Date(booking.pickupDate)) / 86400000
    ));

    // Live price from API whenever addons change
    useEffect(() => {
        const fetchPrice = async () => {
            setLoadingPrice(true); setPriceError('');
            try {
                const { data } = await calculatePrice({
                    vehicle_id:   v.id,
                    pickup_date:  booking.pickupDate,
                    return_date:  booking.returnDate,
                    pickup_time:  booking.pickupTime  || null,
                    return_time:  booking.returnTime  || null,
                    addons,
                    one_way_fee:  booking.oneWayFee   || 0,
                });
                setPricing(data);
                update({ pricingBreakdown: data, selectedAddons: addons });
            } catch {
                setPriceError('Could not calculate price. Please check your connection.');
                setPricing(null);
            } finally {
                setLoadingPrice(false);
            }
        };
        fetchPrice();
    }, [addons, v.id, booking.pickupDate, booking.returnDate, booking.oneWayFee]);

    if (!v) return null;

    const toggleAddon = key => {
        if (key === 'insurance_basic' && addons.includes('insurance_comprehensive')) {
            setAddons(p => p.filter(k => k !== 'insurance_comprehensive').concat(key)); return;
        }
        if (key === 'insurance_comprehensive' && addons.includes('insurance_basic')) {
            setAddons(p => p.filter(k => k !== 'insurance_basic').concat(key)); return;
        }
        setAddons(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

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

    const handleConfirm = () => {
        if (!user) { setShowAuth(true); return; }
        navigate('/book/confirm');
    };

    const stepCount = booking.isDifferentReturn ? 4 : 3;

    return (
        <div className="addons-page">
            <Navbar onLoginClick={() => setShowAuth(true)} />

            <div className="wizard-page__inner">
                {/* Progress */}
                <div className="wizard-progress">
                    <div className="wizard-progress__step done"><span>✓</span> Select Car</div>
                    <div className="wizard-progress__step done"><span>✓</span> Vendor</div>
                    {booking.isDifferentReturn && <div className="wizard-progress__step done"><span>✓</span> Return</div>}
                    <div className="wizard-progress__step active"><span>{stepCount}</span> Add-ons & Pay</div>
                </div>

                <div className="addons-page__layout">
                    {/* ── Left ── */}
                    <div className="addons-page__left">

                        {/* Vehicle recap */}
                        <div className="addons-recap">
                            <div className="addons-recap__icon">{SEG_ICON(v.segment)}</div>
                            <div className="addons-recap__details">
                                <h2>{v.year} {v.make} {v.model}</h2>
                                <div className="addons-recap__meta">
                                    ⛽ {v.fuel_type} · ⚙️ {v.transmission} · 💺 {v.capacity} seats
                                </div>
                                <div className="addons-recap__vendor">
                                    🏪 {v.vendor_profile?.business_name || 'Selected Vendor'} ·{' '}
                                    <span className="addons-recap__rate">₹{parseInt(v.daily_rate).toLocaleString('en-IN')}/day</span>
                                </div>
                            </div>
                            <button className="addons-recap__change" onClick={() => navigate('/book/select-vendor')}>
                                ← Change
                            </button>
                        </div>

                        {/* Trip recap */}
                        <div className="addons-trip-recap">
                            <div className="addons-trip-recap__item">
                                <span>📍 Pickup</span>
                                <strong>{booking.pickupLocation?.name}, {booking.pickupCity?.name}</strong>
                            </div>
                            {booking.isDifferentReturn && booking.returnLocation && (
                                <div className="addons-trip-recap__item">
                                    <span>🏁 Return</span>
                                    <strong>{booking.returnLocation.name}, {booking.returnCity?.name}</strong>
                                </div>
                            )}
                            <div className="addons-trip-recap__item">
                                <span>📅 From</span>
                                <strong>{booking.pickupDate}{booking.pickupTime ? ` @ ${booking.pickupTime}` : ''}</strong>
                            </div>
                            <div className="addons-trip-recap__item">
                                <span>📅 To</span>
                                <strong>{booking.returnDate}{booking.returnTime ? ` @ ${booking.returnTime}` : ''}</strong>
                            </div>
                            <div className="addons-trip-recap__item">
                                <span>⏱ Duration</span>
                                <strong>{nights} day{nights > 1 ? 's' : ''}</strong>
                            </div>
                        </div>

                        {/* Add-ons */}
                        <div className="addons-section">
                            <h3>Optional Add-ons</h3>
                            <p className="addons-section__subtitle">
                                Prices are calculated per day and added to your total automatically.
                            </p>
                            <div className="addons-grid">
                                {ADDON_CATALOG.map(a => {
                                    const isSelected  = addons.includes(a.key);
                                    const addonPrice  = pricing?.addon_breakdown?.[a.key];
                                    return (
                                        <button key={a.key}
                                            className={`addon-card${isSelected ? ' selected' : ''}`}
                                            onClick={() => toggleAddon(a.key)}>
                                            <div className="addon-card__icon">{a.icon}</div>
                                            <div className="addon-card__info">
                                                <strong>{a.label}</strong>
                                                <span>{a.desc}</span>
                                                {addonPrice && (
                                                    <span className="addon-card__api-price">
                                                        ₹{parseFloat(addonPrice).toLocaleString('en-IN')}/day
                                                    </span>
                                                )}
                                            </div>
                                            <div className="addon-card__check">{isSelected ? '✓' : '+'}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Promo */}
                        <div className="promo-section">
                            <h3>Promo Code</h3>
                            <div className="promo-section__row">
                                <input type="text" value={promoCode}
                                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                                    placeholder="Enter promo code" disabled={promoLoading} />
                                <button onClick={handleApplyPromo} disabled={promoLoading || !promoCode.trim()}>
                                    {promoLoading ? '…' : 'Apply'}
                                </button>
                            </div>
                            {promoMsg && (
                                <p className={`promo-msg ${promoMsg.startsWith('✅') ? 'promo-msg--success' : 'promo-msg--error'}`}>
                                    {promoMsg}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Right: price summary ── */}
                    <aside className="addons-page__summary">
                        <div className="price-summary">
                            <h3>Price Breakdown</h3>

                            {priceError && <div className="price-summary__error">{priceError}</div>}

                            <div className="price-summary__breakdown">
                                {loadingPrice ? (
                                    <div className="price-summary__loading">
                                        <div className="wz-spinner" /> Recalculating…
                                    </div>
                                ) : pricing ? (
                                    <>
                                        <div className="price-summary__line">
                                            <span>Base rental</span>
                                            <span>₹{parseFloat(pricing.base_amount).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="price-summary__line price-summary__line--sub">
                                            <span>{nights} day{nights > 1 ? 's' : ''} × ₹{parseInt(v.daily_rate).toLocaleString('en-IN')}/day</span>
                                        </div>
                                        {parseFloat(pricing.addon_amount || 0) > 0 && (
                                            <div className="price-summary__line">
                                                <span>Add-ons ({addons.length})</span>
                                                <span>₹{parseFloat(pricing.addon_amount).toLocaleString('en-IN')}</span>
                                            </div>
                                        )}
                                        {parseFloat(pricing.one_way_fee || 0) > 0 && (
                                            <div className="price-summary__line">
                                                <span>One-way fee</span>
                                                <span>₹{parseFloat(pricing.one_way_fee).toLocaleString('en-IN')}</span>
                                            </div>
                                        )}
                                        {parseFloat(pricing.gst_amount || 0) > 0 && (
                                            <div className="price-summary__line">
                                                <span>GST (18%)</span>
                                                <span>₹{parseFloat(pricing.gst_amount).toLocaleString('en-IN')}</span>
                                            </div>
                                        )}
                                        {booking.promoDiscount > 0 && (
                                            <div className="price-summary__line price-summary__line--discount">
                                                <span>Promo discount</span>
                                                <span>−₹{booking.promoDiscount.toLocaleString('en-IN')}</span>
                                            </div>
                                        )}
                                        <div className="price-summary__line price-summary__line--total">
                                            <span>Grand Total</span>
                                            <span>₹{(parseFloat(pricing.grand_total) - (booking.promoDiscount || 0)).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="price-summary__deposit">
                                            🔒 Refundable security deposit: ₹{parseFloat(pricing.security_deposit).toLocaleString('en-IN')}
                                            <small> — collected separately, returned after vehicle return</small>
                                        </div>
                                        {pricing.vendor_opening_time && (
                                            <div className="price-summary__hours">
                                                🕐 Vendor hours: {pricing.vendor_opening_time} – {pricing.vendor_closing_time}
                                            </div>
                                        )}
                                    </>
                                ) : null}
                            </div>

                            {!user && (
                                <div className="price-summary__login-prompt">
                                    <span>🔐</span>
                                    <p>Sign in to confirm your booking</p>
                                </div>
                            )}

                            <button className="price-summary__cta"
                                onClick={handleConfirm}
                                disabled={loadingPrice || !pricing}>
                                {user ? 'Confirm Booking →' : 'Sign In to Continue →'}
                            </button>

                            <div className="price-summary__reassurance">
                                <span>✓ Free cancellation 48h before pickup</span>
                                <span>✓ Transparent GST-inclusive pricing</span>
                                <span>✓ Secure Razorpay payment</span>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {showAuth && (
                <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => navigate('/book/confirm')} />
            )}
        </div>
    );
}