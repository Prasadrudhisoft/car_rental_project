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
                    const apiPrice = addonPrices?.[a.key];

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
                            <div className="addon-card__check">
                                {isSelected ? '✓' : '+'}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Currency Formatter ────────────────────────────────────────────────────────
const inr = n =>
    `₹${Number(n || 0).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
    })}`;

// ── PromoSection ──────────────────────────────────────────────────────────────
/**
 * @param {string}   promoCode      - controlled input value
 * @param {Function} onCodeChange   - called with new string value
 * @param {Function} onApply        - called when Apply is clicked
 * @param {Function} onRemove       - called when an applied promo is removed
 * @param {object|null} applied     - currently applied promo, if any
 * @param {boolean}  loading        - whether promo application is in progress
 * @param {string}   message        - feedback message ('' = hidden)
 */
export function PromoSection({
    promoCode,
    onCodeChange,
    onApply,
    onRemove,
    applied,
    loading,
    message,
}) {
    return (
        <div className="promo-section">
            <h3>Promo Code</h3>

            <div className="promo-section__row">
                <input
                    type="text"
                    value={promoCode}
                    disabled={loading || !!applied}
                    onChange={e => onCodeChange(e.target.value.toUpperCase())}
                    onKeyDown={e =>
                        e.key === 'Enter' && !applied && onApply()
                    }
                    placeholder="Enter promo code"
                    autoComplete="off"
                />

                {applied ? (
                    <button onClick={onRemove}>
                        Remove
                    </button>
                ) : (
                    <button
                        onClick={onApply}
                        disabled={loading || !promoCode.trim()}
                    >
                        {loading ? '…' : 'Apply'}
                    </button>
                )}
            </div>

            {message && (
                <p
                    className={`promo-msg ${
                        message.startsWith('✅')
                            ? 'promo-msg--success'
                            : 'promo-msg--error'
                    }`}
                >
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
 * @param {boolean}  isLoggedIn
 * @param {boolean}  ctaDisabled
 * @param {Function} onCTA           - called when the main CTA is clicked
 */
export function PriceSummary({
    pricing,
    loadingPrice,
    priceError,
    nights,
    vehicle,
    addons,
    isLoggedIn,
    ctaDisabled,
    onCTA,
}) {
    const belowMin =
        pricing?.min_rental_days > 1 &&
        nights < pricing.min_rental_days;

    const discount = parseFloat(pricing?.discount_amount || 0);
    const gstPct = Math.round(
        parseFloat(pricing?.gst_rate ?? 0.18) * 100
    );

    return (
        <div className="price-summary">
            <h3>Price Breakdown</h3>

            {priceError && (
                <div className="price-summary__error">
                    {priceError}
                </div>
            )}

            {belowMin && (
                <div className="price-summary__error">
                    ⚠ This vehicle type requires a minimum rental of{' '}
                    {pricing.min_rental_days} days.
                </div>
            )}

            <div className="price-summary__breakdown">
                {loadingPrice ? (
                    <div className="price-summary__loading">
                        <div className="wz-spinner" /> Recalculating…
                    </div>
                ) : pricing ? (
                    <>
                        <div className="price-summary__line">
                            <span>Base rental</span>
                            <span>{inr(pricing.base_amount)}</span>
                        </div>

                        <div className="price-summary__line price-summary__line--sub">
                            <span>
                                {nights} day{nights > 1 ? 's' : ''} ×{' '}
                                {inr(vehicle.daily_rate)}/day
                            </span>
                        </div>

                        {parseFloat(pricing.addon_total) > 0 && (
                            <div className="price-summary__line">
                                <span>Add-ons ({addons.length})</span>
                                <span>{inr(pricing.addon_total)}</span>
                            </div>
                        )}

                        {parseFloat(pricing.one_way_fee) > 0 && (
                            <div className="price-summary__line">
                                <span>One-way fee</span>
                                <span>{inr(pricing.one_way_fee)}</span>
                            </div>
                        )}

                        {discount > 0 && (
                            <>
                                <div className="price-summary__line">
                                    <span>Subtotal</span>
                                    <span>{inr(pricing.subtotal)}</span>
                                </div>

                                <div className="price-summary__line price-summary__line--discount">
                                    <span>Promo {pricing.promo_code}</span>
                                    <span>−{inr(discount)}</span>
                                </div>
                            </>
                        )}

                        <div className="price-summary__line">
                            <span>GST ({gstPct}%)</span>
                            <span>{inr(pricing.gst_amount)}</span>
                        </div>

                        <div className="price-summary__line price-summary__line--total">
                            <span>Grand Total</span>
                            <span>{inr(pricing.grand_total)}</span>
                        </div>

                        <div className="price-summary__deposit">
                            🔒 Refundable security deposit:{' '}
                            {inr(pricing.security_deposit)}
                            <small>
                                {' '}— collected separately, returned after vehicle return
                            </small>
                        </div>

                        {pricing.vendor_opening_time && (
                            <div className="price-summary__hours">
                                🕐 Vendor hours: {pricing.vendor_opening_time} –{' '}
                                {pricing.vendor_closing_time}
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

            <button
                className="price-summary__cta"
                onClick={onCTA}
                disabled={ctaDisabled || belowMin}
            >
                {isLoggedIn
                    ? 'Confirm Booking →'
                    : 'Sign In to Continue →'}
            </button>

            <div className="price-summary__reassurance">
                <span>
                    ✓ Free cancellation {pricing?.cancellation_free_hours ?? 48}h before pickup
                </span>
                <span>✓ Transparent GST-inclusive pricing</span>
                <span>✓ Secure online payment</span>
            </div>
        </div>
    );
}