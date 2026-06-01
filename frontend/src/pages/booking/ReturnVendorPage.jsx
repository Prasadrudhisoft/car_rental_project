// ─────────────────────────────────────────────────────────────────────────────
// ReturnVendorPage.jsx  (Step 3 — Return Vendor, one-way trips only)
// Route: /book/return-vendor
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useNavigate }     from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L                   from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useBooking }      from '../../context/BookingContext';
import { WizardShell, WizardProgress, buildSteps } from './BookingShared';
import { fixLeafletIcons, makePinIcon, getCityCenter } from './bookingConstants';
import './VendorSelectPage.css';
import '../BookingWizard.css';

fixLeafletIcons(L);

function FlyTo({ center }) {
    const map = useMap();
    React.useEffect(() => {
        if (center) map.flyTo(center, 13, { duration: 1 });
    }, [center, map]);
    return null;
}

export default function ReturnVendorPage() {
    const navigate            = useNavigate();
    const { booking, update } = useBooking();
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [error,          setError]          = useState('');

    if (!booking.selectedVehicle || !booking.isDifferentReturn) {
        navigate('/');
        return null;
    }

    const returnCityName = booking.returnCity?.name || 'Return City';
    const cityCenter     = getCityCenter(returnCityName);

    // Place each return-vendor vehicle at a spread around the city centre
    const returnVendors = (booking.selectedModel?.vehicles || []).map((v, idx) => {
        const angle = (idx / 6) * 2 * Math.PI;
        return {
            ...v,
            lat: cityCenter[0] + 0.018 * Math.cos(angle),
            lng: cityCenter[1] + 0.018 * Math.sin(angle),
        };
    });

    const handleSelect = v => { setSelectedReturn(v); setError(''); };

    const handleNext = () => {
        if (!selectedReturn) { setError('Please select a return vendor.'); return; }
        update({
            returnLocation: {
                id:   selectedReturn.id,
                name: selectedReturn.vendor_profile?.business_name || 'Return Vendor',
            },
            returnVendor: selectedReturn.vendor_profile,
        });
        navigate('/book/addons');
    };

    const steps = buildSteps('return', true);

    return (
        <WizardShell className="vsp-page">
            <WizardProgress steps={steps} />

            {/* Recap */}
            <div className="vsp__model-recap">
                <div className="vsp__model-recap-icon">🏁</div>
                <div>
                    <h2>Select Return Vendor in {returnCityName}</h2>
                    <p>
                        Where will you drop off the{' '}
                        {booking.selectedModel?.make} {booking.selectedModel?.model}?
                    </p>
                </div>
            </div>

            <div className="vsp__map-layout">
                {/* Map */}
                <div className="vsp__map-container">
                    <MapContainer center={cityCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <FlyTo center={cityCenter} />
                        {returnVendors.map(v => (
                            <Marker
                                key={v.id}
                                position={[v.lat, v.lng]}
                                icon={makePinIcon(L, selectedReturn?.id === v.id, '🏁')}
                                eventHandlers={{ click: () => handleSelect(v) }}
                            >
                                <Popup>
                                    <div className="vsp__popup">
                                        <strong>{v.vendor_profile?.business_name || 'Vendor'}</strong>
                                        <button onClick={() => handleSelect(v)}>Select</button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {/* Vendor list */}
                <div className="vsp__vendor-list">
                    <h3>Network Vendors in {returnCityName}</h3>
                    {returnVendors.map(v => (
                        <button
                            key={v.id}
                            className={`vsp__vendor-card${selectedReturn?.id === v.id ? ' selected' : ''}`}
                            onClick={() => handleSelect(v)}
                        >
                            <div className="vsp__vendor-card__info">
                                <strong>{v.vendor_profile?.business_name || 'Vendor'}</strong>
                                <div className="vsp__vendor-card__meta">
                                    {v.vendor_profile?.rating && <span>⭐ {v.vendor_profile.rating}</span>}
                                    {v.is_certified && <span className="vsp__cert">🏅 Certified</span>}
                                </div>
                            </div>
                            {selectedReturn?.id === v.id && (
                                <div className="vsp__vendor-card__check">✓</div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="wizard-error">{error}</div>}

            {selectedReturn && (
                <div className="vsp__selected-summary">
                    ✓ Return vendor: <strong>{selectedReturn.vendor_profile?.business_name}</strong>
                </div>
            )}

            <div className="wizard-page__actions">
                <button className="wizard-btn--back" onClick={() => navigate('/book/select-vendor')}>
                    ← Back
                </button>
                <button className="wizard-btn--next" onClick={handleNext} disabled={!selectedReturn}>
                    Choose Add-ons →
                </button>
            </div>
        </WizardShell>
    );
}