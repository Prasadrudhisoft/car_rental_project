// ─────────────────────────────────────────────────────────────────────────────
// BookingShared.jsx
// Reusable UI primitives shared across all booking wizard pages.
//   • WizardProgress  — step indicator bar
//   • WizardShell     — page wrapper (Navbar + inner container)
//   • useAuthModal    — encapsulates AuthModal show/hide state
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import Navbar     from '../../components/common/Navbar';
import AuthModal  from '../../components/auth/AuthModal';

// ── WizardProgress ────────────────────────────────────────────────────────────
/**
 * Renders the step indicator bar at the top of every wizard page.
 *
 * Each step is an object: { label: string, state: 'done' | 'active' | 'future' }
 *
 * Usage:
 *   <WizardProgress steps={[
 *     { label: 'Select Car',   state: 'done'   },
 *     { label: 'Vendor',       state: 'active' },
 *     { label: 'Add-ons & Pay',state: 'future' },
 *   ]} />
 */
export function WizardProgress({ steps }) {
    return (
        <div className="wizard-progress">
            {steps.map((step, i) => (
                <div
                    key={step.label}
                    className={`wizard-progress__step${step.state === 'active' ? ' active' : step.state === 'done' ? ' done' : ''}`}
                >
                    <span>
                        {step.state === 'done' ? '✓' : i + 1}
                    </span>
                    {step.label}
                </div>
            ))}
        </div>
    );
}

/**
 * Convenience helper — builds the standard 4-step (or 5-step) progress array.
 *
 * @param {'car'|'vendor'|'return'|'addons'|'confirm'} activeStep
 * @param {boolean} isDifferentReturn  — whether the one-way return step is shown
 */
export function buildSteps(activeStep, isDifferentReturn) {
    const order = isDifferentReturn
        ? ['car', 'vendor', 'return', 'addons', 'confirm']
        : ['car', 'vendor', 'addons', 'confirm'];

    const LABELS = {
        car:     'Select Car',
        vendor:  'Choose Vendor',
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
/**
 * Full-page shell: renders Navbar + a centred inner container.
 * Passes onLoginClick down to Navbar so AuthModal can be triggered.
 *
 * Usage:
 *   <WizardShell onLoginClick={() => setShowAuth(true)} className="addons-page">
 *     {children}
 *   </WizardShell>
 */
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
/**
 * Encapsulates the repetitive AuthModal open/close + onSuccess pattern.
 *
 * Returns:
 *   showAuth      — boolean
 *   openAuth()    — open the modal
 *   closeAuth()   — close the modal
 *   AuthModalEl   — JSX element to render (null when not open)
 *
 * Usage:
 *   const { openAuth, AuthModalEl } = useAuthModal(() => navigate('/book/confirm'));
 *   ...
 *   <button onClick={openAuth}>Sign In</button>
 *   {AuthModalEl}
 */
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

// ── FlyTo (Leaflet helper component) ─────────────────────────────────────────
/**
 * Drop this inside a <MapContainer> to smoothly fly to a new centre.
 * Requires react-leaflet's useMap hook.
 */
export function FlyTo({ center }) {
    // Lazy import so pages without Leaflet don't break.
    // eslint-disable-next-line
    const { useMap } = require('react-leaflet');
    const map = useMap();
    React.useEffect(() => {
        if (center) map.flyTo(center, 13, { duration: 1 });
    }, [center, map]);
    return null;
}