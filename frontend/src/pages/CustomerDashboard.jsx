import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/common/Navbar';
import Navbar from '../components/common/Navbar';
import {
    AgreementSignModal,
    AgreementViewModal,
    AgreementHistoryTab,
} from '../components/agreements/AgreementModal';
import {
    getMyBookings, getMyBookingDetail, cancelBooking,
    getLoyaltyBalance, getCustomerProfile, updateCustomerProfile,
    redeemLoyalty, submitReview, getPendingReviews,
    dummyPayment,
    createInspection, signInspection, uploadInspectionPhoto,
} from '../services/api';
import './CustomerDashboard.css';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const STATUS_CLR = {
    PENDING: { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
    ACTIVE: { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' },
    COMPLETED: { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
    CANCELLED: { bg: '#FEE2E2', color: '#EF4444', border: '#FCA5A5' },
};
    
// ─────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const s = STATUS_CLR[status] || { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 9px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        }}>
            {status}
        </span>
    );
};

const InfoRow = ({ label, value, highlight }) => (
    <div className="cd-info-row">
        <span className="cd-info-row__lbl">{label}</span>
        <strong
            className="cd-info-row__val"
            style={highlight ? { color: 'var(--cd-acc)', fontSize: 15 } : {}}
        >
            {value || '—'}
        </strong>
    </div>
);

const Toast = ({ msg, type, onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
    return (
        <div className={`cd-toast cd-toast--${type}`}>
            {type === 'success' ? <span className="toast-icon success">&#10003;</span> : <span className="toast-icon warning">!</span>} {msg}
        </div>
    );
};

const StarRating = ({ value, onChange, readonly }) => (
    <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
            <button
                key={n}
                type="button"
                onClick={() => !readonly && onChange?.(n)}
                style={{
                    background: 'none', border: 'none',
                    cursor: readonly ? 'default' : 'pointer',
                    fontSize: 22,
                    color: n <= value ? '#E8A020' : '#D1D5DB',
                    padding: 0, transition: 'color 0.15s',
                }}
            >
                &#9733;
            </button>
        ))}
    </div>
);


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

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.88)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 16,
            }}
        >
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: 20, right: 24,
                    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', borderRadius: 8, padding: '6px 14px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
            >
                ✕ Close
            </button>

            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                    onClick={() => setCurrent(c => Math.max(c - 1, 0))}
                    disabled={current === 0}
                    style={{
                        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', borderRadius: 8, padding: '10px 16px',
                        fontSize: 18, cursor: current === 0 ? 'not-allowed' : 'pointer',
                        opacity: current === 0 ? 0.3 : 1,
                    }}
                >‹</button>

                <div style={{ textAlign: 'center' }}>
                    <img
                        src={photos[current].image}
                        alt={photos[current].angle || 'inspection'}
                        style={{
                            maxWidth: 'min(80vw, 900px)', maxHeight: '70vh',
                            objectFit: 'contain', borderRadius: 12,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'block',
                        }}
                    />
                    {photos[current].angle && (
                        <div style={{
                            marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)',
                            textTransform: 'capitalize', letterSpacing: '0.5px',
                        }}>
                            {photos[current].angle} · {current + 1} / {photos.length}
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setCurrent(c => Math.min(c + 1, photos.length - 1))}
                    disabled={current === photos.length - 1}
                    style={{
                        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', borderRadius: 8, padding: '10px 16px',
                        fontSize: 18, cursor: current === photos.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: current === photos.length - 1 ? 0.3 : 1,
                    }}
                >›</button>
            </div>

            {photos.length > 1 && (
                <div
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80vw' }}
                >
                    {photos.map((ph, idx) => (
                        <img
                            key={ph.id}
                            src={ph.image}
                            alt={ph.angle}
                            onClick={() => setCurrent(idx)}
                            style={{
                                width: 54, height: 42, objectFit: 'cover', borderRadius: 6,
                                cursor: 'pointer',
                                border: idx === current ? '2px solid #0DB89E' : '2px solid rgba(255,255,255,0.2)',
                                opacity: idx === current ? 1 : 0.6,
                                transition: 'opacity 0.15s, border-color 0.15s',
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// FILTER DROPDOWN
// ─────────────────────────────────────────────
function FilterDropdown({ label, value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => o.value === value);
    const isActive = value !== '' && value != null;

    return (
        <div className="cd-filter-dropdown" ref={ref}>
            <button
                className={`cd-filter-dropdown__trigger${isActive ? ' active' : ''}${open ? ' open' : ''}`}
                onClick={() => setOpen(v => !v)}
            >
                <span className="cd-filter-dropdown__label">{label}</span>
                {isActive && (
                    <span className="cd-filter-dropdown__chip">{selected?.label}</span>
                )}
                <span className={`cd-filter-dropdown__chevron${open ? ' flipped' : ''}`}>▾</span>
            </button>

            {open && (
                <div className="cd-filter-dropdown__menu">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            className={`cd-filter-dropdown__item${value === opt.value ? ' selected' : ''}`}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                        >
                            {opt.color && (
                                <span className="cd-filter-dropdown__dot" style={{ background: opt.color }} />
                            )}
                            <span>{opt.label}</span>
                            {value === opt.value && (
                                <span className="cd-filter-dropdown__check">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const hasDuePayment = (detail) => {
    if (!detail?.pricing_snapshot) return false;
    const snap = detail.pricing_snapshot;
    return (snap.advance_paid || false) && !(snap.remaining_paid || false) && !(snap.full_payment_paid || false);
};

// ─────────────────────────────────────────────
// PAYMENT MODAL
// ─────────────────────────────────────────────
function PaymentModal({ booking, detail, onClose, onSuccess, showToast }) {
    const [method, setMethod] = useState('online');
    const [loading, setLoading] = useState(false);

    const pricing = detail?.pricing_snapshot || {};
    const grandTotal = parseFloat(pricing.grand_total || booking.total_amount || 0);
    const deposit = parseFloat(pricing.security_deposit || detail?.deposit_amount || 0);
    const advancePct = 30;
    const advanceAmt = Math.round(grandTotal * advancePct / 100);
    const remaining = grandTotal - advanceAmt;
    const advancePaid = pricing.advance_paid || false;
    const remainingPaid = pricing.remaining_paid || false;
    const fullPaid = pricing.full_payment_paid || false;
    const canPayRemaining = advancePaid && !remainingPaid && !fullPaid;
    const payableNow = canPayRemaining ? remaining : advanceAmt;

    const handlePay = async () => {
        setLoading(true);
        try {
            const pt = canPayRemaining ? 'remaining' : 'advance';
            const { data } = await dummyPayment(booking.id, { payment_type: pt, method });
            showToast(data.message || 'Payment successful!');
            onSuccess?.();
            onClose();
        } catch (e) {
            showToast(e.response?.data?.error || 'Payment failed.', 'error');
        } finally { setLoading(false); }
    };

    if (fullPaid || (advancePaid && remainingPaid)) {
        return (
            <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="cd-modal">
                    <div className="cd-modal__head">
                        <h3 className="cd-modal__title">Payment</h3>
                        <button className="cd-modal__close" onClick={onClose}>&times;</button>
                    </div>
                    <div className="cd-modal__body" style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div className="status-icon success-lg"></div>
                            <h3 style={{ marginTop: 12, fontWeight: 700 }}>Fully Paid</h3>
                            <p style={{ color: 'var(--cd-muted)', marginTop: 8 }}>
                                Grand Total ₹{grandTotal.toLocaleString('en-IN')} — all payments received.
                            </p>
                        </div>
                    </div>
                    <div className="cd-modal__foot">
                        <button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal">
                <div className="cd-modal__head">
                    <h3 className="cd-modal__title">Payment</h3>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>
                <div className="cd-modal__body">
                    <div className="cd-payment-breakdown">
                        <div className="cd-payment-breakdown__row">
                            <span>Grand Total</span>
                            <strong>₹{grandTotal.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="cd-payment-breakdown__row">
                            <span>Security Deposit (separate)</span>
                            <span className="cd-muted-val">₹{deposit.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="cd-payment-breakdown__divider" />
                        <div className="cd-payment-breakdown__row" style={advancePaid ? { opacity: 0.5 } : {}}>
                            <span>Advance ({advancePct}%)</span>
                            <strong style={advancePaid ? { color: '#059669' } : {}}>
                                {advancePaid ? 'Paid' : `₹${advanceAmt.toLocaleString('en-IN')}`}
                            </strong>
                        </div>
                        <div className="cd-payment-breakdown__row" style={remainingPaid ? { opacity: 0.5 } : {}}>
                            <span>Remaining (70%)</span>
                            <strong style={remainingPaid ? { color: '#059669' } : {}}>
                                {remainingPaid ? 'Paid' : `₹${remaining.toLocaleString('en-IN')}`}
                            </strong>
                        </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--cd-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                            Payment Method
                        </p>
                        <div className="cd-payment-modes">
                            {[
                                ['online', 'Online Payment', 'UPI, Cards, Net Banking'],
                                ['cash', 'Cash', 'Pay at vendor location'],
                            ].map(([val, label, sub]) => (
                                <button
                                    key={val}
                                    className={`cd-payment-mode${method === val ? ' active' : ''}`}
                                    onClick={() => setMethod(val)}
                                >
                                    <span className={`payment-icon ${val}`}></span>
                                    <div><strong>{label}</strong><small>{sub}</small></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button>
                    <button className="cd-btn cd-btn--primary" onClick={handlePay} disabled={loading}>
                        {loading ? 'Processing…' : `Pay ₹${payableNow.toLocaleString('en-IN')} Now`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// INVOICE MODAL
// ─────────────────────────────────────────────
function InvoiceModal({ invoice, booking, onClose }) {
    if (!invoice) return null;
    const lines = [
        ['Invoice Reference', invoice.invoice_ref],
        ['Base Rental', `₹${parseFloat(invoice.base_amount || 0).toLocaleString('en-IN')}`],
        ['Add-ons', `₹${parseFloat(invoice.addon_amount || 0).toLocaleString('en-IN')}`],
        ['One-Way Fee', `₹${parseFloat(invoice.one_way_fee || 0).toLocaleString('en-IN')}`],
        ['CGST', `₹${parseFloat(invoice.cgst_amount || 0).toLocaleString('en-IN')}`],
        ['SGST', `₹${parseFloat(invoice.sgst_amount || 0).toLocaleString('en-IN')}`],
        ['Grand Total', `₹${parseFloat(invoice.total_amount || 0).toLocaleString('en-IN')}`],
        ['Deposit Status', invoice.deposit_status?.toUpperCase() || '—'],
    ];
    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal">
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Invoice</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>
                            Booking: {booking?.booking_ref}
                        </p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>
                <div className="cd-modal__body">
                    <div className="cd-invoice-header">
                        <div>
                            <div className="cd-invoice-brand">RudhiDrive</div>
                            <div style={{ fontSize: 12, color: 'var(--cd-muted)' }}>GST Invoice</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--cd-acc)', fontFamily: 'DM Mono, monospace' }}>
                                {invoice.invoice_ref}
                            </div>
                        </div>
                    </div>
                    <div className="cd-invoice-lines">
                        {lines.filter(([, v]) => v && v !== '₹0').map(([l, v]) => (
                            <div key={l} className={`cd-invoice-line${l === 'Grand Total' ? ' cd-invoice-line--total' : ''}`}>
                                <span>{l}</span><strong>{v}</strong>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// INSPECTION PANEL (Customer Side)
// ─────────────────────────────────────────────
function InspectionPanel({ bookingId, inspectionType, existingInspection, canCreate, showToast, onRefresh, role = 'customer' }) {
    const isPickup = inspectionType === 'PICKUP';
    const isCustomer = role === 'customer';
    const label = isPickup ? 'Pickup' : 'Drop-off';

    const [form, setForm] = useState({ odometer_reading: '', fuel_level: 'full', notes: '' });
    const [saving, setSaving] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [otpCode, setOtpCode] = useState('');
    const [otpBusy, setOtpBusy] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [vendorOtpDisplay, setVendorOtpDisplay] = useState(null);

    const [lightboxIndex, setLightboxIndex] = useState(null);

    // ── Helper: clickable thumbnail ───────────────────────────────
    // Renders a photo thumbnail that opens the lightbox on click.
    // Used in every state that shows photos.
    const renderPhotos = (photos, size = { w: 70, h: 54 }) => {
        if (!photos || photos.length === 0) return null;
        return (
            <>
                {lightboxIndex !== null && (
                    <PhotoLightbox
                        photos={photos}
                        initialIndex={lightboxIndex}
                        onClose={() => setLightboxIndex(null)}
                    />
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {photos.map((ph, idx) => (
                        <div
                            key={ph.id}
                            onClick={() => setLightboxIndex(idx)}
                            title="Click to enlarge"
                            style={{
                                position: 'relative', cursor: 'pointer',
                                borderRadius: 6, overflow: 'hidden',
                                width: size.w, height: size.h, flexShrink: 0,
                            }}
                        >
                            <img
                                src={ph.image}
                                alt={ph.angle || 'inspection'}
                                style={{
                                    width: '100%', height: '100%',
                                    objectFit: 'cover', display: 'block',
                                    border: '1px solid var(--cd-bdr)',
                                    borderRadius: 6,
                                }}
                            />
                            {/* Hover zoom hint overlay */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'rgba(0,0,0,0.32)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: 6, opacity: 0,
                                transition: 'opacity 0.15s',
                            }}
                                className="cd-photo-hover"
                            >
                                <span style={{ color: '#fff', fontSize: 18 }}>⤢</span>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    // ── STATE 1: Locked (read-only) ───────────────────────────────
    if (existingInspection?.is_locked) {
        const photos = existingInspection.photos || [];
        // FIX 2: only include damage row when damage was actually reported
        const infoRows = [
            ['Odometer', `${existingInspection.odometer_reading} km`],
            ['Fuel Level', existingInspection.fuel_level],
            ['Customer Signed', existingInspection.customer_signed ? 'Yes' : 'Pending'],
            ['Vendor Signed', existingInspection.vendor_signed ? 'Yes' : 'Pending'],
            ...(existingInspection.notes ? [['Notes', existingInspection.notes]] : []),
            ...(existingInspection.damage_reported
                ? [['Damage', existingInspection.damage_notes || 'Reported']]
                : []),
        ];

        return (
            <div style={{ border: '1px solid var(--cd-bdr)', borderRadius: 10, overflow: 'hidden' }}>
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isPickup ? '#EFF6FF' : '#F0FDF4', borderBottom: expanded ? '1px solid var(--cd-bdr)' : 'none', cursor: 'pointer' }}
                    onClick={() => setExpanded(v => !v)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`insp-icon ${isPickup ? 'pickup' : 'dropoff'}`}></span>
                        <strong style={{ fontSize: 13 }}>{label} Inspection</strong>
                        <span style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                            Locked
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {infoRows.map(([l, v]) => (
                            <div key={l} className="cd-info-row" style={{ fontSize: 13 }}>
                                <span className="cd-info-row__lbl">{l}</span>
                                <strong>{v}</strong>
                            </div>
                        ))}
                        {/* FIX 1: clickable photos with lightbox */}
                        {renderPhotos(photos)}
                    </div>
                )}
            </div>
        );
    }

    // ── STATE 2a: PICKUP — submitted, waiting for vendor OTP ──────
    if (isPickup && isCustomer && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];

        const handleVerifyOtp = async () => {
            if (otpCode.length !== 6) { showToast('Enter 6-digit OTP.', 'error'); return; }
            setOtpBusy(true);
            try {
                await signInspection(bookingId, 'pickup', 'verify', otpCode);
                showToast('Pickup verified! Trip is now ACTIVE.');
                setOtpCode('');
                onRefresh();
            } catch (e) {
                showToast(e.response?.data?.error || 'Invalid OTP. Please check with vendor.', 'error');
            }
            setOtpBusy(false);
        };

        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer' }}
                    onClick={() => setExpanded(v => !v)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="insp-icon pickup"></span>
                        <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                            Enter OTP from Vendor
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#DBEAFE', border: '1px solid #93C5FD', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                            <strong>Enter OTP from Vendor</strong>
                            <p style={{ marginTop: 4, fontSize: 12, color: '#1D4ED8' }}>
                                Your pickup inspection has been submitted. Ask the vendor for the OTP and enter it below to start your trip.
                            </p>
                        </div>
                        <div style={{ background: '#F8FAFB', border: '1px solid var(--cd-bdr)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                                {existingInspection.notes && <span>Notes: <strong>{existingInspection.notes}</strong></span>}
                            </div>
                        </div>
                        {/* Photos are not shown here — pickup photos were uploaded by customer at form submission */}
                        <div>
                            <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginBottom: 8, fontWeight: 600 }}>
                                Enter 6-digit OTP provided by vendor:
                            </p>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                    className="cd-input"
                                    style={{ width: 140, textAlign: 'center', letterSpacing: '6px', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}
                                    maxLength={6}
                                    placeholder="——————"
                                    value={otpCode}
                                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    autoFocus
                                />
                                <button
                                    className="cd-btn cd-btn--primary"
                                    onClick={handleVerifyOtp}
                                    disabled={otpBusy || otpCode.length !== 6}
                                >
                                    {otpBusy ? 'Verifying…' : 'Verify & Start Trip'}
                                </button>
                            </div>
                            <p style={{ fontSize: 11, color: '#D97706', marginTop: 8 }}>
                                The vendor generates this OTP after reviewing your inspection details.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── STATE 2b: DROP-OFF — vendor submitted, customer reviews & generates OTP ──
    if (!isPickup && isCustomer && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];

        const handleGenerateOtp = async () => {
            setOtpBusy(true);
            try {
                const { data } = await signInspection(bookingId, 'return', 'generate', null);
                setVendorOtpDisplay(data.otp_code);
                showToast('OTP generated! Share this with the vendor to complete drop-off.', 'success');
            } catch (e) {
                showToast(e.response?.data?.error || 'Failed to generate OTP.', 'error');
            }
            setOtpBusy(false);
        };

        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer' }}
                    onClick={() => setExpanded(v => !v)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="insp-icon dropoff"></span>
                        <strong style={{ fontSize: 13 }}>Drop-off Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                            Review & Generate OTP
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                            <strong>Review Drop-off Inspection</strong>
                            <p style={{ marginTop: 4, fontSize: 12, color: '#92400E' }}>
                                The vendor has recorded the vehicle condition at return. Review the details carefully before generating the OTP.
                            </p>
                        </div>
                        <div style={{ background: '#F8FAFB', border: '1px solid var(--cd-bdr)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                                {/* FIX 2: only show damage when actually reported */}
                                {existingInspection.damage_reported && (
                                    <span style={{ color: '#EF4444' }}>
                                        Damage: <strong>{existingInspection.damage_notes} (₹{existingInspection.damage_amount})</strong>
                                    </span>
                                )}
                                {existingInspection.notes && <span>Notes: <strong>{existingInspection.notes}</strong></span>}
                            </div>
                        </div>
                        {/* FIX 1: clickable photos with lightbox */}
                        {renderPhotos(photos, { w: 80, h: 60 })}
                        {!vendorOtpDisplay ? (
                            <button className="cd-btn cd-btn--primary" onClick={handleGenerateOtp} disabled={otpBusy}>
                                {otpBusy ? 'Generating…' : 'Generate OTP for Vendor'}
                            </button>
                        ) : (
                            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                                <p style={{ fontSize: 12, color: '#059669', marginBottom: 10, fontWeight: 600 }}>
                                    Share this OTP with the vendor:
                                </p>
                                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 10, fontFamily: 'monospace', color: '#059669' }}>
                                    {vendorOtpDisplay}
                                </div>
                                <p style={{ fontSize: 11, color: '#059669', marginTop: 10 }}>
                                    Once the vendor enters this OTP, drop-off will be completed and booking closed.
                                </p>
                                <button className="cd-btn cd-btn--ghost cd-btn--sm" style={{ marginTop: 10 }} onClick={handleGenerateOtp} disabled={otpBusy}>
                                    Generate New OTP
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── STATE 3: Not yet available ────────────────────────────────
    if (!canCreate) {
        return (
            <div style={{ border: '1px dashed var(--cd-bdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--cd-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`insp-icon ${isPickup ? 'pickup' : 'dropoff'}`}></span>
                <span>
                    {isPickup
                        ? 'Pickup inspection — available after booking is confirmed and agreement signed.'
                        : 'Drop-off inspection — filled by vendor when you return the vehicle.'}
                </span>
            </div>
        );
    }

    // ── STATE 4: Drop-off not creatable by customer ───────────────
    if (!isPickup) {
        return (
            <div style={{ border: '1px dashed var(--cd-bdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--cd-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="insp-icon dropoff"></span>
                <span>Drop-off inspection is recorded by the vendor when you return the vehicle.</span>
            </div>
        );
    }

    // ── STATE 5: Customer fills pickup inspection form ────────────
    const handleSave = async () => {
        if (!form.odometer_reading) { showToast('Odometer reading is required.', 'error'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('odometer_reading', form.odometer_reading);
            fd.append('fuel_level', form.fuel_level);
            fd.append('notes', form.notes);
            fd.append('checklist', JSON.stringify({ exterior: true, interior: true, tyres: true, documents: true }));

            // createInspection returns { inspection_id, status }
            const { data: inspData } = await createInspection(bookingId, 'pickup', fd);

            // FIX 1 (photo upload): if user selected a photo, upload it now using the
            // inspection_id returned by the create endpoint. Previously photoFile was
            // captured in state but uploadInspectionPhoto was never called.
            if (photoFile && inspData?.inspection_id) {
                const pfd = new FormData();
                pfd.append('image', photoFile);
                pfd.append('angle', 'other');
                try {
                    await uploadInspectionPhoto(inspData.inspection_id, pfd);
                } catch {
                    // Photo upload failure is non-fatal — inspection is already saved
                    showToast('Inspection saved, but photo upload failed. You can retry later.', 'error');
                }
            }

            showToast('Pickup inspection submitted! Waiting for vendor to generate OTP.');
            onRefresh();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to save.', 'error');
        }
        setSaving(false);
    };

    return (
        <div style={{ border: '1px solid var(--cd-acc)', borderRadius: 10, overflow: 'hidden' }}>
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cd-acc-l)', cursor: 'pointer' }}
                onClick={() => setExpanded(v => !v)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="insp-icon pickup"></span>
                    <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                    <span style={{ background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #93C5FD', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                        Ready to Fill
                    </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? 'Hide' : 'Fill Form'}</span>
            </div>

            {expanded && (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#1D4ED8' }}>
                        <strong>How it works:</strong> Fill in the vehicle condition at pickup. After you submit, the vendor will review it and generate an OTP for you to enter.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="cd-form-field">
                            <label>Odometer Reading (km) *</label>
                            <input
                                className="cd-input"
                                type="number"
                                value={form.odometer_reading}
                                onChange={e => setForm(p => ({ ...p, odometer_reading: e.target.value }))}
                                placeholder="e.g. 45230"
                            />
                        </div>
                        <div className="cd-form-field">
                            <label>Fuel Level</label>
                            <select
                                className="cd-input"
                                value={form.fuel_level}
                                onChange={e => setForm(p => ({ ...p, fuel_level: e.target.value }))}
                            >
                                {['empty', 'quarter', 'half', 'three_quarter', 'full'].map(v => (
                                    <option key={v} value={v}>{v.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="cd-form-field">
                        <label>Notes (optional)</label>
                        <textarea
                            className="cd-input cd-textarea"
                            value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Any observations about the vehicle condition…"
                        />
                    </div>
                    <div className="cd-form-field">
                        <label>Upload Photo (optional)</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} />
                            {photoFile && (
                                <span style={{ fontSize: 11, color: 'var(--cd-acc)', fontWeight: 600 }}>
                                    ✓ {photoFile.name}
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--cd-bdr)' }}>
                        <button className="cd-btn cd-btn--primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : 'Submit Pickup Inspection'}
                        </button>
                        <span style={{ fontSize: 11, color: 'var(--cd-muted)' }}>
                            Vendor will review and provide OTP
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// BOOKING DETAIL PANEL
// ─────────────────────────────────────────────
function BookingDetailPanel({ booking, detail, loading: detailLoading, onRefresh, showToast, role = 'customer' }) {
    const [showPayment, setShowPayment] = useState(false);
    const [showInvoice, setShowInvoice] = useState(false);
    const [showSignModal, setShowSignModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [latestAcceptance, setLatestAcceptance] = useState(null);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);

    if (detailLoading) {
        return <div className="cd-detail-loading"><div className="cd-spinner" /> Loading details…</div>;
    }
    if (!detail) return null;

    const pricing = detail.pricing_snapshot || {};
    const v = detail.vehicle || {};
    const vendor = detail.vendor || {};
    const pickupInsp = (detail.inspections || []).find(i => i.inspection_type === 'PICKUP');
    const returnInsp = (detail.inspections || []).find(i => i.inspection_type === 'RETURN');
    const grandTotal = parseFloat(pricing.grand_total || detail.total_amount || 0);
    const advancePct = 30;
    const advanceAmt = Math.round(grandTotal * advancePct / 100);
    const remaining = grandTotal - advanceAmt;
    const advancePaid = pricing.advance_paid || detail.payment_captured || false;
    const remainingPaid = pricing.remaining_paid || false;
    const fullPaid = pricing.full_payment_paid || (advancePaid && remainingPaid);
    const deposit = parseFloat(pricing.security_deposit || detail.deposit_amount || 0);
    const canSign = booking.status === 'CONFIRMED' && !detail.agreement_signed;
    const canPayNow = !fullPaid && advancePaid && !remainingPaid;
    const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status);
    const canCreatePickupInsp = ['CONFIRMED'].includes(booking.status) && detail.agreement_signed && !pickupInsp;

    const handleCancel = async () => {
        setCancelLoading(true);
        try {
            const { data } = await cancelBooking(booking.id, cancelReason || 'Customer requested cancellation');
            showToast(`Booking cancelled. Refund: ₹${data.refund_amount}`);
            setCancelConfirm(false);
            onRefresh();
        } catch (e) {
            showToast(e.response?.data?.error || 'Could not cancel.', 'error');
        } finally { setCancelLoading(false); }
    };

    const getVehicleIcon = (segment) => <span className={`vehicle-icon ${segment || 'default'}`}></span>;

    return (
        <>
            <div className="cd-detail-vehicle-card">
                <div className="cd-detail-vehicle-icon">{getVehicleIcon(v.segment)}</div>
                <div className="cd-detail-vehicle-info">
                    <h4>{v.year} {v.make} {v.model}</h4>
                    <div className="cd-detail-vehicle-meta">
                        <span>{v.plate_number}</span>
                        <span>{v.fuel_type}</span>
                        <span>{v.transmission}</span>
                        <span>{v.capacity} seats</span>
                        {v.is_certified && <span className="cd-cert-tag">Certified</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 4 }}>
                        {vendor.vendor_profile?.business_name || vendor.full_name || '—'}
                    </div>
                </div>
                <div className="cd-detail-status-col">
                    <StatusBadge status={booking.status} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cd-txt)', marginTop: 8 }}>
                        ₹{parseFloat(detail.total_amount || 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--cd-muted)' }}>Total</div>
                    {advancePaid && !fullPaid && !remainingPaid && (
                        <div style={{ fontSize: 11, color: '#D97706', fontWeight: 600, marginTop: 4 }}>
                            Pending: ₹{remaining.toLocaleString('en-IN')}
                        </div>
                    )}
                </div>
            </div>

            <div className="cd-detail-grid">
                <div className="cd-info-group">
                    <div className="cd-info-group__title">Trip Details</div>
                    <InfoRow label="Booking Ref" value={booking.booking_ref} />
                    <InfoRow label="Pickup" value={`${detail.pickup_date}${detail.pickup_time ? ' @ ' + detail.pickup_time : ''}`} />
                    <InfoRow label="Return" value={`${detail.return_date}${detail.return_time ? ' @ ' + detail.return_time : ''}`} />
                    <InfoRow label="Duration" value={`${detail.rental_days} day(s)`} />
                    <InfoRow label="Pickup At" value={detail.pickup_location_detail?.name || '—'} />
                    {detail.is_one_way && <InfoRow label="Return At" value={detail.return_location_detail?.name || '—'} />}
                    {(detail.addons || []).length > 0 && (
                        <InfoRow label="Add-ons" value={(detail.addons || []).map(a => a.addon_type.replace(/_/g, ' ')).join(', ')} />
                    )}
                </div>

                <div className="cd-info-group">
                    <div className="cd-info-group__title">Payment Status</div>
                    <InfoRow label="Grand Total" value={`₹${grandTotal.toLocaleString('en-IN')}`} highlight />
                    <InfoRow label={`Advance (${advancePct}%)`} value={advancePaid ? `Paid — ₹${advanceAmt.toLocaleString('en-IN')}` : `Due — ₹${advanceAmt.toLocaleString('en-IN')}`} />
                    <InfoRow label="Remaining (70%)" value={(fullPaid || remainingPaid) ? `Paid — ₹${remaining.toLocaleString('en-IN')}` : `Due — ₹${remaining.toLocaleString('en-IN')}`} />
                    <InfoRow label="Security Deposit" value={`₹${deposit.toLocaleString('en-IN')} (${detail.deposit_released ? 'Released' : detail.deposit_held ? 'Held' : 'Pending'})`} />
                    {detail.invoice && (
                        <div style={{ marginTop: 8 }}>
                            <button className="cd-btn cd-btn--outline cd-btn--sm" onClick={() => setShowInvoice(true)}>View Invoice</button>
                        </div>
                    )}
                </div>

                <div className="cd-info-group">
                    <div className="cd-info-group__title">Rental Agreement</div>
                    <InfoRow label="Status" value={detail.agreement_signed ? 'Signed' : 'Not Signed'} />
                    {detail.agreement_signed_at && (
                        <InfoRow label="Signed On" value={new Date(detail.agreement_signed_at).toLocaleString('en-IN')} />
                    )}
                    {detail.agreement_signed && (
                        <button className="cd-btn cd-btn--ghost cd-btn--sm" onClick={() => setShowViewModal(true)}>
                            View Signed Agreement
                        </button>
                    )}
                </div>

                <div className="cd-info-group">
                    <div className="cd-info-group__title">Pricing Breakdown</div>
                    <InfoRow label="Daily Rate" value={`₹${parseFloat(pricing.daily_rate || 0).toLocaleString('en-IN')}/day`} />
                    <InfoRow label="Base Rental" value={`₹${parseFloat(pricing.base_amount || 0).toLocaleString('en-IN')}`} />
                    {parseFloat(pricing.addon_total || pricing.addon_amount || 0) > 0 && (
                        <InfoRow label="Add-ons" value={`₹${parseFloat(pricing.addon_total || pricing.addon_amount).toLocaleString('en-IN')}`} />
                    )}
                    <InfoRow label="GST (18%)" value={`₹${parseFloat(pricing.gst_amount || 0).toLocaleString('en-IN')}`} />
                </div>
            </div>

            {/* Inspections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--cd-muted)' }}>
                    Inspections
                </div>
                {booking.status === 'CONFIRMED' && !detail.agreement_signed && (
                    <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                        Please sign the rental agreement first before completing the pickup inspection.
                    </div>
                )}
                {booking.status === 'CONFIRMED' && detail.agreement_signed && !pickupInsp && (
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1D4ED8' }}>
                        Agreement signed! Open the Pickup Inspection below to record vehicle condition.
                    </div>
                )}
                {booking.status === 'CONFIRMED' && pickupInsp && !pickupInsp.is_locked && (
                    <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                        Pickup inspection submitted. Waiting for vendor to generate OTP.
                    </div>
                )}
                {booking.status === 'ACTIVE' && !returnInsp && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #6EE7B7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#059669' }}>
                        Trip is active! When returning the vehicle, the vendor will fill the drop-off inspection and you will need to verify it here.
                    </div>
                )}

                <div className="cd-inspection-grid">
                    <InspectionPanel
                        key={`pickup-${pickupInsp?.id}-${pickupInsp?.is_locked}-${pickupInsp?.customer_signed}`}
                        bookingId={booking.id}
                        inspectionType="PICKUP"
                        existingInspection={pickupInsp}
                        canCreate={canCreatePickupInsp}
                        showToast={showToast}
                        onRefresh={onRefresh}
                        role={role}
                    />
                    <InspectionPanel
                        key={`return-${returnInsp?.id}-${returnInsp?.is_locked}-${returnInsp?.customer_signed}`}
                        bookingId={booking.id}
                        inspectionType="RETURN"
                        existingInspection={returnInsp}
                        canCreate={false}
                        showToast={showToast}
                        onRefresh={onRefresh}
                        role={role}
                    />
                </div>
            </div>

            {/* Action Bar */}
            <div className="cd-booking-actions">
                {canSign && (
                    <div className="cd-action-block">
                        <p className="cd-action-label">Sign Agreement</p>
                        <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={() => setShowSignModal(true)}>
                            View & Sign Agreement
                        </button>
                    </div>
                )}
                {canPayNow && (
                    <div className="cd-action-block">
                        <p className="cd-action-label">Outstanding Balance</p>
                        <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={() => setShowPayment(true)}>
                            Pay Remaining ₹{remaining.toLocaleString('en-IN')}
                        </button>
                    </div>
                )}
                {canCancel && !cancelConfirm && (
                    <button className="cd-btn cd-btn--danger-outline cd-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setCancelConfirm(true)}>
                        Cancel Booking
                    </button>
                )}
                {cancelConfirm && (
                    <div className="cd-cancel-confirm" style={{ marginLeft: 'auto' }}>
                        <input className="cd-input" placeholder="Reason (optional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        <button className="cd-btn cd-btn--danger cd-btn--sm" onClick={handleCancel} disabled={cancelLoading}>
                            {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
                        </button>
                        <button className="cd-btn cd-btn--ghost cd-btn--sm" onClick={() => setCancelConfirm(false)}>Keep It</button>
                    </div>
                )}
            </div>

            {showSignModal && (
                <AgreementSignModal
                    booking={booking}
                    showToast={showToast}
                    onSigned={(info) => {
                        setLatestAcceptance({
                            agreement_version_id: info.versionId,
                            version_tag: info.versionTag,
                            accepted_at: info.acceptedAt,
                            otp_verified: true,
                            booking_ref: booking.booking_ref,
                        });
                        setShowSignModal(false);
                        onRefresh();
                    }}
                    onClose={() => setShowSignModal(false)}
                />
            )}
            {showViewModal && (
                <AgreementViewModal
                    booking={booking}
                    acceptance={latestAcceptance || {
                        agreement_version_id: detail.agreement_version_id || null,
                        version_tag: detail.agreement_version_tag || null,
                        accepted_at: detail.agreement_signed_at,
                        otp_verified: true,
                        booking_ref: booking.booking_ref,
                        user_email: null,
                    }}
                    onClose={() => setShowViewModal(false)}
                />
            )}
            {showPayment && (
                <PaymentModal booking={booking} detail={detail} onClose={() => setShowPayment(false)} onSuccess={onRefresh} showToast={showToast} />
            )}
            {showInvoice && detail.invoice && (
                <InvoiceModal invoice={detail.invoice} booking={booking} onClose={() => setShowInvoice(false)} />
            )}
        </>
    );
}

// ─────────────────────────────────────────────
// BOOKING HISTORY TAB
// ─────────────────────────────────────────────
function BookingHistoryTab({ bookings }) {
    const completed = bookings.filter(b => b.status === 'COMPLETED');
    const byYear = completed.reduce((acc, b) => {
        const y = (b.pickup_date || '').slice(0, 4) || 'Unknown';
        (acc[y] = acc[y] || []).push(b);
        return acc;
    }, {});
    const years = Object.keys(byYear).sort((a, b) => b - a);

    if (completed.length === 0) {
        return (
            <div className="cd-empty">
                <div className="cd-empty__icon"><span className="icon-calendar"></span></div>
                <h3>No trip history yet</h3>
                <p>Completed bookings will appear here.</p>
            </div>
        );
    }

    const getVehicleIcon = (segment) => <span className={`vehicle-icon ${segment || 'default'}`}></span>;

    return (
        <div className="cd-history">
            <div className="cd-history__summary">
                {[
                    [completed.length, 'Trips'],
                    [`₹${completed.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Total Spent'],
                    [new Set(completed.map(b => b.vehicle?.make)).size, 'Brands'],
                    [completed.reduce((s, b) => s + (b.rental_days || 0), 0), 'Days'],
                ].map(([val, lbl]) => (
                    <div key={lbl} className="cd-history__stat">
                        <span className="cd-history__stat-val">{val}</span>
                        <span className="cd-history__stat-lbl">{lbl}</span>
                    </div>
                ))}
            </div>
            {years.map(year => (
                <div key={year} className="cd-history__year-group">
                    <div className="cd-history__year-label">{year}</div>
                    <div className="cd-history__items">
                        {byYear[year].map(b => (
                            <div key={b.id} className="cd-history__item">
                                <div className="cd-history__item-icon">{getVehicleIcon(b.vehicle?.segment)}</div>
                                <div className="cd-history__item-body">
                                    <div className="cd-history__item-title">
                                        {b.vehicle?.year} {b.vehicle?.make} {b.vehicle?.model || b.vehicle_display || 'Vehicle'}
                                    </div>
                                    <div className="cd-history__item-meta">
                                        <span>{b.pickup_date} - {b.return_date}</span>
                                        <span>{b.rental_days}d</span>
                                    </div>
                                </div>
                                <div className="cd-history__item-right">
                                    <span className="cd-history__item-amount">₹{parseFloat(b.total_amount || 0).toLocaleString('en-IN')}</span>
                                    <span className="cd-history__item-ref">{b.booking_ref}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────
export default function CustomerDashboard() {
    const { user } = useAuth();
    const [tab, setTab] = useState('bookings');
    const [bookings, setBookings] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [loyalty, setLoyalty] = useState(null);
    const [profile, setProfile] = useState(null);
    const [pendingReviews, setPendingReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);

    const [expandedBookingId, setExpandedBookingId] = useState(null);
    const [bookingDetails, setBookingDetails] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');

    const [profileEdit, setProfileEdit] = useState(false);
    const [profileForm, setProfileForm] = useState({});
    const [profileSaving, setProfileSaving] = useState(false);

    const [reviewForms, setReviewForms] = useState({});
    const [redeemPoints, setRedeemPoints] = useState('');
    const [redeemLoading, setRedeemLoading] = useState(false);

    const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

    // useEffect(() => {
    //     const banner = document.querySelector('.cd__hero-banner');
    //     if (!banner || banner.querySelector('.snow-canvas')) return;
    //     const canvas = document.createElement('canvas');
    //     canvas.className = 'snow-canvas';
    //     canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    //     banner.prepend(canvas);
    //     const ctx = canvas.getContext('2d');
    //     let flakes = [], raf;
    //     const resize = () => { canvas.width = banner.offsetWidth; canvas.height = banner.offsetHeight; };
    //     const init = () => {
    //         flakes = Array.from({ length: 80 }, () => ({
    //             x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    //             r: Math.random() * 3 + 1, speed: Math.random() * 0.8 + 0.3,
    //             drift: (Math.random() - 0.5) * 0.4, opacity: Math.random() * 0.5 + 0.1,
    //         }));
    //     };
    //     const draw = () => {
    //         ctx.clearRect(0, 0, canvas.width, canvas.height);
    //         for (const f of flakes) {
    //             ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    //             ctx.fillStyle = `rgba(255,255,255,${f.opacity})`; ctx.fill();
    //             f.y += f.speed; f.x += f.drift;
    //             if (f.y > canvas.height + f.r) { f.y = -f.r; f.x = Math.random() * canvas.width; }
    //             if (f.x > canvas.width + f.r) f.x = -f.r;
    //             if (f.x < -f.r) f.x = canvas.width + f.r;
    //         }
    //         raf = requestAnimationFrame(draw);
    //     };
    //     resize(); init(); draw();
    //     window.addEventListener('resize', () => { resize(); init(); });
    //     return () => { cancelAnimationFrame(raf); canvas.remove(); };
    // }, []);

    const loadTab = useCallback(async (t) => {
        setLoading(true); setError('');
        try {
            if (t === 'bookings') {
                const { data } = await getMyBookings(statusFilter || undefined);
                setBookings(data.results || data);
            } else if (t === 'profile') {
                const [p, l] = await Promise.all([getCustomerProfile(), getLoyaltyBalance()]);
                setProfile(p.data); setLoyalty(l.data);
                setProfileForm({
                    full_name: p.data.full_name || '', phone: p.data.phone || '',
                    driving_licence: p.data.driving_licence || '', dl_expiry: p.data.dl_expiry || '',
                    date_of_birth: p.data.date_of_birth || '', aadhaar_number: p.data.aadhaar_number || '',
                    pan_number: p.data.pan_number || '',
                });
            } else if (t === 'loyalty') {
                const { data } = await getLoyaltyBalance();
                setLoyalty(data);
            } else if (t === 'reviews') {
                const { data } = await getPendingReviews();
                setPendingReviews(data.pending_reviews || data.results || data);
            } else if (t === 'history') {
                const { data } = await getMyBookings();
                setAllBookings(data.results || data);
            }
        } catch (e) {
            setError(`Could not load data. ${e.response?.data?.detail || ''}`);
        } finally { setLoading(false); }
    }, [statusFilter]);

    useEffect(() => { loadTab(tab); }, [tab, loadTab]);
    useEffect(() => { if (tab === 'bookings') loadTab('bookings'); }, [statusFilter]);

    useEffect(() => {
        Promise.all([getMyBookings(), getLoyaltyBalance()])
            .then(([b, l]) => { setBookings(b.data.results || b.data); setLoyalty(l.data); })
            .catch(() => { });
    }, []);

    const handleExpandBooking = async (bookingId) => {
        if (expandedBookingId === bookingId) { setExpandedBookingId(null); return; }
        setExpandedBookingId(bookingId);
        if (!bookingDetails[bookingId]) {
            setDetailLoading(true);
            try {
                const { data } = await getMyBookingDetail(bookingId);
                setBookingDetails(prev => ({ ...prev, [bookingId]: data }));
            } catch (e) {
                showToast('Could not load booking details.', 'error');
            } finally { setDetailLoading(false); }
        }
    };

    const refreshBooking = useCallback(async (bookingId) => {
        try {
            const [detailRes, listRes] = await Promise.all([
                getMyBookingDetail(bookingId),
                getMyBookings(statusFilter || undefined),
            ]);
            setBookingDetails(prev => ({ ...prev, [bookingId]: detailRes.data }));
            setBookings(listRes.data.results || listRes.data);
        } catch (e) { showToast('Could not refresh booking.', 'error'); }
    }, [statusFilter, showToast]);

    const handleProfileSave = async () => {
        setProfileSaving(true);
        try {
            await updateCustomerProfile(profileForm);
            setProfile(p => ({ ...p, ...profileForm }));
            setProfileEdit(false);
            showToast('Profile updated.');
        } catch (e) {
            showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Save failed.', 'error');
        } finally { setProfileSaving(false); }
    };

    const handleSubmitReview = async (booking) => {
        const form = reviewForms[booking.booking_id] || {};
        if (!form.vendor_rating) { showToast('Please select a vendor rating.', 'error'); return; }
        try {
            await submitReview({
                booking_id: booking.booking_id,
                vendor_rating: form.vendor_rating,
                vehicle_rating: form.vehicle_rating || form.vendor_rating,
                review_text: form.comment || '',
            });
            setReviewForms(p => ({ ...p, [booking.booking_id]: { ...p[booking.booking_id], submitted: true } }));
            setPendingReviews(p => p.filter(b => b.booking_id !== booking.booking_id));
            showToast('Review submitted. Thank you!');
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
    };

    const handleRedeem = async (e) => {
        e.preventDefault();
        const pts = parseInt(redeemPoints);
        if (!pts || pts <= 0) { showToast('Enter valid points.', 'error'); return; }
        setRedeemLoading(true);
        try {
            const { data } = await redeemLoyalty(pts);
            setLoyalty(p => ({ ...p, loyalty_points: data.new_balance ?? p.loyalty_points - pts }));
            setRedeemPoints('');
            showToast(`Redeemed ${pts} pts - ₹${data.discount_inr} discount!`);
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        finally { setRedeemLoading(false); }
    };

    const activeCount = bookings.filter(b => ['CONFIRMED', 'ACTIVE'].includes(b.status)).length;
    const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;
    const totalSpend = bookings
        .filter(b => !['CANCELLED', 'PENDING'].includes(b.status))
        .reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
    const hasAnyDuePayment = bookings.some(b => bookingDetails[b.id] && hasDuePayment(bookingDetails[b.id]));

    const getVehicleIcon = (segment) => <span className={`vehicle-icon ${segment || 'default'}`}></span>;

    return (
        <div className="cd">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            <div className="cd__shell">
                <div className="cd__inner">

                    <div className="cd__hero">
                        <div className="cd__hero-banner" />
                        <div className="cd__hero-body">
                            <div className="cd__hero-left">
                                <div className="cd__hero-avatar">
                                    {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                                </div>
                                <div className="cd__hero-info">
                                    <div className="cd__hero-name">Welcome back, {user?.full_name?.split(' ')[0] || 'there'}</div>
                                    <div className="cd__hero-sub">{user?.email}</div>
                                </div>
                            </div>
                            <div className="cd__kpis">
                                {[
                                    [activeCount, 'Active Bookings', '#1D4ED8'],
                                    [completedCount, 'Completed', '#059669'],
                                    [`₹${Math.round(totalSpend).toLocaleString('en-IN')}`, 'Total Spend', '#0DB89E'],
                                    [loyalty ? `${loyalty.loyalty_points}` : '—', 'Loyalty Pts', '#D97706'],
                                ].map(([v, l, color]) => (
                                    <div key={l} className="cd__kpi">
                                        <span className="cd__kpi-val" style={{ color }}>{v}</span>
                                        <span className="cd__kpi-lbl">{l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {hasAnyDuePayment && (
                        <div className="payment-due-banner">
                            <div className="payment-due-banner__info">
                                <div className="payment-due-banner__icon"><span className="icon-warning"></span></div>
                                <div className="payment-due-banner__text">
                                    <strong>Pending Payment</strong>
                                    <p>You have an outstanding balance on one or more bookings.</p>
                                </div>
                            </div>
                            <button
                                className="payment-due-banner__button"
                                onClick={() => {
                                    const dueBooking = bookings.find(b => bookingDetails[b.id] && hasDuePayment(bookingDetails[b.id]));
                                    if (dueBooking) handleExpandBooking(dueBooking.id);
                                }}
                            >Pay Now</button>
                        </div>
                    )}

                    {loading && tab !== 'agreements' && (
                        <div className="cd-loading"><div className="cd-spinner" /> Loading…</div>
                    )}
                    {error && <div className="cd-error">{error}</div>}

                    {!loading && tab === 'bookings' && (
                        <div className="cd-section">
                            <div className="cd-filter-bar cd-filter-bar--dropdown">
                                <span className="cd-filter-lbl">Filter by:</span>
                                <FilterDropdown
                                    label="Status"
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={[
                                        { value: '', label: 'All Bookings' },
                                        { value: 'PENDING', label: 'Pending', color: '#D97706' },
                                        { value: 'CONFIRMED', label: 'Confirmed', color: '#1D4ED8' },
                                        { value: 'ACTIVE', label: 'Active', color: '#059669' },
                                        { value: 'COMPLETED', label: 'Completed', color: '#6B7280' },
                                        { value: 'CANCELLED', label: 'Cancelled', color: '#EF4444' },
                                    ]}
                                />
                                {statusFilter && (
                                    <button className="cd-filter-clear" onClick={() => setStatusFilter('')} title="Clear filter">
                                        ✕ Clear
                                    </button>
                                )}
                            </div>

                            {bookings.length === 0 ? (
                                <div className="cd-empty">
                                    <div className="cd-empty__icon"><span className="icon-car"></span></div>
                                    <h3>No bookings {statusFilter ? `with status "${statusFilter}"` : 'yet'}</h3>
                                    {!statusFilter && <p>Browse cars and make your first booking.</p>}
                                </div>
                            ) : (
                                <div className="cd-booking-list">
                                    {bookings.map(b => {
                                        const isExpanded = expandedBookingId === b.id;
                                        const detail = bookingDetails[b.id];
                                        const hasDue = detail && hasDuePayment(detail);
                                        return (
                                            <div key={b.id} className="cd-booking-card">
                                                <div className="cd-booking-card__head" onClick={() => handleExpandBooking(b.id)}>
                                                    <div className="cd-booking-card__ref">
                                                        <span className="cd-booking-ref">{b.booking_ref}</span>
                                                        <StatusBadge status={b.status} />
                                                        {hasDue && <span className="booking-card__due-badge">Due Payment</span>}
                                                    </div>
                                                    <div className="cd-booking-card__meta">
                                                        <span>{b.vehicle_display || `${b.vehicle?.year || ''} ${b.vehicle?.make || ''} ${b.vehicle?.model || ''}`}</span>
                                                        <span>{b.pickup_date} - {b.return_date}</span>
                                                        <span>{b.rental_days}d</span>
                                                    </div>
                                                    <div className="cd-booking-card__right">
                                                        <span className="cd-booking-amt">₹{parseFloat(b.total_amount || 0).toLocaleString('en-IN')}</span>
                                                        <span className="cd-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="cd-booking-card__body">
                                                        <BookingDetailPanel
                                                            booking={b}
                                                            detail={detail}
                                                            loading={detailLoading && !detail}
                                                            onRefresh={() => refreshBooking(b.id)}
                                                            showToast={showToast}
                                                            role="customer"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && tab === 'history' && (
                        <div className="cd-section"><BookingHistoryTab bookings={allBookings} /></div>
                    )}

                    {/* {tab === 'agreements' && (
                        <div className="cd-section"><AgreementHistoryTab /></div>
                    )} */}

                    {!loading && tab === 'reviews' && (
                        <div className="cd-section">
                            {pendingReviews.length === 0 ? (
                                <div className="cd-empty">
                                    <div className="cd-empty__icon"><span className="icon-star"></span></div>
                                    <h3>All caught up!</h3>
                                    <p>No pending reviews.</p>
                                </div>
                            ) : (
                                <div className="cd-review-list">
                                    {pendingReviews.map(b => {
                                        const rf = reviewForms[b.booking_id] || {};
                                        if (rf.submitted) return null;
                                        return (
                                            <div key={b.booking_id} className="cd-review-card">
                                                <div className="cd-review-card__head">
                                                    <div>
                                                        <span className="cd-booking-ref" style={{ marginRight: 8 }}>{b.booking_ref}</span>
                                                        <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{b.vehicle_display}</span>
                                                    </div>
                                                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>Returned: {b.return_date}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                                                    <div>
                                                        <p className="cd-review-label">Vendor Rating</p>
                                                        <StarRating value={rf.vendor_rating || 0} onChange={v => setReviewForms(p => ({ ...p, [b.booking_id]: { ...p[b.booking_id], vendor_rating: v } }))} />
                                                    </div>
                                                    <div>
                                                        <p className="cd-review-label">Vehicle Rating</p>
                                                        <StarRating value={rf.vehicle_rating || 0} onChange={v => setReviewForms(p => ({ ...p, [b.booking_id]: { ...p[b.booking_id], vehicle_rating: v } }))} />
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: 12 }}>
                                                    <textarea className="cd-input cd-textarea" placeholder="Share your experience… (optional)" value={rf.comment || ''} onChange={e => setReviewForms(p => ({ ...p, [b.booking_id]: { ...p[b.booking_id], comment: e.target.value } }))} />
                                                </div>
                                                <div style={{ marginTop: 10 }}>
                                                    <button className="cd-btn cd-btn--primary" onClick={() => handleSubmitReview(b)} disabled={!rf.vendor_rating}>
                                                        Submit Review
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && tab === 'loyalty' && loyalty && (
                        <div className="cd-section">
                            <div className="cd-loyalty-layout">
                                <div className="cd-loyalty-card">
                                    <div className="cd-loyalty-card__bg" />
                                    <div className="cd-loyalty-card__top">
                                        <span className="cd-loyalty-card__star">&#9733;</span>
                                        <span className="cd-loyalty-card__brand">DriveLux Rewards</span>
                                    </div>
                                    <div className="cd-loyalty-card__pts">{loyalty.loyalty_points}</div>
                                    <div className="cd-loyalty-card__label">Points</div>
                                    <div className="cd-loyalty-card__worth">
                                        Worth <strong>₹{loyalty.total_value_inr || (loyalty.loyalty_points * parseFloat(loyalty.point_value_inr || 0.5))}</strong>
                                    </div>
                                    <div className="cd-loyalty-card__tier">
                                        {loyalty.loyalty_points >= 1000 ? 'Gold Member' : loyalty.loyalty_points >= 500 ? 'Silver Member' : 'Bronze Member'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div className="cd-card">
                                        <h3 className="cd-card__title">Redeem Points</h3>
                                        <p style={{ fontSize: 13, color: 'var(--cd-muted)', marginBottom: 14 }}>
                                            1 point = ₹{loyalty.point_value_inr || '0.50'}
                                        </p>
                                        <form onSubmit={handleRedeem} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                            <div>
                                                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--cd-muted)', display: 'block', marginBottom: 5 }}>
                                                    Points to Redeem
                                                </label>
                                                <input className="cd-input" type="number" style={{ width: 160 }} placeholder={`Max ${loyalty.loyalty_points}`} value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)} min={1} max={loyalty.loyalty_points} />
                                            </div>
                                            <button type="submit" className="cd-btn cd-btn--primary" disabled={redeemLoading || !redeemPoints}>
                                                {redeemLoading ? 'Redeeming…' : 'Redeem Now'}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && tab === 'profile' && profile && (
                        <div className="cd-section">
                            <div className="cd-profile-layout">
                                <div className="cd-card">
                                    <div className="cd-card__head">
                                        <div><h3 className="cd-card__title">Personal Information</h3></div>
                                        <button className="cd-btn cd-btn--outline cd-btn--sm" onClick={() => setProfileEdit(!profileEdit)}>
                                            {profileEdit ? 'Cancel' : 'Edit'}
                                        </button>
                                    </div>
                                    {profileEdit ? (
                                        <div className="cd-profile-form">
                                            {[
                                                ['full_name', 'Full Name', 'text'],
                                                ['phone', 'Phone Number', 'tel'],
                                                ['date_of_birth', 'Date of Birth', 'date'],
                                                ['driving_licence', 'Driving Licence No.', 'text'],
                                                ['dl_expiry', 'DL Expiry Date', 'date'],
                                                ['aadhaar_number', 'Aadhaar Number', 'text'],
                                                ['pan_number', 'PAN Number', 'text'],
                                            ].map(([k, l, t]) => (
                                                <div key={k} className="cd-form-field">
                                                    <label>{l}</label>
                                                    <input className="cd-input" type={t} value={profileForm[k] || ''} onChange={e => setProfileForm(p => ({ ...p, [k]: e.target.value }))} />
                                                </div>
                                            ))}
                                            <button className="cd-btn cd-btn--primary" onClick={handleProfileSave} disabled={profileSaving}>
                                                {profileSaving ? 'Saving…' : 'Save Changes'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="cd-profile-rows">
                                            {[
                                                ['Name', profile.full_name],
                                                ['Email', profile.email],
                                                ['Phone', profile.phone || '—'],
                                                ['Date of Birth', profile.date_of_birth || '—'],
                                                ['Driving Licence', profile.driving_licence || '—'],
                                                ['DL Expiry', profile.dl_expiry || '—'],
                                                ['Aadhaar', profile.aadhaar_number ? '••••' + profile.aadhaar_number.slice(-4) : '—'],
                                                ['PAN', profile.pan_number || '—'],
                                            ].map(([l, v]) => (
                                                <div key={l} className="cd-info-row cd-info-row--bordered">
                                                    <span className="cd-info-row__lbl">{l}</span>
                                                    <strong className="cd-info-row__val">{v}</strong>
                                                </div>
                                            ))}
                                            <div className="cd-info-row cd-info-row--bordered">
                                                <span className="cd-info-row__lbl">KYC Status</span>
                                                <span className={`cd-kyc-badge cd-kyc-badge--${profile.kyc_status || 'pending'}`}>
                                                    {profile.kyc_status === 'verified' ? 'Verified' : profile.kyc_status === 'rejected' ? 'Rejected' : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="cd-card">
                                    <h3 className="cd-card__title">KYC Status</h3>
                                    <div className={`cd-kyc-status cd-kyc-status--${profile.kyc_status || 'pending'}`}>
                                        {profile.kyc_status === 'verified' ? 'Fully Verified' : profile.kyc_status === 'rejected' ? 'Rejected' : 'Pending'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}