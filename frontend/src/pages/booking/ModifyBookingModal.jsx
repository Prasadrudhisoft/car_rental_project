import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../context/BookingContext';
import { calculatePrice, getCities, getOneWayFee } from '../../services/api';
import { calcNights } from './bookingConstants';

const localToday = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

export default function ModifyBookingModal({ onClose }) {
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [cities, setCities] = useState([]);
    const [form, setForm] = useState({
        pickupDate: booking.pickupDate, returnDate: booking.returnDate,
        pickupTime: booking.pickupTime || '', returnTime: booking.returnTime || '',
        diff: !!booking.isDifferentReturn,
        returnCity: booking.returnCity?.id ? String(booking.returnCity.id) : '',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [unavailable, setUnavailable] = useState(false);
    const set = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setError(''); setUnavailable(false); };

    useEffect(() => { getCities().then(({ data }) => setCities(data.results || data)).catch(() => {}); }, []);

    const go = path => { onClose(); navigate(path); };

    const save = async (pickAnother = false) => {
        setError('');
        if (!form.pickupDate || !form.returnDate) { setError('Please choose both dates.'); return; }
        if (form.returnDate < form.pickupDate)    { setError('Return date cannot be before pickup date.'); return; }
        if (form.diff && !form.returnCity)        { setError('Please choose the return city.'); return; }

        setBusy(true);
        try {
            const returnCity = form.diff
                ? cities.find(c => String(c.id) === form.returnCity)
                : booking.pickupCity;

            let oneWayFee = 0;
            if (form.diff) {
                try {
                    const { data } = await getOneWayFee(booking.pickupCity.id, returnCity.id);
                    oneWayFee = parseFloat(data.fee) || 0;
                } catch { /* admin confirms route fee */ }
            }

            let pricing = null;
            const v = booking.selectedVehicle;
            if (v && !pickAnother) {
                const { data } = await calculatePrice({
                    vehicle_id: v.id, pickup_date: form.pickupDate, return_date: form.returnDate,
                    pickup_time: form.pickupTime || null, return_time: form.returnTime || null,
                    addons: booking.selectedAddons || [], one_way_fee: oneWayFee,
                });
                if (data.available === false) {
                    setUnavailable(true);
                    setError('This vehicle is not available for the new dates.');
                    return;
                }
                const nights = calcNights(form.pickupDate, form.returnDate);
                if (data.min_rental_days > 1 && nights < data.min_rental_days) {
                    setError(`This vehicle type needs a minimum rental of ${data.min_rental_days} days.`);
                    return;
                }
                pricing = data;
            }

            const returnChanged = form.diff &&
                (!booking.returnLocation || String(booking.returnCity?.id) !== String(returnCity?.id));

            update({
                pickupDate: form.pickupDate, returnDate: form.returnDate,
                pickupTime: form.pickupTime, returnTime: form.returnTime,
                isDifferentReturn: form.diff, returnCity, oneWayFee,
                ...(pricing ? { pricingBreakdown: pricing } : {}),
                ...(!form.diff || returnChanged ? { returnLocation: null, returnVendor: null } : {}),
            });

            onClose();
            if (pickAnother)         navigate('/book/select-vendor');
            else if (returnChanged)  navigate('/book/return-vendor');
        } catch (e) {
            setError(e.response?.data?.error || 'Could not update your booking. Please try again.');
        } finally { setBusy(false); }
    };

    const today = localToday();

    return (
        <div className="mb-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <div className="mb-modal" role="dialog" aria-modal="true">
                <div className="mb-head">
                    <span>Modify booking details</span>
                    <button className="cd-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="mb-body">
                    <div className="ds-grid-2">
                        <div className="wz-field"><label className="wz-label">Pickup date</label>
                            <input className="wz-input" type="date" min={today} value={form.pickupDate} onChange={set('pickupDate')} /></div>
                        <div className="wz-field"><label className="wz-label">Pickup time</label>
                            <input className="wz-input" type="time" value={form.pickupTime} onChange={set('pickupTime')} /></div>
                        <div className="wz-field"><label className="wz-label">Return date</label>
                            <input className="wz-input" type="date" min={form.pickupDate || today} value={form.returnDate} onChange={set('returnDate')} /></div>
                        <div className="wz-field"><label className="wz-label">Return time</label>
                            <input className="wz-input" type="time" value={form.returnTime} onChange={set('returnTime')} /></div>
                    </div>

                    <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600, fontSize: 14 }}>
                        <input type="checkbox" checked={form.diff}
                               onChange={e => { setForm(p => ({ ...p, diff: e.target.checked })); setError(''); }} />
                        Return to a different location
                    </label>
                    {form.diff && (
                        <div className="wz-field"><label className="wz-label">Return city</label>
                            <select className="wz-input wz-select" value={form.returnCity} onChange={set('returnCity')}>
                                <option value="">Select city…</option>
                                {cities.map(c => <option key={c.id} value={c.id}>{c.name}, {c.state}</option>)}
                            </select>
                            <small style={{ color: 'var(--ds-muted)' }}>You'll choose the exact drop point next.</small>
                        </div>
                    )}

                    {error && <div className="wizard-error">{error}</div>}
                    {unavailable && (
                        <button className="wizard-btn--back" onClick={() => save(true)} disabled={busy}>
                            Save these dates &amp; pick another vehicle →
                        </button>
                    )}

                    <div className="mb-links">
                        <button className="wizard-btn--back" onClick={() => go('/book/select-car')}>
                            Change vehicle type
                        </button>
                        <button className="wizard-btn--back" onClick={() => go('/book/select-vendor')}>
                            Change vehicle / pickup location
                        </button>
                        {booking.isDifferentReturn && (
                            <button className="wizard-btn--back" onClick={() => go('/book/return-vendor')}>
                                Change drop point
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-foot">
                    <button className="wizard-btn--back" onClick={onClose}>Cancel</button>
                    <button className="wizard-btn--next" onClick={() => save(false)} disabled={busy}>
                        {busy ? 'Checking…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}