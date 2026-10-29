// Converts the "OSM not in BL" spreadsheet into data for the admin-only osmSlipways node.
//
//   node scripts/import-osm-slipways.mjs "/path/to/to upload to BL.xlsx"
//
// Writes scripts/out/osm-slipways.json; load it (replacing any previous import) with:
//   firebase database:set /osmSlipways scripts/out/osm-slipways.json --project firebase-boatlaunch --instance boatlaunch
//
// OSM data is © OpenStreetMap contributors, licensed under ODbL. Credit it if any of it is ever shown publicly.
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const inputFile = process.argv[2];
if (!inputFile) {
    console.error('Usage: node scripts/import-osm-slipways.mjs <spreadsheet.xlsx>');
    process.exit(1);
}
const outFile = path.join(path.dirname(new URL(import.meta.url).pathname), 'out', 'osm-slipways.json');

// Firebase keys can't contain . $ # [ ] /
const toKey = (value) => String(value).replace(/[.$#[\]/]/g, '_');

const cellValue = (cell) => {
    const v = cell.value;
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'object') return v.text ?? v.result ?? v.hyperlink ?? undefined;
    return v;
};

const clean = (value) => {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return text === '' ? undefined : text;
};

const main = async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(inputFile);
    const sheet = workbook.worksheets[0];

    const header = sheet.getRow(1).values.slice(1).map(String);
    const col = (name) => {
        const index = header.indexOf(name);
        if (index < 0) throw new Error(`Spreadsheet is missing the "${name}" column`);
        return index + 1;
    };
    const tagColumns = header
        .map((name, i) => [name, i + 1])
        .filter(([name]) => name.startsWith('tag:'));

    const slipways = {};
    const skipped = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const get = (name) => clean(cellValue(row.getCell(col(name))));

        const osmId = get('osm_id');
        const latitude = Number(get('lat'));
        const longitude = Number(get('lon'));
        if (!osmId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            skipped.push(rowNumber);
            return;
        }

        const tags = {};
        for (const [name, index] of tagColumns) {
            const value = clean(cellValue(row.getCell(index)));
            if (value !== undefined) tags[toKey(name.slice('tag:'.length))] = value;
        }

        const nearestBlM = Number(get('nearest_bl_m'));
        slipways[toKey(osmId)] = {
            source: 'OSM',
            osmId,
            osmLink: get('osm_link') || `https://www.openstreetmap.org/${osmId}`,
            latitude,
            longitude,
            ...(get('name') ? { name: get('name') } : {}),
            ...(get('nearest_bl_id') ? { nearestBlId: get('nearest_bl_id') } : {}),
            ...(get('nearest_bl_name') ? { nearestBlName: get('nearest_bl_name').replace(/\s+/g, ' ') } : {}),
            ...(Number.isFinite(nearestBlM) ? { nearestBlM } : {}),
            ...(get('last_edit') ? { lastEdit: get('last_edit') } : {}),
            ...(get('last_editor') ? { lastEditor: get('last_editor') } : {}),
            ...(get('disused_or_abandoned') === 'yes' ? { disused: true } : {}),
            tags
        };
    });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(slipways));

    const all = Object.values(slipways);
    console.log(`Converted ${all.length} OSM slipways (${all.filter((s) => s.name).length} named, ${all.filter((s) => s.disused).length} disused)`);
    if (skipped.length) console.log(`Skipped rows without an ID or coordinates: ${skipped.join(', ')}`);
    console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
    console.log(`Load it with:\n  firebase database:set /osmSlipways ${path.relative(process.cwd(), outFile)} --project firebase-boatlaunch --instance boatlaunch`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
