// ─────────────────────────────────────────────────────────────────────────────
// SegmentSelectPage.jsx  (Step 1 — Choose Vehicle Segment)
// Route: /book/select-car
//
// REPLACES CarModelSelectPage.jsx.
// Instead of showing individual car models, this page shows the available
// vehicle SEGMENTS (Hatchback, Sedan, SUV, etc.) for the chosen city/dates,
// with vehicle counts, vendor counts, and price ranges.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate }              from 'react-router-dom';
import { useBooking }               from '../../context/BookingContext';
import { getAvailableSegments }     from '../../services/api';
import { WizardShell, WizardProgress, buildSteps, useAuthModal } from './BookingShared';
import { calcNights }               from './bookingConstants';
import './SegmentSelectPage.css';
import '../BookingWizard.css';

export default function SegmentSelectPage() {
    const navigate             = useNavigate();
    const { booking, update }  = useBooking();
    const { openAuth, AuthModalEl } = useAuthModal();

    const [segments,  setSegments]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');

    // Guard: must have selected a city + dates on the home page
    useEffect(() => {
        if (!booking.pickupCity || !booking.pickupDate) navigate('/');
    }, [booking.pickupCity, booking.pickupDate, navigate]);

    const nights = calcNights(booking.pickupDate, booking.returnDate);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data } = await getAvailableSegments({
                city:         booking.pickupCity.id,
                pickup_date:  booking.pickupDate,
                return_date:  booking.returnDate,
            });
            setSegments(data.segments || []);
        } catch {
            setError('Could not load available vehicles. Check your connection or try again.');
            setSegments([]);
        } finally {
            setLoading(false);
        }
    }, [booking.pickupCity, booking.pickupDate, booking.returnDate]);

    useEffect(() => { load(); }, [load]);

    // When a segment tile is clicked, store it and proceed to vendor/vehicle search
    const handleSelectSegment = (seg) => {
        update({
            selectedSegment:  seg.segment,       // e.g. 'suv'
            selectedModel:    null,               // clear previous model
            selectedVehicle:  null,
            pickupLocation:   null,
            returnLocation:   null,
        });
        navigate('/book/select-vendor');
    };

    const steps = buildSteps('car', booking.isDifferentReturn);

    return (
        <WizardShell onLoginClick={openAuth} className="ssp-page">
            <WizardProgress steps={steps} />

            {/* Trip summary strip */}
            <div className="ssp__trip-strip">
                <div className="ssp__trip-item">
                    <span>📍 City</span>
                    <strong>{booking.pickupCity?.name}</strong>
                </div>
                <div className="ssp__trip-item">
                    <span>📅 From</span>
                    <strong>{booking.pickupDate}</strong>
                </div>
                <div className="ssp__trip-item">
                    <span>📅 To</span>
                    <strong>{booking.returnDate}</strong>
                </div>
                <div className="ssp__trip-item">
                    <span>⏱ Duration</span>
                    <strong>{nights} day{nights > 1 ? 's' : ''}</strong>
                </div>
                {booking.isDifferentReturn && (
                    <div className="ssp__trip-item">
                        <span>🏁 Return to</span>
                        <strong>{booking.returnCity?.name}</strong>
                    </div>
                )}
            </div>

            {/* Page header */}
            <div className="ssp__header">
                <h2>What type of car are you looking for?</h2>
                <p>
                    {loading
                        ? 'Finding available vehicles…'
                        : `${segments.length} category${segments.length !== 1 ? 's' : ''} available in ${booking.pickupCity?.name}`
                    }
                </p>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="ssp__skeletons">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="ssp__skeleton wz-skeleton" />
                    ))}
                </div>
            ) : error ? (
                <div className="ssp__error">
                    <p>{error}</p>
                    <button onClick={load}>↺ Retry</button>
                </div>
            ) : segments.length === 0 ? (
                <div className="ssp__empty">
                    <div>🔍</div>
                    <h3>No vehicles available</h3>
                    <p>No cars found for these dates. Try different dates or another city.</p>
                </div>
            ) : (
                <div className="ssp__grid">
                    {segments.map(seg => (
                        <SegmentCard
                            key={seg.segment}
                            seg={seg}
                            nights={nights}
                            onSelect={handleSelectSegment}
                        />
                    ))}
                </div>
            )}

            {AuthModalEl}
        </WizardShell>
    );
}

// ── SegmentCard ───────────────────────────────────────────────────────────────
function SegmentCard({ seg, nights, onSelect }) {
    const minTotal = (parseFloat(seg.min_rate) * nights).toLocaleString('en-IN', {
        maximumFractionDigits: 0,
    });

    return (
        <button className="seg-card" onClick={() => onSelect(seg)}>
            {/* Head row: icon + certified badge */}
            <div className="seg-card__head">
                <span className="seg-card__icon">{seg.icon}</span>
                {seg.certified_count > 0 && (
                    <span className="seg-card__cert">🏅 {seg.certified_count} Certified</span>
                )}
            </div>

            {/* Label + description */}
            <div className="seg-card__label">{seg.label}</div>
            <div className="seg-card__desc">{seg.desc}</div>

            {/* Stats */}
            <div className="seg-card__stats">
                <div className="seg-card__stat">
                    <span className="seg-card__stat-val">{seg.vehicle_count}</span>
                    <span className="seg-card__stat-lbl">Car{seg.vehicle_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="seg-card__stat">
                    <span className="seg-card__stat-val">{seg.vendor_count}</span>
                    <span className="seg-card__stat-lbl">Vendor{seg.vendor_count !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {/* Price band */}
            <div className="seg-card__price">
                <span className="seg-card__price-from">* starting from</span>
                <span className="seg-card__price-val">
                    ₹{parseInt(seg.min_rate).toLocaleString('en-IN')}
                </span>
                <span className="seg-card__price-unit">/day</span>
                <span className="seg-card__price-range">
                    · ₹{minTotal} for {nights} day{nights > 1 ? 's' : ''}
                </span>
            </div>

            {/* CTA */}
            <div className="seg-card__cta">
                <span>Browse {seg.label}s</span>
                <span>→</span>
            </div>
        </button>
    );
}