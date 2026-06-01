// ─────────────────────────────────────────────────────────────────────────────
// MediaComponents.jsx
// PhotoLightbox  — full-screen image carousel (keyboard navigable)
// KYCDocumentCell — shows a KYC file as thumbnail / PDF link / generic link
// DocPreviewRow   — inline doc preview with status badge
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";

// ── Photo lightbox ────────────────────────────────────────────────────────────
export function PhotoLightbox({ photos, initialIndex = 0, onClose }) {
    const [idx, setIdx] = useState(initialIndex);

    useEffect(() => {
        const h = (e) => {
            if (e.key === "Escape")      onClose();
            if (e.key === "ArrowRight")  setIdx((i) => Math.min(i + 1, photos.length - 1));
            if (e.key === "ArrowLeft")   setIdx((i) => Math.max(i - 1, 0));
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [photos.length, onClose]);

    const src   = photos[idx]?.image || photos[idx]?.url || photos[idx];
    const label = photos[idx]?.angle || photos[idx]?.label || "";

    return (
        <div
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}
        >
            <button
                onClick={onClose}
                style={{ position: "absolute", top: 20, right: 24, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
                ✕ Close
            </button>
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                    onClick={() => setIdx((i) => Math.max(i - 1, 0))}
                    disabled={idx === 0}
                    style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 8, padding: "10px 18px", fontSize: 20, cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1 }}
                >‹</button>
                <div style={{ textAlign: "center" }}>
                    <img src={src} alt={label} style={{ maxWidth: "min(80vw,960px)", maxHeight: "72vh", objectFit: "contain", borderRadius: 12 }} />
                    {label && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.6)", textTransform: "capitalize" }}>
                            {label} · {idx + 1}/{photos.length}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setIdx((i) => Math.min(i + 1, photos.length - 1))}
                    disabled={idx === photos.length - 1}
                    style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 8, padding: "10px 18px", fontSize: 20, cursor: idx === photos.length - 1 ? "not-allowed" : "pointer", opacity: idx === photos.length - 1 ? 0.3 : 1 }}
                >›</button>
            </div>
        </div>
    );
}

// ── KYC document cell ─────────────────────────────────────────────────────────
export function KYCDocumentCell({ url }) {
    const [open, setOpen] = useState(false);
    if (!url)
        return <span style={{ color: "#EF4444", fontSize: 11, fontWeight: 600 }}>Not uploaded</span>;

    const isImg = /\.(jpg|jpeg|png|webp)$/i.test(url);
    const isPDF = url.toLowerCase().includes(".pdf");

    return (
        <>
            {isImg ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <div
                        onClick={() => setOpen(true)}
                        style={{ cursor: "pointer", borderRadius: 6, overflow: "hidden", border: "1px solid var(--vbdr)", display: "inline-block" }}
                    >
                        <img src={url} alt="KYC" style={{ width: 72, height: 52, objectFit: "cover", display: "block" }} />
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "var(--teal-primary)", textDecoration: "underline" }}>
                        Open ↗
                    </a>
                </div>
            ) : isPDF ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="admin-doc-link">
                    <span>📄</span><span>PDF</span>
                </a>
            ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className="admin-doc-link">
                    <span>📎</span><span>File</span>
                </a>
            )}
            {open && (
                <PhotoLightbox photos={[{ image: url, label: "KYC Document" }]} onClose={() => setOpen(false)} />
            )}
        </>
    );
}

// ── Doc preview row ───────────────────────────────────────────────────────────
export function DocPreviewRow({ doc }) {
    const [open, setOpen] = useState(false);
    if (!doc?.file) return null;

    const isImg = /\.(jpg|jpeg|png|webp)$/i.test(doc.file);
    const isPDF = doc.file.toLowerCase().includes(".pdf");
    const dc =
        doc.status === "approved" ? { bg: "#D1FAE5", color: "#059669" } :
        doc.status === "rejected" ? { bg: "#FEE2E2", color: "#EF4444" } :
                                    { bg: "#FEF3C7", color: "#D97706" };

    return (
        <>
            {open && isImg && (
                <PhotoLightbox photos={[{ image: doc.file, label: doc.doc_type }]} onClose={() => setOpen(false)} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {isImg ? (
                    <div onClick={() => setOpen(true)} style={{ cursor: "pointer", borderRadius: 5, overflow: "hidden", border: "1px solid var(--vbdr)", flexShrink: 0 }}>
                        <img src={doc.file} alt={doc.doc_type} style={{ width: 48, height: 36, objectFit: "cover", display: "block" }} />
                    </div>
                ) : isPDF ? (
                    <a href={doc.file} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "var(--teal-primary)", background: "#E6F7F5", padding: "2px 7px", borderRadius: 4, fontWeight: 600, textDecoration: "none" }}>
                        📄 PDF
                    </a>
                ) : (
                    <a href={doc.file} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "var(--teal-primary)" }}>View</a>
                )}
                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: dc.bg, color: dc.color }}>
                    {doc.status}
                </span>
            </div>
        </>
    );
}
