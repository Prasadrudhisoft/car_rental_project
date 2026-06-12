// ─────────────────────────────────────────────────────────────────────────────
// tabs/VehiclesTab.jsx  — Desktop: DataTable.  Mobile: tappable cards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import DataTable from "../../../components/common/DataTable";
import { StatusBadge } from "../AdminShared";
import { VEHICLE_STATUS_CLR } from "../adminConstants";

const VEH_STATUS_OPTIONS = [
    { value:"",               label:"All"           },
    { value:"PENDING_DOCS",   label:"Pending Docs"  },
    { value:"DOCS_SUBMITTED", label:"Docs Submitted"},
    { value:"ADMIN_APPROVED", label:"Admin Approved"},
    { value:"LIVE",           label:"Live"          },
    { value:"INACTIVE",       label:"Inactive"      },
];

function MobileVehicleCard({ vehicle: v, onSelect }) {
    const vc = VEHICLE_STATUS_CLR[v.status] || { bg:"#F3F4F6", color:"#6B7280" };
    const docApproved = (v.documents||[]).filter(d=>d.status==="approved").length;
    const docTotal    = (v.documents||[]).length;
    const photoCount  = (v.photos||[]).length;
    const vendor = v.vendor?.vendor_profile?.business_name || v.vendor?.email || "—";

    return (
        <button className="adm-mob-card" onClick={()=>onSelect(v)} aria-label={`Review ${v.year} ${v.make} ${v.model}`}>
            <div className="adm-mob-card__head">
                <span className="adm-mob-card__primary" style={{fontWeight:700}}>{v.year} {v.make} {v.model}</span>
                <span className="admin-status-badge admin-status-badge--sm"
                    style={{color:vc.color,background:vc.bg,border:`1px solid ${vc.color}30`}}>
                    {v.status?.replace(/_/g," ")}
                </span>
            </div>
            <div className="adm-mob-card__row">
                <span className="adm-mob-card__ref" style={{fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{v.plate_number}</span>
                <span className="adm-mob-card__meta" style={{marginLeft:"auto"}}>₹{parseInt(v.daily_rate||0).toLocaleString("en-IN")}/day</span>
            </div>
            <div className="adm-mob-card__footer">
                <span className="adm-mob-card__meta">
                    {vendor}{v.city?.name ? ` · ${v.city.name}` : ""}
                    {" · Docs "}
                    <span style={{color:docApproved>=3?"#059669":"#D97706",fontWeight:600}}>{docApproved}/{docTotal}</span>
                    {" · Photos "}
                    <span style={{color:photoCount>=10?"#059669":"#D97706",fontWeight:600}}>{photoCount}{photoCount>=10?" ✓":" ⚠"}</span>
                    {v.is_certified ? " · ✅ Cert" : ""}
                </span>
                <span className="adm-mob-card__chevron">›</span>
            </div>
        </button>
    );
}

function MobileVehicleList({ vehicles, onSelect }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const filtered = useMemo(() => {
        let r = vehicles;
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(v =>
                (v.make         ||"").toLowerCase().includes(q)||
                (v.model        ||"").toLowerCase().includes(q)||
                (v.plate_number ||"").toLowerCase().includes(q)||
                String(v.year||"").includes(q)
            );
        }
        if (status) r = r.filter(v => v.status === status);
        return r;
    }, [vehicles, search, status]);

    return (
        <div className="adm-mob-list">
            <div className="adm-mob-search-wrap">
                <svg className="adm-mob-search-icon" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input className="adm-mob-search" type="search" placeholder="Search vehicles…"
                    value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="adm-mob-pills">
                {VEH_STATUS_OPTIONS.map(o=>(
                    <button key={o.value}
                        className={`adm-mob-pill${status===o.value?" adm-mob-pill--active":""}`}
                        onClick={()=>setStatus(o.value)}>{o.label}</button>
                ))}
            </div>
            {(search||status) && <p className="adm-mob-count">{filtered.length} of {vehicles.length} vehicles</p>}
            {filtered.length===0
                ? <div className="admin-empty" style={{padding:"40px 24px"}}><span>🚗</span><p>No vehicles match.</p></div>
                : <div className="adm-mob-cards">{filtered.map((v,i)=><MobileVehicleCard key={v.id??i} vehicle={v} onSelect={onSelect}/>)}</div>
            }
        </div>
    );
}

const columns = [
    { key:"make", label:"Vehicle", sortable:true, width:200,
      render:(_,row)=>(<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{row.year} {row.make} {row.model}</span><span className="dt-cell-stack__secondary dt-mono">{row.plate_number}</span></div>) },
    { key:"vendor", label:"Vendor", sortable:false, width:160,
      render:(_,row)=>(<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{row.vendor?.vendor_profile?.business_name||row.vendor?.email||"—"}</span><span className="dt-cell-stack__secondary">{row.city?.name||"—"}</span></div>) },
    { key:"segment", label:"Segment", sortable:true, width:100, render:(v)=><span style={{textTransform:"capitalize"}}>{v||"—"}</span> },
    { key:"status",  label:"Status",  sortable:true, width:130, render:(v)=><StatusBadge status={v} colorMap={VEHICLE_STATUS_CLR}/> },
    { key:"daily_rate", label:"Rate/Day", sortable:true, width:100, align:"right", render:(v)=><span className="dt-currency">₹{parseInt(v||0).toLocaleString("en-IN")}</span> },
    { key:"documents", label:"Docs", sortable:false, width:70, align:"center",
      render:(docs)=>{ const a=(docs||[]).filter(d=>d.status==="approved").length; const t=(docs||[]).length; return <span style={{fontSize:11,fontWeight:700,color:a>=3?"#059669":"#D97706"}}>{a}/{t}</span>; } },
    { key:"photos", label:"Photos", sortable:false, width:70, align:"center",
      render:(photos)=>{ const n=(photos||[]).length; return <span style={{fontSize:11,fontWeight:700,color:n>=10?"#059669":"#D97706"}}>{n}{n>=10?" ✓":" ⚠"}</span>; } },
    { key:"is_certified", label:"Cert", sortable:true, width:55, align:"center",
      render:(v)=>v?<span style={{color:"#059669",fontSize:14}}>✓</span>:<span style={{color:"#D1D5DB"}}>—</span> },
];

export default function VehiclesTab({ vehicles, vehicleStats, vehicleFilter, setVehicleFilter, onSelectVehicle }) {
    return (
        <div className="admin-section">
            {vehicleStats && (
                <div className="admin-stats-row">
                    {Object.entries(vehicleStats).map(([s, count]) => {
                        const vc = VEHICLE_STATUS_CLR[s] || { color:"#9CA3AF" };
                        return (
                            <div key={s} className="admin-mini-stat"
                                style={{borderColor:vc.color+"60",cursor:"pointer",outline:vehicleFilter===s?`2px solid ${vc.color}`:"none"}}
                                onClick={()=>setVehicleFilter(p=>(p===s?"":s))}>
                                <span style={{color:vc.color,fontWeight:800,fontSize:17}}>{count}</span>
                                <span>{s.replace(/_/g," ")}</span>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="adm-desktop">
                <DataTable columns={columns} data={vehicles} searchable
                    searchKeys={["make","model","plate_number","year"]}
                    searchPlaceholder="Search by make, model, plate number…"
                    filters={[
                        {key:"status",label:"Status",colorMap:VEHICLE_STATUS_CLR,options:VEH_STATUS_OPTIONS},
                        {key:"segment",label:"Segment",options:[{value:"",label:"All Segments"},{value:"hatchback",label:"Hatchback"},{value:"sedan",label:"Sedan"},{value:"suv",label:"SUV"},{value:"luxury",label:"Luxury"},{value:"van",label:"Van"}]},
                    ]}
                    onRowAction={onSelectVehicle} actionLabel="Review Vehicle"
                    emptyIcon="🚗" emptyMessage="No vehicles found." pageSize={20}/>
            </div>
            <div className="adm-mobile">
                <MobileVehicleList vehicles={vehicles} onSelect={onSelectVehicle}/>
            </div>
        </div>
    );
}