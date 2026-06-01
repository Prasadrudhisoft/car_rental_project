// ─────────────────────────────────────────────────────────────────────────────
// tabs/ConfigTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { SectionCard } from "../AdminShared";

export default function ConfigTab({ configs, segments, setConfigs, setSegments, onConfigSave, onSegmentSave }) {
    return (
        <div className="admin-section">
            <SectionCard
                title="Platform Configuration"
                subtitle="Live settings — changes affect all future bookings immediately."
            >
                <div className="admin-config-notice">
                    ⚠ These are live settings. Changes take effect immediately.
                </div>
                <div className="admin-config-list">
                    {configs.map((c) => (
                        <div key={c.id} className="admin-config-row">
                            <div className="admin-config-info">
                                <strong>{c.display_name}</strong>
                                <span>{c.description}</span>
                                <code>{c.key} <span className="admin-type-chip">{c.value_type}</span></code>
                            </div>
                            <div className="admin-config-edit">
                                {c.is_editable ? (
                                    <>
                                        <input
                                            value={c.value}
                                            onChange={(e) =>
                                                setConfigs((p) =>
                                                    p.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x)
                                                )
                                            }
                                        />
                                        <button
                                            className="admin-btn admin-btn--success admin-btn--sm"
                                            onClick={() => onConfigSave(c)}
                                        >
                                            Save
                                        </button>
                                    </>
                                ) : (
                                    <span className="admin-config-locked">🔒 {c.value}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title="Vehicle Segment Configuration">
                <div className="admin-segment-grid">
                    {segments.map((seg) => (
                        <div key={seg.id} className="admin-segment-card">
                            <div className="admin-segment-card__header">
                                <strong>{seg.display_name}</strong>
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
                                            onChange={(e) =>
                                                setSegments((p) =>
                                                    p.map((x) => x.id === seg.id ? { ...x, [field]: e.target.value } : x)
                                                )
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                            <button
                                className="admin-btn admin-btn--success admin-btn--sm admin-segment-save"
                                onClick={() => onSegmentSave(seg)}
                            >
                                Save Changes
                            </button>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}
