// ─────────────────────────────────────────────────────────────────────────────
// tabs/ProfileTab.jsx
// Personal info card + KYC & address form (includes MapPicker).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { SectionCard, FormInput, FormSelect, Field } from '../VendorShared';
import { KYCDocumentViewer, MapPicker } from '../VendorMediaComponents';

export default function ProfileTab({
    profile,
    profileEdit,
    setProfileEdit,
    profileForm,
    setProfileForm,
    onProfileSave,
    kycForm,
    setKycForm,
    kycFile,
    setKycFile,
    kycStateDisplay,
    showMap,
    setShowMap,
    cities,
    onKYCSubmit,
    kycComplete,
}) {
    return (
        <div className="vd-grid-2">
            {/* ── Personal Information ── */}
            <SectionCard
                title="Personal Information"
                action={
                    <button
                        className="vd-btn vd-btn--outline vd-btn--sm"
                        onClick={() => setProfileEdit(v => !v)}
                    >
                        {profileEdit ? 'Cancel' : 'Edit'}
                    </button>
                }
            >
                {/* KYC checklist / complete banner */}
                {!kycComplete && (
                    <div className="vd-kyc-progress-banner">
                        <div className="vd-kyc-progress-banner__icon">📋</div>
                        <div>
                            <strong>KYC Checklist</strong>
                            <div className="vd-kyc-checklist">
                                {[
                                    [!!profile.bank_account_no,                   'Bank account details'],
                                    [!!profile.city_id,                           'City & address'],
                                    [!!(profile.latitude && profile.longitude),   'Pickup location pin'],
                                    [!!profile.kyc_document,                      'KYC document uploaded'],
                                ].map(([done, label]) => (
                                    <div key={label} className={`vd-kyc-check-item ${done ? 'done' : ''}`}>
                                        <span>{done ? '✓' : '○'}</span>
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {kycComplete && (
                    <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#059669', fontWeight: 600 }}>
                        ✓ KYC Complete
                    </div>
                )}

                {/* Profile rows */}
                <div className="vd-profile-rows">
                    {[
                        ['Business Name', profile.business_name],
                        ['Email',         profile.email],
                        ['Phone',         profile.phone],
                        ['GSTIN',         profile.gstin || '—'],
                        ['Rating',        profile.rating ? `★ ${profile.rating}` : '—'],
                        ['City',          profile.city_name || '—'],
                        ['Location Pin',  (profile.latitude && profile.longitude)
                            ? `${parseFloat(profile.latitude).toFixed(5)}, ${parseFloat(profile.longitude).toFixed(5)}`
                            : 'Not set'],
                    ].map(([l, v]) => (
                        <div key={l} className="vd-profile-row">
                            <span className="vd-profile-row__lbl">{l}</span>
                            <strong className="vd-profile-row__val">{v}</strong>
                        </div>
                    ))}

                    {/* KYC document */}
                    <div className="vd-profile-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                        <span className="vd-profile-row__lbl">KYC Document</span>
                        <KYCDocumentViewer profile={profile} />
                        {!profile.kyc_document && (
                            <span style={{ color: '#EF4444', fontWeight: 600, fontSize: 12 }}>Not uploaded</span>
                        )}
                    </div>

                    {/* Bank details (masked) */}
                    {profile.bank_account_no && (
                        <>
                            {[
                                ['Bank Name',    profile.bank_account_name],
                                ['Account No.',  `••••${profile.bank_account_no.slice(-4)}`],
                                ['IFSC',         profile.bank_ifsc],
                            ].map(([l, v]) => (
                                <div key={l} className="vd-profile-row">
                                    <span className="vd-profile-row__lbl">{l}</span>
                                    <strong className="vd-profile-row__val">{v}</strong>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Edit form (shop hours only) */}
                {profileEdit && (
                    <div className="vd-profile-edit-area">
                        <div className="vd-fg vd-fg--2">
                            <FormInput
                                label="Opening Time"
                                type="time"
                                value={profileForm.shop_opening_time}
                                onChange={e => setProfileForm(p => ({ ...p, shop_opening_time: e.target.value }))}
                            />
                            <FormInput
                                label="Closing Time"
                                type="time"
                                value={profileForm.shop_closing_time}
                                onChange={e => setProfileForm(p => ({ ...p, shop_closing_time: e.target.value }))}
                            />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <button className="vd-btn vd-btn--primary" onClick={onProfileSave}>Save Changes</button>
                        </div>
                    </div>
                )}
            </SectionCard>

            {/* ── KYC & Address ── */}
            <SectionCard title="KYC & Address">
                {profile.status === 'pending' && (
                    <div className="vd-kyc-alert">
                        Your account is pending approval — submit KYC details to proceed.
                    </div>
                )}

                <form onSubmit={onKYCSubmit}>
                    {/* Identity & Bank */}
                    <div className="vd-kyc-section-label">Identity & Bank Details</div>
                    <div className="vd-fg vd-fg--2">
                        <FormInput label="Aadhaar Number"    value={kycForm.aadhaar_number}    onChange={e => setKycForm(p => ({ ...p, aadhaar_number:    e.target.value }))} />
                        <FormInput label="PAN Number"        value={kycForm.pan_number}        onChange={e => setKycForm(p => ({ ...p, pan_number:        e.target.value }))} />
                        <FormInput label="Bank Account Name" value={kycForm.bank_account_name} onChange={e => setKycForm(p => ({ ...p, bank_account_name: e.target.value }))} />
                        <FormInput label="Account No."       value={kycForm.bank_account_no}   onChange={e => setKycForm(p => ({ ...p, bank_account_no:   e.target.value }))} />
                        <FormInput label="IFSC Code"         value={kycForm.bank_ifsc}         onChange={e => setKycForm(p => ({ ...p, bank_ifsc:         e.target.value }))} />
                        <Field label="KYC Document (PDF / Image)">
                            <input type="file" accept=".pdf,.jpg,.png" className="vd-file-input" onChange={e => setKycFile(e.target.files[0])} />
                            {profile.kyc_document && (
                                <a href={profile.kyc_document} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--vacc)', marginTop: 4, display: 'inline-block' }}>
                                    View current document
                                </a>
                            )}
                        </Field>
                    </div>

                    {/* Shop Hours */}
                    <div className="vd-kyc-section-label" style={{ marginTop: 16 }}>Shop Hours</div>
                    <div className="vd-fg vd-fg--2">
                        <FormInput label="Opening Time" type="time" value={kycForm.shop_opening_time} onChange={e => setKycForm(p => ({ ...p, shop_opening_time: e.target.value }))} />
                        <FormInput label="Closing Time" type="time" value={kycForm.shop_closing_time} onChange={e => setKycForm(p => ({ ...p, shop_closing_time: e.target.value }))} />
                    </div>

                    {/* Address */}
                    <div className="vd-kyc-section-label" style={{ marginTop: 16 }}>Business Address</div>
                    <div className="vd-fg vd-fg--2">
                        <FormInput label="Address Line 1"   value={kycForm.addr_line1} onChange={e => setKycForm(p => ({ ...p, addr_line1: e.target.value }))} />
                        <FormInput label="Address Line 2"   value={kycForm.addr_line2} onChange={e => setKycForm(p => ({ ...p, addr_line2: e.target.value }))} />
                        <FormInput label="Landmark / Line 3" value={kycForm.addr_line3} onChange={e => setKycForm(p => ({ ...p, addr_line3: e.target.value }))} />
                        <FormInput label="PIN Code"         value={kycForm.pincode}    onChange={e => setKycForm(p => ({ ...p, pincode:    e.target.value }))} />
                        <Field label="City *">
                            <select
                                className="vd-input vd-select"
                                value={kycForm.city}
                                onChange={e => setKycForm(p => ({ ...p, city: e.target.value }))}
                                required
                            >
                                <option value="">— Select City —</option>
                                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </Field>
                        <Field label="State">
                            <div className="vd-input--ro">
                                {kycStateDisplay || <span style={{ color: 'var(--vm)' }}>Auto-filled from city</span>}
                            </div>
                        </Field>
                    </div>

                    {/* Map pin */}
                    <div className="vd-kyc-section-label" style={{ marginTop: 18 }}>
                        Pickup Location Pin <span className="vd-kyc-section-badge">Required</span>
                    </div>
                    <button
                        type="button"
                        className="vd-map-toggle-btn"
                        onClick={() => setShowMap(m => !m)}
                    >
                        {showMap ? '▲ Hide Map' : 'Open Map'}
                        {kycForm.latitude && <span className="vd-map-pin-ok"> ✓ Location Pinned</span>}
                    </button>
                    {showMap && (
                        <MapPicker
                            lat={kycForm.latitude}
                            lng={kycForm.longitude}
                            onLocationSelect={(lat, lng) => setKycForm(p => ({
                                ...p,
                                latitude:  lat  !== null ? Number(lat.toFixed(7))  : '',
                                longitude: lng  !== null ? Number(lng.toFixed(7))  : '',
                            }))}
                        />
                    )}

                    <div style={{ marginTop: 20 }}>
                        <button type="submit" className="vd-btn vd-btn--primary">Submit KYC →</button>
                    </div>
                </form>
            </SectionCard>
        </div>
    );
}