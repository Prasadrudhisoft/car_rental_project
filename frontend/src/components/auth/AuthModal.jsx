import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { registerCustomer, registerVendor } from '../../services/api';
import './AuthModal.css';

// ── Mini components ────────────────────────────────────────
const InputField = ({
    label,
    icon,
    type = 'text',
    value,
    onChange,
    placeholder,
    required,
    autoComplete
}) => {
    const [focused, setFocused] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const isPw = type === 'password';

    return (
        <div className={`am-field${focused ? ' am-field--focused' : ''}${value ? ' am-field--filled' : ''}`}>
            {icon && <span className="am-field__icon">{icon}</span>}

            <div className="am-field__wrap">
                <label className="am-field__label">{label}</label>
                <input
                    className="am-field__input"
                    type={isPw && showPw ? 'text' : type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    autoComplete={autoComplete}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                />
            </div>

            {isPw && (
                <button
                    type="button"
                    className="am-field__toggle"
                    onClick={() => setShowPw(s => !s)}
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                    {showPw ? eyeOffIcon : eyeIcon}
                </button>
            )}
        </div>
    );
};

// ── Main Modal ─────────────────────────────────────────────
export default function AuthModal({ onClose, onSuccess }) {
    const { login } = useAuth();

    const [view, setView] = useState('login'); // login | customer | vendor
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loginRole, setLoginRole] = useState('');

    const [form, setForm] = useState({
        email: '',
        password: '',
        password2: '',
        full_name: '',
        phone: '',
        business_name: '',
        gstin: '',
    });

    const backdropRef = useRef(null);

    const s = k => e =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    // Trap focus / ESC close
    useEffect(() => {
        const onKey = e => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Reset error and success on tab change
    useEffect(() => {
        setError('');
        setSuccess('');
    }, [view]);

    // ── Login ──────────────────────────────────────────────
    const handleLogin = async e => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await login(form.email, form.password, loginRole);

            setSuccess('Signed in!');

            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 500);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                'Invalid email or password.'
            );
        } finally {
            setLoading(false);
        }
    };

    // ── Customer registration ──────────────────────────────
    const handleCustomer = async e => {
        e.preventDefault();

        if (form.password !== form.password2) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await registerCustomer({
                email: form.email,
                password: form.password,
                password2: form.password2,
                full_name: form.full_name,
                phone: form.phone,
            });

            await login(form.email, form.password, 'customer');

            setSuccess('Account created!');

            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 500);
        } catch (err) {
            const d = err.response?.data;

            setError(
                typeof d === 'object' && d !== null
                    ? Object.values(d).flat().join(' ')
                    : 'Registration failed.'
            );
        } finally {
            setLoading(false);
        }
    };

    // ── Vendor registration ────────────────────────────────
    const handleVendor = async e => {
        e.preventDefault();

        if (form.password !== form.password2) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await registerVendor({
                email: form.email,
                password: form.password,
                password2: form.password2,
                full_name: form.full_name,
                phone: form.phone,
                business_name: form.business_name,
                gstin: form.gstin,
            });

            await login(form.email, form.password, 'vendor');

            setSuccess('Vendor account created!');

            setTimeout(() => {
                onClose();
            }, 600);
        } catch (err) {
            const d = err.response?.data;

            setError(
                typeof d === 'object' && d !== null
                    ? Object.values(d).flat().join(' ')
                    : 'Registration failed.'
            );
        } finally {
            setLoading(false);
        }
    };

    // ── Panel copy ─────────────────────────────────────────
    const PANEL_COPY = {
        login: {
            title: 'Welcome back.',
            sub: 'Sign in to manage your bookings, loyalty points, and profile.',
            cta: 'New here? Create a free account →',
            cta_view: 'customer',
        },
        customer: {
            title: 'Join RudhiDrive.',
            sub: 'Book certified vehicles from verified vendors across Maharashtra.',
            cta: 'Already have an account? Sign in →',
            cta_view: 'login',
        },
        vendor: {
            title: 'List your fleet.',
            sub: 'Reach thousands of customers and grow your rental business.',
            cta: 'Already a vendor? Sign in →',
            cta_view: 'login',
        },
    };

    const copy = PANEL_COPY[view];

    return (
        <div
            className="am-backdrop"
            ref={backdropRef}
            onMouseDown={e =>
                e.target === backdropRef.current && onClose()
            }
        >
            <div className="am-modal" role="dialog" aria-modal="true">

                {/* ── Left: Brand panel ── */}
                <div className="am-panel">
                    <div className="am-panel__bg">
                        <div className="am-panel__orb am-panel__orb--1" />
                        <div className="am-panel__orb am-panel__orb--2" />
                        <div className="am-panel__grid" />
                    </div>

                    <div className="am-panel__content">
                        <a href="/" className="am-panel__logo">
                            <span className="am-panel__logo-icon">⬡</span>
                            <span className="am-panel__logo-text">
                                RudhiDrive
                            </span>
                        </a>

                        <div className="am-panel__copy">
                            <h2 className="am-panel__title">
                                {copy.title}
                            </h2>
                            <p className="am-panel__sub">
                                {copy.sub}
                            </p>
                        </div>

                        {/* Feature pills */}
                        <div className="am-panel__pills">
                            {[
                                ['🛡️', 'Verified vendors'],
                                ['📱', 'OTP sign-offs'],
                                ['⭐', 'Loyalty rewards'],
                                ['🔄', 'One-way returns'],
                            ].map(([icon, label]) => (
                                <div
                                    key={label}
                                    className="am-panel__pill"
                                >
                                    <span>{icon}</span>
                                    {label}
                                </div>
                            ))}
                        </div>

                        <button
                            className="am-panel__switch"
                            type="button"
                            onClick={() => setView(copy.cta_view)}
                        >
                            {copy.cta}
                        </button>
                    </div>
                </div>

                {/* ── Right: Form panel ── */}
                <div className="am-form-panel">
                    <button
                        className="am-close"
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            width="14"
                            height="14"
                        >
                            <path
                                d="M18 6L6 18M6 6l12 12"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>

                    {/* Tab switcher */}
                    <div className="am-tabs">
                        {[
                            ['login', 'Sign In'],
                            ['customer', 'Customer'],
                            ['vendor', 'Vendor'],
                        ].map(([v, l]) => (
                            <button
                                key={v}
                                className={`am-tab${view === v ? ' am-tab--active' : ''}`}
                                onClick={() => setView(v)}
                                type="button"
                            >
                                {l}
                            </button>
                        ))}
                    </div>

                    {/* Header */}
                    <div className="am-form-header">
                        <h3 className="am-form-title">
                            {view === 'login'
                                ? 'Sign in to continue'
                                : view === 'customer'
                                    ? 'Create your account'
                                    : 'Register as vendor'}
                        </h3>
                    </div>

                    {/* Error / success */}
                    {error && (
                        <div className="am-alert am-alert--error">
                            {errorIcon} {error}
                        </div>
                    )}

                    {success && (
                        <div className="am-alert am-alert--success">
                            {checkIcon} {success}
                        </div>
                    )}

                    {/* ── Login form ── */}
                    {view === 'login' && (
                        <form
                            onSubmit={handleLogin}
                            className="am-form"
                            autoComplete="on"
                        >
                            <InputField
                                label="Email address"
                                icon={mailIcon}
                                type="email"
                                value={form.email}
                                onChange={s('email')}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />

                            <InputField
                                label="Password"
                                icon={lockIcon}
                                type="password"
                                value={form.password}
                                onChange={s('password')}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />

                            {/* Role selector */}
                            <div
                                className="am-role-pick"
                                role="group"
                                aria-label="Sign in as"
                            >
                                {[
                                    ['', 'Auto'],
                                    ['customer', 'Customer'],
                                    ['vendor', 'Vendor'],
                                    ['admin', 'Admin'],
                                ].map(([v, l]) => (
                                    <button
                                        key={v || 'auto'}
                                        type="button"
                                        className={
                                            loginRole === v ? 'active' : ''
                                        }
                                        aria-pressed={loginRole === v}
                                        onClick={() => setLoginRole(v)}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="submit"
                                className="am-submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="am-spinner" />
                                        {' '}Signing in…
                                    </>
                                ) : (
                                    'Sign In →'
                                )}
                            </button>

                            <p className="am-form-footer">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    className="am-link"
                                    onClick={() => setView('customer')}
                                >
                                    Create one free
                                </button>
                            </p>
                        </form>
                    )}

                    {/* ── Customer register ── */}
                    {view === 'customer' && (
                        <form
                            onSubmit={handleCustomer}
                            className="am-form"
                            autoComplete="on"
                        >
                            <InputField
                                label="Full Name"
                                icon={userIcon}
                                value={form.full_name}
                                onChange={s('full_name')}
                                placeholder="Arjun Mehta"
                                required
                                autoComplete="name"
                            />

                            <InputField
                                label="Email address"
                                icon={mailIcon}
                                type="email"
                                value={form.email}
                                onChange={s('email')}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />

                            <InputField
                                label="Phone Number"
                                icon={phoneIcon}
                                type="tel"
                                value={form.phone}
                                onChange={s('phone')}
                                placeholder="+91 98765 43210"
                                required
                                autoComplete="tel"
                            />

                            <InputField
                                label="Password"
                                icon={lockIcon}
                                type="password"
                                value={form.password}
                                onChange={s('password')}
                                placeholder="Min. 8 characters"
                                required
                                autoComplete="new-password"
                            />

                            <InputField
                                label="Confirm Password"
                                icon={lockIcon}
                                type="password"
                                value={form.password2}
                                onChange={s('password2')}
                                placeholder="Repeat password"
                                required
                                autoComplete="new-password"
                            />

                            <button
                                type="submit"
                                className="am-submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="am-spinner" />
                                        {' '}Creating…
                                    </>
                                ) : (
                                    'Create Account →'
                                )}
                            </button>

                            <p className="am-form-footer">
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    className="am-link"
                                    onClick={() => setView('login')}
                                >
                                    Sign in
                                </button>
                            </p>
                        </form>
                    )}

                    {/* ── Vendor register ── */}
                    {view === 'vendor' && (
                        <form
                            onSubmit={handleVendor}
                            className="am-form"
                            autoComplete="on"
                        >
                            <InputField
                                label="Owner Full Name"
                                icon={userIcon}
                                value={form.full_name}
                                onChange={s('full_name')}
                                placeholder="Rahul Sharma"
                                required
                                autoComplete="name"
                            />

                            <InputField
                                label="Business Name"
                                icon={buildingIcon}
                                value={form.business_name}
                                onChange={s('business_name')}
                                placeholder="Sharma Car Rentals"
                                required
                            />

                            <InputField
                                label="Email address"
                                icon={mailIcon}
                                type="email"
                                value={form.email}
                                onChange={s('email')}
                                placeholder="business@example.com"
                                required
                                autoComplete="email"
                            />

                            <InputField
                                label="Phone Number"
                                icon={phoneIcon}
                                type="tel"
                                value={form.phone}
                                onChange={s('phone')}
                                placeholder="+91 98765 43210"
                                required
                                autoComplete="tel"
                            />

                            <InputField
                                label="GSTIN"
                                icon={tagIcon}
                                value={form.gstin}
                                onChange={s('gstin')}
                                placeholder="22AAAAA0000A1Z5"
                            />

                            <InputField
                                label="Password"
                                icon={lockIcon}
                                type="password"
                                value={form.password}
                                onChange={s('password')}
                                placeholder="Min. 8 characters"
                                required
                                autoComplete="new-password"
                            />

                            <InputField
                                label="Confirm Password"
                                icon={lockIcon}
                                type="password"
                                value={form.password2}
                                onChange={s('password2')}
                                placeholder="Repeat password"
                                required
                                autoComplete="new-password"
                            />

                            <button
                                type="submit"
                                className="am-submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="am-spinner" />
                                        {' '}Registering…
                                    </>
                                ) : (
                                    'Register as Vendor →'
                                )}
                            </button>

                            <p className="am-form-footer">
                                Already registered?{' '}
                                <button
                                    type="button"
                                    className="am-link"
                                    onClick={() => setView('login')}
                                >
                                    Sign in
                                </button>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── SVG icon constants ─────────────────────────────────────
const mailIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 7L2 7" />
    </svg>
);

const lockIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const userIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
);

const phoneIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45 12.8 12.8 0 0 0 2.8.7A2 2 0 0 1 22 16.9z" />
    </svg>
);

const buildingIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="2" y="7" width="20" height="15" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-4 0v2M8 21v-8M12 21v-8M16 21v-8" />
    </svg>
);

const tagIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <circle cx="7" cy="7" r="1" />
    </svg>
);

const eyeIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const eyeOffIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

const errorIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        width="14"
        height="14"
        style={{ flexShrink: 0 }}
    >
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
);

const checkIcon = (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        width="14"
        height="14"
        style={{ flexShrink: 0 }}
    >
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
);
