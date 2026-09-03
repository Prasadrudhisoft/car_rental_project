import React, { useState, useEffect, useMemo } from 'react';
import {
    adminSendNotification, getAdminUsers, getAdminVendors, getAdminList,
    getSegments,   // ← NEW import
} from '../../services/api';
import './Notifications.css';

export default function AdminSendNotificationForm({ onSent }) {
    const [form, setForm] = useState({
        target_type: 'all', user_id: '', role: 'customer', segment_id: '',
        title: '', message: '', link_url: '',
    });
    const [sending, setSending] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [userSearch, setUserSearch] = useState('');
    const [options, setOptions] = useState([]);
    const [segments, setSegments] = useState([]);   // ← NEW state

    const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    // Fetch recipient lists once, independent of any other tab's loaded state.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingUsers(true);
            try {
                const [customersRes, vendorsRes, adminsRes, segmentsRes] = await Promise.all([
                    getAdminUsers({ role: 'customer' }),
                    getAdminVendors(),
                    getAdminList(),
                    getSegments(),   // ← NEW fetch
                ]);
                if (cancelled) return;
                const customers = customersRes.data.results || customersRes.data || [];
                const vendors   = vendorsRes.data.results   || vendorsRes.data   || [];
                const admins    = adminsRes.data.results    || adminsRes.data    || [];
                setSegments(segmentsRes.data.results || segmentsRes.data || []);   // ← NEW

                const built = [
                    ...customers.map((u) => ({
                        id: u.id,
                        label: `${u.full_name || u.email} (customer)`,
                        search: `${u.full_name || ''} ${u.email || ''}`.toLowerCase(),
                    })),
                    ...vendors.map((v) => ({
                        id: v.user_id,
                        label: `${v.business_name || v.email} (vendor)`,
                        search: `${v.business_name || ''} ${v.email || ''}`.toLowerCase(),
                    })),
                    ...admins.map((a) => ({
                        id: a.user_id,
                        label: `${a.full_name || a.email} (admin)`,
                        search: `${a.full_name || ''} ${a.email || ''}`.toLowerCase(),
                    })),
                ].filter((o) => o.id != null);

                setOptions(built);
            } catch {
                setOptions([]);
                setSegments([]);
            } finally {
                if (!cancelled) setLoadingUsers(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const filteredOptions = useMemo(() => {
        if (!userSearch.trim()) return options;
        const q = userSearch.toLowerCase();
        return options.filter((o) => o.search.includes(q));
    }, [options, userSearch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.target_type === 'user' && !form.user_id) {
            alert('Please select a user to notify.');
            return;
        }
        if (form.target_type === 'segment' && !form.segment_id) {
            alert('Please select a segment to notify.');
            return;
        }
        setSending(true);
        try {
            const { data } = await adminSendNotification(form);
            alert(data.message);
            setForm((p) => ({ ...p, title: '', message: '', link_url: '' }));
            onSent && onSent();
        } catch (err) {
            alert(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to send.');
        }
        setSending(false);
    };

    return (
        <form className="ntf ntf-send-form" onSubmit={handleSubmit}>
            <span className="ntf-send-form__label">Send Notification</span>

            <div className="ntf-send-form__row">
                {/* ── UPDATED: added segment option ── */}
                <select value={form.target_type} onChange={set('target_type')}>
                    <option value="all">Everyone</option>
                    <option value="role">By Role</option>
                    <option value="segment">By Segment</option>
                    <option value="user">Specific User</option>
                </select>

                {form.target_type === 'role' && (
                    <select value={form.role} onChange={set('role')}>
                        <option value="customer">All Customers</option>
                        <option value="vendor">All Vendors</option>
                        <option value="admin">All Admins</option>
                    </select>
                )}

                {/* ── NEW: segment picker ── */}
                {form.target_type === 'segment' && (
                    <select value={form.segment_id} onChange={set('segment_id')} required style={{ minWidth: 220 }}>
                        <option value="">Select a segment…</option>
                        {segments.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {form.target_type === 'user' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                        placeholder="Search by name or email…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                    />
                    <select
                        value={form.user_id}
                        onChange={set('user_id')}
                        required
                        size={Math.min(6, Math.max(3, filteredOptions.length))}
                    >
                        {loadingUsers ? (
                            <option value="" disabled>Loading users…</option>
                        ) : filteredOptions.length === 0 ? (
                            <option value="" disabled>No users match "{userSearch}"</option>
                        ) : (
                            filteredOptions.map((o) => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))
                        )}
                    </select>
                </div>
            )}

            <input placeholder="Title" value={form.title} onChange={set('title')} required />
            <textarea placeholder="Message" rows={3} value={form.message} onChange={set('message')} required />
            <input
                placeholder="Link URL (optional, e.g. /vendor?tab=bookings)"
                value={form.link_url}
                onChange={set('link_url')}
            />

            <button type="submit" className="ntf-send-form__submit" disabled={sending}>
                {sending ? 'Sending…' : 'Send Notification'}
            </button>
        </form>
    );
}