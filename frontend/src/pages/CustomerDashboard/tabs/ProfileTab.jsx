import React, { useState } from 'react';
import { updateCustomerProfile } from '../../../services/api';

// ── Reusable field components ──────────────────────────────────────────────

function InfoRow({ label, value }) {
    return (
        <div className="cd-info-row cd-info-row--bordered">
            <span className="cd-info-row__lbl">{label}</span>
            <strong className="cd-info-row__val">{value || '—'}</strong>
        </div>
    );
}

function FormField({ label, children }) {
    return (
        <div className="cd-form-field">
            <label>{label}</label>
            {children}
        </div>
    );
}

// ── KYC verify row (phone or email) ───────────────────────────────────────

function VerifyRow({ icon, label, value, isVerified, onVerify }) {
    return (
        <div className="cd-kyc-verify-row">
            <div className="cd-kyc-verify-row__left">
                <div className="cd-kyc-verify-row__icon">{icon}</div>
                <div>
                    <div className="cd-kyc-verify-row__label">{label}</div>
                    <div className="cd-kyc-verify-row__value">{value || '—'}</div>
                </div>
            </div>
            <div className="cd-kyc-verify-row__right">
                {isVerified ? (
                    <span className="cd-kyc-verify-badge cd-kyc-verify-badge--verified">✓ Verified</span>
                ) : value ? (
                    <button className="cd-btn cd-btn--primary cd-btn--sm" onClick={onVerify}>
                        Verify {label.split(' ')[0]}
                    </button>
                ) : (
                    <span className="cd-kyc-verify-badge cd-kyc-verify-badge--missing">
                        No {label.toLowerCase()} on file
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ProfileTab({
    profile, user,
    onProfileSaved,
    onOpenKYCModal,
    showToast,
}) {
    const [editing, setEditing]   = useState(false);
    const [saving,  setSaving]    = useState(false);
    const [form,    setForm]      = useState({
        full_name:        profile?.full_name        || '',
        phone:            profile?.phone            || '',
        driving_licence:  profile?.driving_licence  || '',
        dl_expiry:        profile?.dl_expiry        || '',
        date_of_birth:    profile?.date_of_birth    || '',
        aadhaar_number:   profile?.aadhaar_number   || '',
        pan_number:       profile?.pan_number       || '',
    });

    const s = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...form,
                dl_expiry:     form.dl_expiry     || null,
                date_of_birth: form.date_of_birth || null,
            };
            const { data } = await updateCustomerProfile(payload);
            onProfileSaved(data);            // server response, includes the fresh kyc_status
            setEditing(false);
            showToast(data.kyc_status === 'verified'
                ? 'Profile updated. KYC verified!'
                : 'Profile updated.');
        } catch (e) {
            showToast(
                e.response?.data ? JSON.stringify(e.response.data) : 'Save failed.',
                'error',
            );
        } finally {
            setSaving(false);
        }
    };

    const kycStatusClass = profile?.kyc_status === 'verified'
        ? 'cd-kyc-status--verified'
        : profile?.kyc_status === 'rejected'
            ? 'cd-kyc-status--rejected'
            : 'cd-kyc-status--pending';

    const kycStatusText = profile?.kyc_status === 'verified'
        ? '✓ Fully Verified'
        : profile?.kyc_status === 'rejected'
            ? '✕ Rejected — Contact Support'
            : '⏳ Pending Verification';

    return (
        <div className="cd-section">
            <div className="cd-profile-layout">

                {/* Personal information card */}
                <div className="cd-card">
                    <div className="cd-card__head">
                        <div><h3 className="cd-card__title">Personal Information</h3></div>
                        <button
                            className="cd-btn cd-btn--outline cd-btn--sm"
                            onClick={() => setEditing(!editing)}
                        >
                            {editing ? 'Cancel' : 'Edit'}
                        </button>
                    </div>

                    {editing ? (
                        <div className="cd-profile-form">
                            {[
                                ['full_name',       'Full Name',            'text'],
                                ['phone',           'Phone Number',         'tel'],
                                ['date_of_birth',   'Date of Birth',        'date'],
                                ['driving_licence', 'Driving Licence No.',  'text'],
                                ['dl_expiry',       'DL Expiry Date',       'date'],
                                ['aadhaar_number',  'Aadhaar Number',       'text'],
                                ['pan_number',      'PAN Number',           'text'],
                            ].map(([key, label, type]) => (
                                <FormField key={key} label={label}>
                                    <input
                                        className="cd-input"
                                        type={type}
                                        value={form[key] || ''}
                                        onChange={s(key)}
                                    />
                                </FormField>
                            ))}
                            <button
                                className="cd-btn cd-btn--primary"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    ) : (
                        <div className="cd-profile-rows">
                            <InfoRow label="Name"            value={profile?.full_name} />
                            <InfoRow label="Email"           value={profile?.email} />
                            <InfoRow label="Phone"           value={profile?.phone} />
                            <InfoRow label="Date of Birth"   value={profile?.date_of_birth} />
                            <InfoRow label="Driving Licence" value={profile?.driving_licence} />
                            <InfoRow label="DL Expiry"       value={profile?.dl_expiry} />
                            <InfoRow
                                label="Aadhaar"
                                value={profile?.aadhaar_number
                                    ? '••••' + profile.aadhaar_number.slice(-4)
                                    : '—'}
                            />
                            <InfoRow label="PAN"             value={profile?.pan_number} />
                            <div className="cd-info-row cd-info-row--bordered">
                                <span className="cd-info-row__lbl">KYC Status</span>
                                <span className={`cd-kyc-badge cd-kyc-badge--${profile?.kyc_status || 'pending'}`}>
                                    {profile?.kyc_status === 'verified'
                                        ? 'Verified'
                                        : profile?.kyc_status === 'rejected'
                                            ? 'Rejected'
                                            : 'Pending'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* KYC verification card */}
                <div className="cd-card">
                    <h3 className="cd-card__title">KYC Verification</h3>
                    <p style={{ fontSize: 13, color: 'var(--cd-muted)', marginTop: -6 }}>
                        Verify your phone number and email address to complete KYC.
                    </p>

                    <VerifyRow
                        icon="📱"
                        label="Phone Number"
                        value={profile?.phone}
                        isVerified={user?.is_phone_verified}
                        onVerify={() => onOpenKYCModal('phone', profile?.phone)}
                    />

                    <VerifyRow
                        icon="✉️"
                        label="Email Address"
                        value={profile?.email}
                        isVerified={user?.is_email_verified}
                        onVerify={() => onOpenKYCModal('email', profile?.email)}
                    />

                    <div className={`cd-kyc-status ${kycStatusClass}`}>
                        {kycStatusText}
                    </div>
                </div>
            </div>
        </div>
    );
}