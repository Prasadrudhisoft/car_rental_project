// ─────────────────────────────────────────────────────────────────────────────
// modals/InvoiceModal.jsx
// Read-only GST invoice viewer for a booking.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

export default function InvoiceModal({ invoice, booking, onClose }) {
    if (!invoice) return null;

    const lines = [
        ['Invoice Reference', invoice.invoice_ref],
        ['Base Rental',       `₹${parseFloat(invoice.base_amount  || 0).toLocaleString('en-IN')}`],
        ['Add-ons',           `₹${parseFloat(invoice.addon_amount || 0).toLocaleString('en-IN')}`],
        ['CGST',              `₹${parseFloat(invoice.cgst_amount  || 0).toLocaleString('en-IN')}`],
        ['SGST',              `₹${parseFloat(invoice.sgst_amount  || 0).toLocaleString('en-IN')}`],
        ['Grand Total',       `₹${parseFloat(invoice.total_amount || 0).toLocaleString('en-IN')}`],
        ['Deposit Status',    invoice.deposit_status?.toUpperCase() || '—'],
    ];

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal">
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Invoice</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>
                            Booking: {booking?.booking_ref}
                        </p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>

                <div className="cd-modal__body">
                    {/* Brand header */}
                    <div className="cd-invoice-header">
                        <div>
                            <div className="cd-invoice-brand">RudhiDrive</div>
                            <div style={{ fontSize: 12, color: 'var(--cd-muted)' }}>GST Invoice</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                fontSize: 18, fontWeight: 800,
                                color: 'var(--cd-acc)',
                                fontFamily: 'DM Mono, monospace',
                            }}>
                                {invoice.invoice_ref}
                            </div>
                        </div>
                    </div>

                    {/* Line items */}
                    <div className="cd-invoice-lines">
                        {lines
                            .filter(([, v]) => v && v !== '₹0')
                            .map(([l, v]) => (
                                <div
                                    key={l}
                                    className={`cd-invoice-line${l === 'Grand Total' ? ' cd-invoice-line--total' : ''}`}
                                >
                                    <span>{l}</span>
                                    <strong>{v}</strong>
                                </div>
                            ))
                        }
                    </div>
                </div>

                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}