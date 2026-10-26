import React from 'react';
import { ADDON_CATALOG } from './bookingConstants';

// ── AddonGrid ─────────────────────────────────────────────────────────────────
/**
 * Renders all add-on toggle cards.
 * @param {string[]}  addons        - currently selected addon keys
 * @param {Function}  onToggle      - called with the addon key to toggle
 * @param {object}    addonPrices   - { [key]: priceString } from pricing API
 */
export function AddonGrid({ addons, onToggle, addonPrices }) {
    return (
        <div className="addons-section">
            <h3>Optional Add-ons</h3>
            <p className="addons-section__subtitle">
                Prices are calculated per day and added to your total automatically.
            </p>
            <div className="addons-grid">
                {ADDON_CATALOG.map(a => {
                    const isSelected = addons.includes(a.key);
                    const apiPrice   = addonPrices?.[a.key];
                    return (
                        <button
                            key={a.key}
                            className={`addon-card${isSelected ? ' selected' : ''}`}
                            onClick={() => onToggle(a.key)}
                        >
                            <div className="addon-card__icon">{a.icon}</div>
                            <div className="addon-card__info">
                                <strong>{a.label}</strong>
                                <span>{a.desc}</span>
                                {apiPrice && (
                                    <span className="addon-card__api-price">
                                        ₹{parseFloat(apiPrice).toLocaleString('en-IN')}/day
                                    </span>
                                )}
                            </div>
                            <div className="addon-card__check">{isSelected ? '✓' : '+'}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── PromoSection ──────────────────────────────────────────────────────────────
/**
 * @param {string}   promoCode      - controlled input value
 * @param {Function} onCodeChange   - called with new string value
 * @param {Function} onApply        - called when Apply is clicked
 * @param {boolean}  loading
 * @param {string}   message        - feedback message ('' = hidden)
 */
export function PromoSection({ promoCode, onCodeChange, onApply, loading, message }) {
    return (
        <div className="promo-section">
            <h3>Promo Code</h3>
            <div className="promo-section__row">
                <input
                    type="text"
                    value={promoCode}
                    onChange={e => onCodeChange(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    disabled={loading}
                />
                <button onClick={onApply} disabled={loading || !promoCode.trim()}>
                    {loading ? '…' : 'Apply'}
                </button>
            </div>
            {message && (
                <p className={`promo-msg ${message.startsWith('✅') ? 'promo-msg--success' : 'promo-msg--error'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}

// ── PriceSummary ──────────────────────────────────────────────────────────────
/**
 * Sticky right-column price breakdown.
 *
 * @param {object}   pricing         - API response from calculatePrice
 * @param {boolean}  loadingPrice
 * @param {string}   priceError
 * @param {number}   nights
 * @param {object}   vehicle         - selectedVehicle from BookingContext
 * @param {string[]} addons          - selected addon keys
 * @param {number}   promoDiscount   - discount amount (0 if none)
 * @param {boolean}  isLoggedIn
 * @param {boolean}  ctaDisabled
 * @param {Function} onCTA           - called when the main CTA is clicked
 */
export function PriceSummary({
    pricing, loadingPrice, priceError, nights, vehicle, addons,
    promoDiscount, isLoggedIn, ctaDisabled, onCTA,
}) {
    const belowMinRental = pricing?.min_rental_days > 1 && nights < pricing.min_rental_days;

    return (
        <div className="price-summary">
            <h3>Price Breakdown</h3>

            {priceError && <div className="price-summary__error">{priceError}</div>}

            {belowMinRental && (
                <div className="price-summary__error">
                    ⚠ This vehicle type requires a minimum rental of {pricing.min_rental_days} days.
                    Please go back and adjust your dates.
                </div>
            )}

            <div className="price-summary__breakdown">
                {loadingPrice ? (
                    <div className="price-summary__loading"><div className="wz-spinner" /> Recalculating…</div>
                ) : pricing ? (
                    <>
                        <div className="price-summary__line">
                            <span>Base rental</span>
                            <span>₹{parseFloat(pricing.base_amount).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="price-summary__line price-summary__line--sub">
                            <span>{nights} day{nights > 1 ? 's' : ''} × ₹{parseInt(vehicle.daily_rate).toLocaleString('en-IN')}/day</span>
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
                                {/* ← was hardcoded "GST (18%)" — now reflects the live gst_rate setting */}
                                <span>GST ({Math.round(parseFloat(pricing.gst_rate ?? 0.18) * 100)}%)</span>
                                <span>₹{parseFloat(pricing.gst_amount).toLocaleString('en-IN')}</span>
                            </div>
                        )}

                        {promoDiscount > 0 && (
                            <div className="price-summary__line price-summary__line--discount">
                                <span>Promo discount</span>
                                <span>−₹{promoDiscount.toLocaleString('en-IN')}</span>
                            </div>
                        )}

                        <div className="price-summary__line price-summary__line--total">
                            <span>Grand Total</span>
                            <span>₹{(parseFloat(pricing.grand_total) - (promoDiscount || 0)).toLocaleString('en-IN')}</span>
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

            {!isLoggedIn && (
                <div className="price-summary__login-prompt">
                    <span>🔐</span>
                    <p>Sign in to confirm your booking</p>
                </div>
            )}

            <button className="price-summary__cta" onClick={onCTA} disabled={ctaDisabled || belowMinRental}>
                {isLoggedIn ? 'Confirm Booking →' : 'Sign In to Continue →'}
            </button>

            <div className="price-summary__reassurance">
                {/* ← was hardcoded "48h" — now reflects cancellation_free_hours */}
                <span>✓ Free cancellation {pricing?.cancellation_free_hours ?? 48}h before pickup</span>
                <span>✓ Transparent GST-inclusive pricing</span>
                <span>✓ Secure Razorpay payment</span>
            </div>
        </div>
    );
}