// Lists slipways users have suggested removing, most-requested first.
//
//   node scripts/removal-requests.mjs                 # list
//   node scripts/removal-requests.mjs --clear <id>    # dismiss all requests for a slipway (after acting on them)
//
// Uses your Firebase CLI login.
import { execFileSync } from 'node:child_process';

const FIREBASE = ['--project', 'firebase-boatlaunch', '--instance', 'boatlaunch'];
const firebase = (...args) => execFileSync('firebase', [...args, ...FIREBASE], { encoding: 'utf8' });

if (process.argv[2] === '--clear') {
    const slipwayId = process.argv[3];
    if (!slipwayId) {
        console.error('Usage: node scripts/removal-requests.mjs --clear <slipwayId>');
        process.exit(1);
    }
    firebase('database:remove', `/removalRequests/${slipwayId}`, '--force');
    console.log(`Cleared removal requests for ${slipwayId}`);
    process.exit(0);
}

const all = JSON.parse(firebase('database:get', '/removalRequests') || 'null') || {};
const slipways = Object.entries(all)
    .map(([slipwayId, byUser]) => ({ slipwayId, requests: Object.values(byUser).sort((a, b) => a.createdAt - b.createdAt) }))
    .sort((a, b) => b.requests.length - a.requests.length);

if (!slipways.length) console.log('No removal requests.');
for (const { slipwayId, requests } of slipways) {
    console.log(`\n${requests[0].slipwayName}  (${slipwayId})  ${requests.length} request${requests.length === 1 ? '' : 's'}`);
    for (const r of requests) {
        const who = `${r.requestedBy?.name}${r.requestedBy?.email ? ` <${r.requestedBy.email}>` : ''}`;
        console.log(`  ${new Date(r.createdAt).toISOString().slice(0, 10)}  ${r.reason}  by ${who}${r.note ? `\n      "${r.note}"` : ''}`);
    }
}
