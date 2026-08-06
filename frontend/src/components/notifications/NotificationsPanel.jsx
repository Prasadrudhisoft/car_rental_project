// ─────────────────────────────────────────────────────────────────────────────
// NotificationsPanel.jsx
// Full-page/tab list of a user's notifications — used inside the
// "Notifications" tab on Admin, Vendor, and Customer dashboards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api';
import './Notifications.css';

const TYPE_ICON = {
    vehicle_added: '🚗',
    vehicle_edit_pending: '✏️',
    vehicle_edit_decided: '✅',
    booking_created: '📅',
    admin_broadcast: '📢',
    system: '🔔',
};

export default function NotificationsPanel() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState(''); // '' | 'unread'
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await getNotifications(filter === 'unread' ? { is_read: 'false' } : {});
            setItems(data.results || data);
        } catch { setItems([]); }
        setLoading(false);
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const handleClick = async (n) => {
        if (!n.is_read) {
            try { await markNotificationRead(n.id); } catch {}
            setItems((p) => p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        }
        if (n.link_url) navigate(n.link_url);
    };

    const handleMarkAll = async () => {
        try { await markAllNotificationsRead(); load(); } catch {}
    };

    return (
        <div className="ntf ntf-panel">
            <div className="ntf-panel__toolbar">
                <div className="ntf-panel__pills">
                    {[['', 'All'], ['unread', 'Unread']].map(([val, label]) => (
                        <button
                            key={val}
                            className={`ntf-pill${filter === val ? ' ntf-pill--active' : ''}`}
                            onClick={() => setFilter(val)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button className="ntf-panel__markall" onClick={handleMarkAll}>Mark all read</button>
            </div>

            {loading ? (
                <div className="ntf-panel__empty">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ntf-panel__empty">
                    <span className="ntf-panel__empty-icon">🔔</span>
                    No notifications{filter === 'unread' ? " — you're all caught up." : ' yet.'}
                </div>
            ) : (
                <div className="ntf-panel__list">
                    {items.map((n) => (
                        <button
                            key={n.id}
                            className={`ntf-card${!n.is_read ? ' ntf-card--unread' : ''}`}
                            onClick={() => handleClick(n)}
                        >
                            <span className="ntf-card__icon">{TYPE_ICON[n.notification_type] || '🔔'}</span>
                            <div className="ntf-card__body">
                                <div className="ntf-card__head">
                                    <span className="ntf-card__title">{n.title}</span>
                                    {!n.is_read && <span className="ntf-dot" />}
                                </div>
                                <p className="ntf-card__msg">{n.message}</p>
                                <span className="ntf-card__meta">
                                    {new Date(n.created_at).toLocaleString('en-IN')}
                                    {n.created_by_name && ` · from ${n.created_by_name}`}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}