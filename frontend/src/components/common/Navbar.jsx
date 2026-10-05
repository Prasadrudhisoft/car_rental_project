import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SearchWidget from '../home/SearchWidget';
import NotificationBell from '../notifications/NotificationBell';
import './Navbar.css';

/* ── Sidebar icon items ───────────────────────────────────────────────── */
const ICONS = {
    overview: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
        </svg>
    ),
    vehicles: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-5a1 1 0 0 1 1-1h1zm2.2-4L6 11h12l-1.2-4H7.2zM7 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
        </svg>
    ),
    bookings: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 6H5v12h14V8z" />
        </svg>
    ),
    users: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 3-1.79 3-4s-1.34-4-3-4-3 1.79-3 4 1.34 4 3 4zM8 11c1.66 0 3-1.79 3-4S9.66 3 8 3 5 4.79 5 7s1.34 4 3 4zm0 2c-2.67 0-8 1.34-8 4v3h10v-3c0-2.66-5.33-4-8-4zm8 0c-.29 0-.62.02-.97.05C16.16 13.86 18 15.03 18 17v3h6v-3c0-2.66-5.33-4-8-4z" />
        </svg>
    ),
    locations: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
        </svg>
    ),
    logistics: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5S5.17 15.5 6 15.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
    ),
    config: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94a7.97 7.97 0 0 0 .06-.94 7.97 7.97 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.16a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.51.42 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z" />
        </svg>
    ),
    promos: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.79 2.2 3.2 11.79a1 1 0 0 0 0 1.41l7.6 7.6a1 1 0 0 0 1.41 0l9.6-9.6a1 1 0 0 0 .29-.7V4a2 2 0 0 0-2-2h-6.5a1 1 0 0 0-.71.2zM17.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
    ),
    agreements: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-5 4h8v2H8v-2zm0 4h5v2H8v-2z" />
        </svg>
    ),
    /* assignments icon — person with link/chain */
    assignments: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
    ),
    network: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="3" />
            <circle cx="5" cy="19" r="3" />
            <circle cx="19" cy="19" r="3" />
            <path d="M12 8v4M8.5 17.5l-1.5-1.5M15.5 17.5l1.5-1.5M10 12l-3 4M14 12l3 4"
                  stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
    ),
    profile: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.76 0 5-2.69 5-6s-2.24-6-5-6-5 2.69-5 6 2.24 6 5 6zm0 2c-4.33 0-8 2.17-8 5v3h16v-3c0-2.83-3.67-5-8-5z" />
        </svg>
    ),
    calendarIcon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 6H5v12h14V8z" />
        </svg>
    ),
    starIcon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
    ),
    myReviewsIcon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h3l3 3 3-3h7a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-8 12l-2.5-1.5L7 14l.7-2.8L5.5 9.5l2.9-.2L9.5 7l1.1 2.3 2.9.2-2.2 1.7.7 2.8z" />
        </svg>
    ),
    loyaltyIcon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-4h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z" />
        </svg>
    ),
    historyIcon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm-1 5v5.41l3.29 3.3 1.42-1.42L14 12.59V8h-2z" />
        </svg>
    ),
    inspections: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 2a8 8 0 1 1-5.29 14.29L2 19l2.71-2.71A8 8 0 0 1 10 2zm1 5H9v4l3.5 2.1 1-1.65-2.5-1.45V7z" />
        </svg>
    ),
    handovers: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 7h11v2H7V7zm0 4h7v2H7v-2zm0 4h11v2H7v-2z" />
        </svg>
    ),
    notifications: (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
};

/* ── Sidebar items per role ──────────────────────────────────────────────── */
const SIDEBAR_ITEMS = {
    admin: [
        { id: 'overview',     icon: ICONS.overview,     tip: 'Overview' },
        { id: 'vendors',      icon: ICONS.network,      tip: 'Vendors' },
        { id: 'vehicles',     icon: ICONS.vehicles,     tip: 'Vehicles' },
        { id: 'bookings',     icon: ICONS.bookings,     tip: 'Bookings' },
        { id: 'users',        icon: ICONS.users,        tip: 'Users' },
        { id: 'locations',    icon: ICONS.locations,    tip: 'Locations' },
        { id: 'logistics',    icon: ICONS.logistics,    tip: 'Logistics' },
        { id: 'config',       icon: ICONS.config,       tip: 'Config' },
        { id: 'promos',       icon: ICONS.promos,       tip: 'Promos' },
        { id: 'agreements',   icon: ICONS.agreements,   tip: 'Agreements' },
        { id: 'reviews',      icon: ICONS.starIcon,     tip: 'Reviews' },
        { id: 'assignments',  icon: ICONS.assignments,  tip: 'Assignments' },
        { id: 'notifications',icon: ICONS.notifications,tip: 'Notifications' },
        { id: 'personalization', icon: ICONS.config, tip: 'Personalization' },
        
    ],
    vendor: [
        { id: 'overview',  icon: ICONS.overview,   tip: 'Overview' },
        { id: 'bookings',  icon: ICONS.bookings,   tip: 'Bookings' },
        { id: 'fleet',     icon: ICONS.vehicles,   tip: 'Fleet' },
        { id: 'handovers', icon: ICONS.handovers,  tip: 'Handovers' },
        { id: 'network',   icon: ICONS.network,    tip: 'Network' },
        { id: 'reviews',   icon: ICONS.starIcon,   tip: 'Reviews' },
        { id: 'notifications', icon: ICONS.notifications, tip: 'Notifications' },
        { id: 'profile',   icon: ICONS.profile,    tip: 'Profile & KYC' },
    ],
    customer: [
        { id: 'bookings',   icon: ICONS.calendarIcon,  tip: 'My Bookings' },
        { id: 'reviews',    icon: ICONS.starIcon,       tip: 'Write a Review' },
        { id: 'my-reviews', icon: ICONS.myReviewsIcon,  tip: 'My Reviews' },
        { id: 'loyalty',    icon: ICONS.loyaltyIcon,    tip: 'Loyalty Rewards' },
        { id: 'notifications', icon: ICONS.notifications, tip: 'Notifications' },
        { id: 'profile',    icon: ICONS.profile,        tip: 'Profile & KYC' },
    ],
};

/* ── Sidebar ────────────────────────────────────────────────────────────── */
export function Sidebar({ activeTab, onTabChange }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const role  = user?.role || 'customer';
    const items = SIDEBAR_ITEMS[role] || [];
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const initials     = (user?.full_name || user?.email || 'U')
        .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const fullNameCaps = (user?.full_name || user?.email || 'USER').toUpperCase();

    return (
        <>
            <button
                className="sidebar__hamburger"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Toggle menu"
            >
                <span className={`sidebar__hamburger-icon${mobileOpen ? ' open' : ''}`} />
            </button>
            {mobileOpen && (
                <div className="sidebar__overlay" onClick={() => setMobileOpen(false)} />
            )}
            <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
                <Link
                    to={user
                        ? (user.role === 'admin'   ? '/admin'
                         : user.role === 'vendor'  ? '/vendor'
                         : '/customer')
                        : '/'}
                    className="sidebar__brand"
                >
                    ⬡
                </Link>
                <nav className="sidebar__nav">
                    {items.map(item => (
                        <button
                            key={item.id}
                            className={`sidebar__item${activeTab === item.id ? ' sidebar__item--active' : ''}`}
                            onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                            data-tip={item.tip}
                        >
                            {item.icon}
                        </button>
                    ))}
                </nav>
                <div className="sidebar__bottom">
                    <div
                        className="sidebar__avatar"
                        title={`${user?.full_name || 'Profile'} — Sign out`}
                        onClick={handleLogout}
                    >
                        <span className="avatar-initials">{initials}</span>
                        <span className="avatar-full">{fullNameCaps} LOGOUT</span>
                    </div>
                </div>
            </aside>
        </>
    );
}

/* ── Top Navbar ─────────────────────────────────────────────────────────── */
export default function Navbar({ onLoginClick, breadcrumb, hideLogo = false }) {
    const { user, logout } = useAuth();
    const navigate  = useNavigate();
    const location  = useLocation();
    const [scrolled,          setScrolled]          = useState(false);
    const [dropdownOpen,      setDropdownOpen]      = useState(false);
    const [showBookingWidget, setShowBookingWidget] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => { setShowBookingWidget(false); }, [location.pathname]);

    /* ── Snowflake canvas effect ── */
    useEffect(() => {
        const navbar = document.querySelector('.navbar');
        if (!navbar || navbar.querySelector('.snow-canvas')) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'snow-canvas';
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
        navbar.prepend(canvas);
        const ctx   = canvas.getContext('2d');
        const COUNT = 60;
        let flakes  = [], raf;
        const resize = () => { canvas.width = navbar.offsetWidth; canvas.height = navbar.offsetHeight; };
        const init   = () => {
            flakes = Array.from({ length: COUNT }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.6 + 0.2,
                drift: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.4 + 0.08,
            }));
        };
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const f of flakes) {
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${f.opacity})`;
                ctx.fill();
                f.y += f.speed; f.x += f.drift;
                if (f.y > canvas.height + f.r) { f.y = -f.r; f.x = Math.random() * canvas.width; }
                if (f.x > canvas.width  + f.r) f.x = -f.r;
                if (f.x < -f.r)                f.x = canvas.width + f.r;
            }
            raf = requestAnimationFrame(draw);
        };
        resize(); init(); draw();
        window.addEventListener('resize', () => { resize(); init(); });
        return () => { cancelAnimationFrame(raf); canvas.remove(); };
    }, []);

    const handleLogout = async () => {
        await logout();
        setDropdownOpen(false);
        navigate('/');
    };

    const dashboardPath = user
        ? user.role === 'admin'  ? '/admin'
        : user.role === 'vendor' ? '/vendor'
        : '/customer'
        : null;

    const handleLogoClick = (e) => {
        if (user && dashboardPath) { e.preventDefault(); navigate(dashboardPath); }
    };

    return (
        <>
            <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
                {breadcrumb ? (
                    <div className="navbar__breadcrumb">
                        {breadcrumb.map((crumb, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="navbar__breadcrumb-sep">/</span>}
                                {i < breadcrumb.length - 1
                                    ? <Link to={crumb.href || '#'}>{crumb.label}</Link>
                                    : <span className="navbar__breadcrumb-current">{crumb.label}</span>}
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <Link to="/" className="navbar__brand" onClick={handleLogoClick}>
                        {!hideLogo && <div className="navbar__brand-icon">⬡</div>}
                        <span className="navbar__brand-text">RudhiDrive</span>
                    </Link>
                )}

                <div className="navbar__right">
                    {user && <NotificationBell />}
                    {user ? (
                        <button className="navbar__booking-btn" onClick={() => setShowBookingWidget(v => !v)} title="Book a car">
                            <span aria-hidden="true">🚗</span>
                            <span className="navbar__booking-label">Booking</span>
                        </button>
                    ) : (
                        <button
                            style={{ background:'var(--c-teal)', color:'#fff', border:'none', padding:'8px 20px', borderRadius:'var(--r-full)', fontSize:'13px', fontWeight:'600', cursor:'pointer', transition:'background 0.18s', fontFamily:'var(--font-body)' }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--c-teal-dark)'}
                            onMouseOut={e  => e.currentTarget.style.background = 'var(--c-teal)'}
                            onClick={onLoginClick}
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </nav>

            {showBookingWidget && user && (
                <div
                    className="navbar__booking-overlay"
                    onClick={e => { if (e.target === e.currentTarget) setShowBookingWidget(false); }}
                >
                    <div className="navbar__booking-panel">
                        <div className="navbar__booking-panel-header">
                            <span>Book a Car</span>
                            <button className="navbar__booking-close" onClick={() => setShowBookingWidget(false)}>✕</button>
                        </div>
                        <SearchWidget onSearchComplete={() => setShowBookingWidget(false)} />
                    </div>
                </div>
            )}
        </>
    );
}