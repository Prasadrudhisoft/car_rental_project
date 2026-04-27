// VendorSelectPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useBooking } from '../context/BookingContext';
import { calculatePrice, getOneWayFee } from '../services/api';
import Navbar from '../components/common/Navbar';
import AuthModal from '../components/auth/AuthModal';
import './VendorSelectPage.css';
import './BookingWizard.css';

// Fix default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const makeIcon = selected => new L.DivIcon({
    className: '',
    html: `<div class="vsp__pin${selected ? ' vsp__pin--selected' : ''}">📍</div>`,
    iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -40],
});

function FlyTo({ center }) {
    const map = useMap();
    useEffect(() => { if (center) map.flyTo(center, 13, { duration: 1 }); }, [center, map]);
    return null;
}

function getCoords(vehicle, cityCenter, idx) {
    if (vehicle.vendor_profile?.latitude && vehicle.vendor_profile?.longitude) {
        return [parseFloat(vehicle.vendor_profile.latitude), parseFloat(vehicle.vendor_profile.longitude)];
    }
    const spread = 0.018;
    const angle = (idx / 6) * 2 * Math.PI;
    return [cityCenter[0] + spread * Math.cos(angle), cityCenter[1] + spread * Math.sin(angle)];
}

const CITY_CENTERS = {
    Nashik: [20.006, 73.78], Mumbai: [19.076, 72.877], Pune: [18.521, 73.854],
    Nagpur: [21.145, 79.088], Aurangabad: [19.877, 75.343],
};

export default function VendorSelectPage() {
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [prices, setPrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [oneWayFee, setOneWayFee] = useState(0);
    const [showAuth, setShowAuth] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!booking.selectedModel || !booking.pickupCity) navigate('/');
    }, [booking.selectedModel, booking.pickupCity, navigate]);

    const model = booking.selectedModel;
    const nights = Math.max(1, Math.round(
        (new Date(booking.returnDate) - new Date(booking.pickupDate)) / 86400000
    ));
    const cityCenter = CITY_CENTERS[booking.pickupCity?.name] || [20.0, 73.78];

    useEffect(() => {
        if (booking.isDifferentReturn && booking.pickupCity?.id && booking.returnCity?.id) {
            getOneWayFee(booking.pickupCity.id, booking.returnCity.id)
                .then(({ data }) => setOneWayFee(parseFloat(data.fee) || 0))
                .catch(() => setOneWayFee(0));
        }
    }, [booking.isDifferentReturn, booking.pickupCity, booking.returnCity]);

    useEffect(() => {
        if (!model?.vehicles?.length) return;
        const fetchPrices = async () => {
            setLoadingPrices(true);
            const results = {};
            await Promise.all(model.vehicles.map(async v => {
                try {
                    const { data } = await calculatePrice({
                        vehicle_id: v.id,
                        pickup_date: booking.pickupDate,
                        return_date: booking.returnDate,
                        pickup_time: booking.pickupTime || null,
                        return_time: booking.returnTime || null,
                        addons: [], one_way_fee: oneWayFee,
                    });
                    results[v.id] = data;
                } catch {
                    const base = parseFloat(v.daily_rate) * nights;
                    const gst = base * 0.18;
                    results[v.id] = {
                        base_amount: base.toFixed(2), gst_amount: gst.toFixed(2),
                        grand_total: (base + gst + oneWayFee).toFixed(2), security_deposit: '2000.00',
                    };
                }
            }));
            setPrices(results);
            setLoadingPrices(false);
        };
        fetchPrices();
    }, [model?.vehicles, booking.pickupDate, booking.returnDate, oneWayFee, nights]);

    const handleSelectVehicle = v => {
        setSelectedVehicle(v);
        update({ selectedVehicle: null, pickupLocation: null, pickupVendor: null });
        setError('');
    };

    const handleConfirmVendor = () => {
        if (!selectedVehicle) { setError('Please select a vendor from the map or list.'); return; }
        const coords = getCoords(selectedVehicle, cityCenter, 0);
        update({
            selectedVehicle,
            pickupLocation: {
                id: selectedVehicle.pickup_location?.id || selectedVehicle.id,
                name: selectedVehicle.vendor_profile?.business_name || 'Vendor Location',
                lat: coords[0], lng: coords[1],
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

    if (!model) return null;

    const sorted = [...model.vehicles].sort((a, b) => parseFloat(a.daily_rate) - parseFloat(b.daily_rate));

    return (
        <div className="vsp-page">
            <Navbar onLoginClick={() => setShowAuth(true)} />
            <div className="wizard-page__inner">

                <div className="wizard-progress">
                    <div className="wizard-progress__step done"><span>✓</span> Select Car</div>
                    <div className="wizard-progress__step active"><span>2</span> Choose Vendor</div>
                    {booking.isDifferentReturn && <div className="wizard-progress__step"><span>3</span> Return Vendor</div>}
                    <div className="wizard-progress__step"><span>{booking.isDifferentReturn ? 4 : 3}</span> Add-ons & Pay</div>
                </div>

                <div className="vsp__model-recap">
                    <div className="vsp__model-recap-icon">
                        {model.segment === 'suv' ? '🚙' : model.segment === 'luxury' ? '🏎️' : model.segment === 'van' ? '🚐' : '🚗'}
                    </div>
                    <div>
                        <h2>{model.make} {model.model}</h2>
                        <p>{model.segment} · {[...model.fuel_types].join(', ')} · {nights} day{nights > 1 ? 's' : ''}</p>
                    </div>
                    <button className="vsp__change-car" onClick={() => navigate('/book/select-car')}>
                        ← Change Car
                    </button>
                </div>

                <p className="vsp__instruction">
                    <strong>{model.count} vendor{model.count !== 1 ? 's' : ''}</strong>{' '}
                    offer{model.count === 1 ? 's' : ''} this car in {booking.pickupCity.name}.
                    Select a pin on the map or a card to choose.
                </p>

                <div className="vsp__map-layout">
                    {/* Map */}
                    <div className="vsp__map-container">
                        <MapContainer center={cityCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; OpenStreetMap contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FlyTo center={cityCenter} />
                            {sorted.map((v, idx) => {
                                const coords = getCoords(v, cityCenter, idx);
                                const p = prices[v.id];
                                const isSelected = selectedVehicle?.id === v.id;
                                return (
                                    <Marker key={v.id} position={coords} icon={makeIcon(isSelected)}
                                        eventHandlers={{ click: () => handleSelectVehicle(v) }}>
                                        <Popup>
                                            <div className="vsp__popup">
                                                <strong>{v.vendor_profile?.business_name || 'Vendor'}</strong>
                                                <p>₹{parseInt(v.daily_rate).toLocaleString()}/day</p>
                                                {p && <p>Total: ₹{parseFloat(p.grand_total).toLocaleString()}</p>}
                                                <button onClick={() => handleSelectVehicle(v)}>Select this vendor</button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    </div>

                    {/* Vendor cards */}
                    <div className="vsp__vendor-list">
                        <h3>Vendors & Pricing</h3>
                        {sorted.map((v, idx) => {
                            const p = prices[v.id];
                            const isSelected = selectedVehicle?.id === v.id;
                            return (
                                <button key={v.id}
                                    className={`vsp__vendor-card${isSelected ? ' selected' : ''}`}
                                    onClick={() => handleSelectVehicle(v)}>
                                    <div className="vsp__vendor-card__info">
                                        <strong>{v.vendor_profile?.business_name || `Vendor ${idx + 1}`}</strong>
                                        <div className="vsp__vendor-card__meta">
                                            {v.vendor_profile?.rating && <span>⭐ {v.vendor_profile.rating}</span>}
                                            {v.is_certified && <span className="vsp__cert">🏅 Certified</span>}
                                            <span>⚙️ {v.transmission}</span>
                                            <span>⛽ {v.fuel_type}</span>
                                        </div>
                                        {v.vendor_profile?.shop_opening_time && (
                                            <div className="vsp__vendor-card__hours">
                                                🕐 {v.vendor_profile.shop_opening_time} – {v.vendor_profile.shop_closing_time}
                                            </div>
                                        )}
                                    </div>
                                    <div className="vsp__vendor-card__price">
                                        <div className="vsp__rate">₹{parseInt(v.daily_rate).toLocaleString()}<span>/day</span></div>
                                        {loadingPrices
                                            ? <div className="vsp__price-loading">Calculating…</div>
                                            : p ? <div className="vsp__total">₹{parseFloat(p.grand_total).toLocaleString()} total</div>
                                                : null}
                                    </div>
                                    {isSelected && <div className="vsp__vendor-card__check">✓</div>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {error && <div className="wizard-error">{error}</div>}

                {selectedVehicle && (
                    <div className="vsp__selected-summary">
                        ✓ <strong>{selectedVehicle.vendor_profile?.business_name}</strong> selected
                        {prices[selectedVehicle.id] && (
                            <span> · Total: <strong>₹{parseFloat(prices[selectedVehicle.id].grand_total).toLocaleString()}</strong></span>
                        )}
                    </div>
                )}

                <div className="wizard-page__actions">
                    <button className="wizard-btn--back" onClick={() => navigate('/book/select-car')}>← Back</button>
                    <button className="wizard-btn--next" onClick={handleConfirmVendor} disabled={!selectedVehicle}>
                        {booking.isDifferentReturn ? 'Select Return Vendor →' : 'Choose Add-ons →'}
                    </button>
                </div>
            </div>
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </div>
    );
}