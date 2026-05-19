/**
 * VendorDashboard.jsx — Table-view refactor
 *
 * Changes from original:
 * - Bookings tab → DataTable (no click-to-expand; "View Details" button opens panel)
 * - Fleet tab → DataTable listing with "Manage Vehicle" button opening detail panel
 * - Handovers tab → DataTable with "Manage" button
 * - Network tab → DataTable for memberships
 * - Reviews tab → DataTable with "View Review" button
 * - All existing detail panels/modals preserved
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/common/Navbar';
import './VendorDashboard.css';
import Navbar from '../components/common/Navbar';
import DataTable from '../components/common/DataTable';
import '../components/common/DataTable.css';
import {
    getVendorBookings, getVendorProfile, updateVendorProfile, uploadVendorKYC,
    getVendorAnalytics, getMyVehicles, createVehicle,
    toggleVehicleStatus, uploadVehicleDoc, uploadVehiclePhoto,
    blockAvailability, unblockAvailability, getVehicleAvailability,
    getVendorNetwork, joinNetwork, leaveNetwork, getCities, getCityLocations,
    createInspection, signInspection, uploadInspectionPhoto, raiseDamageClaim,
    getMyHandovers, confirmHandoverReceipt, uploadHandoverPhoto,
    completeHandoverInspection, arrangeHandoverRetrieval,
    grantSublistPermission, revokeSublistPermission,
    getVendorBookingDetail,
    cancelBooking,
    dummyPayment,
    fetchVendorReviews,
} from '../services/api';

// ── Constants ──────────────────────────────────────────────────────────────
const STATUS_CLR = {
    PENDING: { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
    ACTIVE: { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' },
    COMPLETED: { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
    CANCELLED: { bg: '#FEE2E2', color: '#EF4444', border: '#FCA5A5' },
};
const VEHICLE_STATUS_CLR = {
    LIVE: { bg: '#D1FAE5', color: '#059669' },
    PENDING_DOCS: { bg: '#FEF3C7', color: '#D97706' },
    DOCS_SUBMITTED: { bg: '#DBEAFE', color: '#1D4ED8' },
    ADMIN_APPROVED: { bg: '#EDE9FE', color: '#7C3AED' },
    CERTIFIED: { bg: '#D1FAE5', color: '#059669' },
    INACTIVE: { bg: '#FEE2E2', color: '#EF4444' },
};
const HANDOVER_STATUS_CLR = {
    EXPECTED: { bg: '#FEF3C7', color: '#D97706' },
    RECEIVED: { bg: '#DBEAFE', color: '#1D4ED8' },
    INSPECTED: { bg: '#EDE9FE', color: '#7C3AED' },
    HELD: { bg: '#F3F4F6', color: '#6B7280' },
    SUBLISTED: { bg: '#D1FAE5', color: '#059669' },
    RETRIEVED: { bg: '#F3F4F6', color: '#9CA3AF' },
};
const SEGMENTS = ['hatchback', 'sedan', 'suv', 'luxury', 'van', 'truck'];
const FUELS = ['petrol', 'diesel', 'electric', 'hybrid', 'cng'];
const ANGLES = ['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'boot', 'other'];
const DOC_TYPES = ['rc', 'insurance', 'puc', 'fitness', 'mechanic_cert'];

// ── Helpers ────────────────────────────────────────────────────────────────
function isKYCComplete(profile) {
    if (!profile) return false;
    return !!(profile.bank_account_no && profile.city_id && profile.latitude && profile.longitude);
}

function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDatetime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ── Reusable small components ──────────────────────────────────────────────
const StatusBadge = ({ status, statusMap }) => {
    const map = statusMap || STATUS_CLR;
    const s = map[status] || { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
    return <span className="vd-badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border || s.color + '40'}` }}>{status?.replace(/_/g, ' ')}</span>;
};

const InfoRow = ({ label, value, highlight }) => (
    <div className="vd-info-pair">
        <span>{label}</span>
        <strong style={highlight ? { color: 'var(--vacc)', fontSize: 15 } : {}}>{value || '—'}</strong>
    </div>
);

const Toast = ({ msg, type, onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
    return (
        <div className={`vd-toast vd-toast--${type}`}>
            {type === 'success'
                ? <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: '#D1FAE5', color: '#059669' }}>✓</span>
                : <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: '#FEE2E2', color: '#EF4444' }}>!</span>}
            {msg}
        </div>
    );
};

const Field = ({ label, children }) => (
    <div className="vd-form-field">
        <label>{label}</label>
        {children}
    </div>
);

const FormInput = ({ label, value, onChange, type = 'text', placeholder, required, min, max }) => (
    <Field label={label}>
        <input className="vd-input" type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} min={min} max={max} />
    </Field>
);

const FormSelect = ({ label, value, onChange, options, required }) => (
    <Field label={label}>
        <select className="vd-input vd-select" value={value} onChange={onChange} required={required}>
            {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </Field>
);

const SectionCard = ({ title, subtitle, children, action }) => (
    <div className="vd-card">
        {(title || action) && (
            <div className="vd-card__head">
                <div>{title && <h3 className="vd-card__title">{title}</h3>}{subtitle && <p className="vd-card__sub">{subtitle}</p>}</div>
                {action}
            </div>
        )}
        {children}
    </div>
);

// ── KYC Gate ───────────────────────────────────────────────────────────────
function KYCGateBanner({ onGoToKYC }) {
    return (
        <div className="vd-kyc-gate">
            <div className="vd-kyc-gate__icon">🔒</div>
            <div className="vd-kyc-gate__body">
                <h3>KYC Required to Proceed</h3>
                <p>Complete your KYC verification to access this section. This includes Aadhaar, PAN, bank details, business address, and pickup location.</p>
                <button className="vd-btn vd-btn--primary" onClick={onGoToKYC}>Complete KYC →</button>
            </div>
        </div>
    );
}

// ── Photo Lightbox ─────────────────────────────────────────────────────────
const PhotoLightbox = ({ photos, initialIndex, onClose }) => {
    const [current, setCurrent] = useState(initialIndex || 0);
    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, photos.length - 1));
            if (e.key === 'ArrowLeft') setCurrent(c => Math.max(c - 1, 0));
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [photos.length, onClose]);
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✕ Close</button>
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 18, cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.3 : 1 }}>‹</button>
                <div style={{ textAlign: 'center' }}>
                    <img src={photos[current].image || photos[current].url || photos[current]} alt={photos[current].angle || 'photo'} style={{ maxWidth: 'min(80vw, 900px)', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12 }} />
                    {photos[current].angle && <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{photos[current].angle} · {current + 1}/{photos.length}</div>}
                </div>
                <button onClick={() => setCurrent(c => Math.min(c + 1, photos.length - 1))} disabled={current === photos.length - 1} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 18, cursor: current === photos.length - 1 ? 'not-allowed' : 'pointer', opacity: current === photos.length - 1 ? 0.3 : 1 }}>›</button>
            </div>
        </div>
    );
};

// ── KYC Document Viewer ────────────────────────────────────────────────────
function KYCDocumentViewer({ profile }) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    if (!profile?.kyc_document) return null;
    const isPDF = profile.kyc_document.toLowerCase().includes('.pdf');
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
                    {lightboxOpen && <PhotoLightbox photos={[{ image: profile.kyc_document, angle: 'KYC Document' }]} initialIndex={0} onClose={() => setLightboxOpen(false)} />}
                </>
            ) : isPDF ? (
                <a href={profile.kyc_document} target="_blank" rel="noopener noreferrer" className="vd-kyc-doc-viewer__pdf-link"><span>📄</span><span>View PDF Document</span></a>
            ) : (
                <a href={profile.kyc_document} target="_blank" rel="noopener noreferrer" className="vd-btn vd-btn--outline vd-btn--sm">View Document</a>
            )}
        </div>
    );
}

// ── Map Picker ─────────────────────────────────────────────────────────────
const MapPicker = ({ lat, lng, onLocationSelect }) => {
    const mapRef = useRef(null);
    const leafletMapRef = useRef(null);
    const markerRef = useRef(null);
    const [mapReady, setMapReady] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (window.L) { setMapReady(true); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.onload = () => setMapReady(true);
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!mapReady || !mapRef.current || leafletMapRef.current) return;
        const L = window.L;
        const map = L.map(mapRef.current).setView([lat || 20.5937, lng || 78.9629], lat ? 15 : 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
        const icon = L.divIcon({ className: '', html: `<div style="width:28px;height:28px;background:#0DB89E;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>`, iconSize: [28, 28], iconAnchor: [14, 28] });
        if (lat && lng) {
            markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
            markerRef.current.on('dragend', e => { const { lat: la, lng: lo } = e.target.getLatLng(); onLocationSelect(la, lo); });
        }
        map.on('click', e => {
            const { lat: la, lng: lo } = e.latlng;
            if (markerRef.current) markerRef.current.setLatLng([la, lo]);
            else {
                markerRef.current = L.marker([la, lo], { icon, draggable: true }).addTo(map);
                markerRef.current.on('dragend', ev => { const { lat: dla, lng: dlo } = ev.target.getLatLng(); onLocationSelect(dla, dlo); });
            }
            onLocationSelect(la, lo);
        });
        leafletMapRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);
    }, [mapReady]);

    useEffect(() => {
        if (!leafletMapRef.current || !window.L || !lat || !lng) return;
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        leafletMapRef.current.setView([lat, lng], 15);
    }, [lat, lng]);

    const handleSearch = async () => {
        if (!searchInput.trim()) return;
        setSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchInput)}&format=json&limit=1`);
            const data = await res.json();
            if (data.length > 0) {
                const la = parseFloat(data[0].lat), lo = parseFloat(data[0].lon);
                leafletMapRef.current.setView([la, lo], 16);
                if (markerRef.current) markerRef.current.setLatLng([la, lo]);
                else {
                    const L = window.L;
                    const icon = L.divIcon({ className: '', html: `<div style="width:28px;height:28px;background:#0DB89E;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>`, iconSize: [28, 28], iconAnchor: [14, 28] });
                    markerRef.current = L.marker([la, lo], { icon, draggable: true }).addTo(leafletMapRef.current);
                    markerRef.current.on('dragend', e => { const { lat: dla, lng: dlo } = e.target.getLatLng(); onLocationSelect(dla, dlo); });
                }
                onLocationSelect(la, lo);
            }
        } catch { }
        setSearching(false);
    };

    return (
        <div className="vd-map-picker">
            <div className="vd-map-picker__toolbar">
                <div className="vd-map-picker__hint">📍 Click the map to pin your exact pickup location.</div>
                <div className="vd-map-picker__search">
                    <input className="vd-input" placeholder="Search address…" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} style={{ flex: 1 }} />
                    <button className="vd-upload-btn" onClick={handleSearch} disabled={searching}>{searching ? '…' : 'Search'}</button>
                </div>
            </div>
            {!mapReady && <div className="vd-map-picker__loading"><div className="vd-spinner" /> Loading map…</div>}
            <div ref={mapRef} className="vd-map-picker__canvas" style={{ display: mapReady ? 'block' : 'none' }} />
            {lat && lng && (
                <div className="vd-map-picker__coords">
                    <span>📌 {parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}</span>
                    <button className="vd-link-btn vd-link-btn--danger" onClick={() => onLocationSelect(null, null)}>✕ Clear</button>
                </div>
            )}
        </div>
    );
};

// ── Inspection Panel (unchanged from original) ─────────────────────────────
function InspectionPanel({ bookingId, inspectionType, existingInspection, canCreate, showToast, onRefresh }) {
    const isPickup = inspectionType === 'PICKUP';
    const label = isPickup ? 'Pickup' : 'Drop-off';
    const [form, setForm] = useState({ odometer_reading: '', fuel_level: 'full', notes: '', damage_reported: false, damage_notes: '', damage_amount: '' });
    const [saving, setSaving] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpBusy, setOtpBusy] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [vendorOtpDisplay, setVendorOtpDisplay] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(null);

    if (existingInspection?.is_locked) {
        const photos = existingInspection.photos || [];
        const infoRows = [
            ['Odometer', `${existingInspection.odometer_reading} km`],
            ['Fuel Level', existingInspection.fuel_level],
            ['Customer Signed', existingInspection.customer_signed ? 'Yes' : 'Pending'],
            ['Vendor Signed', existingInspection.vendor_signed ? 'Yes' : 'Pending'],
            ...(existingInspection.notes ? [['Notes', existingInspection.notes]] : []),
        ];
        return (
            <div style={{ border: '1px solid var(--vbdr)', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && photos.length > 0 && <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', background: isPickup ? '#EFF6FF' : '#F0FDF4', borderBottom: expanded ? '1px solid var(--vbdr)' : 'none' }} onClick={() => setExpanded(v => !v)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isPickup ? '#DBEAFE' : '#D1FAE5', color: isPickup ? '#1D4ED8' : '#059669' }}>{isPickup ? 'P' : 'D'}</span>
                        <strong style={{ fontSize: 13 }}>{label} Inspection</strong>
                        <span style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Locked</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--vm)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {infoRows.map(([l, v]) => <div key={l} className="vd-info-pair" style={{ fontSize: 13 }}><span>{l}</span><strong>{v}</strong></div>)}
                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                {photos.map((ph, idx) => <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}><img src={ph.image} alt="insp" style={{ width: 70, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--vbdr)', display: 'block' }} /></div>)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (isPickup && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];
        const handleGenerateOtp = async () => {
            setOtpBusy(true);
            try {
                const { data } = await signInspection(bookingId, 'pickup', 'generate', null);
                setVendorOtpDisplay(data.otp_code); setOtpSent(true);
                showToast('OTP generated! Share with the customer.', 'success');
            } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
            setOtpBusy(false);
        };
        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && photos.length > 0 && <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: '#DBEAFE', color: '#1D4ED8' }}>P</span>
                        <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Customer Awaiting OTP</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--vm)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#F8FAFB', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                            </div>
                        </div>
                        {photos.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{photos.map((ph, idx) => <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}><img src={ph.image} alt="insp" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--vbdr)', display: 'block' }} /></div>)}</div>}
                        {!otpSent ? (
                            <button className="vd-btn vd-btn--primary" onClick={handleGenerateOtp} disabled={otpBusy}>{otpBusy ? 'Generating…' : 'Generate OTP for Customer'}</button>
                        ) : (
                            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                                <p style={{ fontSize: 12, color: '#059669', marginBottom: 10, fontWeight: 600 }}>Share this OTP with the customer:</p>
                                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 10, fontFamily: 'monospace', color: '#059669' }}>{vendorOtpDisplay}</div>
                                <button className="vd-btn vd-btn--ghost vd-btn--sm" style={{ marginTop: 10 }} onClick={handleGenerateOtp} disabled={otpBusy}>Generate New OTP</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (!isPickup && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];
        const handleVerifyOtp = async () => {
            if (otpCode.length !== 6) { showToast('Enter 6-digit OTP.', 'error'); return; }
            setOtpBusy(true);
            try {
                const { data } = await signInspection(bookingId, 'return', 'verify', otpCode);
                showToast(data.message || 'Drop-off signed!'); setOtpCode(''); onRefresh();
            } catch (e) { showToast(e.response?.data?.error || 'Invalid OTP.', 'error'); }
            setOtpBusy(false);
        };
        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && photos.length > 0 && <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: '#D1FAE5', color: '#059669' }}>D</span>
                        <strong style={{ fontSize: 13 }}>Drop-off Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Awaiting Customer OTP</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--vm)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#F8FAFB', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                                {existingInspection.damage_reported && <span style={{ color: '#EF4444' }}>Damage: <strong>{existingInspection.damage_notes} (₹{existingInspection.damage_amount})</strong></span>}
                            </div>
                        </div>
                        {photos.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{photos.map((ph, idx) => <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}><img src={ph.image} alt="insp" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--vbdr)', display: 'block' }} /></div>)}</div>}
                        <div>
                            <p style={{ fontSize: 12, color: 'var(--vm)', marginBottom: 8, fontWeight: 600 }}>Enter 6-digit OTP from customer:</p>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input className="vd-input" style={{ width: 140, textAlign: 'center', letterSpacing: '6px', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }} maxLength={6} placeholder="——————" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                                <button className="vd-btn vd-btn--primary" onClick={handleVerifyOtp} disabled={otpBusy || otpCode.length !== 6}>{otpBusy ? 'Verifying…' : 'Verify & Complete Drop-off'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (!canCreate) {
        return (
            <div style={{ border: '1px dashed var(--vbdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--vm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isPickup ? '#DBEAFE' : '#D1FAE5', color: isPickup ? '#1D4ED8' : '#059669' }}>{isPickup ? 'P' : 'D'}</span>
                <span>{isPickup ? 'Pickup inspection is created by customer.' : 'Drop-off inspection available when booking is ACTIVE.'}</span>
            </div>
        );
    }

    if (isPickup) return (
        <div style={{ border: '1px dashed var(--vbdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--vm)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: '#DBEAFE', color: '#1D4ED8' }}>P</span>
            <span>Pickup inspection is created by customer.</span>
        </div>
    );

    const handleSave = async () => {
        if (!form.odometer_reading) { showToast('Odometer reading is required.', 'error'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('odometer_reading', form.odometer_reading); fd.append('fuel_level', form.fuel_level);
            fd.append('notes', form.notes); fd.append('checklist', JSON.stringify({ exterior: true, interior: true, tyres: true, documents: true }));
            fd.append('damage_reported', form.damage_reported ? true : false); fd.append('damage_notes', form.damage_notes);
            if (form.damage_reported && form.damage_amount) fd.append('damage_amount', form.damage_amount);
            await createInspection(bookingId, 'return', fd);
            showToast('Drop-off inspection saved!'); onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        setSaving(false);
    };

    return (
        <div style={{ border: '1px solid var(--vacc)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--vacc-l)', cursor: 'pointer', borderBottom: expanded ? '1px solid var(--vacc)' : 'none' }} onClick={() => setExpanded(v => !v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: '#D1FAE5', color: '#059669' }}>D</span>
                    <strong style={{ fontSize: 13 }}>Drop-off Inspection</strong>
                    <span style={{ background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #93C5FD', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Ready to Fill</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--vm)' }}>{expanded ? 'Hide' : 'Fill Form'}</span>
            </div>
            {expanded && (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="vd-fg vd-fg--2">
                        <FormInput label="Odometer (km) *" type="number" value={form.odometer_reading} onChange={e => setForm(p => ({ ...p, odometer_reading: e.target.value }))} placeholder="e.g. 45230" />
                        <FormSelect label="Fuel Level" value={form.fuel_level} onChange={e => setForm(p => ({ ...p, fuel_level: e.target.value }))} options={['empty', 'quarter', 'half', 'three_quarter', 'full']} />
                    </div>
                    <Field label="Notes (optional)"><textarea className="vd-input vd-textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any observations…" /></Field>
                    <div style={{ background: '#FFF7F7', border: '1px solid #FECACA', borderRadius: 8, padding: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                            <input type="checkbox" checked={form.damage_reported} onChange={e => setForm(p => ({ ...p, damage_reported: e.target.checked }))} />
                            <span style={{ color: form.damage_reported ? '#EF4444' : 'inherit' }}>Damage Reported</span>
                        </label>
                        {form.damage_reported && (
                            <div className="vd-fg vd-fg--2" style={{ marginTop: 10 }}>
                                <Field label="Damage Notes"><textarea className="vd-input vd-textarea" value={form.damage_notes} onChange={e => setForm(p => ({ ...p, damage_notes: e.target.value }))} /></Field>
                                <FormInput label="Damage Amount (₹)" type="number" value={form.damage_amount} onChange={e => setForm(p => ({ ...p, damage_amount: e.target.value }))} />
                            </div>
                        )}
                    </div>
                    <button className="vd-btn vd-btn--primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Submit Drop-off Inspection'}</button>
                </div>
            )}
        </div>
    );
}

// ── Booking Detail Panel ───────────────────────────────────────────────────
function BookingDetailPanel({ booking, onClose, onRefresh, showToast }) {
    const pricing = booking.pricing_snapshot || {};
    const grandTotal = parseFloat(pricing.grand_total || booking.total_amount || 0);
    const advancePct = 30;
    const advanceAmt = Math.round(grandTotal * advancePct / 100);
    const remaining = grandTotal - advanceAmt;
    const advancePaid = pricing.advance_paid || booking.payment_captured || false;
    const remainingPaid = pricing.remaining_paid || false;
    const fullPaid = pricing.full_payment_paid || (advancePaid && remainingPaid);
    const deposit = parseFloat(pricing.security_deposit || booking.deposit_amount || 0);
    const customer = booking.customer || {};
    const customerName = customer.full_name || booking.customer_name || '—';
    const customerEmail = customer.email || booking.customer_email || '—';
    const customerPhone = customer.phone || booking.customer_phone || '—';
    const pickupInsp = (booking.inspections || []).find(i => i.inspection_type === 'PICKUP');
    const returnInsp = (booking.inspections || []).find(i => i.inspection_type === 'RETURN');
    const canCreateReturnInsp = ['ACTIVE'].includes(booking.status);
    const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status);
    const canPayRemaining = advancePaid && !remainingPaid && !fullPaid && ['CONFIRMED', 'ACTIVE'].includes(booking.status);
    const [showPayForm, setShowPayForm] = useState(false);
    const [payMethod, setPayMethod] = useState('cash');
    const [payLoading, setPayLoading] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);
    const [damageForm, setDamageForm] = useState({ notes: '', amount: '' });
    const [damageLoading, setDamageLoading] = useState(false);

    const handleRecordPayment = async () => {
        setPayLoading(true);
        try {
            const { data } = await dummyPayment(booking.id, { payment_type: 'remaining', method: payMethod });
            showToast(data.message || 'Payment recorded.'); setShowPayForm(false); onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Could not record payment.', 'error'); }
        setPayLoading(false);
    };
    const handleCancel = async () => {
        setCancelLoading(true);
        try { await cancelBooking(booking.id, cancelReason || 'Vendor cancelled'); showToast('Booking cancelled.'); setCancelConfirm(false); onRefresh(); }
        catch (e) { showToast(e.response?.data?.error || 'Could not cancel.', 'error'); }
        setCancelLoading(false);
    };
    const handleDamageClaim = async () => {
        if (!damageForm.amount) { showToast('Enter claim amount.', 'error'); return; }
        setDamageLoading(true);
        try { await raiseDamageClaim(booking.id, damageForm); showToast('Damage claim raised.'); setDamageForm({ notes: '', amount: '' }); }
        catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        setDamageLoading(false);
    };

    return (
        <div className="vd-detail-panel">
            <div className="vd-detail-panel__head">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--vt2)', flexShrink: 0 }}>CAR</div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{booking.vehicle_display || 'Vehicle'}</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                            <StatusBadge status={booking.status} />
                            {booking.payment_captured && <span className="vd-flag vd-flag--ok">Payment Captured</span>}
                            {booking.agreement_signed && <span className="vd-flag vd-flag--ok">Agreement Signed</span>}
                            {booking.deposit_held && <span className="vd-flag vd-flag--warn">Deposit Held</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>₹{parseFloat(booking.total_amount || 0).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 11, color: 'var(--vm)' }}>{booking.booking_ref}</div>
                    </div>
                </div>
                <button className="vd-close-btn" onClick={onClose}>← Back to List</button>
            </div>
            <div className="vd-detail-panel__grid">
                <div className="vd-info-group"><div className="vd-info-group__title">Customer</div>
                    <InfoRow label="Name" value={customerName} />
                    <InfoRow label="Email" value={customerEmail} />
                    <InfoRow label="Phone" value={customerPhone} />
                </div>
                <div className="vd-info-group"><div className="vd-info-group__title">Trip Details</div>
                    <InfoRow label="Pickup" value={`${booking.pickup_date}${booking.pickup_time ? ' @ ' + booking.pickup_time : ''}`} />
                    <InfoRow label="Return" value={`${booking.return_date}${booking.return_time ? ' @ ' + booking.return_time : ''}`} />
                    <InfoRow label="Duration" value={`${booking.rental_days} day(s)`} />
                </div>
                <div className="vd-info-group"><div className="vd-info-group__title">Payment Status</div>
                    <InfoRow label="Grand Total" value={`₹${grandTotal.toLocaleString('en-IN')}`} highlight />
                    <InfoRow label={`Advance (${advancePct}%)`} value={advancePaid ? `Paid — ₹${advanceAmt.toLocaleString('en-IN')}` : `Due — ₹${advanceAmt.toLocaleString('en-IN')}`} />
                    <InfoRow label="Remaining (70%)" value={(fullPaid || remainingPaid) ? `Paid — ₹${remaining.toLocaleString('en-IN')}` : `Due — ₹${remaining.toLocaleString('en-IN')}`} />
                    <InfoRow label="Security Deposit" value={`₹${deposit.toLocaleString('en-IN')} (${booking.deposit_released ? 'Released' : booking.deposit_held ? 'Held' : 'Pending'})`} />
                    {canPayRemaining && !showPayForm && <button className="vd-btn vd-btn--outline vd-btn--sm" style={{ marginTop: 8 }} onClick={() => setShowPayForm(true)}>Record Remaining Payment</button>}
                    {showPayForm && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #6EE7B7', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                            <strong style={{ fontSize: 13 }}>Record ₹{remaining.toLocaleString('en-IN')} received</strong>
                            <Field label="Payment Method">
                                <select className="vd-input vd-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="online">Online</option>
                                </select>
                            </Field>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="vd-btn vd-btn--success vd-btn--sm" onClick={handleRecordPayment} disabled={payLoading}>{payLoading ? 'Recording…' : 'Confirm Received'}</button>
                                <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => setShowPayForm(false)}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="vd-info-group"><div className="vd-info-group__title">Pricing Breakdown</div>
                    <InfoRow label="Daily Rate" value={`₹${parseFloat(pricing.daily_rate || 0).toLocaleString('en-IN')}/day`} />
                    <InfoRow label="Base Rental" value={`₹${parseFloat(pricing.base_amount || 0).toLocaleString('en-IN')}`} />
                    <InfoRow label="GST (18%)" value={`₹${parseFloat(pricing.gst_amount || 0).toLocaleString('en-IN')}`} />
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vm)' }}>Inspections</div>
                <div className="vd-inspection-grid">
                    <InspectionPanel key={`pickup-${pickupInsp?.id}-${pickupInsp?.is_locked}`} bookingId={booking.id} inspectionType="PICKUP" existingInspection={pickupInsp} canCreate={false} showToast={showToast} onRefresh={onRefresh} />
                    <InspectionPanel key={`return-${returnInsp?.id}-${returnInsp?.is_locked}`} bookingId={booking.id} inspectionType="RETURN" existingInspection={returnInsp} canCreate={canCreateReturnInsp} showToast={showToast} onRefresh={onRefresh} />
                </div>
            </div>
            <div className="vd-booking-actions">
                {booking.status === 'COMPLETED' && (
                    <div className="vd-action-block">
                        <p className="vd-action-label">Raise Damage Claim</p>
                        <div className="vd-fg vd-fg--2">
                            <Field label="Notes"><textarea className="vd-input vd-textarea" value={damageForm.notes} onChange={e => setDamageForm(p => ({ ...p, notes: e.target.value }))} /></Field>
                            <FormInput label="Amount (₹)" type="number" value={damageForm.amount} onChange={e => setDamageForm(p => ({ ...p, amount: e.target.value }))} />
                        </div>
                        <button className="vd-btn vd-btn--danger vd-btn--sm" onClick={handleDamageClaim} disabled={damageLoading}>{damageLoading ? '…' : 'Raise Claim'}</button>
                    </div>
                )}
                {canCancel && !cancelConfirm && <button className="vd-btn vd-btn--danger-outline vd-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setCancelConfirm(true)}>Cancel Booking</button>}
                {cancelConfirm && (
                    <div className="vd-cancel-confirm" style={{ marginLeft: 'auto' }}>
                        <input className="vd-input" placeholder="Reason (optional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} style={{ width: 200 }} />
                        <button className="vd-btn vd-btn--danger vd-btn--sm" onClick={handleCancel} disabled={cancelLoading}>{cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}</button>
                        <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => setCancelConfirm(false)}>Keep It</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Vehicle Management Panel (modal) ───────────────────────────────────────
function VehicleManageModal({ vehicle: v, onClose, showToast, onRefresh, docUploads, setDocUploads, photoUpload, setPhotoUpload, availData, blockInput, onBlockInputChange, onLoadAvail, onBlock, onUnblock, onStatusToggle }) {
    const [subTab, setSubTab] = useState('docs');
    const canToggle = ['LIVE', 'INACTIVE', 'CERTIFIED'].includes(v.status);
    const photoCount = (v.photos || []).length;
    const [lightboxIdx, setLightboxIdx] = useState(null);

    const PIPELINE = ['PENDING_DOCS', 'DOCS_SUBMITTED', 'ADMIN_APPROVED', 'CERTIFIED', 'LIVE'];
    const currentPipelineIdx = PIPELINE.indexOf(v.status);

    const handleDocUpload = async (docType) => {
        const file = docUploads[`${v.id}-${docType}`];
        if (!file) { showToast('Select a file.', 'error'); return; }
        const fd = new FormData(); fd.append('doc_type', docType); fd.append('file', file);
        try {
            await uploadVehicleDoc(v.id, fd);
            showToast(`${docType.toUpperCase()} uploaded!`);
            onRefresh();
        } catch (e) { showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Upload failed.', 'error'); }
    };

    const handlePhotoUpload = async () => {
        if (!photoUpload.file) { showToast('Select a photo.', 'error'); return; }
        const fd = new FormData();
        fd.append('image', photoUpload.file); fd.append('angle', photoUpload.angle); fd.append('is_cover', photoUpload.is_cover ? 'true' : 'false');
        try { await uploadVehiclePhoto(v.id, fd); showToast('Photo uploaded!'); onRefresh(); }
        catch { showToast('Photo upload failed.', 'error'); }
    };

    const vc = VEHICLE_STATUS_CLR[v.status] || { bg: '#F3F4F6', color: '#6B7280' };

    return (
        <div className="vd-modal-overlay" onClick={onClose}>
            <div className="vd-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="vd-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{v.year} {v.make} {v.model}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--teal-dark)', background: 'var(--teal-light)', padding: '2px 8px', borderRadius: 4 }}>{v.plate_number}</span>
                            <span className="vd-badge" style={{ background: vc.bg, color: vc.color }}>{v.status?.replace(/_/g, ' ')}</span>
                            {v.is_certified && <span className="vd-badge" style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>✅ Certified</span>}
                            <span style={{ fontSize: 12, color: 'var(--vm)' }}>₹{parseInt(v.daily_rate || 0).toLocaleString('en-IN')}/day · {v.segment}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        {canToggle && (
                            <button className={`vd-toggle-btn ${v.status === 'LIVE' ? 'vd-toggle-btn--off' : 'vd-toggle-btn--on'}`} onClick={() => { onStatusToggle(); onClose(); }}>
                                {v.status === 'LIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                        )}
                        <button onClick={onClose} className="vd-close-btn">✕ Close</button>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--vbdr)', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
                    {PIPELINE.map((s, i) => {
                        const done = i < currentPipelineIdx;
                        const active = i === currentPipelineIdx;
                        return (
                            <React.Fragment key={s}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '2px solid', background: done ? 'var(--teal-primary)' : active ? '#fff' : 'var(--vs2)', borderColor: done || active ? 'var(--teal-primary)' : 'var(--vbdr2)', color: done ? '#fff' : active ? 'var(--teal-primary)' : 'var(--vm)', boxShadow: active ? '0 0 0 3px var(--teal-light)' : 'none' }}>{done ? '✓' : i + 1}</div>
                                    <span style={{ fontSize: 8, fontWeight: active ? 800 : 600, color: active ? 'var(--teal-dark)' : 'var(--vm)', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>{s.replace(/_/g, ' ')}</span>
                                </div>
                                {i < PIPELINE.length - 1 && <div style={{ flex: 1, height: 2, background: done ? 'var(--teal-primary)' : 'var(--vbdr2)', margin: '0 4px', marginBottom: 18, minWidth: 16 }} />}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Sub-tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--vbdr)', background: 'var(--vs)' }}>
                    {[['docs', '📄 Documents'], ['photos', '📷 Photos'], ['availability', '📅 Availability']].map(([id, label]) => (
                        <button key={id} className={`vd-btn vd-btn--sm ${subTab === id ? 'vd-btn--primary' : 'vd-btn--ghost'}`} onClick={() => setSubTab(id)}>{label}</button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ padding: '18px 20px', overflowY: 'auto', maxHeight: '52vh' }}>
                    {/* Docs */}
                    {subTab === 'docs' && (
                        <div>
                            <p className="vd-hint">Required: RC, Insurance, PUC — all must be admin-approved before LIVE.</p>
                            <div className="vd-doc-grid">
                                {DOC_TYPES.map(dt => {
                                    const existing = (v.documents || []).find(d => d.doc_type === dt);
                                    const key = `${v.id}-${dt}`;
                                    const dc = existing?.status === 'approved' ? { bg: '#D1FAE5', color: '#059669' } : existing?.status === 'rejected' ? { bg: '#FEE2E2', color: '#EF4444' } : { bg: '#FEF3C7', color: '#D97706' };
                                    return (
                                        <div key={dt} className="vd-doc-card">
                                            <div className="vd-doc-card__head">
                                                <span className="vd-doc-card__type">{dt.replace(/_/g, ' ').toUpperCase()}</span>
                                                {existing && <span className="vd-badge" style={{ background: dc.bg, color: dc.color, fontSize: 9 }}>{existing.status}</span>}
                                            </div>
                                            {existing?.file && <a href={existing.file} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--vacc)', marginBottom: 4, display: 'inline-block' }}>View</a>}
                                            <input type="file" accept=".pdf,.jpg,.png" className="vd-file-input" onChange={e => setDocUploads(p => ({ ...p, [key]: e.target.files[0] }))} />
                                            <button className="vd-upload-btn" onClick={() => handleDocUpload(dt)}>{existing ? 'Re-upload' : 'Upload'}</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Photos */}
                    {subTab === 'photos' && (
                        <div>
                            {lightboxIdx !== null && (v.photos || []).length > 0 && <PhotoLightbox photos={v.photos} initialIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />}
                            <div className="vd-photo-status">
                                <span className={`vd-photo-count ${photoCount >= 10 ? 'ok' : 'warn'}`}>{photoCount}/10 {photoCount >= 10 ? '✓ Complete' : '(min 10 required)'}</span>
                            </div>
                            <div className="vd-photo-upload-bar">
                                <div style={{ minWidth: 120 }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vm)', display: 'block', marginBottom: 4 }}>Angle</label>
                                    <select className="vd-input vd-select" value={photoUpload.angle} onChange={e => setPhotoUpload(p => ({ ...p, angle: e.target.value }))}>
                                        {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <label className="vd-cover-check"><input type="checkbox" checked={photoUpload.is_cover} onChange={e => setPhotoUpload(p => ({ ...p, is_cover: e.target.checked }))} />Cover photo</label>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vm)', display: 'block', marginBottom: 4 }}>Photo</label>
                                    <input type="file" accept="image/*" className="vd-file-input" onChange={e => setPhotoUpload(p => ({ ...p, file: e.target.files[0] }))} />
                                </div>
                                <button className="vd-upload-btn" onClick={handlePhotoUpload}>Upload</button>
                            </div>
                            {(v.photos || []).length > 0 && (
                                <div className="vd-photos-grid">
                                    {v.photos.map((ph, idx) => (
                                        <div key={ph.id} className="vd-photo-item" onClick={() => setLightboxIdx(idx)} style={{ cursor: 'pointer' }}>
                                            <img src={ph.image} alt={ph.angle} />
                                            <div className="vd-photo-item__meta">{ph.angle}{ph.is_cover && <span className="vd-cover-tag">Cover</span>}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Availability */}
                    {subTab === 'availability' && (
                        <div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                <button className="vd-ghost-btn" onClick={() => onLoadAvail(v.id)}>Load This Month</button>
                            </div>
                            {availData && (
                                <>
                                    {(availData.blocked_dates || []).length === 0 ? <p className="vd-hint">No dates blocked.</p> : (
                                        <div className="vd-blocked-dates">
                                            {availData.blocked_dates.map(d => <div key={d} className="vd-blocked-chip">{d}<button onClick={() => onUnblock(v.id, d)}>✕</button></div>)}
                                        </div>
                                    )}
                                    <div className="vd-block-row">
                                        <input className="vd-input" placeholder="2025-09-10, 2025-09-11" value={blockInput} onChange={e => onBlockInputChange(e.target.value)} />
                                        <button className="vd-upload-btn" onClick={() => onBlock(v.id)}>Block Dates</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Handover Detail Modal ──────────────────────────────────────────────────
function HandoverDetailModal({ handover: h, onClose, showToast, onRefresh, handoverNotes, setHandoverNotes, handoverPhotoFile, setHandoverPhotoFile }) {
    const handleAction = async (action) => {
        try {
            const notes = handoverNotes[h.id] || '';
            if (action === 'confirm') await confirmHandoverReceipt(h.id, notes);
            else if (action === 'inspection_complete') await completeHandoverInspection(h.id);
            else if (action === 'retrieval') await arrangeHandoverRetrieval(h.id);
            else if (action === 'grant_sublist') await grantSublistPermission(h.id);
            else if (action === 'revoke_sublist') await revokeSublistPermission(h.id);
            showToast('Action completed!'); onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Action failed.', 'error'); }
    };
    const handlePhotoUpload = async () => {
        const file = handoverPhotoFile[h.id];
        if (!file) { showToast('Select a photo.', 'error'); return; }
        const fd = new FormData(); fd.append('image', file);
        try { await uploadHandoverPhoto(h.id, fd); showToast('Photo uploaded!'); }
        catch { showToast('Upload failed.', 'error'); }
    };
    const s = HANDOVER_STATUS_CLR[h.status] || { bg: '#F3F4F6', color: '#6B7280' };
    return (
        <div className="vd-modal-overlay" onClick={onClose}>
            <div className="vd-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                <div className="vd-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{h.vehicle_display || `Handover #${h.id}`}</h2>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                            <span className="vd-badge" style={{ background: s.bg, color: s.color }}>{h.status}</span>
                            <span style={{ fontSize: 12, color: 'var(--vm)' }}>{h.booking_ref}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="vd-close-btn">✕ Close</button>
                </div>
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '65vh' }}>
                    <div className="vd-info-group">
                        <div className="vd-info-group__title">Handover Info</div>
                        {[['Originating Vendor', h.originating_vendor_name], ['Return Point', h.return_point_name || '—'], ['Days Held', `${h.days_held || 0}d`], ['Photos Uploaded', h.handover_photos_uploaded ? 'Yes' : 'No'], ['Full Inspection', h.full_inspection_done ? 'Done' : 'Pending']].map(([l, v]) => <InfoRow key={l} label={l} value={v} />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {h.status === 'EXPECTED' && (
                            <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Field label="Notes"><input className="vd-input" value={handoverNotes[h.id] || ''} onChange={e => setHandoverNotes(p => ({ ...p, [h.id]: e.target.value }))} /></Field>
                                <button className="vd-btn vd-btn--primary" onClick={() => handleAction('confirm')}>Confirm Receipt</button>
                            </div>
                        )}
                        {['RECEIVED', 'HELD', 'SUBLISTED'].includes(h.status) && (
                            <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input type="file" accept="image/*" className="vd-file-input" onChange={e => setHandoverPhotoFile(p => ({ ...p, [h.id]: e.target.files[0] }))} />
                                    <button className="vd-btn vd-btn--outline vd-btn--sm" onClick={handlePhotoUpload}>Upload Photo</button>
                                </div>
                                {h.status === 'RECEIVED' && <button className="vd-btn vd-btn--primary" onClick={() => handleAction('inspection_complete')}>Complete Inspection</button>}
                                {h.status === 'HELD' && <button className="vd-btn vd-btn--success" onClick={() => handleAction('grant_sublist')}>Grant Sub-listing</button>}
                                {h.status === 'SUBLISTED' && <button className="vd-btn vd-btn--danger" onClick={() => handleAction('revoke_sublist')}>Revoke Sub-listing</button>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Review Detail Modal ────────────────────────────────────────────────────
function ReviewDetailModal({ review: r, onClose }) {
    const stars = (val, size = 18) => (
        <span style={{ display: 'inline-flex', gap: 1 }}>
            {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: size, color: n <= (val || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>)}
        </span>
    );
    const ratingColor = (r.vendor_rating || 0) >= 4 ? '#059669' : (r.vendor_rating || 0) === 3 ? '#D97706' : '#EF4444';
    const ratingBg = (r.vendor_rating || 0) >= 4 ? '#D1FAE5' : (r.vendor_rating || 0) === 3 ? '#FEF3C7' : '#FEE2E2';
    return (
        <div className="vd-modal-overlay" onClick={onClose}>
            <div className="vd-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="vd-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Review from {r.customer_name || 'Customer'}</h2>
                        <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: 'var(--vm)' }}>{r.vehicle_display || '—'}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 999, background: ratingBg, color: ratingColor }}>★ {r.vendor_rating || 0}/5</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="vd-close-btn">✕ Close</button>
                </div>
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vm)', marginBottom: 6 }}>Vendor Rating</div>
                            {stars(r.vendor_rating)}
                        </div>
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vm)', marginBottom: 6 }}>Vehicle Rating</div>
                            {stars(r.vehicle_rating)}
                        </div>
                    </div>
                    {[['Customer', r.customer_name || '—'], ['Vehicle', r.vehicle_display || '—'], ['Date', fmtDate(r.created_at)]].map(([l, v]) => (
                        <div key={l} className="vd-info-pair"><span>{l}</span><strong>{v}</strong></div>
                    ))}
                    {r.review_text && (
                        <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontStyle: 'italic', color: 'var(--vt2)', lineHeight: 1.65 }}>
                            "{r.review_text}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function VendorDashboard() {
    const { user } = useAuth();
    const [tab, setTab] = useState('overview');
    const [bookings, setBookings] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [profile, setProfile] = useState(null);
    const [network, setNetwork] = useState([]);
    const [handovers, setHandovers] = useState([]);
    const [cities, setCities] = useState([]);
    const [cityLocations, setCityLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);

    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', year: new Date().getFullYear(), colour: '', plate_number: '', segment: 'sedan', fuel_type: 'petrol', transmission: 'manual', capacity: 5, daily_rate: '', city: '', pickup_location: '', odometer_at_listing: 0 });
    const [docUploads, setDocUploads] = useState({});
    const [photoUpload, setPhotoUpload] = useState({ file: null, angle: 'front', is_cover: false });
    const [availData, setAvailData] = useState({});
    const [blockInput, setBlockInput] = useState({});
    const [bookingStatusFilter, setBookingStatusFilter] = useState('');
    const [profileEdit, setProfileEdit] = useState(false);
    const [profileForm, setProfileForm] = useState({});
    const [kycForm, setKycForm] = useState({ aadhaar_number: '', pan_number: '', bank_account_name: '', bank_account_no: '', bank_ifsc: '', shop_opening_time: '', shop_closing_time: '', addr_line1: '', addr_line2: '', addr_line3: '', city: '', country: 'India', pincode: '', latitude: '', longitude: '' });
    const [kycFile, setKycFile] = useState(null);
    const [kycStateDisplay, setKycStateDisplay] = useState('');
    const [showMap, setShowMap] = useState(false);
    const [networkForm, setNetworkForm] = useState({ city: '', max_vehicles: 3, handling_fee_override: '' });

    // Detail modals — only open via "View Details" / "Manage" button
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [bookingDetail, setBookingDetail] = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedHandover, setSelectedHandover] = useState(null);
    const [selectedReview, setSelectedReview] = useState(null);
    const [handoverNotes, setHandoverNotes] = useState({});
    const [handoverPhotoFile, setHandoverPhotoFile] = useState({});

    // Reviews
    const [vendorReviews, setVendorReviews] = useState([]);
    const [reviewOrdering, setReviewOrdering] = useState('recency');
    const [reviewsLoading, setReviewsLoading] = useState(false);

    const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);
    const goToKYC = useCallback(() => setTab('profile'), []);
    const kycComplete = isKYCComplete(profile);

    const loadCityLocations = useCallback(async (cityId) => {
        if (!cityId) { setCityLocations([]); return; }
        try { const { data } = await getCityLocations(cityId); setCityLocations(data.results || data); }
        catch { setCityLocations([]); }
    }, []);

    useEffect(() => { if (vehicleForm.city) loadCityLocations(vehicleForm.city); }, [vehicleForm.city]);
    useEffect(() => {
        if (!kycForm.city) { setKycStateDisplay(''); return; }
        const found = cities.find(c => String(c.id) === String(kycForm.city));
        setKycStateDisplay(found ? found.state : '');
    }, [kycForm.city, cities]);

    const loadTab = useCallback(async (t) => {
        setLoading(true); setError('');
        try {
            const cityRes = await getCities();
            setCities(cityRes.data.results || cityRes.data);
            if (t === 'overview' || t === 'bookings') {
                const [b, a] = await Promise.all([getVendorBookings(bookingStatusFilter || undefined), getVendorAnalytics()]);
                setBookings(b.data.results || b.data); setAnalytics(a.data);
            }
            if (t === 'fleet') { const { data } = await getMyVehicles(); setVehicles(data.results || data); }
            if (t === 'profile') {
                const { data } = await getVendorProfile(); setProfile(data);
                setProfileForm({ shop_opening_time: data.shop_opening_time || '', shop_closing_time: data.shop_closing_time || '' });
                setKycForm({ aadhaar_number: data.aadhaar_number || '', pan_number: data.pan_number || '', bank_account_name: data.bank_account_name || '', bank_account_no: data.bank_account_no || '', bank_ifsc: data.bank_ifsc || '', shop_opening_time: data.shop_opening_time || '', shop_closing_time: data.shop_closing_time || '', addr_line1: data.addr_line1 || '', addr_line2: data.addr_line2 || '', addr_line3: data.addr_line3 || '', city: data.city_id ? String(data.city_id) : '', country: data.country || 'India', pincode: data.pincode || '', latitude: data.latitude ? parseFloat(Number(data.latitude).toFixed(7)) : '', longitude: data.longitude ? parseFloat(Number(data.longitude).toFixed(7)) : '' });
                if (data.state) setKycStateDisplay(data.state);
            }
            if (t === 'network') { const { data } = await getVendorNetwork(); setNetwork(data.results || data); }
            if (t === 'handovers') { const { data } = await getMyHandovers(); setHandovers(data.results || data); }
            if (t === 'reviews') {
                setReviewsLoading(true);
                try { const { data } = await fetchVendorReviews(user.id, reviewOrdering); setVendorReviews(data.results || data); }
                catch { setVendorReviews([]); } finally { setReviewsLoading(false); }
            }
        } catch (e) { setError(`Could not load ${t}. ${e.response?.data?.detail || e.message || ''}`); }
        setLoading(false);
    }, [bookingStatusFilter]);

    useEffect(() => { loadTab(tab); }, [tab]);
    useEffect(() => { getVendorProfile().then(({ data }) => setProfile(data)).catch(() => { }); }, []);
    useEffect(() => {
        if (tab === 'bookings' || tab === 'overview')
            getVendorBookings(bookingStatusFilter || undefined).then(({ data }) => setBookings(data.results || data)).catch(() => { });
    }, [bookingStatusFilter]);

    const openBookingDetail = async (booking) => {
        setSelectedBooking(booking);
        try { const { data } = await getVendorBookingDetail(booking.id); setBookingDetail(data); }
        catch { setBookingDetail(booking); }
    };

    const refreshBookingDetail = useCallback(async () => {
        if (!selectedBooking) return;
        try {
            const [detail, list] = await Promise.all([getVendorBookingDetail(selectedBooking.id), getVendorBookings(bookingStatusFilter || undefined)]);
            setBookingDetail(detail.data); setBookings(list.data.results || list.data);
        } catch { showToast('Could not refresh.', 'error'); }
    }, [selectedBooking, bookingStatusFilter, showToast]);

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            Object.entries(vehicleForm).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
            const { data } = await createVehicle(fd);
            setVehicles(p => [data, ...p]); setShowAddVehicle(false);
            showToast('Vehicle registered! Upload RC, Insurance, PUC and 10+ photos to go LIVE.');
        } catch (e) { showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.', 'error'); }
    };

    const handleToggleVehicle = async (vehicleId) => {
        try {
            const { data } = await toggleVehicleStatus(vehicleId);
            setVehicles(p => p.map(v => v.id === vehicleId ? { ...v, status: data.status } : v));
            showToast(`Vehicle ${data.status}.`);
        } catch (e) { showToast(e.response?.data?.error || 'Toggle failed.', 'error'); }
    };

    const loadAvailability = async (vehicleId) => {
        try { const { data } = await getVehicleAvailability(vehicleId, new Date().toISOString().slice(0, 7)); setAvailData(p => ({ ...p, [vehicleId]: data })); }
        catch { showToast('Could not load availability.', 'error'); }
    };

    const handleBlock = async (vehicleId) => {
        const dates = (blockInput[vehicleId] || '').split(',').map(d => d.trim()).filter(Boolean);
        if (!dates.length) { showToast('Enter comma-separated dates.', 'error'); return; }
        try { await blockAvailability(vehicleId, dates); await loadAvailability(vehicleId); setBlockInput(p => ({ ...p, [vehicleId]: '' })); showToast(`${dates.length} date(s) blocked.`); }
        catch { showToast('Failed.', 'error'); }
    };

    const handleUnblock = async (vehicleId, date) => {
        try { await unblockAvailability(vehicleId, [date]); await loadAvailability(vehicleId); showToast('Date unblocked.'); }
        catch { showToast('Could not unblock.', 'error'); }
    };

    const handleProfileSave = async () => {
        try { await updateVendorProfile(profileForm); showToast('Profile updated.'); setProfileEdit(false); await loadTab('profile'); }
        catch { showToast('Update failed.', 'error'); }
    };

    const handleKYCSubmit = async (e) => {
        e.preventDefault();
        if (!kycForm.city) { showToast('Select a city.', 'error'); return; }
        if (!kycForm.latitude || !kycForm.longitude) { showToast('Pin your location on the map.', 'error'); return; }
        const fd = new FormData();
        ['aadhaar_number', 'pan_number', 'bank_account_name', 'bank_account_no', 'bank_ifsc', 'shop_opening_time', 'shop_closing_time', 'addr_line1', 'addr_line2', 'addr_line3', 'city', 'country', 'pincode', 'latitude', 'longitude'].forEach(k => { if (kycForm[k]) fd.append(k, kycForm[k]); });
        if (kycFile) fd.append('kyc_document', kycFile);
        try { await uploadVendorKYC(fd); showToast('KYC submitted!'); await loadTab('profile'); }
        catch (e) { showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.', 'error'); }
    };

    const handleJoinNetwork = async (e) => {
        e.preventDefault();
        if (!networkForm.city) { showToast('Select a city.', 'error'); return; }
        try { await joinNetwork({ city: networkForm.city, max_vehicles: networkForm.max_vehicles, handling_fee_override: networkForm.handling_fee_override || null }); showToast('Joined!'); await loadTab('network'); }
        catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
    };

    const handleLeaveNetwork = async (id) => {
        if (!window.confirm('Leave this city network?')) return;
        try { await leaveNetwork(id); setNetwork(p => p.filter(n => n.id !== id)); showToast('Left.'); }
        catch { showToast('Failed.', 'error'); }
    };

    const liveV = vehicles.filter(v => v.status === 'LIVE').length;
    const totalRevenue = parseFloat(analytics?.total_revenue || 0);
    const vf = k => e => setVehicleForm(p => ({ ...p, [k]: e.target.value }));
    const kycRequiredTabs = ['bookings', 'fleet', 'network', 'handovers'];
    const showKYCGate = kycRequiredTabs.includes(tab) && !kycComplete && profile !== null;

    // ── Column definitions ─────────────────────────────────────────────────

    const bookingColumns = [
        {
            key: 'booking_ref', label: 'Booking Ref', sortable: true, width: 150,
            render: v => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--vacc)' }}>{v}</span>,
        },
        {
            key: 'customer_name', label: 'Customer', sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || row.customer?.full_name || '—'}</span>
                    <span className="dt-cell-stack__secondary">{row.customer_email || row.customer?.email || ''}</span>
                </div>
            ),
        },
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true, width: 170,
            render: v => v || '—',
        },
        {
            key: 'status', label: 'Status', sortable: true, width: 110,
            render: val => <StatusBadge status={val} />,
        },
        {
            key: 'pickup_date', label: 'Pickup', sortable: true, width: 100,
            render: v => v || '—',
        },
        {
            key: 'return_date', label: 'Return', sortable: true, width: 100,
            render: v => v || '—',
        },
        { key: 'rental_days', label: 'Days', sortable: true, width: 60, align: 'center', render: v => v ?? '—' },
        {
            key: 'total_amount', label: 'Total', sortable: true, width: 110, align: 'right',
            render: v => <span className="dt-currency">₹{parseFloat(v || 0).toLocaleString('en-IN')}</span>,
        },
        {
            key: 'payment_captured', label: 'Paid', sortable: true, width: 60, align: 'center',
            render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : <span style={{ color: '#EF4444' }}>✕</span>,
        },
        {
            key: 'agreement_signed', label: 'Signed', sortable: true, width: 65, align: 'center',
            render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : <span style={{ color: '#D1D5DB' }}>—</span>,
        },
    ];

    const vehicleColumns = [
        {
            key: 'make', label: 'Vehicle', sortable: true, width: 220,
            render: (_, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{row.year} {row.make} {row.model}</span>
                    <span className="dt-cell-stack__secondary" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{row.plate_number}</span>
                </div>
            ),
        },
        { key: 'segment', label: 'Segment', sortable: true, width: 100, render: v => <span style={{ textTransform: 'capitalize' }}>{v || '—'}</span> },
        { key: 'fuel_type', label: 'Fuel', sortable: true, width: 80, render: v => <span style={{ textTransform: 'capitalize' }}>{v || '—'}</span> },
        {
            key: 'status', label: 'Status', sortable: true, width: 130,
            render: val => <StatusBadge status={val} statusMap={VEHICLE_STATUS_CLR} />,
        },
        {
            key: 'daily_rate', label: 'Rate/Day', sortable: true, width: 100, align: 'right',
            render: v => <span className="dt-currency">₹{parseInt(v || 0).toLocaleString('en-IN')}</span>,
        },
        {
            key: 'documents', label: 'Docs', sortable: false, width: 70, align: 'center',
            render: docs => {
                const a = (docs || []).filter(d => d.status === 'approved').length;
                return <span style={{ fontSize: 11, fontWeight: 700, color: a >= 3 ? '#059669' : '#D97706' }}>{a}/{(docs || []).length}</span>;
            },
        },
        {
            key: 'photos', label: 'Photos', sortable: false, width: 70, align: 'center',
            render: photos => {
                const n = (photos || []).length;
                return <span style={{ fontSize: 11, fontWeight: 700, color: n >= 10 ? '#059669' : '#D97706' }}>{n} {n >= 10 ? '✓' : '⚠'}</span>;
            },
        },
        {
            key: 'is_certified', label: 'Cert', sortable: true, width: 60, align: 'center',
            render: v => v ? <span style={{ color: '#059669', fontSize: 14 }}>✅</span> : <span style={{ color: '#D1D5DB' }}>—</span>,
        },
    ];

    const handoverColumns = [
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || '—'}</span>
                    <span className="dt-cell-stack__secondary">{row.booking_ref}</span>
                </div>
            ),
        },
        { key: 'originating_vendor_name', label: 'From Vendor', sortable: true, width: 160, render: v => v || '—' },
        { key: 'return_point_name', label: 'Return Point', sortable: true, width: 140, render: v => v ? `📍 ${v}` : '—' },
        { key: 'status', label: 'Status', sortable: true, width: 110, render: val => <StatusBadge status={val} statusMap={HANDOVER_STATUS_CLR} /> },
        { key: 'days_held', label: 'Days Held', sortable: true, width: 90, align: 'center', render: v => v ? <span style={{ color: v > 3 ? '#D97706' : 'inherit', fontWeight: v > 3 ? 700 : 400 }}>{v}d</span> : '—' },
        { key: 'handover_photos_uploaded', label: 'Photos', sortable: false, width: 70, align: 'center', render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : '—' },
        { key: 'full_inspection_done', label: 'Inspected', sortable: false, width: 80, align: 'center', render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : '—' },
    ];

    const reviewColumns = [
        {
            key: 'customer_name', label: 'Customer', sortable: true, width: 150,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || '—'}</span>
                    <span className="dt-cell-stack__secondary">{row.vehicle_display || '—'}</span>
                </div>
            ),
        },
        {
            key: 'vendor_rating', label: 'Vendor ★', sortable: true, width: 130,
            render: v => <span style={{ display: 'inline-flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 14, color: n <= (v || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>)}</span>,
        },
        {
            key: 'vehicle_rating', label: 'Vehicle ★', sortable: true, width: 130,
            render: v => <span style={{ display: 'inline-flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 14, color: n <= (v || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>)}</span>,
        },
        {
            key: 'review_text', label: 'Review', sortable: false,
            render: v => v ? <span style={{ fontSize: 12, color: 'var(--vt2)', fontStyle: 'italic', display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{v}"</span> : <span style={{ color: 'var(--vm)', fontSize: 11 }}>No text</span>,
        },
        { key: 'created_at', label: 'Date', sortable: true, width: 110, render: v => fmtDate(v) },
    ];

    const networkColumns = [
        { key: 'city_name', label: 'City', sortable: true },
        { key: 'max_vehicles', label: 'Max Vehicles', sortable: true, width: 110, align: 'center' },
        {
            key: 'current_held_count', label: 'Currently Held', sortable: true, width: 130, align: 'center',
            render: (v, row) => <span style={{ fontWeight: 700, color: v >= row.max_vehicles ? '#EF4444' : '#1D4ED8' }}>{v || 0} / {row.max_vehicles}</span>,
        },
        {
            key: 'is_active', label: 'Status', sortable: true, width: 90,
            render: v => <span className="vd-badge" style={{ background: v ? '#D1FAE5' : '#FEE2E2', color: v ? '#059669' : '#EF4444', border: v ? '1px solid #6EE7B7' : '1px solid #FCA5A5' }}>{v ? 'Active' : 'Inactive'}</span>,
        },
    ];

    return (
        <div className="vd">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            {/* Detail modals — opened only via "View Details" / "Manage" button */}
            {selectedBooking && bookingDetail && (
                <div className="vd-modal-overlay" onClick={() => { setSelectedBooking(null); setBookingDetail(null); }}>
                    <div className="vd-modal" style={{ maxWidth: 900, padding: 0 }} onClick={e => e.stopPropagation()}>
                        <BookingDetailPanel
                            booking={bookingDetail}
                            onClose={() => { setSelectedBooking(null); setBookingDetail(null); }}
                            onRefresh={refreshBookingDetail}
                            showToast={showToast}
                        />
                    </div>
                </div>
            )}
            {selectedVehicle && (
                <VehicleManageModal
                    vehicle={selectedVehicle}
                    onClose={() => setSelectedVehicle(null)}
                    showToast={showToast}
                    onRefresh={async () => { const { data } = await getMyVehicles(); setVehicles(data.results || data); setSelectedVehicle(prev => (data.results || data).find(v => v.id === prev?.id) || prev); }}
                    docUploads={docUploads} setDocUploads={setDocUploads}
                    photoUpload={photoUpload} setPhotoUpload={setPhotoUpload}
                    availData={availData[selectedVehicle.id]}
                    blockInput={blockInput[selectedVehicle.id] || ''}
                    onBlockInputChange={val => setBlockInput(p => ({ ...p, [selectedVehicle.id]: val }))}
                    onLoadAvail={loadAvailability}
                    onBlock={handleBlock}
                    onUnblock={handleUnblock}
                    onStatusToggle={() => handleToggleVehicle(selectedVehicle.id)}
                />
            )}
            {selectedHandover && (
                <HandoverDetailModal
                    handover={selectedHandover}
                    onClose={() => setSelectedHandover(null)}
                    showToast={showToast}
                    onRefresh={async () => { const { data } = await getMyHandovers(); setHandovers(data.results || data); setSelectedHandover(null); }}
                    handoverNotes={handoverNotes} setHandoverNotes={setHandoverNotes}
                    handoverPhotoFile={handoverPhotoFile} setHandoverPhotoFile={setHandoverPhotoFile}
                />
            )}
            {selectedReview && <ReviewDetailModal review={selectedReview} onClose={() => setSelectedReview(null)} />}

            <div className="page-shell">
                <div className="vd__inner">
                    {/* Hero */}
                    <div className="vd__hero">
                        <div className="vd__hero-banner" />
                        <div className="vd__hero-body">
                            <div className="vd__hero-left">
                                <div className="vd__hero-avatar">{(profile?.business_name || user?.full_name || 'V')[0].toUpperCase()}</div>
                                <div className="vd__hero-info">
                                    <div className="vd__hero-name">Welcome back, {(profile?.business_name || user?.full_name || 'Vendor')?.split(' ')[0]}</div>
                                    <div className="vd__hero-meta">
                                        <span style={{ fontSize: 12, color: '#000' }}>{user?.email}</span>
                                        <span className="vd-badge" style={{ background: profile?.status === 'approved' ? '#D1FAE5' : '#FEF3C7', color: profile?.status === 'approved' ? '#059669' : '#D97706', border: profile?.status === 'approved' ? '1px solid #6EE7B7' : '1px solid #FCD34D' }}>{profile?.status || 'pending'}</span>
                                        {profile?.rating > 0 && <span className="vd-badge" style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>★ {profile.rating}</span>}
                                        {profile && !kycComplete && <button className="vd-badge vd-kyc-hero-alert" style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5', cursor: 'pointer' }} onClick={goToKYC}>⚠ Complete KYC</button>}
                                        {profile && kycComplete && <span className="vd-badge" style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>✓ KYC Done</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="vd__kpis">
                                {[[`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Revenue', '#0DB89E'], [analytics?.booking_count || 0, 'Total Bookings', '#1D4ED8'], [liveV, 'Live Cars', '#059669'], [handovers.filter(h => ['RECEIVED', 'HELD'].includes(h.status)).length || '—', 'Held Cars', '#D97706']].map(([v, l, color]) => (
                                    <div key={l} className="vd__kpi"><span className="vd__kpi-val" style={{ color }}>{v}</span><span className="vd__kpi-lbl">{l}</span></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {loading && <div className="vd-loading"><div className="vd-spinner" /> Loading…</div>}
                    {error && <div className="vd-error">{error}</div>}

                    {!loading && (
                        <div className="vd__content">
                            {showKYCGate ? (
                                <KYCGateBanner onGoToKYC={goToKYC} />
                            ) : (
                                <>
                                    {/* ── OVERVIEW ── */}
                                    {tab === 'overview' && (
                                        <div className="vd-grid-2">
                                            {profile && !kycComplete && (
                                                <div style={{ gridColumn: '1 / -1' }} className="vd-kyc-overview-warn">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <span style={{ fontSize: 20 }}>🔒</span>
                                                        <div>
                                                            <strong>Complete your KYC to unlock all features</strong>
                                                            <p style={{ fontSize: 12, margin: '2px 0 0 0', color: '#92400E' }}>Fleet management, bookings, and network features are locked until KYC is verified.</p>
                                                        </div>
                                                        <button className="vd-btn vd-btn--primary vd-btn--sm" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={goToKYC}>Complete KYC →</button>
                                                    </div>
                                                </div>
                                            )}
                                            <SectionCard title="Booking Status">
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    {Object.entries(analytics?.status_counts || {}).map(([s, c]) => (
                                                        <div key={s} className="vd-stat-chip" style={{ '--bc': STATUS_CLR[s]?.color || '#9CA3AF' }}>
                                                            <span className="vd-stat-chip__n">{c}</span>
                                                            <span className="vd-stat-chip__l">{s}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Revenue">
                                                <div className="vd-rev-box">
                                                    <span className="vd-rev-box__amt">₹{totalRevenue.toLocaleString('en-IN')}</span>
                                                    <span className="vd-rev-box__sub">Total Revenue</span>
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Recent Bookings" action={<button className="vd-btn vd-btn--outline vd-btn--sm" onClick={() => setTab('bookings')}>View All →</button>}>
                                                {bookings.slice(0, 4).map(b => {
                                                    const s = STATUS_CLR[b.status] || { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
                                                    return (
                                                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--vbdr)' }}>
                                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--vacc)', flex: 1 }}>{b.booking_ref}</span>
                                                            <span className="vd-badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{b.status}</span>
                                                            <span style={{ fontSize: 13, fontWeight: 700 }}>₹{parseFloat(b.total_amount || 0).toLocaleString('en-IN')}</span>
                                                            <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => openBookingDetail(b)}>View →</button>
                                                        </div>
                                                    );
                                                })}
                                                {bookings.length === 0 && <p className="vd-empty-sm">No bookings yet.</p>}
                                            </SectionCard>
                                        </div>
                                    )}

                                    {/* ── BOOKINGS ── */}
                                    {tab === 'bookings' && (
                                        <div className="vd-section">
                                            <DataTable
                                                columns={bookingColumns}
                                                data={bookings}
                                                searchable
                                                searchKeys={['booking_ref', 'customer_name', 'customer_email', 'vehicle_display']}
                                                searchPlaceholder="Search by ref, customer, vehicle…"
                                                filters={[{
                                                    key: 'status', label: 'Status',
                                                    options: [
                                                        { value: '', label: 'All' },
                                                        { value: 'PENDING', label: 'Pending' },
                                                        { value: 'CONFIRMED', label: 'Confirmed' },
                                                        { value: 'ACTIVE', label: 'Active' },
                                                        { value: 'COMPLETED', label: 'Completed' },
                                                        { value: 'CANCELLED', label: 'Cancelled' },
                                                    ],
                                                    colorMap: STATUS_CLR,
                                                }]}
                                                onRowAction={(row) => openBookingDetail(row)}
                                                actionLabel="View Booking"
                                                emptyIcon="📅"
                                                emptyMessage="No bookings yet."
                                                pageSize={20}
                                            />
                                        </div>
                                    )}

                                    {/* ── FLEET ── */}
                                    {tab === 'fleet' && (
                                        <div className="vd-section">
                                            <div className="vd-sec-hd">
                                                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Fleet <span className="vd-count">({vehicles.length})</span></h2>
                                                <button className="vd-btn vd-btn--primary" onClick={() => setShowAddVehicle(!showAddVehicle)}>
                                                    {showAddVehicle ? '✕ Cancel' : '+ Register Vehicle'}
                                                </button>
                                            </div>
                                            {showAddVehicle && (
                                                <SectionCard title="Register New Vehicle">
                                                    <form onSubmit={handleAddVehicle}>
                                                        <div className="vd-fg vd-fg--3">
                                                            <FormInput label="Make" value={vehicleForm.make} onChange={vf('make')} required />
                                                            <FormInput label="Model" value={vehicleForm.model} onChange={vf('model')} required />
                                                            <FormInput label="Year" type="number" value={vehicleForm.year} onChange={vf('year')} min={2000} max={2027} required />
                                                            <FormInput label="Colour" value={vehicleForm.colour} onChange={vf('colour')} />
                                                            <FormInput label="Plate Number" value={vehicleForm.plate_number} onChange={vf('plate_number')} required />
                                                            <FormInput label="Daily Rate (₹)" type="number" value={vehicleForm.daily_rate} onChange={vf('daily_rate')} min={300} required />
                                                            <FormInput label="Seats" type="number" value={vehicleForm.capacity} onChange={vf('capacity')} min={2} max={50} required />
                                                            <FormSelect label="Segment" value={vehicleForm.segment} onChange={vf('segment')} options={SEGMENTS} />
                                                            <FormSelect label="Fuel" value={vehicleForm.fuel_type} onChange={vf('fuel_type')} options={FUELS} />
                                                            <FormSelect label="Transmission" value={vehicleForm.transmission} onChange={vf('transmission')} options={['manual', 'automatic']} />
                                                            <FormSelect label="City" value={vehicleForm.city} onChange={vf('city')} required options={[{ value: '', label: 'Select city…' }, ...cities.map(c => ({ value: c.id, label: `${c.name}, ${c.state}` }))]} />
                                                            {cityLocations.length > 0 && <FormSelect label="Pickup Location" value={vehicleForm.pickup_location} onChange={vf('pickup_location')} options={[{ value: '', label: 'Select…' }, ...cityLocations.map(l => ({ value: l.id, label: l.name }))]} />}
                                                        </div>
                                                        <div style={{ marginTop: 16 }}><button type="submit" className="vd-btn vd-btn--primary">Register Vehicle →</button></div>
                                                    </form>
                                                </SectionCard>
                                            )}
                                            <DataTable
                                                columns={vehicleColumns}
                                                data={vehicles}
                                                searchable
                                                searchKeys={['make', 'model', 'plate_number', 'year']}
                                                searchPlaceholder="Search by make, model, plate number…"
                                                filters={[{
                                                    key: 'status', label: 'Status',
                                                    options: [
                                                        { value: '', label: 'All' },
                                                        { value: 'PENDING_DOCS', label: 'Pending Docs' },
                                                        { value: 'DOCS_SUBMITTED', label: 'Docs Submitted' },
                                                        { value: 'ADMIN_APPROVED', label: 'Admin Approved' },
                                                        { value: 'LIVE', label: 'Live' },
                                                        { value: 'INACTIVE', label: 'Inactive' },
                                                    ],
                                                    colorMap: VEHICLE_STATUS_CLR,
                                                }, {
                                                    key: 'segment', label: 'Segment',
                                                    options: [{ value: '', label: 'All' }, ...SEGMENTS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))],
                                                }]}
                                                onRowAction={(row) => setSelectedVehicle(row)}
                                                actionLabel="Manage Vehicle"
                                                emptyIcon="🚗"
                                                emptyMessage="No vehicles registered yet."
                                                pageSize={15}
                                            />
                                        </div>
                                    )}

                                    {/* ── HANDOVERS ── */}
                                    {tab === 'handovers' && (
                                        <div className="vd-section">
                                            <DataTable
                                                columns={handoverColumns}
                                                data={handovers}
                                                searchable
                                                searchKeys={['vehicle_display', 'booking_ref', 'originating_vendor_name']}
                                                searchPlaceholder="Search handovers…"
                                                filters={[{
                                                    key: 'status', label: 'Status',
                                                    options: [
                                                        { value: '', label: 'All' },
                                                        { value: 'EXPECTED', label: 'Expected' },
                                                        { value: 'RECEIVED', label: 'Received' },
                                                        { value: 'HELD', label: 'Held' },
                                                        { value: 'SUBLISTED', label: 'Sublisted' },
                                                        { value: 'RETRIEVED', label: 'Retrieved' },
                                                    ],
                                                    colorMap: HANDOVER_STATUS_CLR,
                                                }]}
                                                onRowAction={(row) => setSelectedHandover(row)}
                                                actionLabel="Manage Handover"
                                                emptyIcon="📦"
                                                emptyMessage="No handovers assigned."
                                                pageSize={15}
                                            />
                                        </div>
                                    )}

                                    {/* ── NETWORK ── */}
                                    {tab === 'network' && (
                                        <div className="vd-grid-2">
                                            <SectionCard title="Join Vendor Network">
                                                <form onSubmit={handleJoinNetwork}>
                                                    <div className="vd-fg vd-fg--2">
                                                        <FormSelect label="City *" value={networkForm.city} onChange={e => setNetworkForm(p => ({ ...p, city: e.target.value }))} required options={[{ value: '', label: 'Select…' }, ...cities.map(c => ({ value: c.id, label: c.name }))]} />
                                                        <FormInput label="Max Vehicles" type="number" value={networkForm.max_vehicles} onChange={e => setNetworkForm(p => ({ ...p, max_vehicles: e.target.value }))} min={1} max={20} />
                                                    </div>
                                                    <div style={{ marginTop: 14 }}><button type="submit" className="vd-btn vd-btn--primary">Join Network →</button></div>
                                                </form>
                                            </SectionCard>
                                            <SectionCard title="My Memberships">
                                                <DataTable
                                                    columns={networkColumns}
                                                    data={network}
                                                    searchable={false}
                                                    emptyIcon="🤝"
                                                    emptyMessage="Not in any network yet."
                                                    pageSize={10}
                                                    extraActions={[{ label: 'Leave', className: 'dt-action-btn--danger', onClick: (row) => handleLeaveNetwork(row.id) }]}
                                                />
                                            </SectionCard>
                                        </div>
                                    )}

                                    {/* ── REVIEWS ── */}
                                    {tab === 'reviews' && (
                                        <div className="vd-section">
                                            {/* Summary card */}
                                            <SectionCard title="Customer Reviews" subtitle={`What customers say about ${profile?.business_name || 'your business'}`} action={
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {[['recency', '🕐 Newest'], ['rating', '★ Rating']].map(([val, label]) => (
                                                        <button key={val} onClick={async () => {
                                                            setReviewOrdering(val); setReviewsLoading(true);
                                                            try { const { data } = await fetchVendorReviews(user.id, val); setVendorReviews(data.results || data); }
                                                            catch { setVendorReviews([]); } finally { setReviewsLoading(false); }
                                                        }} className={`vd-btn vd-btn--sm ${reviewOrdering === val ? 'vd-btn--primary' : 'vd-btn--ghost'}`}>{label}</button>
                                                    ))}
                                                </div>
                                            }>
                                                {vendorReviews.length > 0 && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                                                        {[
                                                            [vendorReviews.length, 'Total', '#1D4ED8'],
                                                            [(vendorReviews.reduce((s, r) => s + (r.vendor_rating || 0), 0) / vendorReviews.length).toFixed(1), 'Avg Rating', '#E8A020'],
                                                            [vendorReviews.filter(r => r.vendor_rating >= 4).length, 'Positive', '#059669'],
                                                            [vendorReviews.filter(r => r.vendor_rating <= 2).length, 'Critical', '#EF4444'],
                                                        ].map(([v, l, color]) => (
                                                            <div key={l} style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                                                <div style={{ fontSize: 18, fontWeight: 800, color }}>{v}</div>
                                                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--vm)', marginTop: 3 }}>{l}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </SectionCard>
                                            {reviewsLoading && <div className="vd-loading"><div className="vd-spinner" /> Loading reviews…</div>}
                                            {!reviewsLoading && (
                                                <DataTable
                                                    columns={reviewColumns}
                                                    data={vendorReviews}
                                                    searchable
                                                    searchKeys={['customer_name', 'vehicle_display', 'review_text']}
                                                    searchPlaceholder="Search reviews…"
                                                    filters={[{
                                                        key: 'vendor_rating', label: 'Rating',
                                                        options: [{ value: '', label: 'All Ratings' }, ...[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} ★` }))],
                                                    }]}
                                                    onRowAction={(row) => setSelectedReview(row)}
                                                    actionLabel="View Review"
                                                    emptyIcon="💬"
                                                    emptyMessage="No reviews yet."
                                                    pageSize={20}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* ── PROFILE & KYC ── */}
                                    {tab === 'profile' && profile && (
                                        <div className="vd-grid-2">
                                            <SectionCard title="Personal Information" action={<button className="vd-btn vd-btn--outline vd-btn--sm" onClick={() => setProfileEdit(!profileEdit)}>{profileEdit ? 'Cancel' : 'Edit'}</button>}>
                                                {!kycComplete && (
                                                    <div className="vd-kyc-progress-banner">
                                                        <div className="vd-kyc-progress-banner__icon">📋</div>
                                                        <div>
                                                            <strong>KYC Checklist</strong>
                                                            <div className="vd-kyc-checklist">
                                                                {[[!!profile.bank_account_no, 'Bank account details'], [!!profile.city_id, 'City & address'], [!!(profile.latitude && profile.longitude), 'Pickup location pin'], [!!profile.kyc_document, 'KYC document uploaded']].map(([done, label]) => (
                                                                    <div key={label} className={`vd-kyc-check-item ${done ? 'done' : ''}`}><span>{done ? '✓' : '○'}</span><span>{label}</span></div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {kycComplete && <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ KYC Complete</div>}
                                                <div className="vd-profile-rows">
                                                    {[['Business Name', profile.business_name], ['Email', profile.email], ['Phone', profile.phone], ['GSTIN', profile.gstin || '—'], ['Rating', profile.rating ? `★ ${profile.rating}` : '—'], ['City', profile.city_name || '—'], ['Location Pin', (profile.latitude && profile.longitude) ? `${parseFloat(profile.latitude).toFixed(5)}, ${parseFloat(profile.longitude).toFixed(5)}` : 'Not set']].map(([l, v]) => (
                                                        <div key={l} className="vd-profile-row"><span className="vd-profile-row__lbl">{l}</span><strong className="vd-profile-row__val">{v}</strong></div>
                                                    ))}
                                                    <div className="vd-profile-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                                                        <span className="vd-profile-row__lbl">KYC Document</span>
                                                        <KYCDocumentViewer profile={profile} />
                                                        {!profile.kyc_document && <span style={{ color: '#EF4444', fontWeight: 600, fontSize: 12 }}>Not uploaded</span>}
                                                    </div>
                                                    {profile.bank_account_no && (
                                                        <>{[['Bank Name', profile.bank_account_name], ['Account No.', `••••${profile.bank_account_no.slice(-4)}`], ['IFSC', profile.bank_ifsc]].map(([l, v]) => <div key={l} className="vd-profile-row"><span className="vd-profile-row__lbl">{l}</span><strong className="vd-profile-row__val">{v}</strong></div>)}</>
                                                    )}
                                                </div>
                                                {profileEdit && (
                                                    <div className="vd-profile-edit-area">
                                                        <div className="vd-fg vd-fg--2">
                                                            <FormInput label="Opening Time" type="time" value={profileForm.shop_opening_time} onChange={e => setProfileForm(p => ({ ...p, shop_opening_time: e.target.value }))} />
                                                            <FormInput label="Closing Time" type="time" value={profileForm.shop_closing_time} onChange={e => setProfileForm(p => ({ ...p, shop_closing_time: e.target.value }))} />
                                                        </div>
                                                        <div style={{ marginTop: 10 }}><button className="vd-btn vd-btn--primary" onClick={handleProfileSave}>Save Changes</button></div>
                                                    </div>
                                                )}
                                            </SectionCard>

                                            <SectionCard title="KYC & Address">
                                                {profile.status === 'pending' && <div className="vd-kyc-alert">Your account is pending approval — submit KYC details to proceed.</div>}
                                                <form onSubmit={handleKYCSubmit}>
                                                    <div className="vd-kyc-section-label">Identity & Bank Details</div>
                                                    <div className="vd-fg vd-fg--2">
                                                        <FormInput label="Aadhaar Number" value={kycForm.aadhaar_number} onChange={e => setKycForm(p => ({ ...p, aadhaar_number: e.target.value }))} />
                                                        <FormInput label="PAN Number" value={kycForm.pan_number} onChange={e => setKycForm(p => ({ ...p, pan_number: e.target.value }))} />
                                                        <FormInput label="Bank Account Name" value={kycForm.bank_account_name} onChange={e => setKycForm(p => ({ ...p, bank_account_name: e.target.value }))} />
                                                        <FormInput label="Account No." value={kycForm.bank_account_no} onChange={e => setKycForm(p => ({ ...p, bank_account_no: e.target.value }))} />
                                                        <FormInput label="IFSC Code" value={kycForm.bank_ifsc} onChange={e => setKycForm(p => ({ ...p, bank_ifsc: e.target.value }))} />
                                                        <Field label="KYC Document (PDF / Image)">
                                                            <input type="file" accept=".pdf,.jpg,.png" className="vd-file-input" onChange={e => setKycFile(e.target.files[0])} />
                                                            {profile.kyc_document && <a href={profile.kyc_document} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--vacc)', marginTop: 4, display: 'inline-block' }}>View current document</a>}
                                                        </Field>
                                                    </div>
                                                    <div className="vd-kyc-section-label" style={{ marginTop: 16 }}>Shop Hours</div>
                                                    <div className="vd-fg vd-fg--2">
                                                        <FormInput label="Opening Time" type="time" value={kycForm.shop_opening_time} onChange={e => setKycForm(p => ({ ...p, shop_opening_time: e.target.value }))} />
                                                        <FormInput label="Closing Time" type="time" value={kycForm.shop_closing_time} onChange={e => setKycForm(p => ({ ...p, shop_closing_time: e.target.value }))} />
                                                    </div>
                                                    <div className="vd-kyc-section-label" style={{ marginTop: 16 }}>Business Address</div>
                                                    <div className="vd-fg vd-fg--2">
                                                        <FormInput label="Address Line 1" value={kycForm.addr_line1} onChange={e => setKycForm(p => ({ ...p, addr_line1: e.target.value }))} />
                                                        <FormInput label="Address Line 2" value={kycForm.addr_line2} onChange={e => setKycForm(p => ({ ...p, addr_line2: e.target.value }))} />
                                                        <FormInput label="Landmark / Line 3" value={kycForm.addr_line3} onChange={e => setKycForm(p => ({ ...p, addr_line3: e.target.value }))} />
                                                        <FormInput label="PIN Code" value={kycForm.pincode} onChange={e => setKycForm(p => ({ ...p, pincode: e.target.value }))} />
                                                        <Field label="City *">
                                                            <select className="vd-input vd-select" value={kycForm.city} onChange={e => setKycForm(p => ({ ...p, city: e.target.value }))} required>
                                                                <option value="">— Select City —</option>
                                                                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                            </select>
                                                        </Field>
                                                        <Field label="State"><div className="vd-input--ro">{kycStateDisplay || <span style={{ color: 'var(--vm)' }}>Auto-filled from city</span>}</div></Field>
                                                    </div>
                                                    <div className="vd-kyc-section-label" style={{ marginTop: 18 }}>Pickup Location Pin <span className="vd-kyc-section-badge">Required</span></div>
                                                    <button type="button" className="vd-map-toggle-btn" onClick={() => setShowMap(m => !m)}>
                                                        {showMap ? '▲ Hide Map' : 'Open Map'}
                                                        {kycForm.latitude && <span className="vd-map-pin-ok"> ✓ Location Pinned</span>}
                                                    </button>
                                                    {showMap && <MapPicker lat={kycForm.latitude} lng={kycForm.longitude} onLocationSelect={(lat, lng) => setKycForm(p => ({ ...p, latitude: lat !== null ? Number(lat.toFixed(7)) : '', longitude: lng !== null ? Number(lng.toFixed(7)) : '' }))} />}
                                                    <div style={{ marginTop: 20 }}><button type="submit" className="vd-btn vd-btn--primary">Submit KYC →</button></div>
                                                </form>
                                            </SectionCard>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}