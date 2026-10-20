CREATE TABLE public.reseller_apps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
 package_name text NOT NULL CHECK (package_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
 logo_path text,
 servers jsonb NOT NULL DEFAULT '[]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_apps TO authenticated;
GRANT ALL ON public.reseller_apps TO service_role;
ALTER TABLE public.reseller_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read app" ON public.reseller_apps FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners create app" ON public.reseller_apps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update app" ON public.reseller_apps FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete app" ON public.reseller_apps FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.validate_reseller_app() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb;
BEGIN
 IF jsonb_typeof(NEW.servers) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.servers) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Provide 1 to 10 XC servers'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(NEW.servers) LOOP
  IF jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR char_length(item->>'name') NOT BETWEEN 1 AND 60 OR jsonb_typeof(item->'url') IS DISTINCT FROM 'string' OR (item->>'url') !~ '^https?://[a-zA-Z0-9.-]+(:[0-9]{1,5})?/?$' THEN RAISE EXCEPTION 'Invalid XC server'; END IF;
 END LOOP;
 IF NEW.logo_path IS NOT NULL AND NEW.logo_path NOT LIKE NEW.user_id::text || '/%' THEN RAISE EXCEPTION 'Invalid logo owner'; END IF;
 NEW.updated_at = now();
 RETURN NEW;
END $$;
CREATE TRIGGER validate_reseller_app BEFORE INSERT OR UPDATE ON public.reseller_apps FOR EACH ROW EXECUTE FUNCTION public.validate_reseller_app();
CREATE POLICY "Reseller logo read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reseller-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Reseller logo upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reseller-logos' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp'));
CREATE POLICY "Reseller logo delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'reseller-logos' AND (storage.foldername(name))[1] = auth.uid()::text);