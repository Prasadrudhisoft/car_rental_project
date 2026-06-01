// ─────────────────────────────────────────────────────────────────────────────
// tabs/ReviewsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import DataTable from "../../../components/common/DataTable";
import { StarDisplay } from "../AdminShared";
import ReviewDetailModal from "../modals/ReviewDetailModal";
import { fetchVendorReviews } from "../../../services/api";
import { fmtDate } from "../adminConstants";

export default function ReviewsTab({ reviewVendors, initialVendorId = "" }) {
    const [selectedVendorId, setSelectedVendorId] = useState(initialVendorId);
    const [ordering,         setOrdering]         = useState("recency");
    const [reviews,          setReviews]          = useState([]);
    const [reviewsLoading,   setReviewsLoading]   = useState(false);
    const [selectedReview,   setSelectedReview]   = useState(null);

    const loadReviews = async (vendorId, ord) => {
        if (!vendorId) return;
        setReviewsLoading(true);
        try {
            const { data } = await fetchVendorReviews(vendorId, ord);
            setReviews(data.results ?? data);
        } catch { setReviews([]); }
        finally { setReviewsLoading(false); }
    };

    const handleVendorChange = async (e) => {
        const id = e.target.value;
        setSelectedVendorId(id);
        await loadReviews(id, ordering);
    };

    const handleOrderingChange = async (ord) => {
        setOrdering(ord);
        await loadReviews(selectedVendorId, ord);
    };

    const columns = [
        {
            key: "customer_name", label: "Customer", sortable: true, width: 160,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || "—"}</span>
                    <span className="dt-cell-stack__secondary">{row.vehicle_display || "—"}</span>
                </div>
            ),
        },
        { key: "vendor_rating",  label: "Vendor ★",  sortable: true, width: 120, render: (v) => <StarDisplay value={v || 0} size={14} /> },
        { key: "vehicle_rating", label: "Vehicle ★", sortable: true, width: 120, render: (v) => <StarDisplay value={v || 0} size={14} /> },
        {
            key: "review_text", label: "Review", sortable: false,
            render: (v) => v
                ? <span style={{ fontSize: 12, color: "var(--vt2)", fontStyle: "italic", display: "block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{v}"</span>
                : <span style={{ color: "var(--vm)", fontSize: 11 }}>No text</span>,
        },
        { key: "created_at", label: "Date", sortable: true, width: 110, render: (v) => fmtDate(v) },
    ];

    return (
        <div className="admin-section">
            {selectedReview && (
                <ReviewDetailModal review={selectedReview} onClose={() => setSelectedReview(null)} />
            )}

            {/* Filter bar */}
            <div className="cd-filter-bar cd-filter-bar--dropdown" style={{ gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--vm)" }}>Vendor</label>
                    <select
                        className="admin-search-input"
                        style={{ width: 260, height: 36, cursor: "pointer" }}
                        value={selectedVendorId}
                        onChange={handleVendorChange}
                    >
                        <option value="">— Select a vendor —</option>
                        {reviewVendors.map((v) => (
                            <option key={v.id} value={v.user ?? v.user_id}>
                                {v.business_name}{v.rating > 0 ? ` (★ ${v.rating})` : ""}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--vm)" }}>Sort</label>
                    <div style={{ display: "flex", gap: 6 }}>
                        {[["recency", "🕐 Newest"], ["rating", "★ Rating"]].map(([val, lbl]) => (
                            <button
                                key={val}
                                className={`admin-btn admin-btn--sm ${ordering === val ? "admin-btn--primary" : "admin-btn--ghost"}`}
                                onClick={() => handleOrderingChange(val)}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {!selectedVendorId ? (
                <div className="admin-empty"><span>⭐</span><p>Select a vendor above to view their customer reviews.</p></div>
            ) : reviewsLoading ? (
                <div className="admin-loading"><div className="admin-loading__spinner" />Loading reviews…</div>
            ) : (
                <DataTable
                    columns={columns}
                    data={reviews}
                    searchable
                    searchKeys={["customer_name", "vehicle_display", "review_text"]}
                    searchPlaceholder="Search reviews…"
                    filters={[{
                        key: "vendor_rating", label: "Rating",
                        options: [{ value: "", label: "All Ratings" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ★` }))],
                    }]}
                    onRowAction={(row) => setSelectedReview(row)}
                    actionLabel="View Review"
                    emptyIcon="💬"
                    emptyMessage="No reviews for this vendor."
                    pageSize={20}
                />
            )}
        </div>
    );
}
