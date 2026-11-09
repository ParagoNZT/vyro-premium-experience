// The console generates this separator for installations; older entries used "-".
export const showLabel =
  "(upper(ltrim(c.name)) LIKE 'SHOW+ · %' OR upper(ltrim(c.name)) LIKE 'SHOW+ - %')";
export const showScope = `c.reseller_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM licenses l WHERE l.beta_code_hash=c.code_hash)
  AND NOT EXISTS (SELECT 1 FROM partner_app_devices p WHERE p.code_hash=c.code_hash AND p.app_id<>'show-plus')
  AND (${showLabel} OR EXISTS (SELECT 1 FROM show_installations s WHERE s.code_hash=c.code_hash))
  AND NOT EXISTS (SELECT 1 FROM show_installations s WHERE s.code_hash=c.code_hash AND (
    EXISTS (SELECT 1 FROM licenses l WHERE l.beta_code_hash=s.legacy_code_hash)
    OR EXISTS (SELECT 1 FROM codes legacy WHERE legacy.code_hash=s.legacy_code_hash AND legacy.reseller_id IS NOT NULL)))`;

export function appScope(id: string) {
  return id === "show-plus"
    ? { sql: showScope, bindings: [] }
    : {
        sql: "EXISTS (SELECT 1 FROM partner_app_devices p WHERE p.code_hash=c.code_hash AND p.app_id=?)",
        bindings: [id],
      };
}
