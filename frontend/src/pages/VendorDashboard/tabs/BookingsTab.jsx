// ─────────────────────────────────────────────────────────────────────────────
// tabs/BookingsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import DataTable from '../../../components/common/DataTable';
import { StatusBadge } from '../VendorShared';
import { STATUS_CLR } from '../vendorConstants';

export default function BookingsTab({ bookings, onOpenBooking }) {
    const columns = [
        {
            key: 'booking_ref', label: 'Booking Ref', sortable: true, width: 150,
            render: v => (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--vacc)' }}>{v}</span>
            ),
        },
        {
            key: 'customer_name', label: 'Customer', sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || row.customer?.full_name || '—'}</span>
                    <span className="dt-cell-stack__secondary">{row.customer_email || row.customer?.email || ''}</span>
                </div>
            ),
        },
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true, width: 170,
            render: v => v || '—',
        },
        {
            key: 'status', label: 'Status', sortable: true, width: 110,
            render: val => <StatusBadge status={val} />,
        },
        { key: 'pickup_date', label: 'Pickup', sortable: true, width: 100, render: v => v || '—' },
        { key: 'return_date', label: 'Return', sortable: true, width: 100, render: v => v || '—' },
        { key: 'rental_days', label: 'Days',   sortable: true, width: 60,  align: 'center', render: v => v ?? '—' },
        {
            key: 'total_amount', label: 'Total', sortable: true, width: 110, align: 'right',
            render: v => <span className="dt-currency">₹{parseFloat(v || 0).toLocaleString('en-IN')}</span>,
        },
        {
            key: 'payment_captured', label: 'Paid', sortable: true, width: 60, align: 'center',
            render: v => v
                ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                : <span style={{ color: '#EF4444' }}>✕</span>,
        },
        {
            key: 'agreement_signed', label: 'Signed', sortable: true, width: 65, align: 'center',
            render: v => v
                ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                : <span style={{ color: '#D1D5DB' }}>—</span>,
        },
    ];

    return (
        <div className="vd-section">
            <DataTable
                columns={columns}
                data={bookings}
                searchable
                searchKeys={['booking_ref', 'customer_name', 'customer_email', 'vehicle_display']}
                searchPlaceholder="Search by ref, customer, vehicle…"
                filters={[{
                    key: 'status', label: 'Status',
                    options: [
                        { value: '',          label: 'All'       },
                        { value: 'PENDING',   label: 'Pending'   },
                        { value: 'CONFIRMED', label: 'Confirmed' },
                        { value: 'ACTIVE',    label: 'Active'    },
                        { value: 'COMPLETED', label: 'Completed' },
                        { value: 'CANCELLED', label: 'Cancelled' },
                    ],
                    colorMap: STATUS_CLR,
                }]}
                onRowAction={row => onOpenBooking(row)}
                actionLabel="View Booking"
                emptyIcon="📅"
                emptyMessage="No bookings yet."
                pageSize={20}
            />
        </div>
    );
}