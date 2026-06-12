// ─────────────────────────────────────────────────────────────────────────────
// tabs/LogisticsTab.jsx
// Handovers DataTable gets a mobile card treatment; stats + forms unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import DataTable from "../../../components/common/DataTable";
import { SectionCard, InlineForm, StatusBadge } from "../AdminShared";
import { HANDOVER_STATUS_CLR } from "../adminConstants";

const H_STATUS_OPTIONS = [
    { value:"",          label:"All"       },
    { value:"EXPECTED",  label:"Expected"  },
    { value:"RECEIVED",  label:"Received"  },
    { value:"HELD",      label:"Held"      },
    { value:"SUBLISTED", label:"Sublisted" },
];

function MobileHandoverCard({ handover: h }) {
    const sc = HANDOVER_STATUS_CLR[h.status] || {bg:"#F3F4F6",color:"#6B7280"};
    return (
        <div className="adm-mob-card adm-mob-card--static">
            <div className="adm-mob-card__head">
                <span className="adm-mob-card__primary" style={{fontWeight:700}}>{h.vehicle_display||"—"}</span>
                <span className="admin-status-badge admin-status-badge--sm"
                    style={{color:sc.color,background:sc.bg,border:`1px solid ${sc.color}30`}}>{h.status}</span>
            </div>
            <div className="adm-mob-card__row">
                <span className="adm-mob-card__ref" style={{fontFamily:"JetBrains Mono,monospace",fontSize:11}}>{h.booking_ref||"—"}</span>
                {h.originating_vendor_name && (
                    <span className="adm-mob-card__secondary">from {h.originating_vendor_name}</span>
                )}
            </div>
            <div className="adm-mob-card__footer">
                <span className="adm-mob-card__meta">
                    {h.return_point_name ? `📍 ${h.return_point_name}` : ""}
                    {h.days_held ? ` · ${h.days_held}d held` : ""}
                </span>
            </div>
        </div>
    );
}

function MobileHandoverList({ handovers }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const filtered = useMemo(() => {
        let r = handovers;
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(h=>
                (h.vehicle_display          ||"").toLowerCase().includes(q)||
                (h.booking_ref              ||"").toLowerCase().includes(q)||
                (h.originating_vendor_name  ||"").toLowerCase().includes(q)
            );
        }
        if (status) r = r.filter(h=>h.status===status);
        return r;
    }, [handovers, search, status]);

    return (
        <div className="adm-mob-list">
            <div className="adm-mob-search-wrap">
                <svg className="adm-mob-search-icon" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input className="adm-mob-search" type="search" placeholder="Search handovers…"
                    value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="adm-mob-pills">
                {H_STATUS_OPTIONS.map(o=>(
                    <button key={o.value}
                        className={`adm-mob-pill${status===o.value?" adm-mob-pill--active":""}`}
                        onClick={()=>setStatus(o.value)}>{o.label}</button>
                ))}
            </div>
            {(search||status) && <p className="adm-mob-count">{filtered.length} of {handovers.length} handovers</p>}
            {filtered.length===0
                ? <div className="admin-empty" style={{padding:"40px 24px"}}><span>🔄</span><p>No handovers match.</p></div>
                : <div className="adm-mob-cards">{filtered.map((h,i)=><MobileHandoverCard key={h.id??i} handover={h}/>)}</div>
            }
        </div>
    );
}

const handoverColumns = [
    { key:"vehicle_display",         label:"Vehicle",      sortable:true, width:180, render:(v)=>v||"—" },
    { key:"booking_ref",             label:"Booking",      sortable:true, width:130, render:(v)=><span className="dt-mono">{v||"—"}</span> },
    { key:"originating_vendor_name", label:"From Vendor",  sortable:true, width:160, render:(v)=>v||"—" },
    { key:"return_point_name",       label:"Return Point", sortable:true, width:140, render:(v)=>v?`📍 ${v}`:"—" },
    { key:"status",                  label:"Status",       sortable:true, width:110, render:(v)=><StatusBadge status={v} colorMap={HANDOVER_STATUS_CLR}/> },
    { key:"days_held",               label:"Days Held",    sortable:true, width:90, align:"center",
      render:(v)=>v?<span style={{color:v>3?"#D97706":"inherit"}}>{v}d</span>:"—" },
];

export default function LogisticsTab({ handovers, logisticsStats, network, cities, returnPoints, formLoading, onAddReturnPoint }) {
    return (
        <div className="admin-section">
            {logisticsStats && (
                <div className="admin-stats-row">
                    {[
                        ["🕐","Expected",    logisticsStats.expected,        "#D97706"],
                        ["📥","Received",    logisticsStats.received,        "#1D4ED8"],
                        ["🔒","Held",        logisticsStats.held,            "#D97706"],
                        ["🟢","Sub-listed",  logisticsStats.sublisted,       "#059669"],
                        ["🤝","Network",     logisticsStats.network_vendors, "#7C3AED"],
                        ["📍","Ret. Points", logisticsStats.return_points,   "#0DB89E"],
                    ].map(([icon,label,val,color])=>(
                        <div key={label} className="admin-mini-stat" style={{borderColor:color+"50"}}>
                            <span>{icon}</span>
                            <span style={{color,fontWeight:800,fontSize:17}}>{val??0}</span>
                            <span style={{fontSize:10}}>{label}</span>
                        </div>
                    ))}
                </div>
            )}

            <SectionCard title="Return Points" subtitle="Designated drop-off points for one-way returns.">
                <InlineForm
                    fields={[
                        {key:"name",       label:"Name",    required:true},
                        {key:"city",       label:"City",    type:"select", required:true, options:cities.map(c=>({value:c.id,label:c.name}))},
                        {key:"point_type", label:"Type",    type:"select", required:true, options:[{value:"partner_vendor",label:"Partner Vendor Lot"},{value:"parking",label:"Paid Parking"}]},
                        {key:"address",    label:"Address"},
                    ]}
                    onSubmit={onAddReturnPoint} submitLabel="+ Add Return Point" loading={formLoading}/>
            </SectionCard>

            {/* Handovers — DataTable on desktop, cards on mobile */}
            <div className="adm-desktop">
                <DataTable columns={handoverColumns} data={handovers} searchable
                    searchKeys={["vehicle_display","booking_ref","originating_vendor_name"]}
                    searchPlaceholder="Search handovers…"
                    filters={[{key:"status",label:"Status",colorMap:HANDOVER_STATUS_CLR,options:H_STATUS_OPTIONS}]}
                    emptyIcon="🔄" emptyMessage="No active handovers." pageSize={15}/>
            </div>
            <div className="adm-mobile">
                <MobileHandoverList handovers={handovers}/>
            </div>

            {network.length>0 && (
                <SectionCard title="Vendor Network">
                    <DataTable
                        columns={[
                            {key:"business_name",       label:"Vendor", sortable:true},
                            {key:"city_name",           label:"City",   sortable:true, width:120},
                            {key:"max_vehicles",        label:"Max",    sortable:true, width:70, align:"center"},
                            {key:"current_held_count",  label:"Held",   sortable:true, width:70, align:"center",
                             render:(v,row)=><span className={`admin-badge ${v>=row.max_vehicles?"admin-badge--red":"admin-badge--blue"}`}>{v}/{row.max_vehicles}</span>},
                            {key:"is_active", label:"Status", sortable:true, width:90,
                             render:(v)=><span className={`admin-badge ${v?"admin-badge--green":"admin-badge--gray"}`}>{v?"Active":"Inactive"}</span>},
                        ]}
                        data={network} searchable={false} emptyIcon="🤝" emptyMessage="No network vendors." pageSize={10}/>
                </SectionCard>
            )}
        </div>
    );
}