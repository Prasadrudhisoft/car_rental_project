// ─────────────────────────────────────────────────────────────────────────────
// modals/WriteReviewModal.jsx
// Star-rating form for submitting a new review against a completed booking.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { submitReview } from '../../../services/api';
import { StarRating } from '../cdShared';

export default function WriteReviewModal({ booking, onClose, onSubmitted, showToast }) {
    const [vendorRating,  setVendorRating]  = useState(0);
    const [vehicleRating, setVehicleRating] = useState(0);
    const [comment,       setComment]       = useState('');
    const [submitting,    setSubmitting]    = useState(false);

    const handleSubmit = async () => {
        if (!vendorRating) { showToast('Please select a vendor rating.', 'error'); return; }
        setSubmitting(true);
        try {
            await submitReview({
                booking_id:     booking.booking_id,
                vendor_rating:  vendorRating,
                vehicle_rating: vehicleRating || vendorRating,
                review_text:    comment,
            });
            showToast('Review submitted. Thank you!');
            onSubmitted(booking.booking_id);
            onClose();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to submit review.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Write a Review</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>
                            {booking.vehicle_display} · {booking.booking_ref}
                        </p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>

                {/* Body */}
                <div className="cd-modal__body">
                    <div>
                        <p className="cd-review-label">Vendor Rating *</p>
                        <StarRating value={vendorRating} onChange={setVendorRating} />
                    </div>
                    <div>
                        <p className="cd-review-label">Vehicle Rating</p>
                        <StarRating value={vehicleRating} onChange={setVehicleRating} />
                    </div>
                    <div>
                        <label style={{
                            fontSize: 11, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            color: 'var(--cd-muted)', display: 'block', marginBottom: 6,
                        }}>
                            Your Experience (optional)
                        </label>
                        <textarea
                            className="cd-input cd-textarea"
                            placeholder="Share your experience…"
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="cd-btn cd-btn--primary"
                        onClick={handleSubmit}
                        disabled={submitting || !vendorRating}
                    >
                        {submitting ? 'Submitting…' : 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    );
}