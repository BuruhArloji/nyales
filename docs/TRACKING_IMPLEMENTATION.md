# Tracking sales — implementation checkpoint

Status: local implementation, not release-ready. Session/batch APIs, Android controls and encrypted queue, map controls and a retention handler exist locally. The dedicated staging bucket and its 30-day object lifecycle exist, but the Worker binding/cron and database migration have not been deployed. Background execution, SQLCipher, offline recovery and the complete flow remain unverified on a real device. Do not present tracking as available until staging integration and device tests are complete.

## Product contract

- An authenticated field sales user explicitly starts and stops a session. Tracking stops locally immediately on stop even when offline; previously captured points may be uploaded later. Never start automatically after reboot, force-stop or logout.
- Show a persistent Android foreground notification while collecting, plus last captured/synced time and unsent count. Explain location use before requesting access; obtain the appropriate Android and Play permissions for the actual background behaviour.
- Initial targets: moving 60 seconds, stationary 5 minutes, send every 5 minutes; not a delivery guarantee. Minimum changes based on device measurements, not false exact routes. Max acceptable GPS accuracy starts at 100 m, adjustable after pilot. Missing GPS is a gap and never a synthetic straight line.
- Retain detailed trajectory 30 days and daily summary 3 calendar months. Enforce deletion in a verified scheduled job; R2 lifecycle is a safety net rather than proof that D1 metadata was removed. Respect effective end time for late uploads and reject expired batches without silently discarding local unsent data.
- Viewer access follows current hierarchy and historical scope policies, with separate checks for collection and display. Portfolio guests must never be allowed to start tracking or access live locations.

## Storage and delivery design to implement

- D1: session identity and ownership, state/version, last accepted fix and captured timestamp, daily summary, immutable batch manifest, retention deadline. Index by organisation, user and time. The accepted latest fix must be monotonic in captured time even when upload order differs.
- R2: immutable JSON objects containing several minutes of fixes, scoped by hashed organisation/session and a random batch identifier. One `PUT` per batch, not per point. Keep coordinates and identifiers out of object names and logs. Use a dedicated binding, not the import-source bucket. Compression remains a future optimisation; measure actual object size before choosing a format.
- Batch request contains a client-generated stable id, session id and ordered points. Validate session ownership, timestamps, accuracy, size and retention. Identical retry returns the original result; same id with different bytes returns conflict. Never overwrite an existing object with different content. Handle D1/R2 partial failures through a recoverable pending manifest and cleanup, not a presumed cross-service transaction. Cap request body and point count.
- On Android, durable encrypted-at-rest storage where supported holds pending batches with account/session binding. Retry with bounded exponential backoff, preserve original capture timestamps, make acknowledgement durable before deletion, and prevent one account uploading another's queue.
- Read latest markers from a scope-filtered D1 projection. Load R2 segments only for the selected sales/day. Split lines at gaps and offer chronological check-in markers without inferring missing travel.
- Retention runs on an explicitly configured scheduled worker, in small resumable chunks, deleting both objects and metadata. Record operation counts and failures without logging coordinates. Verify actual staging cron configuration before claiming cleanup runs.

## Required release gates

Implement and test authentication/scope, concurrent start/stop, offline stop and retry, duplicate/conflicting batches, R2/D1 partial failure recovery, ordering and expiry, scoped map queries, retention and audit. Measure R2 Class A/B, D1 rows read/written, Workers requests, battery, storage and latency with representative fixtures. Test screen lock, revoked permissions, network loss, process kill and reboot on real Android devices before releasing an APK as ready.
