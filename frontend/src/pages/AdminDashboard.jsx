import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    getAdminStats, getAdminAnalytics, getAdminVendors, adminVendorAction,
    getAdminVehicles, getAdminVehicleStats, reviewDoc, certifyVehicle,
    blacklistVehicle, vahanCheck, setVehicleStatus, getAdminBookings, getAdminUsers,
    getConfigSettings, updateConfigSetting, getSegmentConfigs, updateSegmentConfig,
    getLocations, createLocation, deleteLocation, getCities, createCity, deleteCity,
    getCityPairFees, createCityPairFee, deleteCityPairFee,
    getAdminPromos, createPromo, deletePromo,
    getReturnPoints, createReturnPoint, deleteReturnPoint,
    getAdminLogisticsOverview, getAdminLogisticsStats, getAdminNetworkList,
    getAdminAgreementVersions, createAgreementVersion, updateAgreementVersion,
    activateAgreementVersion, getAdminAcceptances,
} from '../services/api';
import { Sidebar } from '../components/common/Navbar';
import Navbar from '../components/common/Navbar';
import './AdminDashboard.css';

const VENDOR_STATUS_CLR = {
    approved: { bg: '#D1FAE5', color: '#059669' },
    pending: { bg: '#FEF3C7', color: '#D97706' },
    suspended: { bg: '#FEE2E2', color: '#EF4444' },
    rejected: { bg: '#FEE2E2', color: '#B91C1C' },
    more_info: { bg: '#EDE9FE', color: '#7C3AED' },
};
const VEHICLE_STATUS_CLR = {
    LIVE: { bg: '#D1FAE5', color: '#059669' },
    PENDING_DOCS: { bg: '#FEF3C7', color: '#D97706' },
    DOCS_SUBMITTED: { bg: '#DBEAFE', color: '#1D4ED8' },
    ADMIN_APPROVED: { bg: '#EDE9FE', color: '#7C3AED' },
    CERTIFIED: { bg: '#D1FAE5', color: '#059669' },
    INACTIVE: { bg: '#FEE2E2', color: '#EF4444' },
};
const BOOKING_STATUS_CLR = {
    PENDING: { bg: '#FEF3C7', color: '#D97706' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8' },
    ACTIVE: { bg: '#D1FAE5', color: '#059669' },
    COMPLETED: { bg: '#F3F4F6', color: '#6B7280' },
    CANCELLED: { bg: '#FEE2E2', color: '#EF4444' },
};
const HANDOVER_STATUS_CLR = {
    EXPECTED: { bg: '#FEF3C7', color: '#D97706' },
    RECEIVED: { bg: '#DBEAFE', color: '#1D4ED8' },
    INSPECTED: { bg: '#EDE9FE', color: '#7C3AED' },
    HELD: { bg: '#F3F4F6', color: '#6B7280' },
    SUBLISTED: { bg: '#D1FAE5', color: '#059669' },
    RETRIEVED: { bg: '#F3F4F6', color: '#9CA3AF' },
};

// ── KYC completeness checker (mirrors VendorDashboard logic) ──────────────
function getKYCStatus(vendor) {
    const checks = {
        bank: !!vendor.bank_account_no,
        city: !!vendor.city_id,
        location: !!(vendor.latitude && vendor.longitude),
        document: !!vendor.kyc_document,
        identity: !!(vendor.aadhaar_number || vendor.pan_number),
    };
    const done = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { checks, done, total, complete: done === total };
}

// ── Photo Lightbox ─────────────────────────────────────────────────────────
const PhotoLightbox = ({ photos, initialIndex, onClose }) => {
    const [current, setCurrent] = useState(initialIndex || 0);
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, photos.length - 1));
            if (e.key === 'ArrowLeft') setCurrent(c => Math.max(c - 1, 0));
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [photos.length, onClose]);

    const src = photos[current]?.image || photos[current]?.url || photos[current];
    const label = photos[current]?.angle || photos[current]?.label || '';

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.90)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ✕ Close
            </button>
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 20, cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.3 : 1 }}>‹</button>
                <div style={{ textAlign: 'center' }}>
                    <img src={src} alt={label} style={{ maxWidth: 'min(80vw, 960px)', maxHeight: '72vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'block' }} />
                    {label && <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize', letterSpacing: '0.5px' }}>{label} · {current + 1}/{photos.length}</div>}
                </div>
                <button onClick={() => setCurrent(c => Math.min(c + 1, photos.length - 1))} disabled={current === photos.length - 1} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 20, cursor: current === photos.length - 1 ? 'not-allowed' : 'pointer', opacity: current === photos.length - 1 ? 0.3 : 1 }}>›</button>
            </div>
            {photos.length > 1 && (
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80vw' }}>
                    {photos.map((ph, idx) => (
                        <img key={idx} src={ph.image || ph.url || ph} alt="" onClick={() => setCurrent(idx)} style={{ width: 56, height: 44, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: idx === current ? '2px solid #0DB89E' : '2px solid rgba(255,255,255,0.2)', opacity: idx === current ? 1 : 0.55, transition: 'opacity 0.15s, border-color 0.15s' }} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── KYC Document display (image lightbox + PDF link) ──────────────────────
function KYCDocumentCell({ url, label = 'KYC Document' }) {
    const [open, setOpen] = useState(false);
    if (!url) return <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 600 }}>Not uploaded</span>;
    const isPDF = url.toLowerCase().includes('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
    return (
        <>
            {isImage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                    <div
                        onClick={() => setOpen(true)}
                        style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--vbdr)', position: 'relative', display: 'inline-block' }}
                        title="Click to enlarge"
                    >
                        <img src={url} alt={label} style={{ width: 90, height: 68, objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }} className="admin-img-hover">
                            <span style={{ color: '#fff', fontSize: 16 }}>⤢</span>
                        </div>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--teal-primary)', textDecoration: 'underline' }}>Open full size ↗</a>
                </div>
            ) : isPDF ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="admin-doc-link">
                    <span>📄</span><span>View PDF</span>
                </a>
            ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className="admin-doc-link">
                    <span>📎</span><span>View file</span>
                </a>
            )}
            {open && <PhotoLightbox photos={[{ image: url, label }]} initialIndex={0} onClose={() => setOpen(false)} />}
        </>
    );
}

// ── Vehicle Document row with image/pdf preview ───────────────────────────
function DocPreviewRow({ doc }) {
    const [open, setOpen] = useState(false);
    if (!doc?.file) return null;
    const isPDF = doc.file.toLowerCase().includes('.pdf');
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.file);
    const dc = doc.status === 'approved' ? { bg: '#D1FAE5', color: '#059669' } : doc.status === 'rejected' ? { bg: '#FEE2E2', color: '#EF4444' } : { bg: '#FEF3C7', color: '#D97706' };
    return (
        <>
            {open && isImage && <PhotoLightbox photos={[{ image: doc.file, label: doc.doc_type }]} initialIndex={0} onClose={() => setOpen(false)} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isImage ? (
                    <div onClick={() => setOpen(true)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--vbdr)', flexShrink: 0 }} title="Click to enlarge">
                        <img src={doc.file} alt={doc.doc_type} style={{ width: 56, height: 44, objectFit: 'cover', display: 'block' }} />
                    </div>
                ) : isPDF ? (
                    <a href={doc.file} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--teal-primary)', background: '#E6F7F5', padding: '3px 9px', borderRadius: 5, fontWeight: 600, textDecoration: 'none' }}>📄 PDF</a>
                ) : (
                    <a href={doc.file} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--teal-primary)' }}>View</a>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: dc.bg, color: dc.color }}>{doc.status}</span>
                {doc.expiry_date && <span style={{ fontSize: 10, color: 'var(--vm)' }}>exp {doc.expiry_date}</span>}
                {doc.admin_note && <span style={{ fontSize: 10, color: '#D97706', fontStyle: 'italic' }}>Note: {doc.admin_note}</span>}
            </div>
        </>
    );
}

// ── FilterDropdown ─────────────────────────────────────────────────────────
function FilterDropdown({ label, value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const selected = options.find(o => o.value === value);
    const isActive = value !== '' && value != null;
    return (
        <div className="cd-filter-dropdown" ref={ref}>
            <button className={`cd-filter-dropdown__trigger${isActive ? ' active' : ''}${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)}>
                <span className="cd-filter-dropdown__label">{label}</span>
                {isActive && <span className="cd-filter-dropdown__chip">{selected?.label}</span>}
                <span className={`cd-filter-dropdown__chevron${open ? ' flipped' : ''}`}>▾</span>
            </button>
            {open && (
                <div className="cd-filter-dropdown__menu">
                    {options.map(opt => (
                        <button key={opt.value} className={`cd-filter-dropdown__item${value === opt.value ? ' selected' : ''}`} onClick={() => { onChange(opt.value); setOpen(false); }}>
                            {opt.color && <span className="cd-filter-dropdown__dot" style={{ background: opt.color }} />}
                            <span>{opt.label}</span>
                            {value === opt.value && <span className="cd-filter-dropdown__check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Mini Components ────────────────────────────────────────────────────────
function StatusBadge({ status, colorMap, size = 'md' }) {
    const s = colorMap?.[status] || { bg: '#F3F4F6', color: '#6B7280' };
    return (
        <span className={`admin-status-badge admin-status-badge--${size}`} style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}30` }}>
            {status?.replace(/_/g, ' ')}
        </span>
    );
}

function SectionCard({ title, subtitle, children, action }) {
    return (
        <div className="admin-section-card">
            <div className="admin-section-card__header">
                <div>
                    <h3>{title}</h3>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

function EmptyState({ icon, message }) {
    return (
        <div className="admin-empty">
            <span style={{ fontSize: 30 }}>{icon}</span>
            <p>{message}</p>
        </div>
    );
}

function InlineForm({ fields, onSubmit, submitLabel = '+ Add', loading }) {
    const [vals, setVals] = useState(() => Object.fromEntries(fields.map(f => [f.key, f.default || ''])));
    return (
        <form className="admin-inline-form" onSubmit={e => { e.preventDefault(); onSubmit(vals); setVals(Object.fromEntries(fields.map(f => [f.key, f.default || '']))); }}>
            {fields.map(f => (
                <div key={f.key} className="admin-form-field">
                    <label>{f.label}</label>
                    {f.type === 'select' ? (
                        <select value={vals[f.key]} onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))} required={f.required}>
                            <option value="">Select {f.label}</option>
                            {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    ) : (
                        <input type={f.type || 'text'} value={vals[f.key]} step={f.step} placeholder={f.placeholder} onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))} required={f.required} />
                    )}
                </div>
            ))}
            <button type="submit" className="admin-form-submit" disabled={loading}>{loading ? '…' : submitLabel}</button>
        </form>
    );
}

// ── User Detail Modal ─────────────────────────────────────────────────
const KYC_STATUS_CLR = {
    pending:  { bg: '#FEF3C7', color: '#D97706' },
    verified: { bg: '#D1FAE5', color: '#059669' },
    rejected: { bg: '#FEE2E2', color: '#EF4444' },
};

function UserDetailModal({ user: u, onClose }) {
    const kyc = KYC_STATUS_CLR[u.kyc_status] || KYC_STATUS_CLR.pending;
    const hasProfile = u.driving_licence !== undefined; // rich serializer returned

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal user-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="admin-modal__head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="user-modal__avatar">
                            {u.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{u.full_name || '—'}</h2>
                            <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--vm)' }}>{u.email}</span>
                                {u.phone && <span style={{ fontSize: 12, color: 'var(--vm)' }}>· {u.phone}</span>}
                                {u.kyc_status && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: kyc.bg, color: kyc.color }}>
                                        KYC {u.kyc_status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--vm)', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
                        ✕ Close
                    </button>
                </div>

                <div className="user-modal__body">

                    {/* LEFT — Identity & Contact */}
                    <div className="user-modal__col">

                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">👤 Account Details</div>
                            <div className="bk-modal__rows">
                                {[
                                    ['Full Name',    u.full_name || '—'],
                                    ['Email',        u.email],
                                    ['Phone',        u.phone || '—'],
                                    ['Member Since', u.date_joined
                                        ? new Date(u.date_joined).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '—'],
                                ].map(([label, val]) => (
                                    <div key={label} className="bk-modal__row">
                                        <span>{label}</span><strong>{val}</strong>
                                    </div>
                                ))}
                                <div className="bk-modal__row">
                                    <span>Email</span>
                                    <strong style={{ color: u.is_email_verified ? '#059669' : '#EF4444' }}>
                                        {u.is_email_verified ? '✓ Verified' : '✕ Not verified'}
                                    </strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Phone</span>
                                    <strong style={{ color: u.is_phone_verified ? '#059669' : '#EF4444' }}>
                                        {u.is_phone_verified ? '✓ Verified' : '✕ Not verified'}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {hasProfile && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">🪪 Identity & KYC</div>
                                <div className="bk-modal__rows">
                                    {[
                                        ['Aadhaar', u.aadhaar_number ? `••••••••${u.aadhaar_number.slice(-4)}` : '—'],
                                        ['PAN',     u.pan_number || '—'],
                                        ['DOB',     u.date_of_birth
                                            ? new Date(u.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : '—'],
                                        ['KYC Status', null], // rendered separately
                                    ].filter(([, v]) => v !== null).map(([label, val]) => (
                                        <div key={label} className="bk-modal__row">
                                            <span>{label}</span><strong>{val}</strong>
                                        </div>
                                    ))}
                                    <div className="bk-modal__row">
                                        <span>KYC Status</span>
                                        <strong style={{ color: kyc.color }}>{u.kyc_status || 'pending'}</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT — Driving Licence & Bookings */}
                    <div className="user-modal__col">

                        {hasProfile && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">🚗 Driving Licence</div>
                                <div className="bk-modal__rows">
                                    {[
                                        ['Licence No.', u.driving_licence || '—'],
                                        ['Expiry', u.dl_expiry
                                            ? new Date(u.dl_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : '—'],
                                    ].map(([label, val]) => {
                                        const expired = label === 'Expiry' && u.dl_expiry && new Date(u.dl_expiry) < new Date();
                                        return (
                                            <div key={label} className="bk-modal__row">
                                                <span>{label}</span>
                                                <strong style={{ color: expired ? '#EF4444' : 'inherit' }}>
                                                    {val}{expired ? ' ⚠ Expired' : ''}
                                                </strong>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {hasProfile && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">⭐ Loyalty & Bookings</div>
                                <div className="user-modal__stats">
                                    <div className="user-modal__stat">
                                        <span className="user-modal__stat-val" style={{ color: '#D97706' }}>
                                            {(u.loyalty_points || 0).toLocaleString('en-IN')}
                                        </span>
                                        <span className="user-modal__stat-lbl">Loyalty Points</span>
                                        <span className="user-modal__stat-sub">
                                            ≈ ₹{((u.loyalty_points || 0) * 0.25).toLocaleString('en-IN', { maximumFractionDigits: 0 })} value
                                        </span>
                                    </div>
                                    <div className="user-modal__stat">
                                        <span className="user-modal__stat-val" style={{ color: '#1D4ED8' }}>
                                            {u.total_bookings ?? '—'}
                                        </span>
                                        <span className="user-modal__stat-lbl">Total Bookings</span>
                                    </div>
                                    <div className="user-modal__stat">
                                        <span className="user-modal__stat-val" style={{ color: '#059669' }}>
                                            {u.active_bookings ?? '—'}
                                        </span>
                                        <span className="user-modal__stat-lbl">Active Now</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!hasProfile && (
                            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--vm)', fontSize: 13 }}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>ℹ️</div>
                                Profile details not available.
                                <div style={{ fontSize: 11, marginTop: 4 }}>Apply the backend serializer patch to enable full profile data.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Booking Detail Modal ───────────────────────────────────────────────
const ADDON_LABELS = {
    insurance_basic: 'Basic Insurance',
    insurance_comprehensive: 'Comprehensive Insurance',
    personal_accident: 'Personal Accident',
    child_seat: 'Child Seat',
    gps: 'GPS Device',
    additional_driver: 'Additional Driver',
};

function BookingDetailModal({ booking: b, onClose }) {
    const ps = b.pricing_snapshot || {};

    const paymentStatus = () => {
        if (!b.payment_captured) return { label: 'Unpaid', color: '#EF4444', bg: '#FEE2E2' };
        if (ps.full_payment_paid) return { label: 'Fully Paid', color: '#059669', bg: '#D1FAE5' };
        if (ps.advance_paid) return { label: 'Advance Paid', color: '#D97706', bg: '#FEF3C7' };
        return { label: 'Paid', color: '#059669', bg: '#D1FAE5' };
    };
    const pymtSt = paymentStatus();

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal bk-modal" onClick={e => e.stopPropagation()}>

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="admin-modal__head bk-modal__head">
                    <div className="bk-modal__ref-block">
                        <span className="bk-modal__ref">{b.booking_ref}</span>
                        <StatusBadge status={b.status} colorMap={BOOKING_STATUS_CLR} />
                        <span className="bk-modal__pay-badge" style={{ color: pymtSt.color, background: pymtSt.bg }}>
                            {pymtSt.label}
                        </span>
                        {b.is_one_way && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EDE9FE', color: '#7C3AED' }}>
                                ONE-WAY
                            </span>
                        )}
                        {b.agreement_signed && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#D1FAE5', color: '#059669' }}>
                                ✍ Signed
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--vm)', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
                        ✕ Close
                    </button>
                </div>

                <div className="bk-modal__body">

                    {/* ── LEFT COLUMN ─────────────────────────────────── */}
                    <div className="bk-modal__col">

                        {/* Customer */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">👤 Customer</div>
                            <div className="bk-modal__rows">
                                <div className="bk-modal__row"><span>Name</span><strong>{b.customer_name || '—'}</strong></div>
                                <div className="bk-modal__row"><span>Email</span><strong>{b.customer_email || '—'}</strong></div>
                                <div className="bk-modal__row"><span>Phone</span><strong>{b.customer_phone || '—'}</strong></div>
                            </div>
                        </div>

                        {/* Vehicle */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🚗 Vehicle</div>
                            <div className="bk-modal__rows">
                                <div className="bk-modal__row"><span>Vehicle</span><strong>{b.vehicle_display || '—'}</strong></div>
                                <div className="bk-modal__row">
                                    <span>Vendor</span>
                                    <strong>{b.vendor_name || b.vendor?.vendor_profile?.business_name || '—'}</strong>
                                </div>
                                <div className="bk-modal__row"><span>Segment</span><strong style={{ textTransform: 'capitalize' }}>{b.vehicle?.segment || '—'}</strong></div>
                                <div className="bk-modal__row">
                                    <span>Plate No.</span>
                                    <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{b.vehicle?.plate_number || '—'}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Trip Dates & Locations */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">📍 Trip Details</div>
                            <div className="bk-modal__rows">
                                <div className="bk-modal__row">
                                    <span>Pickup</span>
                                    <strong>{b.pickup_date}{b.pickup_time ? ` at ${b.pickup_time}` : ''}</strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Return</span>
                                    <strong>{b.return_date}{b.return_time ? ` at ${b.return_time}` : ''}</strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Duration</span>
                                    <strong>{b.rental_days} day{b.rental_days !== 1 ? 's' : ''}</strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Pickup Location</span>
                                    <strong style={{ textAlign: 'right', fontSize: 12 }}>
                                        {b.pickup_location_detail?.name || '—'}
                                        {b.pickup_location_detail?.city_name && <span style={{ color: 'var(--vm)', fontWeight: 400 }}> · {b.pickup_location_detail.city_name}</span>}
                                    </strong>
                                </div>
                                {b.is_one_way && (
                                    <div className="bk-modal__row">
                                        <span>Return Location</span>
                                        <strong style={{ textAlign: 'right', fontSize: 12 }}>
                                            {b.return_location_detail?.name || '—'}
                                            {b.return_location_detail?.city_name && <span style={{ color: 'var(--vm)', fontWeight: 400 }}> · {b.return_location_detail.city_name}</span>}
                                        </strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Inspections */}
                        {(b.inspections || []).length > 0 && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">🔍 Inspections</div>
                                {b.inspections.map(insp => (
                                    <div key={insp.id} className="bk-insp-row">
                                        <div className="bk-insp-row__head">
                                            <span className="bk-insp-type">{insp.inspection_type}</span>
                                            <span style={{ fontSize: 10, color: 'var(--vm)' }}>
                                                {insp.odometer_reading ? `${insp.odometer_reading.toLocaleString('en-IN')} km` : '—'}
                                                {insp.fuel_level ? ` · Fuel: ${insp.fuel_level}` : ''}
                                            </span>
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                                <span className={`bk-sign-dot ${insp.customer_signed ? 'ok' : ''}`} title="Customer signed">C</span>
                                                <span className={`bk-sign-dot ${insp.vendor_signed ? 'ok' : ''}`} title="Vendor signed">V</span>
                                                {insp.is_locked && <span style={{ fontSize: 9, color: '#059669', fontWeight: 700 }}>🔒 LOCKED</span>}
                                            </div>
                                        </div>
                                        {insp.damage_reported && (
                                            <div style={{ fontSize: 11, color: '#EF4444', background: '#FEE2E2', borderRadius: 6, padding: '4px 8px', marginTop: 4 }}>
                                                ⚠ Damage reported{insp.damage_amount ? ` · ₹${parseFloat(insp.damage_amount).toLocaleString('en-IN')}` : ''}
                                                {insp.damage_notes && <span> · {insp.damage_notes}</span>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Cancellation */}
                        {b.status === 'CANCELLED' && b.cancellation_reason && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">❌ Cancellation</div>
                                <div style={{ fontSize: 12, color: '#7F1D1D', background: '#FEE2E2', borderRadius: 8, padding: '8px 12px' }}>
                                    {b.cancellation_reason}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT COLUMN ─────────────────────────────────── */}
                    <div className="bk-modal__col">

                        {/* Pricing Breakdown */}
                        <div className="bk-modal__section bk-modal__section--pricing">
                            <div className="bk-modal__section-hd">💰 Pricing Breakdown</div>
                            <div className="bk-price-table">
                                {ps.daily_rate && (
                                    <div className="bk-price-row">
                                        <span>Daily Rate</span>
                                        <span>₹{parseFloat(ps.daily_rate).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {ps.rental_days != null && (
                                    <div className="bk-price-row">
                                        <span>Duration</span>
                                        <span>{ps.rental_days} day{ps.rental_days !== 1 ? 's' : ''}</span>
                                    </div>
                                )}
                                {ps.base_amount && (
                                    <div className="bk-price-row">
                                        <span>Base Amount</span>
                                        <span>₹{parseFloat(ps.base_amount).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {parseFloat(ps.addon_total || 0) > 0 && (
                                    <div className="bk-price-row">
                                        <span>Add-ons</span>
                                        <span>₹{parseFloat(ps.addon_total).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {parseFloat(ps.one_way_fee || 0) > 0 && (
                                    <div className="bk-price-row">
                                        <span>One-way Fee</span>
                                        <span>₹{parseFloat(ps.one_way_fee).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {ps.cgst_amount && (
                                    <div className="bk-price-row bk-price-row--tax">
                                        <span>CGST</span>
                                        <span>₹{parseFloat(ps.cgst_amount).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                {ps.sgst_amount && (
                                    <div className="bk-price-row bk-price-row--tax">
                                        <span>SGST</span>
                                        <span>₹{parseFloat(ps.sgst_amount).toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <div className="bk-price-row bk-price-row--total">
                                    <span>Grand Total</span>
                                    <span>₹{parseFloat(b.total_amount || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="bk-price-row">
                                    <span>Security Deposit</span>
                                    <span>₹{parseFloat(b.deposit_amount || ps.security_deposit || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            {/* Payment split info */}
                            {(ps.advance_amount || ps.remaining_amount) && (
                                <div className="bk-pay-split">
                                    <div className={`bk-pay-split__item ${ps.advance_paid ? 'paid' : ''}`}>
                                        <span>{ps.advance_paid ? '✓' : '○'} Advance (30%)</span>
                                        <span>₹{parseFloat(ps.advance_amount || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className={`bk-pay-split__item ${ps.remaining_paid ? 'paid' : ''}`}>
                                        <span>{ps.remaining_paid ? '✓' : '○'} Remaining (70%)</span>
                                        <span>₹{parseFloat(ps.remaining_amount || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Deposit Status */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🏦 Deposit & Payment</div>
                            <div className="bk-modal__rows">
                                <div className="bk-modal__row">
                                    <span>Payment Captured</span>
                                    <strong style={{ color: b.payment_captured ? '#059669' : '#EF4444' }}>
                                        {b.payment_captured ? `✓ Yes${b.payment_captured_at ? ` · ${new Date(b.payment_captured_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}` : '✕ No'}
                                    </strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Deposit Held</span>
                                    <strong style={{ color: b.deposit_held ? '#D97706' : '#9CA3AF' }}>{b.deposit_held ? '🔒 Held' : '—'}</strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Deposit Released</span>
                                    <strong style={{ color: b.deposit_released ? '#059669' : '#9CA3AF' }}>{b.deposit_released ? '✓ Released' : '—'}</strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Agreement Signed</span>
                                    <strong style={{ color: b.agreement_signed ? '#059669' : '#9CA3AF' }}>
                                        {b.agreement_signed ? `✓ Signed${b.agreement_signed_at ? ` · ${new Date(b.agreement_signed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}` : '—'}
                                    </strong>
                                </div>
                                {b.razorpay_order_id && (
                                    <div className="bk-modal__row">
                                        <span>Order ID</span>
                                        <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{b.razorpay_order_id}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add-ons */}
                        {(b.addons || []).length > 0 && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">➕ Add-ons</div>
                                <div className="bk-addons">
                                    {b.addons.map((a, i) => (
                                        <div key={i} className="bk-addon-row">
                                            <span>{ADDON_LABELS[a.addon_type] || a.addon_type}</span>
                                            <span>₹{parseFloat(a.price).toLocaleString('en-IN')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Invoice */}
                        {b.invoice && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">🧾 Invoice</div>
                                <div className="bk-modal__rows">
                                    <div className="bk-modal__row">
                                        <span>Invoice Ref</span>
                                        <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{b.invoice.invoice_ref}</strong>
                                    </div>
                                    <div className="bk-modal__row">
                                        <span>Total</span>
                                        <strong className="admin-currency">₹{parseFloat(b.invoice.total_amount).toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div className="bk-modal__row">
                                        <span>Deposit Status</span>
                                        <strong>{b.invoice.deposit_status}</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Timestamps */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🕐 Timeline</div>
                            <div className="bk-modal__rows">
                                <div className="bk-modal__row">
                                    <span>Created</span>
                                    <strong>{new Date(b.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                                </div>
                                <div className="bk-modal__row">
                                    <span>Last Updated</span>
                                    <strong>{new Date(b.updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Vendor Detail Modal ────────────────────────────────────────────────
function VendorDetailModal({ vendor: v, onClose, onAction }) {
    const [note, setNote] = useState(v.admin_note || '');
    const [busy, setBusy] = useState(false);
    const kycStatus = getKYCStatus(v);

    const handleAction = async (action) => {
        setBusy(true);
        await onAction(v.id, action, note);
        setBusy(false);
    };

    const kycdocUrl = v.kyc_document;
    const addressParts = [v.addr_line1, v.addr_line2, v.addr_line3, v.city_name, v.state, v.pincode, v.country].filter(Boolean);

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <div className="admin-modal__head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="admin-vendor-card__avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
                            {v.business_name?.[0]?.toUpperCase() || 'V'}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{v.business_name}</h2>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                <StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} />
                                <span style={{ fontSize: 12, color: 'var(--vm)' }}>{v.email}</span>
                                <span style={{ fontSize: 12, color: 'var(--vm)' }}>{v.phone}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--vm)', fontFamily: 'Inter, sans-serif' }}>✕ Close</button>
                </div>

                {/* KYC Completeness Banner */}
                <div className={`admin-kyc-banner ${kycStatus.complete ? 'admin-kyc-banner--ok' : 'admin-kyc-banner--warn'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{kycStatus.complete ? '✅' : '⚠️'}</span>
                        <div>
                            <strong style={{ fontSize: 13 }}>
                                KYC Status: {kycStatus.done}/{kycStatus.total} items complete
                                {kycStatus.complete ? ' — Ready for Approval' : ' — Incomplete'}
                            </strong>
                            <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                                {[
                                    [kycStatus.checks.identity, 'Identity (Aadhaar/PAN)'],
                                    [kycStatus.checks.bank, 'Bank Details'],
                                    [kycStatus.checks.city, 'City & Address'],
                                    [kycStatus.checks.location, 'Map Pin'],
                                    [kycStatus.checks.document, 'KYC Document'],
                                ].map(([done, label]) => (
                                    <span key={label} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: done ? '#D1FAE5' : '#FEE2E2', color: done ? '#059669' : '#EF4444' }}>
                                        {done ? '✓' : '✗'} {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="admin-modal__body">
                    {/* Left column */}
                    <div className="admin-modal__col">
                        <div className="admin-modal__section-label">Business Info</div>
                        {[
                            ['Business Name', v.business_name],
                            ['GSTIN', v.gstin || '—'],
                            ['Rating', v.rating > 0 ? `⭐ ${v.rating} (${v.total_reviews} reviews)` : 'No reviews yet'],
                            ['Shop Hours', (v.shop_opening_time && v.shop_closing_time) ? `${v.shop_opening_time} – ${v.shop_closing_time}` : '—'],
                            ['Member Since', v.created_at ? new Date(v.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row"><span>{l}</span><strong>{val}</strong></div>
                        ))}

                        <div className="admin-modal__section-label" style={{ marginTop: 16 }}>Contact & Address</div>
                        {[
                            ['Email', v.email],
                            ['Phone', v.phone],
                            ['City', v.city_name || '—'],
                            ['State', v.state || '—'],
                            ['PIN Code', v.pincode || '—'],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row"><span>{l}</span><strong>{val}</strong></div>
                        ))}
                        {addressParts.length > 0 && (
                            <div className="admin-modal__row" style={{ alignItems: 'flex-start' }}>
                                <span>Full Address</span>
                                <strong style={{ textAlign: 'right', fontSize: 12 }}>{addressParts.join(', ')}</strong>
                            </div>
                        )}
                        {v.latitude && v.longitude && (
                            <div className="admin-modal__row">
                                <span>Map Pin</span>
                                <a href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--teal-primary)', fontWeight: 600 }}>
                                    📍 {parseFloat(v.latitude).toFixed(5)}, {parseFloat(v.longitude).toFixed(5)} ↗
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="admin-modal__col">
                        <div className="admin-modal__section-label">Identity & KYC</div>
                        {[
                            ['Aadhaar', v.aadhaar_number ? `••••••${v.aadhaar_number.slice(-4)}` : '—'],
                            ['PAN', v.pan_number || '—'],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row"><span>{l}</span><strong>{val}</strong></div>
                        ))}
                        <div className="admin-modal__row" style={{ alignItems: 'flex-start' }}>
                            <span>KYC Document</span>
                            <KYCDocumentCell url={kycdocUrl} label="KYC Document" />
                        </div>

                        <div className="admin-modal__section-label" style={{ marginTop: 16 }}>Bank Details</div>
                        {[
                            ['Account Name', v.bank_account_name || '—'],
                            ['Account No.', v.bank_account_no ? `••••${v.bank_account_no.slice(-4)}` : '—'],
                            ['IFSC', v.bank_ifsc || '—'],
                        ].map(([l, val]) => (
                            <div key={l} className="admin-modal__row"><span>{l}</span><strong>{val}</strong></div>
                        ))}

                        {v.admin_note && (
                            <>
                                <div className="admin-modal__section-label" style={{ marginTop: 16 }}>Previous Admin Note</div>
                                <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E', fontStyle: 'italic' }}>
                                    {v.admin_note}
                                </div>
                            </>
                        )}

                        <div className="admin-modal__section-label" style={{ marginTop: 16 }}>Action</div>
                        <textarea
                            className="admin-modal__note"
                            placeholder="Add an admin note (optional)…"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                        />
                        <div className="admin-modal__actions">
                            {v.status === 'pending' && (
                                <>
                                    <button
                                        className={`admin-btn admin-btn--success ${!kycStatus.complete ? 'admin-btn--dim' : ''}`}
                                        onClick={() => handleAction('approve')}
                                        disabled={busy}
                                        title={!kycStatus.complete ? 'KYC is not fully complete. You can still approve, but review carefully.' : 'Approve vendor'}
                                    >
                                        {busy ? '…' : '✓ Approve'}
                                        {!kycStatus.complete && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>⚠ KYC incomplete</span>}
                                    </button>
                                    <button className="admin-btn admin-btn--warning" onClick={() => handleAction('more_info')} disabled={busy}>
                                        📋 Request Info
                                    </button>
                                    <button className="admin-btn admin-btn--danger" onClick={() => handleAction('reject')} disabled={busy}>
                                        {busy ? '…' : '✕ Reject'}
                                    </button>
                                </>
                            )}
                            {v.status === 'more_info' && (
                                <>
                                    <button className="admin-btn admin-btn--success" onClick={() => handleAction('approve')} disabled={busy}>{busy ? '…' : '✓ Approve'}</button>
                                    <button className="admin-btn admin-btn--danger" onClick={() => handleAction('reject')} disabled={busy}>{busy ? '…' : '✕ Reject'}</button>
                                </>
                            )}
                            {v.status === 'approved' && (
                                <button className="admin-btn admin-btn--warning" onClick={() => handleAction('suspend')} disabled={busy}>{busy ? '…' : '⚠ Suspend'}</button>
                            )}
                            {(v.status === 'suspended' || v.status === 'rejected') && (
                                <button className="admin-btn admin-btn--success" onClick={() => handleAction('reinstate')} disabled={busy}>{busy ? '…' : '↩ Reinstate'}</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const [tab, setTab] = useState('overview');

    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [vendors, setVendors] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [users, setUsers] = useState([]);
    const [configs, setConfigs] = useState([]);
    const [segments, setSegments] = useState([]);
    const [locations, setLocations] = useState([]);
    const [cities, setCities] = useState([]);
    const [cityPairFees, setCityPairFees] = useState([]);
    const [promos, setPromos] = useState([]);
    const [returnPoints, setReturnPoints] = useState([]);
    const [handovers, setHandovers] = useState([]);
    const [logisticsStats, setLogisticsStats] = useState(null);
    const [network, setNetwork] = useState([]);
    const [vehicleStats, setVehicleStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    const [agreements, setAgreements] = useState([]);
    const [acceptances, setAcceptances] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingVersion, setEditingVersion] = useState(null);
    const [acceptanceFilter, setAcceptanceFilter] = useState('');
    const [agreementFormLoading, setAgreementFormLoading] = useState(false);
    const [agreementForm, setAgreementForm] = useState({
        version_tag: '', title: 'Rental Agreement – Terms & Conditions',
        summary: '', content: '', effective_from: '',
    });

    const [vehicleFilter, setVehicleFilter] = useState('');
    const [docNotes, setDocNotes] = useState({});
    const [certifyForms, setCertifyForms] = useState({});
    const [blacklistReasons, setBlacklistReasons] = useState({});
    const [bookingFilter, setBookingFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [vendorStatusFilter, setVendorStatusFilter] = useState('');
    const [vendorSearch, setVendorSearch] = useState('');

    // Vendor detail modal
    const [selectedVendor, setSelectedVendor] = useState(null);

    // Booking detail modal
    const [selectedBooking, setSelectedBooking] = useState(null);

    // User detail modal
    const [selectedUser, setSelectedUser] = useState(null);

    // Vehicle photos lightbox
    const [vehiclePhotoLightbox, setVehiclePhotoLightbox] = useState(null); // { photos, index }

    const loadTab = useCallback(async (t) => {
        setLoading(true); setError('');
        try {
            if (t === 'overview') {
                const [s, a] = await Promise.all([getAdminStats(), getAdminAnalytics()]);
                setStats(s.data); setAnalytics(a.data);
            } else if (t === 'vendors') {
                const { data } = await getAdminVendors();
                setVendors(data.results || data);
            } else if (t === 'vehicles') {
                const [v, s] = await Promise.all([getAdminVehicles(vehicleFilter || ''), getAdminVehicleStats()]);
                setVehicles(v.data.results || v.data);
                setVehicleStats(s.data);
            } else if (t === 'bookings') {
                const { data } = await getAdminBookings();
                setBookings(data.results || data);
            } else if (t === 'users') {
                const { data } = await getAdminUsers({ role: 'customer' });
                setUsers(data.results || data);
            } else if (t === 'config') {
                const [c, sg] = await Promise.all([getConfigSettings(), getSegmentConfigs()]);
                setConfigs(c.data.results || c.data);
                setSegments(sg.data.results || sg.data);
            } else if (t === 'locations') {
                const [l, c, cp] = await Promise.all([getLocations(), getCities(), getCityPairFees()]);
                setLocations(l.data.results || l.data);
                setCities(c.data.results || c.data);
                setCityPairFees(cp.data.results || cp.data);
            } else if (t === 'logistics') {
                const [h, ls, nw] = await Promise.all([getAdminLogisticsOverview(), getAdminLogisticsStats(), getAdminNetworkList()]);
                setHandovers(h.data.results || h.data);
                setLogisticsStats(ls.data);
                setNetwork(nw.data.results || nw.data);
                const [rp, c] = await Promise.all([getReturnPoints(), getCities()]);
                setReturnPoints(rp.data.results || rp.data);
                setCities(c.data.results || c.data);
            } else if (t === 'promos') {
                const { data } = await getAdminPromos();
                setPromos(data.results || data);
            } else if (t === 'agreements') {
                const [av, ac] = await Promise.all([getAdminAgreementVersions(), getAdminAcceptances()]);
                setAgreements(av.data.results || av.data);
                setAcceptances(ac.data.results || ac.data);
            }
        } catch (e) {
            setError(`Failed to load ${t}: ${e.response?.data?.detail || e.message || 'Unknown error'}`);
        }
        setLoading(false);
    }, [vehicleFilter]);

    useEffect(() => { loadTab(tab); }, [tab, loadTab]);
    useEffect(() => { if (tab === 'vehicles') loadTab('vehicles'); }, [vehicleFilter]);

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleVendorAction = async (id, action, note = '') => {
        try {
            const statusMap = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reinstate: 'approved', more_info: 'more_info' };
            await adminVendorAction(id, action, note);
            setVendors(p => p.map(v => v.id === id ? { ...v, status: statusMap[action] || v.status, admin_note: note } : v));
            setSelectedVendor(prev => prev?.id === id ? { ...prev, status: statusMap[action] || prev.status, admin_note: note } : prev);
        } catch (e) { alert(e.response?.data?.error || 'Action failed.'); }
    };

    const handleDocReview = async (docId, action) => {
        try {
            await reviewDoc(docId, action, docNotes[docId] || '');
            setVehicles(p => p.map(v => ({
                ...v,
                documents: (v.documents || []).map(d => d.id === docId ? { ...d, status: action } : d),
            })));
            setDocNotes(p => ({ ...p, [docId]: '' }));
        } catch { alert('Review failed.'); }
    };

    const handleCertify = async (vehicleId) => {
        const f = certifyForms[vehicleId] || {};
        if (!f.cert_date || !f.odometer_at_cert) { alert('Cert date and odometer required.'); return; }
        const fd = new FormData();
        fd.append('cert_date', f.cert_date);
        fd.append('odometer_at_cert', f.odometer_at_cert);
        if (f.file) fd.append('file', f.file);
        try {
            await certifyVehicle(vehicleId, fd);
            await loadTab('vehicles');
            alert('Vehicle certified → LIVE!');
        } catch (e) { alert(e.response?.data?.error || 'Certification failed.'); }
    };

    const handleBlacklist = async (vehicleId) => {
        const reason = blacklistReasons[vehicleId];
        if (!reason) { alert('Enter a reason.'); return; }
        try {
            await blacklistVehicle(vehicleId, reason);
            setVehicles(p => p.map(v => v.id === vehicleId ? { ...v, status: 'INACTIVE', is_blacklisted: true } : v));
        } catch { alert('Blacklist failed.'); }
    };

    const handleSetVehicleStatus = async (vehicleId, newStatus, note = '') => {
        try {
            const { data } = await setVehicleStatus(vehicleId, newStatus, note);
            setVehicles(p => p.map(v => v.id === vehicleId
                ? { ...v, status: data.new_status, admin_note: note || v.admin_note }
                : v
            ));
        } catch (e) { alert(e.response?.data?.error || 'Status change failed.'); }
    };

    const handleVahanCheck = async (vehicleId) => {
        try {
            const { data } = await vahanCheck(vehicleId);
            alert(`VAHAN: ${data.vahan_result?.message || 'Completed'}. Status: ${data.vehicle_status}`);
            await loadTab('vehicles');
        } catch { alert('VAHAN check failed.'); }
    };

    const handleConfigSave = async (setting) => {
        try { await updateConfigSetting(setting.id, setting.value); alert('Saved.'); }
        catch { alert('Save failed.'); }
    };

    const handleSegmentSave = async (seg) => {
        try {
            await updateSegmentConfig(seg.id, { security_deposit: seg.security_deposit, min_driver_age: seg.min_driver_age, min_rental_days: seg.min_rental_days });
            alert('Segment saved.');
        } catch { alert('Save failed.'); }
    };

    const handleAddCity = async (vals) => {
        setFormLoading(true);
        try { await createCity(vals); await loadTab('locations'); }
        catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteCity = async (id) => {
        if (!window.confirm('Delete this city?')) return;
        try { await deleteCity(id); setCities(p => p.filter(c => c.id !== id)); }
        catch { alert('Delete failed.'); }
    };
    const handleAddLocation = async (vals) => {
        setFormLoading(true);
        try { await createLocation(vals); await loadTab('locations'); }
        catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteLocation = async (id) => {
        if (!window.confirm('Delete this location?')) return;
        try { await deleteLocation(id); setLocations(p => p.filter(l => l.id !== id)); }
        catch { alert('Delete failed.'); }
    };
    const handleAddCityPairFee = async (vals) => {
        setFormLoading(true);
        try { await createCityPairFee(vals); await loadTab('locations'); }
        catch { alert('Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteCityPairFee = async (id) => {
        if (!window.confirm('Delete this fee?')) return;
        try { await deleteCityPairFee(id); setCityPairFees(p => p.filter(f => f.id !== id)); }
        catch { alert('Failed.'); }
    };
    const handleAddPromo = async (vals) => {
        setFormLoading(true);
        try { await createPromo(vals); await loadTab('promos'); }
        catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeletePromo = async (id) => {
        if (!window.confirm('Delete promo?')) return;
        try { await deletePromo(id); setPromos(p => p.filter(x => x.id !== id)); }
        catch { alert('Failed.'); }
    };
    const handleAddReturnPoint = async (vals) => {
        setFormLoading(true);
        try {
            await createReturnPoint(vals);
            const { data } = await getReturnPoints();
            setReturnPoints(data.results || data);
        } catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteReturnPoint = async (id) => {
        if (!window.confirm('Delete return point?')) return;
        try { await deleteReturnPoint(id); setReturnPoints(p => p.filter(r => r.id !== id)); }
        catch { alert('Failed.'); }
    };

    const handleCreateVersion = async (e) => {
        e.preventDefault();
        if (!agreementForm.version_tag || !agreementForm.content) { alert('version_tag and content are required.'); return; }
        setAgreementFormLoading(true);
        try {
            await createAgreementVersion({ ...agreementForm, effective_from: agreementForm.effective_from || new Date().toISOString() });
            await loadTab('agreements');
            setShowCreateForm(false);
            setAgreementForm({ version_tag: '', title: 'Rental Agreement – Terms & Conditions', summary: '', content: '', effective_from: '' });
        } catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed to create version.'); }
        setAgreementFormLoading(false);
    };

    const handleUpdateVersion = async (e) => {
        e.preventDefault();
        if (!editingVersion) return;
        setAgreementFormLoading(true);
        try {
            await updateAgreementVersion(editingVersion.id, { title: editingVersion.title, summary: editingVersion.summary, content: editingVersion.content, effective_from: editingVersion.effective_from });
            await loadTab('agreements');
            setEditingVersion(null);
        } catch (e) {
            alert(e.response?.data?.error || (e.response?.data ? JSON.stringify(e.response.data) : 'Failed to update.'));
        }
        setAgreementFormLoading(false);
    };

    const handleActivateVersion = async (versionId, versionTag) => {
        if (!window.confirm(`Activate ${versionTag}?\n\nAll customers will see this version when signing new rental agreements.`)) return;
        try { await activateAgreementVersion(versionId); await loadTab('agreements'); }
        catch (e) { alert(e.response?.data?.error || 'Failed to activate.'); }
    };

    // ── Filtered lists ─────────────────────────────────────────────────────
    const filteredVendors = vendors.filter(v => {
        const matchStatus = !vendorStatusFilter || v.status === vendorStatusFilter;
        const matchSearch = !vendorSearch || v.business_name?.toLowerCase().includes(vendorSearch.toLowerCase()) || v.email?.toLowerCase().includes(vendorSearch.toLowerCase());
        return matchStatus && matchSearch;
    });

    const filteredBookings = bookings.filter(b =>
        (!bookingFilter || b.status === bookingFilter) &&
        (!searchQuery || b.booking_ref?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    // Users tab is customers-only — admins/vendors are managed elsewhere
    const filteredUsers = users.filter(u =>
        u.role === 'customer' &&
        (!searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.phone?.includes(searchQuery))
    );
    const filteredAcceptances = acceptances.filter(a =>
        !acceptanceFilter || String(a.agreement_version_id) === acceptanceFilter || a.version_tag === agreements.find(v => String(v.id) === acceptanceFilter)?.version_tag
    );

    const TAB_LABELS = { overview: 'Overview', vendors: 'Vendors', vehicles: 'Vehicles', bookings: 'Bookings', users: 'Users', locations: 'Locations', logistics: 'Logistics', config: 'Config', promos: 'Promos', agreements: 'Agreements' };

    return (
        <div className="admin-dash">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />

            {selectedVendor && (
                <VendorDetailModal
                    vendor={selectedVendor}
                    onClose={() => setSelectedVendor(null)}
                    onAction={handleVendorAction}
                />
            )}

            {selectedBooking && (
                <BookingDetailModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                />
            )}

            {selectedUser && (
                <UserDetailModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                />
            )}

            {vehiclePhotoLightbox && (
                <PhotoLightbox
                    photos={vehiclePhotoLightbox.photos}
                    initialIndex={vehiclePhotoLightbox.index}
                    onClose={() => setVehiclePhotoLightbox(null)}
                />
            )}

            <div className="page-shell">
                <div className="admin-dash__inner">
                    {/* Hero */}
                    <div className="admin-dash__hero">
                        <div className="admin-dash__hero-banner" />
                        <div className="admin-dash__hero-body">
                            <div className="admin-dash__hero-left">
                                <div className="admin-dash__hero-icon">⚙️</div>
                                <div className="admin-dash__hero-info">
                                    <div className="admin-dash__hero-title">Control Centre</div>
                                    <div className="admin-dash__hero-sub">Vendors · Vehicles · Bookings · Locations · Logistics · Config</div>
                                </div>
                            </div>
                            {stats && (
                                <div className="cd__kpis">
                                    {[
                                        [stats.total_users, 'Users', '#1D4ED8'],
                                        [stats.total_vendors, 'Vendors', '#0DB89E'],
                                        [stats.pending_vendors, 'Pending', '#D97706'],
                                        [stats.total_vehicles, 'Vehicles', '#059669'],
                                        [stats.total_bookings, 'Bookings', '#6B7280'],
                                        [stats.active_bookings, 'Active', '#059669'],
                                    ].map(([v, l, color]) => (
                                        <div key={l} className="cd__kpi">
                                            <span className="cd__kpi-val" style={{ color }}>{v ?? '—'}</span>
                                            <span className="cd__kpi-lbl">{l}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="admin-sec-hd">
                        <h2>{TAB_LABELS[tab]}</h2>
                    </div>

                    {loading && (
                        <div className="admin-loading">
                            <div className="admin-loading__spinner" />
                            <span>Loading {tab}…</span>
                        </div>
                    )}
                    {error && (
                        <div className="admin-error">
                            <span>⚠ {error}</span>
                            <button onClick={() => loadTab(tab)}>↺ Retry</button>
                        </div>
                    )}

                    {/* ════ OVERVIEW ════ */}
                    {!loading && tab === 'overview' && analytics && (
                        <div className="admin-section">
                            <div className="admin-kpi-grid">
                                {[
                                    ['💰', 'Total Revenue', `₹${parseFloat(analytics.total_revenue || 0).toLocaleString('en-IN')}`, '#0DB89E'],
                                    ['🏦', 'Platform Commission', `₹${parseFloat(analytics.platform_revenue || 0).toLocaleString('en-IN')}`, '#8B5CF6'],
                                    ['📋', 'Total Bookings', analytics.total_bookings, '#3B82F6'],
                                ].map(([icon, label, value, color]) => (
                                    <div key={label} className="admin-kpi-card">
                                        <div className="admin-kpi-card__icon" style={{ background: `${color}15`, color }}>{icon}</div>
                                        <div><p>{label}</p><h2 style={{ color }}>{value ?? '—'}</h2></div>
                                    </div>
                                ))}
                            </div>
                            <div className="admin-two-col">
                                {analytics.city_demand?.length > 0 && (
                                    <SectionCard title="City-wise Demand" subtitle="Top performing cities">
                                        <div className="admin-data-table">
                                            <div className="admin-data-table__header"><span>City</span><span>Bookings</span><span>Revenue</span></div>
                                            {analytics.city_demand.map((c, i) => (
                                                <div key={c.city} className="admin-data-table__row">
                                                    <span><span className="admin-rank">#{i + 1}</span> {c.city}</span>
                                                    <span><span className="admin-badge admin-badge--blue">{c.count}</span></span>
                                                    <span className="admin-currency">₹{parseFloat(c.revenue || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                                {analytics.vendor_league?.length > 0 && (
                                    <SectionCard title="Top Vendors" subtitle="By total revenue">
                                        <div className="admin-data-table">
                                            <div className="admin-data-table__header"><span>Vendor</span><span>Bookings</span><span>Revenue</span></div>
                                            {analytics.vendor_league.map((v, i) => (
                                                <div key={v.vendor_id} className="admin-data-table__row">
                                                    <span><span className="admin-rank">#{i + 1}</span> {v.name}</span>
                                                    <span><span className="admin-badge admin-badge--blue">{v.count}</span></span>
                                                    <span className="admin-currency">₹{parseFloat(v.revenue || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                            </div>
                            {analytics.monthly_trend?.length > 0 && (
                                <SectionCard title="Monthly Booking Trend">
                                    <div className="admin-trend-chart">
                                        {analytics.monthly_trend.map(m => {
                                            const maxCount = Math.max(...analytics.monthly_trend.map(x => x.count));
                                            const pct = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                                            return (
                                                <div key={m.month} className="admin-trend-bar-wrap">
                                                    <div className="admin-trend-bar-track"><div className="admin-trend-bar" style={{ height: `${pct}%` }} title={`₹${parseFloat(m.revenue || 0).toLocaleString('en-IN')}`} /></div>
                                                    <span>{m.month?.slice(5)}</span>
                                                    <span className="admin-trend-count">{m.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            )}
                        </div>
                    )}

                    {/* ════ VENDORS ════ */}
                    {!loading && tab === 'vendors' && (
                        <div className="admin-section">
                            <div className="cd-filter-bar cd-filter-bar--dropdown">
                                <input
                                    className="admin-search-input"
                                    placeholder="Search by name or email…"
                                    value={vendorSearch}
                                    onChange={e => setVendorSearch(e.target.value)}
                                />
                                <FilterDropdown
                                    label="Status"
                                    value={vendorStatusFilter}
                                    onChange={setVendorStatusFilter}
                                    options={[
                                        { value: '', label: 'All Vendors' },
                                        { value: 'pending', label: 'Pending', color: '#D97706' },
                                        { value: 'approved', label: 'Approved', color: '#059669' },
                                        { value: 'more_info', label: 'More Info Needed', color: '#7C3AED' },
                                        { value: 'rejected', label: 'Rejected', color: '#EF4444' },
                                        { value: 'suspended', label: 'Suspended', color: '#EF4444' },
                                    ]}
                                />
                                {vendorStatusFilter && <button className="cd-filter-clear" onClick={() => setVendorStatusFilter('')}>✕ Clear</button>}
                                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vm)', fontWeight: 600 }}>
                                    {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {filteredVendors.length === 0 ? <EmptyState icon="🏪" message="No vendors found." /> : (
                                <div className="admin-card-list">
                                    {filteredVendors.map(v => {
                                        const kyc = getKYCStatus(v);
                                        return (
                                            <div key={v.id} className="admin-vendor-card admin-vendor-card--clickable" onClick={() => setSelectedVendor(v)}>
                                                <div className="admin-vendor-card__left">
                                                    <div className="admin-vendor-card__avatar">
                                                        {v.business_name?.[0]?.toUpperCase() || 'V'}
                                                    </div>
                                                    <div>
                                                        <strong>{v.business_name}</strong>
                                                        <span>{v.email}</span>
                                                        <span>{v.phone}</span>
                                                        {v.city_name && <span style={{ fontSize: 11, color: 'var(--vm)' }}>📍 {v.city_name}{v.state ? `, ${v.state}` : ''}</span>}
                                                    </div>
                                                </div>
                                                <div className="admin-vendor-card__meta">
                                                    <div><span className="admin-meta-label">GSTIN</span><span>{v.gstin || '—'}</span></div>
                                                    <div><span className="admin-meta-label">Rating</span><span>{v.rating > 0 ? `⭐ ${v.rating}` : 'No reviews'}</span></div>
                                                    <div>
                                                        <span className="admin-meta-label">KYC</span>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: kyc.complete ? '#059669' : '#D97706' }}>
                                                            {kyc.done}/{kyc.total} {kyc.complete ? '✓ Complete' : '⚠ Incomplete'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="admin-meta-label">Doc</span>
                                                        {v.kyc_document ? (
                                                            <KYCDocumentCell url={v.kyc_document} label="KYC" />
                                                        ) : (
                                                            <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 600 }}>Not uploaded</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="admin-vendor-card__right" onClick={e => e.stopPropagation()}>
                                                    <StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} />
                                                    {v.admin_note && (
                                                        <div style={{ fontSize: 11, color: '#D97706', fontStyle: 'italic', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            📋 {v.admin_note}
                                                        </div>
                                                    )}
                                                    <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setSelectedVendor(v)}>
                                                        View Details →
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ VEHICLES ════ */}
                    {!loading && tab === 'vehicles' && (
                        <div className="admin-section">
                            {/* Stats strip */}
                            {vehicleStats && (
                                <div className="admin-stats-row">
                                    {Object.entries(vehicleStats).map(([s, count]) => {
                                        const vc = VEHICLE_STATUS_CLR[s] || { color: '#9CA3AF' };
                                        return (
                                            <div
                                                key={s}
                                                className="admin-mini-stat"
                                                style={{ borderColor: vc.color + '60', cursor: 'pointer', outline: vehicleFilter === s ? `2px solid ${vc.color}` : 'none' }}
                                                onClick={() => setVehicleFilter(prev => prev === s ? '' : s)}
                                                title={`Filter by ${s}`}
                                            >
                                                <span style={{ color: vc.color, fontWeight: 800, fontSize: 17 }}>{count}</span>
                                                <span>{s.replace(/_/g, ' ')}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Filter bar */}
                            <div className="cd-filter-bar cd-filter-bar--dropdown">
                                <span className="cd-filter-lbl">Status:</span>
                                <FilterDropdown
                                    label="Vehicle Status"
                                    value={vehicleFilter}
                                    onChange={setVehicleFilter}
                                    options={[
                                        { value: '', label: 'All Vehicles' },
                                        { value: 'PENDING_DOCS', label: 'Pending Docs', color: '#D97706' },
                                        { value: 'DOCS_SUBMITTED', label: 'Docs Submitted', color: '#1D4ED8' },
                                        { value: 'ADMIN_APPROVED', label: 'Admin Approved', color: '#7C3AED' },
                                        { value: 'LIVE', label: 'Live', color: '#059669' },
                                        { value: 'INACTIVE', label: 'Inactive', color: '#EF4444' },
                                    ]}
                                />
                                {vehicleFilter && <button className="cd-filter-clear" onClick={() => setVehicleFilter('')}>✕ Clear</button>}
                                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--vm)', fontWeight: 600 }}>
                                    {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {vehicles.length === 0 ? (
                                <EmptyState icon="🚗" message={`No vehicles with status: ${vehicleFilter || 'All'}`} />
                            ) : (
                                <div className="admin-card-list">
                                    {vehicles.map(v => {
                                        // ── Build the full required-doc manifest ──────────────────────
                                        // rc, insurance, puc are REQUIRED; fitness is optional vendor doc
                                        const REQUIRED_DOCS = [
                                            { key: 'rc',       label: 'RC Book',          required: true },
                                            { key: 'insurance',label: 'Insurance',         required: true },
                                            { key: 'puc',      label: 'PUC Certificate',  required: true },
                                            { key: 'fitness',  label: 'Fitness Cert',     required: false },
                                        ];
                                        // mechanic_cert is admin-uploaded — show separately in certify panel
                                        const uploadedDocs = v.documents || [];
                                        const docMap = Object.fromEntries(uploadedDocs.map(d => [d.doc_type, d]));

                                        const requiredApproved = ['rc', 'insurance', 'puc'].every(
                                            key => docMap[key]?.status === 'approved'
                                        );
                                        const photoCount = (v.photos || []).length;
                                        const photosOk = photoCount >= 10;

                                        // ── Status pipeline steps ─────────────────────────────────────
                                        const PIPELINE = [
                                            { status: 'PENDING_DOCS',   label: 'Pending Docs',   step: 1 },
                                            { status: 'DOCS_SUBMITTED', label: 'Docs Submitted', step: 2 },
                                            { status: 'ADMIN_APPROVED', label: 'Admin Approved', step: 3 },
                                            { status: 'LIVE',           label: 'Live',           step: 4 },
                                        ];
                                        const currentStep = PIPELINE.find(p => p.status === v.status)?.step ?? 0;

                                        return (
                                            <div key={v.id} className="admin-vehicle-card vcard-v2">

                                                {/* ── Card header ─────────────────────────────────── */}
                                                <div className="vcard-v2__head">
                                                    <div className="vcard-v2__identity">
                                                        <div className="vcard-v2__title">
                                                            {v.year} {v.make} {v.model}
                                                        </div>
                                                        <div className="vcard-v2__meta">
                                                            <span className="vcard-v2__plate">{v.plate_number}</span>
                                                            <span className="vcard-v2__sep">·</span>
                                                            <span>{v.vendor?.vendor_profile?.business_name || v.vendor?.email}</span>
                                                            <span className="vcard-v2__sep">·</span>
                                                            <span>{v.city?.name}</span>
                                                            <span className="vcard-v2__sep">·</span>
                                                            <span style={{ textTransform: 'capitalize' }}>{v.segment}</span>
                                                            <span className="vcard-v2__sep">·</span>
                                                            <span>₹{parseInt(v.daily_rate || 0).toLocaleString('en-IN')}/day</span>
                                                        </div>
                                                    </div>
                                                    <div className="vcard-v2__badges">
                                                        <StatusBadge status={v.status} colorMap={VEHICLE_STATUS_CLR} />
                                                        {v.is_blacklisted && <span className="admin-blacklisted-badge">🚫 Blacklisted</span>}
                                                        {v.is_certified && <span className="admin-certified-badge">✅ Certified</span>}
                                                    </div>
                                                </div>

                                                {/* ── Pipeline progress bar ────────────────────────── */}
                                                {v.status !== 'INACTIVE' && (
                                                    <div className="vcard-pipeline">
                                                        {PIPELINE.map((step, idx) => {
                                                            const done = step.step < currentStep;
                                                            const active = step.step === currentStep;
                                                            return (
                                                                <React.Fragment key={step.status}>
                                                                    <div className={`vcard-pipeline__step ${done ? 'done' : active ? 'active' : 'future'}`}>
                                                                        <div className="vcard-pipeline__dot">
                                                                            {done ? '✓' : step.step}
                                                                        </div>
                                                                        <span>{step.label}</span>
                                                                    </div>
                                                                    {idx < PIPELINE.length - 1 && (
                                                                        <div className={`vcard-pipeline__line ${done ? 'done' : ''}`} />
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* ── Two-column body ──────────────────────────────── */}
                                                <div className="vcard-v2__body">

                                                    {/* LEFT: Document checklist */}
                                                    <div className="vcard-v2__docs-col">
                                                        <div className="vcard-v2__col-hd">
                                                            <span>📄 Documents</span>
                                                            <span className="vcard-v2__col-sub">
                                                                {uploadedDocs.filter(d => d.status === 'approved').length}/{uploadedDocs.length} approved
                                                            </span>
                                                        </div>

                                                        {/* Required doc checklist — always show all slots */}
                                                        <div className="vcard-doclist">
                                                            {REQUIRED_DOCS.map(({ key, label, required }) => {
                                                                const doc = docMap[key];
                                                                const notUploaded = !doc;
                                                                const statusColor = doc
                                                                    ? doc.status === 'approved' ? '#059669'
                                                                    : doc.status === 'rejected' ? '#EF4444'
                                                                    : '#D97706'
                                                                    : '#9CA3AF';
                                                                const statusBg = doc
                                                                    ? doc.status === 'approved' ? '#D1FAE5'
                                                                    : doc.status === 'rejected' ? '#FEE2E2'
                                                                    : '#FEF3C7'
                                                                    : '#F3F4F6';
                                                                return (
                                                                    <div key={key} className="vcard-doclist__row">
                                                                        {/* Status indicator */}
                                                                        <div className="vcard-doclist__indicator" style={{ background: statusBg, color: statusColor }}>
                                                                            {notUploaded ? '—' : doc.status === 'approved' ? '✓' : doc.status === 'rejected' ? '✕' : '⏳'}
                                                                        </div>

                                                                        {/* Label */}
                                                                        <div className="vcard-doclist__info">
                                                                            <span className="vcard-doclist__name">
                                                                                {label}
                                                                                {required && <span className="vcard-doclist__req">*</span>}
                                                                            </span>
                                                                            {notUploaded ? (
                                                                                <span className="vcard-doclist__missing">Not uploaded</span>
                                                                            ) : (
                                                                                <span className="vcard-doclist__status" style={{ color: statusColor }}>
                                                                                    {doc.status}
                                                                                    {doc.expiry_date && ` · exp ${doc.expiry_date}`}
                                                                                </span>
                                                                            )}
                                                                            {doc?.admin_note && (
                                                                                <span className="vcard-doclist__note">📋 {doc.admin_note}</span>
                                                                            )}
                                                                        </div>

                                                                        {/* Preview thumbnail / link */}
                                                                        {doc?.file && (
                                                                            <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                                                                <DocPreviewRow doc={doc} />
                                                                            </div>
                                                                        )}

                                                                        {/* Review actions */}
                                                                        {doc && (
                                                                            <div className="admin-doc-actions" style={{ flexShrink: 0 }}>
                                                                                <input
                                                                                    className="admin-doc-note-input"
                                                                                    placeholder="Note…"
                                                                                    value={docNotes[doc.id] || ''}
                                                                                    onChange={e => setDocNotes(p => ({ ...p, [doc.id]: e.target.value }))}
                                                                                />
                                                                                {doc.status !== 'approved' && (
                                                                                    <button className="admin-btn admin-btn--xs admin-btn--success" onClick={() => handleDocReview(doc.id, 'approve')} title="Approve">✓</button>
                                                                                )}
                                                                                {doc.status !== 'rejected' && (
                                                                                    <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDocReview(doc.id, 'reject')} title="Reject">✕</button>
                                                                                )}
                                                                                {doc.status !== 'pending' && (
                                                                                    <button className="admin-btn admin-btn--xs admin-btn--ghost" onClick={() => handleDocReview(doc.id, 'reset')} title="Reset to pending">↺</button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Any extra vendor-uploaded docs (fitness, etc.) not in REQUIRED_DOCS list */}
                                                            {uploadedDocs
                                                                .filter(d => !REQUIRED_DOCS.find(r => r.key === d.doc_type) && d.doc_type !== 'mechanic_cert')
                                                                .map(doc => (
                                                                    <div key={doc.id} className="vcard-doclist__row">
                                                                        <div className="vcard-doclist__indicator" style={{
                                                                            background: doc.status === 'approved' ? '#D1FAE5' : doc.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                                                                            color: doc.status === 'approved' ? '#059669' : doc.status === 'rejected' ? '#EF4444' : '#D97706'
                                                                        }}>
                                                                            {doc.status === 'approved' ? '✓' : doc.status === 'rejected' ? '✕' : '⏳'}
                                                                        </div>
                                                                        <div className="vcard-doclist__info">
                                                                            <span className="vcard-doclist__name">{doc.doc_type.replace(/_/g, ' ')}</span>
                                                                            <span className="vcard-doclist__status">{doc.status}</span>
                                                                        </div>
                                                                        <div style={{ marginLeft: 'auto' }}><DocPreviewRow doc={doc} /></div>
                                                                        <div className="admin-doc-actions" style={{ flexShrink: 0 }}>
                                                                            <input className="admin-doc-note-input" placeholder="Note…" value={docNotes[doc.id] || ''} onChange={e => setDocNotes(p => ({ ...p, [doc.id]: e.target.value }))} />
                                                                            {doc.status !== 'approved' && <button className="admin-btn admin-btn--xs admin-btn--success" onClick={() => handleDocReview(doc.id, 'approve')} title="Approve">✓</button>}
                                                                            {doc.status !== 'rejected' && <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDocReview(doc.id, 'reject')} title="Reject">✕</button>}
                                                                            {doc.status !== 'pending' && <button className="admin-btn admin-btn--xs admin-btn--ghost" onClick={() => handleDocReview(doc.id, 'reset')} title="Reset">↺</button>}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>

                                                        {/* Photo count pill */}
                                                        <div className="vcard-photo-pill" style={{ borderColor: photosOk ? '#6EE7B7' : '#FCD34D', color: photosOk ? '#059669' : '#D97706', background: photosOk ? '#D1FAE5' : '#FEF3C7' }}>
                                                            📷 {photoCount} photo{photoCount !== 1 ? 's' : ''} uploaded
                                                            <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>(min 10 required)</span>
                                                            {photosOk ? ' ✓' : ' ⚠'}
                                                        </div>

                                                        {/* Photo strip */}
                                                        {(v.photos || []).length > 0 && (
                                                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                                                                {v.photos.map((ph, idx) => (
                                                                    <div key={ph.id} onClick={() => setVehiclePhotoLightbox({ photos: v.photos, index: idx })}
                                                                        style={{ position: 'relative', cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: `2px solid ${ph.is_cover ? 'var(--teal-primary)' : 'var(--vbdr)'}` }}
                                                                        title={ph.angle + (ph.is_cover ? ' (cover)' : '')}>
                                                                        <img src={ph.image} alt={ph.angle} style={{ width: 60, height: 46, objectFit: 'cover', display: 'block' }} />
                                                                        {ph.is_cover && <span style={{ position: 'absolute', bottom: 1, left: 2, fontSize: 7, fontWeight: 700, background: 'var(--teal-primary)', color: '#fff', padding: '1px 3px', borderRadius: 2 }}>COVER</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* RIGHT: Admin actions */}
                                                    <div className="vcard-v2__actions-col">

                                                        {/* ── STATUS OVERRIDE DROPDOWN ─────────────── */}
                                                        <div className="vcard-action-block">
                                                            <div className="vcard-action-block__hd">🔄 Change Status</div>
                                                            <div className="vcard-status-override">
                                                                <select
                                                                    className="vcard-status-select"
                                                                    value={v.status}
                                                                    onChange={e => {
                                                                        const newSt = e.target.value;
                                                                        if (newSt === v.status) return;
                                                                        const note = window.prompt(`Optional: add an admin note for this status change (${v.status} → ${newSt}):`, '') ?? '';
                                                                        handleSetVehicleStatus(v.id, newSt, note);
                                                                    }}
                                                                    style={{
                                                                        borderColor: VEHICLE_STATUS_CLR[v.status]?.color + '80' || 'var(--vbdr2)',
                                                                        color: VEHICLE_STATUS_CLR[v.status]?.color || 'var(--vt)',
                                                                        background: VEHICLE_STATUS_CLR[v.status]?.bg || 'var(--vs2)',
                                                                    }}
                                                                >
                                                                    <option value="PENDING_DOCS">⏳ Pending Docs</option>
                                                                    <option value="DOCS_SUBMITTED">📄 Docs Submitted</option>
                                                                    <option value="ADMIN_APPROVED">✅ Admin Approved</option>
                                                                    <option value="LIVE">🟢 Live</option>
                                                                    <option value="INACTIVE">🔴 Inactive</option>
                                                                </select>
                                                                <div className="vcard-status-hint">
                                                                    Auto-pipeline: all 3 required docs approved → ADMIN_APPROVED → certify → LIVE
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ── CERTIFICATION (only when ADMIN_APPROVED) ── */}
                                                        {v.status === 'ADMIN_APPROVED' && (
                                                            <div className="vcard-action-block vcard-action-block--cert">
                                                                <div className="vcard-action-block__hd">🔧 Mechanic Certification</div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                    <div className="admin-form-field">
                                                                        <label>Certification Date</label>
                                                                        <input type="date" onChange={e => setCertifyForms(p => ({ ...p, [v.id]: { ...(p[v.id] || {}), cert_date: e.target.value } }))} />
                                                                    </div>
                                                                    <div className="admin-form-field">
                                                                        <label>Current Odometer (km)</label>
                                                                        <input type="number" placeholder="e.g. 24500" onChange={e => setCertifyForms(p => ({ ...p, [v.id]: { ...(p[v.id] || {}), odometer_at_cert: e.target.value } }))} />
                                                                    </div>
                                                                    <div className="admin-form-field">
                                                                        <label>Cert Report (PDF / Image)</label>
                                                                        <input type="file" accept=".pdf,.jpg,.png" onChange={e => setCertifyForms(p => ({ ...p, [v.id]: { ...(p[v.id] || {}), file: e.target.files[0] } }))} />
                                                                    </div>
                                                                    <button
                                                                        className="admin-btn admin-btn--success"
                                                                        style={{ width: '100%', justifyContent: 'center' }}
                                                                        onClick={() => handleCertify(v.id)}
                                                                        disabled={!requiredApproved}
                                                                        title={!requiredApproved ? 'All 3 required docs must be approved first' : 'Certify and set vehicle LIVE'}
                                                                    >
                                                                        ✓ Certify &amp; Set LIVE
                                                                        {!requiredApproved && <span style={{ fontSize: 9, marginLeft: 6, opacity: 0.7 }}>⚠ docs pending</span>}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* ── VAHAN CHECK ──────────────────────────── */}
                                                        <div className="vcard-action-block">
                                                            <div className="vcard-action-block__hd">🔍 VAHAN Verification</div>
                                                            <button className="admin-btn admin-btn--ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleVahanCheck(v.id)}>
                                                                Run VAHAN Check
                                                            </button>
                                                            {v.is_certified && v.cert_expiry_date && (
                                                                <div style={{ fontSize: 11, color: 'var(--vm)', marginTop: 6 }}>
                                                                    Cert expires: <strong>{v.cert_expiry_date}</strong>
                                                                    {v.cert_expiry_km && <> · <strong>{v.cert_expiry_km.toLocaleString('en-IN')} km</strong></>}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* ── BLACKLIST ─────────────────────────────── */}
                                                        {!v.is_blacklisted ? (
                                                            <div className="vcard-action-block vcard-action-block--danger">
                                                                <div className="vcard-action-block__hd">🚫 Blacklist Vehicle</div>
                                                                <input
                                                                    className="admin-note-input"
                                                                    placeholder="Reason for blacklisting…"
                                                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                                                    value={blacklistReasons[v.id] || ''}
                                                                    onChange={e => setBlacklistReasons(p => ({ ...p, [v.id]: e.target.value }))}
                                                                />
                                                                <button className="admin-btn admin-btn--danger" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={() => handleBlacklist(v.id)}>
                                                                    Blacklist &amp; Deactivate
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="vcard-action-block" style={{ background: '#FEE2E2', borderColor: '#FCA5A5' }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>🚫 Blacklisted</div>
                                                                <div style={{ fontSize: 11, color: '#7F1D1D' }}>{v.blacklist_reason || 'No reason recorded.'}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ BOOKINGS ════ */}
                    {!loading && tab === 'bookings' && (
                        <div className="admin-section">
                            <div className="cd-filter-bar cd-filter-bar--dropdown">
                                <input
                                    className="admin-search-input"
                                    placeholder="Search by ref, customer name or email…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <FilterDropdown
                                    label="Status"
                                    value={bookingFilter}
                                    onChange={setBookingFilter}
                                    options={[
                                        { value: '', label: 'All Bookings' },
                                        { value: 'PENDING', label: 'Pending', color: '#D97706' },
                                        { value: 'CONFIRMED', label: 'Confirmed', color: '#1D4ED8' },
                                        { value: 'ACTIVE', label: 'Active', color: '#059669' },
                                        { value: 'COMPLETED', label: 'Completed', color: '#6B7280' },
                                        { value: 'CANCELLED', label: 'Cancelled', color: '#EF4444' },
                                    ]}
                                />
                                {bookingFilter && <button className="cd-filter-clear" onClick={() => setBookingFilter('')}>✕ Clear</button>}
                                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--vm)', fontWeight: 600 }}>
                                    {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {filteredBookings.length === 0 ? (
                                <EmptyState icon="📋" message="No bookings found." />
                            ) : (
                                <div className="admin-card-list">
                                    {filteredBookings.map(b => {
                                        const ps = b.pricing_snapshot || {};
                                        const pymtColor = !b.payment_captured ? '#EF4444'
                                            : ps.full_payment_paid ? '#059669'
                                            : '#D97706';
                                        const pymtLabel = !b.payment_captured ? 'Unpaid'
                                            : ps.full_payment_paid ? 'Fully Paid'
                                            : 'Advance Paid';

                                        return (
                                            <div
                                                key={b.id}
                                                className="bk-card"
                                                onClick={() => setSelectedBooking(b)}
                                            >
                                                {/* Row 1 – Ref + Status badges */}
                                                <div className="bk-card__top">
                                                    <div className="bk-card__refs">
                                                        <span className="bk-card__ref">{b.booking_ref}</span>
                                                        <StatusBadge status={b.status} colorMap={BOOKING_STATUS_CLR} size="sm" />
                                                        <span className="bk-card__pay-pill" style={{ color: pymtColor, borderColor: pymtColor + '50', background: pymtColor + '12' }}>
                                                            {pymtLabel}
                                                        </span>
                                                        {b.is_one_way && (
                                                            <span className="bk-card__tag" style={{ background: '#EDE9FE', color: '#7C3AED' }}>ONE-WAY</span>
                                                        )}
                                                        {b.agreement_signed && (
                                                            <span className="bk-card__tag" style={{ background: '#D1FAE5', color: '#059669' }}>✍ Signed</span>
                                                        )}
                                                    </div>
                                                    <span className="bk-card__created">
                                                        {new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>

                                                {/* Row 2 – Core info grid */}
                                                <div className="bk-card__grid">
                                                    {/* Customer */}
                                                    <div className="bk-card__cell">
                                                        <span className="bk-card__cell-lbl">Customer</span>
                                                        <strong>{b.customer_name || '—'}</strong>
                                                        <span>{b.customer_email}</span>
                                                        {b.customer_phone && <span>{b.customer_phone}</span>}
                                                    </div>

                                                    {/* Vehicle + Vendor */}
                                                    <div className="bk-card__cell">
                                                        <span className="bk-card__cell-lbl">Vehicle</span>
                                                        <strong>{b.vehicle_display || '—'}</strong>
                                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                                                            {b.vehicle?.plate_number || '—'}
                                                        </span>
                                                        <span style={{ color: 'var(--vm)', fontSize: 11 }}>
                                                            {b.vendor_name || b.vendor?.vendor_profile?.business_name || '—'}
                                                        </span>
                                                    </div>

                                                    {/* Trip Dates */}
                                                    <div className="bk-card__cell">
                                                        <span className="bk-card__cell-lbl">Trip</span>
                                                        <strong>
                                                            {b.pickup_date}
                                                            {b.pickup_time ? ` ${b.pickup_time}` : ''}
                                                        </strong>
                                                        <span style={{ color: 'var(--vm)', fontSize: 11 }}>→</span>
                                                        <strong>
                                                            {b.return_date}
                                                            {b.return_time ? ` ${b.return_time}` : ''}
                                                        </strong>
                                                        <span style={{ color: 'var(--teal-primary)', fontSize: 11, fontWeight: 600 }}>
                                                            {b.rental_days} day{b.rental_days !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>

                                                    {/* Locations */}
                                                    <div className="bk-card__cell">
                                                        <span className="bk-card__cell-lbl">Locations</span>
                                                        <strong style={{ fontSize: 11 }}>
                                                            📍 {b.pickup_location_detail?.name || '—'}
                                                        </strong>
                                                        {b.is_one_way && (
                                                            <strong style={{ fontSize: 11 }}>
                                                                🏁 {b.return_location_detail?.name || '—'}
                                                            </strong>
                                                        )}
                                                    </div>

                                                    {/* Amount */}
                                                    <div className="bk-card__cell bk-card__cell--amount">
                                                        <span className="bk-card__cell-lbl">Total</span>
                                                        <strong className="bk-card__amount">₹{parseFloat(b.total_amount || 0).toLocaleString('en-IN')}</strong>
                                                        {ps.advance_amount && (
                                                            <span style={{ fontSize: 10, color: 'var(--vm)' }}>
                                                                Adv: ₹{parseFloat(ps.advance_amount).toLocaleString('en-IN')}
                                                            </span>
                                                        )}
                                                        <span style={{ fontSize: 10, color: 'var(--vm)' }}>
                                                            Dep: ₹{parseFloat(b.deposit_amount || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>

                                                    {/* Status flags */}
                                                    <div className="bk-card__cell">
                                                        <span className="bk-card__cell-lbl">Flags</span>
                                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                                                            <span className={`bk-flag ${b.payment_captured ? 'on' : 'off'}`}>💳 Paid</span>
                                                            <span className={`bk-flag ${b.deposit_held ? 'on' : 'off'}`}>🔒 Dep</span>
                                                            <span className={`bk-flag ${b.agreement_signed ? 'on' : 'off'}`}>✍ Agr</span>
                                                            <span className={`bk-flag ${b.deposit_released ? 'on' : 'off'}`}>🔓 Rel</span>
                                                        </div>
                                                        {(b.addons || []).length > 0 && (
                                                            <span style={{ fontSize: 10, color: 'var(--vm)', marginTop: 3 }}>
                                                                +{b.addons.length} add-on{b.addons.length !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* View details CTA */}
                                                <div className="bk-card__footer">
                                                    <span className="bk-card__view-link">View full details →</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ USERS ════ */}
                    {!loading && tab === 'users' && (
                        <div className="admin-section">
                            <div className="cd-filter-bar cd-filter-bar--dropdown">
                                <input
                                    className="admin-search-input"
                                    placeholder="Search by name, email or phone…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--vm)', fontWeight: 600 }}>
                                    {filteredUsers.length} customer{filteredUsers.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {filteredUsers.length === 0 ? (
                                <EmptyState icon="👤" message="No customers found." />
                            ) : (
                                <div className="user-card-grid">
                                    {filteredUsers.map(u => {
                                        const kyc = KYC_STATUS_CLR[u.kyc_status] || KYC_STATUS_CLR.pending;
                                        const hasProfile = u.loyalty_points !== undefined;
                                        const dlExpired = u.dl_expiry && new Date(u.dl_expiry) < new Date();

                                        return (
                                            <div
                                                key={u.id}
                                                className="user-card"
                                                onClick={() => setSelectedUser(u)}
                                            >
                                                {/* Card header */}
                                                <div className="user-card__head">
                                                    <div className="user-card__avatar">
                                                        {u.full_name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="user-card__identity">
                                                        <strong>{u.full_name || '—'}</strong>
                                                        <span>{u.email}</span>
                                                        <span>{u.phone || '—'}</span>
                                                    </div>
                                                    <div className="user-card__kyc-badge" style={{ color: kyc.color, background: kyc.bg }}>
                                                        KYC {u.kyc_status || 'pending'}
                                                    </div>
                                                </div>

                                                {/* Stats row */}
                                                {hasProfile && (
                                                    <div className="user-card__stats">
                                                        <div className="user-card__stat">
                                                            <span style={{ color: '#D97706', fontWeight: 800 }}>
                                                                {(u.loyalty_points || 0).toLocaleString('en-IN')}
                                                            </span>
                                                            <span>Points</span>
                                                        </div>
                                                        <div className="user-card__stat">
                                                            <span style={{ color: '#1D4ED8', fontWeight: 800 }}>
                                                                {u.total_bookings ?? 0}
                                                            </span>
                                                            <span>Bookings</span>
                                                        </div>
                                                        <div className="user-card__stat">
                                                            <span style={{ color: '#059669', fontWeight: 800 }}>
                                                                {u.active_bookings ?? 0}
                                                            </span>
                                                            <span>Active</span>
                                                        </div>
                                                        <div className="user-card__stat">
                                                            <span style={{ color: u.date_of_birth ? 'var(--vt)' : 'var(--vm)', fontWeight: 700, fontSize: 11 }}>
                                                                {u.date_of_birth
                                                                    ? new Date(u.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                    : '—'}
                                                            </span>
                                                            <span>DOB</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Driving licence row */}
                                                {hasProfile && (
                                                    <div className="user-card__dl-row">
                                                        <span className="user-card__dl-label">DL</span>
                                                        <span className="user-card__dl-no">
                                                            {u.driving_licence || <span style={{ color: 'var(--vm)', fontStyle: 'italic' }}>Not provided</span>}
                                                        </span>
                                                        {u.dl_expiry && (
                                                            <span className={`user-card__dl-exp ${dlExpired ? 'expired' : ''}`}>
                                                                exp {new Date(u.dl_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                                {dlExpired && ' ⚠'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer: verification pills + view link */}
                                                <div className="user-card__footer">
                                                    <div style={{ display: 'flex', gap: 5 }}>
                                                        <span className={`admin-verify-pill ${u.is_email_verified ? 'ok' : ''}`}>
                                                            ✉ {u.is_email_verified ? 'Email ✓' : 'Email ✗'}
                                                        </span>
                                                        <span className={`admin-verify-pill ${u.is_phone_verified ? 'ok' : ''}`}>
                                                            📱 {u.is_phone_verified ? 'Phone ✓' : 'Phone ✗'}
                                                        </span>
                                                    </div>
                                                    <span className="user-card__view-link">View details →</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ LOCATIONS ════ */}
                    {!loading && tab === 'locations' && (
                        <div className="admin-section">
                            <SectionCard title="Cities" subtitle="Add operating cities first — required before creating locations or fees.">
                                <InlineForm
                                    fields={[
                                        { key: 'name', label: 'City Name', required: true, placeholder: 'e.g. Mumbai' },
                                        { key: 'state', label: 'State', required: true, placeholder: 'e.g. Maharashtra' },
                                        { key: 'latitude', label: 'Latitude', type: 'number', step: '0.000001' },
                                        { key: 'longitude', label: 'Longitude', type: 'number', step: '0.000001' },
                                    ]}
                                    onSubmit={handleAddCity} submitLabel="+ Add City" loading={formLoading}
                                />
                                <div className="admin-data-table" style={{ marginTop: 12 }}>
                                    <div className="admin-data-table__header"><span>City</span><span>State</span><span>Coords</span><span></span></div>
                                    {cities.length === 0 && <div className="admin-table-empty">No cities yet.</div>}
                                    {cities.map(c => (
                                        <div key={c.id} className="admin-data-table__row">
                                            <span><strong>{c.name}</strong></span>
                                            <span>{c.state}</span>
                                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.latitude ? `${c.latitude}, ${c.longitude}` : '—'}</span>
                                            <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDeleteCity(c.id)}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                            <SectionCard title="Pickup / Dropoff Locations">
                                <div className="admin-data-table" style={{ marginTop: 12 }}>
                                    <div className="admin-data-table__header"><span>Name</span><span>City</span><span>Type</span><span>Address</span></div>
                                    {locations.length === 0 && <div className="admin-table-empty">No locations yet.</div>}
                                    {locations.map(l => (
                                        <div key={l.id} className="admin-data-table__row">
                                            <span><strong>{l.name}</strong></span>
                                            <span>{l.city?.name || l.city_name}</span>
                                            <span><span className="admin-badge admin-badge--gray">{l.location_type}</span></span>
                                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{l.address || '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                            <SectionCard title="One-Way City Pair Fees" subtitle="Set logistics fees for cross-city returns.">
                                <div className="admin-data-table" style={{ marginTop: 12 }}>
                                    <div className="admin-data-table__header"><span>From</span><span>To</span><span>Fee</span><span></span></div>
                                    {cityPairFees.length === 0 && <div className="admin-table-empty">No city pair fees yet.</div>}
                                    {cityPairFees.map(f => (
                                        <div key={f.id} className="admin-data-table__row">
                                            <span>{f.from_city?.name || f.from_city}</span>
                                            <span>→ {f.to_city?.name || f.to_city}</span>
                                            <span className="admin-currency">₹{parseFloat(f.fee).toLocaleString('en-IN')}</span>
                                            <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDeleteCityPairFee(f.id)}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ LOGISTICS ════ */}
                    {!loading && tab === 'logistics' && (
                        <div className="admin-section">
                            {logisticsStats && (
                                <div className="admin-stats-row">
                                    {[
                                        ['🕐', 'Expected', logisticsStats.expected, '#D97706'],
                                        ['📥', 'Received', logisticsStats.received, '#1D4ED8'],
                                        ['🔒', 'Held', logisticsStats.held, '#D97706'],
                                        ['🟢', 'Sub-listed', logisticsStats.sublisted, '#059669'],
                                        ['🤝', 'Network', logisticsStats.network_vendors, '#7C3AED'],
                                        ['📍', 'Ret. Points', logisticsStats.return_points, '#0DB89E'],
                                    ].map(([icon, label, val, color]) => (
                                        <div key={label} className="admin-mini-stat" style={{ borderColor: color + '50' }}>
                                            <span>{icon}</span>
                                            <span style={{ color, fontWeight: 800, fontSize: 17 }}>{val ?? 0}</span>
                                            <span style={{ fontSize: 10 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="admin-setup-step">
                                <div className="admin-setup-step__badge">Setup</div>
                                <SectionCard title="Return Points" subtitle="Designated drop-off points for one-way returns.">
                                    <InlineForm
                                        fields={[
                                            { key: 'name', label: 'Name', required: true, placeholder: 'e.g. FastPark Pune' },
                                            { key: 'city', label: 'City', type: 'select', required: true, options: cities.map(c => ({ value: c.id, label: c.name })) },
                                            { key: 'point_type', label: 'Type', type: 'select', required: true, options: [{ value: 'partner_vendor', label: 'Partner Vendor Lot' }, { value: 'parking', label: 'Paid Parking' }] },
                                            { key: 'address', label: 'Address', placeholder: 'Full address' },
                                            { key: 'contact_phone', label: 'Contact Phone' },
                                        ]}
                                        onSubmit={handleAddReturnPoint} submitLabel="+ Add Return Point" loading={formLoading}
                                    />
                                    <div className="admin-data-table" style={{ marginTop: 12 }}>
                                        <div className="admin-data-table__header"><span>Name</span><span>City</span><span>Type</span><span>Handling Fee</span><span></span></div>
                                        {returnPoints.length === 0 && <div className="admin-table-empty">No return points yet.</div>}
                                        {returnPoints.map(r => (
                                            <div key={r.id} className="admin-data-table__row">
                                                <span><strong>{r.name}</strong></span>
                                                <span>{r.city_name}</span>
                                                <span><span className="admin-badge admin-badge--gray">{r.point_type_display}</span></span>
                                                <span className="admin-currency">₹{r.handling_fee}</span>
                                                <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDeleteReturnPoint(r.id)}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </div>
                            {network.length > 0 && (
                                <SectionCard title="Vendor Network" subtitle="Vendors opted in for cross-city cooperation">
                                    <div className="admin-data-table">
                                        <div className="admin-data-table__header"><span>Vendor</span><span>City</span><span>Max</span><span>Held</span><span>Status</span></div>
                                        {network.map(n => (
                                            <div key={n.id} className="admin-data-table__row">
                                                <span><strong>{n.business_name}</strong></span>
                                                <span>{n.city_name}</span>
                                                <span>{n.max_vehicles}</span>
                                                <span><span className={`admin-badge ${n.current_held_count >= n.max_vehicles ? 'admin-badge--red' : 'admin-badge--blue'}`}>{n.current_held_count} / {n.max_vehicles}</span></span>
                                                <span><span className={`admin-badge ${n.is_active ? 'admin-badge--green' : 'admin-badge--gray'}`}>{n.is_active ? 'Active' : 'Inactive'}</span></span>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            )}
                            <SectionCard title="Active Handovers" subtitle="Cross-city vehicle handover pipeline">
                                {handovers.length === 0 ? <EmptyState icon="🔄" message="No active handovers." /> : (
                                    <div className="admin-handover-list">
                                        {handovers.map(h => (
                                            <div key={h.id} className="admin-handover-card">
                                                <div className="admin-handover-card__left">
                                                    <strong>{h.vehicle_display}</strong>
                                                    <span>Booking: {h.booking_ref}</span>
                                                    <span>From: {h.originating_vendor_name}</span>
                                                </div>
                                                <div className="admin-handover-card__mid">
                                                    <span>📍 {h.return_point_name}</span>
                                                    <span>🔄 {h.receiving_vendor ? `Receiving: ${h.receiving_vendor}` : 'No partner assigned'}</span>
                                                    {h.days_held > 0 && <span className="admin-days-held">⏱ {h.days_held}d held</span>}
                                                </div>
                                                <StatusBadge status={h.status} colorMap={HANDOVER_STATUS_CLR} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ CONFIG ════ */}
                    {!loading && tab === 'config' && (
                        <div className="admin-section">
                            <SectionCard title="Platform Configuration" subtitle="These settings drive pricing, cancellation policy, loyalty rewards and more.">
                                <div className="admin-config-notice">⚠ These are live settings. Changes affect all future bookings immediately.</div>
                                <div className="admin-config-list">
                                    {configs.map(c => (
                                        <div key={c.id} className="admin-config-row">
                                            <div className="admin-config-info">
                                                <strong>{c.display_name}</strong>
                                                <span>{c.description}</span>
                                                <code>{c.key} <span className="admin-type-chip">{c.value_type}</span></code>
                                            </div>
                                            <div className="admin-config-edit">
                                                {c.is_editable ? (
                                                    <>
                                                        <input value={c.value} onChange={e => setConfigs(p => p.map(x => x.id === c.id ? { ...x, value: e.target.value } : x))} />
                                                        <button className="admin-btn admin-btn--success admin-btn--sm" onClick={() => handleConfigSave(c)}>Save</button>
                                                    </>
                                                ) : (
                                                    <span className="admin-config-locked">🔒 {c.value}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                            <SectionCard title="Vehicle Segment Configuration" subtitle="Per-segment security deposits, minimum driver age, and rental minimums.">
                                <div className="admin-segment-grid">
                                    {segments.map(seg => (
                                        <div key={seg.id} className="admin-segment-card">
                                            <div className="admin-segment-card__header"><strong>{seg.display_name}</strong></div>
                                            <div className="admin-segment-card__fields">
                                                <div className="admin-form-field">
                                                    <label>Security Deposit (₹)</label>
                                                    <input type="number" value={seg.security_deposit} onChange={e => setSegments(p => p.map(x => x.id === seg.id ? { ...x, security_deposit: e.target.value } : x))} />
                                                </div>
                                                <div className="admin-form-field">
                                                    <label>Min Driver Age</label>
                                                    <input type="number" value={seg.min_driver_age} onChange={e => setSegments(p => p.map(x => x.id === seg.id ? { ...x, min_driver_age: e.target.value } : x))} />
                                                </div>
                                                <div className="admin-form-field">
                                                    <label>Min Rental Days</label>
                                                    <input type="number" value={seg.min_rental_days} onChange={e => setSegments(p => p.map(x => x.id === seg.id ? { ...x, min_rental_days: e.target.value } : x))} />
                                                </div>
                                            </div>
                                            <button className="admin-btn admin-btn--success admin-btn--sm admin-segment-save" onClick={() => handleSegmentSave(seg)}>Save Changes</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ PROMOS ════ */}
                    {!loading && tab === 'promos' && (
                        <div className="admin-section">
                            <SectionCard title="Create Promo Code" subtitle="Promo codes are applied by customers at checkout.">
                                <InlineForm
                                    fields={[
                                        { key: 'code', label: 'Code', required: true, placeholder: 'FIRST50' },
                                        { key: 'discount_type', label: 'Type', type: 'select', required: true, default: 'flat', options: [{ value: 'flat', label: 'Flat (₹)' }, { value: 'percentage', label: 'Percentage (%)' }] },
                                        { key: 'discount_value', label: 'Discount Amount', type: 'number', required: true, placeholder: '200' },
                                        { key: 'max_uses', label: 'Max Uses', type: 'number', placeholder: 'Unlimited' },
                                        { key: 'min_booking_amount', label: 'Min Booking (₹)', type: 'number', placeholder: '0' },
                                        { key: 'valid_from', label: 'Valid From', type: 'datetime-local', required: true },
                                        { key: 'valid_until', label: 'Valid Until', type: 'datetime-local', required: true },
                                    ]}
                                    onSubmit={handleAddPromo} submitLabel="+ Create Promo" loading={formLoading}
                                />
                            </SectionCard>
                            <SectionCard title={`Active Promos (${promos.length})`}>
                                {promos.length === 0 ? <EmptyState icon="🎁" message="No promo codes yet." /> : (
                                    <div className="admin-promo-grid">
                                        {promos.map(p => (
                                            <div key={p.id} className="admin-promo-card">
                                                <div className="admin-promo-card__code">{p.code}</div>
                                                <div className="admin-promo-card__discount">{p.discount_type === 'flat' ? `₹${p.discount_value} off` : `${p.discount_value}% off`}</div>
                                                <div className="admin-promo-card__meta">
                                                    <span>Used: {p.redemption_count || p.times_used || 0} / {p.max_redemptions || p.max_uses || '∞'}</span>
                                                    {p.min_booking_value > 0 && <span>Min: ₹{p.min_booking_value}</span>}
                                                </div>
                                                <div className="admin-promo-card__dates"><span>{p.valid_from?.slice(0, 10)} → {p.valid_until?.slice(0, 10)}</span></div>
                                                <button className="admin-btn admin-btn--xs admin-btn--danger admin-promo-delete" onClick={() => handleDeletePromo(p.id)}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ AGREEMENTS ════ */}
                    {!loading && tab === 'agreements' && (
                        <div className="admin-section">
                            <SectionCard
                                title="Agreement Versions"
                                subtitle="Only one version can be active at a time. Use Activate to publish a draft."
                                action={<button className="admin-btn admin-btn--primary" onClick={() => { setShowCreateForm(v => !v); setEditingVersion(null); }}>{showCreateForm ? '✕ Cancel' : '+ New Version'}</button>}
                            >
                                {showCreateForm && (
                                    <form onSubmit={handleCreateVersion} style={{ background: '#F8FAFB', border: '1px solid #E8EDF2', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#0DB89E', marginBottom: 4 }}>New Draft Version</div>
                                        <div className="admin-inline-form">
                                            <div className="admin-form-field"><label>Version Tag *</label><input type="text" placeholder="e.g. v2.0" value={agreementForm.version_tag} onChange={e => setAgreementForm(p => ({ ...p, version_tag: e.target.value }))} required /></div>
                                            <div className="admin-form-field"><label>Title</label><input type="text" value={agreementForm.title} onChange={e => setAgreementForm(p => ({ ...p, title: e.target.value }))} /></div>
                                            <div className="admin-form-field"><label>Effective From</label><input type="datetime-local" value={agreementForm.effective_from} onChange={e => setAgreementForm(p => ({ ...p, effective_from: e.target.value }))} /></div>
                                        </div>
                                        <div className="admin-form-field"><label>Summary</label><input type="text" placeholder="Key points plain-English summary…" value={agreementForm.summary} onChange={e => setAgreementForm(p => ({ ...p, summary: e.target.value }))} /></div>
                                        <div className="admin-form-field">
                                            <label>Content * — Markdown supported</label>
                                            <textarea rows={14} placeholder={"# Rental Agreement\n\n## 1. Eligibility\nThe renter must be at least 21 years of age…"} value={agreementForm.content} onChange={e => setAgreementForm(p => ({ ...p, content: e.target.value }))} required style={{ background: '#fff', border: '1px solid #D5DEE8', borderRadius: 8, color: '#111827', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'DM Mono, monospace', lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>{agreementFormLoading ? '…' : '+ Create Draft'}</button>
                                            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
                                        </div>
                                    </form>
                                )}
                                {editingVersion && (
                                    <form onSubmit={handleUpdateVersion} style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#D97706', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            Editing {editingVersion.version_tag}
                                            {editingVersion.acceptance_count > 0 && <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 11 }}>⚠ {editingVersion.acceptance_count} user(s) have signed this — content is locked.</span>}
                                        </div>
                                        <div className="admin-inline-form">
                                            <div className="admin-form-field"><label>Version Tag</label><input type="text" value={editingVersion.version_tag} disabled style={{ opacity: 0.5 }} readOnly /></div>
                                            <div className="admin-form-field"><label>Title</label><input type="text" value={editingVersion.title} onChange={e => setEditingVersion(p => ({ ...p, title: e.target.value }))} /></div>
                                            <div className="admin-form-field"><label>Effective From</label><input type="datetime-local" value={editingVersion.effective_from ? editingVersion.effective_from.slice(0, 16) : ''} onChange={e => setEditingVersion(p => ({ ...p, effective_from: e.target.value }))} /></div>
                                        </div>
                                        <div className="admin-form-field"><label>Summary</label><input type="text" value={editingVersion.summary || ''} onChange={e => setEditingVersion(p => ({ ...p, summary: e.target.value }))} /></div>
                                        <div className="admin-form-field">
                                            <label>Content {editingVersion.acceptance_count > 0 ? '(locked — users have signed)' : '(Markdown)'}</label>
                                            <textarea rows={14} value={editingVersion.content} disabled={editingVersion.acceptance_count > 0} onChange={e => setEditingVersion(p => ({ ...p, content: e.target.value }))} style={{ background: editingVersion.acceptance_count > 0 ? '#F8FAFB' : '#fff', border: '1px solid #D5DEE8', borderRadius: 8, color: '#111827', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'DM Mono, monospace', lineHeight: 1.6, width: '100%', boxSizing: 'border-box', opacity: editingVersion.acceptance_count > 0 ? 0.6 : 1 }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>{agreementFormLoading ? '…' : 'Save Changes'}</button>
                                            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditingVersion(null)}>Cancel</button>
                                        </div>
                                    </form>
                                )}
                                {agreements.length === 0 ? <EmptyState icon="📄" message="No agreement versions yet. Create the first one above." /> : (
                                    <div className="admin-card-list">
                                        {agreements.map(v => (
                                            <div key={v.id} style={{ background: v.is_active ? '#E6F7F5' : '#F8FAFB', border: `1px solid ${v.is_active ? 'rgba(13,184,158,.35)' : '#E8EDF2'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', transition: 'border-color .16s' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: v.is_active ? '#0A9E87' : '#111827' }}>{v.version_tag}</span>
                                                        {v.is_active && <span style={{ background: '#0DB89E', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, letterSpacing: 1 }}>LIVE</span>}
                                                        <span style={{ background: v.acceptance_count > 0 ? '#DBEAFE' : '#F3F4F6', color: v.acceptance_count > 0 ? '#1D4ED8' : '#6B7280', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{v.acceptance_count} signed</span>
                                                    </div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{v.title}</div>
                                                    {v.summary && <div style={{ fontSize: 12, color: '#6B7280', maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.summary}</div>}
                                                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                                                        Effective: {new Date(v.effective_from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        {' · '}Created by: {v.created_by_email || '—'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {!v.is_active && <button className="admin-btn admin-btn--success" onClick={() => handleActivateVersion(v.id, v.version_tag)}>✓ Activate</button>}
                                                    <button className="admin-btn admin-btn--ghost" onClick={() => { setEditingVersion({ ...v }); setShowCreateForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏ Edit</button>
                                                    <button className="admin-btn admin-btn--ghost" onClick={() => { const w = window.open('', '_blank'); w.document.write(`<html><head><title>${v.version_tag} Preview</title><style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 24px;line-height:1.75;color:#111}h1{font-size:22px;border-bottom:2px solid #eee;padding-bottom:10px}</style></head><body><h1>${v.title}</h1><pre style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">${v.content}</pre></body></html>`); w.document.close(); }}>👁 Preview</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                            <SectionCard title="Acceptance Audit Log" subtitle="Immutable record of every customer who signed an agreement.">
                                <div className="cd-filter-bar cd-filter-bar--dropdown">
                                    <FilterDropdown
                                        label="Version"
                                        value={acceptanceFilter}
                                        onChange={setAcceptanceFilter}
                                        options={[{ value: '', label: 'All Versions' }, ...agreements.map(v => ({ value: String(v.id), label: `${v.version_tag} (${v.acceptance_count})`, color: v.is_active ? '#059669' : '#9CA3AF' }))]}
                                    />
                                    {acceptanceFilter && <button className="cd-filter-clear" onClick={() => setAcceptanceFilter('')}>✕ Clear</button>}
                                </div>
                                {filteredAcceptances.length === 0 ? <EmptyState icon="📋" message="No acceptances found." /> : (
                                    <div className="admin-booking-table">
                                        <div className="admin-booking-table__header" style={{ gridTemplateColumns: '110px 1fr 1fr 100px 70px 140px' }}>
                                            <span>Version</span><span>User</span><span>Booking</span><span>Method</span><span>OTP</span><span>Date & Time</span>
                                        </div>
                                        {filteredAcceptances.map(a => (
                                            <div key={a.id} className="admin-booking-table__row" style={{ gridTemplateColumns: '110px 1fr 1fr 100px 70px 140px' }}>
                                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#0DB89E' }}>{a.version_tag}</span>
                                                <span>{a.user_name || '—'}<small style={{ display: 'block', color: '#9CA3AF', fontSize: 10 }}>{a.user_email}</small></span>
                                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0DB89E' }}>{a.booking_ref || '—'}</span>
                                                <span><span style={{ background: a.acceptance_method === 'otp_sign' ? '#DBEAFE' : '#F3F4F6', color: a.acceptance_method === 'otp_sign' ? '#1D4ED8' : '#6B7280', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>{a.acceptance_method === 'otp_sign' ? 'OTP Sign' : 'Checkbox'}</span></span>
                                                <span>{a.otp_verified ? <span style={{ color: '#059669', fontWeight: 700 }}>✓ Yes</span> : <span style={{ color: '#9CA3AF' }}>No</span>}</span>
                                                <span style={{ fontSize: 11 }}>
                                                    {new Date(a.accepted_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    {a.ip_address && <small style={{ display: 'block', color: '#9CA3AF', fontSize: 10, fontFamily: 'DM Mono, monospace' }}>{a.ip_address}</small>}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}