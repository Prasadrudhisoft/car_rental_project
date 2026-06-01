// ─────────────────────────────────────────────────────────────────────────────
// VendorShared.jsx
// Pure presentational primitives: StatusBadge, InfoRow, Toast, Field,
// FormInput, FormSelect, SectionCard, KYCGateBanner.
// No API calls. No business logic.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { STATUS_CLR } from './vendorConstants';

// ── Status badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status, statusMap }) {
    const map = statusMap || STATUS_CLR;
    const s   = map[status] || { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
    return (
        <span className="vd-badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border || s.color + '40'}` }}>
            {status?.replace(/_/g, ' ')}
        </span>
    );
}

// ── Info row (label + value) ──────────────────────────────────────────────────
export function InfoRow({ label, value, highlight }) {
    return (
        <div className="vd-info-pair">
            <span>{label}</span>
            <strong style={highlight ? { color: 'var(--vacc)', fontSize: 15 } : {}}>{value || '—'}</strong>
        </div>
    );
}

// ── Toast notification ────────────────────────────────────────────────────────
export function Toast({ msg, type, onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, 3500);
        return () => clearTimeout(t);
    }, [onDone]);

    return (
        <div className={`vd-toast vd-toast--${type}`}>
            {type === 'success'
                ? <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: '#D1FAE5', color: '#059669' }}>✓</span>
                : <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: '#FEE2E2', color: '#EF4444' }}>!</span>}
            {msg}
        </div>
    );
}

// ── Form field wrapper ────────────────────────────────────────────────────────
export function Field({ label, children }) {
    return (
        <div className="vd-form-field">
            <label>{label}</label>
            {children}
        </div>
    );
}

// ── Text / number / date input ────────────────────────────────────────────────
export function FormInput({ label, value, onChange, type = 'text', placeholder, required, min, max }) {
    return (
        <Field label={label}>
            <input
                className="vd-input"
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                min={min}
                max={max}
            />
        </Field>
    );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function FormSelect({ label, value, onChange, options, required }) {
    return (
        <Field label={label}>
            <select className="vd-input vd-select" value={value} onChange={onChange} required={required}>
                {options.map(o =>
                    typeof o === 'string'
                        ? <option key={o} value={o}>{o}</option>
                        : <option key={o.value} value={o.value}>{o.label}</option>
                )}
            </select>
        </Field>
    );
}

// ── Section card ──────────────────────────────────────────────────────────────
export function SectionCard({ title, subtitle, children, action }) {
    return (
        <div className="vd-card">
            {(title || action) && (
                <div className="vd-card__head">
                    <div>
                        {title    && <h3 className="vd-card__title">{title}</h3>}
                        {subtitle && <p  className="vd-card__sub">{subtitle}</p>}
                    </div>
                    {action}
                </div>
            )}
            {children}
        </div>
    );
}

// ── KYC gate banner ───────────────────────────────────────────────────────────
export function KYCGateBanner({ onGoToKYC }) {
    return (
        <div className="vd-kyc-gate">
            <div className="vd-kyc-gate__icon">🔒</div>
            <div className="vd-kyc-gate__body">
                <h3>KYC Required to Proceed</h3>
                <p>Complete your KYC verification to access this section. This includes Aadhaar, PAN, bank details, business address, and pickup location.</p>
                <button className="vd-btn vd-btn--primary" onClick={onGoToKYC}>Complete KYC →</button>
            </div>
        </div>
    );
}