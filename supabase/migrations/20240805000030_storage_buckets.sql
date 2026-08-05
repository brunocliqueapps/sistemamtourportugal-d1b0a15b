-- Migration v30: Create storage bucket for logos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public read access
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

-- Policies for authenticated upload
CREATE POLICY "Auth Upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');

-- Policies for authenticated delete
CREATE POLICY "Auth Delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'logos');
