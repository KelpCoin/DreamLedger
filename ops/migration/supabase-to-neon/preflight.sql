-- READ-ONLY source inventory for DreamLedger Supabase -> Neon migration.
-- This statement changes no data, schemas, roles, policies, storage, auth, or extensions.
-- Output is private migration evidence. Do not commit actual inventory output.
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at_utc', clock_timestamp(),
  'server_version', version(),
  'current_database', current_database(),
  'schemas', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(n.nspowner)) ORDER BY n.nspname),'[]'::jsonb)
    FROM pg_namespace n
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'extensions', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname),'[]'::jsonb)
    FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
  ),
  'relations', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'name',c.relname,'kind',c.relkind,
      'estimated_rows',CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END,
      'owner',pg_get_userbyid(c.relowner),
      'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity,
      'persistence',c.relpersistence
    ) ORDER BY n.nspname,c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','v','m','f','S')
      AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'columns', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'table',c.relname,'column',a.attname,
      'ordinal',a.attnum,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
      'default_expression',pg_get_expr(d.adbin,d.adrelid)
    ) ORDER BY n.nspname,c.relname,a.attnum),'[]'::jsonb)
    FROM pg_attribute a
    JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped
      AND c.relkind IN ('r','p','v','m','f')
      AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'user_defined_types', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'name',t.typname,'kind',t.typtype,
      'base_type',CASE WHEN t.typbasetype=0 THEN NULL ELSE format_type(t.typbasetype,t.typtypmod) END,
      'enum_labels',CASE WHEN t.typtype='e' THEN (
        SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid
      ) ELSE NULL END
    ) ORDER BY n.nspname,t.typname),'[]'::jsonb)
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND t.typtype IN ('d','e','r')
  ),
  'indexes', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',ns.nspname,'table',tbl.relname,'index',idx.relname,
      'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,
      'definition',pg_get_indexdef(idx.oid)
    ) ORDER BY ns.nspname,tbl.relname,idx.relname),'[]'::jsonb)
    FROM pg_index i
    JOIN pg_class tbl ON tbl.oid=i.indrelid
    JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
    JOIN pg_class idx ON idx.oid=i.indexrelid
    WHERE ns.nspname NOT LIKE 'pg_%' AND ns.nspname <> 'information_schema'
  ),
  'constraints', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'table',tbl.relname,'name',con.conname,
      'type',con.contype,'validated',con.convalidated,
      'definition',pg_get_constraintdef(con.oid,true),
      'referenced_schema',rn.nspname,'referenced_table',ref.relname
    ) ORDER BY n.nspname,tbl.relname,con.conname),'[]'::jsonb)
    FROM pg_constraint con
    JOIN pg_class tbl ON tbl.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=tbl.relnamespace
    LEFT JOIN pg_class ref ON ref.oid=con.confrelid
    LEFT JOIN pg_namespace rn ON rn.oid=ref.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'sequences', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),
      'owned_by',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid)
    ) ORDER BY n.nspname,c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i')
    WHERE c.relkind='S' AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'routines', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),
      'kind',p.prokind,'language',l.lanname,'owner',pg_get_userbyid(p.proowner),
      'security_definer',p.prosecdef,'volatility',p.provolatile
    ) ORDER BY n.nspname,p.proname),'[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'triggers', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',n.nspname,'table',c.relname,'name',t.tgname,
      'enabled_state',t.tgenabled,'function_schema',pn.nspname,'function',p.proname,
      'definition',pg_get_triggerdef(t.oid,true)
    ) ORDER BY n.nspname,c.relname,t.tgname),'[]'::jsonb)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace
    WHERE NOT t.tgisinternal AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  ),
  'rls_policies', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'schema',schemaname,'table',tablename,'policy',policyname,'roles',roles,
      'command',cmd,'using',qual,'with_check',with_check
    ) ORDER BY schemaname,tablename,policyname),'[]'::jsonb)
    FROM pg_policies
  ),
  'table_grants', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'grantee',grantee,'schema',table_schema,'table',table_name,'privilege',privilege_type,'grantable',is_grantable
    ) ORDER BY table_schema,table_name,grantee,privilege_type),'[]'::jsonb)
    FROM information_schema.role_table_grants
    WHERE table_schema NOT IN ('information_schema')
      AND table_schema NOT LIKE 'pg_%'
  ),
  'function_dependencies', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'object',pg_describe_object(d.classid,d.objid,d.objsubid),
      'referenced_object',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),
      'dependency_type',d.deptype
    ) ORDER BY d.classid::text,d.objid,d.refclassid::text,d.refobjid),'[]'::jsonb)
    FROM pg_depend d
    WHERE d.classid='pg_proc'::regclass AND d.refclassid IN ('pg_class'::regclass,'pg_proc'::regclass)
      AND d.deptype <> 'i'
  ),
  'views_referencing_supabase_managed_schemas', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'view',c.relname,'definition',pg_get_viewdef(c.oid,true))
      ORDER BY n.nspname,c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('v','m')
      AND (pg_get_viewdef(c.oid,true) ILIKE '%auth.%'
        OR pg_get_viewdef(c.oid,true) ILIKE '%storage.%'
        OR pg_get_viewdef(c.oid,true) ILIKE '%realtime.%'
        OR pg_get_viewdef(c.oid,true) ILIKE '%vault.%')
  ),
  'supabase_managed_schema_objects', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'object',c.relname,'kind',c.relkind,'estimated_rows',
      CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END)
      ORDER BY n.nspname,c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('auth','storage','realtime','vault')
      AND c.relkind IN ('r','p','v','m','S','f')
  )
)) AS supabase_migration_inventory;
