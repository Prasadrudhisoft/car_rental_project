// PickupLocationPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import Navbar from '../components/common/Navbar';
import VendorMap from '../components/vendor-map/VendorMap';
import AuthModal from '../components/auth/AuthModal';
import './BookingWizard.css';

export default function PickupLocationPage() {
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [showAuth, setShowAuth] = useState(false);
    const [error, setError] = useState('');

    if (!booking.pickupCity) { navigate('/'); return null; }

    const handleSelect = vendor => { update({ pickupLocation: vendor }); setError(''); };

    const handleNext = () => {
        if (!booking.pickupLocation) {
            setError('Please select a pickup vendor from the map.'); return;
        }
        if (booking.isDifferentReturn) {
            navigate('/book/return-location');
        } else {
            update({ returnLocation: booking.pickupLocation });
            navigate('/book/vehicles');
        }
    };

    return (
        <div className="wizard-page">
            <Navbar onLoginClick={() => setShowAuth(true)} />
            <div className="wizard-page__inner">

                <div className="wizard-progress">
                    <div className="wizard-progress__step active">
                        <span>1</span> Pickup Location
                    </div>
                    {booking.isDifferentReturn && (
                        <div className="wizard-progress__step">
                            <span>2</span> Return Location
                        </div>
                    )}
                    <div className="wizard-progress__step">
                        <span>{booking.isDifferentReturn ? 3 : 2}</span> Choose Car
                    </div>
                    <div className="wizard-progress__step">
                        <span>{booking.isDifferentReturn ? 4 : 3}</span> Review & Pay
                    </div>
                </div>

                <div className="wizard-page__header">
                    <h1>Select Your Pickup Vendor</h1>
                    <p>
                        Choose where you'll collect your vehicle in{' '}
                        <strong>{booking.pickupCity?.name}</strong>.
                        Click a marker or card to select.
                    </p>
                    {booking.pickupLocation && (
                        <div className="wizard-selected-badge">
                            ✓ Selected: <strong>{booking.pickupLocation.name}</strong>
                        </div>
                    )}
                </div>

                <VendorMap
                    cityName={booking.pickupCity?.name}
                    onSelect={handleSelect}
                    selected={booking.pickupLocation}
                />

                {error && <div className="wizard-error">{error}</div>}

                <div className="wizard-page__actions">
                    <button className="wizard-btn--back" onClick={() => navigate('/')}>
                        ← Back to Search
                    </button>
                    <button className="wizard-btn--next" onClick={handleNext}>
                        {booking.isDifferentReturn ? 'Select Return Location →' : 'Browse Vehicles →'}
                    </button>
                </div>
            </div>
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </div>
    );
}