import React, { useState, useEffect, useCallback } from 'react';
import {
    getAdminStats, getAdminAnalytics, getAdminVendors, adminVendorAction,
    getAdminVehicles, getAdminVehicleStats, reviewDoc, certifyVehicle,
    blacklistVehicle, vahanCheck, getAdminBookings, getAdminUsers,
    getConfigSettings, updateConfigSetting, getSegmentConfigs, updateSegmentConfig,
    getLocations, createLocation, deleteLocation, getCities, createCity, deleteCity,
    getCityPairFees, createCityPairFee, deleteCityPairFee,
    getAdminPromos, createPromo, deletePromo,
    getReturnPoints, createReturnPoint, deleteReturnPoint,
    getAdminLogisticsOverview, getAdminLogisticsStats, getAdminNetworkList,
    getAdminAgreementVersions, createAgreementVersion, updateAgreementVersion,
    activateAgreementVersion, getAdminAcceptances,
} from '../services/api';
import { Sidebar } from '../components/common/Navbar';
import './AdminDashboard.css';

const VENDOR_STATUS_CLR = {
    approved:  { bg: '#D1FAE5', color: '#059669' },
    pending:   { bg: '#FEF3C7', color: '#D97706' },
    suspended: { bg: '#FEE2E2', color: '#EF4444' },
    rejected:  { bg: '#FEE2E2', color: '#B91C1C' },
};
const VEHICLE_STATUS_CLR = {
    LIVE:           { bg: '#D1FAE5', color: '#059669' },
    PENDING_DOCS:   { bg: '#FEF3C7', color: '#D97706' },
    DOCS_SUBMITTED: { bg: '#DBEAFE', color: '#1D4ED8' },
    ADMIN_APPROVED: { bg: '#EDE9FE', color: '#7C3AED' },
    CERTIFIED:      { bg: '#D1FAE5', color: '#059669' },
    INACTIVE:       { bg: '#FEE2E2', color: '#EF4444' },
};
const BOOKING_STATUS_CLR = {
    PENDING:   { bg: '#FEF3C7', color: '#D97706' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8' },
    ACTIVE:    { bg: '#D1FAE5', color: '#059669' },
    COMPLETED: { bg: '#F3F4F6', color: '#6B7280' },
    CANCELLED: { bg: '#FEE2E2', color: '#EF4444' },
};
const HANDOVER_STATUS_CLR = {
    EXPECTED:  { bg: '#FEF3C7', color: '#D97706' },
    RECEIVED:  { bg: '#DBEAFE', color: '#1D4ED8' },
    INSPECTED: { bg: '#EDE9FE', color: '#7C3AED' },
    HELD:      { bg: '#F3F4F6', color: '#6B7280' },
    SUBLISTED: { bg: '#D1FAE5', color: '#059669' },
    RETRIEVED: { bg: '#F3F4F6', color: '#9CA3AF' },
};

// ── Mini Components ──────────────────────────────────────────
function StatusBadge({ status, colorMap, size = 'md' }) {
    const s = colorMap?.[status] || { bg: '#F3F4F6', color: '#6B7280' };
    return (
        <span
            className={`admin-status-badge admin-status-badge--${size}`}
            style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}30` }}
        >
            {status?.replace(/_/g, ' ')}
        </span>
    );
}

function StatPill({ icon, value, label, accent }) {
    return (
        <div className="admin-stat-pill" style={accent ? { borderColor: accent } : {}}>
            <span className="admin-stat-pill__icon">{icon}</span>
            <div>
                <span className="admin-stat-pill__value" style={accent ? { color: accent } : {}}>{value ?? '—'}</span>
                <span className="admin-stat-pill__label">{label}</span>
            </div>
        </div>
    );
}

function SectionCard({ title, subtitle, children, action }) {
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

function EmptyState({ icon, message }) {
    return (
        <div className="admin-empty">
            <span style={{ fontSize: 30 }}>{icon}</span>
            <p>{message}</p>
        </div>
    );
}

function InlineForm({ fields, onSubmit, submitLabel = '+ Add', loading }) {
    const [vals, setVals] = useState(() =>
        Object.fromEntries(fields.map(f => [f.key, f.default || '']))
    );
    return (
        <form
            className="admin-inline-form"
            onSubmit={e => {
                e.preventDefault();
                onSubmit(vals);
                setVals(Object.fromEntries(fields.map(f => [f.key, f.default || ''])));
            }}
        >
            {fields.map(f => (
                <div key={f.key} className="admin-form-field">
                    <label>{f.label}</label>
                    {f.type === 'select' ? (
                        <select
                            value={vals[f.key]}
                            onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))}
                            required={f.required}
                        >
                            <option value="">Select {f.label}</option>
                            {f.options?.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={f.type || 'text'}
                            value={vals[f.key]}
                            step={f.step}
                            placeholder={f.placeholder}
                            onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))}
                            required={f.required}
                        />
                    )}
                </div>
            ))}
            <button type="submit" className="admin-form-submit" disabled={loading}>
                {loading ? '…' : submitLabel}
            </button>
        </form>
    );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function AdminDashboard() {
    const [tab, setTab] = useState('overview');

    // Shared state
    const [stats, setStats]         = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [vendors, setVendors]     = useState([]);
    const [vehicles, setVehicles]   = useState([]);
    const [bookings, setBookings]   = useState([]);
    const [users, setUsers]         = useState([]);
    const [configs, setConfigs]     = useState([]);
    const [segments, setSegments]   = useState([]);
    const [locations, setLocations] = useState([]);
    const [cities, setCities]       = useState([]);
    const [cityPairFees, setCityPairFees] = useState([]);
    const [promos, setPromos]       = useState([]);
    const [returnPoints, setReturnPoints] = useState([]);
    const [handovers, setHandovers] = useState([]);
    const [logisticsStats, setLogisticsStats] = useState(null);
    const [network, setNetwork]     = useState([]);
    const [vehicleStats, setVehicleStats] = useState(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // Agreements state
    const [agreements, setAgreements]             = useState([]);
    const [acceptances, setAcceptances]           = useState([]);
    const [showCreateForm, setShowCreateForm]     = useState(false);
    const [editingVersion, setEditingVersion]     = useState(null);
    const [acceptanceFilter, setAcceptanceFilter] = useState('');
    const [agreementFormLoading, setAgreementFormLoading] = useState(false);
    const [agreementForm, setAgreementForm]       = useState({
        version_tag: '', title: 'Rental Agreement – Terms & Conditions',
        summary: '', content: '', effective_from: '',
    });

    // Filter state
    const [vehicleFilter, setVehicleFilter]   = useState('DOCS_SUBMITTED');
    const [actionNotes, setActionNotes]       = useState({});
    const [docNotes, setDocNotes]             = useState({});
    const [certifyForms, setCertifyForms]     = useState({});
    const [blacklistReasons, setBlacklistReasons] = useState({});
    const [bookingFilter, setBookingFilter]   = useState('');
    const [userFilter, setUserFilter]         = useState('');
    const [searchQuery, setSearchQuery]       = useState('');

    const loadTab = useCallback(async (t) => {
        setLoading(true); setError('');
        try {
            if (t === 'overview') {
                const [s, a] = await Promise.all([getAdminStats(), getAdminAnalytics()]);
                setStats(s.data); setAnalytics(a.data);
            } else if (t === 'vendors') {
                const { data } = await getAdminVendors();
                setVendors(data.results || data);
            } else if (t === 'vehicles') {
                const [v, s] = await Promise.all([
                    getAdminVehicles(vehicleFilter || ''),
                    getAdminVehicleStats(),
                ]);
                setVehicles(v.data.results || v.data);
                setVehicleStats(s.data);
            } else if (t === 'bookings') {
                const { data } = await getAdminBookings();
                setBookings(data.results || data);
            } else if (t === 'users') {
                const { data } = await getAdminUsers();
                setUsers(data.results || data);
            } else if (t === 'config') {
                const [c, sg] = await Promise.all([getConfigSettings(), getSegmentConfigs()]);
                setConfigs(c.data.results || c.data);
                setSegments(sg.data.results || sg.data);
            } else if (t === 'locations') {
                const [l, c, cp] = await Promise.all([getLocations(), getCities(), getCityPairFees()]);
                setLocations(l.data.results || l.data);
                setCities(c.data.results || c.data);
                setCityPairFees(cp.data.results || cp.data);
            } else if (t === 'logistics') {
                const [h, ls, nw] = await Promise.all([
                    getAdminLogisticsOverview(),
                    getAdminLogisticsStats(),
                    getAdminNetworkList(),
                ]);
                setHandovers(h.data.results || h.data);
                setLogisticsStats(ls.data);
                setNetwork(nw.data.results || nw.data);
                const [rp, c] = await Promise.all([getReturnPoints(), getCities()]);
                setReturnPoints(rp.data.results || rp.data);
                setCities(c.data.results || c.data);
            } else if (t === 'promos') {
                const { data } = await getAdminPromos();
                setPromos(data.results || data);
            } else if (t === 'agreements') {
                const [av, ac] = await Promise.all([
                    getAdminAgreementVersions(),
                    getAdminAcceptances(),
                ]);
                setAgreements(av.data.results || av.data);
                setAcceptances(ac.data.results || ac.data);
            }
        } catch (e) {
            setError(`Failed to load ${t}: ${e.response?.data?.detail || e.message || 'Unknown error'}`);
        }
        setLoading(false);
    }, [vehicleFilter]);

    useEffect(() => {
        const banner = document.querySelector('.admin-dash__hero-banner');
        if (!banner || banner.querySelector('.snow-canvas')) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'snow-canvas';
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
        banner.prepend(canvas);
        const ctx = canvas.getContext('2d');
        let flakes = [], raf;
        const resize = () => { canvas.width = banner.offsetWidth; canvas.height = banner.offsetHeight; };
        const init   = () => {
            flakes = Array.from({ length: 80 }, () => ({
                x: Math.random() * canvas.width, y: Math.random() * canvas.height,
                r: Math.random() * 3 + 1, speed: Math.random() * 0.8 + 0.3,
                drift: (Math.random() - 0.5) * 0.4, opacity: Math.random() * 0.5 + 0.1,
            }));
        };
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const f of flakes) {
                ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${f.opacity})`; ctx.fill();
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

    useEffect(() => { loadTab(tab); }, [tab, loadTab]);
    useEffect(() => { if (tab === 'vehicles') loadTab('vehicles'); }, [vehicleFilter]);

    // ── Handlers ─────────────────────────────────────────────
    const handleVendorAction = async (id, action) => {
        try {
            await adminVendorAction(id, action, actionNotes[id] || '');
            const statusMap = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reinstate: 'approved' };
            setVendors(p => p.map(v => v.id === id ? { ...v, status: statusMap[action] || v.status } : v));
            setActionNotes(p => ({ ...p, [id]: '' }));
        } catch (e) { alert(e.response?.data?.error || 'Action failed.'); }
    };

    const handleDocReview = async (docId, action) => {
        try {
            await reviewDoc(docId, action, docNotes[docId] || '');
            setVehicles(p => p.map(v => ({
                ...v,
                documents: (v.documents || []).map(d => d.id === docId ? { ...d, status: action } : d),
            })));
            setDocNotes(p => ({ ...p, [docId]: '' }));
        } catch { alert('Review failed.'); }
    };

    const handleCertify = async (vehicleId) => {
        const f = certifyForms[vehicleId] || {};
        if (!f.cert_date || !f.odometer_at_cert) { alert('Cert date and odometer required.'); return; }
        const fd = new FormData();
        fd.append('cert_date', f.cert_date);
        fd.append('odometer_at_cert', f.odometer_at_cert);
        if (f.file) fd.append('file', f.file);
        try {
            await certifyVehicle(vehicleId, fd);
            await loadTab('vehicles');
            alert('Vehicle certified → LIVE!');
        } catch (e) { alert(e.response?.data?.error || 'Certification failed.'); }
    };

    const handleBlacklist = async (vehicleId) => {
        const reason = blacklistReasons[vehicleId];
        if (!reason) { alert('Enter a reason.'); return; }
        try {
            await blacklistVehicle(vehicleId, reason);
            setVehicles(p => p.map(v => v.id === vehicleId ? { ...v, status: 'INACTIVE', is_blacklisted: true } : v));
        } catch { alert('Blacklist failed.'); }
    };

    const handleVahanCheck = async (vehicleId) => {
        try {
            const { data } = await vahanCheck(vehicleId);
            alert(`VAHAN: ${data.vahan_result?.message || 'Completed'}. Status: ${data.vehicle_status}`);
            await loadTab('vehicles');
        } catch { alert('VAHAN check failed.'); }
    };

    const handleConfigSave = async (setting) => {
        try { await updateConfigSetting(setting.id, setting.value); alert('Saved.'); }
        catch { alert('Save failed.'); }
    };

    const handleSegmentSave = async (seg) => {
        try {
            await updateSegmentConfig(seg.id, {
                security_deposit: seg.security_deposit,
                min_driver_age:   seg.min_driver_age,
                min_rental_days:  seg.min_rental_days,
            });
            alert('Segment saved.');
        } catch { alert('Save failed.'); }
    };

    // Location CRUD
    const handleAddCity = async (vals) => {
        setFormLoading(true);
        try { await createCity(vals); await loadTab('locations'); }
        catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteCity = async (id) => {
        if (!window.confirm('Delete this city?')) return;
        try { await deleteCity(id); setCities(p => p.filter(c => c.id !== id)); }
        catch { alert('Delete failed.'); }
    };
    const handleAddLocation = async (vals) => {
        setFormLoading(true);
        try { await createLocation(vals); await loadTab('locations'); }
        catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteLocation = async (id) => {
        if (!window.confirm('Delete this location?')) return;
        try { await deleteLocation(id); setLocations(p => p.filter(l => l.id !== id)); }
        catch { alert('Delete failed.'); }
    };
    const handleAddCityPairFee = async (vals) => {
        setFormLoading(true);
        try { await createCityPairFee(vals); await loadTab('locations'); }
        catch { alert('Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteCityPairFee = async (id) => {
        if (!window.confirm('Delete this fee?')) return;
        try { await deleteCityPairFee(id); setCityPairFees(p => p.filter(f => f.id !== id)); }
        catch { alert('Failed.'); }
    };
    const handleAddPromo = async (vals) => {
        setFormLoading(true);
        try { await createPromo(vals); await loadTab('promos'); }
        catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeletePromo = async (id) => {
        if (!window.confirm('Delete promo?')) return;
        try { await deletePromo(id); setPromos(p => p.filter(x => x.id !== id)); }
        catch { alert('Failed.'); }
    };
    const handleAddReturnPoint = async (vals) => {
        setFormLoading(true);
        try {
            await createReturnPoint(vals);
            const { data } = await getReturnPoints();
            setReturnPoints(data.results || data);
        } catch (e) { alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.'); }
        setFormLoading(false);
    };
    const handleDeleteReturnPoint = async (id) => {
        if (!window.confirm('Delete return point?')) return;
        try { await deleteReturnPoint(id); setReturnPoints(p => p.filter(r => r.id !== id)); }
        catch { alert('Failed.'); }
    };

    // ── Agreement handlers ────────────────────────────────────
    const handleCreateVersion = async (e) => {
        e.preventDefault();
        if (!agreementForm.version_tag || !agreementForm.content) {
            alert('version_tag and content are required.');
            return;
        }
        setAgreementFormLoading(true);
        try {
            await createAgreementVersion({
                ...agreementForm,
                effective_from: agreementForm.effective_from || new Date().toISOString(),
            });
            await loadTab('agreements');
            setShowCreateForm(false);
            setAgreementForm({
                version_tag: '', title: 'Rental Agreement – Terms & Conditions',
                summary: '', content: '', effective_from: '',
            });
        } catch (e) {
            alert(e.response?.data ? JSON.stringify(e.response.data) : 'Failed to create version.');
        }
        setAgreementFormLoading(false);
    };

    const handleUpdateVersion = async (e) => {
        e.preventDefault();
        if (!editingVersion) return;
        setAgreementFormLoading(true);
        try {
            await updateAgreementVersion(editingVersion.id, {
                title:          editingVersion.title,
                summary:        editingVersion.summary,
                content:        editingVersion.content,
                effective_from: editingVersion.effective_from,
            });
            await loadTab('agreements');
            setEditingVersion(null);
        } catch (e) {
            const msg = e.response?.data?.error
                || (e.response?.data ? JSON.stringify(e.response.data) : 'Failed to update.');
            alert(msg);
        }
        setAgreementFormLoading(false);
    };

    const handleActivateVersion = async (versionId, versionTag) => {
        if (!window.confirm(`Activate ${versionTag}?\n\nAll customers will see this version when signing new rental agreements. Other versions will be automatically deactivated.`)) return;
        try {
            await activateAgreementVersion(versionId);
            await loadTab('agreements');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to activate.');
        }
    };

    const filteredBookings = bookings.filter(b =>
        (!bookingFilter || b.status === bookingFilter) &&
        (!searchQuery || b.booking_ref?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const filteredUsers = users.filter(u =>
        (!userFilter || u.role === userFilter) &&
        (!searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const filteredAcceptances = acceptances.filter(a =>
        !acceptanceFilter ||
        String(a.agreement_version_id) === acceptanceFilter ||
        a.version_tag === agreements.find(v => String(v.id) === acceptanceFilter)?.version_tag
    );

    const TAB_LABELS = {
        overview: 'Overview', vendors: 'Vendors', vehicles: 'Vehicles',
        bookings: 'Bookings', users: 'Users', locations: 'Locations',
        logistics: 'Logistics', config: 'Config', promos: 'Promos',
        agreements: 'Agreements',
    };

    return (
        <div className="admin-dash">
            <Sidebar activeTab={tab} onTabChange={setTab} />

            <div className="page-shell">
                <div className="admin-dash__inner">

                    {/* Hero */}
                    <div className="admin-dash__hero">
                        <div className="admin-dash__hero-banner" />
                        <div className="admin-dash__hero-body">
                            <div className="admin-dash__hero-left">
                                <div className="admin-dash__hero-icon">⚙️</div>
                                <div className="admin-dash__hero-info">
                                    <div className="admin-dash__hero-title">Control Centre</div>
                                    <div className="admin-dash__hero-sub">
                                        Full platform management — vendors, vehicles, bookings, locations, logistics, config & agreements.
                                    </div>
                                </div>
                            </div>
                            {stats && (
                                <div className="admin-stats-bar">
                                    <StatPill icon="👥" value={stats.total_users}    label="Users" />
                                    <StatPill icon="🏪" value={stats.total_vendors}  label="Vendors" />
                                    <StatPill icon="⏳" value={stats.pending_vendors} label="Pending" accent="#D97706" />
                                    <StatPill icon="🚗" value={stats.total_vehicles} label="Vehicles" />
                                    <StatPill icon="📋" value={stats.total_bookings} label="Bookings" />
                                    <StatPill icon="🟢" value={stats.active_bookings} label="Active" accent="#059669" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Page title */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>
                            {TAB_LABELS[tab]}
                        </h2>
                    </div>

                    {loading && (
                        <div className="admin-loading">
                            <div className="admin-loading__spinner" />
                            <span>Loading {tab}…</span>
                        </div>
                    )}
                    {error && (
                        <div className="admin-error">
                            <span>⚠ {error}</span>
                            <button onClick={() => loadTab(tab)}>↺ Retry</button>
                        </div>
                    )}

                    {/* ════ OVERVIEW ════ */}
                    {!loading && tab === 'overview' && analytics && (
                        <div className="admin-section">
                            <div className="admin-kpi-grid">
                                {[
                                    ['💰', 'Total Revenue',       `₹${parseFloat(analytics.total_revenue || 0).toLocaleString('en-IN')}`, '#0DB89E'],
                                    ['🏦', 'Platform Commission', `₹${parseFloat(analytics.platform_revenue || 0).toLocaleString('en-IN')}`, '#8B5CF6'],
                                    ['📋', 'Total Bookings',      analytics.total_bookings, '#3B82F6'],
                                ].map(([icon, label, value, color]) => (
                                    <div key={label} className="admin-kpi-card">
                                        <div className="admin-kpi-card__icon" style={{ background: `${color}15`, color }}>{icon}</div>
                                        <div>
                                            <p>{label}</p>
                                            <h2 style={{ color }}>{value ?? '—'}</h2>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="admin-two-col">
                                {analytics.city_demand?.length > 0 && (
                                    <SectionCard title="City-wise Demand" subtitle="Top performing cities">
                                        <div className="admin-data-table">
                                            <div className="admin-data-table__header">
                                                <span>City</span><span>Bookings</span><span>Revenue</span>
                                            </div>
                                            {analytics.city_demand.map((c, i) => (
                                                <div key={c.city} className="admin-data-table__row">
                                                    <span><span className="admin-rank">#{i + 1}</span> {c.city}</span>
                                                    <span><span className="admin-badge admin-badge--blue">{c.count}</span></span>
                                                    <span className="admin-currency">₹{parseFloat(c.revenue || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                                {analytics.vendor_league?.length > 0 && (
                                    <SectionCard title="Top Vendors" subtitle="By total revenue">
                                        <div className="admin-data-table">
                                            <div className="admin-data-table__header">
                                                <span>Vendor</span><span>Bookings</span><span>Revenue</span>
                                            </div>
                                            {analytics.vendor_league.map((v, i) => (
                                                <div key={v.vendor_id} className="admin-data-table__row">
                                                    <span><span className="admin-rank">#{i + 1}</span> {v.name}</span>
                                                    <span><span className="admin-badge admin-badge--blue">{v.count}</span></span>
                                                    <span className="admin-currency">₹{parseFloat(v.revenue || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}
                            </div>

                            {analytics.monthly_trend?.length > 0 && (
                                <SectionCard title="Monthly Booking Trend">
                                    <div className="admin-trend-chart">
                                        {analytics.monthly_trend.map(m => {
                                            const maxCount = Math.max(...analytics.monthly_trend.map(x => x.count));
                                            const pct = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                                            return (
                                                <div key={m.month} className="admin-trend-bar-wrap">
                                                    <div className="admin-trend-bar-track">
                                                        <div className="admin-trend-bar" style={{ height: `${pct}%` }} title={`₹${parseFloat(m.revenue || 0).toLocaleString('en-IN')}`} />
                                                    </div>
                                                    <span>{m.month?.slice(5)}</span>
                                                    <span className="admin-trend-count">{m.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            )}
                        </div>
                    )}

                    {/* ════ VENDORS ════ */}
                    {!loading && tab === 'vendors' && (
                        <div className="admin-section">
                            {vendors.length === 0 ? <EmptyState icon="🏪" message="No vendors found." /> : (
                                <div className="admin-card-list">
                                    {vendors.map(v => (
                                        <div key={v.id} className="admin-vendor-card">
                                            <div className="admin-vendor-card__left">
                                                <div className="admin-vendor-card__avatar">
                                                    {v.business_name?.[0]?.toUpperCase() || 'V'}
                                                </div>
                                                <div>
                                                    <strong>{v.business_name}</strong>
                                                    <span>{v.email}</span>
                                                    <span>{v.phone}</span>
                                                </div>
                                            </div>
                                            <div className="admin-vendor-card__meta">
                                                <div><span className="admin-meta-label">GSTIN</span> <span>{v.gstin || '—'}</span></div>
                                                <div><span className="admin-meta-label">KYC</span> <span>{v.kyc_document ? '✅ Uploaded' : '❌ Missing'}</span></div>
                                                <div><span className="admin-meta-label">Rating</span> <span>{v.rating ? `⭐ ${v.rating}` : 'No reviews'}</span></div>
                                            </div>
                                            <div className="admin-vendor-card__right">
                                                <StatusBadge status={v.status} colorMap={VENDOR_STATUS_CLR} />
                                                <input className="admin-note-input" placeholder="Add note (optional)…"
                                                    value={actionNotes[v.id] || ''}
                                                    onChange={e => setActionNotes(p => ({ ...p, [v.id]: e.target.value }))} />
                                                <div className="admin-action-row">
                                                    {v.status === 'pending' && (
                                                        <>
                                                            <button className="admin-btn admin-btn--success" onClick={() => handleVendorAction(v.id, 'approve')}>✓ Approve</button>
                                                            <button className="admin-btn admin-btn--danger"  onClick={() => handleVendorAction(v.id, 'reject')}>✕ Reject</button>
                                                        </>
                                                    )}
                                                    {v.status === 'approved' && (
                                                        <button className="admin-btn admin-btn--warning" onClick={() => handleVendorAction(v.id, 'suspend')}>⚠ Suspend</button>
                                                    )}
                                                    {(v.status === 'suspended' || v.status === 'rejected') && (
                                                        <button className="admin-btn admin-btn--success" onClick={() => handleVendorAction(v.id, 'reinstate')}>↩ Reinstate</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ VEHICLES ════ */}
                    {!loading && tab === 'vehicles' && (
                        <div className="admin-section">
                            {vehicleStats && (
                                <div className="admin-stats-row">
                                    {Object.entries(vehicleStats).map(([s, count]) => {
                                        const vc = VEHICLE_STATUS_CLR[s] || { color: '#9CA3AF' };
                                        return (
                                            <div key={s} className="admin-mini-stat" style={{ borderColor: vc.color + '60' }}>
                                                <span style={{ color: vc.color, fontWeight: 800, fontSize: 17 }}>{count}</span>
                                                <span>{s.replace(/_/g, ' ')}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="admin-filter-strip">
                                {['', 'PENDING_DOCS', 'DOCS_SUBMITTED', 'ADMIN_APPROVED', 'LIVE', 'INACTIVE'].map(s => (
                                    <button key={s || 'all'} className={`admin-filter-chip ${vehicleFilter === s ? 'active' : ''}`} onClick={() => setVehicleFilter(s)}>
                                        {s || 'All'}
                                    </button>
                                ))}
                            </div>
                            {vehicles.length === 0
                                ? <EmptyState icon="🚗" message={`No vehicles with status: ${vehicleFilter || 'All'}`} />
                                : (
                                    <div className="admin-card-list">
                                        {vehicles.map(v => (
                                            <div key={v.id} className="admin-vehicle-card">
                                                <div className="admin-vehicle-card__header">
                                                    <div>
                                                        <strong>{v.year} {v.make} {v.model}</strong>
                                                        <span>{v.plate_number} · {v.vendor?.vendor_profile?.business_name || v.vendor?.email}</span>
                                                        <span>{v.city?.name} · {v.segment}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                                                        <StatusBadge status={v.status} colorMap={VEHICLE_STATUS_CLR} />
                                                        {v.is_blacklisted && <span className="admin-blacklisted-badge">🚫 Blacklisted</span>}
                                                        {v.is_certified   && <span className="admin-certified-badge">✅ Certified</span>}
                                                    </div>
                                                </div>

                                                {(v.documents || []).length > 0 && (
                                                    <div className="admin-vehicle-card__docs">
                                                        <p className="admin-section-label">Documents</p>
                                                        <div className="admin-doc-list">
                                                            {v.documents.map(d => (
                                                                <div key={d.id} className="admin-doc-row">
                                                                    <span className="admin-doc-type">{d.doc_type.replace(/_/g, ' ').toUpperCase()}</span>
                                                                    {d.status === 'pending' ? (
                                                                        <div className="admin-doc-actions">
                                                                            <input className="admin-doc-note-input" placeholder="Note…" value={docNotes[d.id] || ''} onChange={e => setDocNotes(p => ({ ...p, [d.id]: e.target.value }))} />
                                                                            <button className="admin-btn admin-btn--xs admin-btn--success" onClick={() => handleDocReview(d.id, 'approve')}>✓</button>
                                                                            <button className="admin-btn admin-btn--xs admin-btn--danger"  onClick={() => handleDocReview(d.id, 'reject')}>✕</button>
                                                                        </div>
                                                                    ) : (
                                                                        <StatusBadge status={d.status}
                                                                            colorMap={{ approved: { bg: '#D1FAE5', color: '#059669' }, rejected: { bg: '#FEE2E2', color: '#EF4444' }, pending: { bg: '#FEF3C7', color: '#D97706' } }}
                                                                            size="sm" />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {v.status === 'ADMIN_APPROVED' && (
                                                    <div className="admin-certify-panel">
                                                        <p className="admin-section-label">🔧 Mechanic Certification</p>
                                                        <div className="admin-certify-form">
                                                            <div className="admin-form-field">
                                                                <label>Cert Date</label>
                                                                <input type="date" onChange={e => setCertifyForms(p => ({ ...p, [v.id]: { ...(p[v.id] || {}), cert_date: e.target.value } }))} />
                                                            </div>
                                                            <div className="admin-form-field">
                                                                <label>Odometer (km)</label>
                                                                <input type="number" placeholder="Current odometer" onChange={e => setCertifyForms(p => ({ ...p, [v.id]: { ...(p[v.id] || {}), odometer_at_cert: e.target.value } }))} />
                                                            </div>
                                                            <div className="admin-form-field">
                                                                <label>Cert Report (PDF/Image)</label>
                                                                <input type="file" accept=".pdf,.jpg,.png" onChange={e => setCertifyForms(p => ({ ...p, [v.id]: { ...(p[v.id] || {}), file: e.target.files[0] } }))} />
                                                            </div>
                                                            <button className="admin-btn admin-btn--success admin-certify-btn" onClick={() => handleCertify(v.id)}>✓ Certify → LIVE</button>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="admin-vehicle-card__footer">
                                                    <button className="admin-btn admin-btn--ghost" onClick={() => handleVahanCheck(v.id)}>🔍 VAHAN Check</button>
                                                    {!v.is_blacklisted && (
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                                                            <input className="admin-note-input" placeholder="Blacklist reason…" value={blacklistReasons[v.id] || ''} onChange={e => setBlacklistReasons(p => ({ ...p, [v.id]: e.target.value }))} />
                                                            <button className="admin-btn admin-btn--danger" onClick={() => handleBlacklist(v.id)}>🚫 Blacklist</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            }
                        </div>
                    )}

                    {/* ════ BOOKINGS ════ */}
                    {!loading && tab === 'bookings' && (
                        <div className="admin-section">
                            <div className="admin-filter-strip">
                                <input className="admin-search-input" placeholder="Search by ref or customer…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                {['', 'PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(s => (
                                    <button key={s || 'all'} className={`admin-filter-chip ${bookingFilter === s ? 'active' : ''}`} onClick={() => setBookingFilter(s)}>
                                        {s || 'All'}
                                    </button>
                                ))}
                            </div>
                            {filteredBookings.length === 0
                                ? <EmptyState icon="📋" message="No bookings found." />
                                : (
                                    <div className="admin-booking-table">
                                        <div className="admin-booking-table__header">
                                            <span>Ref</span><span>Customer</span><span>Vehicle</span><span>Dates</span><span>Amount</span><span>Status</span>
                                        </div>
                                        {filteredBookings.map(b => (
                                            <div key={b.id} className="admin-booking-table__row">
                                                <span className="admin-booking-ref">{b.booking_ref}</span>
                                                <span>{b.customer?.full_name || b.customer?.email || '—'}</span>
                                                <span>{b.vehicle?.make} {b.vehicle?.model}<br /><small>{b.vendor?.vendor_profile?.business_name}</small></span>
                                                <span>{b.pickup_date} →<br />{b.return_date}</span>
                                                <span className="admin-currency">₹{parseFloat(b.total_amount || 0).toLocaleString('en-IN')}</span>
                                                <StatusBadge status={b.status} colorMap={BOOKING_STATUS_CLR} size="sm" />
                                            </div>
                                        ))}
                                    </div>
                                )
                            }
                        </div>
                    )}

                    {/* ════ USERS ════ */}
                    {!loading && tab === 'users' && (
                        <div className="admin-section">
                            <div className="admin-filter-strip">
                                <input className="admin-search-input" placeholder="Search by name or email…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                {['', 'customer', 'vendor', 'admin'].map(r => (
                                    <button key={r || 'all'} className={`admin-filter-chip ${userFilter === r ? 'active' : ''}`} onClick={() => setUserFilter(r)}>
                                        {r || 'All'}
                                    </button>
                                ))}
                            </div>
                            {filteredUsers.length === 0
                                ? <EmptyState icon="👥" message="No users found." />
                                : (
                                    <div className="admin-user-grid">
                                        {filteredUsers.map(u => (
                                            <div key={u.id} className="admin-user-card">
                                                <div className="admin-user-card__avatar" style={{ background: u.role === 'admin' ? '#FEE2E2' : u.role === 'vendor' ? '#DBEAFE' : '#D1FAE5', color: u.role === 'admin' ? '#EF4444' : u.role === 'vendor' ? '#1D4ED8' : '#059669' }}>
                                                    {u.full_name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="admin-user-card__info">
                                                    <strong>{u.full_name}</strong>
                                                    <span>{u.email}</span>
                                                    <span>{u.phone}</span>
                                                </div>
                                                <div className="admin-user-card__badges">
                                                    <span className={`admin-role-badge admin-role-badge--${u.role}`}>{u.role}</span>
                                                    <span className={`admin-verify-dot ${u.is_email_verified ? 'ok' : ''}`} title="Email">✉</span>
                                                    <span className={`admin-verify-dot ${u.is_phone_verified ? 'ok' : ''}`} title="Phone">📱</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            }
                        </div>
                    )}

                    {/* ════ LOCATIONS ════ */}
                    {!loading && tab === 'locations' && (
                        <div className="admin-section">
                            <SectionCard title="Cities" subtitle="Add operating cities first — required before creating locations or fees.">
                                <InlineForm
                                    fields={[
                                        { key: 'name',      label: 'City Name',  required: true,  placeholder: 'e.g. Mumbai' },
                                        { key: 'state',     label: 'State',      required: true,  placeholder: 'e.g. Maharashtra' },
                                        { key: 'latitude',  label: 'Latitude',   type: 'number',  step: '0.000001' },
                                        { key: 'longitude', label: 'Longitude',  type: 'number',  step: '0.000001' },
                                    ]}
                                    onSubmit={handleAddCity} submitLabel="+ Add City" loading={formLoading}
                                />
                                <div className="admin-data-table" style={{ marginTop: 12 }}>
                                    <div className="admin-data-table__header">
                                        <span>City</span><span>State</span><span>Coords</span><span></span>
                                    </div>
                                    {cities.length === 0 && <div className="admin-table-empty">No cities yet.</div>}
                                    {cities.map(c => (
                                        <div key={c.id} className="admin-data-table__row">
                                            <span><strong>{c.name}</strong></span>
                                            <span>{c.state}</span>
                                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.latitude ? `${c.latitude}, ${c.longitude}` : '—'}</span>
                                            <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDeleteCity(c.id)}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>

                            <SectionCard title="Pickup / Dropoff Locations">
                                <div className="admin-data-table" style={{ marginTop: 12 }}>
                                    <div className="admin-data-table__header">
                                        <span>Name</span><span>City</span><span>Type</span><span>Address</span>
                                    </div>
                                    {locations.length === 0 && <div className="admin-table-empty">No locations yet.</div>}
                                    {locations.map(l => (
                                        <div key={l.id} className="admin-data-table__row">
                                            <span><strong>{l.name}</strong></span>
                                            <span>{l.city?.name || l.city_name}</span>
                                            <span><span className="admin-badge admin-badge--gray">{l.location_type}</span></span>
                                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{l.address || '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>

                            <SectionCard title="One-Way City Pair Fees" subtitle="Set logistics fees for cross-city returns.">
                                <div className="admin-data-table" style={{ marginTop: 12 }}>
                                    <div className="admin-data-table__header">
                                        <span>From</span><span>To</span><span>Fee</span><span></span>
                                    </div>
                                    {cityPairFees.length === 0 && <div className="admin-table-empty">No city pair fees yet.</div>}
                                    {cityPairFees.map(f => (
                                        <div key={f.id} className="admin-data-table__row">
                                            <span>{f.from_city?.name || f.from_city}</span>
                                            <span>→ {f.to_city?.name || f.to_city}</span>
                                            <span className="admin-currency">₹{parseFloat(f.fee).toLocaleString('en-IN')}</span>
                                            <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDeleteCityPairFee(f.id)}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ LOGISTICS ════ */}
                    {!loading && tab === 'logistics' && (
                        <div className="admin-section">
                            {logisticsStats && (
                                <div className="admin-stats-row">
                                    {[
                                        ['🕐', 'Expected',   logisticsStats.expected,        '#D97706'],
                                        ['📥', 'Received',   logisticsStats.received,        '#1D4ED8'],
                                        ['🔒', 'Held',       logisticsStats.held,            '#D97706'],
                                        ['🟢', 'Sub-listed', logisticsStats.sublisted,       '#059669'],
                                        ['🤝', 'Network',    logisticsStats.network_vendors, '#7C3AED'],
                                        ['📍', 'Ret. Points', logisticsStats.return_points,  '#0DB89E'],
                                    ].map(([icon, label, val, color]) => (
                                        <div key={label} className="admin-mini-stat" style={{ borderColor: color + '50' }}>
                                            <span>{icon}</span>
                                            <span style={{ color, fontWeight: 800, fontSize: 17 }}>{val ?? 0}</span>
                                            <span style={{ fontSize: 10 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="admin-setup-step">
                                <div className="admin-setup-step__badge">Setup</div>
                                <SectionCard title="Return Points" subtitle="Designated drop-off points for one-way returns.">
                                    <InlineForm
                                        fields={[
                                            { key: 'name',          label: 'Name',    required: true,  placeholder: 'e.g. FastPark Pune' },
                                            { key: 'city',          label: 'City',    type: 'select',  required: true, options: cities.map(c => ({ value: c.id, label: c.name })) },
                                            { key: 'point_type',    label: 'Type',    type: 'select',  required: true, options: [{ value: 'partner_vendor', label: 'Partner Vendor Lot' }, { value: 'parking', label: 'Paid Parking' }] },
                                            { key: 'address',       label: 'Address', placeholder: 'Full address' },
                                            { key: 'contact_phone', label: 'Contact Phone' },
                                        ]}
                                        onSubmit={handleAddReturnPoint} submitLabel="+ Add Return Point" loading={formLoading}
                                    />
                                    <div className="admin-data-table" style={{ marginTop: 12 }}>
                                        <div className="admin-data-table__header">
                                            <span>Name</span><span>City</span><span>Type</span><span>Handling Fee</span><span></span>
                                        </div>
                                        {returnPoints.length === 0 && <div className="admin-table-empty">No return points yet.</div>}
                                        {returnPoints.map(r => (
                                            <div key={r.id} className="admin-data-table__row">
                                                <span><strong>{r.name}</strong></span>
                                                <span>{r.city_name}</span>
                                                <span><span className="admin-badge admin-badge--gray">{r.point_type_display}</span></span>
                                                <span className="admin-currency">₹{r.handling_fee}</span>
                                                <button className="admin-btn admin-btn--xs admin-btn--danger" onClick={() => handleDeleteReturnPoint(r.id)}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </div>

                            {network.length > 0 && (
                                <SectionCard title="Vendor Network" subtitle="Vendors opted in for cross-city cooperation">
                                    <div className="admin-data-table">
                                        <div className="admin-data-table__header">
                                            <span>Vendor</span><span>City</span><span>Max</span><span>Held</span><span>Status</span>
                                        </div>
                                        {network.map(n => (
                                            <div key={n.id} className="admin-data-table__row">
                                                <span><strong>{n.business_name}</strong></span>
                                                <span>{n.city_name}</span>
                                                <span>{n.max_vehicles}</span>
                                                <span><span className={`admin-badge ${n.current_held_count >= n.max_vehicles ? 'admin-badge--red' : 'admin-badge--blue'}`}>{n.current_held_count} / {n.max_vehicles}</span></span>
                                                <span><span className={`admin-badge ${n.is_active ? 'admin-badge--green' : 'admin-badge--gray'}`}>{n.is_active ? 'Active' : 'Inactive'}</span></span>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            )}

                            <SectionCard title="Active Handovers" subtitle="Cross-city vehicle handover pipeline">
                                {handovers.length === 0
                                    ? <EmptyState icon="🔄" message="No active handovers." />
                                    : (
                                        <div className="admin-handover-list">
                                            {handovers.map(h => (
                                                <div key={h.id} className="admin-handover-card">
                                                    <div className="admin-handover-card__left">
                                                        <strong>{h.vehicle_display}</strong>
                                                        <span>Booking: {h.booking_ref}</span>
                                                        <span>From: {h.originating_vendor_name}</span>
                                                    </div>
                                                    <div className="admin-handover-card__mid">
                                                        <span>📍 {h.return_point_name}</span>
                                                        <span>🔄 {h.receiving_vendor ? `Receiving: ${h.receiving_vendor}` : 'No partner assigned'}</span>
                                                        {h.days_held > 0 && <span className="admin-days-held">⏱ {h.days_held}d held</span>}
                                                    </div>
                                                    <StatusBadge status={h.status} colorMap={HANDOVER_STATUS_CLR} />
                                                </div>
                                            ))}
                                        </div>
                                    )
                                }
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ CONFIG ════ */}
                    {!loading && tab === 'config' && (
                        <div className="admin-section">
                            <SectionCard title="Platform Configuration" subtitle="These settings drive pricing, cancellation policy, loyalty rewards and more.">
                                <div className="admin-config-notice">
                                    ⚠ These are live settings. Changes affect all future bookings immediately.
                                </div>
                                <div className="admin-config-list">
                                    {configs.map(c => (
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
                                                            onChange={e => setConfigs(p => p.map(x => x.id === c.id ? { ...x, value: e.target.value } : x))}
                                                        />
                                                        <button className="admin-btn admin-btn--success admin-btn--sm" onClick={() => handleConfigSave(c)}>Save</button>
                                                    </>
                                                ) : (
                                                    <span className="admin-config-locked">🔒 {c.value}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>

                            <SectionCard title="Vehicle Segment Configuration" subtitle="Per-segment security deposits, minimum driver age, and rental minimums.">
                                <div className="admin-segment-grid">
                                    {segments.map(seg => (
                                        <div key={seg.id} className="admin-segment-card">
                                            <div className="admin-segment-card__header"><strong>{seg.display_name}</strong></div>
                                            <div className="admin-segment-card__fields">
                                                <div className="admin-form-field">
                                                    <label>Security Deposit (₹)</label>
                                                    <input type="number" value={seg.security_deposit} onChange={e => setSegments(p => p.map(x => x.id === seg.id ? { ...x, security_deposit: e.target.value } : x))} />
                                                </div>
                                                <div className="admin-form-field">
                                                    <label>Min Driver Age</label>
                                                    <input type="number" value={seg.min_driver_age} onChange={e => setSegments(p => p.map(x => x.id === seg.id ? { ...x, min_driver_age: e.target.value } : x))} />
                                                </div>
                                                <div className="admin-form-field">
                                                    <label>Min Rental Days</label>
                                                    <input type="number" value={seg.min_rental_days} onChange={e => setSegments(p => p.map(x => x.id === seg.id ? { ...x, min_rental_days: e.target.value } : x))} />
                                                </div>
                                            </div>
                                            <button className="admin-btn admin-btn--success admin-btn--sm admin-segment-save" onClick={() => handleSegmentSave(seg)}>Save Changes</button>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ PROMOS ════ */}
                    {!loading && tab === 'promos' && (
                        <div className="admin-section">
                            <SectionCard title="Create Promo Code" subtitle="Promo codes are applied by customers at checkout.">
                                <InlineForm
                                    fields={[
                                        { key: 'code',           label: 'Code',             required: true,  placeholder: 'FIRST50' },
                                        { key: 'discount_type',  label: 'Type',             type: 'select',  required: true, default: 'flat', options: [{ value: 'flat', label: 'Flat (₹)' }, { value: 'percentage', label: 'Percentage (%)' }] },
                                        { key: 'discount_value', label: 'Discount Amount',  type: 'number',  required: true, placeholder: '200' },
                                        { key: 'max_uses',       label: 'Max Uses',         type: 'number',  placeholder: 'Unlimited' },
                                        { key: 'min_booking_amount', label: 'Min Booking (₹)', type: 'number', placeholder: '0' },
                                        { key: 'valid_from',     label: 'Valid From',       type: 'datetime-local', required: true },
                                        { key: 'valid_until',    label: 'Valid Until',      type: 'datetime-local', required: true },
                                    ]}
                                    onSubmit={handleAddPromo} submitLabel="+ Create Promo" loading={formLoading}
                                />
                            </SectionCard>
                            <SectionCard title={`Active Promos (${promos.length})`}>
                                {promos.length === 0
                                    ? <EmptyState icon="🎁" message="No promo codes yet." />
                                    : (
                                        <div className="admin-promo-grid">
                                            {promos.map(p => (
                                                <div key={p.id} className="admin-promo-card">
                                                    <div className="admin-promo-card__code">{p.code}</div>
                                                    <div className="admin-promo-card__discount">
                                                        {p.discount_type === 'flat' ? `₹${p.discount_value} off` : `${p.discount_value}% off`}
                                                    </div>
                                                    <div className="admin-promo-card__meta">
                                                        <span>Used: {p.redemption_count || p.times_used || 0} / {p.max_redemptions || p.max_uses || '∞'}</span>
                                                        {p.min_booking_value > 0 && <span>Min: ₹{p.min_booking_value}</span>}
                                                    </div>
                                                    <div className="admin-promo-card__dates">
                                                        <span>{p.valid_from?.slice(0, 10)} → {p.valid_until?.slice(0, 10)}</span>
                                                    </div>
                                                    <button className="admin-btn admin-btn--xs admin-btn--danger admin-promo-delete" onClick={() => handleDeletePromo(p.id)}>✕ Delete</button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                }
                            </SectionCard>
                        </div>
                    )}

                    {/* ════ AGREEMENTS ════ */}
                    {!loading && tab === 'agreements' && (
                        <div className="admin-section">

                            {/* Version list */}
                            <SectionCard
                                title="Agreement Versions"
                                subtitle="Only one version can be active at a time. Creating a new version does not deactivate the current one — use Activate to publish it."
                                action={
                                    <button
                                        className="admin-btn admin-btn--primary"
                                        onClick={() => { setShowCreateForm(v => !v); setEditingVersion(null); }}
                                    >
                                        {showCreateForm ? '✕ Cancel' : '+ New Version'}
                                    </button>
                                }
                            >
                                {/* Create form */}
                                {showCreateForm && (
                                    <form
                                        onSubmit={handleCreateVersion}
                                        style={{ background: '#F8FAFB', border: '1px solid #E8EDF2', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}
                                    >
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#0DB89E', marginBottom: 4 }}>
                                            New Draft Version
                                        </div>
                                        <div className="admin-inline-form">
                                            <div className="admin-form-field">
                                                <label>Version Tag *</label>
                                                <input type="text" placeholder="e.g. v2.0" value={agreementForm.version_tag} onChange={e => setAgreementForm(p => ({ ...p, version_tag: e.target.value }))} required />
                                            </div>
                                            <div className="admin-form-field">
                                                <label>Title</label>
                                                <input type="text" value={agreementForm.title} onChange={e => setAgreementForm(p => ({ ...p, title: e.target.value }))} />
                                            </div>
                                            <div className="admin-form-field">
                                                <label>Effective From</label>
                                                <input type="datetime-local" value={agreementForm.effective_from} onChange={e => setAgreementForm(p => ({ ...p, effective_from: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Summary (shown to users above full text)</label>
                                            <input type="text" placeholder="Key points plain-English summary…" value={agreementForm.summary} onChange={e => setAgreementForm(p => ({ ...p, summary: e.target.value }))} />
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Content * — Markdown supported (# H1, ## H2, numbered lists)</label>
                                            <textarea
                                                rows={14}
                                                placeholder={"# Rental Agreement – Terms & Conditions\n\n## 1. Eligibility\nThe renter must be at least 21 years of age…\n\n## 2. Payment Structure\n1. An advance payment (30%) is collected at booking.\n2. The remaining balance (70%) is due at return."}
                                                value={agreementForm.content}
                                                onChange={e => setAgreementForm(p => ({ ...p, content: e.target.value }))}
                                                required
                                                style={{ background: '#fff', border: '1px solid #D5DEE8', borderRadius: 8, color: '#111827', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'DM Mono, monospace', lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>
                                                {agreementFormLoading ? '…' : '+ Create Draft'}
                                            </button>
                                            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
                                        </div>
                                    </form>
                                )}

                                {/* Edit form */}
                                {editingVersion && (
                                    <form
                                        onSubmit={handleUpdateVersion}
                                        style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}
                                    >
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#D97706', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            Editing {editingVersion.version_tag}
                                            {editingVersion.acceptance_count > 0 && (
                                                <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 11 }}>
                                                    ⚠ {editingVersion.acceptance_count} user(s) have signed this — version_tag and content are locked.
                                                </span>
                                            )}
                                        </div>
                                        <div className="admin-inline-form">
                                            <div className="admin-form-field">
                                                <label>Version Tag</label>
                                                <input type="text" value={editingVersion.version_tag} disabled style={{ opacity: 0.5 }} readOnly />
                                            </div>
                                            <div className="admin-form-field">
                                                <label>Title</label>
                                                <input type="text" value={editingVersion.title} onChange={e => setEditingVersion(p => ({ ...p, title: e.target.value }))} />
                                            </div>
                                            <div className="admin-form-field">
                                                <label>Effective From</label>
                                                <input type="datetime-local" value={editingVersion.effective_from ? editingVersion.effective_from.slice(0, 16) : ''} onChange={e => setEditingVersion(p => ({ ...p, effective_from: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Summary</label>
                                            <input type="text" value={editingVersion.summary || ''} onChange={e => setEditingVersion(p => ({ ...p, summary: e.target.value }))} />
                                        </div>
                                        <div className="admin-form-field">
                                            <label>Content {editingVersion.acceptance_count > 0 ? '(locked — users have signed)' : '(Markdown)'}</label>
                                            <textarea
                                                rows={14}
                                                value={editingVersion.content}
                                                disabled={editingVersion.acceptance_count > 0}
                                                onChange={e => setEditingVersion(p => ({ ...p, content: e.target.value }))}
                                                style={{ background: editingVersion.acceptance_count > 0 ? '#F8FAFB' : '#fff', border: '1px solid #D5DEE8', borderRadius: 8, color: '#111827', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'DM Mono, monospace', lineHeight: 1.6, width: '100%', boxSizing: 'border-box', opacity: editingVersion.acceptance_count > 0 ? 0.6 : 1 }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="submit" className="admin-form-submit" disabled={agreementFormLoading}>
                                                {agreementFormLoading ? '…' : 'Save Changes'}
                                            </button>
                                            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditingVersion(null)}>Cancel</button>
                                        </div>
                                    </form>
                                )}

                                {/* Versions table */}
                                {agreements.length === 0 ? (
                                    <EmptyState icon="📄" message="No agreement versions yet. Create the first one above." />
                                ) : (
                                    <div className="admin-card-list">
                                        {agreements.map(v => (
                                            <div
                                                key={v.id}
                                                style={{ background: v.is_active ? '#E6F7F5' : '#F8FAFB', border: `1px solid ${v.is_active ? 'rgba(13,184,158,.35)' : '#E8EDF2'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', transition: 'border-color .16s' }}
                                            >
                                                {/* Info */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: v.is_active ? '#0A9E87' : '#111827' }}>
                                                            {v.version_tag}
                                                        </span>
                                                        {v.is_active && (
                                                            <span style={{ background: '#0DB89E', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999, letterSpacing: 1 }}>
                                                                LIVE
                                                            </span>
                                                        )}
                                                        <span style={{ background: v.acceptance_count > 0 ? '#DBEAFE' : '#F3F4F6', color: v.acceptance_count > 0 ? '#1D4ED8' : '#6B7280', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                                                            {v.acceptance_count} signed
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{v.title}</div>
                                                    {v.summary && (
                                                        <div style={{ fontSize: 12, color: '#6B7280', maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {v.summary}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                                                        Effective: {new Date(v.effective_from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        {' · '}Created by: {v.created_by_email || '—'}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {!v.is_active && (
                                                        <button className="admin-btn admin-btn--success" onClick={() => handleActivateVersion(v.id, v.version_tag)}>
                                                            ✓ Activate
                                                        </button>
                                                    )}
                                                    <button
                                                        className="admin-btn admin-btn--ghost"
                                                        onClick={() => { setEditingVersion({ ...v }); setShowCreateForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                    >
                                                        ✏ Edit
                                                    </button>
                                                    <button
                                                        className="admin-btn admin-btn--ghost"
                                                        onClick={() => {
                                                            const w = window.open('', '_blank');
                                                            w.document.write(
                                                                `<html><head><title>${v.version_tag} Preview</title>` +
                                                                `<style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 24px;line-height:1.75;color:#111}` +
                                                                `h1{font-size:22px;border-bottom:2px solid #eee;padding-bottom:10px}` +
                                                                `h2{font-size:16px;margin-top:24px}p{color:#333;margin:4px 0}` +
                                                                `.meta{color:#888;font-size:13px;margin-bottom:24px;padding:10px 14px;background:#f8f8f8;border-radius:8px}` +
                                                                `.summary{background:#FEF3C7;padding:12px 16px;border-left:3px solid #FCD34D;border-radius:4px;margin-bottom:20px;font-style:italic}</style></head><body>` +
                                                                `<h1>${v.title}</h1>` +
                                                                `<div class="meta">Version: <strong>${v.version_tag}</strong> &nbsp;|&nbsp; Effective: ${new Date(v.effective_from).toLocaleDateString('en-IN')}&nbsp;|&nbsp; ${v.acceptance_count} signature(s)</div>` +
                                                                (v.summary ? `<div class="summary">${v.summary}</div>` : '') +
                                                                `<pre style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">${v.content}</pre></body></html>`
                                                            );
                                                            w.document.close();
                                                        }}
                                                    >
                                                        👁 Preview
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                            {/* Acceptance audit log */}
                            <SectionCard
                                title="Acceptance Audit Log"
                                subtitle="Immutable record of every customer who signed an agreement. Cannot be modified or deleted."
                            >
                                {/* Version filter chips */}
                                <div className="admin-filter-strip" style={{ marginBottom: 8 }}>
                                    <button className={`admin-filter-chip${acceptanceFilter === '' ? ' active' : ''}`} onClick={() => setAcceptanceFilter('')}>All Versions</button>
                                    {agreements.map(v => (
                                        <button
                                            key={v.id}
                                            className={`admin-filter-chip${acceptanceFilter === String(v.id) ? ' active' : ''}`}
                                            onClick={() => setAcceptanceFilter(String(v.id))}
                                        >
                                            {v.version_tag} ({v.acceptance_count})
                                        </button>
                                    ))}
                                </div>

                                {filteredAcceptances.length === 0 ? (
                                    <EmptyState icon="📋" message="No acceptances found." />
                                ) : (
                                    <div className="admin-booking-table">
                                        <div
                                            className="admin-booking-table__header"
                                            style={{ gridTemplateColumns: '110px 1fr 1fr 100px 70px 140px' }}
                                        >
                                            <span>Version</span>
                                            <span>User</span>
                                            <span>Booking</span>
                                            <span>Method</span>
                                            <span>OTP</span>
                                            <span>Date & Time</span>
                                        </div>
                                        {filteredAcceptances.map(a => (
                                            <div
                                                key={a.id}
                                                className="admin-booking-table__row"
                                                style={{ gridTemplateColumns: '110px 1fr 1fr 100px 70px 140px' }}
                                            >
                                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#0DB89E' }}>
                                                    {a.version_tag}
                                                </span>
                                                <span>
                                                    {a.user_name || '—'}
                                                    <small style={{ display: 'block', color: '#9CA3AF', fontSize: 10 }}>{a.user_email}</small>
                                                </span>
                                                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0DB89E' }}>
                                                    {a.booking_ref || '—'}
                                                </span>
                                                <span>
                                                    <span style={{ background: a.acceptance_method === 'otp_sign' ? '#DBEAFE' : '#F3F4F6', color: a.acceptance_method === 'otp_sign' ? '#1D4ED8' : '#6B7280', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>
                                                        {a.acceptance_method === 'otp_sign' ? 'OTP Sign' : 'Checkbox'}
                                                    </span>
                                                </span>
                                                <span>
                                                    {a.otp_verified
                                                        ? <span style={{ color: '#059669', fontWeight: 700 }}>✓ Yes</span>
                                                        : <span style={{ color: '#9CA3AF' }}>No</span>
                                                    }
                                                </span>
                                                <span style={{ fontSize: 11 }}>
                                                    {new Date(a.accepted_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    {a.ip_address && (
                                                        <small style={{ display: 'block', color: '#9CA3AF', fontSize: 10, fontFamily: 'DM Mono, monospace' }}>
                                                            {a.ip_address}
                                                        </small>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}