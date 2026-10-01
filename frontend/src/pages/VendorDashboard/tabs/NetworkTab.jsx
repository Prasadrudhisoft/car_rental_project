import React, { useState, useEffect } from 'react';
import { SectionCard } from '../VendorShared';

export default function NetworkTab({ network, onSaveNetwork }) {
    const [enabled,  setEnabled]  = useState(false);
    const [capacity, setCapacity] = useState(3);
    const [saving,   setSaving]   = useState(false);

    useEffect(() => {
        if (network) {
            setEnabled(!!network.is_active);
            setCapacity(network.max_vehicles ?? 3);
        }
    }, [network]);

    if (!network) return null;

    const cap       = Math.max(0, parseInt(capacity, 10) || 0);
    const dirty     = enabled !== !!network.is_active || cap !== network.max_vehicles;
    const available = Math.max(0, cap - (network.occupied || 0));

    const save = async () => {
        setSaving(true);
        await onSaveNetwork({ is_active: enabled, max_vehicles: cap });
        setSaving(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
                background: 'var(--vacc-l)', border: '1px solid rgba(13,184,158,.3)',
                borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 14,
            }}>
                <span style={{ fontSize: 22 }}>🤝</span>
                <div>
                    <strong style={{ fontSize: 14 }}>Accept other vendors' cars at your own location</strong>
                    <p style={{ fontSize: 13, color: 'var(--vt2)', marginTop: 6, lineHeight: 1.6 }}>
                        When enabled, your shop appears as a drop point for customers on one-way trips ending in
                        your city, until all your slots are taken. The parking rate and your earnings are set by
                        the platform.
                    </p>
                </div>
            </div>

            {!network.location_ready && (
                <div className="vd-kyc-alert">
                    Complete your KYC (city, address and map pin) so we know where cars will be dropped.
                </div>
            )}

            <SectionCard title="Vendor Network" subtitle="Based on your own business location">
                {network.location && (
                    <div className="vd-info-group" style={{ marginBottom: 6 }}>
                        <div className="vd-info-group__title">Your Drop Point</div>
                        <div className="vd-info-pair"><span>Location</span><strong>{network.location.name}</strong></div>
                        <div className="vd-info-pair"><span>Address</span><strong>{network.location.address || '—'}</strong></div>
                        <div className="vd-info-pair"><span>City</span><strong>{network.city_name || '—'}</strong></div>
                    </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
                    <input type="checkbox" checked={enabled}
                           onChange={e => setEnabled(e.target.checked)}
                           style={{ width: 18, height: 18, accentColor: 'var(--vacc)' }} />
                    Network: {enabled ? 'Enabled' : 'Disabled'}
                </label>

                <div className="vd-form-field" style={{ maxWidth: 260 }}>
                    <label>Vehicle Capacity (cars from other vendors)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button type="button" className="vd-btn vd-btn--ghost vd-btn--sm"
                                onClick={() => setCapacity(Math.max(0, cap - 1))}>−</button>
                        <input className="vd-input" type="number" min={0} max={100} value={capacity}
                               onChange={e => setCapacity(e.target.value)} style={{ textAlign: 'center' }} />
                        <button type="button" className="vd-btn vd-btn--ghost vd-btn--sm"
                                onClick={() => setCapacity(Math.min(100, cap + 1))}>+</button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
                    {[
                        [cap,                'Capacity',  '#1D4ED8'],
                        [network.occupied,   'Occupied',  '#D97706'],
                        [available,          'Available', available > 0 ? '#059669' : '#EF4444'],
                    ].map(([v, l, color]) => (
                        <div key={l} className="vd-stat-chip" style={{ '--bc': color }}>
                            <span className="vd-stat-chip__n">{v}</span>
                            <span className="vd-stat-chip__l">{l}</span>
                        </div>
                    ))}
                </div>

                {available === 0 && enabled && (
                    <p style={{ fontSize: 12, color: '#B45309' }}>
                        All slots are taken, so your location is hidden from customers until a car is retrieved
                        or you increase the capacity.
                    </p>
                )}
                {network.vendor_earning && (
                    <p style={{ fontSize: 12, color: 'var(--vt2)' }}>
                        You earn <strong>₹{parseFloat(network.vendor_earning).toLocaleString('en-IN')}</strong> per
                        car ({network.vendor_share_pct}% of the ₹{parseFloat(network.city_parking_rate).toLocaleString('en-IN')} city rate).
                    </p>
                )}

                <div>
                    <button className="vd-btn vd-btn--primary" onClick={save}
                            disabled={saving || !dirty || (enabled && !network.location_ready)}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </SectionCard>
        </div>
    );
}