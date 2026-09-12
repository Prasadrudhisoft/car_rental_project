// ─────────────────────────────────────────────────────────────────────────────
// HandoverDetailModal.jsx
// Adds a Revenue Share panel showing the actual split for this handover's
// booking, fetched from /logistics/revenue-share/{booking_id}/.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { InfoRow, Field } from '../VendorShared';
import { HANDOVER_STATUS_CLR } from '../vendorConstants';
import {
    confirmHandoverReceipt,
    uploadHandoverPhoto,
    completeHandoverInspection,
    arrangeHandoverRetrieval,
    grantSublistPermission,
    revokeSublistPermission,
    getRevenueShare,
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
    const [revenueShare, setRevenueShare] = useState(null);
    const [revenueLoading, setRevenueLoading] = useState(true);

    useEffect(() => {
        setRevenueLoading(true);
        getRevenueShare(h.booking)
            .then(({ data }) => setRevenueShare(data))
            .catch(() => setRevenueShare(null))
            .finally(() => setRevenueLoading(false));
    }, [h.booking]);

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

    // Is the current vendor the one RECEIVING this handover (i.e. offering parking)?
    // If so, their earning is partner_handling_fee. If they're the ORIGINATING
    // vendor (the one whose car this is), their share is originating_vendor_amt.
    const isReceivingVendor = !!h.receiving_vendor_name;

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

                    {/* ── NEW: Revenue Share panel ── */}
                    <div className="vd-info-group" style={{ background: '#F0FDF4', borderColor: '#86EFAC' }}>
                        <div className="vd-info-group__title" style={{ color: '#059669', borderBottomColor: '#059669' }}>
                            💰 Revenue Share
                        </div>
                        {revenueLoading ? (
                            <p style={{ fontSize: 12, color: 'var(--vm)' }}>Loading…</p>
                        ) : !revenueShare ? (
                            <p style={{ fontSize: 12, color: 'var(--vm)' }}>Not yet calculated for this booking.</p>
                        ) : (
                            <>
                                <InfoRow label="Total Booking Value" value={`₹${parseFloat(revenueShare.total_revenue).toLocaleString('en-IN')}`} />
                                {isReceivingVendor ? (
                                    <>
                                        <InfoRow
                                            label="You Earn (Handling Fee)"
                                            value={<strong style={{ color: '#059669' }}>₹{parseFloat(revenueShare.partner_handling_fee).toLocaleString('en-IN')}</strong>}
                                        />
                                        <p style={{ fontSize: 11, color: 'var(--vm)', marginTop: 4 }}>
                                            Shown after the platform's facilitation commission has already been deducted.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <InfoRow
                                            label="You Earn (Originating Vendor)"
                                            value={<strong style={{ color: '#059669' }}>₹{parseFloat(revenueShare.originating_vendor_amt).toLocaleString('en-IN')} ({revenueShare.originating_vendor_pct}%)</strong>}
                                        />
                                        <InfoRow
                                            label="Handling Fee Paid to Partner"
                                            value={`₹${parseFloat(revenueShare.partner_handling_fee).toLocaleString('en-IN')}`}
                                        />
                                    </>
                                )}
                                <InfoRow label="Platform Commission" value={`${revenueShare.platform_pct}%`} />
                            </>
                        )}
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