import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
    getAdminStats, getAdminAnalytics,
    getAdminVendors, adminVendorAction,
    getAdminVehicles, getAdminVehicleStats,
    reviewDoc, certifyVehicle, blacklistVehicle, vahanCheck, setVehicleStatus,
    getAdminBookings,
    getAdminUsers,
    getConfigSettings, updateConfigSetting,
    getConfigCategories, createConfigSetting, archiveConfigSetting, restoreConfigSetting, deleteConfigSetting, getConfigHistory,
    getSegmentConfigs, updateSegmentConfig,
    getLocations, createLocation, deleteLocation,
    getCities, createCity, deleteCity,
    getCityPairFees, createCityPairFee, deleteCityPairFee,
    getAdminPromos, createPromo, deletePromo,
    getReturnPoints, createReturnPoint, deleteReturnPoint,
    getAdminLogisticsOverview, getAdminLogisticsStats, getAdminNetworkList,
    getAdminAgreementVersions, createAgreementVersion, updateAgreementVersion, activateAgreementVersion,
    getAdminAcceptances,
    getAdminVendors as getReviewVendors,
    getMyAdminProfile, approveVehicleEdit, rejectVehicleEdit, completeReverification,
} from "../../services/api";

// ── Layout ────────────────────────────────────────────────────────────────────
import { Sidebar } from "../../components/common/Navbar";
import Navbar      from "../../components/common/Navbar";

// ── Shared primitives ─────────────────────────────────────────────────────────
import { ScopeIndicator } from "./AdminShared";
import { PhotoLightbox }  from "./MediaComponents";

// ── Modals ────────────────────────────────────────────────────────────────────
import VendorDetailModal   from "./modals/VendorDetailModal";
import VehicleDetailModal  from "./modals/VehicleDetailModal";
import BookingDetailModal  from "./modals/BookingDetailModal";
import UserDetailModal     from "./modals/UserDetailModal";
import ReviewDetailModal   from "./modals/ReviewDetailModal";
import ConfigHistoryModal  from "./modals/ConfigHistoryModal";

// ── Tabs ──────────────────────────────────────────────────────────────────────
import OverviewTab    from "./tabs/OverviewTab";
import VendorsTab     from "./tabs/VendorsTab";
import VehiclesTab    from "./tabs/VehiclesTab";
import BookingsTab    from "./tabs/BookingsTab";
import UsersTab       from "./tabs/UsersTab";
import LocationsTab   from "./tabs/LocationsTab";
import LogisticsTab   from "./tabs/LogisticsTab";
import ConfigTab      from "./tabs/ConfigTab";
import PromosTab      from "./tabs/PromosTab";
import AgreementsTab  from "./tabs/AgreementsTab";
import ReviewsTab     from "./tabs/ReviewsTab";
import AssignmentsTab from "./tabs/AssignmentsTab";
import NotificationsTab from "./tabs/NotificationsTab";
import PersonalizationTab from "./tabs/PersonalizationTab";
import { useConfirmDelete } from "../../components/common/ConfirmDeleteModal";

// ── CSS ───────────────────────────────────────────────────────────────────────
import "./AdminDashboard.css";
import "../../components/common/DataTable.css";

// ─────────────────────────────────────────────────────────────────────────────
const TAB_LABELS = {
    overview: "Overview", vendors: "Vendors", vehicles: "Vehicles",
    bookings: "Bookings", users: "Users",     locations: "Locations",
    logistics: "Logistics", config: "Configuration", promos: "Promos",
    agreements: "Agreements", reviews: "Reviews", assignments: "Assignments",
    notifications: "Notifications", personalization: "Personalization",
};

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const [tab, setTab] = useState("overview");

    // ── Admin profile / scope ─────────────────────────────────────────────────
    const [myProfile, setMyProfile] = useState(null);

    // ── Per-tab data ──────────────────────────────────────────────────────────
    const [stats,        setStats]        = useState(null);
    const [analytics,    setAnalytics]    = useState(null);
    const [vendors,      setVendors]      = useState([]);
    const [vehicles,     setVehicles]     = useState([]);
    const [vehicleStats, setVehicleStats] = useState(null);
    const [vehicleFilter,setVehicleFilter]= useState("");
    const [bookings,     setBookings]     = useState([]);
    const [users,        setUsers]        = useState([]);
    const [configs,      setConfigs]      = useState([]);
    const [segments,     setSegments]     = useState([]);
    const [configCategories, setConfigCategories] = useState([]);
    const [locations,    setLocations]    = useState([]);
    const [cities,       setCities]       = useState([]);
    const [cityPairFees, setCityPairFees] = useState([]);
    const [promos,       setPromos]       = useState([]);
    const [returnPoints, setReturnPoints] = useState([]);
    const [handovers,    setHandovers]    = useState([]);
    const [logisticsStats, setLogisticsStats] = useState(null);
    const [network,      setNetwork]      = useState([]);
    const [agreements,   setAgreements]   = useState([]);
    const [acceptances,  setAcceptances]  = useState([]);
    const [reviewVendors,setReviewVendors]= useState([]);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState("");
    const [formLoading, setFormLoading] = useState(false);
    const [agreementFormLoading, setAgreementFormLoading] = useState(false);

    // ── Vehicle action state (passed into VehicleDetailModal) ─────────────────
    const [docNotes,         setDocNotes]         = useState({});
    const [certifyForms,     setCertifyForms]     = useState({});
    const [blacklistReasons, setBlacklistReasons] = useState({});

    // ── Modal state ───────────────────────────────────────────────────────────
    const [selectedVendor,  setSelectedVendor]  = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [selectedUser,    setSelectedUser]    = useState(null);
    const [vehiclePhotoLightbox, setVehiclePhotoLightbox] = useState(null);

    // ── Config history modal state ───────────────────────────────────────────
    const [configHistorySetting, setConfigHistorySetting] = useState(null);
    const [configHistoryData,    setConfigHistoryData]    = useState([]);
    const [configHistoryLoading, setConfigHistoryLoading] = useState(false);

    const [searchParams, setSearchParams] = useSearchParams();
    const highlightRef = useRef(null);

    const [askDelete, ConfirmEl] = useConfirmDelete();

    // ── Fetch admin profile on mount ──────────────────────────────────────────
    useEffect(() => {
        getMyAdminProfile()
            .then((res) => setMyProfile(res.data))
            .catch(() => setMyProfile({ scope: "superadmin", assigned_vendor_count: null, display_name: "" }));
    }, []);

    // ── Tab data loading ──────────────────────────────────────────────────────
    const loadTab = useCallback(async (t) => {
        if (t === "assignments") { setLoading(false); return; }
        setLoading(true);
        setError("");
        try {
            switch (t) {
                case "overview": {
                    const [s, a] = await Promise.all([getAdminStats(), getAdminAnalytics()]);
                    setStats(s.data); setAnalytics(a.data);
                    break;
                }
                case "vendors": {
                    const { data } = await getAdminVendors();
                    setVendors(data.results ?? data);
                    break;
                }
                case "vehicles": {
                    const [v, s] = await Promise.all([getAdminVehicles(vehicleFilter || ""), getAdminVehicleStats()]);
                    setVehicles(v.data.results ?? v.data); setVehicleStats(s.data);
                    break;
                }
                case "bookings": {
                    const { data } = await getAdminBookings();
                    setBookings(data.results ?? data);
                    break;
                }
                case "users": {
                    const { data } = await getAdminUsers({ role: "customer" });
                    setUsers(data.results ?? data);
                    break;
                }
                case "config": {
                    const [c, sg, cat] = await Promise.all([
                        getConfigSettings({ include_archived: 'true' }),
                        getSegmentConfigs(),
                        getConfigCategories(),
                    ]);
                    setConfigs(c.data.results ?? c.data);
                    setSegments(sg.data.results ?? sg.data);
                    setConfigCategories(cat.data.results ?? cat.data);
                    break;
                }
                case "locations": {
                    const [l, c, cp] = await Promise.all([getLocations(), getCities(), getCityPairFees()]);
                    setLocations(l.data.results ?? l.data);
                    setCities(c.data.results ?? c.data);
                    setCityPairFees(cp.data.results ?? cp.data);
                    break;
                }
                case "logistics": {
                    const [h, ls, nw, rp, c, v] = await Promise.all([
                        getAdminLogisticsOverview(), getAdminLogisticsStats(),
                        getAdminNetworkList(), getReturnPoints(), getCities(),
                        getAdminVendors(),
                    ]);
                    setHandovers(h.data.results ?? h.data); setLogisticsStats(ls.data);
                    setNetwork(nw.data.results ?? nw.data); setReturnPoints(rp.data.results ?? rp.data);
                    setCities(c.data.results ?? c.data);
                    setVendors(v.data.results ?? v.data);
                    break;
                }
                case "promos": {
                    const { data } = await getAdminPromos();
                    setPromos(data.results ?? data);
                    break;
                }
                case "agreements": {
                    const [av, ac] = await Promise.all([getAdminAgreementVersions(), getAdminAcceptances()]);
                    setAgreements(av.data.results ?? av.data); setAcceptances(ac.data.results ?? ac.data);
                    break;
                }
                case "reviews": {
                    const vRes = await getReviewVendors();
                    setReviewVendors(vRes.data.results ?? vRes.data);
                    break;
                }
                default: break;
            }
        } catch (e) {
            setError(`Failed to load ${t}: ${e.response?.data?.detail || e.message || "Unknown error"}`);
        }
        setLoading(false);
    }, [vehicleFilter]);

    useEffect(() => { loadTab(tab); }, [tab, loadTab]);
    useEffect(() => { if (tab === "vehicles") loadTab("vehicles"); }, [vehicleFilter]);

    useEffect(() => {
        const tabParam = searchParams.get("tab");
        if (tabParam && tabParam !== tab) setTab(tabParam);
        const highlight = searchParams.get("highlight");
        if (highlight) highlightRef.current = highlight;
    }, [searchParams]);

    useEffect(() => {
        if (tab === "vehicles" && highlightRef.current && vehicles.length > 0) {
            const match = vehicles.find((v) => String(v.id) === String(highlightRef.current));
            if (match) setSelectedVehicle(match);
            highlightRef.current = null;
            const next = new URLSearchParams(searchParams);
            next.delete("highlight");
            setSearchParams(next, { replace: true });
        }
    }, [vehicles, tab]);

    // ── Vendor actions ────────────────────────────────────────────────────────
    const handleVendorAction = async (id, action, note = "") => {
        const statusMap = { approve: "approved", reject: "rejected", suspend: "suspended", reinstate: "approved", more_info: "more_info" };
        try {
            await adminVendorAction(id, action, note);
            const newStatus = statusMap[action];
            const update = (v) => v.id === id ? { ...v, status: newStatus || v.status, admin_note: note } : v;
            setVendors((p) => p.map(update));
            setSelectedVendor((prev) => prev?.id === id ? update(prev) : prev);
        } catch (e) { alert(e.response?.data?.error || "Action failed."); }
    };

    // ── Vehicle actions ───────────────────────────────────────────────────────
    const handleDocReview = async (docId, action) => {
        try {
            await reviewDoc(docId, action, docNotes[docId] || "");
            const updater = (docs) => (docs || []).map((d) => d.id === docId ? { ...d, status: action } : d);
            setVehicles((p) => p.map((v) => ({ ...v, documents: updater(v.documents) })));
            setSelectedVehicle((prev) => prev ? { ...prev, documents: updater(prev.documents) } : prev);
            setDocNotes((p) => ({ ...p, [docId]: "" }));
        } catch { alert("Review failed."); }
    };

    const handleCertify = async (vehicleId) => {
        const f = certifyForms[vehicleId] || {};
        if (!f.cert_date || !f.odometer_at_cert) { alert("Cert date and odometer required."); return; }
        const fd = new FormData();
        fd.append("cert_date", f.cert_date);
        fd.append("odometer_at_cert", f.odometer_at_cert);
        if (f.file) fd.append("file", f.file);
        try { await certifyVehicle(vehicleId, fd); await loadTab("vehicles"); alert("Vehicle certified → LIVE!"); }
        catch (e) { alert(e.response?.data?.error || "Certification failed."); }
    };

    const handleBlacklist = async (vehicleId) => {
        const reason = blacklistReasons[vehicleId];
        if (!reason) { alert("Enter a reason."); return; }
        try {
            await blacklistVehicle(vehicleId, reason);
            const update = (v) => v.id === vehicleId ? { ...v, status: "INACTIVE", is_blacklisted: true } : v;
            setVehicles((p) => p.map(update));
            setSelectedVehicle((prev) => prev ? update(prev) : prev);
        } catch { alert("Blacklist failed."); }
    };

    const handleSetVehicleStatus = async (vehicleId, newStatus, note = "") => {
        try {
            const { data } = await setVehicleStatus(vehicleId, newStatus, note);
            const update = (v) => v.id === vehicleId ? { ...v, status: data.new_status } : v;
            setVehicles((p) => p.map(update));
            setSelectedVehicle((prev) => prev ? update(prev) : prev);
        } catch (e) { alert(e.response?.data?.error || "Status change failed."); }
    };

    const handleVahanCheck = async (vehicleId) => {
        try { const { data } = await vahanCheck(vehicleId); alert(`VAHAN: ${data.vahan_result?.message || "Completed"}.`); await loadTab("vehicles"); }
        catch { alert("VAHAN check failed."); }
    };

    const handleApproveVehicleEdit = async (vehicleId) => {
    try {
        const { data } = await approveVehicleEdit(vehicleId);
        await loadTab("vehicles");
        setSelectedVehicle((prev) => (prev?.id === vehicleId ? data.vehicle : prev));
        alert(data.message);
    } catch { alert("Failed to approve changes."); }
};

const handleRejectVehicleEdit = async (vehicleId) => {
    const reason = window.prompt("Reason for rejecting these changes (optional):", "") ?? "";
    try {
        await rejectVehicleEdit(vehicleId, reason);
        await loadTab("vehicles");
        setSelectedVehicle((prev) =>
            prev?.id === vehicleId
                ? { ...prev, needs_review: false, pending_changes: {}, pending_changes_readable: [] }
                : prev
        );
    } catch { alert("Failed to reject changes."); }
};

const handleCompleteReverification = async (vehicleId) => {
    try {
        const { data } = await completeReverification(vehicleId);
        await loadTab("vehicles");
        setSelectedVehicle((prev) =>
            prev?.id === vehicleId ? { ...prev, needs_reverification: false, needs_review: false } : prev
        );
        alert(data.message);
    } catch { alert("Failed to record re-verification."); }
};

    // ── Config actions ────────────────────────────────────────────────────────
    const handleConfigSave = async (s, changeReason = "") => {
        try {
            await updateConfigSetting(s.id, s.value, changeReason);
            alert("Saved.");
        } catch (e) {
            alert(e.response?.data?.error || e.response?.data?.value?.[0] || "Save failed.");
        }
    };

    const handleSegmentSave = async (seg) => {
        try {
            await updateSegmentConfig(seg.id, {
                security_deposit: seg.security_deposit,
                min_driver_age: seg.min_driver_age,
                min_rental_days: seg.min_rental_days,
                platform_commission_override: seg.platform_commission_override,
                is_active: seg.is_active,
            });
            alert("Segment saved.");
        } catch { alert("Save failed."); }
    };

    const handleAddConfigSetting = async (v) => {
        setFormLoading(true);
        try {
            await createConfigSetting(v);
            await loadTab("config");
        } catch (e) {
            alert(JSON.stringify(e.response?.data || "Failed to create setting."));
        }
        setFormLoading(false);
    };

    const handleArchiveConfigSetting = async (id, reason = '') => {
        try {
            const { data } = await archiveConfigSetting(id, reason);
            await loadTab("config");
            alert(data.message);
        } catch (e) {
            alert(e.response?.data?.detail || "Couldn't archive this setting.");
        }
    };

    const handleRestoreConfigSetting = async (id) => {
        try {
            await restoreConfigSetting(id);
            await loadTab("config");
        } catch (e) {
            alert(e.response?.data?.detail || "Couldn't restore this setting.");
        }
    };

    const handleDeleteConfigSetting = (id, name) => askDelete({
        kind: 'setting', name,
        detail: 'Its full change history is deleted with it.',
        onConfirm: async () => { await deleteConfigSetting(id); setConfigs((p) => p.filter((c) => c.id !== id)); },
    });

    const handleViewConfigHistory = async (setting) => {
        setConfigHistorySetting(setting);
        setConfigHistoryLoading(true);
        try {
            const { data } = await getConfigHistory(setting.id);
            setConfigHistoryData(data);
        } catch {
            setConfigHistoryData([]);
        }
        setConfigHistoryLoading(false);
    };

    // ── Location actions ──────────────────────────────────────────────────────
    const handleAddCity          = async (v) => { setFormLoading(true); try { await createCity(v); await loadTab("locations"); } catch (e) { alert(JSON.stringify(e.response?.data || "Failed.")); } setFormLoading(false); };
    const handleDeleteCity = (id, name) => askDelete({
        kind: 'city', name,
        detail: 'All pickup/drop locations of this city are deleted too. This fails if vehicles still use the city.',
        onConfirm: async () => { await deleteCity(id); setCities((p) => p.filter((c) => c.id !== id)); },
    });
    const handleDeleteLocation = (id, name) => askDelete({
        kind: 'location', name,
        onConfirm: async () => { await deleteLocation(id); setLocations((p) => p.filter((l) => l.id !== id)); },
    });
    const handleAddCityPairFee   = async (v) => { setFormLoading(true); try { await createCityPairFee(v); await loadTab("locations"); } catch { alert("Failed."); } setFormLoading(false); };
    const handleDeleteCityPairFee = (id, name) => askDelete({
        kind: 'city-pair fee', name,
        onConfirm: async () => { await deleteCityPairFee(id); setCityPairFees((p) => p.filter((f) => f.id !== id)); },
    });
    // ── Promo actions ─────────────────────────────────────────────────────────
    const handleAddPromo    = async (v) => { setFormLoading(true); try { await createPromo(v); await loadTab("promos"); } catch (e) { alert(JSON.stringify(e.response?.data || "Failed.")); } setFormLoading(false); };
    const handleDeletePromo = (id, name) => askDelete({
        kind: 'promo code', name,
        onConfirm: async () => { await deletePromo(id); setPromos((p) => p.filter((x) => x.id !== id)); },
    });
    // ── Return point actions ──────────────────────────────────────────────────
    const handleAddReturnPoint = async (v) => { setFormLoading(true); try { await createReturnPoint(v); const r = await getReturnPoints(); setReturnPoints(r.data.results ?? r.data); } catch (e) { alert(JSON.stringify(e.response?.data || "Failed.")); } setFormLoading(false); };

    // ── Agreement actions ─────────────────────────────────────────────────────
    const handleCreateAgreement = async (formData) => {
        if (!formData.version_tag || !formData.content) { alert("version_tag and content required."); return false; }
        setAgreementFormLoading(true);
        try { await createAgreementVersion(formData); await loadTab("agreements"); setAgreementFormLoading(false); return true; }
        catch (e) { alert(JSON.stringify(e.response?.data || "Failed.")); setAgreementFormLoading(false); return false; }
    };
    const handleUpdateAgreement = async (version) => {
        setAgreementFormLoading(true);
        try { await updateAgreementVersion(version.id, { title: version.title, summary: version.summary, content: version.content, effective_from: version.effective_from }); await loadTab("agreements"); setAgreementFormLoading(false); return true; }
        catch (e) { alert(e.response?.data?.error || "Failed."); setAgreementFormLoading(false); return false; }
    };
    const handleActivateAgreement = async (id, tag) => {
        if (!window.confirm(`Activate ${tag}?`)) return;
        try { await activateAgreementVersion(id); await loadTab("agreements"); }
        catch (e) { alert(e.response?.data?.error || "Failed."); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="admin-dash">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />

            {/* ── Modals ── */}
            {selectedVendor && (
                <VendorDetailModal vendor={selectedVendor} onClose={() => setSelectedVendor(null)} onAction={handleVendorAction} />
            )}
            {selectedVehicle && (
                <VehicleDetailModal
                    vehicle={selectedVehicle}
                    onClose={() => setSelectedVehicle(null)}
                    docNotes={docNotes}           setDocNotes={setDocNotes}
                    certifyForms={certifyForms}   setCertifyForms={setCertifyForms}
                    blacklistReasons={blacklistReasons} setBlacklistReasons={setBlacklistReasons}
                    onDocReview={handleDocReview}
                    onCertify={handleCertify}
                    onBlacklist={handleBlacklist}
                    onSetStatus={handleSetVehicleStatus}
                    onVahanCheck={handleVahanCheck}
                    onApproveEdit={handleApproveVehicleEdit}
                    onRejectEdit={handleRejectVehicleEdit}
                    onCompleteReverification={handleCompleteReverification}
                    setVehiclePhotoLightbox={setVehiclePhotoLightbox}
                />
            )}
            {selectedBooking && (
                <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
            )}
            {selectedUser && (
                <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
            )}
            {vehiclePhotoLightbox && (
                <PhotoLightbox
                    photos={vehiclePhotoLightbox.photos}
                    initialIndex={vehiclePhotoLightbox.index}
                    onClose={() => setVehiclePhotoLightbox(null)}
                />
            )}
            {configHistorySetting && (
                <ConfigHistoryModal
                    setting={configHistorySetting}
                    history={configHistoryData}
                    loading={configHistoryLoading}
                    onClose={() => setConfigHistorySetting(null)}
                />
            )}

            <div className="page-shell">
                <div className="admin-dash__inner">

                    {/* ── Hero ── */}
                    <div className="admin-dash__hero">
                        <div className="admin-dash__hero-banner" />
                        <div className="admin-dash__hero-body">
                            <div className="admin-dash__hero-left">
                                <div className="admin-dash__hero-icon">⚙️</div>
                                <div className="admin-dash__hero-info">
                                    <div className="admin-dash__hero-title">Control Centre</div>
                                    <div className="admin-dash__hero-sub">
                                        Vendors · Vehicles · Bookings · Locations · Logistics · Config
                                    </div>
                                    <ScopeIndicator profile={myProfile} />
                                </div>
                            </div>
                            {stats && (
                                <div className="cd__kpis">
                                    {[
                                        [stats.total_users ?? stats.total_customers, "Users",    "#1D4ED8"],
                                        [stats.total_vendors ?? stats.assigned_vendors, "Vendors","#0DB89E"],
                                        [stats.pending_vendors,  "Pending",   "#D97706"],
                                        // [stats.total_vehicles,   "Vehicles",  "#059669"],
                                        // [stats.total_bookings,   "Bookings",  "#6B7280"],
                                        // [stats.active_bookings,  "Active",    "#059669"],
                                        ...(myProfile?.scope === "superadmin" && stats.unassigned_vendors != null
                                            ? [[stats.unassigned_vendors, "Unassigned", stats.unassigned_vendors > 0 ? "#EF4444" : "#9CA3AF"]]
                                            : []),
                                    ].map(([v, l, color]) => (
                                        <div key={l} className="cd__kpi">
                                            <span className="cd__kpi-val" style={{ color }}>{v ?? "—"}</span>
                                            <span className="cd__kpi-lbl">{l}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Tab heading ── */}
                    <div className="admin-sec-hd">
                        <h2>{TAB_LABELS[tab]}</h2>
                    </div>

                    {/* ── Loading / error ── */}
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

                    {/* ── Tab content ── */}
                    {!loading && tab === "overview" && (
                        <OverviewTab analytics={analytics} />
                    )}

                    {!loading && tab === "vendors" && (
                        <VendorsTab vendors={vendors} onSelectVendor={setSelectedVendor} />
                    )}

                    {!loading && tab === "vehicles" && (
                        <VehiclesTab
                            vehicles={vehicles}
                            vehicleStats={vehicleStats}
                            vehicleFilter={vehicleFilter}
                            setVehicleFilter={setVehicleFilter}
                            onSelectVehicle={setSelectedVehicle}
                        />
                    )}

                    {!loading && tab === "bookings" && (
                        <BookingsTab bookings={bookings} onSelectBooking={setSelectedBooking} />
                    )}

                    {!loading && tab === "users" && (
                        <UsersTab users={users} onSelectUser={setSelectedUser} />
                    )}

                    {!loading && tab === "locations" && (
                        <LocationsTab
                            cities={cities}
                            locations={locations}
                            cityPairFees={cityPairFees}
                            formLoading={formLoading}
                            onAddCity={handleAddCity}
                            onDeleteCity={handleDeleteCity}
                            onDeleteLocation={handleDeleteLocation}
                            onAddCityPairFee={handleAddCityPairFee}
                            onDeleteCityPairFee={handleDeleteCityPairFee}
                        />
                    )}

                    {!loading && tab === "logistics" && (
                        <LogisticsTab
                            handovers={handovers}
                            logisticsStats={logisticsStats}
                            network={network}
                            cities={cities}
                            returnPoints={returnPoints}
                            vendors={vendors}
                            formLoading={formLoading}
                            onAddReturnPoint={handleAddReturnPoint}
                        />
                    )}

                    {!loading && tab === "config" && (
                        <ConfigTab
                            configs={configs}
                            segments={segments}
                            categories={configCategories}
                            setConfigs={setConfigs}
                            setSegments={setSegments}
                            onConfigSave={handleConfigSave}
                            onSegmentSave={handleSegmentSave}
                            onAddConfig={handleAddConfigSetting}
                            onArchiveConfig={handleArchiveConfigSetting}
                            onRestoreConfig={handleRestoreConfigSetting}
                            onDeleteConfig={handleDeleteConfigSetting}
                            onViewHistory={handleViewConfigHistory}
                            formLoading={formLoading}
                        />
                    )}

                    {!loading && tab === "promos" && (
                        <PromosTab
                            promos={promos}
                            formLoading={formLoading}
                            onAddPromo={handleAddPromo}
                            onDeletePromo={handleDeletePromo}
                        />
                    )}

                    {!loading && tab === "agreements" && (
                        <AgreementsTab
                            agreements={agreements}
                            acceptances={acceptances}
                            onCreateAgreement={handleCreateAgreement}
                            onUpdateAgreement={handleUpdateAgreement}
                            onActivateAgreement={handleActivateAgreement}
                            agreementFormLoading={agreementFormLoading}
                        />
                    )}

                    {!loading && tab === "reviews" && (
                        <ReviewsTab reviewVendors={reviewVendors} />
                    )}

                    {tab === "assignments" && (
                        <div className="admin-section">
                            <AssignmentsTab myProfile={myProfile} />
                        </div>
                    )}

                    {!loading && tab === "notifications" && <NotificationsTab />}

                    {!loading && tab === "personalization" && <PersonalizationTab />}
                </div>
            </div>
        {ConfirmEl}
        </div>
    );
}