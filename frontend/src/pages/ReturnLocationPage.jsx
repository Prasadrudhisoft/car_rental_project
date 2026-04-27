// ReturnLocationPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../context/BookingContext';
import Navbar from '../components/common/Navbar';
import VendorMap from '../components/vendor-map/VendorMap';
import AuthModal from '../components/auth/AuthModal';
import './BookingWizard.css';

export default function ReturnLocationPage() {
    const navigate = useNavigate();
    const { booking, update } = useBooking();
    const [showAuth, setShowAuth] = useState(false);
    const [error, setError] = useState('');

    if (!booking.pickupCity || !booking.isDifferentReturn) { navigate('/'); return null; }

    const handleSelect = vendor => { update({ returnLocation: vendor }); setError(''); };

    const handleNext = () => {
        if (!booking.returnLocation) {
            setError('Please select a return vendor from the map.'); return;
        }
        navigate('/book/vehicles');
    };

    return (
        <div className="wizard-page">
            <Navbar onLoginClick={() => setShowAuth(true)} />
            <div className="wizard-page__inner">

                <div className="wizard-progress">
                    <div className="wizard-progress__step done"><span>✓</span> Pickup Location</div>
                    <div className="wizard-progress__step active"><span>2</span> Return Location</div>
                    <div className="wizard-progress__step"><span>3</span> Choose Car</div>
                    <div className="wizard-progress__step"><span>4</span> Review & Pay</div>
                </div>

                <div className="wizard-page__header">
                    <h1>Select Your Return Vendor</h1>
                    <p>
                        Choose where you'll drop off the vehicle in{' '}
                        <strong>{booking.returnCity?.name}</strong>.
                    </p>
                    {booking.returnLocation && (
                        <div className="wizard-selected-badge">
                            ✓ Selected: <strong>{booking.returnLocation.name}</strong>
                        </div>
                    )}
                </div>

                <VendorMap
                    cityName={booking.returnCity?.name}
                    onSelect={handleSelect}
                    selected={booking.returnLocation}
                />

                {error && <div className="wizard-error">{error}</div>}

                <div className="wizard-page__actions">
                    <button className="wizard-btn--back" onClick={() => navigate('/book/pickup-location')}>
                        ← Back
                    </button>
                    <button className="wizard-btn--next" onClick={handleNext}>
                        Browse Vehicles →
                    </button>
                </div>
            </div>
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </div>
    );
}