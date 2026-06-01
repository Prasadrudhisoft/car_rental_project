// ─────────────────────────────────────────────────────────────────────────────
// CarModelSelectPage.jsx  (Step 1 — Select Car)
// Route: /book/select-car
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../context/BookingContext';
import { searchVehicles } from '../../services/api';
import { WizardShell, WizardProgress, buildSteps, useAuthModal } from './BookingShared';
import { groupByModel, calcNights } from './bookingConstants';
import ModelCard from './ModelCard';
import './CarModelSelectPage.css';
import '../BookingWizard.css';

export default function CarModelSelectPage() {
    const navigate             = useNavigate();
    const { booking, update }  = useBooking();
    const { openAuth, AuthModalEl } = useAuthModal();

    const [allVehicles, setAllVehicles] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');
    const [searchText,  setSearchText]  = useState('');
    const [filters,     setFilters]     = useState({
        segment: '', fuel_type: '', transmission: '',
        certified_only: false, sort: 'price_asc',
    });

    useEffect(() => {
        if (!booking.pickupCity || !booking.pickupDate) navigate('/');
    }, [booking.pickupCity, booking.pickupDate, navigate]);

    const nights = calcNights(booking.pickupDate, booking.returnDate);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data } = await searchVehicles({
                city:         booking.pickupCity.id,
                pickup_date:  booking.pickupDate,
                return_date:  booking.returnDate,
                ...(filters.segment       && { segment:       filters.segment }),
                ...(filters.fuel_type     && { fuel_type:     filters.fuel_type }),
                ...(filters.transmission  && { transmission:  filters.transmission }),
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

    const grouped  = groupByModel(allVehicles);
    const filtered = grouped
        .filter(g => !searchText || `${g.make} ${g.model}`.toLowerCase().includes(searchText.toLowerCase()))
        .sort((a, b) => {
            if (filters.sort === 'price_asc')    return a.minRate - b.minRate;
            if (filters.sort === 'price_desc')   return b.minRate - a.minRate;
            if (filters.sort === 'availability') return b.count - a.count;
            return 0;
        });

    const handleSelectModel = group => {
        update({ selectedModel: group, selectedVehicle: null, pickupLocation: null, returnLocation: null });
        navigate('/book/select-vendor');
    };

    const steps = buildSteps('car', booking.isDifferentReturn);

    return (
        <WizardShell onLoginClick={openAuth} className="cmp-page">
            <WizardProgress steps={steps} />

            {/* Trip strip */}
            <div className="cmp__trip-strip">
                <div className="cmp__trip-item">
                    <span>📍 City</span>
                    <strong>{booking.pickupCity?.name}</strong>
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
                {/* ── Sidebar filters ── */}
                <aside className="cmp__sidebar">
                    <h3>Filter Cars</h3>
                    <div className="cmp__search-box">
                        <input
                            type="text"
                            placeholder="Search make or model…"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>

                    {[
                        ['Category',     'segment',      [['', 'All Types'], ['hatchback', 'Hatchback'], ['sedan', 'Sedan'], ['suv', 'SUV'], ['luxury', 'Luxury'], ['van', 'Van'], ['truck', 'Truck']]],
                        ['Fuel Type',    'fuel_type',    [['', 'Any Fuel'], ['petrol', 'Petrol'], ['diesel', 'Diesel'], ['electric', 'Electric'], ['hybrid', 'Hybrid'], ['cng', 'CNG']]],
                        ['Transmission', 'transmission', [['', 'Any'], ['manual', 'Manual'], ['automatic', 'Automatic']]],
                        ['Sort By',      'sort',         [['price_asc', 'Price: Low → High'], ['price_desc', 'Price: High → Low'], ['availability', 'Most Available']]],
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

                {/* ── Results ── */}
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
                            in {booking.pickupCity?.name} · {booking.pickupDate} to {booking.returnDate}
                        </p>
                    </div>

                    {loading ? (
                        <div className="cmp__skeletons">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="cmp__skeleton wz-skeleton" style={{ height: 320 }} />
                            ))}
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
                                <ModelCard
                                    key={`${g.make}-${g.model}`}
                                    group={g}
                                    nights={nights}
                                    onSelect={handleSelectModel}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {AuthModalEl}
        </WizardShell>
    );
}