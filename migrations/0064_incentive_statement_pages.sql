-- Preserve the unpaged API while allowing scoped statement pages to use the
-- requested order without scanning/sorting every statement in the organization.
CREATE INDEX incentive_statement_org_page
  ON incentive_statement(organization_id, created_at DESC, revision_no DESC, id DESC);
CREATE INDEX incentive_statement_user_page
  ON incentive_statement(organization_id, user_id, created_at DESC, revision_no DESC, id DESC);
