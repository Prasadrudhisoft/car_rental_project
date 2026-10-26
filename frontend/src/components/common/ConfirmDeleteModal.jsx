import React, { useState, useEffect, useCallback } from 'react';

export function ConfirmDeleteModal({ kind = 'item', name = '', detail = '', onConfirm, onClose }) {
    const word = String(name || 'DELETE');
    const [typed, setTyped] = useState('');
    const [busy,  setBusy]  = useState(false);
    const [err,   setErr]   = useState('');
    const ok = typed.trim() === word;

    useEffect(() => {
        const h = e => { if (e.key === 'Escape' && !busy) onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [busy, onClose]);

    const run = async () => {
        if (!ok || busy) return;
        setBusy(true); setErr('');
        try { await onConfirm(); onClose(); }
        catch (e) {
            setErr(e?.response?.data?.detail || e?.response?.data?.error || 'Could not delete. It may still be in use elsewhere.');
            setBusy(false);
        }
    };

    return (
        <div className="dc-backdrop" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
            <div className="dc-modal" role="alertdialog" aria-modal="true">
                <div className="dc-head">Permanently delete this {kind}?</div>
                <div className="dc-body">
                    <div className="dc-warn">⚠ This action is permanent and cannot be undone.</div>
                    {name && <div>You are about to delete the {kind} <span className="dc-word">{name}</span>.</div>}
                    {detail && <div>{detail}</div>}
                    <div>
                        To confirm, type <span className="dc-word">{word}</span> below:
                        <input className="vd-input" style={{ marginTop: 8 }} value={typed} autoFocus
                               onChange={e => setTyped(e.target.value)}
                               onKeyDown={e => e.key === 'Enter' && run()}
                               autoComplete="off" spellCheck={false} />
                    </div>
                    {err && <div className="dc-err">{err}</div>}
                </div>
                <div className="dc-foot">
                    <button className="dc-btn" onClick={onClose} disabled={busy}>Cancel</button>
                    <button className="dc-btn dc-btn--danger" onClick={run} disabled={!ok || busy}>
                        {busy ? 'Deleting…' : 'I understand, delete permanently'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function useConfirmDelete() {
    const [req, setReq] = useState(null);
    const ask = useCallback(opts => setReq(opts), []);
    const el  = req ? <ConfirmDeleteModal {...req} onClose={() => setReq(null)} /> : null;
    return [ask, el];
}