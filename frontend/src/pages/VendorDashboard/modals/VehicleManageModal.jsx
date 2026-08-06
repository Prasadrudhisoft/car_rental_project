// ─────────────────────────────────────────────────────────────────────────────
// VehicleManageModal.jsx
// Full vehicle management modal: pipeline progress bar, docs sub-tab,
// photos sub-tab, availability sub-tab, edit-details sub-tab, status toggle.
//
// Fix: Documents tab — image files now open in PhotoLightbox (same-page modal)
// instead of a new browser tab, consistent with the Photos sub-tab behaviour.
// PDF and non-image files still open in a new tab (no lightbox for those).
//
// Edit Details sub-tab: vendors can update previously-submitted fleet info.
// If the vehicle has already passed initial admin review, the submitted
// values are NOT applied immediately — the backend stages them in
// pending_changes and sets needs_review=True. Live values stay unchanged
// until an admin approves. This modal reflects that: it shows the pending
// diff (if any) and labels the submit button accordingly.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { PhotoLightbox } from '../VendorMediaComponents';
import { VEHICLE_STATUS_CLR, DOC_TYPES, ANGLES, fmtDatetime } from '../vendorConstants';
import { uploadVehicleDoc, uploadVehiclePhoto } from '../../../services/api';

const PIPELINE = ['PENDING_DOCS', 'DOCS_SUBMITTED', 'ADMIN_APPROVED', 'CERTIFIED', 'LIVE'];

// Statuses that mean the vehicle has already been through admin review at
// least once — editing core details past this point triggers the
// stage-for-approval behaviour on the backend.
const REVIEWED_STATUSES = ['ADMIN_APPROVED', 'CERTIFIED', 'LIVE', 'INACTIVE'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const isImageUrl = url =>
    url && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url);

// ── Edit Details form ─────────────────────────────────────────────────────────
function EditDetailsForm({ vehicle: v, onSave, showToast }) {
    const [form, setForm] = useState({
        make:             v.make || '',
        model:            v.model || '',
        year:             v.year || '',
        colour:           v.colour || '',
        segment:          v.segment || '',
        fuel_type:        v.fuel_type || '',
        transmission:     v.transmission || '',
        capacity:         v.capacity || '',
        daily_rate:       v.daily_rate || '',
        current_odometer: v.current_odometer ?? v.odometer_at_listing ?? '',
    });
    const [saving, setSaving] = useState(false);

    const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }));

    const alreadyReviewed = REVIEWED_STATUSES.includes(v.status);
    const pending = v.pending_changes_readable || [];

    const distanceSinceVerified =
        v.last_verified_odometer != null && form.current_odometer !== ''
            ? Number(form.current_odometer) - v.last_verified_odometer
            : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(form);
            if (alreadyReviewed) {
                showToast('Changes submitted — awaiting admin approval. Live values are unchanged for now.');
            } else {
                showToast('Vehicle details updated.');
            }
        } catch (err) {
            showToast(
                err.response?.data ? JSON.stringify(err.response.data) : 'Update failed.',
                'error',
            );
        }
        setSaving(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            {alreadyReviewed && (
                <div style={{
                    background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8,
                    padding: '10px 12px', fontSize: 12, color: '#92400E', marginBottom: 14,
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                    <span style={{ flexShrink: 0 }}>⚠</span>
                    <span>
                        This vehicle has already been reviewed by admin. Changes here will NOT
                        go live immediately — they'll be submitted for admin approval, and the
                        currently approved details stay visible to customers and admin until
                        approved.
                    </span>
                </div>
            )}

            {pending.length > 0 && (
                <div style={{
                    background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
                    padding: '10px 12px', fontSize: 12, marginBottom: 14,
                }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#92400E' }}>
                        Pending admin review:
                    </strong>
                    {pending.map(c => (
                        <div key={c.field} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#78350F' }}>
                            <span>{c.label}</span>
                            <span><s style={{ opacity: 0.6 }}>{c.old_value ?? '—'}</s> → {c.new_value ?? '—'}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="vd-fg vd-fg--3">
                <div className="vd-form-field">
                    <label>Make</label>
                    <input className="vd-input" value={form.make} onChange={set('make')} required />
                </div>
                <div className="vd-form-field">
                    <label>Model</label>
                    <input className="vd-input" value={form.model} onChange={set('model')} required />
                </div>
                <div className="vd-form-field">
                    <label>Year</label>
                    <input className="vd-input" type="number" value={form.year} onChange={set('year')} required />
                </div>
                <div className="vd-form-field">
                    <label>Colour</label>
                    <input className="vd-input" value={form.colour} onChange={set('colour')} />
                </div>
                <div className="vd-form-field">
                    <label>Daily Rate (₹)</label>
                    <input className="vd-input" type="number" value={form.daily_rate} onChange={set('daily_rate')} required />
                </div>
                <div className="vd-form-field">
                    <label>Seats</label>
                    <input className="vd-input" type="number" value={form.capacity} onChange={set('capacity')} required />
                </div>
                <div className="vd-form-field">
                    <label>Segment</label>
                    <select className="vd-input vd-select" value={form.segment} onChange={set('segment')}>
                        {['hatchback', 'sedan', 'suv', 'luxury', 'van', 'truck'].map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div className="vd-form-field">
                    <label>Fuel</label>
                    <select className="vd-input vd-select" value={form.fuel_type} onChange={set('fuel_type')}>
                        {['petrol', 'diesel', 'electric', 'hybrid', 'cng'].map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                </div>
                <div className="vd-form-field">
                    <label>Transmission</label>
                    <select className="vd-input vd-select" value={form.transmission} onChange={set('transmission')}>
                        {['manual', 'automatic'].map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Odometer / re-verification block ── */}
            <div style={{
                marginTop: 16, background: 'var(--vs2)', border: '1px solid var(--vbdr)',
                borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
                <div className="vd-form-field">
                    <label>Current Odometer (km)</label>
                    <input
                        className="vd-input"
                        type="number"
                        value={form.current_odometer}
                        onChange={set('current_odometer')}
                        placeholder="e.g. 42500"
                    />
                </div>

                {v.last_verified_odometer != null && (
                    <p style={{ fontSize: 11, color: 'var(--vm)', margin: 0 }}>
                        Last verified at {Number(v.last_verified_odometer).toLocaleString('en-IN')} km.
                        {distanceSinceVerified != null && distanceSinceVerified >= 0 && (
                            <> {distanceSinceVerified.toLocaleString('en-IN')} km travelled since then.</>
                        )}
                    </p>
                )}

                {v.needs_reverification && (
                    <p style={{ fontSize: 12, color: '#D97706', fontWeight: 700, margin: 0 }}>
                        🔁 This vehicle is currently flagged for admin re-verification due to distance travelled.
                    </p>
                )}

                {v.needs_review && (
                    <p style={{ fontSize: 12, color: '#D97706', fontWeight: 700, margin: 0 }}>
                        ✏️ You have changes awaiting admin approval.
                        {v.last_edited_at && <> Submitted {fmtDatetime(v.last_edited_at)}.</>}
                    </p>
                )}
            </div>

            <button type="submit" className="vd-btn vd-btn--primary" style={{ marginTop: 16 }} disabled={saving}>
                {saving ? 'Saving…' : alreadyReviewed ? 'Submit for Admin Approval' : 'Save Changes'}
            </button>
        </form>
    );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function VehicleManageModal({
    vehicle: v,
    onClose,
    showToast,
    onRefresh,
    docUploads,
    setDocUploads,
    photoUpload,
    setPhotoUpload,
    availData,
    blockInput,
    onBlockInputChange,
    onLoadAvail,
    onBlock,
    onUnblock,
    onStatusToggle,
    onUpdateVehicle,
}) {
    const [subTab,      setSubTab]      = useState('docs');
    const [lightboxIdx, setLightboxIdx] = useState(null);

    // Lightbox source: 'photos' | 'doc'
    const [lightboxSource, setLightboxSource] = useState('photos');
    // For doc lightbox we build a single-item array on the fly
    const [docLightboxUrl,  setDocLightboxUrl]  = useState(null);

    const canToggle          = ['LIVE', 'INACTIVE', 'CERTIFIED'].includes(v.status);
    const photoCount         = (v.photos || []).length;
    const currentPipelineIdx = PIPELINE.indexOf(v.status);
    const vc                 = VEHICLE_STATUS_CLR[v.status] || { bg: '#F3F4F6', color: '#6B7280' };

    // ── Open doc in lightbox (images) or new tab (PDFs / other) ──────────────
    const openDoc = (url) => {
        if (isImageUrl(url)) {
            setDocLightboxUrl(url);
            setLightboxSource('doc');
            setLightboxIdx(0);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const closeLightbox = () => {
        setLightboxIdx(null);
        setLightboxSource('photos');
        setDocLightboxUrl(null);
    };

    // ── Doc upload ────────────────────────────────────────────────────────────
    const handleDocUpload = async (docType) => {
        if (!v?.id) { showToast('Vehicle not fully loaded — please refresh and try again.', 'error'); return; }
        const file = docUploads[`${v.id}-${docType}`];
        if (!file) { showToast('Select a file.', 'error'); return; }
        const fd = new FormData();
        fd.append('doc_type', docType);
        fd.append('file', file);
        try {
            await uploadVehicleDoc(v.id, fd);
            showToast(`${docType.toUpperCase()} uploaded!`);
            onRefresh();
        } catch (e) {
            showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Upload failed.', 'error');
        }
    };

    // ── Photo upload ──────────────────────────────────────────────────────────
    const handlePhotoUpload = async () => {
        if (!v?.id) { showToast('Vehicle not fully loaded — please refresh and try again.', 'error'); return; }
        if (!photoUpload.file) { showToast('Select a photo.', 'error'); return; }
        const fd = new FormData();
        fd.append('image',    photoUpload.file);
        fd.append('angle',    photoUpload.angle);
        fd.append('is_cover', photoUpload.is_cover ? 'true' : 'false');
        try {
            await uploadVehiclePhoto(v.id, fd);
            showToast('Photo uploaded!');
            onRefresh();
        } catch {
            showToast('Photo upload failed.', 'error');
        }
    };

    // ── Edit details save ──────────────────────────────────────────────────────
    const handleSaveDetails = async (form) => {
        await onUpdateVehicle(v.id, form);
        onRefresh();
    };

    // ── Lightbox photos array (vehicle photos or single doc image) ────────────
    const lightboxPhotos = lightboxSource === 'doc' && docLightboxUrl
        ? [{ image: docLightboxUrl, angle: 'Document' }]
        : (v.photos || []);

    return (
        <div className="vd-modal-overlay" onClick={onClose}>
            <div className="vd-modal" onClick={e => e.stopPropagation()}>

                {/* Shared lightbox — used by both Photos and Documents tabs */}
                {lightboxIdx !== null && lightboxPhotos.length > 0 && (
                    <PhotoLightbox
                        photos={lightboxPhotos}
                        initialIndex={lightboxIdx}
                        onClose={closeLightbox}
                    />
                )}

                {/* Header */}
                <div className="vd-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                            {v.year} {v.make} {v.model}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                            <span style={{
                                fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                                color: 'var(--teal-dark)', background: 'var(--teal-light)',
                                padding: '2px 8px', borderRadius: 4,
                            }}>
                                {v.plate_number}
                            </span>
                            <span className="vd-badge" style={{ background: vc.bg, color: vc.color }}>
                                {v.status?.replace(/_/g, ' ')}
                            </span>
                            {v.is_certified && (
                                <span className="vd-badge" style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>
                                    ✅ Certified
                                </span>
                            )}
                            {v.needs_review && (
                                <span className="vd-badge" style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>
                                    ✏️ Pending Admin Approval
                                </span>
                            )}
                            {v.needs_reverification && (
                                <span className="vd-badge" style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5' }}>
                                    🔁 Re-verification Needed
                                </span>
                            )}
                            <span style={{ fontSize: 12, color: 'var(--vm)' }}>
                                ₹{parseInt(v.daily_rate || 0).toLocaleString('en-IN')}/day · {v.segment}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        {canToggle && (
                            <button
                                className={`vd-toggle-btn ${v.status === 'LIVE' ? 'vd-toggle-btn--off' : 'vd-toggle-btn--on'}`}
                                onClick={() => { onStatusToggle(); onClose(); }}
                            >
                                {v.status === 'LIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                        )}
                        <button onClick={onClose} className="vd-close-btn">✕ Close</button>
                    </div>
                </div>

                {/* Pipeline progress bar */}
                <div style={{
                    padding: '10px 20px', borderBottom: '1px solid var(--vbdr)',
                    background: '#FAFBFC', display: 'flex', alignItems: 'center',
                    gap: 0, overflowX: 'auto',
                }}>
                    {PIPELINE.map((s, i) => {
                        const done   = i < currentPipelineIdx;
                        const active = i === currentPipelineIdx;
                        return (
                            <React.Fragment key={s}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                    <div style={{
                                        width: 26, height: 26, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10, fontWeight: 700, border: '2px solid',
                                        background:   done ? 'var(--teal-primary)' : active ? '#fff' : 'var(--vs2)',
                                        borderColor:  done || active ? 'var(--teal-primary)' : 'var(--vbdr2)',
                                        color:        done ? '#fff' : active ? 'var(--teal-primary)' : 'var(--vm)',
                                        boxShadow:    active ? '0 0 0 3px var(--teal-light)' : 'none',
                                    }}>
                                        {done ? '✓' : i + 1}
                                    </div>
                                    <span style={{
                                        fontSize: 8, fontWeight: active ? 800 : 600,
                                        color: active ? 'var(--teal-dark)' : 'var(--vm)',
                                        textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
                                    }}>
                                        {s.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                {i < PIPELINE.length - 1 && (
                                    <div style={{
                                        flex: 1, height: 2,
                                        background: done ? 'var(--teal-primary)' : 'var(--vbdr2)',
                                        margin: '0 4px', marginBottom: 18, minWidth: 16,
                                    }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Sub-tabs */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '12px 20px', borderBottom: '1px solid var(--vbdr)',
                    background: 'var(--vs)',
                }}>
                    {[
                        ['docs', '📄 Documents'],
                        ['photos', '📷 Photos'],
                        ['availability', '📅 Availability'],
                        ['edit', '✏️ Edit Details'],
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            className={`vd-btn vd-btn--sm ${subTab === id ? 'vd-btn--primary' : 'vd-btn--ghost'}`}
                            onClick={() => setSubTab(id)}
                        >
                            {label}
                            {id === 'edit' && (v.needs_review || v.needs_reverification) && (
                                <span style={{
                                    marginLeft: 6, width: 7, height: 7, borderRadius: '50%',
                                    background: '#D97706', display: 'inline-block',
                                }} />
                            )}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ padding: '18px 20px', overflowY: 'auto', maxHeight: '52vh' }}>

                    {/* ── Documents ── */}
                    {subTab === 'docs' && (
                        <div>
                            <p className="vd-hint">
                                Required: RC, Insurance, PUC — all must be admin-approved before LIVE.
                            </p>
                            <div className="vd-doc-grid">
                                {DOC_TYPES.map(dt => {
                                    const existing = (v.documents || []).find(d => d.doc_type === dt);
                                    const key      = `${v.id}-${dt}`;
                                    const dc       = existing?.status === 'approved'
                                        ? { bg: '#D1FAE5', color: '#059669' }
                                        : existing?.status === 'rejected'
                                            ? { bg: '#FEE2E2', color: '#EF4444' }
                                            : { bg: '#FEF3C7', color: '#D97706' };

                                    const fileUrl     = existing?.file;
                                    const isImg       = isImageUrl(fileUrl);

                                    return (
                                        <div key={dt} className="vd-doc-card">
                                            <div className="vd-doc-card__head">
                                                <span className="vd-doc-card__type">
                                                    {dt.replace(/_/g, ' ').toUpperCase()}
                                                </span>
                                                {existing && (
                                                    <span className="vd-badge" style={{ background: dc.bg, color: dc.color, fontSize: 9 }}>
                                                        {existing.status}
                                                    </span>
                                                )}
                                            </div>

                                            {/* ── Document preview / view link ── */}
                                            {fileUrl && (
                                                isImg ? (
                                                    <div
                                                        onClick={() => openDoc(fileUrl)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            borderRadius: 6,
                                                            overflow: 'hidden',
                                                            border: '1px solid var(--vbdr)',
                                                            display: 'inline-block',
                                                            position: 'relative',
                                                        }}
                                                        title="Click to enlarge"
                                                    >
                                                        <img
                                                            src={fileUrl}
                                                            alt={dt}
                                                            style={{
                                                                width: '100%', height: 70,
                                                                objectFit: 'cover', display: 'block',
                                                            }}
                                                        />
                                                        <div style={{
                                                            position: 'absolute', inset: 0,
                                                            background: 'rgba(0,0,0,0)',
                                                            display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: 11, color: '#fff',
                                                            fontWeight: 600,
                                                            transition: 'background .15s',
                                                        }}
                                                            className="vd-photo-hover-overlay"
                                                        >
                                                            🔍 View
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => openDoc(fileUrl)}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center',
                                                            gap: 5, fontSize: 11, color: 'var(--vacc)',
                                                            background: 'none', border: 'none',
                                                            cursor: 'pointer', padding: '2px 0',
                                                            fontFamily: 'Inter, sans-serif',
                                                            fontWeight: 600,
                                                            marginBottom: 4,
                                                            textDecoration: 'underline',
                                                        }}
                                                    >
                                                        📄 View PDF
                                                    </button>
                                                )
                                            )}

                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.png"
                                                className="vd-file-input"
                                                onChange={e => setDocUploads(p => ({ ...p, [key]: e.target.files[0] }))}
                                            />
                                            <button className="vd-upload-btn" onClick={() => handleDocUpload(dt)}>
                                                {existing ? 'Re-upload' : 'Upload'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Photos ── */}
                    {subTab === 'photos' && (
                        <div>
                            <div className="vd-photo-status">
                                <span className={`vd-photo-count ${photoCount >= 10 ? 'ok' : 'warn'}`}>
                                    {photoCount}/10 {photoCount >= 10 ? '✓ Complete' : '(min 10 required)'}
                                </span>
                            </div>
                            <div className="vd-photo-upload-bar">
                                <div style={{ minWidth: 120 }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vm)', display: 'block', marginBottom: 4 }}>
                                        Angle
                                    </label>
                                    <select
                                        className="vd-input vd-select"
                                        value={photoUpload.angle}
                                        onChange={e => setPhotoUpload(p => ({ ...p, angle: e.target.value }))}
                                    >
                                        {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <label className="vd-cover-check">
                                    <input
                                        type="checkbox"
                                        checked={photoUpload.is_cover}
                                        onChange={e => setPhotoUpload(p => ({ ...p, is_cover: e.target.checked }))}
                                    />
                                    Cover photo
                                </label>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vm)', display: 'block', marginBottom: 4 }}>
                                        Photo
                                    </label>
                                    <input
                                        type="file" accept="image/*" className="vd-file-input"
                                        onChange={e => setPhotoUpload(p => ({ ...p, file: e.target.files[0] }))}
                                    />
                                </div>
                                <button className="vd-upload-btn" onClick={handlePhotoUpload}>Upload</button>
                            </div>
                            {(v.photos || []).length > 0 && (
                                <div className="vd-photos-grid">
                                    {v.photos.map((ph, idx) => (
                                        <div
                                            key={ph.id}
                                            className="vd-photo-item"
                                            onClick={() => {
                                                setLightboxSource('photos');
                                                setDocLightboxUrl(null);
                                                setLightboxIdx(idx);
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <img src={ph.image} alt={ph.angle} />
                                            <div className="vd-photo-item__meta">
                                                {ph.angle}
                                                {ph.is_cover && <span className="vd-cover-tag">Cover</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Availability ── */}
                    {subTab === 'availability' && (
                        <div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                <button className="vd-ghost-btn" onClick={() => onLoadAvail(v.id)}>
                                    Load This Month
                                </button>
                            </div>
                            {availData && (
                                <>
                                    {(availData.blocked_dates || []).length === 0
                                        ? <p className="vd-hint">No dates blocked.</p>
                                        : (
                                            <div className="vd-blocked-dates">
                                                {availData.blocked_dates.map(d => (
                                                    <div key={d} className="vd-blocked-chip">
                                                        {d}
                                                        <button onClick={() => onUnblock(v.id, d)}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                    <div className="vd-block-row">
                                        <input
                                            className="vd-input"
                                            placeholder="2025-09-10, 2025-09-11"
                                            value={blockInput}
                                            onChange={e => onBlockInputChange(e.target.value)}
                                        />
                                        <button className="vd-upload-btn" onClick={() => onBlock(v.id)}>
                                            Block Dates
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Edit Details ── */}
                    {subTab === 'edit' && (
                        <EditDetailsForm
                            vehicle={v}
                            onSave={handleSaveDetails}
                            showToast={showToast}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}