# Outlet-role candidates — staging only

- [ ] Reconcile the complete current population: 46,970 customer points, including 45,950 imported directory rows, 1,000 synthetic DEMO rows, and 20 training rows; do not limit the operation to the original import.
- [ ] Persist only unverified role suggestions in a separate sidecar with explicit confidence/status and provenance for sales confirmation. Do not invent calibrated confidence probabilities or promote candidates to facts.
- [ ] Preserve every source customer row, `outlet_type`, coordinates, transaction history, purchase class, assignment, target, and business record; reconcile before/after content hashes.
- [ ] Use only the established GitHub `NYALES staging deploy` route and exact staging D1 target. Production is untouched. All data population flags default off, and unrelated seed/repopulation actions remain off for this operation.
- [ ] Validate locally, apply the explicitly selected candidate action in staging, and reconcile candidate cardinality, status, source preservation, and safe replay.
