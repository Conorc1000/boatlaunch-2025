// Lists photos users have removed, or puts one back on its slipway.
//
//   node scripts/restore-photo.mjs            # list archived photos
//   node scripts/restore-photo.mjs <imgId>    # restore one
//
// Removing a photo never deletes the S3 file or photoMeta, so restoring just re-adds the ID to the
// slipway's imgs (at its old position) and clears the archivedPhotos record. Uses your Firebase CLI login.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FIREBASE = ['--project', 'firebase-boatlaunch', '--instance', 'boatlaunch'];
const firebase = (...args) => execFileSync('firebase', [...args, ...FIREBASE], { encoding: 'utf8' });
const getJson = (dbPath) => JSON.parse(firebase('database:get', dbPath) || 'null');

const imgId = process.argv[2];

if (!imgId) {
    const archived = getJson('/archivedPhotos') || {};
    const entries = Object.entries(archived).sort(([, a], [, b]) => b.archivedAt - a.archivedAt);
    if (!entries.length) console.log('No archived photos.');
    for (const [id, a] of entries) {
        console.log(`${id}  slipway ${a.slipwayId}  removed by ${a.archivedBy?.name}${a.archivedBy?.email ? ` <${a.archivedBy.email}>` : ''} (uid ${a.archivedBy?.uid}) on ${new Date(a.archivedAt).toISOString().slice(0, 10)}`);
        console.log(`    https://boatlaunchphotos.s3.eu-west-1.amazonaws.com/WebSitePhotos/${id}___Source.jpg`);
    }
    process.exit(0);
}

const record = getJson(`/archivedPhotos/${imgId}`);
if (!record) {
    console.error(`No archived photo ${imgId}`);
    process.exit(1);
}

const imgs = (getJson(`/slipwayDetails/${record.slipwayId}/imgs`) || []).filter((id) => id != null && id !== '').map(String);
if (!imgs.includes(imgId)) imgs.splice(Math.min(record.position ?? imgs.length, imgs.length), 0, imgId);

const patch = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'restore-photo-')), 'patch.json');
fs.writeFileSync(patch, JSON.stringify({
    [`slipwayDetails/${record.slipwayId}/imgs`]: imgs,
    [`archivedPhotos/${imgId}`]: null
}));
firebase('database:update', '/', patch, '--force');
console.log(`Restored ${imgId} to slipway ${record.slipwayId}`);
