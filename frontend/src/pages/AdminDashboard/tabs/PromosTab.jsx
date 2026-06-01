// ─────────────────────────────────────────────────────────────────────────────
// tabs/PromosTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import DataTable from "../../../components/common/DataTable";
import { SectionCard, InlineForm } from "../AdminShared";

export default function PromosTab({ promos, formLoading, onAddPromo, onDeletePromo }) {
    return (
        <div className="admin-section">
            <SectionCard title="Create Promo Code">
                <InlineForm
                    fields={[
                        { key: "code",           label: "Code",       required: true,  placeholder: "FIRST50" },
                        {
                            key: "discount_type", label: "Type",       type: "select",  required: true, default: "flat",
                            options: [{ value: "flat", label: "Flat (₹)" }, { value: "percentage", label: "Percentage (%)" }],
                        },
                        { key: "discount_value", label: "Discount",   type: "number",  required: true },
                        { key: "max_uses",       label: "Max Uses",   type: "number" },
                        { key: "valid_from",     label: "Valid From", type: "datetime-local", required: true },
                        { key: "valid_until",    label: "Valid Until",type: "datetime-local", required: true },
                    ]}
                    onSubmit={onAddPromo}
                    submitLabel="+ Create Promo"
                    loading={formLoading}
                />
            </SectionCard>

            <DataTable
                columns={[
                    { key: "code",             label: "Code",  sortable: true, render: (v) => <span className="dt-mono">{v}</span> },
                    {
                        key: "discount_type",  label: "Type",  sortable: true, width: 120,
                        render: (_, row) => row.discount_type === "flat"
                            ? `₹${row.discount_value} off`
                            : `${row.discount_value}% off`,
                    },
                    {
                        key: "redemption_count", label: "Used", sortable: true, width: 90, align: "center",
                        render: (v, row) => `${v || row.times_used || 0} / ${row.max_redemptions || row.max_uses || "∞"}`,
                    },
                    { key: "valid_from",  label: "From",  sortable: true, width: 110, render: (v) => v?.slice(0, 10) || "—" },
                    { key: "valid_until", label: "Until", sortable: true, width: 110, render: (v) => v?.slice(0, 10) || "—" },
                ]}
                data={promos}
                searchable
                searchKeys={["code"]}
                searchPlaceholder="Search promo codes…"
                emptyIcon="🎁"
                emptyMessage="No promo codes yet."
                pageSize={15}
                extraActions={[{ label: "✕ Delete", className: "dt-action-btn--danger", onClick: (row) => onDeletePromo(row.id) }]}
            />
        </div>
    );
}
