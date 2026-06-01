// ─────────────────────────────────────────────────────────────────────────────
// tabs/LogisticsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import DataTable from "../../../components/common/DataTable";
import { SectionCard, InlineForm } from "../AdminShared";
import { StatusBadge } from "../AdminShared";
import { HANDOVER_STATUS_CLR } from "../adminConstants";

export default function LogisticsTab({
    handovers, logisticsStats, network, cities,
    returnPoints, formLoading,
    onAddReturnPoint, onDeleteReturnPoint,
}) {
    const handoverColumns = [
        { key: "vehicle_display",          label: "Vehicle",      sortable: true,  width: 180, render: (v) => v || "—" },
        { key: "booking_ref",              label: "Booking",      sortable: true,  width: 130, render: (v) => <span className="dt-mono">{v || "—"}</span> },
        { key: "originating_vendor_name",  label: "From Vendor",  sortable: true,  width: 160, render: (v) => v || "—" },
        { key: "return_point_name",        label: "Return Point", sortable: true,  width: 140, render: (v) => v ? `📍 ${v}` : "—" },
        { key: "status",                   label: "Status",       sortable: true,  width: 110, render: (v) => <StatusBadge status={v} colorMap={HANDOVER_STATUS_CLR} /> },
        { key: "days_held",                label: "Days Held",    sortable: true,  width: 90, align: "center", render: (v) => v ? <span style={{ color: v > 3 ? "#D97706" : "inherit" }}>{v}d</span> : "—" },
    ];

    return (
        <div className="admin-section">
            {logisticsStats && (
                <div className="admin-stats-row">
                    {[
                        ["🕐", "Expected",   logisticsStats.expected,        "#D97706"],
                        ["📥", "Received",   logisticsStats.received,        "#1D4ED8"],
                        ["🔒", "Held",       logisticsStats.held,            "#D97706"],
                        ["🟢", "Sub-listed", logisticsStats.sublisted,       "#059669"],
                        ["🤝", "Network",    logisticsStats.network_vendors, "#7C3AED"],
                        ["📍", "Ret. Points",logisticsStats.return_points,   "#0DB89E"],
                    ].map(([icon, label, val, color]) => (
                        <div key={label} className="admin-mini-stat" style={{ borderColor: color + "50" }}>
                            <span>{icon}</span>
                            <span style={{ color, fontWeight: 800, fontSize: 17 }}>{val ?? 0}</span>
                            <span style={{ fontSize: 10 }}>{label}</span>
                        </div>
                    ))}
                </div>
            )}

            <SectionCard title="Return Points" subtitle="Designated drop-off points for one-way returns.">
                <InlineForm
                    fields={[
                        { key: "name",       label: "Name",     required: true },
                        { key: "city",       label: "City",     type: "select", required: true, options: cities.map((c) => ({ value: c.id, label: c.name })) },
                        { key: "point_type", label: "Type",     type: "select", required: true, options: [{ value: "partner_vendor", label: "Partner Vendor Lot" }, { value: "parking", label: "Paid Parking" }] },
                        { key: "address",    label: "Address" },
                    ]}
                    onSubmit={onAddReturnPoint}
                    submitLabel="+ Add Return Point"
                    loading={formLoading}
                />
            </SectionCard>

            <DataTable
                columns={handoverColumns}
                data={handovers}
                searchable
                searchKeys={["vehicle_display", "booking_ref", "originating_vendor_name"]}
                searchPlaceholder="Search handovers…"
                filters={[{
                    key: "status", label: "Status", colorMap: HANDOVER_STATUS_CLR,
                    options: [
                        { value: "",           label: "All"       },
                        { value: "EXPECTED",   label: "Expected"  },
                        { value: "RECEIVED",   label: "Received"  },
                        { value: "HELD",       label: "Held"      },
                        { value: "SUBLISTED",  label: "Sublisted" },
                    ],
                }]}
                emptyIcon="🔄"
                emptyMessage="No active handovers."
                pageSize={15}
            />

            {network.length > 0 && (
                <SectionCard title="Vendor Network">
                    <DataTable
                        columns={[
                            { key: "business_name",       label: "Vendor", sortable: true },
                            { key: "city_name",           label: "City",   sortable: true, width: 120 },
                            { key: "max_vehicles",        label: "Max",    sortable: true, width: 70,  align: "center" },
                            {
                                key: "current_held_count", label: "Held", sortable: true, width: 70, align: "center",
                                render: (v, row) => <span className={`admin-badge ${v >= row.max_vehicles ? "admin-badge--red" : "admin-badge--blue"}`}>{v}/{row.max_vehicles}</span>,
                            },
                            {
                                key: "is_active", label: "Status", sortable: true, width: 90,
                                render: (v) => <span className={`admin-badge ${v ? "admin-badge--green" : "admin-badge--gray"}`}>{v ? "Active" : "Inactive"}</span>,
                            },
                        ]}
                        data={network}
                        searchable={false}
                        emptyIcon="🤝"
                        emptyMessage="No network vendors."
                        pageSize={10}
                    />
                </SectionCard>
            )}
        </div>
    );
}
