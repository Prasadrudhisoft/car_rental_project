// ─────────────────────────────────────────────────────────────────────────────
// tabs/VendorsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import DataTable from "../../../components/common/DataTable";
import { StatusBadge } from "../AdminShared";
import { VENDOR_STATUS_CLR, fmtDate, getKYCStatus } from "../adminConstants";

export default function VendorsTab({ vendors, onSelectVendor }) {
    const columns = [
        {
            key: "business_name", label: "Business", sortable: true, width: 220,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v}</span>
                    <span className="dt-cell-stack__secondary">{row.email}</span>
                </div>
            ),
        },
        { key: "city_name", label: "City",   sortable: true, width: 110, render: (v) => v || "—" },
        { key: "status",    label: "Status", sortable: true, width: 120, render: (v) => <StatusBadge status={v} colorMap={VENDOR_STATUS_CLR} /> },
        {
            key: "kyc", label: "KYC", sortable: false, width: 90,
            render: (_, row) => {
                const k = getKYCStatus(row);
                return <span style={{ fontSize: 11, fontWeight: 700, color: k.complete ? "#059669" : "#D97706" }}>{k.done}/{k.total} {k.complete ? "✓" : "⚠"}</span>;
            },
        },
        { key: "rating",     label: "Rating", sortable: true, width: 80,  render: (v) => v > 0 ? `⭐ ${v}` : "—" },
        { key: "created_at", label: "Joined", sortable: true, width: 110, render: (v) => fmtDate(v) },
    ];

    return (
        <div className="admin-section">
            <DataTable
                columns={columns}
                data={vendors}
                searchable
                searchKeys={["business_name", "email", "phone", "city_name"]}
                searchPlaceholder="Search vendors by name, email, phone, city…"
                filters={[{
                    key: "status", label: "Status", colorMap: VENDOR_STATUS_CLR,
                    options: [
                        { value: "",          label: "All Statuses" },
                        { value: "pending",   label: "Pending"      },
                        { value: "approved",  label: "Approved"     },
                        { value: "more_info", label: "More Info"    },
                        { value: "rejected",  label: "Rejected"     },
                        { value: "suspended", label: "Suspended"    },
                    ],
                }]}
                onRowAction={onSelectVendor}
                actionLabel="View Details"
                emptyIcon="🏪"
                emptyMessage="No vendors found."
                pageSize={25}
            />
        </div>
    );
}
