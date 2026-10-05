// ─────────────────────────────────────────────────────────────────────────────
// BookingDetailModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { StatusBadge } from "../AdminShared";
import { BOOKING_STATUS_CLR, ADDON_LABELS, fmtDatetime } from "../adminConstants";

export default function BookingDetailModal({ booking: b, onClose }) {
    const ps = b.pricing_snapshot || {};
    const pymtSt = !b.payment_captured
        ? { label: "Unpaid",       color: "#EF4444", bg: "#FEE2E2" }
        : ps.full_payment_paid
            ? { label: "Fully Paid",   color: "#059669", bg: "#D1FAE5" }
            : ps.advance_paid
                ? { label: "Advance Paid", color: "#D97706", bg: "#FEF3C7" }
                : { label: "Paid",         color: "#059669", bg: "#D1FAE5" };

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal bk-modal" onClick={(e) => e.stopPropagation()}>

                {/* Head */}
                <div className="admin-modal__head bk-modal__head">
                    <div className="bk-modal__ref-block">
                        <span className="bk-modal__ref">{b.booking_ref}</span>
                        <StatusBadge status={b.status} colorMap={BOOKING_STATUS_CLR} />
                        <span className="bk-modal__pay-badge" style={{ color: pymtSt.color, background: pymtSt.bg }}>
                            {pymtSt.label}
                        </span>
                        {b.is_one_way && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#EDE9FE", color: "#7C3AED" }}>ONE-WAY</span>
                        )}
                        {b.agreement_signed && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#D1FAE5", color: "#059669" }}>✍ Signed</span>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid var(--vbdr)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--vm)", fontFamily: 'inherit', flexShrink: 0 }}>
                        ✕ Close
                    </button>
                </div>

                <div className="bk-modal__body">
                    {/* Left col */}
                    <div className="bk-modal__col">
                        {/* Customer */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">👤 Customer</div>
                            <div className="bk-modal__rows">
                                {[["Name", b.customer_name || "—"], ["Email", b.customer_email || "—"], ["Phone", b.customer_phone || "—"]].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row"><span>{l}</span><strong>{val}</strong></div>
                                ))}
                            </div>
                        </div>
                        {/* Vehicle */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🚗 Vehicle</div>
                            <div className="bk-modal__rows">
                                {[
                                    ["Vehicle", b.vehicle_display || "—"],
                                    ["Vendor",  b.vendor_name    || "—"],
                                    ["Segment", b.vehicle?.segment      || "—"],
                                    ["Plate",   b.vehicle?.plate_number || "—"],
                                ].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row"><span>{l}</span><strong style={{ textTransform: "capitalize" }}>{val}</strong></div>
                                ))}
                            </div>
                        </div>
                        {/* Trip */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">📍 Trip Details</div>
                            <div className="bk-modal__rows">
                                {[
                                    ["Pickup",   `${b.pickup_date}${b.pickup_time ? ` at ${b.pickup_time}` : ""}`],
                                    ["Return",   `${b.return_date}${b.return_time ? ` at ${b.return_time}` : ""}`],
                                    ["Duration", `${b.rental_days} day${b.rental_days !== 1 ? "s" : ""}`],
                                    ["Location", b.pickup_location_detail?.name || "—"],
                                ].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row"><span>{l}</span><strong>{val}</strong></div>
                                ))}
                            </div>
                        </div>
                        {b.status === "CANCELLED" && b.cancellation_reason && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">❌ Cancellation</div>
                                <div style={{ fontSize: 12, color: "#7F1D1D", background: "#FEE2E2", borderRadius: 8, padding: "8px 12px" }}>
                                    {b.cancellation_reason}
                                </div>
                            </div>
                        )}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🕐 Timeline</div>
                            <div className="bk-modal__rows">
                                {[["Created", fmtDatetime(b.created_at)], ["Updated", fmtDatetime(b.updated_at)]].map(([l, val]) => (
                                    <div key={l} className="bk-modal__row"><span>{l}</span><strong>{val}</strong></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right col */}
                    <div className="bk-modal__col">
                        {/* Pricing */}
                        <div className="bk-modal__section bk-modal__section--pricing">
                            <div className="bk-modal__section-hd">💰 Pricing Breakdown</div>
                            <div className="bk-price-table">
                                {ps.daily_rate  && <div className="bk-price-row"><span>Daily Rate</span><span>₹{parseFloat(ps.daily_rate).toLocaleString("en-IN")}</span></div>}
                                {ps.base_amount && <div className="bk-price-row"><span>Base Amount</span><span>₹{parseFloat(ps.base_amount).toLocaleString("en-IN")}</span></div>}
                                {parseFloat(ps.addon_total || 0) > 0 && <div className="bk-price-row"><span>Add-ons</span><span>₹{parseFloat(ps.addon_total).toLocaleString("en-IN")}</span></div>}
                                {ps.cgst_amount && <div className="bk-price-row bk-price-row--tax"><span>CGST</span><span>₹{parseFloat(ps.cgst_amount).toLocaleString("en-IN")}</span></div>}
                                {ps.sgst_amount && <div className="bk-price-row bk-price-row--tax"><span>SGST</span><span>₹{parseFloat(ps.sgst_amount).toLocaleString("en-IN")}</span></div>}
                                <div className="bk-price-row bk-price-row--total"><span>Grand Total</span><span>₹{parseFloat(b.total_amount || 0).toLocaleString("en-IN")}</span></div>
                                <div className="bk-price-row"><span>Security Deposit</span><span>₹{parseFloat(b.deposit_amount || ps.security_deposit || 0).toLocaleString("en-IN")}</span></div>
                            </div>
                        </div>
                        {/* Payment flags */}
                        <div className="bk-modal__section">
                            <div className="bk-modal__section-hd">🏦 Deposit & Payment</div>
                            <div className="bk-modal__rows">
                                {[
                                    ["Payment Captured", b.payment_captured ? "✓ Yes"      : "✕ No",       b.payment_captured ? "#059669" : "#EF4444"],
                                    ["Deposit Held",     b.deposit_held     ? "🔒 Held"    : "—",          b.deposit_held     ? "#D97706" : "#9CA3AF"],
                                    ["Deposit Released", b.deposit_released ? "✓ Released" : "—",          b.deposit_released ? "#059669" : "#9CA3AF"],
                                    ["Agreement Signed", b.agreement_signed ? "✓ Signed"   : "—",          b.agreement_signed ? "#059669" : "#9CA3AF"],
                                ].map(([l, val, color]) => (
                                    <div key={l} className="bk-modal__row"><span>{l}</span><strong style={{ color }}>{val}</strong></div>
                                ))}
                            </div>
                        </div>
                        {/* Add-ons */}
                        {(b.addons || []).length > 0 && (
                            <div className="bk-modal__section">
                                <div className="bk-modal__section-hd">➕ Add-ons</div>
                                <div className="bk-addons">
                                    {b.addons.map((a, i) => (
                                        <div key={i} className="bk-addon-row">
                                            <span>{ADDON_LABELS[a.addon_type] || a.addon_type}</span>
                                            <span>₹{parseFloat(a.price).toLocaleString("en-IN")}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
