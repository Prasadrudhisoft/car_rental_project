// ─────────────────────────────────────────────────────────────────────────────
// tabs/OverviewTab.jsx
// Booking status chips, revenue box, recent bookings strip.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { SectionCard } from '../VendorShared';
import { STATUS_CLR } from '../vendorConstants';

export default function OverviewTab({
    analytics,
    bookings,
    profile,
    kycComplete,
    onGoToKYC,
    onOpenBooking,
    onGoToBookings,
}) {
    const totalRevenue = parseFloat(analytics?.total_revenue || 0);

    return (
        <div className="vd-grid-2">
            {/* KYC warning banner */}
            {profile && !kycComplete && (
                <div style={{ gridColumn: '1 / -1' }} className="vd-kyc-overview-warn">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 20 }}>🔒</span>
                        <div>
                            <strong>Complete your KYC to unlock all features</strong>
                            <p style={{ fontSize: 12, margin: '2px 0 0 0', color: '#92400E' }}>
                                Fleet management, bookings, and network features are locked until KYC is verified.
                            </p>
                        </div>
                        <button
                            className="vd-btn vd-btn--primary vd-btn--sm"
                            style={{ marginLeft: 'auto', flexShrink: 0 }}
                            onClick={onGoToKYC}
                        >
                            Complete KYC →
                        </button>
                    </div>
                </div>
            )}

            {/* Booking status chips */}
            <SectionCard title="Booking Status">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {Object.entries(analytics?.status_counts || {}).map(([s, c]) => (
                        <div key={s} className="vd-stat-chip" style={{ '--bc': STATUS_CLR[s]?.color || '#9CA3AF' }}>
                            <span className="vd-stat-chip__n">{c}</span>
                            <span className="vd-stat-chip__l">{s}</span>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Revenue box */}
            <SectionCard title="Revenue">
                <div className="vd-rev-box">
                    <span className="vd-rev-box__amt">₹{totalRevenue.toLocaleString('en-IN')}</span>
                    <span className="vd-rev-box__sub">Total Revenue</span>
                </div>
            </SectionCard>

            {/* Recent bookings strip */}
            <SectionCard
                title="Recent Bookings"
                action={
                    <button className="vd-btn vd-btn--outline vd-btn--sm" onClick={onGoToBookings}>
                        View All →
                    </button>
                }
            >
                {bookings.slice(0, 4).map(b => {
                    const s = STATUS_CLR[b.status] || { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
                    return (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--vbdr)' }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--vacc)', flex: 1 }}>
                                {b.booking_ref}
                            </span>
                            <span className="vd-badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{b.status}</span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>₹{parseFloat(b.total_amount || 0).toLocaleString('en-IN')}</span>
                            <button className="vd-btn vd-btn--ghost vd-btn--sm" onClick={() => onOpenBooking(b)}>View →</button>
                        </div>
                    );
                })}
                {bookings.length === 0 && <p className="vd-empty-sm">No bookings yet.</p>}
            </SectionCard>
        </div>
    );
}