// ─────────────────────────────────────────────────────────────────────────────
// tabs/LoyaltyTab.jsx
// Loyalty points balance card, tier indicator, and redemption form.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { redeemLoyalty } from '../../../services/api';

export default function LoyaltyTab({ loyalty, onLoyaltyUpdate, showToast }) {
    const [redeemPoints, setRedeemPoints] = useState('');
    const [redeemLoading, setRedeemLoading] = useState(false);

    if (!loyalty) return null;

    const tier = loyalty.loyalty_points >= 1000
        ? 'Gold Member'
        : loyalty.loyalty_points >= 500
            ? 'Silver Member'
            : 'Bronze Member';

    const totalValue = loyalty.total_value_inr
        || loyalty.loyalty_points * parseFloat(loyalty.point_value_inr || 0.5);

    const handleRedeem = async e => {
        e.preventDefault();
        const pts = parseInt(redeemPoints);
        if (!pts || pts <= 0) { showToast('Enter valid points.', 'error'); return; }
        setRedeemLoading(true);
        try {
            const { data } = await redeemLoyalty(pts);
            onLoyaltyUpdate(
                data.new_balance ?? loyalty.loyalty_points - pts,
            );
            setRedeemPoints('');
            showToast(`Redeemed ${pts} pts — ₹${data.discount_inr} discount!`);
        } catch (e) {
            showToast(e.response?.data?.error || 'Redemption failed.', 'error');
        } finally {
            setRedeemLoading(false);
        }
    };

    return (
        <div className="cd-section">
            <div className="cd-loyalty-layout">

                {/* Points card */}
                <div className="cd-loyalty-card">
                    <div className="cd-loyalty-card__bg" />
                    <div className="cd-loyalty-card__top">
                        <span className="cd-loyalty-card__star">&#9733;</span>
                        <span className="cd-loyalty-card__brand">DriveLux Rewards</span>
                    </div>
                    <div className="cd-loyalty-card__pts">{loyalty.loyalty_points}</div>
                    <div className="cd-loyalty-card__label">Points</div>
                    <div className="cd-loyalty-card__worth">
                        Worth <strong>₹{totalValue}</strong>
                    </div>
                    <div className="cd-loyalty-card__tier">{tier}</div>
                </div>

                {/* Right panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Redeem card */}
                    <div className="cd-card">
                        <h3 className="cd-card__title">Redeem Points</h3>
                        <p style={{ fontSize: 13, color: 'var(--cd-muted)', marginBottom: 14 }}>
                            1 point = ₹{loyalty.point_value_inr || '0.50'}
                        </p>
                        <form
                            onSubmit={handleRedeem}
                            style={{
                                display: 'flex', gap: 10,
                                flexWrap: 'wrap', alignItems: 'flex-end',
                            }}
                        >
                            <div>
                                <label style={{
                                    fontSize: 10, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    color: 'var(--cd-muted)', display: 'block', marginBottom: 5,
                                }}>
                                    Points to Redeem
                                </label>
                                <input
                                    className="cd-input"
                                    type="number"
                                    style={{ width: 160 }}
                                    placeholder={`Max ${loyalty.loyalty_points}`}
                                    value={redeemPoints}
                                    onChange={e => setRedeemPoints(e.target.value)}
                                    min={1}
                                    max={loyalty.loyalty_points}
                                />
                            </div>
                            <button
                                type="submit"
                                className="cd-btn cd-btn--primary"
                                disabled={redeemLoading || !redeemPoints}
                            >
                                {redeemLoading ? 'Redeeming…' : 'Redeem Now'}
                            </button>
                        </form>
                    </div>

                    {/* How it works info card */}
                    <div className="cd-card">
                        <h3 className="cd-card__title">How It Works</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                            {[
                                ['🚗', 'Earn points on every completed rental'],
                                ['⭐', 'Write reviews to earn bonus points'],
                                ['💰', 'Redeem points for discounts on future bookings'],
                                ['🏆', 'Unlock Gold tier at 1000 points for extra perks'],
                            ].map(([icon, text]) => (
                                <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                                    <span style={{ color: 'var(--cd-txt2)', lineHeight: 1.5 }}>{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}