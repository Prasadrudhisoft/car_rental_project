// ─────────────────────────────────────────────────────────────────────────────
// tabs/BookingsTab.jsx
// Customer bookings list rendered as a DataTable.
// Clicking "View Booking" opens BookingDetailModal in the parent.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import DataTable from '../../../components/common/DataTable';
import { StatusBadge } from '../cdShared';
import { STATUS_CLR, fmtDate } from '../cdConstants';

export default function BookingsTab({ bookings, onViewBooking }) {
    const columns = [
        {
            key: 'booking_ref', label: 'Booking Ref', sortable: true, width: 150,
            render: v => (
                <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--cd-acc)',
                }}>
                    {v}
                </span>
            ),
        },
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">
                        {v || `${row.vehicle?.make || ''} ${row.vehicle?.model || ''}`.trim() || '—'}
                    </span>
                    <span
                        className="dt-cell-stack__secondary"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}
                    >
                        {row.vehicle?.plate_number || ''}
                    </span>
                </div>
            ),
        },
        {
            key: 'status', label: 'Status', sortable: true, width: 110,
            render: val => <StatusBadge status={val} />,
        },
        { key: 'pickup_date', label: 'Pickup', sortable: true, width: 100, render: v => v || '—' },
        { key: 'return_date', label: 'Return', sortable: true, width: 100, render: v => v || '—' },
        {
            key: 'rental_days', label: 'Days', sortable: true,
            width: 55, align: 'center', render: v => v ?? '—',
        },
        {
            key: 'payment_captured', label: 'Paid', sortable: true,
            width: 55, align: 'center',
            render: v => v
                ? <span style={{ color: '#059669', fontWeight: 700, fontSize: 13 }}>✓</span>
                : <span style={{ color: '#EF4444', fontSize: 13 }}>✕</span>,
        },
        {
            key: 'agreement_signed', label: 'Signed', sortable: true,
            width: 65, align: 'center',
            render: v => v
                ? <span style={{ color: '#059669', fontWeight: 700 }}>✍</span>
                : <span style={{ color: '#D1D5DB' }}>—</span>,
        },
        {
            key: 'created_at', label: 'Booked On', sortable: true, width: 110,
            render: v => fmtDate(v),
        },
    ];

    return (
        <div className="cd-section">
            <DataTable
                columns={columns}
                data={bookings}
                searchable
                searchKeys={['booking_ref', 'vehicle_display', 'status']}
                searchPlaceholder="Search by booking ref, vehicle…"
                filters={[
                    {
                        key: 'status', label: 'Status',
                        options: [
                            { value: '',          label: 'All Bookings' },
                            { value: 'PENDING',   label: 'Pending',   color: '#D97706' },
                            { value: 'CONFIRMED', label: 'Confirmed', color: '#1D4ED8' },
                            { value: 'ACTIVE',    label: 'Active',    color: '#059669' },
                            { value: 'COMPLETED', label: 'Completed', color: '#6B7280' },
                            { value: 'CANCELLED', label: 'Cancelled', color: '#EF4444' },
                        ],
                        colorMap: STATUS_CLR,
                    },
                    {
                        key: 'payment_captured', label: 'Payment',
                        options: [
                            { value: '',      label: 'All'    },
                            { value: 'true',  label: 'Paid'   },
                            { value: 'false', label: 'Unpaid' },
                        ],
                    },
                ]}
                onRowAction={row => onViewBooking(row)}
                actionLabel="View Booking"
                emptyIcon="📅"
                emptyMessage="No bookings yet. Browse cars and make your first booking."
                pageSize={15}
            />
        </div>
    );
}