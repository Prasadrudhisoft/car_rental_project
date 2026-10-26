// ─────────────────────────────────────────────────────────────────────────────
// tabs/ConfigTab.jsx
// Designed for non-technical admins: no internal "key" is ever shown or typed.
// Value Type is a plain-language choice with live examples. Deletion is a
// reversible Archive step; permanent delete only unlocks after archiving.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import { SectionCard } from "../AdminShared";

// Friendly type choices shown to admins. "json" is deliberately excluded —
// it's for internal system settings only and isn't something an admin
// should hand-author.
const TYPE_CHOICES = [
    { value: "percentage", label: "Percentage",  hint: "A rate out of 100, like a tax or commission.", example: "e.g. 18 means 18%" },
    { value: "number",     label: "Amount",       hint: "A plain number — money, a count, or hours.",   example: "e.g. 300 or 48" },
    { value: "boolean",    label: "Yes / No",     hint: "A simple on/off switch.",                       example: "e.g. enabled or disabled" },
    { value: "text",       label: "Text",         hint: "Free-form words, like a label or message.",     example: "e.g. \"Welcome!\"" },
];

function typeLabel(value_type) {
    return TYPE_CHOICES.find((t) => t.value === value_type)?.label || value_type;
}

// ── Type-aware value input, used both in the create form and inline edit ──
function ValueInput({ valueType, value, onChange, autoFocus }) {
    if (valueType === "boolean") {
        const isYes = String(value).toLowerCase() === "true" || value === true;
        return (
            <select
                className="admin-search-input"
                style={{ width: 140 }}
                value={isYes ? "true" : "false"}
                onChange={(e) => onChange(e.target.value)}
                autoFocus={autoFocus}
            >
                <option value="true">Yes / Enabled</option>
                <option value="false">No / Disabled</option>
            </select>
        );
    }
    if (valueType === "percentage") {
        return (
            <div style={{ position: "relative", display: "inline-block" }}>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ width: 100, paddingRight: 22 }}
                    autoFocus={autoFocus}
                />
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--vm)", pointerEvents: "none" }}>%</span>
            </div>
        );
    }
    if (valueType === "number") {
        return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 120 }} autoFocus={autoFocus} />;
    }
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 180 }} autoFocus={autoFocus} />;
}

// ── Guided "New Setting" form ──────────────────────────────────────────────
function NewSettingForm({ categories, onSubmit, onCancel, loading, serverError }) {
    const [displayName, setDisplayName] = useState("");
    const [categoryId,  setCategoryId]  = useState("");
    const [valueType,   setValueType]   = useState("number");
    const [value,       setValue]       = useState("");
    const [description, setDescription] = useState("");

    const selectedCategory = categories.find((c) => String(c.id) === String(categoryId));
    const selectedType     = TYPE_CHOICES.find((t) => t.value === valueType);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            display_name: displayName,
            category: categoryId,
            value_type: valueType,
            value: valueType === "boolean" ? (value === "true" ? "true" : "false") : value,
            description,
        });
    };

    return (
        <form onSubmit={handleSubmit} style={{ background: "#F8FAFB", border: "1px solid #E8EDF2", borderRadius: 12, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#0DB89E" }}>
                New Setting
            </div>

            {serverError && (
                <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#B91C1C", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                    {serverError}
                </div>
            )}

            {/* Step 1: Name it */}
            <div className="admin-form-field">
                <label>What is this setting called?</label>
                <input
                    type="text"
                    placeholder="e.g. Late Return Fee Per Hour"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                />
                <span style={{ fontSize: 11, color: "var(--vm)", marginTop: 4 }}>
                    Use a clear, everyday name — this is exactly what you and other admins will see and search for later.
                </span>
            </div>

            {/* Step 2: Where does it live */}
            <div className="admin-form-field">
                <label>Which area does it belong to?</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                    <option value="">Choose a category…</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                {selectedCategory?.description && (
                    <span style={{ fontSize: 11, color: "var(--vm)", marginTop: 4 }}>{selectedCategory.description}</span>
                )}
            </div>

            {/* Step 3: What kind of value */}
            <div className="admin-form-field">
                <label>What kind of value is this?</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {TYPE_CHOICES.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => { setValueType(t.value); setValue(t.value === "boolean" ? "true" : ""); }}
                            className={`admin-btn admin-btn--sm ${valueType === t.value ? "admin-btn--primary" : "admin-btn--ghost"}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                {selectedType && (
                    <span style={{ fontSize: 11, color: "var(--vm)", marginTop: 4 }}>
                        {selectedType.hint} ({selectedType.example})
                    </span>
                )}
            </div>

            {/* Step 4: The value itself */}
            <div className="admin-form-field">
                <label>What should the value be right now?</label>
                <ValueInput valueType={valueType} value={value} onChange={setValue} />
            </div>

            {/* Step 5: Optional description */}
            <div className="admin-form-field">
                <label>Notes for other admins (optional)</label>
                <input
                    type="text"
                    placeholder="Explain what this setting controls, so it's clear months from now"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="admin-form-submit" disabled={loading}>
                    {loading ? "Creating…" : "+ Create Setting"}
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

export default function ConfigTab({
    configs, segments, categories,
    setConfigs, setSegments,
    onConfigSave, onSegmentSave,
    onAddConfig, onArchiveConfig, onRestoreConfig, onDeleteConfig,
    onViewHistory,
    formLoading,
}) {
    const [search,       setSearch]       = useState("");
    const [catSlug,      setCatSlug]      = useState("");
    const [reasons,      setReasons]      = useState({});
    const [showAdd,      setShowAdd]      = useState(false);
    const [createError,  setCreateError]  = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const [original] = useState(() => Object.fromEntries(configs.map((c) => [c.id, c.value])));

    const activeConfigs   = configs.filter((c) => c.is_active);
    const archivedConfigs = configs.filter((c) => !c.is_active);

    const filtered = useMemo(() => {
        let r = activeConfigs;
        if (catSlug) r = r.filter((c) => c.category_name === catSlug);
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter((c) => c.display_name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));
        }
        return r;
    }, [activeConfigs, search, catSlug]);

    const dirtyCount = activeConfigs.filter((c) => original[c.id] !== undefined && c.value !== original[c.id]).length;

    const handleValueChange = (id, value) =>
        setConfigs((p) => p.map((x) => (x.id === id ? { ...x, value } : x)));

    const handleSave = async (c) => {
        await onConfigSave(c, reasons[c.id] || "");
        original[c.id] = c.value;
        setReasons((p) => ({ ...p, [c.id]: "" }));
    };

    const handleCreate = async (payload) => {
        setCreateError("");
        try {
            await onAddConfig(payload);
            setShowAdd(false);
        } catch (e) {
            const msg = e?.response?.data?.display_name?.[0] || e?.response?.data?.detail || "Couldn't create this setting.";
            setCreateError(msg);
        }
    };

    return (
        <div className="admin-section">
            <SectionCard
                title="Platform Configuration"
                subtitle="Live settings — changes affect all future bookings immediately."
                action={
                    <button className="admin-btn admin-btn--primary" onClick={() => { setShowAdd((v) => !v); setCreateError(""); }}>
                        {showAdd ? "✕ Cancel" : "+ New Setting"}
                    </button>
                }
            >
                <div className="admin-config-notice">
                    ⚠ These are live settings. Changes take effect immediately.
                    {dirtyCount > 0 && (
                        <strong style={{ marginLeft: 8, color: "#D97706" }}>
                            {dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}
                        </strong>
                    )}
                </div>

                {showAdd && (
                    <NewSettingForm
                        categories={categories}
                        onSubmit={handleCreate}
                        onCancel={() => setShowAdd(false)}
                        loading={formLoading}
                        serverError={createError}
                    />
                )}

                <div className="cd-filter-bar" style={{ marginTop: 12 }}>
                    <input
                        className="admin-search-input"
                        placeholder="Search settings by name…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 240 }}
                    />
                    <div className="adm-mob-pills" style={{ overflow: "visible", flexWrap: "wrap" }}>
                        <button className={`adm-mob-pill${catSlug === "" ? " adm-mob-pill--active" : ""}`} onClick={() => setCatSlug("")}>All</button>
                        {categories.map((c) => (
                            <button
                                key={c.id}
                                className={`adm-mob-pill${catSlug === c.name ? " adm-mob-pill--active" : ""}`}
                                onClick={() => setCatSlug((p) => (p === c.name ? "" : c.name))}
                                title={c.description}
                            >{c.name}</button>
                        ))}
                    </div>
                </div>

                <div className="admin-config-list" style={{ marginTop: 12 }}>
                    {filtered.map((c) => {
                        const isDirty = original[c.id] !== undefined && c.value !== original[c.id];
                        return (
                            <div key={c.id} className="admin-config-row" style={isDirty ? { borderColor: "#FCD34D", background: "#FFFBEB" } : undefined}>
                                <div className="admin-config-info">
                                    <strong>
                                        {c.display_name}
                                        {c.is_system && (
                                            <span title="Required by platform logic — value can be edited, but this setting can never be removed." style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#1D4ED8", background: "#DBEAFE", padding: "2px 7px", borderRadius: 999 }}>
                                                🔒 CORE SETTING
                                            </span>
                                        )}
                                        {isDirty && (
                                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#D97706", background: "#FEF3C7", padding: "2px 7px", borderRadius: 999 }}>
                                                MODIFIED
                                            </span>
                                        )}
                                    </strong>
                                    <span>{c.description}</span>
                                    <span style={{ fontSize: 10, color: "var(--vm)", marginTop: 2 }}>
                                        {c.category_name} · {typeLabel(c.value_type)}
                                    </span>
                                    {isDirty && (
                                        <span style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>
                                            <s style={{ opacity: 0.6 }}>{original[c.id]}</s> → <strong>{c.value}</strong>
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                                    {c.is_editable ? (
                                        <>
                                            <div className="admin-config-edit" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <ValueInput valueType={c.value_type} value={c.value} onChange={(v) => handleValueChange(c.id, v)} />
                                                <input
                                                    className="admin-note-input"
                                                    placeholder="Reason for change (optional)…"
                                                    style={{ width: 150 }}
                                                    value={reasons[c.id] || ""}
                                                    onChange={(e) => setReasons((p) => ({ ...p, [c.id]: e.target.value }))}
                                                />
                                                <button
                                                    className={`admin-btn admin-btn--sm ${isDirty ? "admin-btn--success" : "admin-btn--ghost"}`}
                                                    onClick={() => handleSave(c)}
                                                    disabled={!isDirty}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => onViewHistory(c)}>📋 History</button>
                                                {!c.is_system && (
                                                    <button
                                                        className="admin-btn admin-btn--danger admin-btn--sm"
                                                        onClick={() => onArchiveConfig(c.id)}
                                                        title="Archive — you can restore it later"
                                                    >
                                                        🗄 Archive
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span className="admin-config-locked">🔒 {c.value}</span>
                                            <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => onViewHistory(c)}>📋 History</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--vm)", fontSize: 13 }}>
                            No settings match your filters.
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* ── Archived settings — reversible undo zone ── */}
            {archivedConfigs.length > 0 && (
                <SectionCard
                    title={`Archived Settings (${archivedConfigs.length})`}
                    subtitle="Archived settings are hidden from normal use but not gone. Restore them anytime, or delete permanently once you're sure."
                    action={
                        <button className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setShowArchived((v) => !v)}>
                            {showArchived ? "Hide" : "Show"}
                        </button>
                    }
                >
                    {showArchived && (
                        <div className="admin-config-list">
                            {archivedConfigs.map((c) => (
                                <div key={c.id} className="admin-config-row" style={{ opacity: 0.75 }}>
                                    <div className="admin-config-info">
                                        <strong>{c.display_name}</strong>
                                        <span>{c.description}</span>
                                        <span style={{ fontSize: 10, color: "var(--vm)" }}>Last value: {c.value}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button className="admin-btn admin-btn--success admin-btn--sm" onClick={() => onRestoreConfig(c.id)}>↺ Restore</button>
                                        <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => onDeleteConfig(c.id, c.display_name)}>✕ Delete Permanently</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            )}

            <SectionCard title="Vehicle Segment Configuration" subtitle="Per-segment deposits, driver-age rules, and commission overrides.">
                <div className="admin-segment-grid">
                    {segments.map((seg) => (
                        <div key={seg.id} className="admin-segment-card">
                            <div className="admin-segment-card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <strong>{seg.display_name}</strong>
                                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--vm)", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={seg.is_active}
                                        onChange={(e) => setSegments((p) => p.map((x) => (x.id === seg.id ? { ...x, is_active: e.target.checked } : x)))}
                                    /> Active
                                </label>
                            </div>
                            <div className="admin-segment-card__fields">
                                {[
                                    ["Security Deposit (₹)", "security_deposit"],
                                    ["Min Driver Age",        "min_driver_age"],
                                    ["Min Rental Days",       "min_rental_days"],
                                ].map(([lbl, field]) => (
                                    <div key={field} className="admin-form-field">
                                        <label>{lbl}</label>
                                        <input
                                            type="number"
                                            value={seg[field]}
                                            onChange={(e) => setSegments((p) => p.map((x) => (x.id === seg.id ? { ...x, [field]: e.target.value } : x)))}
                                        />
                                    </div>
                                ))}
                                <div className="admin-form-field">
                                    <label>Commission Override (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Uses global rate if blank"
                                        value={seg.platform_commission_override ?? ""}
                                        onChange={(e) =>
                                            setSegments((p) => p.map((x) => (x.id === seg.id
                                                ? { ...x, platform_commission_override: e.target.value === "" ? null : e.target.value }
                                                : x)))
                                        }
                                    />
                                </div>
                            </div>
                            <button className="admin-btn admin-btn--success admin-btn--sm admin-segment-save" onClick={() => onSegmentSave(seg)}>
                                Save Changes
                            </button>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}