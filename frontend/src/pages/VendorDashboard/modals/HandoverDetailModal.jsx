// ─────────────────────────────────────────────────────────────────────────────
// HandoverDetailModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { InfoRow, Field } from '../VendorShared';
import { HANDOVER_STATUS_CLR } from '../vendorConstants';
import {
    confirmHandoverReceipt,
    uploadHandoverPhoto,
    completeHandoverInspection,
    arrangeHandoverRetrieval,
    grantSublistPermission,
    revokeSublistPermission,
} from '../../../services/api';

export default function HandoverDetailModal({
    handover: h,
    onClose,
    showToast,
    onRefresh,
    handoverNotes,
    setHandoverNotes,
    handoverPhotoFile,
    setHandoverPhotoFile,
}) {
    const handleAction = async (action) => {
        try {
            const notes = handoverNotes[h.id] || '';
            if      (action === 'confirm')             await confirmHandoverReceipt(h.id, notes);
            else if (action === 'inspection_complete') await completeHandoverInspection(h.id);
            else if (action === 'retrieval')           await arrangeHandoverRetrieval(h.id);
            else if (action === 'grant_sublist')       await grantSublistPermission(h.id);
            else if (action === 'revoke_sublist')      await revokeSublistPermission(h.id);
            showToast('Action completed!');
            onRefresh();
        } catch (e) { showToast(e.response?.data?.error || 'Action failed.', 'error'); }
    };

    const handlePhotoUpload = async () => {
        const file = handoverPhotoFile[h.id];
        if (!file) { showToast('Select a photo.', 'error'); return; }
        const fd = new FormData();
        fd.append('image', file);
        try {
            await uploadHandoverPhoto(h.id, fd);
            showToast('Photo uploaded!');
        } catch { showToast('Upload failed.', 'error'); }
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
                        {[
                            ['Originating Vendor', h.originating_vendor_name],
                            ['Return Point',       h.return_point_name || '—'],
                            ['Days Held',         `${h.days_held || 0}d`],
                            ['Photos Uploaded',    h.handover_photos_uploaded ? 'Yes' : 'No'],
                            ['Full Inspection',    h.full_inspection_done ? 'Done' : 'Pending'],
                        ].map(([l, v]) => <InfoRow key={l} label={l} value={v} />)}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {h.status === 'EXPECTED' && (
                            <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Field label="Notes">
                                    <input
                                        className="vd-input"
                                        value={handoverNotes[h.id] || ''}
                                        onChange={e => setHandoverNotes(p => ({ ...p, [h.id]: e.target.value }))}
                                    />
                                </Field>
                                <button className="vd-btn vd-btn--primary" onClick={() => handleAction('confirm')}>
                                    Confirm Receipt
                                </button>
                            </div>
                        )}

                        {['RECEIVED', 'HELD', 'SUBLISTED'].includes(h.status) && (
                            <div style={{ background: 'var(--vs2)', border: '1px solid var(--vbdr)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="vd-file-input"
                                        onChange={e => setHandoverPhotoFile(p => ({ ...p, [h.id]: e.target.files[0] }))}
                                    />
                                    <button className="vd-btn vd-btn--outline vd-btn--sm" onClick={handlePhotoUpload}>
                                        Upload Photo
                                    </button>
                                </div>
                                {h.status === 'RECEIVED'  && <button className="vd-btn vd-btn--primary" onClick={() => handleAction('inspection_complete')}>Complete Inspection</button>}
                                {h.status === 'HELD'      && <button className="vd-btn vd-btn--success" onClick={() => handleAction('grant_sublist')}>Grant Sub-listing</button>}
                                {h.status === 'SUBLISTED' && <button className="vd-btn vd-btn--danger"  onClick={() => handleAction('revoke_sublist')}>Revoke Sub-listing</button>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}