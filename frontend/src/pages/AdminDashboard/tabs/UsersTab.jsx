// ─────────────────────────────────────────────────────────────────────────────
// tabs/UsersTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import DataTable from "../../../components/common/DataTable";
import { KYC_STATUS_CLR, fmtDate } from "../adminConstants";

export default function UsersTab({ users, onSelectUser }) {
    const columns = [
        {
            key: "full_name", label: "Name", sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.email}</span>
                </div>
            ),
        },
        { key: "phone", label: "Phone", sortable: false, width: 130, render: (v) => v || "—" },
        {
            key: "kyc_status", label: "KYC", sortable: true, width: 100,
            render: (v) => {
                const s = KYC_STATUS_CLR[v] || KYC_STATUS_CLR.pending;
                return <span className="dt-badge" style={{ background: s.bg, color: s.color, borderColor: s.color + "40" }}>{v || "pending"}</span>;
            },
        },
        {
            key: "is_email_verified", label: "Email ✓", sortable: true, width: 80, align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontWeight: 700 }}>✓</span> : <span style={{ color: "#EF4444" }}>✕</span>,
        },
        {
            key: "is_phone_verified", label: "Phone ✓", sortable: true, width: 80, align: "center",
            render: (v) => v ? <span style={{ color: "#059669", fontWeight: 700 }}>✓</span> : <span style={{ color: "#EF4444" }}>✕</span>,
        },
        { key: "total_bookings", label: "Bookings", sortable: true, width: 80, align: "center", render: (v) => v ?? "—" },
        { key: "loyalty_points", label: "Points",   sortable: true, width: 80, align: "right",  render: (v) => v != null ? v.toLocaleString("en-IN") : "—" },
        { key: "date_joined",    label: "Joined",   sortable: true, width: 100, render: (v) => fmtDate(v) },
    ];

    return (
        <div className="admin-section">
            <DataTable
                columns={columns}
                data={users.filter((u) => u.role === "customer")}
                searchable
                searchKeys={["full_name", "email", "phone"]}
                searchPlaceholder="Search by name, email or phone…"
                filters={[{
                    key: "kyc_status", label: "KYC Status", colorMap: KYC_STATUS_CLR,
                    options: [
                        { value: "",         label: "All"      },
                        { value: "pending",  label: "Pending"  },
                        { value: "verified", label: "Verified" },
                        { value: "rejected", label: "Rejected" },
                    ],
                }]}
                onRowAction={onSelectUser}
                actionLabel="View User"
                emptyIcon="👤"
                emptyMessage="No customers found."
                pageSize={25}
            />
        </div>
    );
}
