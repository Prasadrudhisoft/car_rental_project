// ─────────────────────────────────────────────────────────────────────────────
// cdShared.jsx
// Tiny reusable UI primitives used across CustomerDashboard sub-components.
// No API calls — pure presentation only.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { STATUS_CLR } from './cdConstants';

// ── Status badge ───────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
    const s = STATUS_CLR[status] || { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 9px', borderRadius: 999,
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.4px', textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            background: s.bg, color: s.color,
            border: `1px solid ${s.border}`,
        }}>
            {status}
        </span>
    );
}

// ── Info row ───────────────────────────────────────────────────────────────
export function InfoRow({ label, value, highlight }) {
    return (
        <div className="cd-info-row">
            <span className="cd-info-row__lbl">{label}</span>
            <strong
                className="cd-info-row__val"
                style={highlight ? { color: 'var(--cd-acc)', fontSize: 15 } : {}}
            >
                {value || '—'}
            </strong>
        </div>
    );
}

// ── Toast notification ─────────────────────────────────────────────────────
export function Toast({ msg, type, onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, 3500);
        return () => clearTimeout(t);
    }, [onDone]);

    return (
        <div className={`cd-toast cd-toast--${type}`}>
            {type === 'success'
                ? <span className="toast-icon success">&#10003;</span>
                : <span className="toast-icon warning">!</span>
            }
            {msg}
        </div>
    );
}

// ── Star rating input / display ────────────────────────────────────────────
export function StarRating({ value, onChange, readonly }) {
    return (
        <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => !readonly && onChange?.(n)}
                    style={{
                        background: 'none', border: 'none',
                        cursor: readonly ? 'default' : 'pointer',
                        fontSize: 22,
                        color: n <= value ? '#E8A020' : '#D1D5DB',
                        padding: 0, transition: 'color 0.15s',
                    }}
                >
                    &#9733;
                </button>
            ))}
        </div>
    );
}

// ── Filter dropdown ────────────────────────────────────────────────────────
export function FilterDropdown({ label, value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const h = e => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const selected = options.find(o => o.value === value);
    const isActive = value !== '' && value != null;

    return (
        <div className="cd-filter-dropdown" ref={ref}>
            <button
                className={`cd-filter-dropdown__trigger${isActive ? ' active' : ''}${open ? ' open' : ''}`}
                onClick={() => setOpen(v => !v)}
            >
                <span className="cd-filter-dropdown__label">{label}</span>
                {isActive && (
                    <span className="cd-filter-dropdown__chip">{selected?.label}</span>
                )}
                <span className={`cd-filter-dropdown__chevron${open ? ' flipped' : ''}`}>▾</span>
            </button>
            {open && (
                <div className="cd-filter-dropdown__menu">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            className={`cd-filter-dropdown__item${value === opt.value ? ' selected' : ''}`}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                        >
                            {opt.color && (
                                <span
                                    className="cd-filter-dropdown__dot"
                                    style={{ background: opt.color }}
                                />
                            )}
                            <span>{opt.label}</span>
                            {value === opt.value && (
                                <span className="cd-filter-dropdown__check">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}