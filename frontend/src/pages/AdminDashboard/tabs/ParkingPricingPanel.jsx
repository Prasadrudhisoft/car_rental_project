import React, { useState, useEffect, useCallback } from "react";
import { SectionCard, InlineForm } from "../AdminShared";
import {
    getCityParkingRates, createCityParkingRate, updateCityParkingRate, deleteCityParkingRate,
    getVendorCommissionOverrides, createVendorCommissionOverride,
    updateVendorCommissionOverride, deleteVendorCommissionOverride,
} from "../../../services/api";

export default function ParkingPricingPanel({ cities, vendors }) {
    const [rates, setRates] = useState([]);
    const [overrides, setOverrides] = useState([]);
    const [editingRateId, setEditingRateId] = useState(null);
    const [editValue, setEditValue] = useState("");

    const load = useCallback(() => {
        getCityParkingRates().then(({ data }) => setRates(data.results || data));
        getVendorCommissionOverrides().then(({ data }) => setOverrides(data.results || data));
    }, []);
    useEffect(() => { load(); }, [load]);

    const citiesWithoutRate = cities.filter(c => !rates.some(r => r.city === c.id));

    const handleSetRate = async (values) => {
        try {
            await createCityParkingRate({ city: values.city, amount: values.amount });
            load();
        } catch (e) {
            alert(e.response?.data ? JSON.stringify(e.response.data) : "Failed to set rate.");
        }
    };

    const handleUpdateRate = async (id) => {
        try {
            await updateCityParkingRate(id, { amount: editValue });
            setEditingRateId(null);
            load();
        } catch (e) {
            alert(e.response?.data ? JSON.stringify(e.response.data) : "Failed to update rate.");
        }
    };

    const handleAddOverride = async (values) => {
        try {
            await createVendorCommissionOverride({
                vendor: values.vendor, city: values.city,
                vendor_share_pct: values.vendor_share_pct, reason: values.reason || "",
            });
            load();
        } catch (e) {
            alert(e.response?.data ? JSON.stringify(e.response.data) : "Failed to add override.");
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div className="admin-config-notice">
                <strong>Parking pricing is set exclusively by admin.</strong> Vendors can opt in to offer
                parking capacity and set how many cars they can hold, but the price and how it's split
                between vendor and platform are controlled entirely here.
            </div>

            {/* ── City Parking Rates ── */}
            <SectionCard
                title="City Parking Rates"
                subtitle="The fixed price charged for a one-way drop-off in each city. Every vendor offering parking in that city is paid based on this same base amount."
            >
                {citiesWithoutRate.length > 0 && (
                    <InlineForm
                        fields={[
                            { key: "city", label: "City", type: "select", required: true,
                              options: citiesWithoutRate.map(c => ({ value: c.id, label: c.name })) },
                            { key: "amount", label: "Parking Rate (₹)", type: "number", required: true, step: "0.01" },
                        ]}
                        onSubmit={handleSetRate}
                        submitLabel="+ Set Rate"
                    />
                )}
                <div className="admin-data-table" style={{ marginTop: 12 }}>
                    <div className="admin-data-table__header"><span>City</span><span>Rate</span><span>Status</span><span></span></div>
                    {rates.length === 0 && <div className="admin-table-empty">No city parking rates set yet.</div>}
                    {rates.map((r) => (
                        <div key={r.id} className="admin-data-table__row">
                            <span><strong>{r.city_name}</strong></span>
                            <span>
                                {editingRateId === r.id ? (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <input
                                            type="number" value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            style={{ width: 90, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--vbdr2)" }}
                                        />
                                        <button className="admin-btn admin-btn--success admin-btn--xs" onClick={() => handleUpdateRate(r.id)}>Save</button>
                                        <button className="admin-btn admin-btn--ghost admin-btn--xs" onClick={() => setEditingRateId(null)}>✕</button>
                                    </div>
                                ) : (
                                    <span className="admin-currency">₹{parseFloat(r.amount).toLocaleString("en-IN")}</span>
                                )}
                            </span>
                            <span>
                                <span className={`admin-badge ${r.is_active ? "admin-badge--green" : "admin-badge--gray"}`}>
                                    {r.is_active ? "Active" : "Inactive"}
                                </span>
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                                {editingRateId !== r.id && (
                                    <button className="admin-btn admin-btn--xs admin-btn--outline"
                                        onClick={() => { setEditingRateId(r.id); setEditValue(r.amount); }}>
                                        Edit
                                    </button>
                                )}
                                <button className="admin-btn admin-btn--xs admin-btn--danger"
                                    onClick={() => window.confirm(`Remove parking rate for ${r.city_name}?`) && deleteCityParkingRate(r.id).then(load)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* ── Per-Vendor Commission Overrides ── */}
            <SectionCard
                title="Vendor Commission Overrides"
                subtitle="Optionally give a specific vendor a different split of the city parking rate. If no override exists, the platform default (Config tab → Logistics → 'Default Parking Vendor Share') applies."
            >
                <InlineForm
                    fields={[
                        { key: "vendor", label: "Vendor", type: "select", required: true,
                          options: vendors.map(v => ({ value: v.user_id ?? v.user, label: v.business_name })) },
                        { key: "city", label: "City", type: "select", required: true,
                          options: cities.map(c => ({ value: c.id, label: c.name })) },
                        { key: "vendor_share_pct", label: "Vendor Share (%)", type: "number", required: true, step: "0.01",
                          placeholder: "e.g. 75" },
                        { key: "reason", label: "Reason (internal note)" },
                    ]}
                    onSubmit={handleAddOverride}
                    submitLabel="+ Add Override"
                />
                <div className="admin-data-table" style={{ marginTop: 12 }}>
                    <div className="admin-data-table__header"><span>Vendor</span><span>City</span><span>Vendor Share</span><span></span></div>
                    {overrides.length === 0 && <div className="admin-table-empty">No vendor-specific overrides — everyone uses the platform default.</div>}
                    {overrides.map((o) => (
                        <div key={o.id} className="admin-data-table__row">
                            <span><strong>{o.vendor_name}</strong></span>
                            <span>{o.city_name}</span>
                            <span className="admin-currency">{o.vendor_share_pct}%</span>
                            <button className="admin-btn admin-btn--xs admin-btn--danger"
                                onClick={() => window.confirm("Remove this override? Vendor reverts to platform default.") && deleteVendorCommissionOverride(o.id).then(load)}>
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}