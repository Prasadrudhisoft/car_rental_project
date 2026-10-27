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
                        { key: "code", label: "Code", required: true, placeholder: "FIRST50" },
                        { key: "description", label: "Description", placeholder: "Shown to customers" },
                        { key: "discount_type", label: "Type", type: "select", required: true, default: "percentage",
                        options: [{ value: "percentage", label: "Percentage (%)" }, { value: "flat", label: "Flat (₹)" }] },
                        { key: "discount_value", label: "Discount", type: "number", required: true, step: "0.01" },
                        { key: "max_discount_cap", label: "Max discount ₹ (% type)", type: "number", step: "0.01" },
                        { key: "min_booking_value", label: "Min subtotal ₹ (pre-tax)", type: "number", step: "0.01", default: "0" },
                        { key: "is_single_use", label: "One use per customer", type: "select", default: "false",
                        options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
                        { key: "max_redemptions", label: "Total uses (blank = unlimited)", type: "number" },
                        { key: "valid_from", label: "Valid From", type: "datetime-local", required: true },
                        { key: "valid_until", label: "Valid Until", type: "datetime-local", required: true },
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
                    { key: "redemption_count", label: "Used", sortable: true, width: 90, align: "center",
                    render: (v, row) => `${v ?? 0} / ${row.max_redemptions ?? "∞"}` },
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
                extraActions={[{ label: "✕ Delete", className: "dt-action-btn--danger", onClick: (row) => onDeletePromo(row.id, row.code) }]}
            />
        </div>
    );
}
