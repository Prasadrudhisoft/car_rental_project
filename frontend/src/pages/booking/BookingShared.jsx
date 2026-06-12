// ─────────────────────────────────────────────────────────────────────────────
// BookingShared.jsx// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import Navbar    from '../../components/common/Navbar';
import AuthModal from '../../components/auth/AuthModal';

// ── WizardProgress ─────────────────────────────────────────────────────────────
export function WizardProgress({ steps }) {
    return (
        <div className="wizard-progress">
            {steps.map((step, i) => (
                <div
                    key={step.label}
                    className={`wizard-progress__step${
                        step.state === 'active' ? ' active' : step.state === 'done' ? ' done' : ''
                    }`}
                >
                    <span>{step.state === 'done' ? '✓' : i + 1}</span>
                    {step.label}
                </div>
            ))}
        </div>
    );
}

/**
 * Builds the step progress array for the wizard.
 *
 * @param {'car'|'vendor'|'return'|'addons'|'confirm'} activeStep
 * @param {boolean} isDifferentReturn
 */
export function buildSteps(activeStep, isDifferentReturn) {
    const order = isDifferentReturn
        ? ['car', 'vendor', 'return', 'addons', 'confirm']
        : ['car', 'vendor', 'addons', 'confirm'];

    const LABELS = {
        car:     'Choose Type',     // ← UPDATED: was 'Select Car'
        vendor:  'Choose Vehicle',  // ← UPDATED: was 'Choose Vendor' — now vehicle-centric
        return:  'Return Vendor',
        addons:  'Add-ons & Pay',
        confirm: 'Confirm & Pay',
    };

    const activeIdx = order.indexOf(activeStep);
    return order.map((key, i) => ({
        label: LABELS[key],
        state: i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'future',
    }));
}

// ── WizardShell ───────────────────────────────────────────────────────────────
export function WizardShell({ children, onLoginClick, className = 'wizard-page' }) {
    return (
        <div className={className}>
            <Navbar onLoginClick={onLoginClick} />
            <div className="wizard-page__inner">
                {children}
            </div>
        </div>
    );
}

// ── useAuthModal ──────────────────────────────────────────────────────────────
export function useAuthModal(onSuccess) {
    const [showAuth, setShowAuth] = useState(false);

    const AuthModalEl = showAuth
        ? <AuthModal onClose={() => setShowAuth(false)} onSuccess={onSuccess} />
        : null;

    return {
        showAuth,
        openAuth:  () => setShowAuth(true),
        closeAuth: () => setShowAuth(false),
        AuthModalEl,
    };
}

// ── FlyTo (Leaflet helper) ────────────────────────────────────────────────────
export function FlyTo({ center }) {
    // eslint-disable-next-line
    const { useMap } = require('react-leaflet');
    const map = useMap();
    React.useEffect(() => {
        if (center) map.flyTo(center, 13, { duration: 1 });
    }, [center, map]);
    return null;
}