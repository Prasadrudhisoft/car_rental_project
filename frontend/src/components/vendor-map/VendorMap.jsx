import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './VendorMap.css';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const selectedIcon = new L.DivIcon({
    className: 'vendor-map__marker--selected',
    html: `<div class="vendor-map__pin vendor-map__pin--selected"><span>📍</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
});

const defaultIcon = new L.DivIcon({
    className: 'vendor-map__marker',
    html: `<div class="vendor-map__pin"><span>📍</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
});

function FlyTo({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 13, { duration: 1.2 });
    }, [center, map]);
    return null;
}

// Mock vendor data when API is unavailable
const MOCK_VENDORS = [
    { id: 1, name: 'Sharma Car Rentals', address: 'College Road, Nashik', lat: 19.9975, lng: 73.7898, rating: 4.5, vehicles: 12, opening_time: '08:00', closing_time: '20:00' },
    { id: 2, name: 'RoadKing Motors', address: 'Gangapur Road, Nashik', lat: 20.0112, lng: 73.7698, rating: 4.2, vehicles: 8, opening_time: '09:00', closing_time: '21:00' },
    { id: 3, name: 'Driveway Rentals', address: 'Panchavati, Nashik', lat: 20.0059, lng: 73.8053, rating: 4.7, vehicles: 15, opening_time: '07:30', closing_time: '22:00' },
    { id: 4, name: 'City Wheels', address: 'Satpur, Nashik', lat: 19.9850, lng: 73.7650, rating: 4.0, vehicles: 6, opening_time: '08:30', closing_time: '19:30' },
];

export default function VendorMap({ cityName, onSelect, selected }) {
    const [vendors, setVendors] = useState(MOCK_VENDORS);
    const [center, setCenter] = useState([20.0, 73.78]);

    useEffect(() => {
        // In production: fetch from API based on cityName
        // For now use mock data with city-appropriate coords
        if (cityName?.toLowerCase().includes('nashik')) {
            setCenter([20.0, 73.78]);
        } else if (cityName?.toLowerCase().includes('mumbai')) {
            setCenter([19.076, 72.877]);
            setVendors(MOCK_VENDORS.map((v, i) => ({
                ...v,
                lat: 19.076 + (i - 1.5) * 0.02,
                lng: 72.877 + (i - 1.5) * 0.02,
            })));
        } else if (cityName?.toLowerCase().includes('pune')) {
            setCenter([18.521, 73.854]);
            setVendors(MOCK_VENDORS.map((v, i) => ({
                ...v,
                lat: 18.521 + (i - 1.5) * 0.02,
                lng: 73.854 + (i - 1.5) * 0.02,
            })));
        }
    }, [cityName]);

    return (
        <div className="vendor-map">
            <div className="vendor-map__list">
                <h3 className="vendor-map__list-title">
                    Available Vendors in {cityName || 'your city'}
                </h3>
                <div className="vendor-map__vendors">
                    {vendors.map((v) => (
                        <button
                            key={v.id}
                            className={`vendor-map__vendor-card ${selected?.id === v.id ? 'selected' : ''}`}
                            onClick={() => onSelect(v)}
                        >
                            <div className="vendor-map__vendor-info">
                                <strong>{v.name}</strong>
                                <span>{v.address}</span>
                                <div className="vendor-map__vendor-meta">
                                    <span>⭐ {v.rating}</span>
                                    <span>🚗 {v.vehicles} vehicles</span>
                                    <span>🕐 {v.opening_time}–{v.closing_time}</span>
                                </div>
                            </div>
                            {selected?.id === v.id && <div className="vendor-map__check">✓</div>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="vendor-map__map">
                <MapContainer
                    center={center}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FlyTo center={center} />
                    {vendors.map((v) => (
                        <Marker
                            key={v.id}
                            position={[v.lat, v.lng]}
                            icon={selected?.id === v.id ? selectedIcon : defaultIcon}
                            eventHandlers={{ click: () => onSelect(v) }}
                        >
                            <Popup>
                                <div className="vendor-map__popup">
                                    <strong>{v.name}</strong>
                                    <p>{v.address}</p>
                                    <p>⭐ {v.rating} · {v.vehicles} vehicles</p>
                                    <button onClick={() => onSelect(v)}>Select this vendor</button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}