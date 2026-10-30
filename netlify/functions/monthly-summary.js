// Emails the admin a summary of last month's activity: slipways added and edited, photos added and removed,
// comments, feedback and removal requests. Scheduled in netlify.toml for the 1st of each month.
//
// Netlify environment variables:
//   FIREBASE_SERVICE_ACCOUNT  base64 of a service-account key JSON (Firebase console > Project settings > Service accounts)
//   RESEND_API_KEY            from resend.com
//   SUMMARY_EMAIL_TO          optional, defaults to conorc1000@gmail.com
//   SUMMARY_EMAIL_FROM        optional, defaults to Resend's test sender (only delivers to your Resend account's email)
//
// Preview locally without sending (prints the email text):
//   node netlify/functions/monthly-summary.js [YYYY-MM] <path to service-account key JSON>
const admin = require('firebase-admin');

const DATABASE_URL = 'https://boatlaunch.firebaseio.com';
const TO = process.env.SUMMARY_EMAIL_TO || 'conorc1000@gmail.com';
const FROM = process.env.SUMMARY_EMAIL_FROM || 'Boatlaunch <onboarding@resend.dev>';

const REMOVAL_REASONS = {
    closed: 'Closed or no longer usable',
    private: 'Private, no public access',
    not_here: "There's no slipway here",
    duplicate: 'Duplicate',
    unsafe: 'Unsafe',
    other: 'Something else'
};

const database = () => {
    if (!admin.apps.length) {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set (base64 of the service-account key JSON)');
        const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: DATABASE_URL });
    }
    return admin.database();
};

const read = async (path) => (await database().ref(path).once('value')).val() || {};

// The calendar month before `now` (UTC), or a given "YYYY-MM"
const monthRange = (monthArg, now = new Date()) => {
    const [year, month] = monthArg
        ? monthArg.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n))
        : [now.getUTCFullYear(), now.getUTCMonth() - 1];
    const start = Date.UTC(year, month, 1);
    const end = Date.UTC(year, month + 1, 1);
    const label = new Date(start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { start, end, label };
};

const day = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const who = (person) => (person ? `${person.name}${person.email ? ` <${person.email}>` : ''}` : 'unknown');
// Some stored names contain line breaks
const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const clip = (text, max = 300) => (text.length > max ? `${text.slice(0, max)}…` : text);

const buildSummary = async (range) => {
    const [details, photoMeta, archivedPhotos, comments, suggestions, removalRequests] = await Promise.all([
        read('slipwayDetails'), read('photoMeta'), read('archivedPhotos'), read('comments'), read('suggestions'), read('removalRequests')
    ]);
    const inRange = (ts) => typeof ts === 'number' && ts >= range.start && ts < range.end;
    const nameOf = (id) => oneLine(details[id]?.Name) || id;

    const added = Object.entries(details)
        .filter(([, d]) => inRange(d.createdAt))
        .map(([id, d]) => ({ id, name: oneLine(d.Name), by: d.createdBy, at: d.createdAt, fromOsm: d.importedFrom === 'OSM' }))
        .sort((a, b) => a.at - b.at);

    // Only each slipway's most recent edit is stored, so this lists slipways edited this month (last editor shown),
    // not every individual edit
    const edited = Object.entries(details)
        .filter(([, d]) => inRange(d.updatedAt) && !inRange(d.createdAt))
        .map(([id, d]) => ({ id, name: oneLine(d.Name), by: d.updatedBy, at: d.updatedAt }))
        .sort((a, b) => a.at - b.at);

    const photos = Object.values(photoMeta).filter((m) => inRange(m.uploadedAt));
    const removedPhotos = Object.entries(archivedPhotos)
        .filter(([, a]) => inRange(a.archivedAt))
        .map(([imgId, a]) => ({ imgId, ...a }))
        .sort((a, b) => a.archivedAt - b.archivedAt);

    const newComments = Object.entries(comments)
        .flatMap(([slipwayId, byId]) => Object.values(byId).map((c) => ({ slipwayId, ...c })))
        .filter((c) => inRange(c.createdAt))
        .sort((a, b) => a.createdAt - b.createdAt);

    const feedback = Object.values(suggestions).filter((s) => inRange(s.createdAt)).sort((a, b) => a.createdAt - b.createdAt);

    // All open removal requests, not just this month's: they stay until dealt with
    const removals = Object.entries(removalRequests)
        .map(([slipwayId, byUser]) => ({ slipwayId, requests: Object.values(byUser).sort((a, b) => a.createdAt - b.createdAt) }))
        .sort((a, b) => b.requests.length - a.requests.length);
    const newRemovalCount = removals.reduce((n, s) => n + s.requests.filter((r) => inRange(r.createdAt)).length, 0);

    const sections = [];
    const section = (title, lines, empty = 'None') => sections.push({ title, lines: lines.length ? lines : [empty] });

    section(`Slipways added (${added.length})`, added.map((s) =>
        `${day(s.at)}  ${s.name}  (${s.id})${s.fromOsm ? ' [from OSM]' : ''}  by ${who(s.by)}`));
    section(`Slipways edited (${edited.length})`, edited.map((s) =>
        `${day(s.at)}  ${s.name}  (${s.id})  last by ${who(s.by)}`));
    section(`Photos (${photos.length} added, ${removedPhotos.length} removed)`, removedPhotos.map((p) =>
        `Removed ${day(p.archivedAt)}  ${nameOf(p.slipwayId)}  (${p.imgId})  by ${who(p.archivedBy)}`),
        photos.length ? 'No photos removed' : 'None');
    section(`Comments (${newComments.length})`, newComments.map((c) =>
        `${day(c.createdAt)}  ${nameOf(c.slipwayId)}  ${c.userName}: "${clip(c.text, 200)}"`));
    section(`Feedback (${feedback.length})`, feedback.map((s) =>
        `${day(s.createdAt)}  [${s.type}]${s.email ? ` ${s.email}` : ''}: "${clip(s.message)}"`));
    section(`Slipways suggested for removal (${removals.length} open, ${newRemovalCount} new this month)`,
        removals.flatMap(({ slipwayId, requests }) => [
            `${requests[0].slipwayName || nameOf(slipwayId)}  (${slipwayId})  ${requests.length} request${requests.length === 1 ? '' : 's'}`,
            ...requests.map((r) =>
                `    ${day(r.createdAt)}  ${REMOVAL_REASONS[r.reason] || r.reason}  by ${who(r.requestedBy)}${r.note ? `: "${clip(r.note, 200)}"` : ''}`)
        ]));

    const subject = `Boatlaunch ${range.label}: ${added.length} added, ${edited.length} edited, ${feedback.length} feedback, ${removals.length} to review for removal`;
    const text = sections.map((s) => `${s.title}\n${s.lines.map((l) => `  ${l}`).join('\n')}`).join('\n\n');
    return { subject, text };
};

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const sendEmail = async ({ subject, text }) => {
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: FROM,
            to: [TO],
            subject,
            text,
            html: `<pre style="font: 13px/1.5 ui-monospace, Menlo, monospace; white-space: pre-wrap">${escapeHtml(text)}</pre>`
        })
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
};

exports.handler = async () => {
    try {
        const summary = await buildSummary(monthRange());
        await sendEmail(summary);
        console.log(`Sent: ${summary.subject}`);
        return { statusCode: 200, body: 'Sent' };
    } catch (error) {
        console.error('Monthly summary failed:', error);
        return { statusCode: 500, body: 'Failed' };
    }
};

if (require.main === module) {
    const keyFile = process.argv.slice(2).find((arg) => arg.endsWith('.json'));
    if (keyFile) process.env.FIREBASE_SERVICE_ACCOUNT = require('fs').readFileSync(keyFile).toString('base64');
    buildSummary(monthRange(process.argv.slice(2).find((arg) => /^\d{4}-\d{2}$/.test(arg))))
        .then(({ subject, text }) => {
            console.log(`Subject: ${subject}\n\n${text}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
