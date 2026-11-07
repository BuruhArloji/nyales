# NYALES UI review — 7 November 2026

## Scope and evidence

Apple HIG principles translated to a React web application using apple-hig-review. This is an incremental review, not native iOS certification. Local synthetic prototype only: 19 top-level routes at 1440×1000 and 390×844 (38 captures). No viewport overflow, uncaught JavaScript error, or initially expanded desktop FilterPanel was found in that crawl. Captures are local operational artifacts under `.nyales-agent/staging/hig-ui-20261107` and are not committed customer data.

The crawl covers initial views, not every dialog, map data state, permission, touch gesture, screen reader, contrast combination, or 200% text enlargement. Those remain separate acceptance checks. A small-control warning on the prototype studio toggle is local tooling, not a staging feature. Small hierarchy controls measured inside a zoomed canvas need a dedicated zoom/touch review; unrelated hierarchy edits are excluded from this release.

## Findings addressed

| Finding | Change | HIG reference |
|---|---|---|
| Filters compete with primary content | All shared FilterPanel instances start collapsed; active count remains visible; reopening preserves values | layout.md › Visual hierarchy; accessibility.md › Vision |
| Wide tables are mouse-dependent | Only overflowing table wrappers receive a keyboard focus stop, named region, and visible focus; existing ARIA attributes are preserved | accessibility.md › introductory principles; lists-and-tables.md › Best practices |
| Repeated navigation delays keyboard access to content | Existing keyboard skip navigation now focuses main without changing the page hash | accessibility.md › introductory principles |
| Field and telesales recap share an ambiguous field-only view | Clearly selected Sales / Telesales segmented control and channel-specific table; mobile buttons at least 44px high | segmented-controls.md › Best practices; buttons.md › Best practices |
| Daily visit entry lacks the requested visual cue | Supplied transparent image added next to heading, decorative alt empty, responsive dimensions | icons.md › Best practices |
| Directory labels expose source notes and unclear relationship state | Source-placement suffix removed in presentation; Leads / Diverifikasi manual shown separately from coordinate verification | layout.md › Visual hierarchy; typography.md › Ensuring legibility |

References are the skill's local `references/hig` snapshot, read for this review. Accessibility states: “Your interface uses familiar and consistent interactions”. Layout describes “A consistent layout that adapts across display sizes”. These principles support the changes above; the exact web implementation and skip navigation are reviewer judgment.

## Preserved behavior and data

Stored customer segmentation and GPS evidence are unchanged. A validated current invoice dated no later than the scope date qualifies for the requested relationship label, including zero-net history. This presentation label does not create a coordinate-verification record. Legacy status deep links remain representable.

Telesales recap reads scoped existing agenda and completed call activities. Call target means scheduled calls, not a newly invented operational quota. Berhasil means manually recorded connected_pic, not provider verification or sales conversion. No GET writes agenda, attendance, invoices, or assignments. Sales recap calculations stay unchanged. Pagination precedes per-rep aggregation.

Existing reduced-motion, reduced-transparency, keyboard tab navigation, and global focus styles were retained; they are not claimed as new work. Glass material was not broadened onto content surfaces. Business calculations are covered by fixture tests rather than changed as part of visual review.

## Read-cost boundary

Default customer pages reuse existing per-page invoice facts for the relationship label; no new history join is added without the relationship filter. The selected Leads / Diverifikasi manual filter adds a scoped historical-invoice existence join. Telesales adds two bounded aggregate reads for visible reps. These changes are functional, not a claim of measured read savings. Production D1 rows_read comparison remains to be recorded separately from the local SQLite tests; local fixture metadata is not a production cost measurement.

## Verification

- TypeScript check passed.
- Local domain suite: 517 passed, 0 failed, 8 skipped. This includes existing unrelated pending hierarchy tests; clean CI is the release authority for committed files.
- Release build passed after the final CSS/focus adjustment. Existing bundle-size warnings remain.
- Targeted prototype interactions passed: Sales ↔ Telesales switches the table, requested daily icon loads, hiding/reopening the customer filter preserves the selected Leads value.
- Screenshots exposed and resolved CSS precedence affecting icon alignment and selected-tab text contrast.
