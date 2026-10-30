import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { get, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { isAdmin } from '../config/admin';
import { Attribution, formatShortDate } from '../services/attribution';
import { fetchImgsService, PhotoMeta } from '../services/fetchImgService';
import { REMOVAL_REASONS } from './SuggestRemoval';

interface AdminDashboardProps {
    onNavigate?: (view: string, data?: any) => void;
}

type Person = Attribution & { email?: string };

interface Data {
    details: Record<string, any>;
    photoMeta: Record<string, PhotoMeta>;
    archivedPhotos: Record<string, { slipwayId: string; position: number; archivedBy: Person; archivedAt: number }>;
    comments: Record<string, Record<string, { userName: string; text: string; createdAt: number }>>;
    suggestions: Record<string, { type: string; message: string; email?: string; createdAt: number }>;
    removalRequests: Record<string, Record<string, { reason: string; note?: string; slipwayName: string; requestedBy: Person; createdAt: number }>>;
}

const NODES: (keyof Data)[] = ['details', 'photoMeta', 'archivedPhotos', 'comments', 'suggestions', 'removalRequests'];
const PATHS: Record<keyof Data, string> = {
    details: 'slipwayDetails',
    photoMeta: 'photoMeta',
    archivedPhotos: 'archivedPhotos',
    comments: 'comments',
    suggestions: 'suggestions',
    removalRequests: 'removalRequests'
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

const monthBounds = (month: string) => {
    const [year, m] = month.split('-').map(Number);
    return { start: new Date(year, m - 1, 1).getTime(), end: new Date(year, m, 1).getTime() };
};

const who = (person?: Person) => person ? `${person.name}${person.email ? ` (${person.email})` : ''}` : 'Unknown';

// Admin-only overview of site activity. The database rules are what keep the data private; this check only hides the page.
const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [month, setMonth] = useState(currentMonth);
    const [data, setData] = useState<Data | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const values = await Promise.all(NODES.map(async (node) => (await get(ref(database, PATHS[node]))).val() || {}));
            setData(Object.fromEntries(NODES.map((node, i) => [node, values[i]])) as unknown as Data);
        } catch (err) {
            console.error('Dashboard load failed:', err);
            setError('Could not load the dashboard. Have the latest database rules been deployed?');
        }
    }, []);

    useEffect(() => {
        if (isAdmin(user)) load();
    }, [user, load]);

    const view = useMemo(() => {
        if (!data) return null;
        const { start, end } = monthBounds(month);
        const inRange = (ts: unknown) => typeof ts === 'number' && ts >= start && ts < end;
        const nameOf = (id: string) => data.details[id]?.Name || id;

        const added = Object.entries(data.details)
            .filter(([, d]) => inRange(d.createdAt))
            .map(([id, d]) => ({ id, name: d.Name, by: d.createdBy as Person, at: d.createdAt as number, fromOsm: d.importedFrom === 'OSM' }))
            .sort((a, b) => b.at - a.at);
        const edited = Object.entries(data.details)
            .filter(([, d]) => inRange(d.updatedAt) && !inRange(d.createdAt))
            .map(([id, d]) => ({ id, name: d.Name, by: d.updatedBy as Person, at: d.updatedAt as number }))
            .sort((a, b) => b.at - a.at);
        const photosAdded = Object.values(data.photoMeta).filter((m) => inRange(m.uploadedAt)).length;
        const removedPhotos = Object.entries(data.archivedPhotos)
            .map(([imgId, a]) => ({ imgId, ...a, image: fetchImgsService([imgId], data.photoMeta)[0] }))
            .sort((a, b) => b.archivedAt - a.archivedAt);
        const comments = Object.entries(data.comments)
            .flatMap(([slipwayId, byId]) => Object.entries(byId).map(([id, c]) => ({ id, slipwayId, ...c })))
            .filter((c) => inRange(c.createdAt))
            .sort((a, b) => b.createdAt - a.createdAt);
        const feedback = Object.entries(data.suggestions)
            .map(([id, s]) => ({ id, ...s }))
            .filter((s) => inRange(s.createdAt))
            .sort((a, b) => b.createdAt - a.createdAt);
        const removals = Object.entries(data.removalRequests)
            .map(([slipwayId, byUser]) => ({ slipwayId, requests: Object.values(byUser).sort((a, b) => a.createdAt - b.createdAt) }))
            .sort((a, b) => b.requests.length - a.requests.length);

        return { nameOf, added, edited, photosAdded, removedPhotos, comments, feedback, removals,
            removedThisMonth: removedPhotos.filter((p) => inRange(p.archivedAt)).length };
    }, [data, month]);

    const openSlipway = (id: string) => {
        if (!id.startsWith('osm:') && data?.details[id]) onNavigate?.('slipway-view', { slipwayId: id });
    };

    const slipwayLink = (id: string, name: string) =>
        !id.startsWith('osm:') && data?.details[id]
            ? <button className="link-button" onClick={() => openSlipway(id)}>{name}</button>
            : <span>{name}</span>;

    const run = async (key: string, action: () => Promise<void>) => {
        try {
            setBusy(key);
            await action();
            await load();
        } catch (err) {
            console.error(`${key} failed:`, err);
            alert('That did not work. Check the console for details.');
        } finally {
            setBusy(null);
        }
    };

    const dismissRemoval = (slipwayId: string) => run(`dismiss:${slipwayId}`, () =>
        remove(ref(database, `removalRequests/${slipwayId}`)));

    const restorePhoto = (imgId: string) => run(`restore:${imgId}`, async () => {
        const record = data!.archivedPhotos[imgId];
        const imgs = ((await get(ref(database, `slipwayDetails/${record.slipwayId}/imgs`))).val() || [])
            .filter((id: unknown) => id != null && id !== '').map(String);
        if (!imgs.includes(imgId)) imgs.splice(Math.min(record.position ?? imgs.length, imgs.length), 0, imgId);
        await update(ref(database), {
            [`slipwayDetails/${record.slipwayId}/imgs`]: imgs,
            [`archivedPhotos/${imgId}`]: null
        });
    });

    if (!isAdmin(user)) {
        return (
            <div className="center-state">
                <h2>Not available</h2>
                <p>This page is only for the site admin.</p>
            </div>
        );
    }

    return (
        <div className="page admin">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-lead">Activity across Boatlaunch. Only you can see this.</p>
                </div>
                <div className="btn-row">
                    <input
                        type="month"
                        className="input admin-month"
                        value={month}
                        max={currentMonth()}
                        onChange={(e) => e.target.value && setMonth(e.target.value)}
                        aria-label="Month"
                    />
                    <button className="btn btn--secondary" onClick={load} disabled={!!busy}>Refresh</button>
                </div>
            </div>

            {error && <p className="comment-error" role="alert">{error}</p>}
            {!view && !error && <div className="center-state"><span className="spinner spinner--lg" /></div>}

            {view && (
                <>
                    <div className="admin-stats">
                        {[
                            ['Slipways added', view.added.length],
                            ['Slipways edited', view.edited.length],
                            ['Photos added', view.photosAdded],
                            ['Photos removed', view.removedThisMonth],
                            ['Comments', view.comments.length],
                            ['Feedback', view.feedback.length],
                            ['Open removal requests', view.removals.length]
                        ].map(([label, value]) => (
                            <div key={label} className={`admin-stat ${label === 'Open removal requests' && value ? 'admin-stat--alert' : ''}`}>
                                <strong>{value}</strong>
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>

                    <section className="sv-section">
                        <h2 className="sv-section-title">Suggested for removal <span className="count">{view.removals.length}</span></h2>
                        <p className="admin-hint">All open requests, whatever the month. Dismiss once you've dealt with one.</p>
                        {view.removals.length === 0 ? <p className="admin-empty">None</p> : (
                            <ul className="admin-list">
                                {view.removals.map(({ slipwayId, requests }) => (
                                    <li key={slipwayId}>
                                        <div className="admin-row">
                                            <strong>{slipwayLink(slipwayId, requests[0].slipwayName || view.nameOf(slipwayId))}</strong>
                                            <span className="tag">{requests.length} request{requests.length === 1 ? '' : 's'}</span>
                                            <code className="admin-id">{slipwayId}</code>
                                            <button
                                                className="btn btn--secondary btn--sm admin-row-action"
                                                onClick={() => dismissRemoval(slipwayId)}
                                                disabled={!!busy}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                        <ul className="admin-sublist">
                                            {requests.map((r) => (
                                                <li key={r.requestedBy.uid}>
                                                    {formatShortDate(r.createdAt)} · <strong>{REMOVAL_REASONS[r.reason] || r.reason}</strong> · {who(r.requestedBy)}
                                                    {r.note && <q>{r.note}</q>}
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="sv-section">
                        <h2 className="sv-section-title">Feedback <span className="count">{view.feedback.length}</span></h2>
                        {view.feedback.length === 0 ? <p className="admin-empty">None this month</p> : (
                            <ul className="admin-list">
                                {view.feedback.map((s) => (
                                    <li key={s.id}>
                                        <div className="admin-row">
                                            <span className="tag">{s.type}</span>
                                            <span>{formatShortDate(s.createdAt)}</span>
                                            {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
                                        </div>
                                        <p className="admin-text">{s.message}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <div className="sv-columns">
                        <section className="sv-section">
                            <h2 className="sv-section-title">Slipways added <span className="count">{view.added.length}</span></h2>
                            {view.added.length === 0 ? <p className="admin-empty">None this month</p> : (
                                <ul className="admin-list">
                                    {view.added.map((s) => (
                                        <li key={s.id} className="admin-row">
                                            {slipwayLink(s.id, s.name)}
                                            {s.fromOsm && <span className="tag tag--osm">From OSM</span>}
                                            <span className="admin-muted">{formatShortDate(s.at)} · {who(s.by)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="sv-section">
                            <h2 className="sv-section-title">Slipways edited <span className="count">{view.edited.length}</span></h2>
                            <p className="admin-hint">Shows each slipway's latest editor only.</p>
                            {view.edited.length === 0 ? <p className="admin-empty">None this month</p> : (
                                <ul className="admin-list">
                                    {view.edited.map((s) => (
                                        <li key={s.id} className="admin-row">
                                            {slipwayLink(s.id, s.name)}
                                            <span className="admin-muted">{formatShortDate(s.at)} · {who(s.by)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <section className="sv-section">
                        <h2 className="sv-section-title">Removed photos <span className="count">{view.removedPhotos.length}</span></h2>
                        <p className="admin-hint">All removed photos, whatever the month. Restoring puts a photo back where it was.</p>
                        {view.removedPhotos.length === 0 ? <p className="admin-empty">None</p> : (
                            <ul className="admin-photos">
                                {view.removedPhotos.map((p) => (
                                    <li key={p.imgId}>
                                        <a href={p.image.src} target="_blank" rel="noopener noreferrer">
                                            <img src={p.image.thumbSrc || p.image.src} alt="" loading="lazy" />
                                        </a>
                                        <div>
                                            <strong>{slipwayLink(p.slipwayId, view.nameOf(p.slipwayId))}</strong>
                                            <span className="admin-muted">Removed {formatShortDate(p.archivedAt)} by {who(p.archivedBy)}</span>
                                            <button className="btn btn--secondary btn--sm" onClick={() => restorePhoto(p.imgId)} disabled={!!busy}>
                                                {busy === `restore:${p.imgId}` ? 'Restoring…' : 'Restore'}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="sv-section">
                        <h2 className="sv-section-title">Comments <span className="count">{view.comments.length}</span></h2>
                        {view.comments.length === 0 ? <p className="admin-empty">None this month</p> : (
                            <ul className="admin-list">
                                {view.comments.map((c) => (
                                    <li key={c.id}>
                                        <div className="admin-row">
                                            <strong>{slipwayLink(c.slipwayId, view.nameOf(c.slipwayId))}</strong>
                                            <span className="admin-muted">{formatShortDate(c.createdAt)} · {c.userName}</span>
                                        </div>
                                        <p className="admin-text">{c.text}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default AdminDashboard;
