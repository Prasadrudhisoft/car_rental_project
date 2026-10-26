import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../context/BookingContext';
import { getCities } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './SearchWidget.css';

const TODAY = new Date().toISOString().split('T')[0];
const TOMORROW = new Date(Date.now() + 86400000).toISOString().split('T')[0];

export default function SearchWidget() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { update } = useBooking();
    const [cities, setCities] = useState([]);
    const [isDifferentReturn, setIsDifferentReturn] = useState(false);
    const [form, setForm] = useState({
        pickupCity: '',
        returnCity: '',
        pickupDate: TODAY,
        returnDate: TOMORROW,
        pickupTime: '10:00',
        returnTime: '10:00',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCities()
            .then(({ data }) => setCities(data.results || data))
            .catch(() => setCities([]))
            .finally(() => setLoading(false));
    }, []);

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const handleSearch = (e) => {
        e.preventDefault();
        setError('');
        if (!form.pickupCity) { setError('Please select a pickup city.'); return; }
        if (isDifferentReturn && !form.returnCity) { setError('Please select a return city.'); return; }
        if (form.pickupDate > form.returnDate) { setError('Return date must be after pickup date.'); return; }

        const pickupCityObj = cities.find((c) => String(c.id) === String(form.pickupCity));
        const returnCityObj = isDifferentReturn
            ? cities.find((c) => String(c.id) === String(form.returnCity))
            : pickupCityObj;

        update({
            isDifferentReturn,
            pickupCity: pickupCityObj,
            returnCity: returnCityObj,
            pickupDate: form.pickupDate,
            returnDate: form.returnDate,
            pickupTime: form.pickupTime,
            returnTime: form.returnTime,
            selectedModel: null,
            selectedVehicle: null,
            pickupLocation: null,
            returnLocation: null,
            pricingBreakdown: null,
        });
        // New flow: go directly to car model selection
        navigate('/book/select-car');
    };

    const nights = Math.max(
        0,
        Math.round((new Date(form.returnDate) - new Date(form.pickupDate)) / 86400000)
    );

    if (user && user.role !== 'customer') {
        return (
            <div className="search-widget">
                <div className="search-widget__header">
                    <h2>Bookings are for customers</h2>
                    <p>Sign in with a customer account to book a vehicle.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="search-widget">
            <div className="search-widget__header">
                <h2>Find Your Perfect Ride</h2>
                <p>Premium cars. Verified vendors. Seamless booking.</p>
            </div>

            <form className="search-widget__form" onSubmit={handleSearch}>
                <label className="search-widget__toggle">
                    <input
                        type="checkbox"
                        checked={isDifferentReturn}
                        onChange={(e) => setIsDifferentReturn(e.target.checked)}
                    />
                    <span className="search-widget__toggle-track" />
                    <span className="search-widget__toggle-label">Return to a different location</span>
                </label>

                <div className="search-widget__fields">
                    <div className="search-field">
                        <label className="search-field__label">
                            <span className="search-field__icon">📍</span>
                            {isDifferentReturn ? 'Pick-up City' : 'Pick-up / Drop-off City'}
                        </label>
                        <select value={form.pickupCity} onChange={set('pickupCity')} required disabled={loading}>
                            <option value="">{loading ? 'Loading cities…' : 'Select city…'}</option>
                            {cities.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}, {c.state}</option>
                            ))}
                        </select>
                    </div>

                    {isDifferentReturn && (
                        <div className="search-field">
                            <label className="search-field__label">
                                <span className="search-field__icon">🏁</span>Return City
                            </label>
                            <select value={form.returnCity} onChange={set('returnCity')} required={isDifferentReturn}>
                                <option value="">Select city…</option>
                                {cities.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}, {c.state}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="search-field">
                        <label className="search-field__label">
                            <span className="search-field__icon">📅</span>Pick-up Date
                        </label>
                        <input type="date" value={form.pickupDate} onChange={set('pickupDate')} min={TODAY} required />
                    </div>

                    <div className="search-field">
                        <label className="search-field__label">
                            <span className="search-field__icon">📅</span>Return Date
                        </label>
                        <input type="date" value={form.returnDate} onChange={set('returnDate')} min={form.pickupDate} required />
                    </div>

                    <div className="search-field">
                        <label className="search-field__label">
                            <span className="search-field__icon">🕐</span>Pick-up Time
                        </label>
                        <input type="time" value={form.pickupTime} onChange={set('pickupTime')} />
                    </div>

                    <div className="search-field">
                        <label className="search-field__label">
                            <span className="search-field__icon">🕐</span>Return Time
                        </label>
                        <input type="time" value={form.returnTime} onChange={set('returnTime')} />
                    </div>
                </div>

                {nights > 0 && (
                    <div className="search-widget__duration">
                        <span>⏱</span> {nights} day{nights > 1 ? 's' : ''} rental
                    </div>
                )}

                {error && <div className="search-widget__error">{error}</div>}

                <button type="submit" className="search-widget__submit" disabled={loading}>
                    <span>Search Available Cars</span>
                    <span className="search-widget__submit-arrow">→</span>
                </button>
            </form>
        </div>
    );
}