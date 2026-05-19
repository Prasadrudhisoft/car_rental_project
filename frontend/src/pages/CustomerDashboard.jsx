/**
 * CustomerDashboard.jsx — Table-view refactor
 *
 * Changes from original:
 * - Bookings tab → DataTable (clicking a row does NOT open detail;
 *   only the "View Booking" button opens the BookingDetailPanel modal)
 * - Reviews (pending) tab → DataTable with "Write Review" button
 * - My Reviews (submitted) tab → DataTable with "View Review" button
 * - Loyalty tab → existing card UI preserved (no table needed)
 * - Profile tab → existing form UI preserved
 * - All existing modals/panels preserved unchanged
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/common/Navbar';
import Navbar from '../components/common/Navbar';
import DataTable from '../components/common/DataTable';
import '../components/common/DataTable.css';
import {
    AgreementSignModal,
    AgreementViewModal,
} from '../components/agreements/AgreementModal';
import {
    getMyBookings, getMyBookingDetail, cancelBooking,
    getLoyaltyBalance, getCustomerProfile, updateCustomerProfile, redeemLoyalty,
    submitReview, getPendingReviews, dummyPayment,
    createInspection, signInspection, uploadInspectionPhoto,
    sendKYCPhoneOTP, verifyKYCPhoneOTP, sendKYCEmailOTP, verifyKYCEmailOTP,
    getMySubmittedReviews,
} from '../services/api';
import './CustomerDashboard.css';

// ── Constants ──────────────────────────────────────────────────────────────
const STATUS_CLR = {
    PENDING: { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
    ACTIVE: { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' },
    COMPLETED: { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
    CANCELLED: { bg: '#FEE2E2', color: '#EF4444', border: '#FCA5A5' },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDatetime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ── Small reusable components ──────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const s = STATUS_CLR[status] || { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            {status}
        </span>
    );
};

const InfoRow = ({ label, value, highlight }) => (
    <div className="cd-info-row">
        <span className="cd-info-row__lbl">{label}</span>
        <strong className="cd-info-row__val" style={highlight ? { color: 'var(--cd-acc)', fontSize: 15 } : {}}>{value || '—'}</strong>
    </div>
);

const Toast = ({ msg, type, onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
    return (
        <div className={`cd-toast cd-toast--${type}`}>
            {type === 'success'
                ? <span className="toast-icon success">&#10003;</span>
                : <span className="toast-icon warning">!</span>}
            {msg}
        </div>
    );
};

const StarRating = ({ value, onChange, readonly }) => (
    <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => !readonly && onChange?.(n)}
                style={{ background: 'none', border: 'none', cursor: readonly ? 'default' : 'pointer', fontSize: 22, color: n <= value ? '#E8A020' : '#D1D5DB', padding: 0, transition: 'color 0.15s' }}>
                &#9733;
            </button>
        ))}
    </div>
);

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
                <img src={photos[current].image} alt={photos[current].angle || 'inspection'} style={{ maxWidth: 'min(80vw, 900px)', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12 }} />
                <button onClick={() => setCurrent(c => Math.min(c + 1, photos.length - 1))} disabled={current === photos.length - 1} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 18, cursor: current === photos.length - 1 ? 'not-allowed' : 'pointer', opacity: current === photos.length - 1 ? 0.3 : 1 }}>›</button>
            </div>
        </div>
    );
};

// ── KYC OTP Modal ──────────────────────────────────────────────────────────
function KYCVerifyModal({ type, value, userEmail, onClose, onVerified, showToast }) {
    const [step, setStep] = useState('idle');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const isPhone = type === 'phone';
    const label = isPhone ? 'Phone Number' : 'Email Address';

    const handleSend = async () => {
        setStep('sending'); setError('');
        try {
            if (isPhone) await sendKYCPhoneOTP(value, userEmail);
            else await sendKYCEmailOTP(value);
            setStep('sent');
            showToast(`OTP sent to your ${label.toLowerCase()}.`);
        } catch (e) {
            setError(e.response?.data?.error || `Failed to send OTP.`);
            setStep('idle');
        }
    };

    const handleVerify = async () => {
        if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
        setStep('verifying'); setError('');
        try {
            if (isPhone) await verifyKYCPhoneOTP(userEmail, otp);
            else await verifyKYCEmailOTP(value, otp);
            setStep('done');
            showToast(`${label} verified successfully!`);
            setTimeout(() => onVerified(), 600);
        } catch (e) {
            setError(e.response?.data?.error || 'Invalid OTP. Please try again.');
            setStep('sent');
        }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal" style={{ maxWidth: 420 }}>
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Verify {label}</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>{isPhone ? `📱 ${value}` : `✉ ${value}`}</p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>
                <div className="cd-modal__body">
                    {step === 'done' ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', border: '2px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>✓</div>
                            <h3 style={{ fontWeight: 700, color: '#059669' }}>{label} Verified!</h3>
                        </div>
                    ) : (
                        <>
                            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#92400E' }}>
                                <strong>Dev Mode:</strong> OTP is <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>123456</span>.
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--cd-txt2)' }}>We'll send a one-time code to your {label.toLowerCase()}.</p>
                            {step === 'idle' && <button className="cd-btn cd-btn--primary" onClick={handleSend} style={{ width: '100%', justifyContent: 'center' }}>Send OTP</button>}
                            {step === 'sending' && <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cd-muted)', fontSize: 13 }}><div className="cd-spinner" /> Sending OTP…</div>}
                            {step === 'sent' && (
                                <>
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--cd-muted)', display: 'block', marginBottom: 7 }}>Enter 6-digit OTP</label>
                                        <input className="cd-input" style={{ textAlign: 'center', letterSpacing: '8px', fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }} maxLength={6} placeholder="——————" value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} autoFocus />
                                    </div>
                                    <button className="cd-btn cd-btn--primary" onClick={handleVerify} disabled={otp.length !== 6} style={{ width: '100%', justifyContent: 'center' }}>Verify OTP</button>
                                    <button className="cd-btn cd-btn--ghost" onClick={handleSend} style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>Resend OTP</button>
                                </>
                            )}
                            {step === 'verifying' && <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cd-muted)', fontSize: 13 }}><div className="cd-spinner" /> Verifying…</div>}
                            {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#B91C1C' }}>{error}</div>}
                        </>
                    )}
                </div>
                {step !== 'done' && <div className="cd-modal__foot"><button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button></div>}
            </div>
        </div>
    );
}

// ── Payment Modal ──────────────────────────────────────────────────────────
function PaymentModal({ booking, detail, onClose, onSuccess, showToast }) {
    const [method, setMethod] = useState('online');
    const [loading, setLoading] = useState(false);
    const pricing = detail?.pricing_snapshot || {};
    const grandTotal = parseFloat(pricing.grand_total || booking.total_amount || 0);
    const deposit = parseFloat(pricing.security_deposit || detail?.deposit_amount || 0);
    const advancePct = 30;
    const advanceAmt = Math.round((grandTotal * advancePct) / 100);
    const remaining = grandTotal - advanceAmt;
    const advancePaid = pricing.advance_paid || false;
    const remainingPaid = pricing.remaining_paid || false;
    const fullPaid = pricing.full_payment_paid || (advancePaid && remainingPaid);
    const canPayRemaining = advancePaid && !remainingPaid && !fullPaid;
    const payableNow = canPayRemaining ? remaining : advanceAmt;

    const handlePay = async () => {
        setLoading(true);
        try {
            const pt = canPayRemaining ? 'remaining' : 'advance';
            const { data } = await dummyPayment(booking.id, { payment_type: pt, method });
            showToast(data.message || 'Payment successful!');
            onSuccess?.(); onClose();
        } catch (e) { showToast(e.response?.data?.error || 'Payment failed.', 'error'); }
        finally { setLoading(false); }
    };

    if (fullPaid || (advancePaid && remainingPaid)) {
        return (
            <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="cd-modal">
                    <div className="cd-modal__head"><h3 className="cd-modal__title">Payment</h3><button className="cd-modal__close" onClick={onClose}>&times;</button></div>
                    <div className="cd-modal__body" style={{ alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', border: '2px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>✓</div>
                        <h3 style={{ fontWeight: 700 }}>Fully Paid</h3>
                        <p style={{ color: 'var(--cd-muted)', marginTop: 8 }}>Grand Total ₹{grandTotal.toLocaleString('en-IN')} — all payments received.</p>
                    </div>
                    <div className="cd-modal__foot"><button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button></div>
                </div>
            </div>
        );
    }

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal">
                <div className="cd-modal__head"><h3 className="cd-modal__title">Payment</h3><button className="cd-modal__close" onClick={onClose}>&times;</button></div>
                <div className="cd-modal__body">
                    <div className="cd-payment-breakdown">
                        <div className="cd-payment-breakdown__row"><span>Grand Total</span><strong>₹{grandTotal.toLocaleString('en-IN')}</strong></div>
                        <div className="cd-payment-breakdown__row"><span>Security Deposit</span><span className="cd-muted-val">₹{deposit.toLocaleString('en-IN')}</span></div>
                        <div className="cd-payment-breakdown__divider" />
                        <div className="cd-payment-breakdown__row" style={advancePaid ? { opacity: 0.5 } : {}}><span>Advance ({advancePct}%)</span><strong style={advancePaid ? { color: '#059669' } : {}}>{advancePaid ? 'Paid' : `₹${advanceAmt.toLocaleString('en-IN')}`}</strong></div>
                        <div className="cd-payment-breakdown__row" style={remainingPaid ? { opacity: 0.5 } : {}}><span>Remaining (70%)</span><strong style={remainingPaid ? { color: '#059669' } : {}}>{remainingPaid ? 'Paid' : `₹${remaining.toLocaleString('en-IN')}`}</strong></div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--cd-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Payment Method</p>
                        <div className="cd-payment-modes">
                            {[['online', 'Online Payment', 'UPI, Cards, Net Banking'], ['cash', 'Cash', 'Pay at vendor location']].map(([val, label, sub]) => (
                                <button key={val} className={`cd-payment-mode${method === val ? ' active' : ''}`} onClick={() => setMethod(val)}>
                                    <span className={`payment-icon ${val}`}></span>
                                    <div><strong>{label}</strong><small>{sub}</small></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button>
                    <button className="cd-btn cd-btn--primary" onClick={handlePay} disabled={loading}>{loading ? 'Processing…' : `Pay ₹${payableNow.toLocaleString('en-IN')} Now`}</button>
                </div>
            </div>
        </div>
    );
}

// ── Invoice Modal ──────────────────────────────────────────────────────────
function InvoiceModal({ invoice, booking, onClose }) {
    if (!invoice) return null;
    const lines = [
        ['Invoice Reference', invoice.invoice_ref],
        ['Base Rental', `₹${parseFloat(invoice.base_amount || 0).toLocaleString('en-IN')}`],
        ['Add-ons', `₹${parseFloat(invoice.addon_amount || 0).toLocaleString('en-IN')}`],
        ['CGST', `₹${parseFloat(invoice.cgst_amount || 0).toLocaleString('en-IN')}`],
        ['SGST', `₹${parseFloat(invoice.sgst_amount || 0).toLocaleString('en-IN')}`],
        ['Grand Total', `₹${parseFloat(invoice.total_amount || 0).toLocaleString('en-IN')}`],
        ['Deposit Status', invoice.deposit_status?.toUpperCase() || '—'],
    ];
    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal">
                <div className="cd-modal__head">
                    <div><h3 className="cd-modal__title">Invoice</h3><p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>Booking: {booking?.booking_ref}</p></div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>
                <div className="cd-modal__body">
                    <div className="cd-invoice-header">
                        <div><div className="cd-invoice-brand">RudhiDrive</div><div style={{ fontSize: 12, color: 'var(--cd-muted)' }}>GST Invoice</div></div>
                        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--cd-acc)', fontFamily: 'DM Mono, monospace' }}>{invoice.invoice_ref}</div></div>
                    </div>
                    <div className="cd-invoice-lines">
                        {lines.filter(([, v]) => v && v !== '₹0').map(([l, v]) => (
                            <div key={l} className={`cd-invoice-line${l === 'Grand Total' ? ' cd-invoice-line--total' : ''}`}><span>{l}</span><strong>{v}</strong></div>
                        ))}
                    </div>
                </div>
                <div className="cd-modal__foot"><button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button></div>
            </div>
        </div>
    );
}

// ── Inspection Panel (unchanged from original) ─────────────────────────────
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

    if (existingInspection?.is_locked) {
        const photos = existingInspection.photos || [];
        const infoRows = [
            ['Odometer', `${existingInspection.odometer_reading} km`],
            ['Fuel Level', existingInspection.fuel_level],
            ['Customer Signed', existingInspection.customer_signed ? 'Yes' : 'Pending'],
            ['Vendor Signed', existingInspection.vendor_signed ? 'Yes' : 'Pending'],
            ...(existingInspection.notes ? [['Notes', existingInspection.notes]] : []),
            ...(existingInspection.damage_reported ? [['Damage', existingInspection.damage_notes || 'Reported']] : []),
        ];
        return (
            <div style={{ border: '1px solid var(--cd-bdr)', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isPickup ? '#EFF6FF' : '#F0FDF4', borderBottom: expanded ? '1px solid var(--cd-bdr)' : 'none', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`insp-icon ${isPickup ? 'pickup' : 'dropoff'}`}></span>
                        <strong style={{ fontSize: 13 }}>{label} Inspection</strong>
                        <span style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Locked</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {infoRows.map(([l, v]) => <div key={l} className="cd-info-row" style={{ fontSize: 13 }}><span className="cd-info-row__lbl">{l}</span><strong>{v}</strong></div>)}
                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                {photos.map((ph, idx) => <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}><img src={ph.image} alt="insp" style={{ width: 70, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--cd-bdr)', display: 'block' }} /></div>)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (isPickup && isCustomer && existingInspection && !existingInspection.is_locked) {
        const handleVerifyOtp = async () => {
            if (otpCode.length !== 6) { showToast('Enter 6-digit OTP.', 'error'); return; }
            setOtpBusy(true);
            try { await signInspection(bookingId, 'pickup', 'verify', otpCode); showToast('Pickup verified! Trip is now ACTIVE.'); setOtpCode(''); onRefresh(); }
            catch (e) { showToast(e.response?.data?.error || 'Invalid OTP.', 'error'); }
            setOtpBusy(false);
        };
        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="insp-icon pickup"></span>
                        <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Enter OTP from Vendor</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#DBEAFE', border: '1px solid #93C5FD', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                            <strong>Enter OTP from Vendor</strong>
                            <p style={{ marginTop: 4, fontSize: 12, color: '#1D4ED8' }}>Ask the vendor for the OTP and enter it below to start your trip.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input className="cd-input" style={{ width: 140, textAlign: 'center', letterSpacing: '6px', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }} maxLength={6} placeholder="——————" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
                            <button className="cd-btn cd-btn--primary" onClick={handleVerifyOtp} disabled={otpBusy || otpCode.length !== 6}>{otpBusy ? 'Verifying…' : 'Verify & Start Trip'}</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (!isPickup && isCustomer && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];
        const handleGenerateOtp = async () => {
            setOtpBusy(true);
            try { const { data } = await signInspection(bookingId, 'return', 'generate', null); setVendorOtpDisplay(data.otp_code); showToast('OTP generated! Share with the vendor.', 'success'); }
            catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
            setOtpBusy(false);
        };
        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="insp-icon dropoff"></span>
                        <strong style={{ fontSize: 13 }}>Drop-off Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Review & Generate OTP</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#F8FAFB', border: '1px solid var(--cd-bdr)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                                {existingInspection.damage_reported && <span style={{ color: '#EF4444' }}>Damage: <strong>{existingInspection.damage_notes}</strong></span>}
                            </div>
                        </div>
                        {photos.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{photos.map((ph, idx) => <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}><img src={ph.image} alt="insp" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--cd-bdr)', display: 'block' }} /></div>)}</div>}
                        {!vendorOtpDisplay ? (
                            <button className="cd-btn cd-btn--primary" onClick={handleGenerateOtp} disabled={otpBusy}>{otpBusy ? 'Generating…' : 'Generate OTP for Vendor'}</button>
                        ) : (
                            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                                <p style={{ fontSize: 12, color: '#059669', marginBottom: 10, fontWeight: 600 }}>Share this OTP with the vendor:</p>
                                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 10, fontFamily: 'monospace', color: '#059669' }}>{vendorOtpDisplay}</div>
                                <button className="cd-btn cd-btn--ghost cd-btn--sm" style={{ marginTop: 10 }} onClick={handleGenerateOtp} disabled={otpBusy}>Generate New OTP</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (!canCreate) {
        return (
            <div style={{ border: '1px dashed var(--cd-bdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--cd-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`insp-icon ${isPickup ? 'pickup' : 'dropoff'}`}></span>
                <span>{isPickup ? 'Pickup inspection — available after booking confirmed and agreement signed.' : 'Drop-off inspection — filled by vendor when you return the vehicle.'}</span>
            </div>
        );
    }

    if (!isPickup) return (
        <div style={{ border: '1px dashed var(--cd-bdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--cd-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="insp-icon dropoff"></span>
            <span>Drop-off inspection is recorded by the vendor when you return the vehicle.</span>
        </div>
    );

    const handleSave = async () => {
        if (!form.odometer_reading) { showToast('Odometer reading is required.', 'error'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('odometer_reading', form.odometer_reading); fd.append('fuel_level', form.fuel_level);
            fd.append('notes', form.notes); fd.append('checklist', JSON.stringify({ exterior: true, interior: true, tyres: true, documents: true }));
            const { data: inspData } = await createInspection(bookingId, 'pickup', fd);
            if (photoFile && inspData?.inspection_id) {
                const pfd = new FormData(); pfd.append('image', photoFile); pfd.append('angle', 'other');
                try { await uploadInspectionPhoto(inspData.inspection_id, pfd); } catch { showToast('Inspection saved, but photo upload failed.', 'error'); }
            }
            showToast('Pickup inspection submitted!'); onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        setSaving(false);
    };

    return (
        <div style={{ border: '1px solid var(--cd-acc)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--cd-acc-l)', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="insp-icon pickup"></span>
                    <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                    <span style={{ background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #93C5FD', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Ready to Fill</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>{expanded ? 'Hide' : 'Fill Form'}</span>
            </div>
            {expanded && (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="cd-form-field"><label>Odometer Reading (km) *</label><input className="cd-input" type="number" value={form.odometer_reading} onChange={e => setForm(p => ({ ...p, odometer_reading: e.target.value }))} placeholder="e.g. 45230" /></div>
                        <div className="cd-form-field"><label>Fuel Level</label><select className="cd-input" value={form.fuel_level} onChange={e => setForm(p => ({ ...p, fuel_level: e.target.value }))}>{['empty', 'quarter', 'half', 'three_quarter', 'full'].map(v => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}</select></div>
                    </div>
                    <div className="cd-form-field"><label>Notes (optional)</label><textarea className="cd-input cd-textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any observations…" /></div>
                    <div className="cd-form-field"><label>Upload Photo (optional)</label><input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} /></div>
                    <button className="cd-btn cd-btn--primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Submit Pickup Inspection'}</button>
                </div>
            )}
        </div>
    );
}

// ── Booking Detail Panel (modal overlay) ──────────────────────────────────
function BookingDetailPanel({ booking, detail, loading: detailLoading, onRefresh, showToast, onClose, role = 'customer' }) {
    const [showPayment, setShowPayment] = useState(false);
    const [showInvoice, setShowInvoice] = useState(false);
    const [showSignModal, setShowSignModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [latestAcceptance, setLatestAcceptance] = useState(null);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);

    const pricing = detail?.pricing_snapshot || {};
    const v = detail?.vehicle || {};
    const vendor = detail?.vendor || {};
    const grandTotal = parseFloat(pricing.grand_total || detail?.total_amount || 0);
    const advancePct = 30;
    const advanceAmt = Math.round((grandTotal * advancePct) / 100);
    const remaining = grandTotal - advanceAmt;
    const advancePaid = pricing.advance_paid || detail?.payment_captured || false;
    const remainingPaid = pricing.remaining_paid || false;
    const fullPaid = pricing.full_payment_paid || (advancePaid && remainingPaid);
    const deposit = parseFloat(pricing.security_deposit || detail?.deposit_amount || 0);
    const canSign = booking.status === 'CONFIRMED' && !detail?.agreement_signed;
    const canPayNow = !fullPaid && advancePaid && !remainingPaid;
    const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status);
    const canCreatePickupInsp = ['CONFIRMED'].includes(booking.status) && detail?.agreement_signed && !(detail?.inspections || []).find(i => i.inspection_type === 'PICKUP');
    const pickupInsp = (detail?.inspections || []).find(i => i.inspection_type === 'PICKUP');
    const returnInsp = (detail?.inspections || []).find(i => i.inspection_type === 'RETURN');

    const handleCancel = async () => {
        setCancelLoading(true);
        try {
            const { data } = await cancelBooking(booking.id, cancelReason || 'Customer requested cancellation');
            showToast(`Booking cancelled. Refund: ₹${data.refund_amount}`);
            setCancelConfirm(false); onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Could not cancel.', 'error'); }
        finally { setCancelLoading(false); }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal cd-modal--lg" style={{ maxWidth: 860, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="cd-modal__head" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: 'var(--cd-acc)' }}>{booking.booking_ref}</span>
                        <StatusBadge status={booking.status} />
                        {detail?.agreement_signed && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>✍ Signed</span>}
                        {booking.is_one_way && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EDE9FE', color: '#7C3AED', border: '1px solid #C4B5FD' }}>ONE-WAY</span>}
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {detailLoading && <div className="cd-detail-loading"><div className="cd-spinner" /> Loading details…</div>}

                    {!detailLoading && detail && (
                        <>
                            {/* Vehicle card */}
                            <div className="cd-detail-vehicle-card">
                                <div className="cd-detail-vehicle-icon"><span className={`vehicle-icon ${v.segment || 'default'}`}></span></div>
                                <div className="cd-detail-vehicle-info">
                                    <h4>{v.year} {v.make} {v.model}</h4>
                                    <div className="cd-detail-vehicle-meta">
                                        <span>{v.plate_number}</span><span>{v.fuel_type}</span><span>{v.transmission}</span><span>{v.capacity} seats</span>
                                        {v.is_certified && <span className="cd-cert-tag">Certified</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 4 }}>{vendor.vendor_profile?.business_name || vendor.full_name || '—'}</div>
                                </div>
                                <div className="cd-detail-status-col">
                                    <StatusBadge status={booking.status} />
                                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>₹{parseFloat(detail.total_amount || 0).toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: 11, color: 'var(--cd-muted)' }}>Total</div>
                                </div>
                            </div>

                            {/* Info grid */}
                            <div className="cd-detail-grid">
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Trip Details</div>
                                    <InfoRow label="Booking Ref" value={booking.booking_ref} />
                                    <InfoRow label="Pickup" value={`${detail.pickup_date}${detail.pickup_time ? ' @ ' + detail.pickup_time : ''}`} />
                                    <InfoRow label="Return" value={`${detail.return_date}${detail.return_time ? ' @ ' + detail.return_time : ''}`} />
                                    <InfoRow label="Duration" value={`${detail.rental_days} day(s)`} />
                                    <InfoRow label="Pickup At" value={detail.pickup_location_detail?.name || '—'} />
                                    {detail.is_one_way && <InfoRow label="Return At" value={detail.return_location_detail?.name || '—'} />}
                                </div>
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Payment Status</div>
                                    <InfoRow label="Grand Total" value={`₹${grandTotal.toLocaleString('en-IN')}`} highlight />
                                    <InfoRow label={`Advance (${advancePct}%)`} value={advancePaid ? `Paid — ₹${advanceAmt.toLocaleString('en-IN')}` : `Due — ₹${advanceAmt.toLocaleString('en-IN')}`} />
                                    <InfoRow label="Remaining (70%)" value={(fullPaid || remainingPaid) ? `Paid — ₹${remaining.toLocaleString('en-IN')}` : `Due — ₹${remaining.toLocaleString('en-IN')}`} />
                                    <InfoRow label="Security Deposit" value={`₹${deposit.toLocaleString('en-IN')} (${detail.deposit_released ? 'Released' : detail.deposit_held ? 'Held' : 'Pending'})`} />
                                    {detail.invoice && <button className="cd-btn cd-btn--outline cd-btn--sm" style={{ marginTop: 8 }} onClick={() => setShowInvoice(true)}>View Invoice</button>}
                                </div>
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Rental Agreement</div>
                                    <InfoRow label="Status" value={detail.agreement_signed ? 'Signed' : 'Not Signed'} />
                                    {detail.agreement_signed_at && <InfoRow label="Signed On" value={fmtDatetime(detail.agreement_signed_at)} />}
                                    {detail.agreement_signed && <button className="cd-btn cd-btn--ghost cd-btn--sm" onClick={() => setShowViewModal(true)}>View Signed Agreement</button>}
                                </div>
                                <div className="cd-info-group">
                                    <div className="cd-info-group__title">Pricing Breakdown</div>
                                    <InfoRow label="Daily Rate" value={`₹${parseFloat(pricing.daily_rate || 0).toLocaleString('en-IN')}/day`} />
                                    <InfoRow label="Base Rental" value={`₹${parseFloat(pricing.base_amount || 0).toLocaleString('en-IN')}`} />
                                    <InfoRow label="GST (18%)" value={`₹${parseFloat(pricing.gst_amount || 0).toLocaleString('en-IN')}`} />
                                </div>
                            </div>

                            {/* Inspections */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--cd-muted)' }}>Inspections</div>
                                <div className="cd-inspection-grid">
                                    <InspectionPanel key={`pickup-${pickupInsp?.id}-${pickupInsp?.is_locked}`} bookingId={booking.id} inspectionType="PICKUP" existingInspection={pickupInsp} canCreate={canCreatePickupInsp} showToast={showToast} onRefresh={onRefresh} role={role} />
                                    <InspectionPanel key={`return-${returnInsp?.id}-${returnInsp?.is_locked}`} bookingId={booking.id} inspectionType="RETURN" existingInspection={returnInsp} canCreate={false} showToast={showToast} onRefresh={onRefresh} role={role} />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="cd-booking-actions">
                                {canSign && (
                                    <div className="cd-action-block">
                                        <p className="cd-action-label">Sign Agreement</p>
                                        <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={() => setShowSignModal(true)}>View & Sign Agreement</button>
                                    </div>
                                )}
                                {canPayNow && (
                                    <div className="cd-action-block">
                                        <p className="cd-action-label">Outstanding Balance</p>
                                        <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={() => setShowPayment(true)}>Pay Remaining ₹{remaining.toLocaleString('en-IN')}</button>
                                    </div>
                                )}
                                {canCancel && !cancelConfirm && <button className="cd-btn cd-btn--danger-outline cd-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setCancelConfirm(true)}>Cancel Booking</button>}
                                {cancelConfirm && (
                                    <div className="cd-cancel-confirm" style={{ marginLeft: 'auto' }}>
                                        <input className="cd-input" placeholder="Reason (optional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                                        <button className="cd-btn cd-btn--danger cd-btn--sm" onClick={handleCancel} disabled={cancelLoading}>{cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}</button>
                                        <button className="cd-btn cd-btn--ghost cd-btn--sm" onClick={() => setCancelConfirm(false)}>Keep It</button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer close button */}
                <div className="cd-modal__foot"><button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button></div>

                {showSignModal && (
                    <AgreementSignModal
                        booking={booking}
                        showToast={showToast}
                        onSigned={(info) => {
                            setLatestAcceptance({ agreement_version_id: info.versionId, version_tag: info.versionTag, accepted_at: info.acceptedAt, otp_verified: true, booking_ref: booking.booking_ref });
                            setShowSignModal(false); onRefresh();
                        }}
                        onClose={() => setShowSignModal(false)}
                    />
                )}
                {showViewModal && (
                    <AgreementViewModal
                        booking={booking}
                        acceptance={latestAcceptance || { agreement_version_id: null, version_tag: null, accepted_at: detail?.agreement_signed_at, otp_verified: true, booking_ref: booking.booking_ref, user_email: null }}
                        onClose={() => setShowViewModal(false)}
                    />
                )}
                {showPayment && <PaymentModal booking={booking} detail={detail} onClose={() => setShowPayment(false)} onSuccess={onRefresh} showToast={showToast} />}
                {showInvoice && detail?.invoice && <InvoiceModal invoice={detail.invoice} booking={booking} onClose={() => setShowInvoice(false)} />}
            </div>
        </div>
    );
}

// ── Write Review Modal ─────────────────────────────────────────────────────
function WriteReviewModal({ booking, onClose, onSubmitted, showToast }) {
    const [vendorRating, setVendorRating] = useState(0);
    const [vehicleRating, setVehicleRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!vendorRating) { showToast('Please select a vendor rating.', 'error'); return; }
        setSubmitting(true);
        try {
            await submitReview({ booking_id: booking.booking_id, vendor_rating: vendorRating, vehicle_rating: vehicleRating || vendorRating, review_text: comment });
            showToast('Review submitted. Thank you!');
            onSubmitted(booking.booking_id);
            onClose();
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Write a Review</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>{booking.vehicle_display} · {booking.booking_ref}</p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>
                <div className="cd-modal__body">
                    <div>
                        <p className="cd-review-label">Vendor Rating *</p>
                        <StarRating value={vendorRating} onChange={setVendorRating} />
                    </div>
                    <div>
                        <p className="cd-review-label">Vehicle Rating</p>
                        <StarRating value={vehicleRating} onChange={setVehicleRating} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--cd-muted)', display: 'block', marginBottom: 6 }}>Your Experience (optional)</label>
                        <textarea className="cd-input cd-textarea" placeholder="Share your experience…" value={comment} onChange={e => setComment(e.target.value)} />
                    </div>
                </div>
                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button>
                    <button className="cd-btn cd-btn--primary" onClick={handleSubmit} disabled={submitting || !vendorRating}>{submitting ? 'Submitting…' : 'Submit Review'}</button>
                </div>
            </div>
        </div>
    );
}

// ── View Submitted Review Modal ────────────────────────────────────────────
function ViewReviewModal({ review: r, onClose }) {
    const stars = (val, size = 20) => (
        <span style={{ display: 'inline-flex', gap: 1 }}>
            {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: size, color: n <= (val || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>)}
        </span>
    );
    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Your Review</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>{r.vehicle_display} · {r.booking_ref}</p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>
                <div className="cd-modal__body">
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                        <div>
                            <p className="cd-review-label">Vendor Rating</p>
                            {stars(r.vendor_rating)}
                        </div>
                        <div>
                            <p className="cd-review-label">Vehicle Rating</p>
                            {stars(r.vehicle_rating)}
                        </div>
                    </div>
                    <div className="cd-info-row cd-info-row--bordered"><span className="cd-info-row__lbl">Vehicle</span><strong>{r.vehicle_display || '—'}</strong></div>
                    <div className="cd-info-row cd-info-row--bordered"><span className="cd-info-row__lbl">Submitted</span><strong>{r.created_at ? fmtDate(r.created_at) : r.return_date ? `Returned: ${r.return_date}` : '—'}</strong></div>
                    {r.review_text && (
                        <div style={{ background: 'var(--cd-surf2)', border: '1px solid var(--cd-bdr)', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontStyle: 'italic', color: 'var(--cd-txt2)', lineHeight: 1.65 }}>
                            "{r.review_text}"
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>✓ Submitted</span>
                    </div>
                </div>
                <div className="cd-modal__foot"><button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button></div>
            </div>
        </div>
    );
}

// ── FilterDropdown (kept for compatibility) ────────────────────────────────
function FilterDropdown({ label, value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
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

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
export default function CustomerDashboard() {
    const { user } = useAuth();
    const [tab, setTab] = useState('bookings');
    const [bookings, setBookings] = useState([]);
    const [loyalty, setLoyalty] = useState(null);
    const [profile, setProfile] = useState(null);
    const [pendingReviews, setPendingReviews] = useState([]);
    const [submittedReviews, setSubmittedReviews] = useState([]);
    const [submittedReviewsLoading, setSubmittedReviewsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);

    const [bookingDetails, setBookingDetails] = useState({});
    const [detailLoading, setDetailLoading] = useState(false);

    const [profileEdit, setProfileEdit] = useState(false);
    const [profileForm, setProfileForm] = useState({});
    const [profileSaving, setProfileSaving] = useState(false);

    const [redeemPoints, setRedeemPoints] = useState('');
    const [redeemLoading, setRedeemLoading] = useState(false);

    // Modals — only opened via DataTable "View Booking" / action button
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [selectedPendingReview, setSelectedPendingReview] = useState(null);
    const [selectedSubmittedReview, setSelectedSubmittedReview] = useState(null);
    const [kycModal, setKycModal] = useState(null);

    const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

    const loadSubmittedReviews = useCallback(async () => {
        setSubmittedReviewsLoading(true);
        try {
            const { data: completedData } = await getMyBookings('COMPLETED');
            const completedList = completedData.results || completedData;
            const detailPromises = completedList.slice(0, 20).map(b => getMyBookingDetail(b.id).then(r => r.data).catch(() => null));
            const details = (await Promise.all(detailPromises)).filter(Boolean);
            const { data } = await getMySubmittedReviews(details);
            setSubmittedReviews(data.results || []);
        } catch { showToast('Could not load submitted reviews.', 'error'); }
        finally { setSubmittedReviewsLoading(false); }
    }, [showToast]);

    const loadTab = useCallback(async (t) => {
        setLoading(true); setError('');
        try {
            if (t === 'bookings') {
                const { data } = await getMyBookings();
                setBookings(data.results || data);
            } else if (t === 'profile') {
                const [p, l] = await Promise.all([getCustomerProfile(), getLoyaltyBalance()]);
                setProfile(p.data); setLoyalty(l.data);
                setProfileForm({ full_name: p.data.full_name || '', phone: p.data.phone || '', driving_licence: p.data.driving_licence || '', dl_expiry: p.data.dl_expiry || '', date_of_birth: p.data.date_of_birth || '', aadhaar_number: p.data.aadhaar_number || '', pan_number: p.data.pan_number || '' });
            } else if (t === 'loyalty') {
                const { data } = await getLoyaltyBalance(); setLoyalty(data);
            } else if (t === 'reviews') {
                const { data } = await getPendingReviews();
                setPendingReviews(data.pending_reviews || data.results || data);
            } else if (t === 'my-reviews') {
                await loadSubmittedReviews();
            }
        } catch (e) { setError(`Could not load data. ${e.response?.data?.detail || ''}`); }
        finally { setLoading(false); }
    }, [loadSubmittedReviews]);

    useEffect(() => { loadTab(tab); }, [tab, loadTab]);
    useEffect(() => {
        Promise.all([getMyBookings(), getLoyaltyBalance()])
            .then(([b, l]) => { setBookings(b.data.results || b.data); setLoyalty(l.data); })
            .catch(() => { });
    }, []);

    // Open booking detail modal (only via button)
    const openBookingDetail = async (booking) => {
        setSelectedBooking(booking);
        if (!bookingDetails[booking.id]) {
            setDetailLoading(true);
            try {
                const { data } = await getMyBookingDetail(booking.id);
                setBookingDetails(prev => ({ ...prev, [booking.id]: data }));
            } catch { showToast('Could not load booking details.', 'error'); }
            finally { setDetailLoading(false); }
        }
    };

    const refreshBooking = useCallback(async (bookingId) => {
        try {
            const [detailRes, listRes] = await Promise.all([getMyBookingDetail(bookingId), getMyBookings()]);
            setBookingDetails(prev => ({ ...prev, [bookingId]: detailRes.data }));
            setBookings(listRes.data.results || listRes.data);
            // Keep selected booking up to date
            setSelectedBooking(prev => prev?.id === bookingId ? { ...prev, ...listRes.data.results?.find(b => b.id === bookingId) } : prev);
        } catch { showToast('Could not refresh booking.', 'error'); }
    }, [showToast]);

    const handleProfileSave = async () => {
        setProfileSaving(true);
        try {
            await updateCustomerProfile(profileForm);
            setProfile(p => ({ ...p, ...profileForm }));
            setProfileEdit(false); showToast('Profile updated.');
        } catch (e) { showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Save failed.', 'error'); }
        finally { setProfileSaving(false); }
    };

    const handleKYCVerified = async (type) => {
        setKycModal(null);
        try { const { data } = await getCustomerProfile(); setProfile(data); } catch { }
        showToast(`${type === 'phone' ? 'Phone number' : 'Email address'} verified successfully!`);
    };

    const handleRedeem = async (e) => {
        e.preventDefault();
        const pts = parseInt(redeemPoints);
        if (!pts || pts <= 0) { showToast('Enter valid points.', 'error'); return; }
        setRedeemLoading(true);
        try {
            const { data } = await redeemLoyalty(pts);
            setLoyalty(p => ({ ...p, loyalty_points: data.new_balance ?? p.loyalty_points - pts }));
            setRedeemPoints(''); showToast(`Redeemed ${pts} pts - ₹${data.discount_inr} discount!`);
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        finally { setRedeemLoading(false); }
    };

    const activeCount = bookings.filter(b => ['CONFIRMED', 'ACTIVE'].includes(b.status)).length;
    const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;
    const totalSpend = bookings.filter(b => !['CANCELLED', 'PENDING'].includes(b.status)).reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

    // ── Column definitions ─────────────────────────────────────────────────

    const bookingColumns = [
        {
            key: 'booking_ref', label: 'Booking Ref', sortable: true, width: 150,
            render: v => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--cd-acc)' }}>{v}</span>,
        },
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || `${row.vehicle?.make || ''} ${row.vehicle?.model || ''}`.trim() || '—'}</span>
                    <span className="dt-cell-stack__secondary" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{row.vehicle?.plate_number || ''}</span>
                </div>
            ),
        },
        {
            key: 'status', label: 'Status', sortable: true, width: 110,
            render: val => <StatusBadge status={val} />,
        },
        { key: 'pickup_date', label: 'Pickup', sortable: true, width: 100, render: v => v || '—' },
        { key: 'return_date', label: 'Return', sortable: true, width: 100, render: v => v || '—' },
        { key: 'rental_days', label: 'Days', sortable: true, width: 55, align: 'center', render: v => v ?? '—' },
        // {
        //     key: 'total_amount', label: 'Total', sortable: true, width: 110, align: 'right',
        //     render: v => <span className="dt-currency">₹{parseFloat(v || 0).toLocaleString('en-IN')}</span>,
        // },
        {
            key: 'payment_captured', label: 'Paid', sortable: true, width: 55, align: 'center',
            render: v => v ? <span style={{ color: '#059669', fontWeight: 700, fontSize: 13 }}>✓</span> : <span style={{ color: '#EF4444', fontSize: 13 }}>✕</span>,
        },
        {
            key: 'agreement_signed', label: 'Signed', sortable: true, width: 65, align: 'center',
            render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✍</span> : <span style={{ color: '#D1D5DB' }}>—</span>,
        },
        {
            key: 'created_at', label: 'Booked On', sortable: true, width: 110,
            render: v => fmtDate(v),
        },
    ];

    const pendingReviewColumns = [
        {
            key: 'booking_ref', label: 'Booking', sortable: true, width: 140,
            render: v => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--cd-acc)' }}>{v}</span>,
        },
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true,
            render: v => v || '—',
        },
        { key: 'return_date', label: 'Returned', sortable: true, width: 110, render: v => v || '—' },
        {
            key: 'vendor_name', label: 'Vendor', sortable: true, width: 160,
            render: v => v || '—',
        },
    ];

    const submittedReviewColumns = [
        {
            key: 'booking_ref', label: 'Booking', sortable: true, width: 140,
            render: v => <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--cd-acc)' }}>{v}</span>,
        },
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true,
            render: v => v || '—',
        },
        {
            key: 'vendor_rating', label: 'Vendor ★', sortable: true, width: 130,
            render: v => (
                <span style={{ display: 'inline-flex', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 14, color: n <= (v || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>)}
                </span>
            ),
        },
        {
            key: 'vehicle_rating', label: 'Vehicle ★', sortable: true, width: 130,
            render: v => (
                <span style={{ display: 'inline-flex', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 14, color: n <= (v || 0) ? '#E8A020' : '#E5E7EB', lineHeight: 1 }}>★</span>)}
                </span>
            ),
        },
        {
            key: 'review_text', label: 'Review', sortable: false,
            render: v => v
                ? <span style={{ fontSize: 12, color: 'var(--cd-txt2)', fontStyle: 'italic', display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{v}"</span>
                : <span style={{ color: 'var(--cd-muted)', fontSize: 11 }}>No text</span>,
        },
        {
            key: 'created_at', label: 'Date', sortable: true, width: 110,
            render: (v, row) => v ? fmtDate(v) : (row.return_date || '—'),
        },
        {
            key: '__status__', label: 'Status', sortable: false, width: 90,
            render: () => <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>✓ Submitted</span>,
        },
    ];

    return (
        <div className="cd">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            {/* KYC OTP Modal */}
            {kycModal && (
                <KYCVerifyModal
                    type={kycModal.type}
                    value={kycModal.value}
                    userEmail={profile?.email || user?.email || ''}
                    onClose={() => setKycModal(null)}
                    onVerified={() => handleKYCVerified(kycModal.type)}
                    showToast={showToast}
                />
            )}

            {/* Booking Detail Modal — only via "View Booking" button */}
            {selectedBooking && (
                <BookingDetailPanel
                    booking={selectedBooking}
                    detail={bookingDetails[selectedBooking.id]}
                    loading={detailLoading && !bookingDetails[selectedBooking.id]}
                    onRefresh={() => refreshBooking(selectedBooking.id)}
                    showToast={showToast}
                    onClose={() => setSelectedBooking(null)}
                    role="customer"
                />
            )}

            {/* Write Review Modal — only via "Write Review" button */}
            {selectedPendingReview && (
                <WriteReviewModal
                    booking={selectedPendingReview}
                    onClose={() => setSelectedPendingReview(null)}
                    onSubmitted={(bookingId) => setPendingReviews(p => p.filter(b => b.booking_id !== bookingId))}
                    showToast={showToast}
                />
            )}

            {/* View Submitted Review Modal — only via "View Review" button */}
            {selectedSubmittedReview && (
                <ViewReviewModal
                    review={selectedSubmittedReview}
                    onClose={() => setSelectedSubmittedReview(null)}
                />
            )}

            <div className="cd__shell">
                <div className="cd__inner">
                    {/* Hero */}
                    <div className="cd__hero">
                        <div className="cd__hero-banner" />
                        <div className="cd__hero-body">
                            <div className="cd__hero-left">
                                <div className="cd__hero-avatar">{(user?.full_name || user?.email || 'U')[0].toUpperCase()}</div>
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

                    {loading && tab !== 'my-reviews' && <div className="cd-loading"><div className="cd-spinner" /> Loading…</div>}
                    {error && <div className="cd-error">{error}</div>}

                    {/* ── BOOKINGS TAB ── */}
                    {!loading && tab === 'bookings' && (
                        <div className="cd-section">
                            <DataTable
                                columns={bookingColumns}
                                data={bookings}
                                searchable
                                searchKeys={['booking_ref', 'vehicle_display', 'status']}
                                searchPlaceholder="Search by booking ref, vehicle…"
                                filters={[{
                                    key: 'status', label: 'Status',
                                    options: [
                                        { value: '', label: 'All Bookings' },
                                        { value: 'PENDING', label: 'Pending', color: '#D97706' },
                                        { value: 'CONFIRMED', label: 'Confirmed', color: '#1D4ED8' },
                                        { value: 'ACTIVE', label: 'Active', color: '#059669' },
                                        { value: 'COMPLETED', label: 'Completed', color: '#6B7280' },
                                        { value: 'CANCELLED', label: 'Cancelled', color: '#EF4444' },
                                    ],
                                    colorMap: STATUS_CLR,
                                }, {
                                    key: 'payment_captured', label: 'Payment',
                                    options: [
                                        { value: '', label: 'All' },
                                        { value: 'true', label: 'Paid' },
                                        { value: 'false', label: 'Unpaid' },
                                    ],
                                }]}
                                onRowAction={(row) => openBookingDetail(row)}
                                actionLabel="View Booking"
                                emptyIcon="📅"
                                emptyMessage="No bookings yet. Browse cars and make your first booking."
                                pageSize={15}
                            />
                        </div>
                    )}

                    {/* ── REVIEWS TAB (pending) ── */}
                    {!loading && tab === 'reviews' && (
                        <div className="cd-section">
                            {pendingReviews.length === 0 ? (
                                <div className="cd-empty">
                                    <div className="cd-empty__icon"><span className="icon-star"></span></div>
                                    <h3>All caught up!</h3>
                                    <p>No pending reviews. Check "My Reviews" to see what you've submitted.</p>
                                </div>
                            ) : (
                                <DataTable
                                    columns={pendingReviewColumns}
                                    data={pendingReviews}
                                    searchable
                                    searchKeys={['booking_ref', 'vehicle_display', 'vendor_name']}
                                    searchPlaceholder="Search pending reviews…"
                                    onRowAction={(row) => setSelectedPendingReview(row)}
                                    actionLabel="Write Review"
                                    emptyIcon="⭐"
                                    emptyMessage="No pending reviews."
                                    pageSize={15}
                                />
                            )}
                        </div>
                    )}

                    {/* ── MY REVIEWS TAB ── */}
                    {tab === 'my-reviews' && (
                        <div className="cd-section">
                            {submittedReviewsLoading ? (
                                <div className="cd-loading"><div className="cd-spinner" /> Loading your reviews…</div>
                            ) : submittedReviews.length === 0 ? (
                                <div className="cd-empty">
                                    <div className="cd-empty__icon"><span className="icon-star"></span></div>
                                    <h3>No reviews submitted yet</h3>
                                    <p>After completing a trip, you'll be able to leave a review. Your submitted reviews will appear here.</p>
                                </div>
                            ) : (
                                <DataTable
                                    columns={submittedReviewColumns}
                                    data={submittedReviews}
                                    searchable
                                    searchKeys={['booking_ref', 'vehicle_display', 'review_text']}
                                    searchPlaceholder="Search your reviews…"
                                    filters={[{
                                        key: 'vendor_rating', label: 'Rating',
                                        options: [
                                            { value: '', label: 'All Ratings' },
                                            ...[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: `${n} ★` })),
                                        ],
                                    }]}
                                    onRowAction={(row) => setSelectedSubmittedReview(row)}
                                    actionLabel="View Review"
                                    emptyIcon="💬"
                                    emptyMessage="No reviews found."
                                    pageSize={15}
                                />
                            )}
                        </div>
                    )}

                    {/* ── LOYALTY TAB ── */}
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
                                    <div className="cd-loyalty-card__worth">Worth <strong>₹{loyalty.total_value_inr || loyalty.loyalty_points * parseFloat(loyalty.point_value_inr || 0.5)}</strong></div>
                                    <div className="cd-loyalty-card__tier">{loyalty.loyalty_points >= 1000 ? 'Gold Member' : loyalty.loyalty_points >= 500 ? 'Silver Member' : 'Bronze Member'}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div className="cd-card">
                                        <h3 className="cd-card__title">Redeem Points</h3>
                                        <p style={{ fontSize: 13, color: 'var(--cd-muted)', marginBottom: 14 }}>1 point = ₹{loyalty.point_value_inr || '0.50'}</p>
                                        <form onSubmit={handleRedeem} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                            <div>
                                                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--cd-muted)', display: 'block', marginBottom: 5 }}>Points to Redeem</label>
                                                <input className="cd-input" type="number" style={{ width: 160 }} placeholder={`Max ${loyalty.loyalty_points}`} value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)} min={1} max={loyalty.loyalty_points} />
                                            </div>
                                            <button type="submit" className="cd-btn cd-btn--primary" disabled={redeemLoading || !redeemPoints}>{redeemLoading ? 'Redeeming…' : 'Redeem Now'}</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PROFILE TAB ── */}
                    {!loading && tab === 'profile' && profile && (
                        <div className="cd-section">
                            <div className="cd-profile-layout">
                                <div className="cd-card">
                                    <div className="cd-card__head">
                                        <div><h3 className="cd-card__title">Personal Information</h3></div>
                                        <button className="cd-btn cd-btn--outline cd-btn--sm" onClick={() => setProfileEdit(!profileEdit)}>{profileEdit ? 'Cancel' : 'Edit'}</button>
                                    </div>
                                    {profileEdit ? (
                                        <div className="cd-profile-form">
                                            {[['full_name', 'Full Name', 'text'], ['phone', 'Phone Number', 'tel'], ['date_of_birth', 'Date of Birth', 'date'], ['driving_licence', 'Driving Licence No.', 'text'], ['dl_expiry', 'DL Expiry Date', 'date'], ['aadhaar_number', 'Aadhaar Number', 'text'], ['pan_number', 'PAN Number', 'text']].map(([k, l, t]) => (
                                                <div key={k} className="cd-form-field">
                                                    <label>{l}</label>
                                                    <input className="cd-input" type={t} value={profileForm[k] || ''} onChange={e => setProfileForm(p => ({ ...p, [k]: e.target.value }))} />
                                                </div>
                                            ))}
                                            <button className="cd-btn cd-btn--primary" onClick={handleProfileSave} disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save Changes'}</button>
                                        </div>
                                    ) : (
                                        <div className="cd-profile-rows">
                                            {[['Name', profile.full_name], ['Email', profile.email], ['Phone', profile.phone || '—'], ['Date of Birth', profile.date_of_birth || '—'], ['Driving Licence', profile.driving_licence || '—'], ['DL Expiry', profile.dl_expiry || '—'], ['Aadhaar', profile.aadhaar_number ? '••••' + profile.aadhaar_number.slice(-4) : '—'], ['PAN', profile.pan_number || '—']].map(([l, v]) => (
                                                <div key={l} className="cd-info-row cd-info-row--bordered"><span className="cd-info-row__lbl">{l}</span><strong className="cd-info-row__val">{v}</strong></div>
                                            ))}
                                            <div className="cd-info-row cd-info-row--bordered">
                                                <span className="cd-info-row__lbl">KYC Status</span>
                                                <span className={`cd-kyc-badge cd-kyc-badge--${profile.kyc_status || 'pending'}`}>{profile.kyc_status === 'verified' ? 'Verified' : profile.kyc_status === 'rejected' ? 'Rejected' : 'Pending'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* KYC Verification Card */}
                                <div className="cd-card">
                                    <h3 className="cd-card__title">KYC Verification</h3>
                                    <p style={{ fontSize: 13, color: 'var(--cd-muted)', marginTop: -6 }}>Verify your phone number and email address to complete KYC.</p>

                                    {/* Phone */}
                                    <div className="cd-kyc-verify-row">
                                        <div className="cd-kyc-verify-row__left">
                                            <div className="cd-kyc-verify-row__icon">📱</div>
                                            <div>
                                                <div className="cd-kyc-verify-row__label">Phone Number</div>
                                                <div className="cd-kyc-verify-row__value">{profile.phone || '—'}</div>
                                            </div>
                                        </div>
                                        <div className="cd-kyc-verify-row__right">
                                            {user?.is_phone_verified ? (
                                                <span className="cd-kyc-verify-badge cd-kyc-verify-badge--verified">✓ Verified</span>
                                            ) : profile.phone ? (
                                                <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={() => setKycModal({ type: 'phone', value: profile.phone })}>Verify Phone</button>
                                            ) : (
                                                <span className="cd-kyc-verify-badge cd-kyc-verify-badge--missing">No phone on file</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="cd-kyc-verify-row">
                                        <div className="cd-kyc-verify-row__left">
                                            <div className="cd-kyc-verify-row__icon">✉️</div>
                                            <div>
                                                <div className="cd-kyc-verify-row__label">Email Address</div>
                                                <div className="cd-kyc-verify-row__value">{profile.email || '—'}</div>
                                            </div>
                                        </div>
                                        <div className="cd-kyc-verify-row__right">
                                            {user?.is_email_verified ? (
                                                <span className="cd-kyc-verify-badge cd-kyc-verify-badge--verified">✓ Verified</span>
                                            ) : profile.email ? (
                                                <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={() => setKycModal({ type: 'email', value: profile.email })}>Verify Email</button>
                                            ) : (
                                                <span className="cd-kyc-verify-badge cd-kyc-verify-badge--missing">No email on file</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`cd-kyc-status cd-kyc-status--${profile.kyc_status || 'pending'}`}>
                                        {profile.kyc_status === 'verified' ? '✓ Fully Verified' : profile.kyc_status === 'rejected' ? '✕ Rejected — Contact Support' : '⏳ Pending Verification'}
                                    </div>
                                    <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400E' }}>
                                        <strong>Dev mode:</strong> OTP code is <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>123456</span>.
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