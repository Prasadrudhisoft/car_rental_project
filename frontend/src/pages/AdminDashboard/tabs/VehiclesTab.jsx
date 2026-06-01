// ─────────────────────────────────────────────────────────────────────────────
// tabs/VehiclesTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import DataTable from "../../../components/common/DataTable";
import { StatusBadge } from "../AdminShared";
import { VEHICLE_STATUS_CLR } from "../adminConstants";

export default function VehiclesTab({ vehicles, vehicleStats, vehicleFilter, setVehicleFilter, onSelectVehicle }) {
    const columns = [
        {
            key: "make", label: "Vehicle", sortable: true, width: 200,
            render: (_, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{row.year} {row.make} {row.model}</span>
                    <span className="dt-cell-stack__secondary dt-mono">{row.plate_number}</span>
                </div>
            ),
        },
        {
            key: "vendor", label: "Vendor", sortable: false, width: 160,
            render: (_, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{row.vendor?.vendor_profile?.business_name || row.vendor?.email || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.city?.name || "—"}</span>
                </div>
            ),
        },
        { key: "segment", label: "Segment", sortable: true, width: 100, render: (v) => <span style={{ textTransform: "capitalize" }}>{v || "—"}</span> },
        { key: "status",  label: "Status",  sortable: true, width: 130, render: (v) => <StatusBadge status={v} colorMap={VEHICLE_STATUS_CLR} /> },
        { key: "daily_rate", label: "Rate/Day", sortable: true, width: 100, align: "right", render: (v) => <span className="dt-currency">₹{parseInt(v || 0).toLocaleString("en-IN")}</span> },
        {
            key: "documents", label: "Docs", sortable: false, width: 70, align: "center",
            render: (docs) => {
                const a = (docs || []).filter((d) => d.status === "approved").length;
                const t = (docs || []).length;
                return <span style={{ fontSize: 11, fontWeight: 700, color: a >= 3 ? "#059669" : "#D97706" }}>{a}/{t}</span>;
            },
        },
        {
            key: "photos", label: "Photos", sortable: false, width: 70, align: "center",
            render: (photos) => {
                const n = (photos || []).length;
                return <span style={{ fontSize: 11, fontWeight: 700, color: n >= 10 ? "#059669" : "#D97706" }}>{n}{n >= 10 ? " ✓" : " ⚠"}</span>;
            },
        },
        {
            key: "is_certified", label: "Cert", sortable: true, width: 55, align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontSize: 14 }}>✓</span> : <span style={{ color: "#D1D5DB" }}>—</span>,
        },
    ];

    return (
        <div className="admin-section">
            {vehicleStats && (
                <div className="admin-stats-row">
                    {Object.entries(vehicleStats).map(([s, count]) => {
                        const vc = VEHICLE_STATUS_CLR[s] || { color: "#9CA3AF" };
                        return (
                            <div
                                key={s}
                                className="admin-mini-stat"
                                style={{ borderColor: vc.color + "60", cursor: "pointer", outline: vehicleFilter === s ? `2px solid ${vc.color}` : "none" }}
                                onClick={() => setVehicleFilter((p) => (p === s ? "" : s))}
                            >
                                <span style={{ color: vc.color, fontWeight: 800, fontSize: 17 }}>{count}</span>
                                <span>{s.replace(/_/g, " ")}</span>
                            </div>
                        );
                    })}
                </div>
            )}
            <DataTable
                columns={columns}
                data={vehicles}
                searchable
                searchKeys={["make", "model", "plate_number", "year"]}
                searchPlaceholder="Search by make, model, plate number…"
                filters={[
                    {
                        key: "status", label: "Status", colorMap: VEHICLE_STATUS_CLR,
                        options: [
                            { value: "",               label: "All"           },
                            { value: "PENDING_DOCS",   label: "Pending Docs"  },
                            { value: "DOCS_SUBMITTED", label: "Docs Submitted"},
                            { value: "ADMIN_APPROVED", label: "Admin Approved"},
                            { value: "LIVE",           label: "Live"          },
                            { value: "INACTIVE",       label: "Inactive"      },
                        ],
                    },
                    {
                        key: "segment", label: "Segment",
                        options: [
                            { value: "",          label: "All Segments" },
                            { value: "hatchback", label: "Hatchback"    },
                            { value: "sedan",     label: "Sedan"        },
                            { value: "suv",       label: "SUV"          },
                            { value: "luxury",    label: "Luxury"       },
                            { value: "van",       label: "Van"          },
                        ],
                    },
                ]}
                onRowAction={onSelectVehicle}
                actionLabel="Review Vehicle"
                emptyIcon="🚗"
                emptyMessage="No vehicles found."
                pageSize={20}
            />
        </div>
    );
}
