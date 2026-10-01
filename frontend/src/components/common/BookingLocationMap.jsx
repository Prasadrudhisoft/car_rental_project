import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fixLeafletIcons } from '../../pages/booking/bookingConstants';

fixLeafletIcons(L);

const toPoint = l =>
    l && l.latitude != null && l.longitude != null &&
    !isNaN(parseFloat(l.latitude)) && !isNaN(parseFloat(l.longitude))
        ? [parseFloat(l.latitude), parseFloat(l.longitude)]
        : null;

// The map sits inside an animated modal, so re-measure after it settles.
function SizeFix() {
    const map = useMap();
    useEffect(() => {
        const t = setTimeout(() => map.invalidateSize(), 300);
        return () => clearTimeout(t);
    }, [map]);
    return null;
}

export default function BookingLocationMap({ pickup, drop }) {
    const p = toPoint(pickup);
    const d = toPoint(drop);
    const points = [p, d].filter(Boolean);
    if (!points.length) return null;

    const props = points.length > 1
        ? { bounds: points, boundsOptions: { padding: [30, 30] } }
        : { center: points[0], zoom: 15 };

    return (
        <div className="cd-loc-map">
            <MapContainer {...props} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <SizeFix />
                {p && (
                    <Marker position={p}>
                        <Popup><strong>Pickup</strong><br />{pickup.name}<br />{pickup.address}</Popup>
                    </Marker>
                )}
                {d && (
                    <Marker position={d}>
                        <Popup><strong>Drop</strong><br />{drop.name}<br />{drop.address}</Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}