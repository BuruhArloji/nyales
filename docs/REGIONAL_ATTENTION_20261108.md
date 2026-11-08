# Regional attention and dropdown refinement — 8 November 2026

## Overview and Monitoring

The “Wilayah perlu perhatian” card selects up to three mapped kelurahan with
authorized active customers. Priority is deterministic:

1. More financial warnings: achievement below 100% on a valid explicit regional
   target, and/or negative comparable invoice growth.
2. Greater percentage shortfall/decline.
3. Lower meaningful customer coverage, then stable boundary ID.

Each row shows observed invoice net, target achievement, comparable sales change,
and meaningful coverage. A financial warning opens the sales map; a coverage-only
warning opens the visit map, retaining period, channel, organizational scope and
boundary. This is a monthly achievement indicator, not a target pacing forecast.

Only available, validated achievement/growth metrics can create financial warnings.
Unknown inputs remain unavailable, never zero. Sales/area targets are not prorated
to kelurahan. Existing explicit-customer allocation and source completeness rules
still apply. Historical invoices retain their original financial attribution.

HTTP errors now remain errors with retry. Only a successful optional response
with no active release displays “Batas wilayah belum aktif”.

## Bounded reads and evidence

The previous 2,000-customer total ceiling is replaced with 1,000-row keyset pages
using the existing `(organization_id,id)` index. Location state reuses the bounded
latest-mapping projection instead of transferring complete review evidence.
Ownership flags are aggregated once in SQL; source status also uses a scoped SQL
cohort rather than repeatedly scanning assignments for each ID page. Scope,
effective dates, merge canonicalization and revision guards remain unchanged.

The summary uses the existing Cache API read-model helper for 60 seconds. Cache
identity includes resolved access scope, actor (snapshot fingerprints are personal),
filters and transactional read-model revision. Identity validation is not cached.
Source and export routes still recompute and validate their snapshot.

Read-only checks against the local post-cutover staging snapshot returned HTTP 200:
57,331 customers, 1,639 region/bucket rows, 562 covered customers, 590 activities,
562 invoices and IDR 545,715,600 observed invoice net. The final local read took
approximately 3.24 seconds and 131 statements. This is not a production latency SLA.

A bounded remote comparison of the same 1,000 customer IDs read 1,000 rows in both
versions. Selecting seven required columns reduced returned JSON from 859,082 to
217,822 bytes (about 75%); measured SQL times were 35.90 and 4.85 ms respectively.
This measures projection and one indexed page, not a whole-report read reduction.
No business rows were changed by these checks.

Fixture reconciliation covers the former ceiling with 2,507 customers, retaining
invoice totals, previous-period values, activity totals and target results. Existing
tenant/role, merged-customer, timezone, source completeness, snapshot and explicit
target allocation tests also remain required.

## Shared dropdown material

Native customizable selects and the customer combobox now use a frosted white
popup, neutral gray hover/selection and SVG icons, with 44 px options and keyboard
behavior preserved. Reduced transparency, contrast, forced-color and reduced-motion
fallbacks are included. Browsers without customizable-select support retain their
native operating-system picker.

Local prototype evidence includes desktop/mobile screenshots, native keyboard
selection, customer combobox selection, regional financial drill-through, missing
dataset versus failed request handling, and retry recovery. No staging seeding is
part of this release.
