import React, { useState, useEffect } from 'react';
import { getActiveAgreement, getAgreementVersion, getMyAgreementHistory } from '../../services/api';
import './AgreementModal.css';

// ── Shared: Spinner ─────────────────────────────────────────────────────
function Spinner({ size = 18 }) {
    return (
        <span
            className="agr-spinner"
            style={{ width: size, height: size }}
            aria-hidden="true"
        />
    );
}

// ── Shared: Markdown-ish content renderer ──────────────────────────────
// Renders the text returned by the backend.
// Supports: # H1, ## H2, numbered lists, blank lines, plain paragraphs.
function AgreementContent({ content }) {
    if (!content) return null;
    const lines = content.split('\n');
    return (
        <div className="agr-content">
            {lines.map((line, i) => {
                if (line.startsWith('# '))
                    return <h2 key={i} className="agr-h1">{line.slice(2)}</h2>;
                if (line.startsWith('## '))
                    return <h3 key={i} className="agr-h2">{line.slice(3)}</h3>;
                if (/^\d+\./.test(line))
                    return <p key={i} className="agr-numbered">{line}</p>;
                if (line.trim() === '')
                    return <div key={i} className="agr-spacer" />;
                return <p key={i} className="agr-p">{line}</p>;
            })}
        </div>
    );
}

// ── Shared: Version badge ───────────────────────────────────────────────
function VersionBadge({ versionTag, isActive }) {
    return (
        <span className={`agr-version-badge${isActive ? ' agr-version-badge--active' : ''}`}>
            {isActive && <span className="agr-version-dot" />}
            {versionTag}
            {isActive && <span className="agr-version-live">LIVE</span>}
        </span>
    );
}

// ── Shared: Method badge ────────────────────────────────────────────────
function MethodBadge({ otpVerified }) {
    return (
        <span className={`agr-method-badge ${otpVerified ? 'otp' : 'checkbox'}`}>
            {otpVerified ? '🔐 OTP Verified' : '☑ Checkbox'}
        </span>
    );
}

// Read-only preview of the active agreement (used before payment, and for unaccepted bookings)
export function AgreementPreviewModal({ version: initialVersion, onClose }) {
    const [version, setVersion] = useState(initialVersion || null);
    const [loading, setLoading] = useState(!initialVersion);
    const [error,   setError]   = useState('');

    useEffect(() => {
        if (initialVersion) return;
        getActiveAgreement()
            .then(({ data }) => setVersion(data))
            .catch(() => setError('Could not load the agreement.'))
            .finally(() => setLoading(false));
    }, [initialVersion]);

    return (
        <div className="agr-backdrop" onClick={e => e.target === e.currentTarget && onClose()}
             role="dialog" aria-modal="true" aria-label="Rental Agreement">
            <div className="agr-modal">
                <div className="agr-modal__head">
                    <div className="agr-modal__head-left">
                        <span className="agr-modal__icon" aria-hidden="true">📄</span>
                        <div>
                            <h2 className="agr-modal__title">Rental Agreement</h2>
                            {version && <VersionBadge versionTag={version.version_tag} isActive={version.is_active} />}
                        </div>
                    </div>
                    <button className="agr-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                {loading && (
                    <div className="agr-modal__body agr-modal__body--center">
                        <Spinner size={28} /><span className="agr-loading-text">Loading agreement…</span>
                    </div>
                )}
                {!loading && error && (
                    <div className="agr-modal__body agr-modal__body--center"><div className="agr-error">⚠ {error}</div></div>
                )}
                {!loading && version && (
                    <>
                        {version.summary && (
                            <div className="agr-summary">
                                <span className="agr-summary__icon" aria-hidden="true">💡</span>
                                <p>{version.summary}</p>
                            </div>
                        )}
                        <div className="agr-modal__body agr-modal__body--scroll">
                            <AgreementContent content={version.content} />
                        </div>
                    </>
                )}
                <div className="agr-modal__foot">
                    <button className="agr-btn agr-btn--ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW MODAL (read-only, post-sign)
// Fetches the exact version that was signed using the acceptance record.
// ══════════════════════════════════════════════════════════════════════════
export function AgreementViewModal({ booking, acceptance, onClose }) {
    const [version, setVersion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const versionId =
            acceptance?.agreement_version_id ||
            booking?.agreement_version_id;

        if (!versionId) {
            // Fallback: show the active version
            getActiveAgreement()
                .then(({ data }) => setVersion(data))
                .catch(() => setError('Could not load agreement.'))
                .finally(() => setLoading(false));
            return;
        }

        getAgreementVersion(versionId)
            .then(({ data }) => setVersion(data))
            .catch(() => setError('Could not load the signed version.'))
            .finally(() => setLoading(false));
    }, [acceptance, booking]);

    return (
        <div
            className="agr-backdrop"
            onClick={e => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-label="Signed Agreement"
        >
            <div className="agr-modal agr-modal--view">

                {/* Header */}
                <div className="agr-modal__head">
                    <div className="agr-modal__head-left">
                        <span className="agr-modal__icon" aria-hidden="true">📋</span>
                        <div>
                            <h2 className="agr-modal__title">Rental Agreement</h2>
                            {version && (
                                <VersionBadge
                                    versionTag={version.version_tag}
                                    isActive={version.is_active}
                                />
                            )}
                        </div>
                    </div>
                    <button
                        className="agr-modal__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {loading && (
                    <div className="agr-modal__body agr-modal__body--center">
                        <Spinner size={28} />
                        <span className="agr-loading-text">Loading signed agreement…</span>
                    </div>
                )}

                {!loading && error && (
                    <div className="agr-modal__body agr-modal__body--center">
                        <div className="agr-error">⚠ {error}</div>
                    </div>
                )}

                {!loading && !error && version && acceptance && (
                    <>
                        {/* Signed confirmation banner */}
                        <div className="agr-signed-banner">
                            <span className="agr-signed-banner__icon" aria-hidden="true">✅</span>
                            <div className="agr-signed-banner__body">
                                <strong>Agreement Accepted</strong>
                                <span>
                                    {new Date(acceptance.accepted_at).toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </span>
                            </div>
                            <div className="agr-signed-banner__meta">
                                <MethodBadge otpVerified={acceptance.otp_verified} />
                            </div>
                        </div>

                        {/* Signature metadata block */}
                        <div className="agr-sig-block">
                            {[
                                ['Signed By', acceptance.user_email || booking?.customer?.email || '—'],
                                ['Booking', acceptance.booking_ref || booking?.booking_ref || '—'],
                                ['Agreement', version.version_tag],
                                ['Date & Time', acceptance.accepted_at
                                    ? new Date(acceptance.accepted_at).toLocaleString('en-IN')
                                    : '—'],
                                ['IP Address', acceptance.ip_address || '—'],
                            ].map(([label, value]) => (
                                <div key={label} className="agr-sig-block__row">
                                    <span>{label}</span>
                                    <strong
                                        style={{
                                            fontFamily:
                                                label === 'Agreement' || label === 'IP Address'
                                                    ? 'DM Mono, monospace'
                                                    : 'inherit',
                                        }}
                                    >
                                        {value}
                                    </strong>
                                </div>
                            ))}
                        </div>

                        {/* Full content */}
                        <div className="agr-modal__body agr-modal__body--scroll">
                            <AgreementContent content={version.content} />
                        </div>
                    </>
                )}

                <div className="agr-modal__foot">
                    <button className="agr-btn agr-btn--ghost" onClick={onClose}>
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORY TAB
// Shows the customer's full acceptance history (used inside CustomerDashboard
// under the "agreements" sidebar tab).
// ══════════════════════════════════════════════════════════════════════════
export function AgreementHistoryTab() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewAcceptance, setViewAcceptance] = useState(null);

    useEffect(() => {
        getMyAgreementHistory()
            .then(({ data }) => setHistory(data.results || data))
            .catch(e => setError(e.response?.data?.detail || 'Could not load history.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="agr-history-loading">
                <Spinner />
                <span>Loading history…</span>
            </div>
        );
    }

    if (error) {
        return <div className="agr-error">⚠ {error}</div>;
    }

    if (history.length === 0) {
        return (
            <div className="agr-history-empty">
                <span style={{ fontSize: 36 }} aria-hidden="true">📄</span>
                <p>No agreement signatures yet.</p>
                <p style={{ fontSize: 12, opacity: 0.6 }}>
                    Signed agreements will appear here after you confirm a booking.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="agr-history">
                <div className="agr-history__head">
                    <h3>Agreement Signature History</h3>
                    <p>{history.length} record{history.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="agr-history__list">
                    {history.map(acc => (
                        <div key={acc.id} className="agr-history__item">
                            <div className="agr-history__item-left">
                                <span className="agr-history__item-version">
                                    {acc.version_tag}
                                </span>
                                <span className="agr-history__item-title">
                                    {acc.version_title}
                                </span>
                                {acc.booking_ref && (
                                    <span className="agr-history__item-booking">
                                        Booking: <span>{acc.booking_ref}</span>
                                    </span>
                                )}
                            </div>
                            <div className="agr-history__item-right">
                                <span className="agr-history__item-date">
                                    {new Date(acc.accepted_at).toLocaleDateString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                    })}
                                </span>
                                <span className="agr-history__item-time">
                                    {new Date(acc.accepted_at).toLocaleTimeString('en-IN', {
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </span>
                                <MethodBadge otpVerified={acc.otp_verified} />
                                <button
                                    className="agr-btn agr-btn--ghost agr-btn--sm"
                                    onClick={() => setViewAcceptance(acc)}
                                >
                                    View
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {viewAcceptance && (
                <AgreementViewModal
                    acceptance={viewAcceptance}
                    onClose={() => setViewAcceptance(null)}
                />
            )}
        </>
    );
}