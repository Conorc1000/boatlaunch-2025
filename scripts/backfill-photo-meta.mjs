// Backfills photoMeta/{imageId} for photos uploaded before capture dates and thumbnails were recorded.
//
//   node scripts/backfill-photo-meta.mjs            # capture dates only (reads the first 128KB of each photo)
//   node scripts/backfill-photo-meta.mjs --thumbs   # also generate ___Thumb.jpg in S3 (needs AWS creds in .env)
//   node scripts/backfill-photo-meta.mjs --limit 20 # try it on a few photos first
//
// Writes a Firebase multi-path patch to scripts/out/photo-meta-patch.json; apply it with:
//   firebase database:update / scripts/out/photo-meta-patch.json --project firebase-boatlaunch --instance boatlaunch
// Safe to re-run: photos that already have a date or thumbnail are skipped for that step.
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import exifr from 'exifr';

const DATABASE_URL = 'https://boatlaunch.firebaseio.com';
const BUCKET = 'boatlaunchphotos';
const REGION = 'eu-west-1';
const PHOTO_PREFIX = `https://${BUCKET}.s3.${REGION}.amazonaws.com/WebSitePhotos/`;
const EXIF_RANGE_BYTES = 128 * 1024; // JPEG EXIF lives in the first APP1 segment (max 64KB)
const THUMB_MAX_SIZE = 640; // Keep in sync with src/services/photoProcessing.ts
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const withThumbs = args.includes('--thumbs');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : Infinity;
const outFile = path.join(path.dirname(new URL(import.meta.url).pathname), 'out', 'photo-meta-patch.json');

const fetchJson = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
    return response.json();
};

// Firebase turns objects with mostly-numeric keys into sparse arrays; normalise back to an object
const toObject = (value) => Array.isArray(value)
    ? Object.fromEntries(value.map((v, i) => [String(i), v]).filter(([, v]) => v != null))
    : value || {};

const isPlausibleDate = (date) => date instanceof Date
    && !isNaN(date.getTime())
    && date.getFullYear() >= 1990
    && date.getTime() <= Date.now() + 24 * 60 * 60 * 1000;

const readTakenAt = async (buffer) => {
    try {
        const exif = await exifr.parse(buffer, ['DateTimeOriginal', 'CreateDate']);
        const date = exif?.DateTimeOriginal || exif?.CreateDate;
        return isPlausibleDate(date) ? date.getTime() : undefined;
    } catch {
        return undefined; // No or unreadable EXIF
    }
};

// sharp's prebuilt binaries can't decode HEIC (iPhone photos), but macOS's sips can
const convertHeicToJpeg = async (buffer) => {
    if (process.platform !== 'darwin') throw new Error('HEIC photo: re-run on macOS to convert it with sips');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heic-'));
    try {
        fs.writeFileSync(path.join(dir, 'in.heic'), buffer);
        await promisify(execFile)('sips', ['-s', 'format', 'jpeg', path.join(dir, 'in.heic'), '--out', path.join(dir, 'out.jpg')]);
        return fs.readFileSync(path.join(dir, 'out.jpg'));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

const fetchPhoto = async (imgId, { partial }) => {
    const response = await fetch(`${PHOTO_PREFIX}${imgId}___Source.jpg`, partial
        ? { headers: { Range: `bytes=0-${EXIF_RANGE_BYTES - 1}` } }
        : {});
    // A public bucket without list permission returns 403 for missing objects; 416 means a 0-byte file
    if ([403, 404, 416].includes(response.status)) return null;
    if (!response.ok) throw new Error(`status ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
};

const main = async () => {
    let sharp, uploadThumbnail;
    if (withThumbs) {
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID_1;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_1;
        if (!accessKeyId || !secretAccessKey) {
            throw new Error('--thumbs needs AWS_ACCESS_KEY_ID_1 and AWS_SECRET_ACCESS_KEY_1 in .env');
        }
        sharp = (await import('sharp')).default;
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const s3 = new S3Client({ region: REGION, credentials: { accessKeyId, secretAccessKey } });
        // Upload via a presigned URL and fetch, like the browser does: the SDK's own PUT hangs
        // until S3 times out (RequestTimeout) on Node 24
        uploadThumbnail = async (imgId, body) => {
            const url = await getSignedUrl(s3, new PutObjectCommand({
                Bucket: BUCKET,
                Key: `WebSitePhotos/${imgId}___Thumb.jpg`,
                ContentType: 'image/jpeg',
                ACL: 'public-read' // Signed into the URL's query string, so not sent as a header
            }), { expiresIn: 300 });
            const response = await fetch(url, {
                method: 'PUT',
                body,
                headers: { 'Content-Type': 'image/jpeg' },
                signal: AbortSignal.timeout(60000)
            });
            if (!response.ok) throw new Error(`thumbnail upload failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
        };
    }

    console.log('Loading slipway data...');
    const [details, photoMeta] = await Promise.all([
        fetchJson(`${DATABASE_URL}/slipwayDetails.json`),
        fetchJson(`${DATABASE_URL}/photoMeta.json`).then(toObject)
    ]);

    const imgIds = [...new Set(Object.values(toObject(details))
        .flatMap((slipway) => (Array.isArray(slipway?.imgs) ? slipway.imgs : []))
        .filter((id) => id != null)
        .map(String))];

    const todo = imgIds
        .filter((id) => !photoMeta[id]?.takenAt || (withThumbs && !photoMeta[id]?.thumb))
        .slice(0, limit);
    console.log(`${imgIds.length} photos referenced, ${todo.length} to process${withThumbs ? ' (with thumbnails)' : ''}`);

    const patch = {};
    const stats = { dated: 0, noDate: 0, thumbs: 0, missing: 0, failed: 0 };
    let done = 0;

    const processPhoto = async (imgId) => {
        const existing = photoMeta[imgId] || {};
        const needsThumb = withThumbs && !existing.thumb;
        try {
            const buffer = await fetchPhoto(imgId, { partial: !needsThumb });
            if (!buffer) {
                stats.missing++;
                return;
            }

            if (!existing.takenAt) {
                const takenAt = await readTakenAt(buffer);
                if (takenAt) {
                    patch[`photoMeta/${imgId}/takenAt`] = takenAt;
                    stats.dated++;
                } else {
                    stats.noDate++;
                }
            }

            if (needsThumb) {
                const makeThumbnail = (input) => sharp(input)
                    .rotate() // Apply EXIF orientation
                    .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                const thumbnail = await makeThumbnail(buffer).catch(async (error) => {
                    if (!/heif/i.test(error.message)) throw error;
                    return makeThumbnail(await convertHeicToJpeg(buffer));
                });
                await uploadThumbnail(imgId, thumbnail);
                patch[`photoMeta/${imgId}/thumb`] = true;
                stats.thumbs++;
            }
        } catch (error) {
            stats.failed++;
            console.warn(`  ${imgId}: ${error.message}`);
        } finally {
            done++;
            if (done % 50 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
        }
    };

    const queue = [...todo];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length > 0) await processPhoto(queue.shift());
    }));

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(patch, null, 1));

    console.log(`\nCapture dates found: ${stats.dated}, no date in file: ${stats.noDate}`);
    if (withThumbs) console.log(`Thumbnails uploaded: ${stats.thumbs}`);
    console.log(`Missing from S3: ${stats.missing}, failed: ${stats.failed}`);
    console.log(`\nWrote ${Object.keys(patch).length} updates to ${path.relative(process.cwd(), outFile)}`);
    if (Object.keys(patch).length > 0) {
        console.log(`Apply with:\n  firebase database:update / ${path.relative(process.cwd(), outFile)} --project firebase-boatlaunch --instance boatlaunch`);
    }
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
