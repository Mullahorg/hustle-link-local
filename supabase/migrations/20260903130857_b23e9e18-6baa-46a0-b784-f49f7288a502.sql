
CREATE POLICY "Market photos are viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'market-photos');
CREATE POLICY "Sellers upload their own market photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'market-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers update their own market photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'market-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers delete their own market photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'market-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
