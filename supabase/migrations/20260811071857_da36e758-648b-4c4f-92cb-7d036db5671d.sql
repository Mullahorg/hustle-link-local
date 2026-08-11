-- verification bucket: owner folder only, staff read
DROP POLICY IF EXISTS "verification own upload" ON storage.objects;
CREATE POLICY "verification own upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "verification own read" ON storage.objects;
CREATE POLICY "verification own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='verification' AND ((storage.foldername(name))[1] = auth.uid()::text
   OR public.has_permission(auth.uid(),'verification.read')));

DROP POLICY IF EXISTS "verification own delete" ON storage.objects;
CREATE POLICY "verification own delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='verification' AND (storage.foldername(name))[1] = auth.uid()::text);

-- portfolio bucket: signed-in read, owner write
DROP POLICY IF EXISTS "portfolio read" ON storage.objects;
CREATE POLICY "portfolio read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='portfolio');

DROP POLICY IF EXISTS "portfolio own write" ON storage.objects;
CREATE POLICY "portfolio own write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "portfolio own update" ON storage.objects;
CREATE POLICY "portfolio own update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "portfolio own delete" ON storage.objects;
CREATE POLICY "portfolio own delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);