// ─────────────────────────────────────────────────────────────────────────────
// tabs/FleetTab.jsx
// Add-vehicle form + DataTable listing with "Manage Vehicle" row action.
// Desktop: full DataTable. Mobile (≤768px): tappable vehicle cards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import DataTable from '../../../components/common/DataTable';
import { SectionCard, StatusBadge, FormInput, FormSelect } from '../VendorShared';
import { VEHICLE_STATUS_CLR, SEGMENTS, FUELS } from '../vendorConstants';

// ── Status filter options ─────────────────────────────────────────────────────
const VEH_STATUS_OPTIONS = [
    { value: '',               label: 'All'           },
    { value: 'PENDING_DOCS',   label: 'Pending Docs'  },
    { value: 'DOCS_SUBMITTED', label: 'Docs Submitted'},
    { value: 'ADMIN_APPROVED', label: 'Admin Approved'},
    { value: 'LIVE',           label: 'Live'          },
    { value: 'INACTIVE',       label: 'Inactive'      },
];

// ── Mobile vehicle card ───────────────────────────────────────────────────────
function MobileVehicleCard({ vehicle: v, onSelectVehicle }) {
    const photoCount = (v.photos || []).length;
    const docApproved = (v.documents || []).filter(d => d.status === 'approved').length;
    const docTotal    = (v.documents || []).length;
    const vc          = VEHICLE_STATUS_CLR[v.status] || { bg: '#F3F4F6', color: '#6B7280' };

    return (
        <button
            className="cd-mob-booking-card"
            onClick={() => onSelectVehicle(v)}
            aria-label={`Manage ${v.year} ${v.make} ${v.model}`}
        >
            {/* Row 1: vehicle name + status */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--head">
                <span className="cd-mob-booking-card__vehicle" style={{ fontWeight: 700, fontSize: 14, color: 'var(--vt)' }}>
                    {v.year} {v.make} {v.model}
                </span>
                <span className="vd-badge" style={{ background: vc.bg, color: vc.color, fontSize: 10, padding: '2px 8px' }}>
                    {v.status?.replace(/_/g, ' ')}
                </span>
            </div>

            {/* Row 2: plate + segment + rate */}
            <div className="cd-mob-booking-card__row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <span className="cd-mob-booking-card__plate">{v.plate_number}</span>
                <span style={{ fontSize: 12, color: 'var(--vt2)', textTransform: 'capitalize' }}>{v.segment}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--vacc)', marginLeft: 'auto' }}>
                    ₹{parseInt(v.daily_rate || 0).toLocaleString('en-IN')}/day
                </span>
            </div>

            {/* Row 3: doc + photo counts + certified */}
            <div className="cd-mob-booking-card__row cd-mob-booking-card__row--footer">
                <span className="cd-mob-booking-card__dates">
                    <span style={{ color: docApproved >= 3 ? '#059669' : '#D97706', fontWeight: 600 }}>
                        Docs {docApproved}/{docTotal}
                    </span>
                    {' · '}
                    <span style={{ color: photoCount >= 10 ? '#059669' : '#D97706', fontWeight: 600 }}>
                        Photos {photoCount}
                        {photoCount >= 10 ? ' ✓' : ' ⚠'}
                    </span>
                    {v.current_city_name && v.city_name && v.current_city_name !== v.city_name && (
                        <span style={{ color: '#D97706', fontWeight: 700 }}> · 📍 Away in {v.current_city_name}</span>
                    )}
                    {v.is_certified && ' · ✅ Cert'}
                </span>
                <span className="cd-mob-booking-card__chevron" aria-hidden="true">›</span>
            </div>
        </button>
    );
}

// ── Mobile fleet list ─────────────────────────────────────────────────────────
function MobileFleetList({ vehicles, onSelectVehicle }) {
    const [search,       setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const filtered = useMemo(() => {
        let result = vehicles;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                v =>
                    (v.make         || '').toLowerCase().includes(q) ||
                    (v.model        || '').toLowerCase().includes(q) ||
                    (v.plate_number || '').toLowerCase().includes(q) ||
                    String(v.year   || '').includes(q),
            );
        }
        if (statusFilter) {
            result = result.filter(v => v.status === statusFilter);
        }
        return result;
    }, [vehicles, search, statusFilter]);

    return (
        <div className="cd-mob-bookings">
            {/* Search */}
            <div className="cd-mob-bookings__search-wrap">
                <svg className="cd-mob-bookings__search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                    className="cd-mob-bookings__search vd-mob-search"
                    type="search"
                    placeholder="Search by make, model, plate…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search fleet"
                />
            </div>

            {/* Status pills */}
            <div className="cd-mob-bookings__pills" role="group" aria-label="Filter by status">
                {VEH_STATUS_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        className={`cd-mob-bookings__pill vd-mob-pill${statusFilter === opt.value ? ' cd-mob-bookings__pill--active vd-mob-pill--active' : ''}`}
                        onClick={() => setStatusFilter(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {(search || statusFilter) && (
                <p className="cd-mob-bookings__count">
                    {filtered.length} of {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
                </p>
            )}

            {filtered.length === 0 ? (
                <div className="vd-empty" style={{ padding: '40px 24px' }}>
                    <span style={{ fontSize: 32 }}>🚗</span>
                    <p>No vehicles match your search.</p>
                </div>
            ) : (
                <div className="cd-mob-bookings__list">
                    {filtered.map((v, i) => (
                        <MobileVehicleCard key={v.id ?? i} vehicle={v} onSelectVehicle={onSelectVehicle} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Desktop columns ───────────────────────────────────────────────────────────
const columns = [
    {
        key: 'make', label: 'Vehicle', sortable: true, width: 220,
        render: (_, row) => (
            <div className="dt-cell-stack">
                <span className="dt-cell-stack__primary">{row.year} {row.make} {row.model}</span>
                <span className="dt-cell-stack__secondary" style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 10 }}>
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
        key: 'current_city_name', label: 'Current Location', sortable: true, width: 140,
        render: (v, row) => {
            const isAway = v && row.city_name && v !== row.city_name;
            return isAway ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>
                    📍 {v} <span style={{ fontWeight: 400, color: 'var(--vm)' }}>(away)</span>
                </span>
            ) : (
                <span style={{ fontSize: 12, color: 'var(--vt2)' }}>{v || row.city_name || '—'}</span>
            );
        },
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
            return <span style={{ fontSize: 11, fontWeight: 700, color: a >= 3 ? '#059669' : '#D97706' }}>{a}/{(docs || []).length}</span>;
        },
    },
    {
        key: 'photos', label: 'Photos', sortable: false, width: 70, align: 'center',
        render: photos => {
            const n = (photos || []).length;
            return <span style={{ fontSize: 11, fontWeight: 700, color: n >= 10 ? '#059669' : '#D97706' }}>{n} {n >= 10 ? '✓' : '⚠'}</span>;
        },
    },
    {
        key: 'is_certified', label: 'Cert', sortable: true, width: 60, align: 'center',
        render: v => v ? <span style={{ color: '#059669', fontSize: 14 }}>✅</span> : <span style={{ color: '#D1D5DB' }}>—</span>,
    },
];

// ── Main export ───────────────────────────────────────────────────────────────
export default function FleetTab({
    vehicles, showAddVehicle, setShowAddVehicle,
    vehicleForm, vf, cities, cityLocations,
    onAddVehicle, onSelectVehicle,
}) {
    return (
        <div className="vd-section">
            <div className="vd-sec-hd">
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>
                    Fleet <span className="vd-count">({vehicles.length})</span>
                </h2>
                <button className="vd-btn vd-btn--primary" onClick={() => setShowAddVehicle(v => !v)}>
                    {showAddVehicle ? '✕ Cancel' : '+ Register Vehicle'}
                </button>
            </div>

            {/* Add vehicle form — unchanged */}
            {showAddVehicle && (
                <SectionCard title="Register New Vehicle">
                    <form onSubmit={onAddVehicle}>
                        <div className="vd-fg vd-fg--3">
                            <FormInput label="Make"           value={vehicleForm.make}         onChange={vf('make')}         required />
                            <FormInput label="Model"          value={vehicleForm.model}        onChange={vf('model')}        required />
                            <FormInput label="Year"           value={vehicleForm.year}         onChange={vf('year')}         type="number" min={2000} max={2027} required />
                            <FormInput label="Colour"         value={vehicleForm.colour}       onChange={vf('colour')} />
                            <FormInput label="Plate Number"   value={vehicleForm.plate_number} onChange={vf('plate_number')} required />
                            <FormInput label="Daily Rate (₹)" value={vehicleForm.daily_rate}   onChange={vf('daily_rate')}   type="number" min={300} required />
                            <FormInput label="Seats"          value={vehicleForm.capacity}     onChange={vf('capacity')}     type="number" min={2} max={50} required />
                            <FormSelect label="Segment"       value={vehicleForm.segment}      onChange={vf('segment')}      options={SEGMENTS} />
                            <FormSelect label="Fuel"          value={vehicleForm.fuel_type}    onChange={vf('fuel_type')}    options={FUELS} />
                            <FormSelect label="Transmission"  value={vehicleForm.transmission} onChange={vf('transmission')} options={['manual', 'automatic']} />
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

            {/* Desktop table */}
            <div className="cd-bookings-desktop">
                <DataTable
                    columns={columns}
                    data={vehicles}
                    searchable
                    searchKeys={['make', 'model', 'plate_number', 'year']}
                    searchPlaceholder="Search by make, model, plate number…"
                    filters={[
                        {
                            key: 'status', label: 'Status',
                            options: VEH_STATUS_OPTIONS,
                            colorMap: VEHICLE_STATUS_CLR,
                        },
                        {
                            key: 'segment', label: 'Segment',
                            options: [{ value: '', label: 'All' }, ...SEGMENTS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))],
                        },
                    ]}
                    onRowAction={row => onSelectVehicle(row)}
                    actionLabel="Manage Vehicle"
                    emptyIcon="🚗"
                    emptyMessage="No vehicles registered yet."
                    pageSize={15}
                />
            </div>

            {/* Mobile card list */}
            <div className="cd-bookings-mobile">
                <MobileFleetList vehicles={vehicles} onSelectVehicle={onSelectVehicle} />
            </div>
        </div>
    );
}