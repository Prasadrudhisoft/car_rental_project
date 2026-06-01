// ─────────────────────────────────────────────────────────────────────────────
// tabs/OverviewTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { SectionCard, StarDisplay } from "../AdminShared";

export default function OverviewTab({ analytics }) {
    if (!analytics) return null;
    return (
        <div className="admin-section">
            <div className="admin-kpi-grid">
                {[
                    ["💰", "Total Revenue",       `₹${parseFloat(analytics.total_revenue    || 0).toLocaleString("en-IN")}`, "#0DB89E"],
                    ["🏦", "Platform Commission", `₹${parseFloat(analytics.platform_revenue || 0).toLocaleString("en-IN")}`, "#8B5CF6"],
                    ["📋", "Total Bookings",       analytics.total_bookings,                                                   "#3B82F6"],
                ].map(([icon, label, value, color]) => (
                    <div key={label} className="admin-kpi-card">
                        <div className="admin-kpi-card__icon" style={{ background: `${color}15`, color }}>{icon}</div>
                        <div><p>{label}</p><h2 style={{ color }}>{value ?? "—"}</h2></div>
                    </div>
                ))}
            </div>

            <div className="admin-two-col">
                {analytics.city_demand?.length > 0 && (
                    <SectionCard title="City-wise Demand" subtitle="Top performing cities">
                        <div className="admin-data-table">
                            <div className="admin-data-table__header"><span>City</span><span>Bookings</span><span>Revenue</span></div>
                            {analytics.city_demand.map((c, i) => (
                                <div key={c.city} className="admin-data-table__row">
                                    <span><span className="admin-rank">#{i + 1}</span> {c.city}</span>
                                    <span><span className="admin-badge admin-badge--blue">{c.count}</span></span>
                                    <span className="admin-currency">₹{parseFloat(c.revenue || 0).toLocaleString("en-IN")}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}
                {analytics.vendor_league?.length > 0 && (
                    <SectionCard title="Top Vendors" subtitle="By total revenue">
                        <div className="admin-data-table">
                            <div className="admin-data-table__header"><span>Vendor</span><span>Bookings</span><span>Revenue</span></div>
                            {analytics.vendor_league.map((v, i) => (
                                <div key={v.vendor_id} className="admin-data-table__row">
                                    <span><span className="admin-rank">#{i + 1}</span> {v.name}</span>
                                    <span><span className="admin-badge admin-badge--blue">{v.count}</span></span>
                                    <span className="admin-currency">₹{parseFloat(v.revenue || 0).toLocaleString("en-IN")}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}
            </div>

            {analytics.monthly_trend?.length > 0 && (
                <SectionCard title="Monthly Booking Trend">
                    <div className="admin-trend-chart">
                        {analytics.monthly_trend.map((m) => {
                            const maxC = Math.max(...analytics.monthly_trend.map((x) => x.count));
                            const pct  = maxC > 0 ? (m.count / maxC) * 100 : 0;
                            return (
                                <div key={m.month} className="admin-trend-bar-wrap">
                                    <div className="admin-trend-bar-track">
                                        <div className="admin-trend-bar" style={{ height: `${pct}%` }} />
                                    </div>
                                    <span>{m.month?.slice(5)}</span>
                                    <span className="admin-trend-count">{m.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}
