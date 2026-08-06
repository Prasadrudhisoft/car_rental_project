import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    getActiveAgreement,
    getAgreementVersion,
    getMyAgreementHistory,
    signAgreement,
} from '../../services/api';
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

// ══════════════════════════════════════════════════════════════════════════
// SIGN MODAL
// Opens when a customer clicks "View & Sign Agreement" on a booking.
// 1. Fetches active version from backend
// 2. Displays T&C (must scroll to bottom to enable signing)
// 3. OTP send → OTP verify → create acceptance record on backend
// ══════════════════════════════════════════════════════════════════════════
export function AgreementSignModal({ booking, onSigned, onClose, showToast }) {
    // phase: loading | error | reading | otp_pending | done
    const [phase, setPhase] = useState('loading');
    const [version, setVersion] = useState(null);
    const [error, setError] = useState('');
    const [scrolled, setScrolled] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpBusy, setOtpBusy] = useState(false);
    const bodyRef = useRef(null);
    const otpInputRef = useRef(null);

    // Fetch active version on mount
    useEffect(() => {
        getActiveAgreement()
            .then(({ data }) => {
                setVersion(data);
                setPhase('reading');
            })
            .catch(err => {
                setError(err.response?.data?.error ||
                    'Could not load the agreement. Please try again.');
                setPhase('error');
            });
    }, []);

    // Auto-focus OTP input when phase changes
    useEffect(() => {
        if (phase === 'otp_pending' && otpInputRef.current) {
            setTimeout(() => otpInputRef.current?.focus(), 50);
        }
    }, [phase]);

    // Detect scroll-to-bottom
    const handleScroll = useCallback(() => {
        const el = bodyRef.current;
        if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
            setScrolled(true);
        }
    }, []);

    // Step 1 — send OTP
    const handleSendOtp = useCallback(async () => {
        setOtpBusy(true);
        try {
            const { data } = await signAgreement(booking.id, 'send', null);
            // Version mismatch guard: if the active version changed since we
            // loaded the modal, reload it so the user sees the correct content.
            if (data.version_id && version && data.version_id !== version.id) {
                showToast('The agreement was just updated. Please review again.', 'error');
                setScrolled(false);
                setPhase('loading');
                getActiveAgreement().then(({ data: v }) => {
                    setVersion(v);
                    setPhase('reading');
                });
                setOtpBusy(false);
                return;
            }
            setPhase('otp_pending');
            showToast('OTP sent to your registered email.');
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to send OTP.', 'error');
        } finally {
            setOtpBusy(false);
        }
    }, [booking.id, version, showToast]);

    // Step 2 — verify OTP (backend creates the acceptance record)
    const handleVerifyOtp = useCallback(async () => {
        if (otpCode.length !== 6) {
            showToast('Please enter the 6-digit OTP.', 'error');
            return;
        }
        setOtpBusy(true);
        try {
            const { data } = await signAgreement(
                booking.id, 'verify', otpCode, version?.id
            );
            setPhase('done');
            showToast(`Agreement signed! (${data.version_tag})`);
            onSigned?.({
                versionTag: data.version_tag,
                versionId: data.version_id,
                acceptanceId: data.acceptance_id,
                acceptedAt: data.accepted_at,
            });
        } catch (e) {
            showToast(e.response?.data?.error || 'Invalid OTP. Please try again.', 'error');
        } finally {
            setOtpBusy(false);
        }
    }, [booking.id, otpCode, version, showToast, onSigned]);

    const handleOtpKeyDown = (e) => {
        if (e.key === 'Enter') handleVerifyOtp();
    };

    return (
        <div
            className="agr-backdrop"
            onClick={e => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-label="Rental Agreement"
        >
            <div className="agr-modal">

                {/* Header */}
                <div className="agr-modal__head">
                    <div className="agr-modal__head-left">
                        <span className="agr-modal__icon" aria-hidden="true">📄</span>
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

                {/* Loading */}
                {phase === 'loading' && (
                    <div className="agr-modal__body agr-modal__body--center">
                        <Spinner size={28} />
                        <span className="agr-loading-text">Loading agreement…</span>
                    </div>
                )}

                {/* Error */}
                {phase === 'error' && (
                    <div className="agr-modal__body agr-modal__body--center">
                        <div className="agr-error">⚠ {error}</div>
                        <button
                            className="agr-btn agr-btn--primary"
                            onClick={() => window.location.reload()}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Reading / OTP pending */}
                {(phase === 'reading' || phase === 'otp_pending') && version && (
                    <>
                        {/* Summary strip */}
                        {version.summary && (
                            <div className="agr-summary">
                                <span className="agr-summary__icon" aria-hidden="true">💡</span>
                                <p>{version.summary}</p>
                            </div>
                        )}

                        {/* Effective date */}
                        <div className="agr-effective-bar">
                            <span>📅 Effective from</span>
                            <strong>
                                {new Date(version.effective_from).toLocaleDateString('en-IN', {
                                    day: '2-digit', month: 'long', year: 'numeric',
                                })}
                            </strong>
                        </div>

                        {/* Scrollable content */}
                        <div
                            className="agr-modal__body agr-modal__body--scroll"
                            ref={bodyRef}
                            onScroll={handleScroll}
                        >
                            <AgreementContent content={version.content} />
                        </div>

                        {/* Scroll nudge */}
                        {!scrolled && (
                            <div className="agr-scroll-hint" role="status">
                                <span aria-hidden="true">↓</span>
                                Please scroll through the entire agreement before signing
                            </div>
                        )}

                        {/* OTP input */}
                        {phase === 'otp_pending' && (
                            <div className="agr-otp-bar">
                                <div className="agr-otp-bar__label">
                                    <span aria-hidden="true">🔐</span>
                                    Enter the OTP sent to your registered email
                                </div>
                                <div className="agr-otp-bar__inputs">
                                    <input
                                        ref={otpInputRef}
                                        className="agr-otp-input"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="● ● ● ● ● ●"
                                        value={otpCode}
                                        onChange={e =>
                                            setOtpCode(
                                                e.target.value.replace(/\D/g, '').slice(0, 6)
                                            )
                                        }
                                        onKeyDown={handleOtpKeyDown}
                                        aria-label="OTP code"
                                    />
                                    <button
                                        className="agr-btn agr-btn--ghost agr-btn--sm"
                                        onClick={handleSendOtp}
                                        disabled={otpBusy}
                                    >
                                        Resend
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="agr-modal__foot">
                            <button className="agr-btn agr-btn--ghost" onClick={onClose}>
                                Cancel
                            </button>

                            {phase === 'reading' ? (
                                <button
                                    className={`agr-btn agr-btn--primary${!scrolled ? ' agr-btn--disabled' : ''}`}
                                    onClick={handleSendOtp}
                                    disabled={!scrolled || otpBusy}
                                    title={!scrolled
                                        ? 'Scroll to the bottom to enable signing'
                                        : undefined}
                                >
                                    {otpBusy && <Spinner size={14} />}
                                    {otpBusy ? 'Sending OTP…' : '✓ I Accept — Send OTP to Sign'}
                                </button>
                            ) : (
                                <button
                                    className="agr-btn agr-btn--primary"
                                    onClick={handleVerifyOtp}
                                    disabled={otpCode.length !== 6 || otpBusy}
                                >
                                    {otpBusy && <Spinner size={14} />}
                                    {otpBusy ? 'Signing…' : 'Verify OTP & Sign Agreement'}
                                </button>
                            )}
                        </div>
                    </>
                )}

                {/* Success screen */}
                {phase === 'done' && (
                    <div className="agr-modal__body agr-modal__body--center">
                        <div className="agr-success-icon" aria-hidden="true">✅</div>
                        <h3 className="agr-success-title">Agreement Signed!</h3>
                        <p className="agr-success-sub">
                            Your digital signature has been recorded. You can view
                            the signed agreement from your booking details at any time.
                        </p>
                        {version && (
                            <VersionBadge
                                versionTag={version.version_tag}
                                isActive={version.is_active}
                            />
                        )}
                        <button
                            className="agr-btn agr-btn--primary"
                            onClick={onClose}
                        >
                            Continue
                        </button>
                    </div>
                )}

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
                            <h2 className="agr-modal__title">Signed Agreement</h2>
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
                                <strong>Digitally Signed</strong>
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