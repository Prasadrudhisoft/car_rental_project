import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sidebar }  from '../../components/common/Navbar';
import Navbar        from '../../components/common/Navbar';
import DataTable     from '../../components/common/DataTable';
import '../../components/common/DataTable.css';

// ── API ───────────────────────────────────────────────────────────────────────
import {
    getVendorBookings, getVendorProfile, updateVendorProfile, uploadVendorKYC,
    getVendorAnalytics, getMyVehicles, createVehicle,
    toggleVehicleStatus, blockAvailability, unblockAvailability, getVehicleAvailability,
    getVendorNetwork, joinNetwork, leaveNetwork, getCities, getCityLocations,
    getMyHandovers, getVendorBookingDetail, fetchVendorReviews,
} from '../../services/api';

// ── Sub-components ────────────────────────────────────────────────────────────
import { Toast, KYCGateBanner }    from './VendorShared';
import BookingDetailPanel          from './BookingDetailPanel';
import VehicleManageModal          from './modals/VehicleManageModal';
import HandoverDetailModal         from './modals/HandoverDetailModal';
import ReviewDetailModal           from './modals/ReviewDetailModal';

// ── Tabs ──────────────────────────────────────────────────────────────────────
import OverviewTab  from './tabs/OverviewTab';
import BookingsTab  from './tabs/BookingsTab';
import FleetTab     from './tabs/FleetTab';
import HandoversTab from './tabs/HandoversTab';
import NetworkTab   from './tabs/NetworkTab';
import ReviewsTab   from './tabs/ReviewsTab';
import ProfileTab   from './tabs/ProfileTab';

// ── CSS ───────────────────────────────────────────────────────────────────────
import './VendorDashboard.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
import { isKYCComplete } from './vendorConstants';

const KYC_REQUIRED_TABS = ['bookings', 'fleet', 'network', 'handovers'];

// ─────────────────────────────────────────────────────────────────────────────
export default function VendorDashboard() {
    const { user } = useAuth();
    const [tab, setTab] = useState('overview');

    // ── Data state ────────────────────────────────────────────────────────────
    const [bookings,      setBookings]      = useState([]);
    const [vehicles,      setVehicles]      = useState([]);
    const [analytics,     setAnalytics]     = useState(null);
    const [profile,       setProfile]       = useState(null);
    const [network,       setNetwork]       = useState([]);
    const [handovers,     setHandovers]     = useState([]);
    const [cities,        setCities]        = useState([]);
    const [cityLocations, setCityLocations] = useState([]);
    const [vendorReviews, setVendorReviews] = useState([]);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [toast,        setToast]        = useState(null);
    const [showAddVehicle, setShowAddVehicle] = useState(false);

    // ── Vehicle form state ────────────────────────────────────────────────────
    const [vehicleForm, setVehicleForm] = useState({
        make: '', model: '', year: new Date().getFullYear(), colour: '',
        plate_number: '', segment: 'sedan', fuel_type: 'petrol',
        transmission: 'manual', capacity: 5, daily_rate: '',
        city: '', pickup_location: '', odometer_at_listing: 0,
    });
    const vf = k => e => setVehicleForm(p => ({ ...p, [k]: e.target.value }));

    // ── Doc / photo / availability state (passed into VehicleManageModal) ─────
    const [docUploads,   setDocUploads]   = useState({});
    const [photoUpload,  setPhotoUpload]  = useState({ file: null, angle: 'front', is_cover: false });
    const [availData,    setAvailData]    = useState({});
    const [blockInput,   setBlockInput]   = useState({});

    // ── Profile / KYC form state ──────────────────────────────────────────────
    const [profileEdit,  setProfileEdit]  = useState(false);
    const [profileForm,  setProfileForm]  = useState({});
    const [kycForm,      setKycForm]      = useState({
        aadhaar_number: '', pan_number: '', bank_account_name: '',
        bank_account_no: '', bank_ifsc: '', shop_opening_time: '',
        shop_closing_time: '', addr_line1: '', addr_line2: '', addr_line3: '',
        city: '', country: 'India', pincode: '', latitude: '', longitude: '',
    });
    const [kycFile,         setKycFile]         = useState(null);
    const [kycStateDisplay, setKycStateDisplay] = useState('');
    const [showMap,         setShowMap]         = useState(false);

    // ── Network form state ────────────────────────────────────────────────────
    const [networkForm, setNetworkForm] = useState({ city: '', max_vehicles: 3, handling_fee_override: '' });

    // ── Booking status filter ─────────────────────────────────────────────────
    const [bookingStatusFilter, setBookingStatusFilter] = useState('');

    // ── Modals ────────────────────────────────────────────────────────────────
    const [selectedBooking,  setSelectedBooking]  = useState(null);
    const [bookingDetail,    setBookingDetail]    = useState(null);
    const [selectedVehicle,  setSelectedVehicle]  = useState(null);
    const [selectedHandover, setSelectedHandover] = useState(null);
    const [handoverNotes,    setHandoverNotes]    = useState({});
    const [handoverPhotoFile,setHandoverPhotoFile]= useState({});

    // ── Helpers ───────────────────────────────────────────────────────────────
    const showToast   = useCallback((msg, type = 'success') => setToast({ msg, type }), []);
    const goToKYC     = useCallback(() => setTab('profile'), []);
    const kycComplete = isKYCComplete(profile);
    const showKYCGate = KYC_REQUIRED_TABS.includes(tab) && !kycComplete && profile !== null;

    // ── City locations (for vehicle form) ─────────────────────────────────────
    const loadCityLocations = useCallback(async (cityId) => {
        if (!cityId) { setCityLocations([]); return; }
        try {
            const { data } = await getCityLocations(cityId);
            setCityLocations(data.results || data);
        } catch { setCityLocations([]); }
    }, []);

    useEffect(() => {
        if (vehicleForm.city) loadCityLocations(vehicleForm.city);
    }, [vehicleForm.city, loadCityLocations]);

    // Auto-fill state display from selected city
    useEffect(() => {
        if (!kycForm.city) { setKycStateDisplay(''); return; }
        const found = cities.find(c => String(c.id) === String(kycForm.city));
        setKycStateDisplay(found ? found.state : '');
    }, [kycForm.city, cities]);

    // ── Tab data loading ──────────────────────────────────────────────────────
    const loadTab = useCallback(async (t) => {
        setLoading(true);
        setError('');
        try {
            const cityRes = await getCities();
            setCities(cityRes.data.results || cityRes.data);

            if (t === 'overview' || t === 'bookings') {
                const [b, a] = await Promise.all([
                    getVendorBookings(bookingStatusFilter || undefined),
                    getVendorAnalytics(),
                ]);
                setBookings(b.data.results || b.data);
                setAnalytics(a.data);
            }
            if (t === 'fleet') {
                const { data } = await getMyVehicles();
                setVehicles(data.results || data);
            }
            if (t === 'profile') {
                const { data } = await getVendorProfile();
                setProfile(data);
                setProfileForm({ shop_opening_time: data.shop_opening_time || '', shop_closing_time: data.shop_closing_time || '' });
                setKycForm({
                    aadhaar_number:    data.aadhaar_number    || '',
                    pan_number:        data.pan_number        || '',
                    bank_account_name: data.bank_account_name || '',
                    bank_account_no:   data.bank_account_no   || '',
                    bank_ifsc:         data.bank_ifsc         || '',
                    shop_opening_time: data.shop_opening_time || '',
                    shop_closing_time: data.shop_closing_time || '',
                    addr_line1:        data.addr_line1        || '',
                    addr_line2:        data.addr_line2        || '',
                    addr_line3:        data.addr_line3        || '',
                    city:    data.city_id ? String(data.city_id) : '',
                    country: data.country || 'India',
                    pincode: data.pincode || '',
                    latitude:  data.latitude  ? parseFloat(Number(data.latitude).toFixed(7))  : '',
                    longitude: data.longitude ? parseFloat(Number(data.longitude).toFixed(7)) : '',
                });
                if (data.state) setKycStateDisplay(data.state);
            }
            if (t === 'network') {
                const { data } = await getVendorNetwork();
                setNetwork(data.results || data);
            }
            if (t === 'handovers') {
                const { data } = await getMyHandovers();
                setHandovers(data.results || data);
            }
            if (t === 'reviews') {
                const { data } = await fetchVendorReviews(user.id, 'recency');
                setVendorReviews(data.results || data);
            }
        } catch (e) {
            setError(`Could not load ${t}. ${e.response?.data?.detail || e.message || ''}`);
        }
        setLoading(false);
    }, [bookingStatusFilter, user?.id]);

    useEffect(() => { loadTab(tab); }, [tab]);  // eslint-disable-line

    // Load profile silently on mount (for KYC gate and hero badges)
    useEffect(() => {
        getVendorProfile()
            .then(({ data }) => setProfile(data))
            .catch(() => {});
    }, []);

    // Re-fetch bookings when status filter changes
    useEffect(() => {
        if (tab === 'bookings' || tab === 'overview') {
            getVendorBookings(bookingStatusFilter || undefined)
                .then(({ data }) => setBookings(data.results || data))
                .catch(() => {});
        }
    }, [bookingStatusFilter]); // eslint-disable-line

    // ── Booking actions ───────────────────────────────────────────────────────
    const openBookingDetail = async (booking) => {
        setSelectedBooking(booking);
        try {
            const { data } = await getVendorBookingDetail(booking.id);
            setBookingDetail(data);
        } catch { setBookingDetail(booking); }
    };

    const refreshBookingDetail = useCallback(async () => {
        if (!selectedBooking) return;
        try {
            const [detail, list] = await Promise.all([
                getVendorBookingDetail(selectedBooking.id),
                getVendorBookings(bookingStatusFilter || undefined),
            ]);
            setBookingDetail(detail.data);
            setBookings(list.data.results || list.data);
        } catch { showToast('Could not refresh.', 'error'); }
    }, [selectedBooking, bookingStatusFilter, showToast]);

    // ── Vehicle actions ───────────────────────────────────────────────────────
    const handleAddVehicle = async (e) => {
        e.preventDefault();
        try {
            const fd = new FormData();
            Object.entries(vehicleForm).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
            const { data } = await createVehicle(fd);
            setVehicles(p => [data, ...p]);
            setShowAddVehicle(false);
            showToast('Vehicle registered! Upload RC, Insurance, PUC and 10+ photos to go LIVE.');
        } catch (e) {
            showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.', 'error');
        }
    };

    const handleToggleVehicle = async (vehicleId) => {
        try {
            const { data } = await toggleVehicleStatus(vehicleId);
            setVehicles(p => p.map(v => v.id === vehicleId ? { ...v, status: data.status } : v));
            showToast(`Vehicle ${data.status}.`);
        } catch (e) { showToast(e.response?.data?.error || 'Toggle failed.', 'error'); }
    };

    const loadAvailability = async (vehicleId) => {
        try {
            const { data } = await getVehicleAvailability(vehicleId, new Date().toISOString().slice(0, 7));
            setAvailData(p => ({ ...p, [vehicleId]: data }));
        } catch { showToast('Could not load availability.', 'error'); }
    };

    const handleBlock = async (vehicleId) => {
        const dates = (blockInput[vehicleId] || '').split(',').map(d => d.trim()).filter(Boolean);
        if (!dates.length) { showToast('Enter comma-separated dates.', 'error'); return; }
        try {
            await blockAvailability(vehicleId, dates);
            await loadAvailability(vehicleId);
            setBlockInput(p => ({ ...p, [vehicleId]: '' }));
            showToast(`${dates.length} date(s) blocked.`);
        } catch { showToast('Failed.', 'error'); }
    };

    const handleUnblock = async (vehicleId, date) => {
        try {
            await unblockAvailability(vehicleId, [date]);
            await loadAvailability(vehicleId);
            showToast('Date unblocked.');
        } catch { showToast('Could not unblock.', 'error'); }
    };

    // ── Profile / KYC actions ─────────────────────────────────────────────────
    const handleProfileSave = async () => {
        try {
            await updateVendorProfile(profileForm);
            showToast('Profile updated.');
            setProfileEdit(false);
            await loadTab('profile');
        } catch { showToast('Update failed.', 'error'); }
    };

    const handleKYCSubmit = async (e) => {
        e.preventDefault();
        if (!kycForm.city)                          { showToast('Select a city.', 'error'); return; }
        if (!kycForm.latitude || !kycForm.longitude){ showToast('Pin your location on the map.', 'error'); return; }
        const fd = new FormData();
        ['aadhaar_number','pan_number','bank_account_name','bank_account_no','bank_ifsc',
         'shop_opening_time','shop_closing_time','addr_line1','addr_line2','addr_line3',
         'city','country','pincode','latitude','longitude'].forEach(k => { if (kycForm[k]) fd.append(k, kycForm[k]); });
        if (kycFile) fd.append('kyc_document', kycFile);
        try {
            await uploadVendorKYC(fd);
            showToast('KYC submitted!');
            await loadTab('profile');
        } catch (e) { showToast(e.response?.data ? JSON.stringify(e.response.data) : 'Failed.', 'error'); }
    };

    // ── Network actions ───────────────────────────────────────────────────────
    const handleJoinNetwork = async (e) => {
        e.preventDefault();
        if (!networkForm.city) { showToast('Select a city.', 'error'); return; }
        try {
            await joinNetwork({ city: networkForm.city, max_vehicles: networkForm.max_vehicles, handling_fee_override: networkForm.handling_fee_override || null });
            showToast('Joined!');
            await loadTab('network');
        } catch (e) { showToast(e.response?.data?.error || 'Failed.', 'error'); }
    };

    const handleLeaveNetwork = async (id) => {
        if (!window.confirm('Leave this city network?')) return;
        try {
            await leaveNetwork(id);
            setNetwork(p => p.filter(n => n.id !== id));
            showToast('Left.');
        } catch { showToast('Failed.', 'error'); }
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const liveVehicleCount = vehicles.filter(v => v.status === 'LIVE').length;
    const totalRevenue     = parseFloat(analytics?.total_revenue || 0);
    const heldHandovers    = handovers.filter(h => ['RECEIVED', 'HELD'].includes(h.status)).length;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="vd">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            {/* ── Modals ─────────────────────────────────────────────────────── */}
            {selectedBooking && bookingDetail && (
                <div className="vd-modal-overlay" onClick={() => { setSelectedBooking(null); setBookingDetail(null); }}>
                    <div className="vd-modal" style={{ maxWidth: 900, padding: 0 }} onClick={e => e.stopPropagation()}>
                        <BookingDetailPanel
                            booking={bookingDetail}
                            onClose={() => { setSelectedBooking(null); setBookingDetail(null); }}
                            onRefresh={refreshBookingDetail}
                            showToast={showToast}
                        />
                    </div>
                </div>
            )}

            {selectedVehicle && (
                <VehicleManageModal
                    vehicle={selectedVehicle}
                    onClose={() => setSelectedVehicle(null)}
                    showToast={showToast}
                    onRefresh={async () => {
                        const { data } = await getMyVehicles();
                        const list = data.results || data;
                        setVehicles(list);
                        setSelectedVehicle(prev => list.find(v => v.id === prev?.id) || prev);
                    }}
                    docUploads={docUploads}           setDocUploads={setDocUploads}
                    photoUpload={photoUpload}          setPhotoUpload={setPhotoUpload}
                    availData={availData[selectedVehicle.id]}
                    blockInput={blockInput[selectedVehicle.id] || ''}
                    onBlockInputChange={val => setBlockInput(p => ({ ...p, [selectedVehicle.id]: val }))}
                    onLoadAvail={loadAvailability}
                    onBlock={handleBlock}
                    onUnblock={handleUnblock}
                    onStatusToggle={() => handleToggleVehicle(selectedVehicle.id)}
                />
            )}

            {selectedHandover && (
                <HandoverDetailModal
                    handover={selectedHandover}
                    onClose={() => setSelectedHandover(null)}
                    showToast={showToast}
                    onRefresh={async () => {
                        const { data } = await getMyHandovers();
                        setHandovers(data.results || data);
                        setSelectedHandover(null);
                    }}
                    handoverNotes={handoverNotes}         setHandoverNotes={setHandoverNotes}
                    handoverPhotoFile={handoverPhotoFile} setHandoverPhotoFile={setHandoverPhotoFile}
                />
            )}

            <div className="page-shell">
                <div className="vd__inner">

                    {/* ── Hero ──────────────────────────────────────────────── */}
                    <div className="vd__hero">
                        <div className="vd__hero-banner" />
                        <div className="vd__hero-body">
                            <div className="vd__hero-left">
                                <div className="vd__hero-avatar">
                                    {(profile?.business_name || user?.full_name || 'V')[0].toUpperCase()}
                                </div>
                                <div className="vd__hero-info">
                                    <div className="vd__hero-name">
                                        Welcome back, {(profile?.business_name || user?.full_name || 'Vendor')?.split(' ')[0]}
                                    </div>
                                    <div className="vd__hero-meta">
                                        <span style={{ fontSize: 12, color: '#000' }}>{user?.email}</span>
                                        <span className="vd-badge" style={{
                                            background: profile?.status === 'approved' ? '#D1FAE5' : '#FEF3C7',
                                            color:      profile?.status === 'approved' ? '#059669' : '#D97706',
                                            border:     profile?.status === 'approved' ? '1px solid #6EE7B7' : '1px solid #FCD34D',
                                        }}>
                                            {profile?.status || 'pending'}
                                        </span>
                                        {profile?.rating > 0 && (
                                            <span className="vd-badge" style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D' }}>
                                                ★ {profile.rating}
                                            </span>
                                        )}
                                        {profile && !kycComplete && (
                                            <button
                                                className="vd-badge vd-kyc-hero-alert"
                                                style={{ background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5', cursor: 'pointer' }}
                                                onClick={goToKYC}
                                            >
                                                ⚠ Complete KYC
                                            </button>
                                        )}
                                        {profile && kycComplete && (
                                            <span className="vd-badge" style={{ background: '#D1FAE5', color: '#059669', border: '1px solid #6EE7B7' }}>✓ KYC Done</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="vd__kpis">
                                {[
                                    [`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 'Revenue',   '#0DB89E'],
                                    [analytics?.booking_count || 0,                                            'Bookings',  '#1D4ED8'],
                                    [liveVehicleCount,                                                         'Live Cars', '#059669'],
                                    [heldHandovers || '—',                                                     'Held Cars', '#D97706'],
                                ].map(([v, l, color]) => (
                                    <div key={l} className="vd__kpi">
                                        <span className="vd__kpi-val" style={{ color }}>{v}</span>
                                        <span className="vd__kpi-lbl">{l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Status ────────────────────────────────────────────── */}
                    {loading && (
                        <div className="vd-loading"><div className="vd-spinner" /> Loading…</div>
                    )}
                    {error && <div className="vd-error">{error}</div>}

                    {/* ── Tab content ───────────────────────────────────────── */}
                    {!loading && (
                        <div className="vd__content">
                            {showKYCGate ? (
                                <KYCGateBanner onGoToKYC={goToKYC} />
                            ) : (
                                <>
                                    {tab === 'overview' && (
                                        <OverviewTab
                                            analytics={analytics}
                                            bookings={bookings}
                                            profile={profile}
                                            kycComplete={kycComplete}
                                            onGoToKYC={goToKYC}
                                            onOpenBooking={openBookingDetail}
                                            onGoToBookings={() => setTab('bookings')}
                                        />
                                    )}

                                    {tab === 'bookings' && (
                                        <BookingsTab
                                            bookings={bookings}
                                            onOpenBooking={openBookingDetail}
                                        />
                                    )}

                                    {tab === 'fleet' && (
                                        <FleetTab
                                            vehicles={vehicles}
                                            showAddVehicle={showAddVehicle}
                                            setShowAddVehicle={setShowAddVehicle}
                                            vehicleForm={vehicleForm}
                                            vf={vf}
                                            cities={cities}
                                            cityLocations={cityLocations}
                                            onAddVehicle={handleAddVehicle}
                                            onSelectVehicle={setSelectedVehicle}
                                        />
                                    )}

                                    {tab === 'handovers' && (
                                        <HandoversTab
                                            handovers={handovers}
                                            onSelectHandover={setSelectedHandover}
                                        />
                                    )}

                                    {tab === 'network' && (
                                        <NetworkTab
                                            network={network}
                                            cities={cities}
                                            networkForm={networkForm}
                                            setNetworkForm={setNetworkForm}
                                            onJoinNetwork={handleJoinNetwork}
                                            onLeaveNetwork={handleLeaveNetwork}
                                        />
                                    )}

                                    {tab === 'reviews' && (
                                        <ReviewsTab
                                            userId={user?.id}
                                            profile={profile}
                                            initialReviews={vendorReviews}
                                            initialOrdering="recency"
                                        />
                                    )}

                                    {tab === 'profile' && profile && (
                                        <ProfileTab
                                            profile={profile}
                                            profileEdit={profileEdit}
                                            setProfileEdit={setProfileEdit}
                                            profileForm={profileForm}
                                            setProfileForm={setProfileForm}
                                            onProfileSave={handleProfileSave}
                                            kycForm={kycForm}
                                            setKycForm={setKycForm}
                                            kycFile={kycFile}
                                            setKycFile={setKycFile}
                                            kycStateDisplay={kycStateDisplay}
                                            showMap={showMap}
                                            setShowMap={setShowMap}
                                            cities={cities}
                                            onKYCSubmit={handleKYCSubmit}
                                            kycComplete={kycComplete}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}