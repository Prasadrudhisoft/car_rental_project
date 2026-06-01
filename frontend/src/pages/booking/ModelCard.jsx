// ─────────────────────────────────────────────────────────────────────────────
// ModelCard.jsx
// Individual car model card used in the CarModelSelectPage grid.
// Pure presentational — receives group data and callbacks as props.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { SEGMENT_ICONS, FUEL_COLOR } from './bookingConstants';

export default function ModelCard({ group: g, nights, onSelect }) {
    const totalMin = (g.minRate * nights).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const totalMax = (g.maxRate * nights).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return (
        <div className="model-card" onClick={() => onSelect(g)}>
            {/* Photo / icon */}
            <div className="model-card__photo">
                {g.photos?.length > 0
                    ? <img src={g.photos[0].image} alt={`${g.make} ${g.model}`} />
                    : <div className="model-card__icon">{SEGMENT_ICONS[g.segment] || '🚗'}</div>
                }
                {g.certified_count > 0 && (
                    <div className="model-card__cert-badge">🏅 {g.certified_count} Certified</div>
                )}
                <div className="model-card__vendor-count">
                    {g.count} vendor{g.count !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Body */}
            <div className="model-card__body">
                <div className="model-card__title">
                    <h3>{g.make} {g.model}</h3>
                    <span className="model-card__segment">
                        {SEGMENT_ICONS[g.segment]} {g.segment}
                    </span>
                </div>

                <div className="model-card__specs">
                    <span>💺 {g.capacity} seats</span>
                    {[...g.fuel_types].map(f => (
                        <span key={f} className="model-card__fuel" style={{ '--fc': FUEL_COLOR[f] || '#9CA3AF' }}>
                            ⛽ {f}
                        </span>
                    ))}
                    {[...g.transmissions].map(t => (
                        <span key={t}>⚙️ {t}</span>
                    ))}
                </div>

                <div className="model-card__pricing">
                    <div className="model-card__rate">
                        <span className="model-card__rate-from">from</span>
                        <span className="model-card__rate-value">
                            ₹{g.minRate.toLocaleString('en-IN')}
                        </span>
                        <span className="model-card__rate-unit">/day</span>
                    </div>
                    <div className="model-card__total">
                        ₹{totalMin}{g.minRate !== g.maxRate ? `–₹${totalMax}` : ''} for {nights} day{nights > 1 ? 's' : ''}
                    </div>
                </div>

                <button
                    className="model-card__cta"
                    onClick={e => { e.stopPropagation(); onSelect(g); }}
                >
                    See Vendors &amp; Pricing →
                </button>
            </div>
        </div>
    );
}