import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        const { data } = await axios.post(`${BASE_URL}/users/token/refresh/`, { refresh });
        localStorage.setItem("access_token", data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  api.post("/users/login/", { email, password });
export const registerCustomer = (data) =>
  api.post("/users/register/customer/", data);
export const registerVendor = (data) =>
  api.post("/users/register/vendor/", data);
export const logout = (refresh) =>
  api.post("/users/logout/", { refresh });
export const getMe = () =>
  api.get("/users/me/");
export const updateMe = (data) =>
  api.patch("/users/me/", data);

// ── OTP ───────────────────────────────────────────────────────────────────
export const sendOTP = (email, purpose) =>
  api.post("/otp/send/", { email, purpose });
export const verifyOTP = (email, code, purpose) =>
  api.post("/otp/verify/", { email, code, purpose });

// ── Cities ────────────────────────────────────────────────────────────────
export const getCities = () =>
  api.get("/locations/cities/");
export const getCityLocations = (cityId) =>
  api.get(`/locations/cities/${cityId}/locations/`);
export const createCity = (data) =>
  api.post("/locations/cities/", data);
export const deleteCity = (id) =>
  api.delete(`/locations/cities/${id}/`);

// ── Locations ─────────────────────────────────────────────────────────────
export const getLocations = (params) =>
  api.get("/locations/locations/", { params });
export const createLocation = (data) =>
  api.post("/locations/locations/", data);
export const updateLocation = (id, data) =>
  api.patch(`/locations/locations/${id}/`, data);
export const deleteLocation = (id) =>
  api.delete(`/locations/locations/${id}/`);
export const getVendorLocations = (cityId) =>
  api.get("/locations/vendor-locations/", { params: { city: cityId } });

// ── City Pair Fees ────────────────────────────────────────────────────────
export const getCityPairFees = () =>
  api.get("/locations/fees/");
export const createCityPairFee = (data) =>
  api.post("/locations/fees/", data);
export const updateCityPairFee = (id, data) =>
  api.patch(`/locations/fees/${id}/`, data);
export const deleteCityPairFee = (id) =>
  api.delete(`/locations/fees/${id}/`);
export const getOneWayFee = (fromCity, toCity) =>
  api.get("/bookings/one-way-fee/", { params: { from_city: fromCity, to_city: toCity } });

// ── Vehicles — Public ─────────────────────────────────────────────────────
export const searchVehicles = (params) =>
  api.get("/vehicles/search/", { params });
export const getVehicleDetail = (id) =>
  api.get(`/vehicles/${id}/`);
export const scanVehicleQR = (vehicleIdCode) =>
  api.get(`/vehicles/qr/${vehicleIdCode}/`);

// ── Vehicles — Vendor ─────────────────────────────────────────────────────
export const getMyVehicles = () =>
  api.get("/vehicles/vendor/");
export const getMyVehicleDetail = (id) =>
  api.get(`/vehicles/vendor/${id}/`);
export const createVehicle = (data) =>
  api.post("/vehicles/vendor/", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const updateVehicle = (id, data) =>
  api.patch(`/vehicles/vendor/${id}/`, data);
export const toggleVehicleStatus = (id) =>
  api.post(`/vehicles/vendor/${id}/toggle/`);
export const uploadVehicleDoc = (vehicleId, formData) =>
  api.post(`/vehicles/${vehicleId}/docs/upload/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const uploadVehiclePhoto = (vehicleId, formData) =>
  api.post(`/vehicles/${vehicleId}/photos/upload/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const getVehicleAvailability = (vehicleId, month) =>
  api.get(`/vehicles/${vehicleId}/availability/`, { params: { month } });
export const blockAvailability = (vehicleId, dates) =>
  api.post(`/vehicles/${vehicleId}/availability/block/`, { dates });
export const unblockAvailability = (vehicleId, dates) =>
  api.post(`/vehicles/${vehicleId}/availability/unblock/`, { dates });

// ── Vehicles — Admin ──────────────────────────────────────────────────────
export const getAdminVehicles = (status) =>
  api.get("/vehicles/admin/", { params: status ? { status } : {} });
export const getAdminVehicleStats = () =>
  api.get("/vehicles/admin/stats/");
export const reviewDoc = (docId, action, note) =>
  api.post(`/vehicles/admin/docs/${docId}/review/`, { action, note });
export const certifyVehicle = (vehicleId, formData) =>
  api.post(`/vehicles/admin/${vehicleId}/certify/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const blacklistVehicle = (vehicleId, reason) =>
  api.post(`/vehicles/admin/${vehicleId}/blacklist/`, { reason });
export const vahanCheck = (vehicleId) =>
  api.post(`/vehicles/admin/${vehicleId}/vahan-check/`);
export const flagQRTamper = (vehicleId) =>
  api.post(`/vehicles/admin/${vehicleId}/flag-qr/`);
export const setVehicleStatus = (vehicleId, status, note = '') =>
  api.post(`/vehicles/admin/${vehicleId}/set-status/`, { status, note });

// ── Pricing ───────────────────────────────────────────────────────────────
export const calculatePrice = (data) =>
  api.post("/bookings/price-preview/", data);

// ── Bookings — Customer ───────────────────────────────────────────────────
export const createBooking = (data) =>
  api.post("/bookings/create/", data);
export const getMyBookings = (status) =>
  api.get("/bookings/my/", { params: status ? { status } : {} });
export const getMyBookingDetail = (id) =>
  api.get(`/bookings/my/${id}/`);
export const cancelBooking = (id, reason) =>
  api.post(`/bookings/${id}/cancel/`, { reason });

// ── Bookings — Vendor ─────────────────────────────────────────────────────
export const getVendorBookings = (status) =>
  api.get("/bookings/vendor/", { params: status ? { status } : {} });

// ── Bookings — Admin ──────────────────────────────────────────────────────
export const getAdminBookings = (params) =>
  api.get("/bookings/admin/", { params });

// ── Inspections ───────────────────────────────────────────────────────────
export const createInspection = (bookingId, inspectionType, data) =>
  api.post(`/bookings/${bookingId}/inspect/${inspectionType}/`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const signInspection = (bookingId, inspectionType, step, otpCode) =>
  api.post(`/bookings/${bookingId}/inspect/${inspectionType}/sign/`, {
    step,
    otp_code: otpCode,
  });
export const uploadInspectionPhoto = (inspectionId, formData) =>
  api.post(`/bookings/inspections/${inspectionId}/photos/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const raiseDamageClaim = (bookingId, data) =>
  api.post(`/bookings/${bookingId}/damage-claim/`, data);

// ── Analytics ─────────────────────────────────────────────────────────────
export const getVendorAnalytics = (params) =>
  api.get("/bookings/analytics/vendor/", { params });
export const getAdminAnalytics = (params) =>
  api.get("/bookings/analytics/admin/", { params });

// ── Loyalty ───────────────────────────────────────────────────────────────
export const getLoyaltyBalance = () =>
  api.get("/bookings/loyalty/balance/");
export const redeemLoyalty = (pointsToRedeem) =>
  api.post("/bookings/loyalty/redeem/", { points_to_redeem: pointsToRedeem });

// ── Push Notifications ────────────────────────────────────────────────────
export const savePushSubscription = (subscriptionData) =>
  api.post("/bookings/push/subscribe/", subscriptionData);
export const deletePushSubscription = (endpoint) =>
  api.post("/bookings/push/unsubscribe/", { endpoint });

// ── Users — Vendor ────────────────────────────────────────────────────────
export const getVendorProfile = () =>
  api.get("/users/vendor/profile/");
export const updateVendorProfile = (data) =>
  api.patch("/users/vendor/profile/", data);
export const uploadVendorKYC = (formData) =>
  api.patch("/users/vendor/kyc/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// ── Users — Customer ──────────────────────────────────────────────────────
export const getCustomerProfile = () =>
  api.get("/users/profile/");
export const updateCustomerProfile = (data) =>
  api.patch("/users/profile/", data);
export const getSavedAddresses = () =>
  api.get("/users/addresses/");
export const createSavedAddress = (data) =>
  api.post("/users/addresses/", data);
export const updateSavedAddress = (id, data) =>
  api.patch(`/users/addresses/${id}/`, data);
export const deleteSavedAddress = (id) =>
  api.delete(`/users/addresses/${id}/`);

// ── Users — Admin ─────────────────────────────────────────────────────────
export const getAdminUsers = (params) =>
  api.get("/users/admin/users/", { params });
export const getAdminVendors = (params) =>
  api.get("/users/admin/vendors/", { params });
export const adminVendorAction = (id, action, note) =>
  api.post(`/users/admin/vendors/${id}/action/`, { action, note });
export const getAdminStats = () =>
  api.get("/users/admin/stats/");

// ── Logistics — Vendor ────────────────────────────────────────────────────
export const getVendorNetwork = () =>
  api.get("/logistics/network/my/");
export const joinNetwork = (data) =>
  api.post("/logistics/network/opt-in/", data);
export const leaveNetwork = (id) =>
  api.delete(`/logistics/network/${id}/`);
export const getMyHandovers = () =>
  api.get("/logistics/my-held/");
export const confirmHandoverReceipt = (handoverId, notes) =>
  api.post(`/logistics/handovers/${handoverId}/confirm/`, { notes });
export const uploadHandoverPhoto = (handoverId, formData) =>
  api.post(`/logistics/handovers/${handoverId}/photos/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const completeHandoverInspection = (handoverId) =>
  api.post(`/logistics/handovers/${handoverId}/inspection-complete/`);
export const arrangeHandoverRetrieval = (handoverId) =>
  api.post(`/logistics/handovers/${handoverId}/retrieval/`);
export const grantSublistPermission = (handoverId) =>
  api.post(`/logistics/handovers/${handoverId}/grant-sublist/`);
export const revokeSublistPermission = (handoverId) =>
  api.post(`/logistics/handovers/${handoverId}/revoke-sublist/`);
export const getRevenueShare = (bookingId) =>
  api.get(`/logistics/revenue-share/${bookingId}/`);

// ── Logistics — Admin ─────────────────────────────────────────────────────
export const getReturnPoints = (params) =>
  api.get("/logistics/return-points/", { params });
export const createReturnPoint = (data) =>
  api.post("/logistics/return-points/", data);
export const deleteReturnPoint = (id) =>
  api.delete(`/logistics/return-points/${id}/`);
export const getAdminNetworkList = (city) =>
  api.get("/logistics/network/", { params: city ? { city } : {} });
export const adminManualMatch = (data) =>
  api.post("/logistics/admin/manual-match/", data);
export const getAdminLogisticsOverview = (params) =>
  api.get("/logistics/admin/overview/", { params });
export const getAdminLogisticsStats = () =>
  api.get("/logistics/admin/stats/");

// ── Promos ────────────────────────────────────────────────────────────────
export const validatePromo = (code, bookingTotal) =>
  api.post("/promos/validate/", { code, booking_total: bookingTotal });
export const getAdminPromos = () =>
  api.get("/promos/admin/");
export const createPromo = (data) =>
  api.post("/promos/admin/", data);
export const updatePromo = (id, data) =>
  api.patch(`/promos/admin/${id}/`, data);
export const deletePromo = (id) =>
  api.delete(`/promos/admin/${id}/`);

// ── Reviews ───────────────────────────────────────────────────────────────
export const submitReview = (data) =>
  api.post("/reviews/submit/", data);
export const getPendingReviews = () =>
  api.get("/reviews/pending/");
export const getVendorReviews = (vendorId, params) =>
  api.get(`/reviews/vendor/${vendorId}/`, { params });
export const getVehicleReviews = (vehicleId) =>
  api.get(`/reviews/vehicle/${vehicleId}/`);

// ── Configuration — Admin ─────────────────────────────────────────────────
export const getConfigSettings = (params) =>
  api.get("/configuration/settings/", { params });
export const updateConfigSetting = (id, value, changeReason) =>
  api.patch(`/configuration/settings/${id}/`, { value, change_reason: changeReason });
export const getConfigSettingHistory = (id) =>
  api.get(`/configuration/settings/${id}/history/`);
export const getSegmentConfigs = () =>
  api.get("/configuration/segments/");
export const updateSegmentConfig = (id, data) =>
  api.patch(`/configuration/segments/${id}/`, data);

// ── DUMMY PAYMENT (dev) — replaces Razorpay ───────────────────────────────
export const dummyPayment = (bookingId, { payment_type = "advance", method = "online", amount } = {}) =>
  api.post(`/bookings/${bookingId}/payment/dummy/`, {
    payment_type,
    method,
    ...(amount != null ? { amount } : {}),
  });

export const verifyPayment = (bookingId, data) =>
  api.post(`/bookings/${bookingId}/payment/verify/`, data);

export const signAgreement = (bookingId, step, otpCode, version) =>
  api.post(`/bookings/${bookingId}/sign/`, { step, otp_code: otpCode, version_id: version });

export const getVendorBookingDetail = (id) =>
  api.get(`/bookings/vendor/${id}/`);

export const getActiveAgreement = () =>
  api.get("/agreements/active/");
export const getAgreementVersion = (versionId) =>
  api.get(`/agreements/versions/${versionId}/`);
export const recordAgreementAcceptance = (data) =>
  api.post("/agreements/accept/", data);
export const getMyAgreementHistory = () =>
  api.get("/agreements/my-history/");

export const getAdminAgreementVersions = () =>
  api.get("/agreements/admin/versions/");
export const createAgreementVersion = (data) =>
  api.post("/agreements/admin/versions/", data);
export const updateAgreementVersion = (id, data) =>
  api.patch(`/agreements/admin/versions/${id}/`, data);
export const activateAgreementVersion = (id) =>
  api.post(`/agreements/admin/versions/${id}/activate/`);
export const getAdminAcceptances = (params) =>
  api.get("/agreements/admin/acceptances/", { params });


// ════════════════════════════════════════════════════════════════════════
// NEW: KYC Phone & Email OTP Verification
// ════════════════════════════════════════════════════════════════════════
//
// TWO INTERCHANGEABLE IMPLEMENTATIONS:
//   - HARDCODED (dev): active by default, OTP is always "123456"
//   - REAL (prod): uses backend /otp/ endpoints
//
// To switch to production:
//   1. Comment out the HARDCODED block below
//   2. Uncomment the REAL block below
//   No other changes needed anywhere in the codebase.
//
// ════════════════════════════════════════════════════════════════════════

// ── HARDCODED (DEV) — ACTIVE ──────────────────────────────────────────────

/**
 * Send OTP to customer's phone number for KYC verification.
 * DEV: Always succeeds, OTP is "123456" (logged to console).
 * @param {string} phone - The phone number to send OTP to
 * @param {string} email - The user's email (used to look up the account)
 */
export const sendKYCPhoneOTP = async (phone, email) => {
  console.log(`[DEV] KYC Phone OTP → ${phone} (account: ${email}). Use 123456`);
  // Simulate network delay
  await new Promise(r => setTimeout(r, 400));
  return { data: { message: `OTP sent to ${phone}. Use 123456 in development.` } };
};

/**
 * Verify OTP entered by customer for phone KYC.
 * DEV: Accepts "123456" only.
 * @param {string} email - The user's email (account identifier)
 * @param {string} code - The 6-digit OTP entered by the user
 */
export const verifyKYCPhoneOTP = async (email, code) => {
  await new Promise(r => setTimeout(r, 400));
  if (code === "123456") {
    return { data: { valid: true, message: "Phone number verified successfully." } };
  }
  const err = new Error("Invalid OTP");
  err.response = { data: { error: "Invalid OTP. In development, use 123456." } };
  throw err;
};

/**
 * Send OTP to customer's email address for KYC verification.
 * DEV: Always succeeds, OTP is "123456" (logged to console).
 * @param {string} email - The email address to verify
 */
export const sendKYCEmailOTP = async (email) => {
  console.log(`[DEV] KYC Email OTP → ${email}. Use 123456`);
  await new Promise(r => setTimeout(r, 400));
  return { data: { message: `OTP sent to ${email}. Use 123456 in development.` } };
};

/**
 * Verify OTP entered by customer for email KYC.
 * DEV: Accepts "123456" only.
 * @param {string} email - The email address being verified
 * @param {string} code - The 6-digit OTP entered by the user
 */
export const verifyKYCEmailOTP = async (email, code) => {
  await new Promise(r => setTimeout(r, 400));
  if (code === "123456") {
    return { data: { valid: true, message: "Email address verified successfully." } };
  }
  const err = new Error("Invalid OTP");
  err.response = { data: { error: "Invalid OTP. In development, use 123456." } };
  throw err;
};


// ── REAL (PRODUCTION) — COMMENT OUT DEV BLOCK ABOVE AND UNCOMMENT THIS ───
//
// export const sendKYCPhoneOTP = (phone, email) =>
//   // Uses the existing OTP infrastructure with purpose='phone_verify'.
//   // The backend's SendOTPView looks up the user by email and sends the code.
//   api.post("/otp/send/", { email, purpose: "phone_verify" });
//
// export const verifyKYCPhoneOTP = (email, code) =>
//   // On success the backend sets user.is_phone_verified = True automatically.
//   api.post("/otp/verify/", { email, code, purpose: "phone_verify" });
//
// export const sendKYCEmailOTP = (email) =>
//   // Reuses phone_verify purpose for email OTP until a dedicated
//   // 'email_verify' purpose is added to the backend OTPRecord model.
//   api.post("/otp/send/", { email, purpose: "phone_verify" });
//
// export const verifyKYCEmailOTP = (email, code) =>
//   api.post("/otp/verify/", { email, code, purpose: "phone_verify" });


// ════════════════════════════════════════════════════════════════════════
// NEW: Customer submitted reviews (read-only listing of own reviews)
// ════════════════════════════════════════════════════════════════════════

/**
 * Fetch all reviews submitted by the currently logged-in customer.
 *
 * The existing backend has no dedicated "my reviews" endpoint, so we
 * derive the list by fetching completed bookings.  Each completed
 * booking's detail includes a `review` sub-object when present.
 *
 * We accept a pre-loaded list of completed booking details to avoid
 * redundant network calls from the dashboard, or fetch them here.
 *
 * Usage in CustomerDashboard:
 *   const reviews = await getMySubmittedReviews(completedBookingDetails);
 */
export const getMySubmittedReviews = async (completedBookingDetails = []) => {
  // Extract reviews from already-fetched booking detail objects
  const reviews = completedBookingDetails
    .filter(b => b.review)
    .map(b => ({
      booking_id:      b.id,
      booking_ref:     b.booking_ref,
      vehicle_display: b.vehicle_display ||
        `${b.vehicle?.year || ''} ${b.vehicle?.make || ''} ${b.vehicle?.model || ''}`.trim(),
      return_date:     b.return_date,
      vendor_rating:   b.review.vendor_rating,
      vehicle_rating:  b.review.vehicle_rating,
      review_text:     b.review.review_text,
      created_at:      b.review.created_at,
    }));
  return { data: { results: reviews } };
};


// ════════════════════════════════════════════════════════════════════════
// NEW: Admin / Vendor — fetch reviews for a specific vendor
// (wraps the existing public endpoint with a cleaner name for dashboard use)
// ════════════════════════════════════════════════════════════════════════

/**
 * Fetch all visible reviews for a vendor (used by AdminDashboard and VendorDashboard).
 * @param {number|string} vendorId
 * @param {'recency'|'rating'} ordering
 */
export const fetchVendorReviews = (vendorId, ordering = 'recency') =>
  api.get(`/reviews/vendor/${vendorId}/`, { params: { ordering } });

// ── Admin Profile & Scope ──────────────────────────────────────────────
export const getMyAdminProfile = () =>
    api.get('/users/admin/me/');
 
export const updateMyAdminProfile = (data) =>
    api.patch('/users/admin/me/', data);
 
// ── Admin Management (superadmin only) ────────────────────────────────
export const getAdminList = () =>
    api.get('/users/admin/admins/');
 
// ── Assignment Management (superadmin only) ────────────────────────────
export const assignVendorToAdmin = (vendorId, adminId, notes = '') =>
    api.post('/users/admin/assign-vendor/', {
        vendor_id: vendorId,
        admin_id: adminId,
        notes,
    });
 
export const unassignVendor = (vendorId) =>
    api.post('/users/admin/unassign-vendor/', { vendor_id: vendorId });
 
export const bulkAssignVendors = (vendorIds, adminId, notes = '') =>
    api.post('/users/admin/bulk-assign/', {
        vendor_ids: vendorIds,
        admin_id: adminId,
        notes,
    });
 
export const getAllAssignments = (adminId = null) =>
    api.get('/users/admin/assignments/', {
        params: adminId ? { admin_id: adminId } : {},
    });
 
export const getAssignmentHistory = (vendorId = null) =>
    api.get('/users/admin/assignment-history/', {
        params: vendorId ? { vendor_id: vendorId } : {},
    });
 
export const getMyAssignedVendors = () =>
    api.get('/users/admin/my-vendors/');

export const getAvailableSegments = (params) =>
  api.get('/vehicles/segments/', { params });
 

export default api;