// ─────────────────────────────────────────────────────────────────────────────
// tabs/LocationsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import DataTable from "../../../components/common/DataTable";
import { SectionCard, InlineForm } from "../AdminShared";

export default function LocationsTab({
    cities, locations, cityPairFees,
    formLoading,
    onAddCity, onDeleteCity,
    onDeleteLocation,
    onAddCityPairFee, onDeleteCityPairFee,
}) {
    return (
        <div className="admin-section">
            {/* Cities */}
            <SectionCard title="Cities" subtitle="Add operating cities first.">
                <InlineForm
                    fields={[
                        { key: "name",      label: "City Name",  required: true, placeholder: "e.g. Mumbai" },
                        { key: "state",     label: "State",      required: true, placeholder: "e.g. Maharashtra" },
                        { key: "latitude",  label: "Latitude",   type: "number", step: "0.000001" },
                        { key: "longitude", label: "Longitude",  type: "number", step: "0.000001" },
                    ]}
                    onSubmit={onAddCity}
                    submitLabel="+ Add City"
                    loading={formLoading}
                />
                <div className="admin-data-table" style={{ marginTop: 12 }}>
                    <div className="admin-data-table__header"><span>City</span><span>State</span><span>Coords</span><span></span></div>
                    {cities.length === 0 && <div className="admin-table-empty">No cities yet.</div>}
                    {cities.map((c) => (
                        <div key={c.id} className="admin-data-table__row">
                            <span><strong>{c.name}</strong></span>
                            <span>{c.state}</span>
                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>{c.latitude ? `${c.latitude}, ${c.longitude}` : "—"}</span>
                            <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => onDeleteCity(c.id)}>✕</button>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Locations */}
            <SectionCard title="Pickup / Dropoff Locations">
                <DataTable
                    columns={[
                        { key: "name",          label: "Name",    sortable: true,  render: (v) => <strong>{v}</strong> },
                        { key: "city_name",     label: "City",    sortable: true,  render: (_, row) => row.city?.name || row.city_name || "—" },
                        { key: "location_type", label: "Type",    sortable: true,  width: 120, render: (v) => <span className="admin-badge admin-badge--gray">{v}</span> },
                        { key: "address",       label: "Address", sortable: false, render: (v) => v || "—" },
                    ]}
                    data={locations}
                    searchable
                    searchKeys={["name", "city_name", "address"]}
                    searchPlaceholder="Search locations…"
                    emptyIcon="📍"
                    emptyMessage="No locations yet."
                    pageSize={15}
                    extraActions={[{ label: "✕ Delete", className: "dt-action-btn--danger", onClick: (row) => onDeleteLocation(row.id) }]}
                />
            </SectionCard>

            {/* City pair fees */}
            <SectionCard title="One-Way City Pair Fees">
                <InlineForm
                    fields={[
                        { key: "from_city", label: "From City", type: "select", required: true, options: cities.map((c) => ({ value: c.id, label: c.name })) },
                        { key: "to_city",   label: "To City",   type: "select", required: true, options: cities.map((c) => ({ value: c.id, label: c.name })) },
                        { key: "fee",       label: "Fee (₹)",   type: "number", required: true, step: "0.01" },
                    ]}
                    onSubmit={onAddCityPairFee}
                    submitLabel="+ Add Fee"
                    loading={formLoading}
                />
                <DataTable
                    columns={[
                        { key: "from_city_name", label: "From", sortable: true, render: (_, r) => r.from_city_name || r.from_city },
                        { key: "to_city_name",   label: "To",   sortable: true, render: (_, r) => `→ ${r.to_city_name || r.to_city}` },
                        { key: "fee", label: "Fee", sortable: true, align: "right", width: 120, render: (v) => <span className="admin-currency">₹{parseFloat(v).toLocaleString("en-IN")}</span> },
                    ]}
                    data={cityPairFees}
                    searchable={false}
                    emptyIcon="💸"
                    emptyMessage="No city pair fees yet."
                    pageSize={15}
                    extraActions={[{ label: "✕ Delete", className: "dt-action-btn--danger", onClick: (row) => onDeleteCityPairFee(row.id) }]}
                />
            </SectionCard>
        </div>
    );
}
