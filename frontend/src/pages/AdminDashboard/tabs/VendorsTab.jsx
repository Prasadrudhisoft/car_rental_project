// ─────────────────────────────────────────────────────────────────────────────
// tabs/VendorsTab.jsx  — Desktop: DataTable.  Mobile: tappable cards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import DataTable from "../../../components/common/DataTable";
import { StatusBadge } from "../AdminShared";
import { VENDOR_STATUS_CLR, fmtDate, getKYCStatus } from "../adminConstants";

const STATUS_OPTIONS = [
    { value:"",          label:"All Statuses" },
    { value:"pending",   label:"Pending"      },
    { value:"approved",  label:"Approved"     },
    { value:"more_info", label:"More Info"    },
    { value:"rejected",  label:"Rejected"     },
    { value:"suspended", label:"Suspended"    },
];

function MobileVendorCard({ vendor: v, onSelect }) {
    const kyc = getKYCStatus(v);
    const sc  = VENDOR_STATUS_CLR[v.status] || { bg:"#F3F4F6", color:"#6B7280" };
    return (
        <button className="adm-mob-card" onClick={() => onSelect(v)} aria-label={`View ${v.business_name}`}>
            <div className="adm-mob-card__head">
                <span className="adm-mob-card__primary" style={{fontWeight:700}}>{v.business_name}</span>
                <span className="admin-status-badge admin-status-badge--sm"
                    style={{color:sc.color,background:sc.bg,border:`1px solid ${sc.color}30`}}>
                    {v.status?.replace(/_/g," ")}
                </span>
            </div>
            <div className="adm-mob-card__row">
                <span className="adm-mob-card__secondary">{v.email}</span>
            </div>
            <div className="adm-mob-card__footer">
                <span className="adm-mob-card__meta">
                    {v.city_name || "—"}
                    {" · KYC "}
                    <span style={{color: kyc.complete ? "#059669" : "#D97706", fontWeight:700}}>
                        {kyc.done}/{kyc.total}{kyc.complete ? " ✓" : " ⚠"}
                    </span>
                    {v.rating > 0 ? ` · ⭐ ${v.rating}` : ""}
                </span>
                <span className="adm-mob-card__chevron">›</span>
            </div>
        </button>
    );
}

function MobileVendorList({ vendors, onSelect }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const filtered = useMemo(() => {
        let r = vendors;
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(v =>
                (v.business_name||"").toLowerCase().includes(q) ||
                (v.email        ||"").toLowerCase().includes(q) ||
                (v.city_name    ||"").toLowerCase().includes(q)
            );
        }
        if (status) r = r.filter(v => v.status === status);
        return r;
    }, [vendors, search, status]);

    return (
        <div className="adm-mob-list">
            <div className="adm-mob-search-wrap">
                <svg className="adm-mob-search-icon" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input className="adm-mob-search" type="search" placeholder="Search vendors…"
                    value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="adm-mob-pills">
                {STATUS_OPTIONS.map(o => (
                    <button key={o.value}
                        className={`adm-mob-pill${status===o.value?" adm-mob-pill--active":""}`}
                        onClick={() => setStatus(o.value)}>{o.label}</button>
                ))}
            </div>
            {(search||status) && <p className="adm-mob-count">{filtered.length} of {vendors.length} vendors</p>}
            {filtered.length === 0
                ? <div className="admin-empty" style={{padding:"40px 24px"}}><span>🏪</span><p>No vendors match.</p></div>
                : <div className="adm-mob-cards">{filtered.map((v,i)=><MobileVendorCard key={v.id??i} vendor={v} onSelect={onSelect}/>)}</div>
            }
        </div>
    );
}

const columns = [
    { key:"business_name", label:"Business", sortable:true, width:220,
      render:(v,row)=>(<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{v}</span><span className="dt-cell-stack__secondary">{row.email}</span></div>) },
    { key:"city_name", label:"City",   sortable:true, width:110, render:(v)=>v||"—" },
    { key:"status",    label:"Status", sortable:true, width:120, render:(v)=><StatusBadge status={v} colorMap={VENDOR_STATUS_CLR}/> },
    { key:"kyc", label:"KYC", sortable:false, width:90,
      render:(_,row)=>{ const k=getKYCStatus(row); return <span style={{fontSize:11,fontWeight:700,color:k.complete?"#059669":"#D97706"}}>{k.done}/{k.total} {k.complete?"✓":"⚠"}</span>; } },
    { key:"rating",     label:"Rating", sortable:true, width:80,  render:(v)=>v>0?`⭐ ${v}`:"—" },
    { key:"created_at", label:"Joined", sortable:true, width:110, render:(v)=>fmtDate(v) },
];

export default function VendorsTab({ vendors, onSelectVendor }) {
    return (
        <div className="admin-section">
            <div className="adm-desktop">
                <DataTable columns={columns} data={vendors} searchable
                    searchKeys={["business_name","email","phone","city_name"]}
                    searchPlaceholder="Search vendors by name, email, phone, city…"
                    filters={[{key:"status",label:"Status",colorMap:VENDOR_STATUS_CLR,options:STATUS_OPTIONS}]}
                    onRowAction={onSelectVendor} actionLabel="View Details"
                    emptyIcon="🏪" emptyMessage="No vendors found." pageSize={25}/>
            </div>
            <div className="adm-mobile">
                <MobileVendorList vendors={vendors} onSelect={onSelectVendor}/>
            </div>
        </div>
    );
}