// Route: /book/return-vendor  (one-way trips only)
import React, { useState, useEffect } from 'react';
import { useNavigate }     from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L                   from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useBooking }      from '../../context/BookingContext';
import { getReturnOptions } from '../../services/api';
import { WizardShell, WizardProgress, buildSteps } from './BookingShared';
import { fixLeafletIcons, makePinIcon, getCityCenter } from './bookingConstants';
import MapFix from './MapFix';
import './VendorSelectPage.css';
import '../BookingWizard.css';

fixLeafletIcons(L);

function FlyTo({ center }) {
    const map = useMap();
    React.useEffect(() => { if (center) map.flyTo(center, 13, { duration: 1 }); }, [center, map]);
    return null;
}

export default function ReturnVendorPage() {
    const navigate            = useNavigate();
    const { booking, update } = useBooking();
    const [points,  setPoints]  = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!booking.returnCity?.id) return;
        getReturnOptions(booking.returnCity.id, booking.selectedVehicle?.id)
            .then(({ data }) => setPoints(
                data.map(o => ({
                    id:      o.location_id,
                    name:    o.name,
                    address: o.address,
                    lat:     parseFloat(o.latitude),
                    lng:     parseFloat(o.longitude),
                    slots:   o.available_slots,
                    rating:  o.rating,
                    hours:   o.opening_time ? `${o.opening_time} – ${o.closing_time}` : '',
                }))
            ))
            .catch(() => { setPoints([]); setError('Could not load drop points. Please try again.'); })
            .finally(() => setLoading(false));
    }, [booking.returnCity, booking.selectedVehicle]);

    if (!booking.selectedVehicle || !booking.isDifferentReturn) {
        navigate('/');
        return null;
    }

    const returnCityName = booking.returnCity?.name || 'Return City';
    const cityCenter     = getCityCenter(returnCityName);

    const handleSelect = pt => { setSelectedReturn(pt); setError(''); };

    const handleNext = () => {
        if (!selectedReturn) { setError('Please select a drop point.'); return; }
        update({
            returnLocation: { id: selectedReturn.id, name: selectedReturn.name, address: selectedReturn.address },
            returnVendor:   { business_name: selectedReturn.name },
        });
        navigate('/book/addons');
    };

    const steps = buildSteps('return', true);

    return (
        <WizardShell className="vsp-page">
            <WizardProgress steps={steps} />

            <div className="vsp__model-recap">
                <div className="vsp__model-recap-icon">🏁</div>
                <div>
                    <h2>Select Drop Point in {returnCityName}</h2>
                    <p>Partner vendors in {returnCityName} who can accept your {booking.selectedVehicle.make} {booking.selectedVehicle.model}.</p>
                </div>
            </div>

            <div className="vsp__map-layout">
                <div className="vsp__map-container">
                    <MapContainer center={cityCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer attribution='&copy; OpenStreetMap contributors'
                                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <FlyTo center={cityCenter} />
                        <MapFix />
                        {points.filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng)).map(pt => (
                            <Marker key={pt.id} position={[pt.lat, pt.lng]}
                                    icon={makePinIcon(L, selectedReturn?.id === pt.id, '🏁')}
                                    eventHandlers={{ click: () => handleSelect(pt) }}>
                                <Popup>
                                    <div className="vsp__popup">
                                        <strong>{pt.name}</strong>
                                        <p>{pt.address}</p>
                                        <button onClick={() => handleSelect(pt)}>Select</button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                <div className="vsp__vendor-list">
                    <h3>Available drop points in {returnCityName}</h3>
                    {loading && <div className="wz-skeleton" style={{ height: 70, borderRadius: 12 }} />}
                    {!loading && points.length === 0 && (
                        <div className="vsp__no-results">
                            <h3>No drop points are available in {returnCityName} right now.</h3>
                            <p>Every partner there is full or none has joined yet. Try another city or a round trip.</p>
                        </div>
                    )}
                    {points.map(pt => (
                        <button key={pt.id}
                                className={`vsp__vendor-card${selectedReturn?.id === pt.id ? ' selected' : ''}`}
                                onClick={() => handleSelect(pt)}>
                            <div className="vsp__vendor-card__info">
                                <strong>{pt.name}</strong>
                                <div className="vsp__vendor-card__hours">📍 {pt.address || 'Address on file'}</div>
                                <div className="vsp__vendor-card__meta">
                                    {Number(pt.rating) > 0 && <span>⭐ {pt.rating}</span>}
                                    <span>{pt.slots} slot{pt.slots !== 1 ? 's' : ''} free</span>
                                    {pt.hours && <span>🕐 {pt.hours}</span>}
                                </div>
                            </div>
                            {selectedReturn?.id === pt.id && <div className="vsp__vendor-card__check">✓</div>}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="wizard-error">{error}</div>}

            {selectedReturn && (
                <div className="vsp__selected-summary">
                    ✓ Drop point: <strong>{selectedReturn.name}</strong>{selectedReturn.address ? ` — ${selectedReturn.address}` : ''}
                </div>
            )}

            <div className="wizard-page__actions">
                <button className="wizard-btn--back" onClick={() => navigate('/book/select-vendor')}>← Back</button>
                <button className="wizard-btn--next" onClick={handleNext} disabled={!selectedReturn}>
                    Choose Add-ons →
                </button>
            </div>
        </WizardShell>
    );
}