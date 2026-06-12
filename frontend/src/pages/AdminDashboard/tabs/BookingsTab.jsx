// ─────────────────────────────────────────────────────────────────────────────
// tabs/BookingsTab.jsx
// Desktop: full DataTable. Mobile (≤768px): tappable cards — no horizontal scroll.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import DataTable from "../../../components/common/DataTable";
import { StatusBadge } from "../AdminShared";
import { BOOKING_STATUS_CLR, fmtDate } from "../adminConstants";

const STATUS_OPTIONS = [
    { value: "",          label: "All"       },
    { value: "PENDING",   label: "Pending"   },
    { value: "CONFIRMED", label: "Confirmed" },
    { value: "ACTIVE",    label: "Active"    },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
];

function MobileBookingCard({ booking: b, onSelect }) {
    const amount = parseFloat(b.total_amount || 0).toLocaleString("en-IN");
    return (
        <button className="adm-mob-card" onClick={() => onSelect(b)} aria-label={`View booking ${b.booking_ref}`}>
            <div className="adm-mob-card__head">
                <span className="adm-mob-card__ref">{b.booking_ref}</span>
                <StatusBadge status={b.status} colorMap={BOOKING_STATUS_CLR} />
            </div>
            <div className="adm-mob-card__row">
                <span className="adm-mob-card__primary">{b.customer_name || "—"}</span>
                <span className="adm-mob-card__amount">₹{amount}</span>
            </div>
            {b.vehicle_display && (
                <div className="adm-mob-card__row">
                    <span className="adm-mob-card__secondary">{b.vehicle_display}</span>
                </div>
            )}
            <div className="adm-mob-card__footer">
                <span className="adm-mob-card__meta">
                    {b.pickup_date || "—"}
                    {b.rental_days ? ` · ${b.rental_days}d` : ""}
                    {b.payment_captured ? " · ✓ Paid" : ""}
                </span>
                <span className="adm-mob-card__chevron">›</span>
            </div>
        </button>
    );
}

function MobileBookingList({ bookings, onSelect }) {
    const [search,  setSearch]  = useState("");
    const [status,  setStatus]  = useState("");

    const filtered = useMemo(() => {
        let r = bookings;
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(b =>
                (b.booking_ref    || "").toLowerCase().includes(q) ||
                (b.customer_name  || "").toLowerCase().includes(q) ||
                (b.vehicle_display|| "").toLowerCase().includes(q)
            );
        }
        if (status) r = r.filter(b => b.status === status);
        return r;
    }, [bookings, search, status]);

    return (
        <div className="adm-mob-list">
            <div className="adm-mob-search-wrap">
                <svg className="adm-mob-search-icon" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input className="adm-mob-search" type="search" placeholder="Search bookings…"
                    value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="adm-mob-pills">
                {STATUS_OPTIONS.map(o => (
                    <button key={o.value}
                        className={`adm-mob-pill${status === o.value ? " adm-mob-pill--active" : ""}`}
                        onClick={() => setStatus(o.value)}>{o.label}</button>
                ))}
            </div>
            {(search || status) && (
                <p className="adm-mob-count">{filtered.length} of {bookings.length} bookings</p>
            )}
            {filtered.length === 0
                ? <div className="admin-empty" style={{padding:"40px 24px"}}><span>📋</span><p>No bookings match.</p></div>
                : <div className="adm-mob-cards">{filtered.map((b,i) => <MobileBookingCard key={b.id??i} booking={b} onSelect={onSelect}/>)}</div>
            }
        </div>
    );
}

const columns = [
    { key: "booking_ref",  label: "Ref",      sortable: true, width: 140, render: (v) => <span className="dt-mono">{v}</span> },
    { key: "customer_name", label: "Customer", sortable: true, width: 180,
      render: (v, row) => (<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{v||"—"}</span><span className="dt-cell-stack__secondary">{row.customer_email}</span></div>) },
    { key: "vehicle_display", label: "Vehicle", sortable: true, width: 180,
      render: (v, row) => (<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{v||"—"}</span><span className="dt-cell-stack__secondary dt-mono">{row.vehicle?.plate_number||"—"}</span></div>) },
    { key: "status",       label: "Status",  sortable: true, width: 110, render: (v) => <StatusBadge status={v} colorMap={BOOKING_STATUS_CLR}/> },
    { key: "pickup_date",  label: "Pickup",  sortable: true, width: 100, render: (v) => v||"—" },
    { key: "rental_days",  label: "Days",    sortable: true, width: 60,  align: "center", render: (v) => v??"—" },
    { key: "total_amount", label: "Total",   sortable: true, width: 110, align: "right",  render: (v) => <span className="dt-currency">₹{parseFloat(v||0).toLocaleString("en-IN")}</span> },
    { key: "payment_captured", label: "Paid", sortable: true, width: 60, align: "center",
      render: (v) => v ? <span style={{color:"#059669",fontWeight:700,fontSize:13}}>✓</span> : <span style={{color:"#EF4444",fontSize:13}}>✕</span> },
    { key: "created_at",   label: "Created", sortable: true, width: 110, render: (v) => fmtDate(v) },
];

export default function BookingsTab({ bookings, onSelectBooking }) {
    return (
        <div className="admin-section">
            <div className="adm-desktop">
                <DataTable columns={columns} data={bookings} searchable
                    searchKeys={["booking_ref","customer_name","customer_email","vehicle_display"]}
                    searchPlaceholder="Search by ref, customer, vehicle…"
                    filters={[
                        { key:"status", label:"Status", colorMap:BOOKING_STATUS_CLR, options:STATUS_OPTIONS },
                        { key:"payment_captured", label:"Payment", options:[{value:"",label:"All"},{value:"true",label:"Paid"},{value:"false",label:"Unpaid"}] },
                    ]}
                    onRowAction={onSelectBooking} actionLabel="View Booking"
                    emptyIcon="📋" emptyMessage="No bookings found." pageSize={25}/>
            </div>
            <div className="adm-mobile">
                <MobileBookingList bookings={bookings} onSelect={onSelectBooking}/>
            </div>
        </div>
    );
}