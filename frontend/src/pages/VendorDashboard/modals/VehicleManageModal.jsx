// ─────────────────────────────────────────────────────────────────────────────
// VehicleManageModal.jsx
// Full vehicle management modal: pipeline progress bar, docs sub-tab,
// photos sub-tab, availability sub-tab, status toggle.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { PhotoLightbox } from '../VendorMediaComponents';
import { VEHICLE_STATUS_CLR, DOC_TYPES, ANGLES } from '../vendorConstants';
import { uploadVehicleDoc, uploadVehiclePhoto } from '../../../services/api';

const PIPELINE = ['PENDING_DOCS', 'DOCS_SUBMITTED', 'ADMIN_APPROVED', 'CERTIFIED', 'LIVE'];

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
}) {
    const [subTab,      setSubTab]      = useState('docs');
    const [lightboxIdx, setLightboxIdx] = useState(null);

    const canToggle         = ['LIVE', 'INACTIVE', 'CERTIFIED'].includes(v.status);
    const photoCount        = (v.photos || []).length;
    const currentPipelineIdx = PIPELINE.indexOf(v.status);
    const vc                = VEHICLE_STATUS_CLR[v.status] || { bg: '#F3F4F6', color: '#6B7280' };

    // ── Doc upload ────────────────────────────────────────────────────────────
    const handleDocUpload = async (docType) => {
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

    return (
        <div className="vd-modal-overlay" onClick={onClose}>
            <div className="vd-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="vd-modal__head">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{v.year} {v.make} {v.model}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--teal-dark)', background: 'var(--teal-light)', padding: '2px 8px', borderRadius: 4 }}>
                                {v.plate_number}
                            </span>
                            <span className="vd-badge" style={{ background: vc.bg, color: vc.color }}>{v.status?.replace(/_/g, ' ')}</span>
                            {v.is_certified && <span className="vd-badge" style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>✅ Certified</span>}
                            <span style={{ fontSize: 12, color: 'var(--vm)' }}>₹{parseInt(v.daily_rate || 0).toLocaleString('en-IN')}/day · {v.segment}</span>
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
                <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--vbdr)', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
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
                                    <span style={{ fontSize: 8, fontWeight: active ? 800 : 600, color: active ? 'var(--teal-dark)' : 'var(--vm)', textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>
                                        {s.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                {i < PIPELINE.length - 1 && (
                                    <div style={{ flex: 1, height: 2, background: done ? 'var(--teal-primary)' : 'var(--vbdr2)', margin: '0 4px', marginBottom: 18, minWidth: 16 }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Sub-tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--vbdr)', background: 'var(--vs)' }}>
                    {[['docs', '📄 Documents'], ['photos', '📷 Photos'], ['availability', '📅 Availability']].map(([id, label]) => (
                        <button
                            key={id}
                            className={`vd-btn vd-btn--sm ${subTab === id ? 'vd-btn--primary' : 'vd-btn--ghost'}`}
                            onClick={() => setSubTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ padding: '18px 20px', overflowY: 'auto', maxHeight: '52vh' }}>

                    {/* ── Documents ── */}
                    {subTab === 'docs' && (
                        <div>
                            <p className="vd-hint">Required: RC, Insurance, PUC — all must be admin-approved before LIVE.</p>
                            <div className="vd-doc-grid">
                                {DOC_TYPES.map(dt => {
                                    const existing = (v.documents || []).find(d => d.doc_type === dt);
                                    const key      = `${v.id}-${dt}`;
                                    const dc       = existing?.status === 'approved' ? { bg: '#D1FAE5', color: '#059669' }
                                                   : existing?.status === 'rejected' ? { bg: '#FEE2E2', color: '#EF4444' }
                                                   :                                   { bg: '#FEF3C7', color: '#D97706' };
                                    return (
                                        <div key={dt} className="vd-doc-card">
                                            <div className="vd-doc-card__head">
                                                <span className="vd-doc-card__type">{dt.replace(/_/g, ' ').toUpperCase()}</span>
                                                {existing && (
                                                    <span className="vd-badge" style={{ background: dc.bg, color: dc.color, fontSize: 9 }}>{existing.status}</span>
                                                )}
                                            </div>
                                            {existing?.file && (
                                                <a href={existing.file} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--vacc)', marginBottom: 4, display: 'inline-block' }}>View</a>
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
                            {lightboxIdx !== null && (v.photos || []).length > 0 && (
                                <PhotoLightbox photos={v.photos} initialIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
                            )}
                            <div className="vd-photo-status">
                                <span className={`vd-photo-count ${photoCount >= 10 ? 'ok' : 'warn'}`}>
                                    {photoCount}/10 {photoCount >= 10 ? '✓ Complete' : '(min 10 required)'}
                                </span>
                            </div>
                            <div className="vd-photo-upload-bar">
                                <div style={{ minWidth: 120 }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vm)', display: 'block', marginBottom: 4 }}>Angle</label>
                                    <select className="vd-input vd-select" value={photoUpload.angle} onChange={e => setPhotoUpload(p => ({ ...p, angle: e.target.value }))}>
                                        {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <label className="vd-cover-check">
                                    <input type="checkbox" checked={photoUpload.is_cover} onChange={e => setPhotoUpload(p => ({ ...p, is_cover: e.target.checked }))} />
                                    Cover photo
                                </label>
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
                                <button className="vd-ghost-btn" onClick={() => onLoadAvail(v.id)}>Load This Month</button>
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