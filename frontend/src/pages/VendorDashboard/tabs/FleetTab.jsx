// ─────────────────────────────────────────────────────────────────────────────
// tabs/FleetTab.jsx
// Add-vehicle form + DataTable listing with "Manage Vehicle" row action.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import DataTable from '../../../components/common/DataTable';
import { SectionCard, StatusBadge, FormInput, FormSelect } from '../VendorShared';
import { VEHICLE_STATUS_CLR, SEGMENTS, FUELS } from '../vendorConstants';

export default function FleetTab({
    vehicles,
    showAddVehicle,
    setShowAddVehicle,
    vehicleForm,
    vf,
    cities,
    cityLocations,
    onAddVehicle,
    onSelectVehicle,
}) {
    const columns = [
        {
            key: 'make', label: 'Vehicle', sortable: true, width: 220,
            render: (_, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{row.year} {row.make} {row.model}</span>
                    <span className="dt-cell-stack__secondary" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                        {row.plate_number}
                    </span>
                </div>
            ),
        },
        {
            key: 'segment', label: 'Segment', sortable: true, width: 100,
            render: v => <span style={{ textTransform: 'capitalize' }}>{v || '—'}</span>,
        },
        {
            key: 'fuel_type', label: 'Fuel', sortable: true, width: 80,
            render: v => <span style={{ textTransform: 'capitalize' }}>{v || '—'}</span>,
        },
        {
            key: 'status', label: 'Status', sortable: true, width: 130,
            render: val => <StatusBadge status={val} statusMap={VEHICLE_STATUS_CLR} />,
        },
        {
            key: 'daily_rate', label: 'Rate/Day', sortable: true, width: 100, align: 'right',
            render: v => <span className="dt-currency">₹{parseInt(v || 0).toLocaleString('en-IN')}</span>,
        },
        {
            key: 'documents', label: 'Docs', sortable: false, width: 70, align: 'center',
            render: docs => {
                const a = (docs || []).filter(d => d.status === 'approved').length;
                return (
                    <span style={{ fontSize: 11, fontWeight: 700, color: a >= 3 ? '#059669' : '#D97706' }}>
                        {a}/{(docs || []).length}
                    </span>
                );
            },
        },
        {
            key: 'photos', label: 'Photos', sortable: false, width: 70, align: 'center',
            render: photos => {
                const n = (photos || []).length;
                return (
                    <span style={{ fontSize: 11, fontWeight: 700, color: n >= 10 ? '#059669' : '#D97706' }}>
                        {n} {n >= 10 ? '✓' : '⚠'}
                    </span>
                );
            },
        },
        {
            key: 'is_certified', label: 'Cert', sortable: true, width: 60, align: 'center',
            render: v => v
                ? <span style={{ color: '#059669', fontSize: 14 }}>✅</span>
                : <span style={{ color: '#D1D5DB' }}>—</span>,
        },
    ];

    return (
        <div className="vd-section">
            <div className="vd-sec-hd">
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>
                    Fleet <span className="vd-count">({vehicles.length})</span>
                </h2>
                <button
                    className="vd-btn vd-btn--primary"
                    onClick={() => setShowAddVehicle(v => !v)}
                >
                    {showAddVehicle ? '✕ Cancel' : '+ Register Vehicle'}
                </button>
            </div>

            {/* Add vehicle form */}
            {showAddVehicle && (
                <SectionCard title="Register New Vehicle">
                    <form onSubmit={onAddVehicle}>
                        <div className="vd-fg vd-fg--3">
                            <FormInput label="Make"         value={vehicleForm.make}         onChange={vf('make')}         required />
                            <FormInput label="Model"        value={vehicleForm.model}        onChange={vf('model')}        required />
                            <FormInput label="Year"         value={vehicleForm.year}         onChange={vf('year')}         type="number" min={2000} max={2027} required />
                            <FormInput label="Colour"       value={vehicleForm.colour}       onChange={vf('colour')} />
                            <FormInput label="Plate Number" value={vehicleForm.plate_number} onChange={vf('plate_number')} required />
                            <FormInput label="Daily Rate (₹)" value={vehicleForm.daily_rate} onChange={vf('daily_rate')}   type="number" min={300} required />
                            <FormInput label="Seats"        value={vehicleForm.capacity}     onChange={vf('capacity')}     type="number" min={2} max={50} required />
                            <FormSelect label="Segment"     value={vehicleForm.segment}      onChange={vf('segment')}      options={SEGMENTS} />
                            <FormSelect label="Fuel"        value={vehicleForm.fuel_type}    onChange={vf('fuel_type')}    options={FUELS} />
                            <FormSelect label="Transmission" value={vehicleForm.transmission} onChange={vf('transmission')} options={['manual', 'automatic']} />
                            <FormSelect
                                label="City"
                                value={vehicleForm.city}
                                onChange={vf('city')}
                                required
                                options={[{ value: '', label: 'Select city…' }, ...cities.map(c => ({ value: c.id, label: `${c.name}, ${c.state}` }))]}
                            />
                            {cityLocations.length > 0 && (
                                <FormSelect
                                    label="Pickup Location"
                                    value={vehicleForm.pickup_location}
                                    onChange={vf('pickup_location')}
                                    options={[{ value: '', label: 'Select…' }, ...cityLocations.map(l => ({ value: l.id, label: l.name }))]}
                                />
                            )}
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <button type="submit" className="vd-btn vd-btn--primary">Register Vehicle →</button>
                        </div>
                    </form>
                </SectionCard>
            )}

            <DataTable
                columns={columns}
                data={vehicles}
                searchable
                searchKeys={['make', 'model', 'plate_number', 'year']}
                searchPlaceholder="Search by make, model, plate number…"
                filters={[
                    {
                        key: 'status', label: 'Status',
                        options: [
                            { value: '',               label: 'All'           },
                            { value: 'PENDING_DOCS',   label: 'Pending Docs'  },
                            { value: 'DOCS_SUBMITTED', label: 'Docs Submitted'},
                            { value: 'ADMIN_APPROVED', label: 'Admin Approved'},
                            { value: 'LIVE',           label: 'Live'          },
                            { value: 'INACTIVE',       label: 'Inactive'      },
                        ],
                        colorMap: VEHICLE_STATUS_CLR,
                    },
                    {
                        key: 'segment', label: 'Segment',
                        options: [
                            { value: '', label: 'All' },
                            ...SEGMENTS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
                        ],
                    },
                ]}
                onRowAction={row => onSelectVehicle(row)}
                actionLabel="Manage Vehicle"
                emptyIcon="🚗"
                emptyMessage="No vehicles registered yet."
                pageSize={15}
            />
        </div>
    );
}