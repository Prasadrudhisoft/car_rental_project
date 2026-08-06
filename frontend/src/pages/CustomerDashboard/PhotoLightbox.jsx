import React, { useState, useEffect } from 'react';

export default function PhotoLightbox({ photos, initialIndex, onClose }) {
    const [current, setCurrent] = useState(initialIndex || 0);

    useEffect(() => {
        const h = e => {
            if (e.key === 'Escape')     onClose();
            if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, photos.length - 1));
            if (e.key === 'ArrowLeft')  setCurrent(c => Math.max(c - 1, 0));
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [photos.length, onClose]);

    const navBtnStyle = (disabled) => ({
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff', borderRadius: 8,
        padding: '10px 16px', fontSize: 18,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
    });

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.88)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexDirection: 'column', gap: 16,
            }}
        >
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: 20, right: 24,
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', borderRadius: 8,
                    padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
            >
                ✕ Close
            </button>

            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                    style={navBtnStyle(current === 0)}
                    onClick={() => setCurrent(c => Math.max(c - 1, 0))}
                    disabled={current === 0}
                >‹</button>

                <img
                    src={photos[current].image}
                    alt={photos[current].angle || 'inspection'}
                    style={{
                        maxWidth: 'min(80vw, 900px)', maxHeight: '70vh',
                        objectFit: 'contain', borderRadius: 12,
                    }}
                />

                <button
                    style={navBtnStyle(current === photos.length - 1)}
                    onClick={() => setCurrent(c => Math.min(c + 1, photos.length - 1))}
                    disabled={current === photos.length - 1}
                >›</button>
            </div>
        </div>
    );
}