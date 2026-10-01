import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getNotifications, getUnreadNotificationCount,
    markNotificationRead, markAllNotificationsRead,
} from '../../services/api';
import './Notifications.css';

const POLL_MS = 30000;

export default function NotificationBell() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pulse, setPulse] = useState(false);
    const lastSeenIdRef = useRef(null);
    const wrapRef = useRef(null);

    if (document.hidden) return;

    const pollCount = useCallback(async () => {
        try {
            const { data } = await getUnreadNotificationCount();
            setUnreadCount(data.unread_count);
            if (lastSeenIdRef.current !== null && data.latest_id && data.latest_id !== lastSeenIdRef.current) {
                setPulse(true);
                setTimeout(() => setPulse(false), 1600);
            }
            lastSeenIdRef.current = data.latest_id;
        } catch { /* silent — background poll */ }
    }, []);

    useEffect(() => {
        pollCount();
        const t = setInterval(pollCount, POLL_MS);
        return () => clearInterval(t);
    }, [pollCount]);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const openDropdown = async () => {
        const willOpen = !open;
        setOpen(willOpen);
        if (willOpen) {
            setLoading(true);
            try {
                const { data } = await getNotifications();
                setItems((data.results || data).slice(0, 8));
            } catch { setItems([]); }
            setLoading(false);
        }
    };

    const handleClickItem = async (n) => {
        if (!n.is_read) {
            try { await markNotificationRead(n.id); } catch {}
            setItems((p) => p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
            setUnreadCount((c) => Math.max(0, c - 1));
        }
        setOpen(false);
        if (n.link_url) navigate(n.link_url);
    };

    const handleMarkAll = async () => {
        try {
            await markAllNotificationsRead();
            setItems((p) => p.map((x) => ({ ...x, is_read: true })));
            setUnreadCount(0);
        } catch {}
    };

    return (
        <div className="ntf" ref={wrapRef} style={{ position: 'relative' }}>
            <button
                className={`ntf-bell${pulse ? ' ntf-bell--pulse' : ''}`}
                onClick={openDropdown}
                aria-label="Notifications"
                title="Notifications"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="ntf-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {open && (
                <div className="ntf-dropdown">
                    <div className="ntf-dropdown__head">
                        <strong>Notifications</strong>
                        <button className="ntf-dropdown__markall" onClick={handleMarkAll}>Mark all read</button>
                    </div>
                    {loading ? (
                        <div className="ntf-dropdown__loading">Loading…</div>
                    ) : items.length === 0 ? (
                        <div className="ntf-dropdown__empty">No notifications yet.</div>
                    ) : (
                        items.map((n) => (
                            <button
                                key={n.id}
                                className={`ntf-dropdown__item${!n.is_read ? ' ntf-dropdown__item--unread' : ''}`}
                                onClick={() => handleClickItem(n)}
                            >
                                <div className="ntf-item__row">
                                    {!n.is_read && <span className="ntf-dot" />}
                                    <span className="ntf-item__title">{n.title}</span>
                                </div>
                                <p className="ntf-item__msg">{n.message}</p>
                                <span className="ntf-item__time">{new Date(n.created_at).toLocaleString('en-IN')}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}