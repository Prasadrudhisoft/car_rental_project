import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import { searchVehicles } from '../services/api';
import Navbar from '../components/common/Navbar';
import AuthModal from '../components/auth/AuthModal';
import './CarModelSelectPage.css';
import './BookingWizard.css';

const SEGMENT_ICONS = {
    hatchback: '🚗', sedan: '🚘', suv: '🚙',
    luxury: '🏎️', van: '🚐', truck: '🚛',
};

const FUEL_COLOR = {
    petrol: '#3B82F6', diesel: '#E67E22', electric: '#10B981',
    hybrid: '#8B5CF6', cng: '#0DB89E',
};

function groupByModel(vehicles) {
    const map = {};
    vehicles.forEach(v => {
        const key = `${v.make}__${v.model}`;
        if (!map[key]) {
            map[key] = {
                make: v.make, model: v.model, segment: v.segment,
                fuel_types: new Set(), transmissions: new Set(),
                capacity: v.capacity,
                minRate: parseFloat(v.daily_rate), maxRate: parseFloat(v.daily_rate),
                count: 0, certified_count: 0,
                photos: v.photos || [], vehicles: [],
            };
        }
        const g = map[key];
        g.fuel_types.add(v.fuel_type);
        g.transmissions.add(v.transmission);
        g.minRate = Math.min(g.minRate, parseFloat(v.daily_rate));
        g.maxRate = Math.max(g.maxRate, parseFloat(v.daily_rate));
        g.count += 1;
        if (v.is_certified) g.certified_count += 1;
        if (!g.photos.length && v.photos?.length) g.photos = v.photos;
        g.vehicles.push(v);
    });
    return Object.values(map);
}

export default function CarModelSelectPage() {
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [allVehicles, setAllVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAuth, setShowAuth] = useState(false);
    const [searchText, setSearchText] = useState('');
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
            setAllVehicles(data.results || data);
        } catch {
            setError('Could not load vehicles. Check your connection or try again.');
            setAllVehicles([]);
        } finally { setLoading(false); }
    }, [booking.pickupCity, booking.pickupDate, booking.returnDate, filters]);

    useEffect(() => { load(); }, [load]);

    const setFilter = k => e =>
        setFilters(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const grouped = groupByModel(allVehicles);
    const filtered = grouped
        .filter(g => !searchText || `${g.make} ${g.model}`.toLowerCase().includes(searchText.toLowerCase()))
        .sort((a, b) => {
            if (filters.sort === 'price_asc') return a.minRate - b.minRate;
            if (filters.sort === 'price_desc') return b.minRate - a.minRate;
            if (filters.sort === 'availability') return b.count - a.count;
            return 0;
        });

    const handleSelectModel = group => {
        update({ selectedModel: group, selectedVehicle: null, pickupLocation: null, returnLocation: null });
        navigate('/book/select-vendor');
    };

    return (
        <div className="cmp-page">
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
                <div className="cmp__trip-strip">
                    <div className="cmp__trip-item">
                        <span>📍 City</span>
                        <strong>{booking.pickupCity.name}</strong>
                    </div>
                    <div className="cmp__trip-item">
                        <span>📅 Dates</span>
                        <strong>{booking.pickupDate} → {booking.returnDate}</strong>
                    </div>
                    <div className="cmp__trip-item">
                        <span>⏱ Duration</span>
                        <strong>{nights} day{nights > 1 ? 's' : ''}</strong>
                    </div>
                    {booking.isDifferentReturn && (
                        <div className="cmp__trip-item">
                            <span>🏁 Return to</span>
                            <strong>{booking.returnCity?.name}</strong>
                        </div>
                    )}
                </div>

                <div className="cmp__layout">
                    {/* Filters */}
                    <aside className="cmp__sidebar">
                        <h3>Filter Cars</h3>
                        <div className="cmp__search-box">
                            <input type="text" placeholder="Search make or model…"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)} />
                        </div>

                        {[
                            ['Category', 'segment', [['', 'All Types'], ['hatchback', 'Hatchback'], ['sedan', 'Sedan'], ['suv', 'SUV'], ['luxury', 'Luxury'], ['van', 'Van'], ['truck', 'Truck']]],
                            ['Fuel Type', 'fuel_type', [['', 'Any Fuel'], ['petrol', 'Petrol'], ['diesel', 'Diesel'], ['electric', 'Electric'], ['hybrid', 'Hybrid'], ['cng', 'CNG']]],
                            ['Transmission', 'transmission', [['', 'Any'], ['manual', 'Manual'], ['automatic', 'Automatic']]],
                            ['Sort By', 'sort', [['price_asc', 'Price: Low → High'], ['price_desc', 'Price: High → Low'], ['availability', 'Most Available']]],
                        ].map(([label, key, opts]) => (
                            <div key={key} className="cmp__filter-group">
                                <label>{label}</label>
                                <select value={filters[key]} onChange={setFilter(key)}>
                                    {opts.map(([val, txt]) => <option key={val} value={val}>{txt}</option>)}
                                </select>
                            </div>
                        ))}

                        <label className="cmp__certified-toggle">
                            <input type="checkbox" checked={filters.certified_only} onChange={setFilter('certified_only')} />
                            <span className="cmp__certified-toggle-track" />
                            <span>Certified only 🏅</span>
                        </label>
                    </aside>

                    {/* Results */}
                    <div className="cmp__results">
                        <div className="cmp__results-header">
                            {loading ? (
                                <h2>Searching available cars…</h2>
                            ) : error ? (
                                <div className="cmp__error">
                                    <p>{error}</p>
                                    <button onClick={load}>↺ Retry</button>
                                </div>
                            ) : (
                                <h2>{filtered.length} car model{filtered.length !== 1 ? 's' : ''} available</h2>
                            )}
                            <p className="cmp__results-sub">
                                in {booking.pickupCity.name} · {booking.pickupDate} to {booking.returnDate}
                            </p>
                        </div>

                        {loading ? (
                            <div className="cmp__skeletons">
                                {[1, 2, 3, 4].map(i => <div key={i} className="cmp__skeleton wz-skeleton" style={{ height: 320 }} />)}
                            </div>
                        ) : filtered.length === 0 && !error ? (
                            <div className="cmp__empty">
                                <div>🔍</div>
                                <h3>No cars match your filters</h3>
                                <p>Try removing some filters or selecting different dates.</p>
                                <button onClick={() => setFilters({ segment: '', fuel_type: '', transmission: '', certified_only: false, sort: 'price_asc' })}>
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            <div className="cmp__grid">
                                {filtered.map(g => (
                                    <ModelCard key={`${g.make}-${g.model}`} group={g} nights={nights} onSelect={handleSelectModel} />
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

function ModelCard({ group: g, nights, onSelect }) {
    const totalMin = (g.minRate * nights).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const totalMax = (g.maxRate * nights).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return (
        <div className="model-card" onClick={() => onSelect(g)}>
            <div className="model-card__photo">
                {g.photos?.length > 0
                    ? <img src={g.photos[0].image} alt={`${g.make} ${g.model}`} />
                    : <div className="model-card__icon">{SEGMENT_ICONS[g.segment] || '🚗'}</div>
                }
                {g.certified_count > 0 && (
                    <div className="model-card__cert-badge">🏅 {g.certified_count} Certified</div>
                )}
                <div className="model-card__vendor-count">{g.count} vendor{g.count !== 1 ? 's' : ''}</div>
            </div>

            <div className="model-card__body">
                <div className="model-card__title">
                    <h3>{g.make} {g.model}</h3>
                    <span className="model-card__segment">{SEGMENT_ICONS[g.segment]} {g.segment}</span>
                </div>

                <div className="model-card__specs">
                    <span>💺 {g.capacity} seats</span>
                    {[...g.fuel_types].map(f => (
                        <span key={f} className="model-card__fuel" style={{ '--fc': FUEL_COLOR[f] || '#9CA3AF' }}>
                            ⛽ {f}
                        </span>
                    ))}
                    {[...g.transmissions].map(t => <span key={t}>⚙️ {t}</span>)}
                </div>

                <div className="model-card__pricing">
                    <div className="model-card__rate">
                        <span className="model-card__rate-from">from</span>
                        <span className="model-card__rate-value">₹{g.minRate.toLocaleString('en-IN')}</span>
                        <span className="model-card__rate-unit">/day</span>
                    </div>
                    <div className="model-card__total">
                        ₹{totalMin}{g.minRate !== g.maxRate ? `–₹${totalMax}` : ''} for {nights} day{nights > 1 ? 's' : ''}
                    </div>
                </div>

                <button className="model-card__cta" onClick={e => { e.stopPropagation(); onSelect(g); }}>
                    See Vendors & Pricing →
                </button>
            </div>
        </div>
    );
}