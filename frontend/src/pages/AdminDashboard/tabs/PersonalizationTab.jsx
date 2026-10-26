
import React, { useState, useEffect, useCallback } from 'react';
import {
    getSegments,
    createSegment,
    deleteSegment,
    previewSegment,
    getTargetingRules,
    createTargetingRule,
    updateTargetingRule,
    deleteTargetingRule,
    runRuleNow,
    getRuleExecutionLogs,
    runScheduledSweep,
} from '../../../services/api';
import { SectionCard } from '../AdminShared';
import { useConfirmDelete } from '../../../components/common/ConfirmDeleteModal';

const FIELD_OPTIONS = [
    'total_bookings',
    'completed_bookings',
    'cancelled_bookings',
    'days_since_signup',
    'days_since_last_booking',
    'days_since_last_completed_booking',
    'total_spend',
    'avg_booking_value',
    'loyalty_points',
    'loyalty_tier',
    'kyc_complete',
    'has_pending_payment',
    'has_active_or_pending_booking',
    'reviews_written',
    'is_first_time_customer',
    'is_repeat_customer',
    'favorite_segment',
];

const OP_OPTIONS = [
    ['eq', 'equals'],
    ['neq', 'not equals'],
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
    ['in', 'in list'],
    ['not_in', 'not in list'],
    ['contains', 'contains'],
    ['is_true', 'is true'],
    ['is_false', 'is false'],
];

function ConditionBuilder({ conditions, setConditions }) {
    const add = () =>
        setConditions([
            ...conditions,
            { field: FIELD_OPTIONS[0], op: 'eq', value: '' },
        ]);

    const update = (i, patch) =>
        setConditions(
            conditions.map((c, idx) =>
                idx === i ? { ...c, ...patch } : c
            )
        );

    const remove = (i) =>
        setConditions(conditions.filter((_, idx) => idx !== i));

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}
        >
            {conditions.map((c, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <select
                        value={c.field}
                        onChange={(e) =>
                            update(i, { field: e.target.value })
                        }
                    >
                        {FIELD_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </select>

                    <select
                        value={c.op}
                        onChange={(e) =>
                            update(i, { op: e.target.value })
                        }
                    >
                        {OP_OPTIONS.map(([v, l]) => (
                            <option key={v} value={v}>
                                {l}
                            </option>
                        ))}
                    </select>

                    {!['is_true', 'is_false'].includes(c.op) && (
                        <input
                            placeholder="value"
                            value={c.value ?? ''}
                            onChange={(e) =>
                                update(i, { value: e.target.value })
                            }
                            style={{ width: 100 }}
                        />
                    )}

                    <button
                        type="button"
                        onClick={() => remove(i)}
                        style={{ color: '#EF4444' }}
                    >
                        ✕
                    </button>
                </div>
            ))}

            <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={add}
                style={{ width: 'fit-content' }}
            >
                + Add condition
            </button>
        </div>
    );
}

function SegmentPanel({ segments, onRefresh }) {
    const [askDelete, ConfirmEl] = useConfirmDelete();
    const [name, setName] = useState('');
    const [conditions, setConditions] = useState([
        { field: 'total_bookings', op: 'eq', value: 0 },
    ]);
    const [preview, setPreview] = useState(null);

    const handleCreate = async (e) => {
        e.preventDefault();

        try {
            await createSegment({ name, conditions });

            setName('');
            setConditions([
                { field: 'total_bookings', op: 'eq', value: 0 },
            ]);

            onRefresh();
        } catch (err) {
            alert(
                err.response?.data
                    ? JSON.stringify(err.response.data)
                    : 'Failed to create segment.'
            );
        }
    };

    const handlePreview = async (id) => {
        try {
            const { data } = await previewSegment(id);
            setPreview({ id, ...data });
        } catch (err) {
            alert(
                err.response?.data
                    ? JSON.stringify(err.response.data)
                    : 'Failed to preview segment.'
            );
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}
        >
            <form
                onSubmit={handleCreate}
                style={{
                    background: '#F8FAFB',
                    border: '1px solid #E8EDF2',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
            >
                <input
                    placeholder="Segment name (e.g. 'At-Risk Customer')"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />

                <ConditionBuilder
                    conditions={conditions}
                    setConditions={setConditions}
                />

                <button
                    type="submit"
                    className="admin-btn admin-btn--primary"
                    style={{ width: 'fit-content' }}
                >
                    + Create Segment
                </button>
            </form>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                {segments.map((s) => (
                    <div
                        key={s.id}
                        style={{
                            border: '1px solid #E8EDF2',
                            borderRadius: 10,
                            padding: '10px 14px',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <strong>{s.name}</strong>

                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    type="button"
                                    className="admin-btn admin-btn--ghost admin-btn--sm"
                                    onClick={() => handlePreview(s.id)}
                                >
                                    Preview
                                </button>

                                <button
                                    type="button"
                                    className="admin-btn admin-btn--danger admin-btn--sm"
                                    onClick={() =>
                                        askDelete({
                                            kind: 'segment',
                                            name: s.name,
                                            detail:
                                                'Rules attached to this segment must be removed first.',
                                            onConfirm: async () => {
                                                await deleteSegment(s.id);
                                                onRefresh();
                                            },
                                        })
                                    }
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div
                            style={{
                                fontSize: 11,
                                color: '#9CA3AF',
                                marginTop: 4,
                            }}
                        >
                            {(s.conditions || [])
                                .map(
                                    (c) =>
                                        `${c.field} ${c.op} ${c.value ?? ''}`
                                )
                                .join(' AND ')}
                        </div>

                        {preview?.id === s.id && (
                            <div
                                style={{
                                    marginTop: 8,
                                    fontSize: 12,
                                    background: '#E6F7F5',
                                    borderRadius: 8,
                                    padding: '8px 10px',
                                }}
                            >
                                <strong>{preview.total_matching}</strong>{' '}
                                users currently match.

                                {preview.sample?.length > 0 && (
                                    <div style={{ marginTop: 4 }}>
                                        {preview.sample
                                            .slice(0, 5)
                                            .map((u) => u.email)
                                            .join(', ')}
                                        {preview.sample.length > 5 ? '…' : ''}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {ConfirmEl}
        </div>
    );
}

function RulePanel({ segments, rules, onRefresh }) {
    const [askDelete, ConfirmEl] = useConfirmDelete();

    const [form, setForm] = useState({
        name: '',
        segment: '',
        trigger_type: 'scheduled',
        event_name: '',
        action_type: 'notification',
        cooldown_days: 30,
        priority: 100,
        title: '',
        message: '',
        link_url: '',
        points: 100,
    });

    const set = (k) => (e) =>
        setForm((p) => ({ ...p, [k]: e.target.value }));

    const handleCreate = async (e) => {
        e.preventDefault();

        const action_config =
            form.action_type === 'notification'
                ? {
                      title: form.title,
                      message: form.message,
                      link_url: form.link_url,
                  }
                : form.action_type === 'loyalty_bonus'
                  ? { points: Number(form.points) }
                  : {
                        code_prefix: 'PROMO',
                        discount_type: 'percentage',
                        discount_value: 10,
                        valid_days: 14,
                        notify_title: form.title,
                        notify_message: form.message,
                    };

        try {
            await createTargetingRule({
                name: form.name,
                segment: form.segment,
                trigger_type: form.trigger_type,
                event_name:
                    form.trigger_type === 'event' ? form.event_name : '',
                action_type: form.action_type,
                action_config,
                cooldown_days: Number(form.cooldown_days),
                priority: Number(form.priority),
            });

            onRefresh();
        } catch (err) {
            alert(
                err.response?.data
                    ? JSON.stringify(err.response.data)
                    : 'Failed to create rule.'
            );
        }
    };

    const handleRunNow = async (id) => {
        try {
            const res = await runRuleNow(id);
            alert(res.data.message);
        } catch (err) {
            alert(
                err.response?.data
                    ? JSON.stringify(err.response.data)
                    : 'Failed to run rule.'
            );
        }
    };

    const handleToggle = async (rule) => {
        try {
            await updateTargetingRule(rule.id, {
                is_active: !rule.is_active,
            });
            onRefresh();
        } catch (err) {
            alert(
                err.response?.data
                    ? JSON.stringify(err.response.data)
                    : 'Failed to update rule.'
            );
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}
        >
            <form
                onSubmit={handleCreate}
                style={{
                    background: '#F8FAFB',
                    border: '1px solid #E8EDF2',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
            >
                <input
                    placeholder="Rule name"
                    value={form.name}
                    onChange={set('name')}
                    required
                />

                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                    }}
                >
                    <select
                        value={form.segment}
                        onChange={set('segment')}
                        required
                    >
                        <option value="">Select segment…</option>
                        {segments.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={form.trigger_type}
                        onChange={set('trigger_type')}
                    >
                        <option value="scheduled">Scheduled (nightly)</option>
                        <option value="event">Event-driven</option>
                    </select>

                    {form.trigger_type === 'event' && (
                        <select
                            value={form.event_name}
                            onChange={set('event_name')}
                            required
                        >
                            <option value="">Which event?</option>
                            {[
                                'signup',
                                'booking_completed',
                                'booking_cancelled',
                                'payment_pending',
                                'review_submitted',
                            ].map((ev) => (
                                <option key={ev} value={ev}>
                                    {ev}
                                </option>
                            ))}
                        </select>
                    )}

                    <select
                        value={form.action_type}
                        onChange={set('action_type')}
                    >
                        <option value="notification">Send Notification</option>
                        <option value="promo_code">Grant Promo Code</option>
                        <option value="loyalty_bonus">
                            Credit Loyalty Points
                        </option>
                    </select>
                </div>

                {form.action_type !== 'loyalty_bonus' ? (
                    <>
                        <input
                            placeholder="Title"
                            value={form.title}
                            onChange={set('title')}
                            required
                        />

                        <textarea
                            placeholder="Message (supports {{first_name}}, {{loyalty_points}}, {{code}})"
                            value={form.message}
                            onChange={set('message')}
                            rows={2}
                            required
                        />

                        {form.action_type === 'notification' && (
                            <input
                                placeholder="Link URL (optional)"
                                value={form.link_url}
                                onChange={set('link_url')}
                            />
                        )}
                    </>
                ) : (
                    <input
                        type="number"
                        placeholder="Points to credit"
                        value={form.points}
                        onChange={set('points')}
                    />
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="number"
                        placeholder="Cooldown (days)"
                        value={form.cooldown_days}
                        onChange={set('cooldown_days')}
                        style={{ width: 140 }}
                    />

                    <input
                        type="number"
                        placeholder="Priority"
                        value={form.priority}
                        onChange={set('priority')}
                        style={{ width: 100 }}
                    />
                </div>

                <button
                    type="submit"
                    className="admin-btn admin-btn--primary"
                    style={{ width: 'fit-content' }}
                >
                    + Create Rule
                </button>
            </form>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                {rules.map((r) => (
                    <div
                        key={r.id}
                        style={{
                            border: '1px solid #E8EDF2',
                            borderRadius: 10,
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                        }}
                    >
                        <div>
                            <strong>{r.name}</strong>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: '#9CA3AF',
                                }}
                            >
                                {r.segment_name} · {r.trigger_type}
                                {r.event_name ? ` (${r.event_name})` : ''} ·{' '}
                                {r.action_type} · cooldown {r.cooldown_days}d
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                type="button"
                                className="admin-btn admin-btn--ghost admin-btn--sm"
                                onClick={() => handleToggle(r)}
                            >
                                {r.is_active ? 'Disable' : 'Enable'}
                            </button>

                            <button
                                type="button"
                                className="admin-btn admin-btn--success admin-btn--sm"
                                onClick={() => handleRunNow(r.id)}
                            >
                                Run Now
                            </button>

                            <button
                                type="button"
                                className="admin-btn admin-btn--danger admin-btn--sm"
                                onClick={() =>
                                    askDelete({
                                        kind: 'targeting rule',
                                        name: r.name,
                                        detail:
                                            'Its execution log is deleted with it.',
                                        onConfirm: async () => {
                                            await deleteTargetingRule(r.id);
                                            onRefresh();
                                        },
                                    })
                                }
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {ConfirmEl}
        </div>
    );
}

function LogPanel() {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        getRuleExecutionLogs()
            .then(({ data }) => setLogs(data.results || data))
            .catch((err) => {
                console.error('Failed to load execution logs:', err);
                setLogs([]);
            });
    }, []);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 400,
                overflowY: 'auto',
            }}
        >
            {logs.map((l) => (
                <div
                    key={l.id}
                    style={{
                        fontSize: 12,
                        padding: '8px 10px',
                        border: '1px solid #E8EDF2',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                    }}
                >
                    <span>
                        <strong>{l.rule_name}</strong> → {l.user_email}
                    </span>

                    <span
                        style={{
                            color:
                                l.status === 'sent'
                                    ? '#059669'
                                    : l.status === 'error'
                                      ? '#EF4444'
                                      : '#9CA3AF',
                        }}
                    >
                        {l.status} ·{' '}
                        {new Date(l.executed_at).toLocaleString('en-IN')}
                    </span>
                </div>
            ))}

            {logs.length === 0 && (
                <p style={{ color: '#9CA3AF', fontSize: 13 }}>
                    No executions logged yet.
                </p>
            )}
        </div>
    );
}

export default function PersonalizationTab() {
    const [segments, setSegments] = useState([]);
    const [rules, setRules] = useState([]);
    const [subTab, setSubTab] = useState('segments');

    const refresh = useCallback(() => {
        getSegments()
            .then(({ data }) => setSegments(data.results || data))
            .catch((err) =>
                console.error('Failed to load segments:', err)
            );

        getTargetingRules()
            .then(({ data }) => setRules(data.results || data))
            .catch((err) =>
                console.error('Failed to load targeting rules:', err)
            );
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleRunSweep = async () => {
        try {
            const response = await runScheduledSweep();
            alert(JSON.stringify(response.data));
        } catch (err) {
            alert(
                err.response?.data
                    ? JSON.stringify(err.response.data)
                    : 'Failed to run nightly sweep.'
            );
        }
    };

    return (
        <div className="admin-section">
            <SectionCard
                title="Personalization Engine"
                subtitle="Define who qualifies for what, and what happens automatically."
                action={
                    <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={handleRunSweep}
                    >
                        ▶ Run Nightly Sweep Now
                    </button>
                }
            >
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        marginBottom: 14,
                    }}
                >
                    {[
                        ['segments', 'Segments'],
                        ['rules', 'Rules'],
                        ['logs', 'Execution Log'],
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            className={`admin-btn admin-btn--sm ${
                                subTab === id
                                    ? 'admin-btn--primary'
                                    : 'admin-btn--ghost'
                            }`}
                            onClick={() => setSubTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {subTab === 'segments' && (
                    <SegmentPanel
                        segments={segments}
                        onRefresh={refresh}
                    />
                )}

                {subTab === 'rules' && (
                    <RulePanel
                        segments={segments}
                        rules={rules}
                        onRefresh={refresh}
                    />
                )}

                {subTab === 'logs' && <LogPanel />}
            </SectionCard>
        </div>
    );
}
