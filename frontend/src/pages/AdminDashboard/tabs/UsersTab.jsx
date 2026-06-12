// ─────────────────────────────────────────────────────────────────────────────
// tabs/UsersTab.jsx  — Desktop: DataTable.  Mobile: tappable cards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import DataTable from "../../../components/common/DataTable";
import { KYC_STATUS_CLR, fmtDate } from "../adminConstants";

const KYC_OPTIONS = [
    { value:"",         label:"All"      },
    { value:"pending",  label:"Pending"  },
    { value:"verified", label:"Verified" },
    { value:"rejected", label:"Rejected" },
];

function MobileUserCard({ user: u, onSelect }) {
    const kyc = KYC_STATUS_CLR[u.kyc_status] || KYC_STATUS_CLR.pending;
    return (
        <button className="adm-mob-card" onClick={()=>onSelect(u)} aria-label={`View ${u.full_name||u.email}`}>
            <div className="adm-mob-card__head">
                <span className="adm-mob-card__primary" style={{fontWeight:700}}>{u.full_name||"—"}</span>
                <span className="admin-status-badge admin-status-badge--sm"
                    style={{color:kyc.color,background:kyc.bg,border:`1px solid ${kyc.color}30`}}>
                    KYC {u.kyc_status||"pending"}
                </span>
            </div>
            <div className="adm-mob-card__row">
                <span className="adm-mob-card__secondary">{u.email}</span>
            </div>
            <div className="adm-mob-card__footer">
                <span className="adm-mob-card__meta">
                    {u.phone||""}
                    {u.total_bookings!=null ? ` · ${u.total_bookings} bookings` : ""}
                    {u.loyalty_points!=null ? ` · ${u.loyalty_points.toLocaleString("en-IN")} pts` : ""}
                    {" · "}
                    <span style={{color:u.is_email_verified?"#059669":"#EF4444"}}>E{u.is_email_verified?"✓":"✕"}</span>
                    {" "}
                    <span style={{color:u.is_phone_verified?"#059669":"#EF4444"}}>P{u.is_phone_verified?"✓":"✕"}</span>
                </span>
                <span className="adm-mob-card__chevron">›</span>
            </div>
        </button>
    );
}

function MobileUserList({ users, onSelect }) {
    const [search, setSearch] = useState("");
    const [kyc,    setKyc]    = useState("");

    const filtered = useMemo(() => {
        let r = users.filter(u=>u.role==="customer");
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(u=>
                (u.full_name||"").toLowerCase().includes(q)||
                (u.email    ||"").toLowerCase().includes(q)||
                (u.phone    ||"").toLowerCase().includes(q)
            );
        }
        if (kyc) r = r.filter(u=>(u.kyc_status||"pending")===kyc);
        return r;
    }, [users, search, kyc]);

    return (
        <div className="adm-mob-list">
            <div className="adm-mob-search-wrap">
                <svg className="adm-mob-search-icon" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input className="adm-mob-search" type="search" placeholder="Search customers…"
                    value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="adm-mob-pills">
                {KYC_OPTIONS.map(o=>(
                    <button key={o.value}
                        className={`adm-mob-pill${kyc===o.value?" adm-mob-pill--active":""}`}
                        onClick={()=>setKyc(o.value)}>{o.label}</button>
                ))}
            </div>
            {(search||kyc) && <p className="adm-mob-count">{filtered.length} customers</p>}
            {filtered.length===0
                ? <div className="admin-empty" style={{padding:"40px 24px"}}><span>👤</span><p>No customers match.</p></div>
                : <div className="adm-mob-cards">{filtered.map((u,i)=><MobileUserCard key={u.id??i} user={u} onSelect={onSelect}/>)}</div>
            }
        </div>
    );
}

const columns = [
    { key:"full_name", label:"Name", sortable:true, width:180,
      render:(v,row)=>(<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{v||"—"}</span><span className="dt-cell-stack__secondary">{row.email}</span></div>) },
    { key:"phone", label:"Phone", sortable:false, width:130, render:(v)=>v||"—" },
    { key:"kyc_status", label:"KYC", sortable:true, width:100,
      render:(v)=>{ const s=KYC_STATUS_CLR[v]||KYC_STATUS_CLR.pending; return <span className="dt-badge" style={{background:s.bg,color:s.color,borderColor:s.color+"40"}}>{v||"pending"}</span>; } },
    { key:"is_email_verified", label:"Email ✓", sortable:true, width:80, align:"center", render:(v)=>v?<span style={{color:"#059669",fontWeight:700}}>✓</span>:<span style={{color:"#EF4444"}}>✕</span> },
    { key:"is_phone_verified", label:"Phone ✓", sortable:true, width:80, align:"center", render:(v)=>v?<span style={{color:"#059669",fontWeight:700}}>✓</span>:<span style={{color:"#EF4444"}}>✕</span> },
    { key:"total_bookings", label:"Bookings", sortable:true, width:80, align:"center", render:(v)=>v??"—" },
    { key:"loyalty_points", label:"Points",   sortable:true, width:80, align:"right",  render:(v)=>v!=null?v.toLocaleString("en-IN"):"—" },
    { key:"date_joined",    label:"Joined",   sortable:true, width:100, render:(v)=>fmtDate(v) },
];

export default function UsersTab({ users, onSelectUser }) {
    return (
        <div className="admin-section">
            <div className="adm-desktop">
                <DataTable columns={columns} data={users.filter(u=>u.role==="customer")} searchable
                    searchKeys={["full_name","email","phone"]}
                    searchPlaceholder="Search by name, email or phone…"
                    filters={[{key:"kyc_status",label:"KYC Status",colorMap:KYC_STATUS_CLR,options:KYC_OPTIONS}]}
                    onRowAction={onSelectUser} actionLabel="View User"
                    emptyIcon="👤" emptyMessage="No customers found." pageSize={25}/>
            </div>
            <div className="adm-mobile">
                <MobileUserList users={users} onSelect={onSelectUser}/>
            </div>
        </div>
    );
}