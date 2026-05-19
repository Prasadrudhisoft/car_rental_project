/**
 * DataTable.jsx — Shared reusable table component
 * Provides: column definitions, sorting, search, filters, pagination, row actions
 * Used by AdminDashboard, VendorDashboard, CustomerDashboard
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

// ── Sort icon ─────────────────────────────────────────────────────────────
function SortIcon({ direction }) {
    if (!direction) return (
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ opacity: 0.3, marginLeft: 4, flexShrink: 0 }}>
            <path d="M5 1L8 4H2L5 1Z" fill="currentColor" />
            <path d="M5 11L2 8H8L5 11Z" fill="currentColor" />
        </svg>
    );
    return (
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ marginLeft: 4, flexShrink: 0, color: 'var(--dt-acc)' }}>
            {direction === 'asc'
                ? <path d="M5 1L9 6H1L5 1Z" fill="currentColor" />
                : <path d="M5 11L1 6H9L5 11Z" fill="currentColor" />}
        </svg>
    );
}

// ── Filter Pill ───────────────────────────────────────────────────────────
function FilterPill({ label, value, options, onChange, colorMap }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    const selected = options.find(o => o.value === value);
    const isActive = value !== '' && value != null;
    return (
        <div className="dt-filter-pill" ref={ref}>
            <button
                className={`dt-filter-pill__btn${isActive ? ' active' : ''}${open ? ' open' : ''}`}
                onClick={() => setOpen(v => !v)}
            >
                <span className="dt-filter-pill__label">{label}</span>
                {isActive && selected && (
                    <span
                        className="dt-filter-pill__chip"
                        style={colorMap?.[selected.value]
                            ? { background: colorMap[selected.value].bg, color: colorMap[selected.value].color }
                            : undefined}
                    >
                        {selected.label}
                    </span>
                )}
                <span className={`dt-filter-pill__chevron${open ? ' flipped' : ''}`}>▾</span>
            </button>
            {open && (
                <div className="dt-filter-pill__menu">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            className={`dt-filter-pill__item${value === opt.value ? ' selected' : ''}`}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                        >
                            {colorMap?.[opt.value] && (
                                <span className="dt-filter-pill__dot" style={{ background: colorMap[opt.value].color }} />
                            )}
                            <span>{opt.label}</span>
                            {value === opt.value && <span className="dt-filter-pill__check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * DataTable — Main component
 *
 * Props:
 *  columns: Array<{ key, label, sortable?, render?, width?, align? }>
 *  data: Array<object>
 *  searchable: bool (show search box)
 *  searchKeys: string[] (which keys to search across)
 *  searchPlaceholder: string
 *  filters: Array<{ key, label, options: [{value,label}], colorMap? }>
 *  onRowAction: (row) => void  — called on "View Details" click
 *  actionLabel: string (default "View Details")
 *  emptyIcon: string
 *  emptyMessage: string
 *  pageSize: number (default 20)
 *  loading: bool
 *  stickyHeader: bool
 *  rowClassName: (row) => string
 *  extraActions: Array<{ label, onClick, className?, show?: (row)=>bool }>
 */
export default function DataTable({
    columns = [],
    data = [],
    searchable = true,
    searchKeys = [],
    searchPlaceholder = 'Search…',
    filters = [],
    onRowAction,
    actionLabel = 'View Details',
    emptyIcon = '📭',
    emptyMessage = 'No data found.',
    pageSize = 20,
    loading = false,
    stickyHeader = true,
    rowClassName,
    extraActions = [],
}) {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const [filterValues, setFilterValues] = useState(() =>
        Object.fromEntries(filters.map(f => [f.key, '']))
    );
    const [page, setPage] = useState(1);

    // Reset page when search/filter changes
    useEffect(() => { setPage(1); }, [search, JSON.stringify(filterValues)]);

    const handleSort = useCallback((key) => {
        setSortKey(prev => {
            if (prev === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return key; }
            setSortDir('asc');
            return key;
        });
    }, []);

    const handleFilterChange = useCallback((key, value) => {
        setFilterValues(prev => ({ ...prev, [key]: value }));
    }, []);

    const filtered = useMemo(() => {
        let result = [...data];
        // Search
        if (search.trim() && searchKeys.length > 0) {
            const q = search.toLowerCase();
            result = result.filter(row =>
                searchKeys.some(k => {
                    const val = k.split('.').reduce((o, p) => o?.[p], row);
                    return String(val ?? '').toLowerCase().includes(q);
                })
            );
        }
        // Filters
        for (const f of filters) {
            const val = filterValues[f.key];
            if (val === '' || val == null) continue;
            result = result.filter(row => {
                const rowVal = f.key.split('.').reduce((o, p) => o?.[p], row);
                return String(rowVal) === String(val);
            });
        }
        // Sort
        if (sortKey) {
            result.sort((a, b) => {
                const av = sortKey.split('.').reduce((o, p) => o?.[p], a) ?? '';
                const bv = sortKey.split('.').reduce((o, p) => o?.[p], b) ?? '';
                const cmp = typeof av === 'number' && typeof bv === 'number'
                    ? av - bv
                    : String(av).localeCompare(String(bv), undefined, { numeric: true });
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [data, search, searchKeys, filterValues, filters, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    const hasActiveFilters = Object.values(filterValues).some(v => v !== '');
    const clearAll = () => {
        setSearch('');
        setFilterValues(Object.fromEntries(filters.map(f => [f.key, ''])));
        setPage(1);
    };

    const showAction = onRowAction || extraActions.length > 0;
    const effectiveColumns = showAction
        ? [...columns, { key: '__actions__', label: 'Actions', sortable: false, width: extraActions.length > 0 ? 180 : 130, align: 'right' }]
        : columns;

    return (
        <div className="dt-wrapper">
            {/* Toolbar */}
            {(searchable || filters.length > 0) && (
                <div className="dt-toolbar">
                    {searchable && (
                        <div className="dt-search">
                            <svg className="dt-search__icon" viewBox="0 0 20 20" fill="none">
                                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <input
                                className="dt-search__input"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button className="dt-search__clear" onClick={() => setSearch('')}>✕</button>
                            )}
                        </div>
                    )}
                    <div className="dt-filters">
                        {filters.map(f => (
                            <FilterPill
                                key={f.key}
                                label={f.label}
                                value={filterValues[f.key]}
                                options={f.options}
                                onChange={v => handleFilterChange(f.key, v)}
                                colorMap={f.colorMap}
                            />
                        ))}
                        {(search || hasActiveFilters) && (
                            <button className="dt-clear-all" onClick={clearAll}>
                                ✕ Clear all
                            </button>
                        )}
                    </div>
                    <div className="dt-toolbar__count">
                        {filtered.length} of {data.length} row{data.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="dt-scroll">
                <table className="dt-table">
                    <thead className={stickyHeader ? 'dt-thead--sticky' : ''}>
                        <tr>
                            {effectiveColumns.map(col => (
                                <th
                                    key={col.key}
                                    className={`dt-th${col.sortable !== false && col.key !== '__actions__' ? ' dt-th--sortable' : ''}${sortKey === col.key ? ' dt-th--sorted' : ''}`}
                                    style={{
                                        width: col.width,
                                        textAlign: col.align || 'left',
                                        ...(col.key === '__actions__' ? { textAlign: 'right' } : {}),
                                    }}
                                    onClick={col.sortable !== false && col.key !== '__actions__' ? () => handleSort(col.key) : undefined}
                                >
                                    <span className="dt-th__inner">
                                        {col.label}
                                        {col.sortable !== false && col.key !== '__actions__' && (
                                            <SortIcon direction={sortKey === col.key ? sortDir : null} />
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={effectiveColumns.length} className="dt-td--loading">
                                    <div className="dt-spinner" />
                                    <span>Loading…</span>
                                </td>
                            </tr>
                        ) : paged.length === 0 ? (
                            <tr>
                                <td colSpan={effectiveColumns.length} className="dt-td--empty">
                                    <span className="dt-empty-icon">{emptyIcon}</span>
                                    <span>{emptyMessage}</span>
                                </td>
                            </tr>
                        ) : paged.map((row, idx) => (
                            <tr
                                key={row.id ?? idx}
                                className={`dt-tr${rowClassName ? ' ' + rowClassName(row) : ''}`}
                            >
                                {columns.map(col => (
                                    <td
                                        key={col.key}
                                        className="dt-td"
                                        style={{ textAlign: col.align || 'left' }}
                                    >
                                        {col.render
                                            ? col.render(row[col.key], row)
                                            : (row[col.key] ?? '—')}
                                    </td>
                                ))}
                                {showAction && (
                                    <td className="dt-td dt-td--actions">
                                        <div className="dt-actions-cell">
                                            {extraActions
                                                .filter(a => !a.show || a.show(row))
                                                .map((a, i) => (
                                                    <button
                                                        key={i}
                                                        className={`dt-action-btn ${a.className || 'dt-action-btn--secondary'}`}
                                                        onClick={e => { e.stopPropagation(); a.onClick(row); }}
                                                    >
                                                        {a.label}
                                                    </button>
                                                ))}
                                            {onRowAction && (
                                                <button
                                                    className="dt-action-btn dt-action-btn--primary"
                                                    onClick={e => { e.stopPropagation(); onRowAction(row); }}
                                                >
                                                    {actionLabel} →
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="dt-pagination">
                    <span className="dt-pagination__info">
                        Page {page} of {totalPages} · {filtered.length} results
                    </span>
                    <div className="dt-pagination__controls">
                        <button
                            className="dt-page-btn"
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                        >«</button>
                        <button
                            className="dt-page-btn"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >‹</button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                            const p = start + i;
                            return p <= totalPages ? (
                                <button
                                    key={p}
                                    className={`dt-page-btn${page === p ? ' active' : ''}`}
                                    onClick={() => setPage(p)}
                                >{p}</button>
                            ) : null;
                        })}
                        <button
                            className="dt-page-btn"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >›</button>
                        <button
                            className="dt-page-btn"
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                        >»</button>
                    </div>
                </div>
            )}
        </div>
    );
}