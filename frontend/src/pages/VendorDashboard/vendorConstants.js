// ─────────────────────────────────────────────────────────────────────────────
// vendorConstants.js
// Colour maps, lookup tables, pure helpers shared across all vendor sub-components.
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_CLR = {
    PENDING:   { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
    ACTIVE:    { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' },
    COMPLETED: { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
    CANCELLED: { bg: '#FEE2E2', color: '#EF4444', border: '#FCA5A5' },
};

export const VEHICLE_STATUS_CLR = {
    LIVE:           { bg: '#D1FAE5', color: '#059669' },
    PENDING_DOCS:   { bg: '#FEF3C7', color: '#D97706' },
    DOCS_SUBMITTED: { bg: '#DBEAFE', color: '#1D4ED8' },
    ADMIN_APPROVED: { bg: '#EDE9FE', color: '#7C3AED' },
    CERTIFIED:      { bg: '#D1FAE5', color: '#059669' },
    INACTIVE:       { bg: '#FEE2E2', color: '#EF4444' },
};

export const HANDOVER_STATUS_CLR = {
    EXPECTED:  { bg: '#FEF3C7', color: '#D97706' },
    RECEIVED:  { bg: '#DBEAFE', color: '#1D4ED8' },
    INSPECTED: { bg: '#EDE9FE', color: '#7C3AED' },
    HELD:      { bg: '#F3F4F6', color: '#6B7280' },
    SUBLISTED: { bg: '#D1FAE5', color: '#059669' },
    RETRIEVED: { bg: '#F3F4F6', color: '#9CA3AF' },
};

export const SEGMENTS  = ['hatchback', 'sedan', 'suv', 'luxury', 'van', 'truck'];
export const FUELS     = ['petrol', 'diesel', 'electric', 'hybrid', 'cng'];
export const ANGLES    = ['front', 'rear', 'left', 'right', 'interior', 'dashboard', 'boot', 'other'];
export const DOC_TYPES = ['rc', 'insurance', 'puc', 'fitness', 'mechanic_cert'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function isKYCComplete(profile) {
    if (!profile) return false;
    return !!(profile.bank_account_no && profile.city_id && profile.latitude && profile.longitude);
}

export const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDatetime = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};