// ─────────────────────────────────────────────────────────────────────────────
// tabs/NetworkTab.jsx
// Join-network form + memberships DataTable.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
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
    const networkColumns = [
        { key: 'city_name',    label: 'City',         sortable: true  },
        { key: 'max_vehicles', label: 'Max Vehicles',  sortable: true, width: 110, align: 'center' },
        {
            key: 'current_held_count', label: 'Currently Held', sortable: true, width: 130, align: 'center',
            render: (v, row) => (
                <span style={{ fontWeight: 700, color: v >= row.max_vehicles ? '#EF4444' : '#1D4ED8' }}>
                    {v || 0} / {row.max_vehicles}
                </span>
            ),
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
        <div className="vd-grid-2">
            {/* Join form */}
            <SectionCard title="Join Vendor Network">
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
                            label="Max Vehicles"
                            type="number"
                            value={networkForm.max_vehicles}
                            onChange={e => setNetworkForm(p => ({ ...p, max_vehicles: e.target.value }))}
                            min={1}
                            max={20}
                        />
                    </div>
                    <div style={{ marginTop: 14 }}>
                        <button type="submit" className="vd-btn vd-btn--primary">Join Network →</button>
                    </div>
                </form>
            </SectionCard>

            {/* Memberships table */}
            <SectionCard title="My Memberships">
                <DataTable
                    columns={networkColumns}
                    data={network}
                    searchable={false}
                    emptyIcon="🤝"
                    emptyMessage="Not in any network yet."
                    pageSize={10}
                    extraActions={[{
                        label: 'Leave',
                        className: 'dt-action-btn--danger',
                        onClick: row => onLeaveNetwork(row.id),
                    }]}
                />
            </SectionCard>
        </div>
    );
}