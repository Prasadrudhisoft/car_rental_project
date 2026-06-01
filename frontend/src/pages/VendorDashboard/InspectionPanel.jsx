// ─────────────────────────────────────────────────────────────────────────────
// InspectionPanel.jsx
// Handles all inspection states:
//   • Locked (completed) — read-only accordion
//   • Pickup awaiting customer OTP — generate OTP button
//   • Return awaiting customer OTP — enter OTP to verify
//   • Return form ready to fill — odometer / fuel / damage
//   • Not applicable — placeholder message
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { PhotoLightbox } from './VendorMediaComponents';
import { Field, FormInput, FormSelect } from './VendorShared';
import { createInspection, signInspection } from '../../services/api';

export default function InspectionPanel({
    bookingId,
    inspectionType,
    existingInspection,
    canCreate,
    showToast,
    onRefresh,
}) {
    const isPickup = inspectionType === 'PICKUP';
    const label    = isPickup ? 'Pickup' : 'Drop-off';

    const [form, setForm] = useState({
        odometer_reading: '', fuel_level: 'full', notes: '',
        damage_reported: false, damage_notes: '', damage_amount: '',
    });
    const [saving,            setSaving]            = useState(false);
    const [otpSent,           setOtpSent]           = useState(false);
    const [otpCode,           setOtpCode]           = useState('');
    const [otpBusy,           setOtpBusy]           = useState(false);
    const [expanded,          setExpanded]          = useState(false);
    const [vendorOtpDisplay,  setVendorOtpDisplay]  = useState(null);
    const [lightboxIndex,     setLightboxIndex]     = useState(null);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const labelDot = (bg, color, text) => (
        <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: bg, color }}>{text}</span>
    );

    const AccordionHeader = ({ bg, borderColor, children }) => (
        <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', background: bg, borderBottom: expanded ? `1px solid ${borderColor}` : 'none' }}
            onClick={() => setExpanded(v => !v)}
        >
            {children}
            <span style={{ fontSize: 12, color: 'var(--vm)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
    );

    // ── 1. Locked inspection ──────────────────────────────────────────────────
    if (existingInspection?.is_locked) {
        const photos   = existingInspection.photos || [];
        const infoRows = [
            ['Odometer',        `${existingInspection.odometer_reading} km`],
            ['Fuel Level',       existingInspection.fuel_level],
            ['Customer Signed',  existingInspection.customer_signed ? 'Yes' : 'Pending'],
            ['Vendor Signed',    existingInspection.vendor_signed   ? 'Yes' : 'Pending'],
            ...(existingInspection.notes ? [['Notes', existingInspection.notes]] : []),
        ];
        return (
            <div style={{ border: '1px solid var(--vbdr)', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && photos.length > 0 && (
                    <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
                )}
                <AccordionHeader bg={isPickup ? '#EFF6FF' : '#F0FDF4'} borderColor="var(--vbdr)">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {labelDot(isPickup ? '#DBEAFE' : '#D1FAE5', isPickup ? '#1D4ED8' : '#059669', isPickup ? 'P' : 'D')}
                        <strong style={{ fontSize: 13 }}>{label} Inspection</strong>
                        <span style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Locked</span>
                    </div>
                </AccordionHeader>
                {expanded && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {infoRows.map(([l, v]) => (
                            <div key={l} className="vd-info-pair" style={{ fontSize: 13 }}><span>{l}</span><strong>{v}</strong></div>
                        ))}
                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                {photos.map((ph, idx) => (
                                    <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}>
                                        <img src={ph.image} alt="insp" style={{ width: 70, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--vbdr)', display: 'block' }} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── 2. Pickup — awaiting customer OTP ─────────────────────────────────────
    if (isPickup && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];

        const handleGenerateOtp = async () => {
            setOtpBusy(true);
            try {
                const { data } = await signInspection(bookingId, 'pickup', 'generate', null);
                setVendorOtpDisplay(data.otp_code);
                setOtpSent(true);
                showToast('OTP generated! Share with the customer.', 'success');
            } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
            setOtpBusy(false);
        };

        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && photos.length > 0 && (
                    <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
                )}
                <AccordionHeader bg="#FFFBEB" borderColor="#FCD34D">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {labelDot('#DBEAFE', '#1D4ED8', 'P')}
                        <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Customer Awaiting OTP</span>
                    </div>
                </AccordionHeader>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#F8FAFB', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                            </div>
                        </div>
                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {photos.map((ph, idx) => (
                                    <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}>
                                        <img src={ph.image} alt="insp" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--vbdr)', display: 'block' }} />
                                    </div>
                                ))}
                            </div>
                        )}
                        {!otpSent ? (
                            <button className="vd-btn vd-btn--primary" onClick={handleGenerateOtp} disabled={otpBusy}>
                                {otpBusy ? 'Generating…' : 'Generate OTP for Customer'}
                            </button>
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

    // ── 3. Return — awaiting customer OTP ─────────────────────────────────────
    if (!isPickup && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];

        const handleVerifyOtp = async () => {
            if (otpCode.length !== 6) { showToast('Enter 6-digit OTP.', 'error'); return; }
            setOtpBusy(true);
            try {
                const { data } = await signInspection(bookingId, 'return', 'verify', otpCode);
                showToast(data.message || 'Drop-off signed!');
                setOtpCode('');
                onRefresh();
            } catch (e) { showToast(e.response?.data?.error || 'Invalid OTP.', 'error'); }
            setOtpBusy(false);
        };

        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && photos.length > 0 && (
                    <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
                )}
                <AccordionHeader bg="#FFFBEB" borderColor="#FCD34D">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {labelDot('#D1FAE5', '#059669', 'D')}
                        <strong style={{ fontSize: 13 }}>Drop-off Inspection</strong>
                        <span style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>Awaiting Customer OTP</span>
                    </div>
                </AccordionHeader>
                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: '#F8FAFB', border: '1px solid var(--vbdr)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                                {existingInspection.damage_reported && (
                                    <span style={{ color: '#EF4444' }}>Damage: <strong>{existingInspection.damage_notes} (₹{existingInspection.damage_amount})</strong></span>
                                )}
                            </div>
                        </div>
                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {photos.map((ph, idx) => (
                                    <div key={ph.id} onClick={() => setLightboxIndex(idx)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}>
                                        <img src={ph.image} alt="insp" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--vbdr)', display: 'block' }} />
                                    </div>
                                ))}
                            </div>
                        )}
                        <div>
                            <p style={{ fontSize: 12, color: 'var(--vm)', marginBottom: 8, fontWeight: 600 }}>Enter 6-digit OTP from customer:</p>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                    className="vd-input"
                                    style={{ width: 140, textAlign: 'center', letterSpacing: '6px', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}
                                    maxLength={6}
                                    placeholder="——————"
                                    value={otpCode}
                                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                                <button className="vd-btn vd-btn--primary" onClick={handleVerifyOtp} disabled={otpBusy || otpCode.length !== 6}>
                                    {otpBusy ? 'Verifying…' : 'Verify & Complete Drop-off'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── 4. Not applicable ─────────────────────────────────────────────────────
    if (!canCreate) {
        return (
            <div style={{ border: '1px dashed var(--vbdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--vm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {labelDot(isPickup ? '#DBEAFE' : '#D1FAE5', isPickup ? '#1D4ED8' : '#059669', isPickup ? 'P' : 'D')}
                <span>{isPickup ? 'Pickup inspection is created by customer.' : 'Drop-off inspection available when booking is ACTIVE.'}</span>
            </div>
        );
    }

    if (isPickup) return (
        <div style={{ border: '1px dashed var(--vbdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--vm)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {labelDot('#DBEAFE', '#1D4ED8', 'P')}
            <span>Pickup inspection is created by customer.</span>
        </div>
    );

    // ── 5. Return form — ready to fill ────────────────────────────────────────
    const handleSave = async () => {
        if (!form.odometer_reading) { showToast('Odometer reading is required.', 'error'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('odometer_reading', form.odometer_reading);
            fd.append('fuel_level',       form.fuel_level);
            fd.append('notes',            form.notes);
            fd.append('checklist',        JSON.stringify({ exterior: true, interior: true, tyres: true, documents: true }));
            fd.append('damage_reported',  form.damage_reported ? true : false);
            fd.append('damage_notes',     form.damage_notes);
            if (form.damage_reported && form.damage_amount) fd.append('damage_amount', form.damage_amount);
            await createInspection(bookingId, 'return', fd);
            showToast('Drop-off inspection saved!');
            onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
        setSaving(false);
    };

    return (
        <div style={{ border: '1px solid var(--vacc)', borderRadius: 10, overflow: 'hidden' }}>
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--vacc-l)', cursor: 'pointer', borderBottom: expanded ? '1px solid var(--vacc)' : 'none' }}
                onClick={() => setExpanded(v => !v)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {labelDot('#D1FAE5', '#059669', 'D')}
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
                    <Field label="Notes (optional)">
                        <textarea className="vd-input vd-textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any observations…" />
                    </Field>
                    <div style={{ background: '#FFF7F7', border: '1px solid #FECACA', borderRadius: 8, padding: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                            <input type="checkbox" checked={form.damage_reported} onChange={e => setForm(p => ({ ...p, damage_reported: e.target.checked }))} />
                            <span style={{ color: form.damage_reported ? '#EF4444' : 'inherit' }}>Damage Reported</span>
                        </label>
                        {form.damage_reported && (
                            <div className="vd-fg vd-fg--2" style={{ marginTop: 10 }}>
                                <Field label="Damage Notes">
                                    <textarea className="vd-input vd-textarea" value={form.damage_notes} onChange={e => setForm(p => ({ ...p, damage_notes: e.target.value }))} />
                                </Field>
                                <FormInput label="Damage Amount (₹)" type="number" value={form.damage_amount} onChange={e => setForm(p => ({ ...p, damage_amount: e.target.value }))} />
                            </div>
                        )}
                    </div>
                    <button className="vd-btn vd-btn--primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Submit Drop-off Inspection'}
                    </button>
                </div>
            )}
        </div>
    );
}