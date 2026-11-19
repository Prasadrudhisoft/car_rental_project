import React, { useEffect, useMemo, useState } from 'react';
import {
    quoteBookingModification, applyBookingModification, getModificationOptions,
    vendorQuoteModification, vendorApplyModification, vendorModificationOptions,
    getCities, getReturnOptions,
} from '../../services/api';
import { payBooking, paymentErrorMessage } from '../../services/payments';
import { getCityCenter } from '../../pages/booking/bookingConstants';
import LocationMap from './LocationMap';

const inr = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const errMsg = e => e?.response?.data?.detail || e?.response?.data?.error || paymentErrorMessage(e);
const API = {
    customer: { quote: quoteBookingModification, apply: applyBookingModification, options: getModificationOptions },
    vendor:   { quote: vendorQuoteModification,  apply: vendorApplyModification,  options: vendorModificationOptions },
};
const toPt = (p, extra = {}) => ({
    id: p.id, lat: parseFloat(p.latitude), lng: parseFloat(p.longitude),
    title: p.name, subtitle: p.address, ...extra,
});

export default function BookingChangeModal({ role = 'customer', booking, detail, onClose, onRefresh, showToast }) {
    const api = API[role];
    const src = { ...booking, ...(detail || {}) };
    const pending = src.pending_modification;
    const state = src.modification_state;
    const blocked = !pending && !!state && (
        state.can_modify === false || (state.deadline && role === 'customer' && new Date(state.deadline) < new Date()));
    const blockedMsg = state?.message || 'The modification deadline has passed.';

    const [pickup, setPickup] = useState(src.pickup_date || '');
    const [ret, setRet] = useState(src.return_date || '');
    const [vehicleId, setVehicleId] = useState(null);           // null = keep current vehicle
    const [activeLoc, setActiveLoc] = useState(null);           // pickup point highlighted on the map
    const [options, setOptions] = useState([]);
    const [current, setCurrent] = useState(null);
    const [retMode, setRetMode] = useState('keep');             // keep | same | other
    const [cities, setCities] = useState([]);
    const [retCity, setRetCity] = useState('');
    const [drops, setDrops] = useState([]);
    const [dropId, setDropId] = useState(null);
    const [reason, setReason] = useState('');
    const [quote, setQuote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(pending ? 'pay' : 'edit');  // edit | pay | wait
    const [due, setDue] = useState(pending ? Number(pending.amount_due) : 0);

    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const invalid = !pickup || !ret || ret < pickup || pickup < today;
    const effVehicleId = vehicleId || current?.vehicle_id;

    const body = {
        pickup_date: pickup, return_date: ret, reason,
        ...(vehicleId ? { vehicle_id: vehicleId } : {}),
        ...(retMode === 'same' ? { return_location_id: null } : {}),
        ...(retMode === 'other' && dropId ? { return_location_id: dropId } : {}),
    };

    // eligible vehicles (+ current points) for the chosen dates
    useEffect(() => {
        if (step !== 'edit' || invalid || blocked) return undefined;
        let live = true;
        const t = setTimeout(async () => {
            try {
                const { data } = await api.options(booking.id, { pickup_date: pickup, return_date: ret });
                if (!live) return;
                setOptions(data.vehicles || []);
                setCurrent(data.current || null);
                setVehicleId(v => ((data.vehicles || []).some(o => o.id === v) ? v : null));
            } catch (e) { if (live) { setOptions([]); setError(errMsg(e)); } }
        }, 400);
        return () => { live = false; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickup, ret, step, blocked]);

    useEffect(() => {
        if (retMode === 'other' && !cities.length) getCities().then(({ data }) => setCities(data.results || data)).catch(() => {});
    }, [retMode, cities.length]);

    // drop points follow the SELECTED vehicle (its own vendor is excluded server-side)
    useEffect(() => {
        setDrops([]); setDropId(null);
        if (retMode !== 'other' || !retCity || !effVehicleId) return;
        getReturnOptions(retCity, effVehicleId).then(({ data }) => setDrops(data)).catch(() => setDrops([]));
    }, [retMode, retCity, effVehicleId]);

    // live quote
    useEffect(() => {
        if (step !== 'edit' || blocked) return undefined;
        setQuote(null); setError('');
        if (invalid || (retMode === 'other' && !dropId)) return undefined;
        let live = true;
        const t = setTimeout(async () => {
            setBusy(true);
            try { const { data } = await api.quote(booking.id, body); if (live) setQuote(data); }
            catch (e) { if (live) setError(errMsg(e)); }
            finally { if (live) setBusy(false); }
        }, 350);
        return () => { live = false; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickup, ret, vehicleId, retMode, dropId, step, blocked]);

    // ── pickup map data ──
    const pickupPoints = useMemo(() => {
        const m = new Map();
        if (current?.pickup_point) m.set(current.pickup_point.id, toPt(current.pickup_point, { current: true, meta: 'Your current pickup point' }));
        const count = {};
        options.forEach(o => { count[o.pickup_point.id] = (count[o.pickup_point.id] || 0) + 1; });
        options.forEach(o => {
            if (!m.has(o.pickup_point.id)) m.set(o.pickup_point.id, toPt(o.pickup_point, { meta: `${count[o.pickup_point.id]} vehicle(s) available` }));
        });
        return [...m.values()];
    }, [current, options]);

    const currentPickupId = current?.pickup_point?.id;
    const shownVehicles = activeLoc && activeLoc !== currentPickupId
        ? options.filter(o => o.pickup_point.id === activeLoc) : options;
    const center = getCityCenter(current?.city_name);

    const onPickupPin = id => {
        setActiveLoc(id);
        if (id === currentPickupId) { setVehicleId(null); return; }
        const here = options.filter(o => o.pickup_point.id === id);
        if (here.length === 1) setVehicleId(here[0].id);
    };
    const pickVehicle = v => { setVehicleId(v ? v.id : null); setActiveLoc(v ? v.pickup_point.id : currentPickupId); };

    const dropPoints = drops.map(d => ({
        id: d.location_id, lat: parseFloat(d.latitude), lng: parseFloat(d.longitude), title: d.name,
        subtitle: d.address, meta: `${d.available_slots} slot(s) free${Number(d.rating) > 0 ? ` · ⭐ ${d.rating}` : ''}`,
    }));
    const dropCityName = cities.find(c => String(c.id) === String(retCity))?.name;

    const ok = quote && quote.available !== false && quote.has_changes;
    const amountDue = Number(quote?.amount_due_now || 0);
    const refundDue = Number(quote?.refund_due || 0);

    const confirm = async () => {
        if (role !== 'customer' && !reason.trim()) { setError('Please give a reason.'); return; }
        setBusy(true); setError('');
        try {
            const { data } = await api.apply(booking.id, body);
            if (data.status === 'payment_required') {
                setDue(Number(data.amount_due)); setStep(role === 'customer' ? 'pay' : 'wait'); onRefresh?.();
            } else {
                const r = Number(data.refund_due || 0);
                showToast(r > 0 ? `Booking updated. ${inr(r)} will be refunded.` : 'Booking updated.');
                onRefresh?.(); onClose();
            }
        } catch (e) { setError(errMsg(e)); }
        finally { setBusy(false); }
    };

    const pay = async () => {
        setBusy(true); setError('');
        try {
            await payBooking({ bookingId: booking.id, paymentType: 'modification' });
            showToast('Payment received. Your booking has been updated.');
            onRefresh?.(); onClose();
        } catch (e) { if (!e.cancelled) setError(errMsg(e)); onRefresh?.(); }
        finally { setBusy(false); }
    };

    const Row = ({ l, v, strong }) => <div className="cd-payment-breakdown__row"><span>{l}</span>{strong ? <strong>{v}</strong> : v}</div>;
    const lbl = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--cd-muted)' };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
            <div className="cd-modal cd-modal--lg" style={{ maxWidth: 820 }} onClick={e => e.stopPropagation()}>
                <div className="cd-modal__head">
                    <h3 className="cd-modal__title">{step === 'edit' ? 'Change booking' : 'Complete your change'}</h3>
                    <button className="cd-modal__close" onClick={onClose} disabled={busy}>&times;</button>
                </div>

                <div className="cd-modal__body">
                    {step === 'edit' && blocked && (
                        <div className="cd-error" role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 22 }}>⚠️</span>
                            <div><strong>Changes are closed for this booking.</strong><div>{blockedMsg}</div>
                                <div style={{ marginTop: 4 }}>You can still cancel according to the cancellation policy, or contact the vendor.</div></div>
                        </div>
                    )}

                    {step === 'edit' && !blocked && (<>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 600 }}>Pickup date
                                <input type="date" className="cd-input" min={today} value={pickup} onChange={e => setPickup(e.target.value)} /></label>
                            <label style={{ fontSize: 12, fontWeight: 600 }}>Return date
                                <input type="date" className="cd-input" min={pickup || today} value={ret} onChange={e => setRet(e.target.value)} /></label>
                        </div>

                        {/* ── PICKUP: map + eligible vehicles ── */}
                        <div>
                            <p style={lbl}>Pickup point &amp; vehicle</p>
                            <small style={{ color: 'var(--cd-muted)' }}>Tap a pin to see the vehicles available there, or pick a vehicle from the list. The pickup point is the vehicle's own location.</small>
                            <div style={{ marginTop: 8 }}>
                                <LocationMap points={pickupPoints} selectedId={activeLoc || currentPickupId}
                                             onSelect={onPickupPin} center={center} />
                            </div>
                            <div className="vsp__vendor-list" style={{ height: 'auto', maxHeight: 280, marginTop: 10 }}>
                                <button type="button" className={`vsp__vendor-card${!vehicleId ? ' selected' : ''}`} onClick={() => pickVehicle(null)}>
                                    <div className="vsp__vendor-card__info">
                                        <div className="vsp__vendor-card__title">Keep current vehicle</div>
                                        <div className="vsp__vendor-card__hours">📍 {current?.pickup_point?.name || src.pickup_location_detail?.name}</div>
                                    </div>
                                    {!vehicleId && <div className="vsp__vendor-card__check">✓</div>}
                                </button>
                                {shownVehicles.map(o => (
                                    <button type="button" key={o.id} className={`vsp__vendor-card${vehicleId === o.id ? ' selected' : ''}`} onClick={() => pickVehicle(o)}>
                                        <div className="vsp__vehicle-thumb">{o.cover_photo ? <img src={o.cover_photo} alt={o.label} /> : <span>🚗</span>}</div>
                                        <div className="vsp__vendor-card__info">
                                            <div className="vsp__vendor-card__title">{o.label}{o.is_upgrade ? ' · ⬆ Upgrade' : ''}</div>
                                            <div className="vsp__vendor-card__vendor">🏪 {o.vendor_name}</div>
                                            <div className="vsp__vendor-card__hours">📍 {o.pickup_point.name}{o.pickup_point.address ? `, ${o.pickup_point.address}` : ''}</div>
                                            <div className="vsp__vendor-card__meta">
                                                {Number(o.rating) > 0 && <span>⭐ {o.rating}</span>}
                                                {o.is_certified && <span className="vsp__cert">🏅 Certified</span>}
                                                <span>⚙️ {o.transmission}</span><span>⛽ {o.fuel_type}</span><span>💺 {o.capacity}</span>
                                            </div>
                                        </div>
                                        <div className="vsp__vendor-card__price">
                                            <div className="vsp__rate">{inr(o.daily_rate)}<span>/day</span></div>
                                            <div className="vsp__total">{Number(o.delta) >= 0 ? '+' : '−'}{inr(Math.abs(o.delta))}</div>
                                        </div>
                                        {vehicleId === o.id && <div className="vsp__vendor-card__check">✓</div>}
                                    </button>
                                ))}
                                {!shownVehicles.length && <small style={{ color: 'var(--cd-muted)' }}>No other vehicles are free for these dates{activeLoc && activeLoc !== currentPickupId ? ' at this point' : ''}.</small>}
                            </div>
                        </div>

                        {/* ── RETURN: map of drop points for the selected vehicle ── */}
                        <div>
                            <p style={lbl}>Return point</p>
                            <select className="cd-input" value={retMode} onChange={e => setRetMode(e.target.value)}>
                                <option value="keep">Keep current{src.return_location_detail?.name ? ` (${src.return_location_detail.name})` : ' (same as pickup)'}</option>
                                <option value="same">Return to the pickup point</option>
                                <option value="other">Choose a drop point on the map…</option>
                            </select>
                            {retMode === 'other' && (<>
                                <select className="cd-input" style={{ marginTop: 8 }} value={retCity} onChange={e => setRetCity(e.target.value)}>
                                    <option value="">Select city…</option>
                                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}, {c.state}</option>)}
                                </select>
                                {retCity && (<>
                                    <div style={{ marginTop: 8 }}>
                                        <LocationMap points={dropPoints} selectedId={dropId} onSelect={setDropId} emoji="🏁"
                                                     center={getCityCenter(dropCityName)} />
                                    </div>
                                    <div className="vsp__vendor-list" style={{ height: 'auto', maxHeight: 220, marginTop: 10 }}>
                                        {dropPoints.map(d => (
                                            <button type="button" key={d.id} className={`vsp__vendor-card${dropId === d.id ? ' selected' : ''}`} onClick={() => setDropId(d.id)}>
                                                <div className="vsp__vendor-card__info">
                                                    <div className="vsp__vendor-card__title">{d.title}</div>
                                                    <div className="vsp__vendor-card__hours">📍 {d.subtitle || 'Address on file'}</div>
                                                    <div className="vsp__vendor-card__meta"><span>{d.meta}</span></div>
                                                </div>
                                                {dropId === d.id && <div className="vsp__vendor-card__check">✓</div>}
                                            </button>
                                        ))}
                                        {!dropPoints.length && <small style={{ color: 'var(--cd-muted)' }}>No drop points with free slots in this city for the selected vehicle.</small>}
                                    </div>
                                </>)}
                            </>)}
                        </div>

                        {role !== 'customer' && (
                            <label style={{ fontSize: 12, fontWeight: 600 }}>Reason (required)
                                <textarea className="cd-input cd-textarea" rows={2} value={reason} onChange={e => setReason(e.target.value)}
                                          placeholder="Why is the booking being changed?" /></label>
                        )}

                        {ret && pickup && ret < pickup && <p style={{ color: '#EF4444', fontSize: 12 }}>Return date must be on or after pickup.</p>}
                        {error && <p style={{ color: '#EF4444', fontSize: 12 }}>{error}</p>}
                        {quote?.available === false && <p style={{ color: '#EF4444', fontSize: 12 }}>{quote.reason}</p>}
                        {quote && quote.available !== false && !quote.has_changes && <p style={{ fontSize: 12 }}>Nothing has been changed yet.</p>}

                        {ok && (
                            <div className="cd-payment-breakdown">
                                <Row l="Changes" v={quote.change_types.join(', ').replace(/_/g, ' ')} />
                                <Row l="Current total" v={inr(quote.old_total)} strong />
                                <Row l="New total" v={inr(quote.new_total)} strong />
                                {Number(quote.modification_fee) > 0 && <Row l="Change fee" v={inr(quote.modification_fee)} strong />}
                                <div className="cd-payment-breakdown__divider" />
                                {amountDue > 0 && <Row l="To pay now" v={inr(amountDue)} strong />}
                                {amountDue === 0 && refundDue > 0 && <Row l="Refund due" v={<strong style={{ color: '#059669' }}>{inr(refundDue)}</strong>} />}
                                {amountDue === 0 && refundDue === 0 && <Row l="No payment needed" v={inr(0)} strong />}
                                {role === 'customer' && !quote.free_window && quote.change_types.includes('dates') &&
                                    <small style={{ color: 'var(--cd-muted)' }}>The free-change window has ended, so a date-change fee may apply.</small>}
                            </div>
                        )}
                    </>)}

                    {step === 'pay' && (
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <p style={{ color: 'var(--cd-muted)' }}>Your new dates are held for 30 minutes until the extra amount is paid.</p>
                            <h2 style={{ margin: '10px 0' }}>{inr(due)}</h2>
                            {error && <p style={{ color: '#EF4444', fontSize: 12 }}>{error}</p>}
                        </div>
                    )}

                    {step === 'wait' && (
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <h3>Waiting for the customer to pay {inr(due)}</h3>
                            <p style={{ color: 'var(--cd-muted)', marginTop: 8 }}>The customer has been notified and the new dates are held for 30 minutes. If you collected the money in person, use “Record payment received”.</p>
                        </div>
                    )}
                </div>

                <div className="cd-modal__foot">
                    <button className="cd-btn cd-btn--ghost" onClick={onClose} disabled={busy}>{step === 'edit' ? 'Cancel' : 'Close'}</button>
                    {step === 'edit' && !blocked && (
                        <button className="cd-btn cd-btn--primary" onClick={confirm} disabled={busy || !ok || invalid}>
                            {busy && ok ? 'Saving…' : amountDue > 0 ? 'Continue' : 'Confirm change'}
                        </button>
                    )}
                    {step === 'pay' && <button className="cd-btn cd-btn--primary" onClick={pay} disabled={busy}>{busy ? 'Processing…' : `Pay ${inr(due)}`}</button>}
                </div>
            </div>
        </div>
    );
}

export function ModificationHistory({ items = [] }) {
    const applied = items.filter(m => m.status === 'APPLIED');
    if (!applied.length) return null;
    const diffs = m => {
        const o = m.old_values || {}, n = m.new_values || {}, rows = [];
        const add = (l, a, b) => a !== b && rows.push(`${l}: ${a || '—'} → ${b || '—'}`);
        add('Vehicle', o.vehicle, n.vehicle);
        add('Pickup', `${o.pickup_date} ${o.pickup_time || ''}`.trim(), `${n.pickup_date} ${n.pickup_time || ''}`.trim());
        add('Return', `${o.return_date} ${o.return_time || ''}`.trim(), `${n.return_date} ${n.return_time || ''}`.trim());
        add('Pickup point', o.pickup_location, n.pickup_location);
        add('Return point', o.return_location, n.return_location);
        add('Total', inr(m.old_total), inr(m.new_total));
        return rows;
    };
    return (
        <div className="cd-info-group">
            <div className="cd-info-group__title">Modification History</div>
            {applied.map(m => (
                <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--cd-bdr)', fontSize: 12 }}>
                    <strong>{new Date(m.applied_at || m.created_at).toLocaleString('en-IN')}</strong>
                    {' · '}by {m.initiator_role}{m.initiated_by_name ? ` (${m.initiated_by_name})` : ''}
                    {m.reason && <div style={{ fontStyle: 'italic' }}>“{m.reason}”</div>}
                    {diffs(m).map(r => <div key={r}>{r}</div>)}
                </div>
            ))}
        </div>
    );
}