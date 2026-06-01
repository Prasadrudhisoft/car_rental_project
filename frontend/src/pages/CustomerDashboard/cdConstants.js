// ─────────────────────────────────────────────────────────────────────────────
// cdConstants.js
// Colour maps, status constants, and pure helpers shared across all
// CustomerDashboard sub-components.
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_CLR = {
    PENDING:   { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' },
    CONFIRMED: { bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
    ACTIVE:    { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' },
    COMPLETED: { bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
    CANCELLED: { bg: '#FEE2E2', color: '#EF4444', border: '#FCA5A5' },
};

// ── Date / time helpers ────────────────────────────────────────────────────
export function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

export function fmtDatetime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}