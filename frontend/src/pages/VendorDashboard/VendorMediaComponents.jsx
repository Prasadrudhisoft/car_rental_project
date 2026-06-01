// ─────────────────────────────────────────────────────────────────────────────
// VendorMediaComponents.jsx
// PhotoLightbox  — full-screen image carousel (keyboard navigable)
// KYCDocumentViewer — shows vendor KYC doc as thumbnail / PDF link
// MapPicker     — Leaflet map for vendor pickup location pin
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';

// ── Photo lightbox ────────────────────────────────────────────────────────────
export function PhotoLightbox({ photos, initialIndex, onClose }) {
    const [current, setCurrent] = useState(initialIndex || 0);

    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape')      onClose();
            if (e.key === 'ArrowRight')  setCurrent(c => Math.min(c + 1, photos.length - 1));
            if (e.key === 'ArrowLeft')   setCurrent(c => Math.max(c - 1, 0));
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [photos.length, onClose]);

    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}
        >
            <button
                onClick={onClose}
                style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
                ✕ Close
            </button>
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                    onClick={() => setCurrent(c => Math.max(c - 1, 0))}
                    disabled={current === 0}
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 18, cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.3 : 1 }}
                >‹</button>
                <div style={{ textAlign: 'center' }}>
                    <img
                        src={photos[current].image || photos[current].url || photos[current]}
                        alt={photos[current].angle || 'photo'}
                        style={{ maxWidth: 'min(80vw, 900px)', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12 }}
                    />
                    {photos[current].angle && (
                        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>
                            {photos[current].angle} · {current + 1}/{photos.length}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setCurrent(c => Math.min(c + 1, photos.length - 1))}
                    disabled={current === photos.length - 1}
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 18, cursor: current === photos.length - 1 ? 'not-allowed' : 'pointer', opacity: current === photos.length - 1 ? 0.3 : 1 }}
                >›</button>
            </div>
        </div>
    );
}

// ── KYC document viewer ───────────────────────────────────────────────────────
export function KYCDocumentViewer({ profile }) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    if (!profile?.kyc_document) return null;

    const isPDF   = profile.kyc_document.toLowerCase().includes('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(profile.kyc_document);

    return (
        <div className="vd-kyc-doc-viewer">
            <div className="vd-kyc-doc-viewer__label">KYC Document</div>
            {isImage ? (
                <>
                    <div className="vd-kyc-doc-viewer__thumb" onClick={() => setLightboxOpen(true)}>
                        <img src={profile.kyc_document} alt="KYC Document" />
                        <div className="vd-kyc-doc-viewer__overlay"><span>🔍 Click to enlarge</span></div>
                    </div>
                    {lightboxOpen && (
                        <PhotoLightbox
                            photos={[{ image: profile.kyc_document, angle: 'KYC Document' }]}
                            initialIndex={0}
                            onClose={() => setLightboxOpen(false)}
                        />
                    )}
                </>
            ) : isPDF ? (
                <a href={profile.kyc_document} target="_blank" rel="noopener noreferrer" className="vd-kyc-doc-viewer__pdf-link">
                    <span>📄</span><span>View PDF Document</span>
                </a>
            ) : (
                <a href={profile.kyc_document} target="_blank" rel="noopener noreferrer" className="vd-btn vd-btn--outline vd-btn--sm">
                    View Document
                </a>
            )}
        </div>
    );
}

// ── Map picker ────────────────────────────────────────────────────────────────
export function MapPicker({ lat, lng, onLocationSelect }) {
    const mapRef        = useRef(null);
    const leafletMapRef = useRef(null);
    const markerRef     = useRef(null);
    const [mapReady,    setMapReady]    = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searching,   setSearching]   = useState(false);

    // Load Leaflet dynamically
    useEffect(() => {
        if (window.L) { setMapReady(true); return; }
        const link   = document.createElement('link');
        link.rel     = 'stylesheet';
        link.href    = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(link);
        const script    = document.createElement('script');
        script.src      = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload   = () => setMapReady(true);
        document.head.appendChild(script);
    }, []);

    // Initialise map once Leaflet is ready
    useEffect(() => {
        if (!mapReady || !mapRef.current || leafletMapRef.current) return;
        const L   = window.L;
        const map = L.map(mapRef.current).setView([lat || 20.5937, lng || 78.9629], lat ? 15 : 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        const makeIcon = () => L.divIcon({
            className: '',
            html: `<div style="width:28px;height:28px;background:#0DB89E;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>`,
            iconSize: [28, 28], iconAnchor: [14, 28],
        });

        if (lat && lng) {
            markerRef.current = L.marker([lat, lng], { icon: makeIcon(), draggable: true }).addTo(map);
            markerRef.current.on('dragend', e => {
                const { lat: la, lng: lo } = e.target.getLatLng();
                onLocationSelect(la, lo);
            });
        }

        map.on('click', e => {
            const { lat: la, lng: lo } = e.latlng;
            if (markerRef.current) {
                markerRef.current.setLatLng([la, lo]);
            } else {
                markerRef.current = L.marker([la, lo], { icon: makeIcon(), draggable: true }).addTo(map);
                markerRef.current.on('dragend', ev => {
                    const { lat: dla, lng: dlo } = ev.target.getLatLng();
                    onLocationSelect(dla, dlo);
                });
            }
            onLocationSelect(la, lo);
        });

        leafletMapRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);
    }, [mapReady]); // eslint-disable-line

    // Sync marker when lat/lng props change
    useEffect(() => {
        if (!leafletMapRef.current || !window.L || !lat || !lng) return;
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        leafletMapRef.current.setView([lat, lng], 15);
    }, [lat, lng]);

    const handleSearch = async () => {
        if (!searchInput.trim()) return;
        setSearching(true);
        try {
            const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchInput)}&format=json&limit=1`);
            const data = await res.json();
            if (data.length > 0) {
                const la = parseFloat(data[0].lat);
                const lo = parseFloat(data[0].lon);
                leafletMapRef.current.setView([la, lo], 16);
                const L      = window.L;
                const icon   = L.divIcon({ className: '', html: `<div style="width:28px;height:28px;background:#0DB89E;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>`, iconSize: [28, 28], iconAnchor: [14, 28] });
                if (markerRef.current) {
                    markerRef.current.setLatLng([la, lo]);
                } else {
                    markerRef.current = L.marker([la, lo], { icon, draggable: true }).addTo(leafletMapRef.current);
                    markerRef.current.on('dragend', e => {
                        const { lat: dla, lng: dlo } = e.target.getLatLng();
                        onLocationSelect(dla, dlo);
                    });
                }
                onLocationSelect(la, lo);
            }
        } catch { /* ignore network errors */ }
        setSearching(false);
    };

    return (
        <div className="vd-map-picker">
            <div className="vd-map-picker__toolbar">
                <div className="vd-map-picker__hint">📍 Click the map to pin your exact pickup location.</div>
                <div className="vd-map-picker__search">
                    <input
                        className="vd-input"
                        placeholder="Search address…"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        style={{ flex: 1 }}
                    />
                    <button className="vd-upload-btn" onClick={handleSearch} disabled={searching}>
                        {searching ? '…' : 'Search'}
                    </button>
                </div>
            </div>
            {!mapReady && (
                <div className="vd-map-picker__loading">
                    <div className="vd-spinner" /> Loading map…
                </div>
            )}
            <div ref={mapRef} className="vd-map-picker__canvas" style={{ display: mapReady ? 'block' : 'none' }} />
            {lat && lng && (
                <div className="vd-map-picker__coords">
                    <span>📌 {parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}</span>
                    <button className="vd-link-btn vd-link-btn--danger" onClick={() => onLocationSelect(null, null)}>✕ Clear</button>
                </div>
            )}
        </div>
    );
}