// ─────────────────────────────────────────────────────────────────────────────
// tabs/BookingsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import DataTable from "../../../components/common/DataTable";
import { StatusBadge } from "../AdminShared";
import { BOOKING_STATUS_CLR, fmtDate } from "../adminConstants";

export default function BookingsTab({ bookings, onSelectBooking }) {
    const columns = [
        { key: "booking_ref",  label: "Ref",      sortable: true, width: 140, render: (v) => <span className="dt-mono">{v}</span> },
        {
            key: "customer_name", label: "Customer", sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.customer_email}</span>
                </div>
            ),
        },
        {
            key: "vehicle_display", label: "Vehicle", sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary dt-mono">{row.vehicle?.plate_number || "—"}</span>
                </div>
            ),
        },
        { key: "status",      label: "Status",  sortable: true, width: 110, render: (v) => <StatusBadge status={v} colorMap={BOOKING_STATUS_CLR} /> },
        { key: "pickup_date", label: "Pickup",  sortable: true, width: 100, render: (v) => v || "—" },
        { key: "rental_days", label: "Days",    sortable: true, width: 60,  align: "center", render: (v) => v ?? "—" },
        { key: "total_amount", label: "Total",  sortable: true, width: 110, align: "right",  render: (v) => <span className="dt-currency">₹{parseFloat(v || 0).toLocaleString("en-IN")}</span> },
        {
            key: "payment_captured", label: "Paid", sortable: true, width: 60, align: "center",
            render: (v) => v
                ? <span style={{ color: "#059669", fontWeight: 700, fontSize: 13 }}>✓</span>
                : <span style={{ color: "#EF4444", fontSize: 13 }}>✕</span>,
        },
        { key: "created_at", label: "Created", sortable: true, width: 110, render: (v) => fmtDate(v) },
    ];

    return (
        <div className="admin-section">
            <DataTable
                columns={columns}
                data={bookings}
                searchable
                searchKeys={["booking_ref", "customer_name", "customer_email", "vehicle_display"]}
                searchPlaceholder="Search by ref, customer, vehicle…"
                filters={[
                    {
                        key: "status", label: "Status", colorMap: BOOKING_STATUS_CLR,
                        options: [
                            { value: "",          label: "All"       },
                            { value: "PENDING",   label: "Pending"   },
                            { value: "CONFIRMED", label: "Confirmed" },
                            { value: "ACTIVE",    label: "Active"    },
                            { value: "COMPLETED", label: "Completed" },
                            { value: "CANCELLED", label: "Cancelled" },
                        ],
                    },
                    {
                        key: "payment_captured", label: "Payment",
                        options: [{ value: "", label: "All" }, { value: "true", label: "Paid" }, { value: "false", label: "Unpaid" }],
                    },
                ]}
                onRowAction={onSelectBooking}
                actionLabel="View Booking"
                emptyIcon="📋"
                emptyMessage="No bookings found."
                pageSize={25}
            />
        </div>
    );
}
