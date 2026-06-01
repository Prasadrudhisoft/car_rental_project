// ─────────────────────────────────────────────────────────────────────────────
// AdminDashboard.jsx  (main entry point)
//
// This file is now a lean orchestrator:
//   • Owns all top-level state (data, modals, tab)
//   • Loads data per tab via loadTab()
//   • Delegates ALL rendering to imported sub-components
//
// Folder structure:
//   pages/admindashboard/
//   ├── AdminDashboard.jsx          ← you are here
//   ├── adminConstants.js           ← colour maps, helpers, PK extractors
//   ├── AdminShared.jsx             ← StatusBadge, SectionCard, InlineForm, …
//   ├── MediaComponents.jsx         ← PhotoLightbox, KYCDocumentCell, DocPreviewRow
//   ├── VendorDetailModal.jsx
//   ├── VehicleDetailModal.jsx
//   ├── BookingDetailModal.jsx
//   ├── UserDetailModal.jsx
//   ├── ReviewDetailModal.jsx
//   ├── AdminAssignmentCard.jsx
//   ├── AssignmentsTab.jsx
//   └── tabs/
//       ├── OverviewTab.jsx
//       ├── VendorsTab.jsx
//       ├── VehiclesTab.jsx
//       ├── BookingsTab.jsx
//       ├── UsersTab.jsx
//       ├── LocationsTab.jsx
//       ├── LogisticsTab.jsx
//       ├── ConfigTab.jsx
//       ├── PromosTab.jsx
//       ├── AgreementsTab.jsx
//       └── ReviewsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";

// ── API ───────────────────────────────────────────────────────────────────────
import {
    getAdminStats, getAdminAnalytics,
    getAdminVendors, adminVendorAction,
    getAdminVehicles, getAdminVehicleStats,
    reviewDoc, certifyVehicle, blacklistVehicle, vahanCheck, setVehicleStatus,
    getAdminBookings,
    getAdminUsers,
    getConfigSettings, updateConfigSetting,
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
    getMyAdminProfile,
} from "../../services/api";

// ── Layout ────────────────────────────────────────────────────────────────────
import { Sidebar } from "../../components/common/Navbar";
import Navbar      from "../../components/common/Navbar";

// ── Shared primitives ─────────────────────────────────────────────────────────
import { ScopeIndicator } from "./AdminShared";
import { PhotoLightbox }  from "./MediaComponents";

// ── Modals ────────────────────────────────────────────────────────────────────
import VendorDetailModal  from "./modals/VendorDetailModal";
import VehicleDetailModal from "./modals/VehicleDetailModal";
import BookingDetailModal from "./modals/BookingDetailModal";
import UserDetailModal    from "./modals/UserDetailModal";
import ReviewDetailModal  from "./modals/ReviewDetailModal";

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

// ── CSS ───────────────────────────────────────────────────────────────────────
import "./AdminDashboard.css";
import "../../components/common/DataTable.css";

// ─────────────────────────────────────────────────────────────────────────────
const TAB_LABELS = {
    overview: "Overview", vendors: "Vendors", vehicles: "Vehicles",
    bookings: "Bookings", users: "Users",     locations: "Locations",
    logistics: "Logistics", config: "Config", promos: "Promos",
    agreements: "Agreements", reviews: "Reviews", assignments: "Assignments",
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
                    const [c, sg] = await Promise.all([getConfigSettings(), getSegmentConfigs()]);
                    setConfigs(c.data.results ?? c.data); setSegments(sg.data.results ?? sg.data);
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
                    const [h, ls, nw, rp, c] = await Promise.all([
                        getAdminLogisticsOverview(), getAdminLogisticsStats(),
                        getAdminNetworkList(), getReturnPoints(), getCities(),
                    ]);
                    setHandovers(h.data.results ?? h.data); setLogisticsStats(ls.data);
                    setNetwork(nw.data.results ?? nw.data); setReturnPoints(rp.data.results ?? rp.data);
                    setCities(c.data.results ?? c.data);
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
    useEffect(() => { if (tab === "vehicles") loadTab("vehicles"); }, [vehicleFilter]); // eslint-disable-line

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

    // ── Config actions ────────────────────────────────────────────────────────
    const handleConfigSave  = async (s) => { try { await updateConfigSetting(s.id, s.value); alert("Saved."); } catch { alert("Save failed."); } };
    const handleSegmentSave = async (seg) => {
        try { await updateSegmentConfig(seg.id, { security_deposit: seg.security_deposit, min_driver_age: seg.min_driver_age, min_rental_days: seg.min_rental_days }); alert("Segment saved."); }
        catch { alert("Save failed."); }
    };

    // ── Location actions ──────────────────────────────────────────────────────
    const handleAddCity          = async (v) => { setFormLoading(true); try { await createCity(v); await loadTab("locations"); } catch (e) { alert(JSON.stringify(e.response?.data || "Failed.")); } setFormLoading(false); };
    const handleDeleteCity       = async (id) => { if (!window.confirm("Delete?")) return; try { await deleteCity(id); setCities((p) => p.filter((c) => c.id !== id)); } catch { alert("Failed."); } };
    const handleDeleteLocation   = async (id) => { if (!window.confirm("Delete?")) return; try { await deleteLocation(id); setLocations((p) => p.filter((l) => l.id !== id)); } catch { alert("Failed."); } };
    const handleAddCityPairFee   = async (v) => { setFormLoading(true); try { await createCityPairFee(v); await loadTab("locations"); } catch { alert("Failed."); } setFormLoading(false); };
    const handleDeleteCityPairFee= async (id) => { if (!window.confirm("Delete?")) return; try { await deleteCityPairFee(id); setCityPairFees((p) => p.filter((f) => f.id !== id)); } catch { alert("Failed."); } };

    // ── Promo actions ─────────────────────────────────────────────────────────
    const handleAddPromo    = async (v) => { setFormLoading(true); try { await createPromo(v); await loadTab("promos"); } catch (e) { alert(JSON.stringify(e.response?.data || "Failed.")); } setFormLoading(false); };
    const handleDeletePromo = async (id) => { if (!window.confirm("Delete?")) return; try { await deletePromo(id); setPromos((p) => p.filter((x) => x.id !== id)); } catch { alert("Failed."); } };

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
                                        [stats.total_vehicles,   "Vehicles",  "#059669"],
                                        [stats.total_bookings,   "Bookings",  "#6B7280"],
                                        [stats.active_bookings,  "Active",    "#059669"],
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
                            formLoading={formLoading}
                            onAddReturnPoint={handleAddReturnPoint}
                        />
                    )}

                    {!loading && tab === "config" && (
                        <ConfigTab
                            configs={configs}
                            segments={segments}
                            setConfigs={setConfigs}
                            setSegments={setSegments}
                            onConfigSave={handleConfigSave}
                            onSegmentSave={handleSegmentSave}
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
                </div>
            </div>
        </div>
    );
}
