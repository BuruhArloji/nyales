# Regional hierarchy and village ownership

Approved structure: Management → Regional Manager → Area Manager → Supervisor → Sales / Telesales. Existing NSM support remains available for other organizations. Area Managers may supervise several Supervisors; Regional Managers may oversee several cities and Area Managers.

`REGIONAL_MANAGER` is a real effective-dated role. It has explicit area scopes and may read both operational channels within those areas. It never receives organization-wide visibility or `settings:manage`. National configuration and user administration remain Management/NSM responsibilities. Operational review actions use the same scoped resource checks as Area Manager actions.

Migration 0062 rebuilds the role CHECK constraint while preserving all role rows, foreign keys, overlap checks, hierarchy validation, and finance/geography/planning invalidation triggers. A Regional Manager reports to Management. An Area Manager can report to a Regional Manager; existing NSM/Management reporting remains valid.

Field ownership is one Sales per village for any intersecting effective-date interval. A Sales can own multiple villages. Telesales assignments are independent. Changes must close the previous ownership interval and transfer the entire confirmed village cohort, rather than splitting a village between Sales. The existing village workflow and database guards enforce managed village ownership and prevent overlapping owners.

Legacy staging data must be reconciled separately before calling the village cutover complete. On the 8 November inspection, staging contained no `customer_admin_location`, `area_admin_membership` or `village_sales_owner` rows. Local classification against checksum-verified geometry from the active BIG release matched 56,685 customers uniquely; 646 were outside coverage. Those 646 require separate handling and must not be assigned a fabricated village. Classification alone does not mutate staging or verify the physical accuracy of a customer coordinate.

Staging repair must preserve historical invoices, completed activities, target and incentive amounts, and the signed-in owner account. Transfer active teams and dated assignments before disabling a redundant dummy manager or archiving an old area. Preserve referenced identities as inactive records rather than breaking historical foreign keys.
