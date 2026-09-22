import React, { useState } from 'react';
import DataTable from '../../../components/common/DataTable';
import { SectionCard, FormSelect, FormInput } from '../VendorShared';

export default function NetworkTab({
    network,
    cities,
    networkForm,
    setNetworkForm,
    onJoinNetwork,
    onLeaveNetwork,
}) {
    const [showExplainer, setShowExplainer] = useState(true);

    const networkColumns = [
        { key: 'city_name',    label: 'City',         sortable: true  },
        { key: 'max_vehicles', label: 'Your Capacity',  sortable: true, width: 110, align: 'center' },
        {
            key: 'current_held_count', label: 'Currently Holding', sortable: true, width: 150, align: 'center',
            render: (v, row) => (
                <span style={{ fontWeight: 700, color: v >= row.max_vehicles ? '#EF4444' : '#1D4ED8' }}>
                    {v || 0} / {row.max_vehicles}
                </span>
            ),
        },
        {
            key: 'city_parking_rate', label: 'City Rate', sortable: false, width: 110, align: 'right',
            render: (v) => v ? <span>₹{parseFloat(v).toLocaleString('en-IN')}</span> : <span style={{ color: 'var(--vm)', fontStyle: 'italic' }}>Not set</span>,
        },
        {
            key: 'vendor_earning', label: 'You Earn / Car', sortable: false, width: 130, align: 'right',
            render: (v, row) => v
                ? <span style={{ fontWeight: 700, color: 'var(--vacc)' }}>₹{parseFloat(v).toLocaleString('en-IN')} <span style={{ fontSize: 10, color: 'var(--vm)', fontWeight: 400 }}>({row.vendor_share_pct}%)</span></span>
                : <span style={{ color: 'var(--vm)' }}>—</span>,
        },
        {
            key: 'is_active', label: 'Status', sortable: true, width: 90,
            render: v => (
                <span className="vd-badge" style={{
                    background: v ? '#D1FAE5' : '#FEE2E2',
                    color:      v ? '#059669' : '#EF4444',
                    border:     v ? '1px solid #6EE7B7' : '1px solid #FCA5A5',
                }}>
                    {v ? 'Active' : 'Inactive'}
                </span>
            ),
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {showExplainer && (
                <div style={{
                    background: 'var(--vacc-l)', border: '1px solid rgba(13,184,158,.3)',
                    borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 14,
                }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🤝</span>
                    <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 14 }}>Earn extra income by parking other vendors' cars</strong>
                        <p style={{ fontSize: 13, color: 'var(--vt2)', marginTop: 6, lineHeight: 1.6 }}>
                            When a customer books a one-way trip ending in a city where <em>you</em> operate,
                            our system can automatically drop that car off at your lot. You choose which cities
                            you participate in and how many cars you can hold — the parking price and your
                            earnings share are set centrally by the platform to keep pricing fair and consistent
                            across all vendors in the same city.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowExplainer(false)}
                        style={{ background: 'none', border: 'none', color: 'var(--vt2)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="vd-grid-2">
                <SectionCard
                    title="Offer Parking in a City"
                    subtitle="Choose a city and how many cars you can hold. Pricing is set by the platform — see your earnings per car in the table once you join."
                >
                    <form onSubmit={onJoinNetwork}>
                        <div className="vd-fg vd-fg--2">
                            <FormSelect
                                label="City *"
                                value={networkForm.city}
                                onChange={e => setNetworkForm(p => ({ ...p, city: e.target.value }))}
                                required
                                options={[{ value: '', label: 'Select…' }, ...cities.map(c => ({ value: c.id, label: c.name }))]}
                            />
                            <FormInput
                                label="How Many Cars Can You Hold?"
                                type="number"
                                value={networkForm.max_vehicles}
                                onChange={e => setNetworkForm(p => ({ ...p, max_vehicles: e.target.value }))}
                                min={1}
                                max={20}
                            />
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--vm)', marginTop: 10 }}>
                            💡 Pricing and your earnings share are fixed by the platform per city — not
                            something you set here. This keeps rates consistent for every customer regardless
                            of which vendor happens to receive their car.
                        </p>
                        <div style={{ marginTop: 14 }}>
                            <button type="submit" className="vd-btn vd-btn--primary">Start Offering Parking →</button>
                        </div>
                    </form>
                </SectionCard>

                <SectionCard title="Your Active Offers">
                    <DataTable
                        columns={networkColumns}
                        data={network}
                        searchable={false}
                        emptyIcon="🅿️"
                        emptyMessage="You're not offering parking anywhere yet."
                        pageSize={10}
                        extraActions={[{
                            label: 'Stop Offering',
                            className: 'dt-action-btn--danger',
                            onClick: row => onLeaveNetwork(row.id),
                        }]}
                    />
                </SectionCard>
            </div>
        </div>
    );
}