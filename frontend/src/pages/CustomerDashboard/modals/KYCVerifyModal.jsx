import React, { useState } from 'react';
import {
    sendKYCPhoneOTP, verifyKYCPhoneOTP,
    sendKYCEmailOTP, verifyKYCEmailOTP,
} from '../../../services/api';

export default function KYCVerifyModal({ type, value, userEmail, onClose, onVerified, showToast }) {
    const [step, setStep]   = useState('idle'); // idle | sending | sent | verifying | done
    const [otp, setOtp]     = useState('');
    const [error, setError] = useState('');
    const isPhone = type === 'phone';
    const label   = isPhone ? 'Phone Number' : 'Email Address';

    const handleSend = async () => {
        setStep('sending'); setError('');
        try {
            if (isPhone) await sendKYCPhoneOTP(userEmail);
            else         await sendKYCEmailOTP(value);
            setStep('sent');
            showToast(`OTP sent to your ${label.toLowerCase()}.`);
        } catch (e) {
            setError(e.response?.data?.error || `Failed to send OTP.`);
            setStep('idle');
        }
    };

    const handleVerify = async () => {
        if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
        setStep('verifying'); setError('');
        try {
            if (isPhone) await verifyKYCPhoneOTP(userEmail, otp);
            else         await verifyKYCEmailOTP(value, otp);
            setStep('done');
            showToast(`${label} verified successfully!`);
            setTimeout(() => onVerified(), 600);
        } catch (e) {
            setError(e.response?.data?.error || 'Invalid OTP. Please try again.');
            setStep('sent');
        }
    };

    return (
        <div className="cd-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cd-modal" style={{ maxWidth: 420 }}>
                {/* Header */}
                <div className="cd-modal__head">
                    <div>
                        <h3 className="cd-modal__title">Verify {label}</h3>
                        <p style={{ fontSize: 12, color: 'var(--cd-muted)', marginTop: 3 }}>
                            {isPhone ? `📱 ${value}` : `✉ ${value}`}
                        </p>
                    </div>
                    <button className="cd-modal__close" onClick={onClose}>&times;</button>
                </div>

                {/* Body */}
                <div className="cd-modal__body">
                    {step === 'done' ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: '#D1FAE5', border: '2px solid #6EE7B7',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 14px', fontSize: 24,
                            }}>✓</div>
                            <h3 style={{ fontWeight: 700, color: '#059669' }}>{label} Verified!</h3>
                        </div>
                    ) : (
                        <>
                            <p style={{ fontSize: 13, color: 'var(--cd-txt2)' }}>
                                We'll send a one-time code to <strong>{value}</strong>.
                            </p>

                            {step === 'idle' && (
                                <button
                                    className="cd-btn cd-btn--primary"
                                    onClick={handleSend}
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    Send OTP
                                </button>
                            )}

                            {step === 'sending' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cd-muted)', fontSize: 13 }}>
                                    <div className="cd-spinner" /> Sending OTP…
                                </div>
                            )}

                            {step === 'sent' && (
                                <>
                                    <div>
                                        <label style={{
                                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                            letterSpacing: '0.5px', color: 'var(--cd-muted)',
                                            display: 'block', marginBottom: 7,
                                        }}>
                                            Enter 6-digit OTP
                                        </label>
                                        <input
                                            className="cd-input"
                                            style={{
                                                textAlign: 'center', letterSpacing: '8px',
                                                fontSize: 24, fontWeight: 700, fontFamily: 'monospace',
                                            }}
                                            maxLength={6}
                                            placeholder="——————"
                                            value={otp}
                                            onChange={e => {
                                                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                                                setError('');
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        className="cd-btn cd-btn--primary"
                                        onClick={handleVerify}
                                        disabled={otp.length !== 6}
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        Verify OTP
                                    </button>
                                    <button
                                        className="cd-btn cd-btn--ghost"
                                        onClick={handleSend}
                                        style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                                    >
                                        Resend OTP
                                    </button>
                                </>
                            )}

                            {step === 'verifying' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cd-muted)', fontSize: 13 }}>
                                    <div className="cd-spinner" /> Verifying…
                                </div>
                            )}

                            {error && (
                                <div style={{
                                    background: '#FEE2E2', border: '1px solid #FCA5A5',
                                    borderRadius: 8, padding: '8px 12px',
                                    fontSize: 12, color: '#B91C1C',
                                }}>
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {step !== 'done' && (
                    <div className="cd-modal__foot">
                        <button className="cd-btn cd-btn--ghost" onClick={onClose}>Cancel</button>
                    </div>
                )}
            </div>
        </div>
    );
}