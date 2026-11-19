import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapFix from '../../pages/booking/MapFix';
import { fixLeafletIcons, makePinIcon } from '../../pages/booking/bookingConstants';
import '../../pages/booking/VendorSelectPage.css';   // pin + popup styles
import '../../pages/BookingWizard.css';

fixLeafletIcons(L);

function View({ points, target }) {
    const map = useMap();
    useEffect(() => {
        if (target) map.flyTo(target, 14, { duration: 0.8 });
        else if (points.length > 1) map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 15 });
        else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target?.[0], target?.[1], points.length]);
    return null;
}

/** points: [{ id, lat, lng, title, subtitle, meta, current }] */
export default function LocationMap({ points, selectedId, onSelect, emoji = '📍', center, height = 280 }) {
    const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const sel = valid.find(p => p.id === selectedId);
    return (
        <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--cd-bdr)', isolation: 'isolate' }}>
            <MapContainer center={center || [20.0, 73.78]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapFix />
                <View points={valid} target={sel ? [sel.lat, sel.lng] : null} />
                {valid.map(p => (
                    <Marker key={p.id} position={[p.lat, p.lng]}
                            icon={makePinIcon(L, p.id === selectedId, p.current ? '📌' : emoji)}
                            eventHandlers={{ click: () => onSelect(p.id) }}>
                        <Popup>
                            <div className="vsp__popup">
                                <strong>{p.title}</strong>
                                {p.subtitle && <p>{p.subtitle}</p>}
                                {p.meta && <p>{p.meta}</p>}
                                <button onClick={() => onSelect(p.id)}>{p.current ? 'Keep this point' : 'Select this point'}</button>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}