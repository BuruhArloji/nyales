#!/usr/bin/env node
// D1 quota report for the NYALES staging database.
//
// Read-only: calls the Cloudflare GraphQL analytics API, never the database.
// The token comes from the environment so this file can live in the repository
// without carrying a secret.
//
//   CLOUDFLARE_API_TOKEN=... node scripts/quota-report.mjs
//   CLOUDFLARE_API_TOKEN=... node scripts/quota-report.mjs 2026-11-01
//
// Exits 1 when the free-tier daily read budget is exhausted.

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '54386b392928d9dcd226ad9e7fff5d79';
const DATABASE_ID = process.env.CF_D1_DATABASE_ID || '6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const DAILY_READ_LIMIT = 5_000_000;
const DAILY_WRITE_LIMIT = 100_000;
const WARN_RATIO = 0.6;

const date = process.argv[2] || new Date().toISOString().slice(0, 10);

if (!TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN (or CF_API_TOKEN) is required.');
  console.error('Create a scoped token with Account > Account Analytics: Read.');
  process.exit(2);
}

const query = `
query($tag: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: {accountTag: $tag}) {
      d1AnalyticsAdaptiveGroups(limit: 200, filter: {date_geq: $start, date_leq: $end}, orderBy: [date_ASC]) {
        dimensions { date datetimeHour databaseId }
        sum { rowsRead rowsWritten }
      }
    }
  }
}`;

const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query, variables: { tag: ACCOUNT_ID, start: date, end: date } }),
});

const payload = await response.json().catch(() => ({}));
if (!response.ok || payload.errors) {
  const detail = payload.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
  console.error(`Cloudflare API error: ${detail}`);
  process.exit(2);
}

const rows = (payload.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [])
  .filter((row) => row.dimensions.databaseId === DATABASE_ID)
  .sort((a, b) => String(a.dimensions.datetimeHour || '').localeCompare(String(b.dimensions.datetimeHour || '')));

let reads = 0;
let writes = 0;

console.log('');
console.log(`NYALES staging D1 / ${date} (UTC)`);
console.log('Hour (UTC)   Reads        Writes');
console.log('----------------------------------');
for (const row of rows) {
  const hour = row.dimensions.datetimeHour ? `${new Date(row.dimensions.datetimeHour).getUTCHours().toString().padStart(2, '0')}:00` : '(day)';
  reads += Number(row.sum.rowsRead) || 0;
  writes += Number(row.sum.rowsWritten) || 0;
  console.log(`${hour.padEnd(11)} ${String(row.sum.rowsRead).padStart(10)} ${String(row.sum.rowsWritten).padStart(12)}`);
}
console.log('----------------------------------');
console.log(`${'TOTAL'.padEnd(11)} ${String(reads).padStart(10)} ${String(writes).padStart(12)}`);
console.log('');
console.log(`Free tier daily limit : ${DAILY_READ_LIMIT.toLocaleString('en-US')} reads / ${DAILY_WRITE_LIMIT.toLocaleString('en-US')} writes`);
console.log(`Reads used            : ${reads.toLocaleString('en-US')} (${((reads / DAILY_READ_LIMIT) * 100).toFixed(1)}%)`);
console.log('');

if (reads >= DAILY_READ_LIMIT) {
  console.log('STATUS: BLOCKED - D1 rejects queries until 00:00 UTC');
  process.exit(1);
}
if (reads >= DAILY_READ_LIMIT * WARN_RATIO) {
  console.log('STATUS: WARNING - above 60% of the read budget');
  process.exit(0);
}
console.log('STATUS: OK');