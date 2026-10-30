// ─────────────────────────────────────────────────────────────────────────────
// adminConstants.js
// Colour maps, status constants, and tiny pure helpers shared across all
// admin sub-components.  Import from here instead of re-defining per file.
// ─────────────────────────────────────────────────────────────────────────────

export const VENDOR_STATUS_CLR = {
    approved:  { bg: "#D1FAE5", color: "#059669" },
    pending:   { bg: "#FEF3C7", color: "#D97706" },
    suspended: { bg: "#FEE2E2", color: "#EF4444" },
    rejected:  { bg: "#FEE2E2", color: "#B91C1C" },
    more_info: { bg: "#EDE9FE", color: "#7C3AED" },
};

export const VEHICLE_STATUS_CLR = {
    LIVE:           { bg: "#D1FAE5", color: "#059669" },
    PENDING_DOCS:   { bg: "#FEF3C7", color: "#D97706" },
    DOCS_SUBMITTED: { bg: "#DBEAFE", color: "#1D4ED8" },
    ADMIN_APPROVED: { bg: "#EDE9FE", color: "#7C3AED" },
    CERTIFIED:      { bg: "#D1FAE5", color: "#059669" },
    INACTIVE:       { bg: "#FEE2E2", color: "#EF4444" },
};

export const BOOKING_STATUS_CLR = {
    PENDING:   { bg: "#FEF3C7", color: "#D97706" },
    CONFIRMED: { bg: "#DBEAFE", color: "#1D4ED8" },
    ACTIVE:    { bg: "#D1FAE5", color: "#059669" },
    COMPLETED: { bg: "#F3F4F6", color: "#6B7280" },
    CANCELLED: { bg: "#FEE2E2", color: "#EF4444" },
};

export const HANDOVER_STATUS_CLR = {
    EXPECTED:  { bg: "#FEF3C7", color: "#D97706" },
    RECEIVED:  { bg: "#DBEAFE", color: "#1D4ED8" },
    INSPECTED: { bg: "#EDE9FE", color: "#7C3AED" },
    HELD:      { bg: "#F3F4F6", color: "#6B7280" },
    SUBLISTED: { bg: "#D1FAE5", color: "#059669" },
    RETRIEVED: { bg: "#F3F4F6", color: "#9CA3AF" },
};

export const KYC_STATUS_CLR = {
    pending:  { bg: "#FEF3C7", color: "#D97706" },
    verified: { bg: "#D1FAE5", color: "#059669" },
    rejected: { bg: "#FEE2E2", color: "#EF4444" },
};

export const ADDON_LABELS = {
    insurance_basic:          "Basic Insurance",
    insurance_comprehensive:  "Comprehensive Insurance",
    personal_accident:        "Personal Accident",
    child_seat:               "Child Seat",
    gps:                      "GPS Device",
    additional_driver:        "Additional Driver",
};

export const REQUIRED_DOCS = [
    { key: "rc",            label: "RC Book",               required: true },
    { key: "insurance",     label: "Insurance",             required: true },
    { key: "puc",           label: "PUC Certificate",       required: true },
    { key: "fitness",       label: "Fitness Certificate",   required: true },
    { key: "mechanic_cert", label: "Mechanic Certificate",  required: true },
];

export const PIPELINE_STEPS = [
    { status: "PENDING_DOCS",   label: "Pending Docs",   step: 1 },
    { status: "DOCS_SUBMITTED", label: "Docs Submitted", step: 2 },
    { status: "ADMIN_APPROVED", label: "Admin Approved", step: 3 },
    { status: "LIVE",           label: "Live",           step: 4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date / time formatters
// ─────────────────────────────────────────────────────────────────────────────
export const fmtDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
};

export const fmtDatetime = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// KYC completeness checker
// ─────────────────────────────────────────────────────────────────────────────
export function getKYCStatus(vendor) {
    const checks = {
        bank:     !!vendor.bank_account_no,
        city:     !!vendor.city_id,
        location: !!(vendor.latitude && vendor.longitude),
        document: !!vendor.kyc_document,
        identity: !!(vendor.aadhaar_number || vendor.pan_number),
    };
    const done  = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return { checks, done, total, complete: done === total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor PK extractor — handles all serializer shapes
// ─────────────────────────────────────────────────────────────────────────────
export function getVendorPK(v) {
    if (v == null) return null;
    // Shape 1 (patched backend): explicit user_id field
    if (v.user_id != null) {
        const n = Number(v.user_id);
        if (!isNaN(n) && n > 0) return n;
    }
    // Shape 2: user as nested object  { id: 5, ... }
    if (v.user != null && typeof v.user === "object" && v.user.id != null) {
        const n = Number(v.user.id);
        if (!isNaN(n) && n > 0) return n;
    }
    // Shape 3: user as flat integer
    if (v.user != null && typeof v.user === "number" && v.user > 0) return v.user;
    return null;
}

export function getAdminPK(a) {
    if (a == null) return null;
    if (a.user_id != null) return Number(a.user_id) || null;
    if (a.id      != null) return Number(a.id)      || null;
    return null;
}
