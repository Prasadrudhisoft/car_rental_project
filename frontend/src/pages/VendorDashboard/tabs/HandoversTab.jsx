// ─────────────────────────────────────────────────────────────────────────────
// tabs/HandoversTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import DataTable from '../../../components/common/DataTable';
import { StatusBadge } from '../VendorShared';
import { HANDOVER_STATUS_CLR } from '../vendorConstants';

export default function HandoversTab({ handovers, onSelectHandover }) {
    const columns = [
        {
            key: 'vehicle_display', label: 'Vehicle', sortable: true, width: 180,
            render: (v, row) => (
                <div className="dt-cell-stack">
                    <span className="dt-cell-stack__primary">{v || '—'}</span>
                    <span className="dt-cell-stack__secondary">{row.booking_ref}</span>
                </div>
            ),
        },
        { key: 'originating_vendor_name', label: 'From Vendor',  sortable: true,  width: 160, render: v => v || '—' },
        { key: 'return_point_name',       label: 'Return Point', sortable: true,  width: 140, render: v => v ? `📍 ${v}` : '—' },
        {
            key: 'status', label: 'Status', sortable: true, width: 110,
            render: val => <StatusBadge status={val} statusMap={HANDOVER_STATUS_CLR} />,
        },
        {
            key: 'days_held', label: 'Days Held', sortable: true, width: 90, align: 'center',
            render: v => v
                ? <span style={{ color: v > 3 ? '#D97706' : 'inherit', fontWeight: v > 3 ? 700 : 400 }}>{v}d</span>
                : '—',
        },
        {
            key: 'handover_photos_uploaded', label: 'Photos', sortable: false, width: 70, align: 'center',
            render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : '—',
        },
        {
            key: 'full_inspection_done', label: 'Inspected', sortable: false, width: 80, align: 'center',
            render: v => v ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : '—',
        },
    ];

    return (
        <div className="vd-section">
            <DataTable
                columns={columns}
                data={handovers}
                searchable
                searchKeys={['vehicle_display', 'booking_ref', 'originating_vendor_name']}
                searchPlaceholder="Search handovers…"
                filters={[{
                    key: 'status', label: 'Status',
                    options: [
                        { value: '',          label: 'All'       },
                        { value: 'EXPECTED',  label: 'Expected'  },
                        { value: 'RECEIVED',  label: 'Received'  },
                        { value: 'HELD',      label: 'Held'      },
                        { value: 'SUBLISTED', label: 'Sublisted' },
                        { value: 'RETRIEVED', label: 'Retrieved' },
                    ],
                    colorMap: HANDOVER_STATUS_CLR,
                }]}
                onRowAction={row => onSelectHandover(row)}
                actionLabel="Manage Handover"
                emptyIcon="📦"
                emptyMessage="No handovers assigned."
                pageSize={15}
            />
        </div>
    );
}