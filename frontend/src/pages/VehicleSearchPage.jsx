import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { searchVehicles } from '../services/api';
import Navbar from '../components/common/Navbar';
import AuthModal from '../components/auth/AuthModal';
import './VehicleSearchPage.css';
import './BookingWizard.css';

const SEGMENT_ICONS = {
    hatchback: '🚗', sedan: '🚘', suv: '🚙',
    luxury: '🏎️', van: '🚐', truck: '🚛',
};

const FUEL_COLOR = {
    petrol: '#3B82F6', diesel: '#E67E22', electric: '#10B981',
    hybrid: '#8B5CF6', cng: '#0DB89E',
};

export default function VehicleSearchPage() {
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAuth, setShowAuth] = useState(false);
    const [filters, setFilters] = useState({
        segment: '', fuel_type: '', transmission: '',
        certified_only: false, sort: 'price_asc',
    });

    useEffect(() => {
        if (!booking.pickupCity || !booking.pickupDate) navigate('/');
    }, [booking.pickupCity, booking.pickupDate, navigate]);

    const nights = Math.max(1, Math.round(
        (new Date(booking.returnDate) - new Date(booking.pickupDate)) / 86400000
    ));

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data } = await searchVehicles({
                city: booking.pickupCity.id,
                pickup_date: booking.pickupDate,
                return_date: booking.returnDate,
                ...(filters.segment && { segment: filters.segment }),
                ...(filters.fuel_type && { fuel_type: filters.fuel_type }),
                ...(filters.transmission && { transmission: filters.transmission }),
                ...(filters.certified_only && { certified_only: 'true' }),
            });
            setVehicles(data.results || data);
        } catch {
            setError('Could not load vehicles. Check your connection or try again.');
            setVehicles([]);
        } finally { setLoading(false); }
    }, [booking.pickupCity, booking.pickupDate, booking.returnDate, filters]);

    useEffect(() => { load(); }, [load]);

    const setFilter = k => e =>
        setFilters(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const sorted = [...vehicles].sort((a, b) => {
        const ra = parseFloat(a.daily_rate), rb = parseFloat(b.daily_rate);
        if (filters.sort === 'price_asc') return ra - rb;
        if (filters.sort === 'price_desc') return rb - ra;
        return 0;
    });

    const handleSelect = v => {
        // For direct vehicle search, wrap in a model group and go to vendor select
        const group = {
            make: v.make, model: v.model, segment: v.segment,
            fuel_types: new Set([v.fuel_type]),
            transmissions: new Set([v.transmission]),
            capacity: v.capacity,
            minRate: parseFloat(v.daily_rate), maxRate: parseFloat(v.daily_rate),
            count: 1, certified_count: v.is_certified ? 1 : 0,
            photos: v.photos || [], vehicles: [v],
        };
        update({ selectedModel: group, selectedVehicle: null, pickupLocation: null, returnLocation: null });
        navigate('/book/select-vendor');
    };

    return (
        <div className="vehicle-search-page">
            <Navbar onLoginClick={() => setShowAuth(true)} />
            <div className="wizard-page__inner">

                {/* Progress */}
                <div className="wizard-progress">
                    <div className="wizard-progress__step active"><span>1</span> Select Car</div>
                    <div className="wizard-progress__step"><span>2</span> Choose Vendor</div>
                    {booking.isDifferentReturn && <div className="wizard-progress__step"><span>3</span> Return Vendor</div>}
                    <div className="wizard-progress__step"><span>{booking.isDifferentReturn ? 4 : 3}</span> Add-ons & Pay</div>
                </div>

                {/* Trip strip */}
                <div className="vsp__trip-strip">
                    <div className="vsp__trip-item">
                        <span>📍 City</span>
                        <strong>{booking.pickupCity?.name}</strong>
                    </div>
                    <div className="vsp__trip-item">
                        <span>📅 Pickup</span>
                        <strong>{booking.pickupDate}</strong>
                    </div>
                    <div className="vsp__trip-item">
                        <span>📅 Return</span>
                        <strong>{booking.returnDate}</strong>
                    </div>
                    <div className="vsp__trip-item">
                        <span>⏱ Duration</span>
                        <strong>{nights} day{nights > 1 ? 's' : ''}</strong>
                    </div>
                    {booking.isDifferentReturn && (
                        <div className="vsp__trip-item">
                            <span>🏁 Return city</span>
                            <strong>{booking.returnCity?.name}</strong>
                        </div>
                    )}
                </div>

                <div className="vsp__layout">
                    {/* Sidebar */}
                    <aside className="vsp__filters">
                        <h3>Filter</h3>
                        {[
                            ['Category', 'segment', [['', 'All'], ['hatchback', 'Hatchback'], ['sedan', 'Sedan'], ['suv', 'SUV'], ['luxury', 'Luxury'], ['van', 'Van'], ['truck', 'Truck']]],
                            ['Fuel', 'fuel_type', [['', 'Any'], ['petrol', 'Petrol'], ['diesel', 'Diesel'], ['electric', 'Electric'], ['hybrid', 'Hybrid'], ['cng', 'CNG']]],
                            ['Transmission', 'transmission', [['', 'Any'], ['manual', 'Manual'], ['automatic', 'Automatic']]],
                            ['Sort', 'sort', [['price_asc', 'Price ↑'], ['price_desc', 'Price ↓']]],
                        ].map(([label, key, opts]) => (
                            <div key={key} className="vsp__filter-group">
                                <label>{label}</label>
                                <select value={filters[key]} onChange={setFilter(key)}>
                                    {opts.map(([val, txt]) => <option key={val} value={val}>{txt}</option>)}
                                </select>
                            </div>
                        ))}
                        <label className="vsp__certified-toggle">
                            <input type="checkbox" checked={filters.certified_only} onChange={setFilter('certified_only')} />
                            <span>Certified only 🏅</span>
                        </label>
                    </aside>

                    {/* Results */}
                    <div className="vsp__results">
                        <div className="vsp__results-header">
                            {loading ? <h2>Searching vehicles…</h2>
                                : error ? <div className="wizard-error">{error} <button onClick={load} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button></div>
                                    : <h2>{sorted.length} vehicle{sorted.length !== 1 ? 's' : ''} available</h2>}
                            <p className="vsp__results-sub">in {booking.pickupCity?.name} · {nights} day{nights > 1 ? 's' : ''}</p>
                        </div>

                        {loading ? (
                            <div className="vsp__loading">
                                {[1, 2, 3].map(i => <div key={i} className="vsp__skeleton wz-skeleton" />)}
                            </div>
                        ) : sorted.length === 0 && !error ? (
                            <div className="vsp__empty">
                                <div className="vsp__empty-icon">🔍</div>
                                <h3>No vehicles found</h3>
                                <p>Try removing filters or selecting different dates.</p>
                            </div>
                        ) : (
                            <div className="vsp__cards">
                                {sorted.map(v => (
                                    <VehicleCard key={v.id} vehicle={v} nights={nights} onSelect={handleSelect} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </div>
    );
}

function VehicleCard({ vehicle: v, nights, onSelect }) {
    const total = (parseFloat(v.daily_rate) * nights).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return (
        <div className="vehicle-card">
            <div className="vehicle-card__photo">
                {v.photos?.length > 0
                    ? <img src={v.photos.find(p => p.is_cover)?.image || v.photos[0].image} alt={`${v.make} ${v.model}`} />
                    : <div className="vehicle-card__photo-placeholder">{SEGMENT_ICONS[v.segment] || '🚗'}</div>
                }
                {v.is_certified && <div className="vehicle-card__certified">🏅 Certified</div>}
            </div>

            <div className="vehicle-card__body">
                <div className="vehicle-card__make-model">
                    <h3>{v.year} {v.make} {v.model}</h3>
                    <span className="vehicle-card__segment">{v.segment}</span>
                </div>

                <div className="vehicle-card__specs">
                    <span>💺 {v.capacity} seats</span>
                    <span style={{ color: FUEL_COLOR[v.fuel_type] || '#9CA3AF' }}>⛽ {v.fuel_type}</span>
                    <span>⚙️ {v.transmission}</span>
                    {v.colour && <span>🎨 {v.colour}</span>}
                </div>

                {v.vendor_profile && (
                    <div className="vehicle-card__vendor">
                        🏪 {v.vendor_profile.business_name}
                        {v.vendor_profile.rating > 0 && (
                            <span className="vehicle-card__rating">⭐ {v.vendor_profile.rating}</span>
                        )}
                    </div>
                )}

                <div className="vehicle-card__footer">
                    <div className="vehicle-card__price">
                        <div>
                            <span className="vehicle-card__rate">₹{parseInt(v.daily_rate).toLocaleString('en-IN')}</span>
                            <span className="vehicle-card__rate-label">/day</span>
                        </div>
                        <div className="vehicle-card__total">₹{total} for {nights} day{nights > 1 ? 's' : ''}</div>
                    </div>
                    <button className="vehicle-card__select" onClick={() => onSelect(v)}>
                        Select →
                    </button>
                </div>
            </div>
        </div>
    );
}