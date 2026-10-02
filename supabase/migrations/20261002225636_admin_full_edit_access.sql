CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    JOIN public.roles AS r ON r.id = ur.role_id
    WHERE ur.user_id = (SELECT auth.uid())
      AND r.name = 'admin'::public.app_role
  );
$function$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION private.is_site_member(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.site_memberships AS sm
      WHERE sm.site_id = p_site_id
        AND sm.user_id = (SELECT auth.uid())
    );
$function$;

DROP POLICY IF EXISTS user_roles_self_insert ON public.user_roles;

DO $block$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table.tablename);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      v_table.tablename
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS app_admin_manage_all ON public.%I',
      v_table.tablename
    );
    EXECUTE format(
      'CREATE POLICY app_admin_manage_all ON public.%I FOR ALL TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))',
      v_table.tablename
    );
  END LOOP;
END;
$block$;

DROP POLICY IF EXISTS reliability_library_objects_admin_update ON storage.objects;
CREATE POLICY reliability_library_objects_admin_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'reliability-library'
  AND (SELECT private.is_admin())
)
WITH CHECK (
  bucket_id = 'reliability-library'
  AND (SELECT private.is_admin())
);
