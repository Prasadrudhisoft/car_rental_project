import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sidebar }  from '../../components/common/Navbar';
import NotificationsPanel from '../../components/notifications/NotificationsPanel';
import Navbar        from '../../components/common/Navbar';

// ── API ───────────────────────────────────────────────────────────────────────
import {
    getMyBookings, getMyBookingDetail,
    getLoyaltyBalance, getCustomerProfile,
    getPendingReviews,
    getMySubmittedReviews,
} from '../../services/api';

// ── Shared primitives ─────────────────────────────────────────────────────────
import { Toast } from './cdShared';

// ── Modals ────────────────────────────────────────────────────────────────────
import BookingDetailModal from './modals/BookingDetailModal';
import WriteReviewModal   from './modals/WriteReviewModal';
import ViewReviewModal    from './modals/ViewReviewModal';
import KYCVerifyModal     from './modals/KYCVerifyModal';

// ── Tabs ──────────────────────────────────────────────────────────────────────
import BookingsTab  from './tabs/BookingsTab';
import ReviewsTab   from './tabs/ReviewsTab';
import MyReviewsTab from './tabs/MyReviewsTab';
import LoyaltyTab   from './tabs/LoyaltyTab';
import ProfileTab   from './tabs/ProfileTab';

// ── CSS ───────────────────────────────────────────────────────────────────────
import './CustomerDashboard.css';
import '../../components/common/DataTable.css';

// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerDashboard() {
    const { user, refreshUser } = useAuth();
    const [tab, setTab] = useState('bookings');

    // ── Data ──────────────────────────────────────────────────────────────────
    const [bookings,          setBookings]          = useState([]);
    const [loyalty,           setLoyalty]           = useState(null);
    const [profile,           setProfile]           = useState(null);
    const [pendingReviews,    setPendingReviews]    = useState([]);
    const [submittedReviews,  setSubmittedReviews]  = useState([]);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [loading,                 setLoading]                 = useState(true);
    const [error,                   setError]                   = useState('');
    const [toast,                   setToast]                   = useState(null);
    const [submittedReviewsLoading, setSubmittedReviewsLoading] = useState(false);

    // ── Booking detail cache ───────────────────────────────────────────────────
    const [bookingDetails, setBookingDetails] = useState({});
    const [detailLoading,  setDetailLoading]  = useState(false);

    // ── Modal open state ──────────────────────────────────────────────────────
    const [selectedBooking,        setSelectedBooking]        = useState(null);
    const [selectedPendingReview,  setSelectedPendingReview]  = useState(null);
    const [selectedSubmittedReview,setSelectedSubmittedReview]= useState(null);
    const [kycModal,               setKycModal]               = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const highlightRef = useRef(null);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
    }, []);

    useEffect(() => {
        if (location.state?.toast) {
            showToast(location.state.toast);
            navigate(location.pathname + location.search, { replace: true, state: null });
        }
    }, []); // eslint-disable-line

    // ── Load submitted reviews ────────────────────────────────────────────────
    const loadSubmittedReviews = useCallback(async () => {
        setSubmittedReviewsLoading(true);
        try {
            const { data: completedData } = await getMyBookings('COMPLETED');
            const completedList = completedData.results || completedData;
            const detailPromises = completedList
                .slice(0, 20)
                .map(b => getMyBookingDetail(b.id).then(r => r.data).catch(() => null));
            const details = (await Promise.all(detailPromises)).filter(Boolean);
            const { data } = await getMySubmittedReviews(details);
            setSubmittedReviews(data.results || []);
        } catch {
            showToast('Could not load submitted reviews.', 'error');
        } finally {
            setSubmittedReviewsLoading(false);
        }
    }, [showToast]);

    // ── Tab data loading ──────────────────────────────────────────────────────
    const loadTab = useCallback(async t => {
        setLoading(true);
        setError('');
        try {
            if (t === 'bookings') {
                const { data } = await getMyBookings();
                setBookings(data.results || data);

            } else if (t === 'profile') {
                const [p, l] = await Promise.all([
                    getCustomerProfile(),
                    getLoyaltyBalance(),
                ]);
                setProfile(p.data);
                setLoyalty(l.data);

            } else if (t === 'loyalty') {
                const { data } = await getLoyaltyBalance();
                setLoyalty(data);

            } else if (t === 'reviews') {
                const { data } = await getPendingReviews();
                setPendingReviews(data.pending_reviews || data.results || data);

            } else if (t === 'my-reviews') {
                await loadSubmittedReviews();
            }
        } catch (e) {
            setError(`Could not load data. ${e.response?.data?.detail || ''}`);
        } finally {
            setLoading(false);
        }
    }, [loadSubmittedReviews]);

    useEffect(() => { loadTab(tab); }, [tab, loadTab]);

    // Pre-load bookings + loyalty for hero KPIs on mount
    useEffect(() => {
        Promise.all([getMyBookings(), getLoyaltyBalance()])
            .then(([b, l]) => {
                setBookings(b.data.results || b.data);
                setLoyalty(l.data);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && tabParam !== tab) setTab(tabParam);
        const highlight = searchParams.get('highlight');
        if (highlight) highlightRef.current = highlight;
    }, [searchParams]);


    useEffect(() => {
        if (tab === 'bookings' && highlightRef.current && bookings.length > 0) {
            const match = bookings.find((b) => String(b.id) === String(highlightRef.current));
            if (match) openBookingDetail(match);
            highlightRef.current = null;
            const next = new URLSearchParams(searchParams);
            next.delete('highlight');
            setSearchParams(next, { replace: true });
        }
    }, [bookings, tab]);

    // ── Open booking detail (with caching) ───────────────────────────────────
    const openBookingDetail = async booking => {
        setSelectedBooking(booking);
        if (!bookingDetails[booking.id]) {
            setDetailLoading(true);
            try {
                const { data } = await getMyBookingDetail(booking.id);
                setBookingDetails(prev => ({ ...prev, [booking.id]: data }));
            } catch {
                showToast('Could not load booking details.', 'error');
            } finally {
                setDetailLoading(false);
            }
        }
    };

    // ── Refresh booking after action (sign, pay, cancel, inspect) ────────────
    const refreshBooking = useCallback(async bookingId => {
        try {
            const [detailRes, listRes] = await Promise.all([
                getMyBookingDetail(bookingId),
                getMyBookings(),
            ]);
            setBookingDetails(prev => ({ ...prev, [bookingId]: detailRes.data }));
            setBookings(listRes.data.results || listRes.data);
            setSelectedBooking(prev =>
                prev?.id === bookingId
                    ? { ...prev, ...(listRes.data.results?.find(b => b.id === bookingId) || {}) }
                    : prev,
            );
        } catch {
            showToast('Could not refresh booking.', 'error');
        }
    }, [showToast]);

    // ── KYC verified callback ─────────────────────────────────────────────────
    const handleKYCVerified = async type => {
        setKycModal(null);
        try {
            const [{ data }] = await Promise.all([getCustomerProfile(), refreshUser()]);
            setProfile(data);
        } catch {}
        showToast(`${type === 'phone' ? 'Phone number' : 'Email address'} verified successfully!`);
    };

    // ── Derived KPIs for hero strip ───────────────────────────────────────────
    const activeCount    = bookings.filter(b => ['CONFIRMED', 'ACTIVE'].includes(b.status)).length;
    const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;
    const totalSpend     = bookings
        .filter(b => !['CANCELLED', 'PENDING'].includes(b.status))
        .reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="cd">
            <Navbar hideLogo />
            <Sidebar activeTab={tab} onTabChange={setTab} />

            {/* Toast */}
            {toast && (
                <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
            )}

            {/* KYC OTP Modal */}
            {kycModal && (
                <KYCVerifyModal
                    type={kycModal.type}
                    value={kycModal.value}
                    userEmail={profile?.email || user?.email || ''}
                    onClose={() => setKycModal(null)}
                    onVerified={() => handleKYCVerified(kycModal.type)}
                    showToast={showToast}
                />
            )}

            {/* Booking detail modal — only via "View Booking" button */}
            {selectedBooking && (
                <BookingDetailModal
                    booking={selectedBooking}
                    detail={bookingDetails[selectedBooking.id]}
                    loading={detailLoading && !bookingDetails[selectedBooking.id]}
                    onRefresh={() => refreshBooking(selectedBooking.id)}
                    showToast={showToast}
                    onClose={() => setSelectedBooking(null)}
                />
            )}

            {/* Write review modal */}
            {selectedPendingReview && (
                <WriteReviewModal
                    booking={selectedPendingReview}
                    onClose={() => setSelectedPendingReview(null)}
                    onSubmitted={bookingId =>
                        setPendingReviews(p => p.filter(b => b.booking_id !== bookingId))
                    }
                    showToast={showToast}
                />
            )}

            {/* View submitted review modal */}
            {selectedSubmittedReview && (
                <ViewReviewModal
                    review={selectedSubmittedReview}
                    onClose={() => setSelectedSubmittedReview(null)}
                />
            )}

            {/* ── Page shell ── */}
            <div className="cd__shell">
                <div className="cd__inner">

                    {/* ── Hero banner ── */}
                    <div className="cd__hero">
                        <div className="cd__hero-banner" />
                        <div className="cd__hero-body">
                            <div className="cd__hero-left">
                                <div className="cd__hero-avatar">
                                    {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
                                </div>
                                <div className="cd__hero-info">
                                    <div className="cd__hero-name">
                                        Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
                                    </div>
                                    <div className="cd__hero-sub">{user?.email}</div>
                                </div>
                            </div>
                            <div className="cd__kpis">
                                {[
                                    [activeCount,                                                         'Active Bookings', '#1D4ED8'],
                                    [completedCount,                                                      'Completed',       '#059669'],
                                    [`₹${Math.round(totalSpend).toLocaleString('en-IN')}`,               'Total Spend',     '#0DB89E'],
                                    [loyalty ? `${loyalty.loyalty_points}` : '—',                        'Loyalty Pts',     '#D97706'],
                                ].map(([v, l, color]) => (
                                    <div key={l} className="cd__kpi">
                                        <span className="cd__kpi-val" style={{ color }}>{v}</span>
                                        <span className="cd__kpi-lbl">{l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Loading / error states ── */}
                    {loading && tab !== 'my-reviews' && (
                        <div className="cd-loading">
                            <div className="cd-spinner" /> Loading…
                        </div>
                    )}
                    {error && <div className="cd-error">{error}</div>}

                    {/* ── Tab content ── */}
                    {!loading && tab === 'bookings' && (
                        <BookingsTab
                            bookings={bookings}
                            onViewBooking={openBookingDetail}
                        />
                    )}

                    {!loading && tab === 'reviews' && (
                        <ReviewsTab
                            pendingReviews={pendingReviews}
                            onWriteReview={row => setSelectedPendingReview(row)}
                        />
                    )}

                    {tab === 'my-reviews' && (
                        <MyReviewsTab
                            submittedReviews={submittedReviews}
                            loading={submittedReviewsLoading}
                            onViewReview={row => setSelectedSubmittedReview(row)}
                        />
                    )}

                    {!loading && tab === 'loyalty' && (
                        <LoyaltyTab
                            loyalty={loyalty}
                            onLoyaltyUpdate={newBalance =>
                                setLoyalty(p => ({ ...p, loyalty_points: newBalance }))
                            }
                            showToast={showToast}
                        />
                    )}

                    {!loading && tab === 'profile' && profile && (
                        <ProfileTab
                            profile={profile}
                            user={user}
                            onProfileSaved={updates =>
                                setProfile(p => ({ ...p, ...updates }))
                            }
                            onOpenKYCModal={(type, value) =>
                                setKycModal({ type, value })
                            }
                            showToast={showToast}
                        />
                    )}

                    {tab === 'notifications' && <NotificationsPanel />}
                </div>
            </div>
        </div>
    );
}