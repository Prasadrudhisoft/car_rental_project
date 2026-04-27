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
// export const verifyPayment = (bookingId, data) =>
//   api.post(`/bookings/${bookingId}/payment/verify/`, data);
// export const signAgreement = (bookingId, step, otpCode) =>
//   api.post(`/bookings/${bookingId}/sign/`, { step, otp_code: otpCode });

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
// payment_type: "advance" | "full" | "remaining"
// method:       "cash" | "upi" | "online"
export const dummyPayment = (bookingId, { payment_type = "advance", method = "online", amount } = {}) =>
  api.post(`/bookings/${bookingId}/payment/dummy/`, {
    payment_type,
    method,
    ...(amount != null ? { amount } : {}),
  });
 
// Keep the Razorpay verify endpoint for future production use
export const verifyPayment = (bookingId, data) =>
  api.post(`/bookings/${bookingId}/payment/verify/`, data);
 
export const signAgreement = (bookingId, step, otpCode, version) =>
  api.post(`/bookings/${bookingId}/sign/`, { step, otp_code: otpCode, version_id: version });
 
 
// NEW: full booking detail for vendor (includes inspections, addons, invoice)
export const getVendorBookingDetail = (id) =>
  api.get(`/bookings/vendor/${id}/`);
 
// Fetch the currently active T&C version (called when sign modal opens)
export const getActiveAgreement = () =>
  api.get("/agreements/active/");
 
// Fetch a specific version by ID (used to display what a customer signed)
export const getAgreementVersion = (versionId) =>
  api.get(`/agreements/versions/${versionId}/`);
 
// Record the customer's acceptance (called after OTP verify succeeds)
export const recordAgreementAcceptance = (data) =>
  api.post("/agreements/accept/", data);
// data shape: { version_id, booking_id (optional), otp_verified, acceptance_method }
 
// Customer's full acceptance history
export const getMyAgreementHistory = () =>
  api.get("/agreements/my-history/");
 
// ── Admin Agreement Management ────────────────────────────────────────
// List all versions / create new version
export const getAdminAgreementVersions = () =>
  api.get("/agreements/admin/versions/");
 
export const createAgreementVersion = (data) =>
  api.post("/agreements/admin/versions/", data);
// data shape: { version_tag, title, content, summary, effective_from }
 
// Edit a draft version (blocked by backend once it has acceptances)
export const updateAgreementVersion = (id, data) =>
  api.patch(`/agreements/admin/versions/${id}/`, data);
 
// Activate (publish) a version — makes it the live T&C
export const activateAgreementVersion = (id) =>
  api.post(`/agreements/admin/versions/${id}/activate/`);
 
// Full acceptance audit log
export const getAdminAcceptances = (params) =>
  api.get("/agreements/admin/acceptances/", { params });
// params: { version_id, user_id, booking_id }



export default api;