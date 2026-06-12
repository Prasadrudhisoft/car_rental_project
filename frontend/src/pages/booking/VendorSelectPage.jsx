// ─────────────────────────────────────────────────────────────────────────────
// VendorSelectPage.jsx  (Step 2 — Browse Vehicles & Choose Vendor)
// Route: /book/select-vendor
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate }                from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L                              from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useBooking }                 from '../../context/BookingContext';
import { calculatePrice, getOneWayFee, searchVehicles } from '../../services/api';
import { WizardShell, WizardProgress, buildSteps, useAuthModal } from './BookingShared';
import {
    fixLeafletIcons, makePinIcon, getCityCenter,
    getVehicleCoords, calcNights, segIcon, SEGMENT_ICONS,
} from './bookingConstants';
import './VendorSelectPage.css';
import '../BookingWizard.css';

fixLeafletIcons(L);

// ── FlyTo helper (inside MapContainer) ───────────────────────────────────────
function FlyTo({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 13, { duration: 1 });
    }, [center, map]);
    return null;
}

// ── Default filter state ──────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
    fuel_type:      '',
    transmission:   '',
    model_search:   '',
    certified_only: false,
    sort:           'price_asc',
};

export default function VendorSelectPage() {
    const navigate             = useNavigate();
    const { booking, update }  = useBooking();
    const { openAuth, AuthModalEl } = useAuthModal();

    // Raw vehicles from API (filtered server-side by segment + city + dates)
    const [vehicles,       setVehicles]       = useState([]);
    const [loadingVehicles,setLoadingVehicles] = useState(true);
    const [vehicleError,   setVehicleError]   = useState('');

    // Client-side filters
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    // Prices keyed by vehicle.id
    const [prices,        setPrices]        = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);

    // One-way fee (cross-city trips)
    const [oneWayFee, setOneWayFee] = useState(0);

    // Currently selected vehicle
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [error,           setError]           = useState('');

    // ── Guards ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!booking.selectedSegment || !booking.pickupCity) {
            navigate('/book/select-car');
        }
    }, [booking.selectedSegment, booking.pickupCity, navigate]);

    const nights     = calcNights(booking.pickupDate, booking.returnDate);
    const cityCenter = getCityCenter(booking.pickupCity?.name);
    const segment    = booking.selectedSegment || '';

    // ── One-way fee ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (booking.isDifferentReturn && booking.pickupCity?.id && booking.returnCity?.id) {
            getOneWayFee(booking.pickupCity.id, booking.returnCity.id)
                .then(({ data }) => setOneWayFee(parseFloat(data.fee) || 0))
                .catch(() => setOneWayFee(0));
        }
    }, [booking.isDifferentReturn, booking.pickupCity, booking.returnCity]);

    // ── Fetch vehicles for this segment ───────────────────────────────────────
    useEffect(() => {
        if (!booking.pickupCity?.id || !segment) return;
        const load = async () => {
            setLoadingVehicles(true); setVehicleError('');
            try {
                const { data } = await searchVehicles({
                    city:        booking.pickupCity.id,
                    pickup_date: booking.pickupDate,
                    return_date: booking.returnDate,
                    segment,
                });
                setVehicles(data.results || data || []);
            } catch {
                setVehicleError('Could not load vehicles. Check your connection.');
                setVehicles([]);
            } finally {
                setLoadingVehicles(false);
            }
        };
        load();
    }, [booking.pickupCity, booking.pickupDate, booking.returnDate, segment]);

    // ── Fetch prices for all loaded vehicles ──────────────────────────────────
    useEffect(() => {
        if (!vehicles.length) return;
        const fetchPrices = async () => {
            setLoadingPrices(true);
            const results = {};
            await Promise.all(vehicles.map(async v => {
                try {
                    const { data } = await calculatePrice({
                        vehicle_id:  v.id,
                        pickup_date: booking.pickupDate,
                        return_date: booking.returnDate,
                        pickup_time: booking.pickupTime || null,
                        return_time: booking.returnTime || null,
                        addons:      [],
                        one_way_fee: oneWayFee,
                    });
                    results[v.id] = data;
                } catch {
                    const base = parseFloat(v.daily_rate) * nights;
                    const gst  = base * 0.18;
                    results[v.id] = {
                        base_amount: base.toFixed(2),
                        gst_amount:  gst.toFixed(2),
                        grand_total: (base + gst + oneWayFee).toFixed(2),
                        security_deposit: '2000.00',
                    };
                }
            }));
            setPrices(results);
            setLoadingPrices(false);
        };
        fetchPrices();
    }, [vehicles, booking.pickupDate, booking.returnDate, oneWayFee, nights]);

    // ── Extract unique values for filter dropdowns ────────────────────────────
    const uniqueFuelTypes     = useMemo(() => [...new Set(vehicles.map(v => v.fuel_type))].sort(), [vehicles]);
    const uniqueTransmissions = useMemo(() => [...new Set(vehicles.map(v => v.transmission))].sort(), [vehicles]);
    const uniqueModels        = useMemo(() => [...new Set(vehicles.map(v => `${v.make} ${v.model}`))].sort(), [vehicles]);

    // ── Client-side filtering + sorting ──────────────────────────────────────
    const filtered = useMemo(() => {
        let result = [...vehicles];

        if (filters.fuel_type)
            result = result.filter(v => v.fuel_type === filters.fuel_type);
        if (filters.transmission)
            result = result.filter(v => v.transmission === filters.transmission);
        if (filters.model_search.trim())
            result = result.filter(v =>
                `${v.make} ${v.model}`.toLowerCase().includes(filters.model_search.toLowerCase())
            );
        if (filters.certified_only)
            result = result.filter(v => v.is_certified);

        result.sort((a, b) => {
            const pa = prices[a.id] ? parseFloat(prices[a.id].grand_total) : parseFloat(a.daily_rate) * nights;
            const pb = prices[b.id] ? parseFloat(prices[b.id].grand_total) : parseFloat(b.daily_rate) * nights;
            if (filters.sort === 'price_asc')  return pa - pb;
            if (filters.sort === 'price_desc') return pb - pa;
            if (filters.sort === 'rating')
                return parseFloat(b.vendor_profile?.rating || 0) - parseFloat(a.vendor_profile?.rating || 0);
            return 0;
        });

        return result;
    }, [vehicles, filters, prices, nights]);

    const setFilter = (key, value) =>
        setFilters(prev => ({ ...prev, [key]: value }));

    const clearFilters = () => setFilters(DEFAULT_FILTERS);

    const hasActiveFilter = Object.entries(filters).some(([k, v]) =>
        k !== 'sort' && v !== '' && v !== false
    );

    // ── Select a vehicle ──────────────────────────────────────────────────────
    const handleSelectVehicle = (v) => {
        setSelectedVehicle(v);
        update({ selectedVehicle: null, pickupLocation: null, pickupVendor: null });
        setError('');
    };

    // ── Confirm vendor and continue ───────────────────────────────────────────
    const handleConfirmVendor = () => {
        if (!selectedVehicle) {
            setError('Please select a vehicle from the map or list.');
            return;
        }
        const coords = getVehicleCoords(selectedVehicle, cityCenter, 0);
        update({
            selectedVehicle,
            selectedModel: {
                make:    selectedVehicle.make,
                model:   selectedVehicle.model,
                segment: selectedVehicle.segment,
                vehicles: [selectedVehicle],
            },
            pickupLocation: {
                id:   selectedVehicle.pickup_location?.id || selectedVehicle.id,
                name: selectedVehicle.vendor_profile?.business_name || 'Vendor Location',
                lat:  coords[0],
                lng:  coords[1],
            },
            pickupVendor: selectedVehicle.vendor_profile,
            oneWayFee,
        });

        if (booking.isDifferentReturn) {
            navigate('/book/return-vendor');
        } else {
            update({ returnLocation: null, returnVendor: null });
            navigate('/book/addons');
        }
    };

    if (!segment) return null;

    const steps   = buildSteps('vendor', booking.isDifferentReturn);
    const segLabel = segment.charAt(0).toUpperCase() + segment.slice(1);
    const segEmoji = SEGMENT_ICONS[segment] || '🚗';

    return (
        <WizardShell onLoginClick={openAuth} className="vsp-page">
            <WizardProgress steps={steps} />

            {/* Segment recap banner */}
            <div className="vsp__model-recap">
                <div className="vsp__model-recap-icon">{segEmoji}</div>
                <div>
                    <h2>{segLabel}s in {booking.pickupCity?.name}</h2>
                    <p>
                        {loadingVehicles
                            ? 'Loading vehicles…'
                            : `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} · ${nights} day${nights > 1 ? 's' : ''}`
                        }
                    </p>
                </div>
                <button className="vsp__change-car" onClick={() => navigate('/book/select-car')}>
                    ← Change Type
                </button>
            </div>

            {vehicleError && (
                <div className="wizard-error">{vehicleError}</div>
            )}

            <div className="vsp__body">

                {/* ── Filter sidebar ── */}
                <aside className="vsp__filters">
                    <h3>Filter Results</h3>

                    {/* Model search */}
                    <div className="vsp__filter-group">
                        <label>Search Model</label>
                        <input
                            type="text"
                            placeholder="e.g. Swift, Creta…"
                            value={filters.model_search}
                            onChange={e => setFilter('model_search', e.target.value)}
                        />
                    </div>

                    {/* Fuel type */}
                    <div className="vsp__filter-group">
                        <label>Fuel Type</label>
                        <select value={filters.fuel_type} onChange={e => setFilter('fuel_type', e.target.value)}>
                            <option value="">Any Fuel</option>
                            {uniqueFuelTypes.map(f => (
                                <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Transmission */}
                    <div className="vsp__filter-group">
                        <label>Transmission</label>
                        <select value={filters.transmission} onChange={e => setFilter('transmission', e.target.value)}>
                            <option value="">Any</option>
                            {uniqueTransmissions.map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort */}
                    <div className="vsp__filter-group">
                        <label>Sort By</label>
                        <select value={filters.sort} onChange={e => setFilter('sort', e.target.value)}>
                            <option value="price_asc">Price: Low → High</option>
                            <option value="price_desc">Price: High → Low</option>
                            <option value="rating">Vendor Rating</option>
                        </select>
                    </div>

                    {/* Certified only toggle */}
                    <label className="vsp__certified-toggle">
                        <input
                            type="checkbox"
                            checked={filters.certified_only}
                            onChange={e => setFilter('certified_only', e.target.checked)}
                        />
                        <span className="vsp__certified-track" />
                        <span>Certified only 🏅</span>
                    </label>

                    {/* Clear filters */}
                    {hasActiveFilter && (
                        <button className="vsp__filter-clear" onClick={clearFilters}>
                            ✕ Clear Filters
                        </button>
                    )}
                </aside>

                {/* ── Right: result count + map + list ── */}
                <div className="vsp__right">
                    {/* Result count */}
                    <div className="vsp__result-bar">
                        <h3>
                            {loadingVehicles
                                ? 'Searching…'
                                : `${filtered.length} vehicle${filtered.length !== 1 ? 's' : ''} found`
                            }
                        </h3>
                        <p>Select a pin on the map or a card below</p>
                    </div>

                    {/* Map + list */}
                    {!loadingVehicles && filtered.length === 0 ? (
                        <div className="vsp__no-results">
                            <div>🔍</div>
                            <h3>No vehicles match your filters</h3>
                            <p>Try removing some filters to see more options.</p>
                        </div>
                    ) : (
                        <div className="vsp__map-layout">
                            {/* Map */}
                            <div className="vsp__map-container">
                                <MapContainer
                                    center={cityCenter}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        attribution='&copy; OpenStreetMap contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    <FlyTo center={cityCenter} />
                                    {filtered.map((v, idx) => {
                                        const coords     = getVehicleCoords(v, cityCenter, idx);
                                        const p          = prices[v.id];
                                        const isSelected = selectedVehicle?.id === v.id;
                                        return (
                                            <Marker
                                                key={v.id}
                                                position={coords}
                                                icon={makePinIcon(L, isSelected, '📍')}
                                                eventHandlers={{ click: () => handleSelectVehicle(v) }}
                                            >
                                                <Popup>
                                                    <div className="vsp__popup">
                                                        <strong>{v.make} {v.model} ({v.year})</strong>
                                                        <p>{v.vendor_profile?.business_name}</p>
                                                        <p>₹{parseInt(v.daily_rate).toLocaleString()}/day</p>
                                                        {p && <p>Total: ₹{parseFloat(p.grand_total).toLocaleString()}</p>}
                                                        <button onClick={() => handleSelectVehicle(v)}>Select this vehicle</button>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </MapContainer>
                            </div>

                            {/* Vehicle list */}
                            <div className="vsp__vendor-list">
                                <h3>Vehicles &amp; Vendors</h3>
                                {loadingVehicles
                                    ? [1, 2, 3, 4].map(i => (
                                        <div key={i} className="wz-skeleton" style={{ height: 80, borderRadius: 12 }} />
                                    ))
                                    : filtered.map((v, idx) => {
                                        const p          = prices[v.id];
                                        const isSelected = selectedVehicle?.id === v.id;
                                        const coverPhoto = v.photos?.find(ph => ph.is_cover) || v.photos?.[0];
                                        return (
                                            <button
                                                key={v.id}
                                                className={`vsp__vendor-card${isSelected ? ' selected' : ''}`}
                                                onClick={() => handleSelectVehicle(v)}
                                            >
                                                {/* Thumbnail */}
                                                <div className="vsp__vehicle-thumb">
                                                    {coverPhoto
                                                        ? <img src={coverPhoto.image} alt={`${v.make} ${v.model}`} />
                                                        : <span>{segEmoji}</span>
                                                    }
                                                </div>

                                                {/* Info */}
                                                <div className="vsp__vendor-card__info">
                                                    <div className="vsp__vendor-card__title">
                                                        {v.year} {v.make} {v.model}
                                                    </div>
                                                    <div className="vsp__vendor-card__vendor">
                                                        🏪 {v.vendor_profile?.business_name || `Vendor ${idx + 1}`}
                                                    </div>
                                                    <div className="vsp__vendor-card__meta">
                                                        {v.vendor_profile?.rating
                                                            ? <span>⭐ {v.vendor_profile.rating}</span>
                                                            : null
                                                        }
                                                        {v.is_certified && <span className="vsp__cert">🏅 Certified</span>}
                                                        <span>⚙️ {v.transmission}</span>
                                                        <span>⛽ {v.fuel_type}</span>
                                                        <span>💺 {v.capacity}</span>
                                                    </div>
                                                    {v.vendor_profile?.shop_opening_time && (
                                                        <div className="vsp__vendor-card__hours">
                                                            🕐 {v.vendor_profile.shop_opening_time} – {v.vendor_profile.shop_closing_time}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Price */}
                                                <div className="vsp__vendor-card__price">
                                                    <div className="vsp__rate">
                                                        ₹{parseInt(v.daily_rate).toLocaleString()}<span>/day</span>
                                                    </div>
                                                    {loadingPrices
                                                        ? <div className="vsp__price-loading">Calculating…</div>
                                                        : p
                                                            ? <div className="vsp__total">₹{parseFloat(p.grand_total).toLocaleString()} total</div>
                                                            : null
                                                    }
                                                </div>

                                                {isSelected && (
                                                    <div className="vsp__vendor-card__check">✓</div>
                                                )}
                                            </button>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && <div className="wizard-error">{error}</div>}

            {selectedVehicle && (
                <div className="vsp__selected-summary">
                    ✓ <strong>{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</strong>
                    {' '}from{' '}
                    <strong>{selectedVehicle.vendor_profile?.business_name}</strong>
                    {prices[selectedVehicle.id] && (
                        <span>
                            {' '}· Total:{' '}
                            <strong>₹{parseFloat(prices[selectedVehicle.id].grand_total).toLocaleString()}</strong>
                        </span>
                    )}
                </div>
            )}

            <div className="wizard-page__actions">
                <button className="wizard-btn--back" onClick={() => navigate('/book/select-car')}>
                    ← Back
                </button>
                <button
                    className="wizard-btn--next"
                    onClick={handleConfirmVendor}
                    disabled={!selectedVehicle}
                >
                    {booking.isDifferentReturn ? 'Select Return Vendor →' : 'Choose Add-ons →'}
                </button>
            </div>

            {AuthModalEl}
        </WizardShell>
    );
}