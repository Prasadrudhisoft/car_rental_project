// ─────────────────────────────────────────────────────────────────────────────
// tabs/AgreementsTab.jsx
// Acceptances DataTable gets a mobile card treatment; version list unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import DataTable from "../../../components/common/DataTable";
import { SectionCard } from "../AdminShared";
import { fmtDatetime } from "../adminConstants";

// ── Mobile acceptance card ────────────────────────────────────────────────────
function MobileAcceptanceCard({ a }) {
    return (
        <div className="adm-mob-card adm-mob-card--static">
            <div className="adm-mob-card__head">
                <span className="adm-mob-card__primary" style={{ fontWeight: 700 }}>{a.user_name || "—"}</span>
                <span className="adm-mob-card__ref" style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: "var(--teal-primary)" }}>
                    {a.version_tag}
                </span>
            </div>
            <div className="adm-mob-card__row">
                <span className="adm-mob-card__secondary">{a.user_email || "—"}</span>
            </div>
            {a.booking_ref && (
                <div className="adm-mob-card__row">
                    <span className="adm-mob-card__ref" style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: "var(--teal-primary)" }}>
                        {a.booking_ref}
                    </span>
                </div>
            )}
            <div className="adm-mob-card__footer">
                <span className="adm-mob-card__meta">
                    {a.acceptance_method === "otp_sign" ? "OTP Sign" : "Checkbox"}
                    {a.otp_verified ? " · ✓ OTP" : ""}
                    {" · "}{fmtDatetime(a.accepted_at)}
                </span>
            </div>
        </div>
    );
}

function MobileAcceptanceList({ acceptances, agreements }) {
    const [search,    setSearch]    = useState("");
    const [versionId, setVersionId] = useState("");

    const filtered = useMemo(() => {
        let r = acceptances;
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(a =>
                (a.user_name    || "").toLowerCase().includes(q) ||
                (a.user_email   || "").toLowerCase().includes(q) ||
                (a.booking_ref  || "").toLowerCase().includes(q) ||
                (a.version_tag  || "").toLowerCase().includes(q)
            );
        }
        if (versionId) r = r.filter(a => String(a.agreement_version_id) === versionId);
        return r;
    }, [acceptances, search, versionId]);

    return (
        <div className="adm-mob-list">
            <div className="adm-mob-search-wrap">
                <svg className="adm-mob-search-icon" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input className="adm-mob-search" type="search" placeholder="Search by user, booking, version…"
                    value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            {/* Version filter pills */}
            <div className="adm-mob-pills">
                <button className={`adm-mob-pill${versionId === "" ? " adm-mob-pill--active" : ""}`}
                    onClick={() => setVersionId("")}>All</button>
                {agreements.map(v => (
                    <button key={v.id}
                        className={`adm-mob-pill${versionId === String(v.id) ? " adm-mob-pill--active" : ""}`}
                        onClick={() => setVersionId(String(v.id))}>
                        {v.version_tag}
                    </button>
                ))}
            </div>
            {(search || versionId) && (
                <p className="adm-mob-count">{filtered.length} of {acceptances.length} acceptances</p>
            )}
            {filtered.length === 0
                ? <div className="admin-empty" style={{ padding: "40px 24px" }}><span>📋</span><p>No acceptances match.</p></div>
                : <div className="adm-mob-cards">{filtered.map((a, i) => <MobileAcceptanceCard key={a.id ?? i} a={a}/>)}</div>
            }
        </div>
    );
}

const acceptanceCols = [
    { key:"version_tag", label:"Version", sortable:true, width:110, render:(v)=><span className="dt-mono">{v}</span> },
    { key:"user_name", label:"User", sortable:true, width:180,
      render:(v,row)=>(<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{v||"—"}</span><span className="dt-cell-stack__secondary">{row.user_email}</span></div>) },
    { key:"booking_ref", label:"Booking", sortable:true, width:130,
      render:(v)=>v?<span className="dt-mono" style={{color:"var(--teal-primary)"}}>{v}</span>:"—" },
    { key:"acceptance_method", label:"Method", sortable:true, width:110,
      render:(v)=>(<span className="dt-badge" style={v==="otp_sign"?{background:"#DBEAFE",color:"#1D4ED8",borderColor:"#93C5FD"}:{background:"#F3F4F6",color:"#6B7280",borderColor:"#E5E7EB"}}>
        {v==="otp_sign"?"OTP Sign":"Checkbox"}</span>) },
    { key:"otp_verified", label:"OTP ✓", sortable:true, width:70, align:"center",
      render:(v)=>v?<span style={{color:"#059669",fontWeight:700}}>✓</span>:<span style={{color:"#9CA3AF"}}>—</span> },
    { key:"accepted_at", label:"Signed At", sortable:true, width:140, render:(v)=>fmtDatetime(v) },
    { key:"ip_address", label:"IP", sortable:false, width:120,
      render:(v)=>v?<span style={{fontFamily:"monospace",fontSize:11}}>{v}</span>:"—" },
];

export default function AgreementsTab({
    agreements, acceptances,
    onCreateAgreement, onUpdateAgreement, onActivateAgreement,
    agreementFormLoading,
}) {
    const [showCreate,     setShowCreate]     = useState(false);
    const [editingVersion, setEditingVersion] = useState(null);

    const emptyForm = {
        version_tag: "", title: "Rental Agreement – Terms & Conditions",
        summary: "", content: "", effective_from: "",
    };
    const [form, setForm] = useState(emptyForm);

    const handleCreate = async (e) => {
        e.preventDefault();
        const ok = await onCreateAgreement({ ...form, effective_from: form.effective_from || new Date().toISOString() });
        if (ok) { setShowCreate(false); setForm(emptyForm); }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        const ok = await onUpdateAgreement(editingVersion);
        if (ok) setEditingVersion(null);
    };

    const textareaStyle = {
        background: "#fff", border: "1px solid #D5DEE8", borderRadius: 8, color: "#111827",
        padding: "10px 12px", fontSize: 13, outline: "none", resize: "vertical",
        fontFamily: "DM Mono,monospace", width: "100%", boxSizing: "border-box",
    };

    return (
        <div className="admin-section">
            <SectionCard
                title="Agreement Versions"
                subtitle="Only one version can be active at a time."
                action={
                    <button className="admin-btn admin-btn--primary"
                        onClick={() => { setShowCreate(v => !v); setEditingVersion(null); }}>
                        {showCreate ? "✕ Cancel" : "+ New Version"}
                    </button>
                }
            >
                {/* Create form */}
                {showCreate && (
                    <form onSubmit={handleCreate} style={{ background:"#F8FAFB", border:"1px solid #E8EDF2", borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
                        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.7px", color:"#0DB89E" }}>New Draft Version</div>
                        <div className="admin-inline-form">
                            <div className="admin-form-field">
                                <label>Version Tag *</label>
                                <input type="text" placeholder="e.g. v2.0" value={form.version_tag} onChange={e=>setForm(p=>({...p,version_tag:e.target.value}))} required/>
                            </div>
                            <div className="admin-form-field">
                                <label>Title</label>
                                <input type="text" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/>
                            </div>
                            <div className="admin-form-field">
                                <label>Effective From</label>
                                <input type="datetime-local" value={form.effective_from} onChange={e=>setForm(p=>({...p,effective_from:e.target.value}))}/>
                            </div>
                        </div>
                        <div className="admin-form-field">
                            <label>Summary</label>
                            <input type="text" value={form.summary} onChange={e=>setForm(p=>({...p,summary:e.target.value}))}/>
                        </div>
                        <div className="admin-form-field">
                            <label>Content * (Markdown)</label>
                            <textarea rows={10} value={form.content} required onChange={e=>setForm(p=>({...p,content:e.target.value}))} style={textareaStyle}/>
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                            <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>{agreementFormLoading?"…":"+ Create Draft"}</button>
                            <button type="button" className="admin-btn admin-btn--ghost" onClick={()=>setShowCreate(false)}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* Edit form */}
                {editingVersion && (
                    <form onSubmit={handleUpdate} style={{ background:"#FFFBEB", border:"1px solid #FCD34D", borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
                        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", color:"#D97706" }}>Agreement {editingVersion.version_tag}</div>
                        <div className="admin-form-field">
                            <label>Title</label>
                            <input type="text" value={editingVersion.title} onChange={e=>setEditingVersion(p=>({...p,title:e.target.value}))}/>
                        </div>
                        <div className="admin-form-field">
                            <label>Summary</label>
                            <input type="text" value={editingVersion.summary||""} onChange={e=>setEditingVersion(p=>({...p,summary:e.target.value}))}/>
                        </div>
                        <div className="admin-form-field">
                            <label>Content</label>
                            <textarea rows={10} value={editingVersion.content} onChange={e=>setEditingVersion(p=>({...p,content:e.target.value}))} style={textareaStyle}/>
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                            {/* <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>{agreementFormLoading?"…":"Save Changes"}</button> */}
                            <button type="button" className="admin-btn admin-btn--ghost" onClick={()=>setEditingVersion(null)}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* Version list — unchanged */}
                <div className="admin-card-list">
                    {agreements.map(v => (
                        <div key={v.id} style={{ background:v.is_active?"#E6F7F5":"#F8FAFB", border:`1px solid ${v.is_active?"rgba(13,184,158,.35)":"#E8EDF2"}`, borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                            <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
                                    <span style={{ fontFamily:"DM Mono,monospace", fontSize:14, fontWeight:700, color:v.is_active?"#0A9E87":"#111827" }}>{v.version_tag}</span>
                                    {v.is_active && <span style={{ background:"#0DB89E", color:"#fff", fontSize:9, fontWeight:800, padding:"2px 8px", borderRadius:999 }}>LIVE</span>}
                                    <span style={{ background:v.acceptance_count>0?"#DBEAFE":"#F3F4F6", color:v.acceptance_count>0?"#1D4ED8":"#6B7280", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:999 }}>
                                        {v.acceptance_count} signed
                                    </span>
                                </div>
                                <div style={{ fontSize:13, fontWeight:600 }}>{v.title}</div>
                                {v.summary && <div style={{ fontSize:12, color:"#6B7280", maxWidth:480, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.summary}</div>}
                            </div>
                            <div style={{ display:"flex", gap:6 }}>
                                {!v.is_active && <button className="admin-btn admin-btn--success" onClick={()=>onActivateAgreement(v.id,v.version_tag)}>✓ Activate</button>}
                                <button className="admin-btn admin-btn--ghost" onClick={()=>{ setEditingVersion({...v}); setShowCreate(false); }}>View</button>
                            </div>
                        </div>
                    ))}
                    {agreements.length===0 && <div style={{ textAlign:"center", padding:"30px 0", color:"var(--vm)", fontSize:13 }}>No agreement versions yet.</div>}
                </div>
            </SectionCard>

            {/* Acceptance audit log */}
            <SectionCard title="Acceptance Audit Log" subtitle="Immutable record of every customer who signed.">
                <div className="adm-desktop">
                    <DataTable columns={acceptanceCols} data={acceptances} searchable
                        searchKeys={["user_name","user_email","booking_ref","version_tag"]}
                        searchPlaceholder="Search by user, booking ref, version…"
                        filters={[{
                            key:"agreement_version_id", label:"Version",
                            options:[{value:"",label:"All Versions"},...agreements.map(v=>({value:String(v.id),label:`${v.version_tag} (${v.acceptance_count})`}))],
                        }]}
                        emptyIcon="📋" emptyMessage="No acceptances found." pageSize={25}/>
                </div>
                <div className="adm-mobile">
                    <MobileAcceptanceList acceptances={acceptances} agreements={agreements}/>
                </div>
            </SectionCard>
        </div>
    );
}