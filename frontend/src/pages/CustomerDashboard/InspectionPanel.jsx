// ─────────────────────────────────────────────────────────────────────────────
// InspectionPanel.jsx
// Customer-facing inspection panel (pickup + return).
// Handles: locked view, OTP-based pickup sign-off, OTP generation for return.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
    createInspection,
    signInspection,
    uploadInspectionPhoto,
} from '../../services/api';
import PhotoLightbox from './PhotoLightbox';

const ICON_STYLE = (isPickup) => ({
    width: 24, height: 24, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700,
    background: isPickup ? '#DBEAFE' : '#D1FAE5',
    color: isPickup ? '#1D4ED8' : '#059669',
});

export default function InspectionPanel({
    bookingId, inspectionType, existingInspection,
    canCreate, showToast, onRefresh,
}) {
    const isPickup = inspectionType === 'PICKUP';
    const label = isPickup ? 'Pickup' : 'Drop-off';

    const [form, setForm] = useState({
        odometer_reading: '', fuel_level: 'full', notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [otpCode, setOtpCode] = useState('');
    const [otpBusy, setOtpBusy] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [vendorOtpDisplay, setVendorOtpDisplay] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(null);

    // ── Locked (signed) view ───────────────────────────────────────────────
    if (existingInspection?.is_locked) {
        const photos = existingInspection.photos || [];
        const infoRows = [
            ['Odometer', `${existingInspection.odometer_reading} km`],
            ['Fuel Level', existingInspection.fuel_level],
            ['Customer Signed', existingInspection.customer_signed ? 'Yes' : 'Pending'],
            ['Vendor Signed', existingInspection.vendor_signed ? 'Yes' : 'Pending'],
            ...(existingInspection.notes ? [['Notes', existingInspection.notes]] : []),
            ...(existingInspection.damage_reported
                ? [['Damage', existingInspection.damage_notes || 'Reported']] : []),
        ];

        return (
            <div style={{ border: '1px solid var(--cd-bdr)', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && (
                    <PhotoLightbox
                        photos={photos}
                        initialIndex={lightboxIndex}
                        onClose={() => setLightboxIndex(null)}
                    />
                )}
                <div
                    onClick={() => setExpanded(v => !v)}
                    style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: isPickup ? '#EFF6FF' : '#F0FDF4',
                        borderBottom: expanded ? '1px solid var(--cd-bdr)' : 'none',
                        cursor: 'pointer',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={ICON_STYLE(isPickup)}>{isPickup ? 'P' : 'D'}</div>
                        <strong style={{ fontSize: 13 }}>{label} Inspection</strong>
                        <span style={{
                            background: '#D1FAE5', color: '#059669',
                            border: '1px solid #6EE7B7',
                            fontSize: 10, fontWeight: 700,
                            padding: '2px 8px', borderRadius: 999,
                        }}>
                            Locked
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>
                        {expanded ? '▲' : '▼'}
                    </span>
                </div>

                {expanded && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {infoRows.map(([l, v]) => (
                            <div key={l} className="cd-info-row" style={{ fontSize: 13 }}>
                                <span className="cd-info-row__lbl">{l}</span>
                                <strong>{v}</strong>
                            </div>
                        ))}
                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                {photos.map((ph, idx) => (
                                    <div
                                        key={ph.id}
                                        onClick={() => setLightboxIndex(idx)}
                                        style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}
                                    >
                                        <img
                                            src={ph.image}
                                            alt="insp"
                                            style={{
                                                width: 70, height: 54, objectFit: 'cover',
                                                borderRadius: 6, border: '1px solid var(--cd-bdr)',
                                                display: 'block',
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Pickup: customer awaits OTP from vendor ────────────────────────────
    if (isPickup && existingInspection && !existingInspection.is_locked) {
        const handleVerifyOtp = async () => {
            if (otpCode.length !== 6) { showToast('Enter 6-digit OTP.', 'error'); return; }
            setOtpBusy(true);
            try {
                await signInspection(bookingId, 'pickup', 'verify', otpCode);
                showToast('Pickup verified! Trip is now ACTIVE.');
                setOtpCode('');
                onRefresh();
            } catch (e) {
                showToast(e.response?.data?.error || 'Invalid OTP.', 'error');
            }
            setOtpBusy(false);
        };

        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                <div
                    onClick={() => setExpanded(v => !v)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={ICON_STYLE(true)}>P</div>
                        <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                        <span style={{
                            background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D',
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        }}>
                            Enter OTP from Vendor
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>
                        {expanded ? '▲' : '▼'}
                    </span>
                </div>

                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{
                            background: '#DBEAFE', border: '1px solid #93C5FD',
                            borderRadius: 8, padding: '10px 12px', fontSize: 13,
                        }}>
                            <strong>Enter OTP from Vendor</strong>
                            <p style={{ marginTop: 4, fontSize: 12, color: '#1D4ED8' }}>
                                Ask the vendor for the OTP to start your trip.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                className="cd-input"
                                style={{
                                    width: 140, textAlign: 'center',
                                    letterSpacing: '6px', fontSize: 20,
                                    fontWeight: 700, fontFamily: 'monospace',
                                }}
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
                    </div>
                )}
            </div>
        );
    }

    // ── Return: customer generates OTP for vendor ──────────────────────────
    if (!isPickup && existingInspection && !existingInspection.is_locked) {
        const photos = existingInspection.photos || [];

        const handleGenerateOtp = async () => {
            setOtpBusy(true);
            try {
                const { data } = await signInspection(bookingId, 'return', 'generate', null);
                setVendorOtpDisplay(data.otp_code);
                showToast('OTP generated! Share with the vendor.');
            } catch (e) {
                showToast(e.response?.data?.error || 'Failed.', 'error');
            }
            setOtpBusy(false);
        };

        return (
            <div style={{ border: '1px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                {lightboxIndex !== null && photos.length > 0 && (
                    <PhotoLightbox
                        photos={photos}
                        initialIndex={lightboxIndex}
                        onClose={() => setLightboxIndex(null)}
                    />
                )}
                <div
                    onClick={() => setExpanded(v => !v)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: '#FFFBEB', cursor: 'pointer',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={ICON_STYLE(false)}>D</div>
                        <strong style={{ fontSize: 13 }}>Drop-off Inspection</strong>
                        <span style={{
                            background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D',
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        }}>
                            Review & Generate OTP
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>
                        {expanded ? '▲' : '▼'}
                    </span>
                </div>

                {expanded && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{
                            background: '#F8FAFB', border: '1px solid var(--cd-bdr)',
                            borderRadius: 8, padding: '10px 12px',
                        }}>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
                                <span>Odometer: <strong>{existingInspection.odometer_reading} km</strong></span>
                                <span>Fuel: <strong>{existingInspection.fuel_level}</strong></span>
                                {existingInspection.damage_reported && (
                                    <span style={{ color: '#EF4444' }}>
                                        Damage: <strong>{existingInspection.damage_notes}</strong>
                                    </span>
                                )}
                            </div>
                        </div>

                        {photos.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {photos.map((ph, idx) => (
                                    <div
                                        key={ph.id}
                                        onClick={() => setLightboxIndex(idx)}
                                        style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}
                                    >
                                        <img
                                            src={ph.image}
                                            alt="insp"
                                            style={{
                                                width: 80, height: 60, objectFit: 'cover',
                                                borderRadius: 6, border: '1px solid var(--cd-bdr)',
                                                display: 'block',
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!vendorOtpDisplay ? (
                            <button
                                className="cd-btn cd-btn--primary"
                                onClick={handleGenerateOtp}
                                disabled={otpBusy}
                            >
                                {otpBusy ? 'Generating…' : 'Generate OTP for Vendor'}
                            </button>
                        ) : (
                            <div style={{
                                background: '#D1FAE5', border: '1px solid #6EE7B7',
                                borderRadius: 10, padding: '16px', textAlign: 'center',
                            }}>
                                <p style={{ fontSize: 12, color: '#059669', marginBottom: 10, fontWeight: 600 }}>
                                    Share this OTP with the vendor:
                                </p>
                                <div style={{
                                    fontSize: 36, fontWeight: 800,
                                    letterSpacing: 10, fontFamily: 'monospace', color: '#059669',
                                }}>
                                    {vendorOtpDisplay}
                                </div>
                                <button
                                    className="cd-btn cd-btn--ghost cd-btn--sm"
                                    style={{ marginTop: 10 }}
                                    onClick={handleGenerateOtp}
                                    disabled={otpBusy}
                                >
                                    Generate New OTP
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Not yet available ──────────────────────────────────────────────────
    if (!canCreate) {
        return (
            <div style={{
                border: '1px dashed var(--cd-bdr)', borderRadius: 10,
                padding: '12px 14px', fontSize: 13, color: 'var(--cd-muted)',
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <div style={ICON_STYLE(isPickup)}>{isPickup ? 'P' : 'D'}</div>
                <span>
                    {isPickup
                        ? 'Pickup inspection — available after agreement is signed.'
                        : 'Drop-off inspection — filled by vendor when you return the vehicle.'}
                </span>
            </div>
        );
    }

    // ── Drop-off: not applicable for customer creation ─────────────────────
    if (!isPickup) {
        return (
            <div style={{
                border: '1px dashed var(--cd-bdr)', borderRadius: 10,
                padding: '12px 14px', fontSize: 13, color: 'var(--cd-muted)',
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                <div style={ICON_STYLE(false)}>D</div>
                <span>Drop-off inspection is recorded by the vendor when you return the vehicle.</span>
            </div>
        );
    }

    // ── Pickup creation form ───────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.odometer_reading) { showToast('Odometer reading is required.', 'error'); return; }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('odometer_reading', form.odometer_reading);
            fd.append('fuel_level', form.fuel_level);
            fd.append('notes', form.notes);
            fd.append('checklist', JSON.stringify({
                exterior: true, interior: true, tyres: true, documents: true,
            }));
            const { data: inspData } = await createInspection(bookingId, 'pickup', fd);
            if (photoFile && inspData?.inspection_id) {
                const pfd = new FormData();
                pfd.append('image', photoFile);
                pfd.append('angle', 'other');
                try {
                    await uploadInspectionPhoto(inspData.inspection_id, pfd);
                } catch {
                    showToast('Inspection saved, but photo upload failed.', 'error');
                }
            }
            showToast('Pickup inspection submitted!');
            onRefresh();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed.', 'error');
        }
        setSaving(false);
    };

    return (
        <div style={{ border: '1px solid var(--cd-acc)', borderRadius: 10, overflow: 'hidden' }}>
            <div
                onClick={() => setExpanded(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: 'var(--cd-acc-l)', cursor: 'pointer',
                    borderBottom: expanded ? '1px solid var(--cd-acc)' : 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={ICON_STYLE(true)}>P</div>
                    <strong style={{ fontSize: 13 }}>Pickup Inspection</strong>
                    <span style={{
                        background: '#DBEAFE', color: '#1D4ED8', border: '1px solid #93C5FD',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    }}>
                        Ready to Fill
                    </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--cd-muted)' }}>
                    {expanded ? 'Hide' : 'Fill Form'}
                </span>
            </div>

            {expanded && (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                            placeholder="Any observations…"
                        />
                    </div>
                    <div className="cd-form-field">
                        <label>Upload Photo (optional)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => setPhotoFile(e.target.files[0])}
                        />
                    </div>
                    <button
                        className="cd-btn cd-btn--primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Submit Pickup Inspection'}
                    </button>
                </div>
            )}
        </div>
    );
}