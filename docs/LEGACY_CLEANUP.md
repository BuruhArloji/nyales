# Consolidation of previous NYALES implementations

Release scope: 10 November 2026. Historical data and published API contracts are preserved.

## Operational UI

- Daily Visit Generator is the primary route-planning flow. Operational profiles remain available because daily planning consumes them.
- Settings has an explicit **Eksperimental** toggle, off on each page mount. Local OSRM/computer pairing, old planner policy/graph/preflight screens, old ORS previews, and disconnected customer-risk configuration are confined to this section. The toggle is navigation only, not an authorization boundary; existing server permissions still apply.
- Experimental planning tabs load their own data. Opening daily settings or operational profiles does not request policies, graphs, preflights, or users from the parent planner. Readiness requires all four; old ORS preview requires preflights.
- `CustomerRisk.tsx` and `TerritoryDistribution.tsx` were removed after confirming neither was imported. The current territory UI remains `VillageTerritories`; the single-owner rules remain in the server.
- MFA screens are loaded only when Firebase/account policy requires them. Google portfolio login, local prototype authentication, and server authentication guards are preserved.

## Customer status and history

The Status & tier response uses the same recent-invoice rule as customer detail, overview, and map: a validated current invoice within 90 days proves activity. It does not certify that all historical transactions are present.

- Existing segmentation snapshots remain unchanged. Read responses include `snapshot_status` and `source_history_complete`; `status` is the current evidence-based presentation at the requested cutoff.
- Imported customers with incomplete history can be active when invoice evidence exists. Customers without this evidence remain unknown; incomplete history never establishes churn or acquisition date.
- Tier thresholds and source-coverage requirements are unchanged. Invoice totals, attribution, amounts, and assignments are unchanged.
- The status response includes `customer_name`, eliminating a separate full customer-master read just for names. Recent imported-customer invoices are aggregated once, never queried per customer.

## Compatibility retained deliberately

`/api/map`, `/api/sales/last-positions`, old risk/distribution/planning endpoints, original snapshots, backup references, and R2 map assets remain available for their existing tests/tools and possible external consumers. Removing a screen does not authorize dropping its data or API. Request telemetry now selects the registered non-wildcard endpoint template rather than the surrounding /api/* middleware, preserving privacy and allowing legacy endpoint usage to be distinguished; review it before a separate decommission release. No arbitrary sunset date is declared.

No schema migration, master-data deletion, staging seed, or automatic reassignment belongs to this cleanup.

## Scheduler status

Staging deployment still generates `triggers.crons: []`. Handler code in `src/server/index.ts` is available but does not itself schedule execution. The default Wrangler file is not the deployment source of truth.

Before enabling scheduled maintenance: verify the intended job list, scope/retention policy, read/write budget, alert owner and retry behavior; then publish an explicit schedule through GitHub Actions. This release does not start background writes or retention deletions.

## Maintenance checks

Run `npm run check`, `npm run check:unused`, `npm test`, and `npm run build`. The source-only unused-declaration check is also part of CI, to prevent abandoned imports, variables, and parameters from accumulating again. Browser checks use the approved local UI prototype with synthetic data.

## Retired UI checks

The browser suites targeting the removed customer-risk and old territory-distribution screens were removed with those screens. `test:risk` and `test:distribution` now run their preserved server/domain suites, including current village ownership checks. This is not removal of risk/distribution domain coverage. The obsolete planner browser harness was replaced by `test:ui:planning`, which uses the approved local prototype and verifies default/experimental navigation and per-tab reads; `test:visit-planning` retains the domain/API suite.

A D1 read-only probe caught a materialized-CTE join candidate reading 36,686,836 rows; that candidate was rejected before deployment. The final recent-invoice aggregation probe reads 7,776 rows (639 grouped customers, 10.14 ms in that one measurement), followed by an in-memory lookup on the already-authorized customer cohort. These figures describe the query probe, not total request cost or a multi-user load benchmark. Original directory reads still exist; the redundant client customer-master request is removed.
