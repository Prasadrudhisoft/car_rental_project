import React, { useCallback, useEffect, useRef, useState } from "react";
import { getActivityLogs, getActivityLogMeta } from "../../../services/api";
import { SectionCard } from "../AdminShared";

const EMPTY = { user: "", role: "", module: "", action: "", from: "", to: "", q: "" };
const PAGE_SIZE = 50;

const th = { textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.5px", color: "var(--vm)", borderBottom: "1px solid var(--vbdr)", whiteSpace: "nowrap" };
const td = { padding: "8px 10px", fontSize: 12, color: "var(--vt)", borderBottom: "1px solid var(--vbdr)", verticalAlign: "top" };

export default function ActivityLogsTab() {
    const [meta,    setMeta]    = useState({ modules: [], actions: [], roles: [], retention_days: 30 });
    const [draft,   setDraft]   = useState(EMPTY);      // what the inputs show
    const [filters, setFilters] = useState(EMPTY);      // what is sent to the API (debounced)
    const [page,    setPage]    = useState(1);
    const [rows,    setRows]    = useState([]);
    const [count,   setCount]   = useState(0);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState("");
    const [open,    setOpen]    = useState(null);
    const reqId = useRef(0);

    // Dropdown options come from the backend so they never drift from the model.
    useEffect(() => {
        getActivityLogMeta().then(r => setMeta(r.data)).catch(() => {});
    }, []);

    // Debounce filter typing; any filter change returns to page 1.
    useEffect(() => {
        const t = setTimeout(() => { setFilters(draft); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [draft]);

    const load = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        setError("");
        try {
            const params = { page, page_size: PAGE_SIZE };
            Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
            const { data } = await getActivityLogs(params);
            if (id !== reqId.current) return;          // a newer request superseded this one
            setRows(data.results ?? []);
            setCount(data.count ?? 0);
        } catch (e) {
            if (id !== reqId.current) return;
            setError(e.response?.status === 403
                ? "Only admins can view activity logs."
                : e.response?.data?.detail || e.message || "Could not load activity logs.");
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [filters, page]);

    useEffect(() => { load(); }, [load]);

    const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
    const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const hasFilter = Object.values(draft).some(Boolean);

    return (
        <div className="admin-section">
            <SectionCard
                title="Activity Logs"
                subtitle={`Read-only audit trail. Entries are deleted automatically after ${meta.retention_days || 30} days.`}
            >
                {/* Filters */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    <input className="admin-search-input" style={{ width: 170 }} placeholder="User email"
                        value={draft.user} onChange={e => set("user", e.target.value)} />
                    <select className="admin-search-input" value={draft.role} onChange={e => set("role", e.target.value)}>
                        <option value="">All roles</option>
                        {(meta.roles || []).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select className="admin-search-input" value={draft.module} onChange={e => set("module", e.target.value)}>
                        <option value="">All modules</option>
                        {(meta.modules || []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select className="admin-search-input" value={draft.action} onChange={e => set("action", e.target.value)}>
                        <option value="">All actions</option>
                        {(meta.actions || []).map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                    <input type="date" className="admin-search-input" title="From" value={draft.from}
                        max={draft.to || undefined} onChange={e => set("from", e.target.value)} />
                    <input type="date" className="admin-search-input" title="To" value={draft.to}
                        min={draft.from || undefined} onChange={e => set("to", e.target.value)} />
                    <input className="admin-search-input" style={{ width: 190 }} placeholder="Search summary"
                        value={draft.q} onChange={e => set("q", e.target.value)} />
                    {hasFilter && (
                        <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setDraft(EMPTY)}>Clear</button>
                    )}
                </div>

                {error && (
                    <div className="admin-error">
                        <span>⚠ {error}</span>
                        <button onClick={load}>↺ Retry</button>
                    </div>
                )}

                {loading && rows.length === 0 && !error && (
                    <div className="admin-loading"><div className="admin-loading__spinner" /><span>Loading activity…</span></div>
                )}

                {!loading && !error && rows.length === 0 && (
                    <div className="admin-empty"><span>📜</span><p>No activity found{hasFilter ? " for these filters" : ""}.</p></div>
                )}

                {rows.length > 0 && (
                    <div style={{ overflowX: "auto", opacity: loading ? 0.6 : 1 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                            <thead>
                                <tr>
                                    <th style={th}>Time</th><th style={th}>User</th><th style={th}>Role</th>
                                    <th style={th}>Module</th><th style={th}>Action</th><th style={th}>Entity</th>
                                    <th style={th}>Summary</th><th style={th}>IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => {
                                    const hasDetail = r.old_values || r.new_values;
                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr onClick={() => hasDetail && setOpen(open === r.id ? null : r.id)}
                                                style={{ cursor: hasDetail ? "pointer" : "default" }}>
                                                <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("en-IN")}</td>
                                                <td style={td}>{r.actor_label || "—"}</td>
                                                <td style={td}>{r.actor_role || "—"}</td>
                                                <td style={td}>{r.module}</td>
                                                <td style={td}><span className="admin-badge admin-badge--blue">{r.action}</span></td>
                                                <td style={td}>{r.entity_type ? `${r.entity_type} #${r.entity_id}` : "—"}</td>
                                                <td style={td}>{r.summary || "—"}{hasDetail ? " ▾" : ""}</td>
                                                <td style={td}>{r.ip_address || "—"}</td>
                                            </tr>
                                            {open === r.id && (
                                                <tr>
                                                    <td colSpan={8} style={{ ...td, background: "var(--vs2)" }}>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                                            {[["Before", r.old_values], ["After", r.new_values]].map(([label, val]) => (
                                                                <div key={label}>
                                                                    <strong style={{ fontSize: 11, color: "var(--vm)" }}>{label}</strong>
                                                                    <pre style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", fontSize: 11 }}>
                                                                        {val ? JSON.stringify(val, null, 2) : "—"}
                                                                    </pre>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {count > 0 && (
                    <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
                        <button className="admin-btn admin-btn--ghost admin-btn--sm" disabled={page <= 1 || loading}
                            onClick={() => setPage(p => p - 1)}>← Prev</button>
                        <span style={{ fontSize: 12, color: "var(--vm)" }}>Page {page} of {pages} · {count.toLocaleString("en-IN")} entries</span>
                        <button className="admin-btn admin-btn--ghost admin-btn--sm" disabled={page >= pages || loading}
                            onClick={() => setPage(p => p + 1)}>Next →</button>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
