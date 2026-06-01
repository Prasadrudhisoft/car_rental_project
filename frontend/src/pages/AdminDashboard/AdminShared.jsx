// ─────────────────────────────────────────────────────────────────────────────
// AdminShared.jsx
// Tiny reusable UI primitives: StatusBadge, SectionCard, InlineForm,
// StarDisplay, ScopeIndicator.  No API calls here — pure presentation.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";

// ── Status badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status, colorMap, size = "md" }) {
    const s = colorMap?.[status] || { bg: "#F3F4F6", color: "#6B7280" };
    return (
        <span
            className={`admin-status-badge admin-status-badge--${size}`}
            style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}30` }}
        >
            {status?.replace(/_/g, " ")}
        </span>
    );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
export function SectionCard({ title, subtitle, children, action }) {
    return (
        <div className="admin-section-card">
            <div className="admin-section-card__header">
                <div>
                    <h3>{title}</h3>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

// ── Inline add-record form ────────────────────────────────────────────────────
export function InlineForm({ fields, onSubmit, submitLabel = "+ Add", loading }) {
    const [vals, setVals] = useState(() =>
        Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""])),
    );
    const reset = () =>
        setVals(Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""])));

    return (
        <form
            className="admin-inline-form"
            onSubmit={(e) => { e.preventDefault(); onSubmit(vals); reset(); }}
        >
            {fields.map((f) => (
                <div key={f.key} className="admin-form-field">
                    <label>{f.label}</label>
                    {f.type === "select" ? (
                        <select
                            value={vals[f.key]}
                            required={f.required}
                            onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                        >
                            <option value="">Select {f.label}</option>
                            {f.options?.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={f.type || "text"}
                            value={vals[f.key]}
                            step={f.step}
                            placeholder={f.placeholder}
                            required={f.required}
                            onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                        />
                    )}
                </div>
            ))}
            <button type="submit" className="admin-form-submit" disabled={loading}>
                {loading ? "…" : submitLabel}
            </button>
        </form>
    );
}

// ── Star rating display ───────────────────────────────────────────────────────
export function StarDisplay({ value, size = 14 }) {
    return (
        <span style={{ display: "inline-flex", gap: 1 }}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={{ fontSize: size, color: n <= value ? "#E8A020" : "#E5E7EB", lineHeight: 1 }}>
                    ★
                </span>
            ))}
        </span>
    );
}

// ── Scope indicator (hero banner badge) ──────────────────────────────────────
export function ScopeIndicator({ profile }) {
    if (!profile) return null;
    const isSuper = profile.scope === "superadmin";
    return (
        <div className="admin-scope-indicator">
            {isSuper ? (
                <span className="admin-scope-indicator--super">
                    👑 Super Admin — Full Platform Access
                </span>
            ) : (
                <span className="admin-scope-indicator--assigned">
                    🎯 Assigned Admin
                    {profile.assigned_vendor_count != null && (
                        <> · {profile.assigned_vendor_count} vendor{profile.assigned_vendor_count !== 1 ? "s" : ""}</>
                    )}
                    {profile.display_name ? ` · ${profile.display_name}` : ""}
                </span>
            )}
        </div>
    );
}
