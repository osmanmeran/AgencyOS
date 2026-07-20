// Central platform database (`platform.db`) schema for multi-tenant SaaS.
//
// Unlike the per-tenant business databases, the platform DB holds only
// cross-tenant control data — the registry of agencies (tenants). Each tenant
// row points at its own isolated SQLite file under data/tenants/<id>/marvelops.db
// (see SAAS_PROJECT.md, Phase 1). The `azure_tenant_id` column replaces the
// single hardcoded MICROSOFT_TENANT_ID env var so each agency can bring its
// own Azure AD tenant.
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'trial',
      azure_tenant_id TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function down(db) {
  db.exec(`DROP TABLE IF EXISTS tenants;`);
}
