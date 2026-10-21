-- READ-ONLY Supabase dependency inventory. Run only against the source Supabase DB.
-- Does not alter schema, data, roles, policies, storage, auth, or extensions.
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at_utc', clock_timestamp(),
  'server_version', version(),
  'current_database', current_database(),
  'schemas', (
    SELECT COALESCE(jsonb_agg(n.nspname ORDER BY n.nspname), '[]'::jsonb)
    FROM pg_namespace n
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'extensions', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', e.extname, 'version', e.extversion) ORDER BY e.extname), '[]'::jsonb)
    FROM pg_extension e
  ),
  'tables_and_row_estimates', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'kind', c.relkind,
      'estimated_rows', GREATEST(c.reltuples, 0)::bigint,
      'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity
    ) ORDER BY n.nspname, c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'v', 'm')
      AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'foreign_keys_into_supabase_managed_schemas', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'from_schema', ns.nspname, 'from_table', src.relname,
      'constraint', con.conname, 'to_schema', nd.nspname, 'to_table', dst.relname
    ) ORDER BY ns.nspname, src.relname, con.conname), '[]'::jsonb)
    FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = src.relnamespace
    JOIN pg_class dst ON dst.oid = con.confrelid
    JOIN pg_namespace nd ON nd.oid = dst.relnamespace
    WHERE con.contype = 'f' AND nd.nspname IN ('auth', 'storage', 'realtime', 'vault')
  ),
  'user_triggers', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'trigger', t.tgname, 'function', p.proname
    ) ORDER BY n.nspname, c.relname, t.tgname), '[]'::jsonb)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'rls_policies', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', schemaname, 'table', tablename, 'policy', policyname,
      'roles', roles, 'command', cmd, 'using', qual, 'with_check', with_check
    ) ORDER BY schemaname, tablename, policyname), '[]'::jsonb)
    FROM pg_policies
  ),
  'routines', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname, 'kind', p.prokind, 'language', l.lanname
    ) ORDER BY n.nspname, p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'views_referencing_auth_or_storage', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('schema', n.nspname, 'view', c.relname)
      ORDER BY n.nspname, c.relname), '[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
      AND (pg_get_viewdef(c.oid, true) ILIKE '%auth.%'
        OR pg_get_viewdef(c.oid, true) ILIKE '%storage.%')
  )
)) AS supabase_migration_inventory;
