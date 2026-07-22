-- IRI — Storage-Buckets & Policies (Session 2)
-- progress-photos: privat, nur die Nutzerin (Pfad-Konvention: <user_id>/<datei>)
-- recipe-images:   öffentlich lesbar (Rezeptfotos), Schreiben nur Admin
-- broadcast-media: privat (signierte URLs), Lesen für Abonnentinnen, Schreiben nur Admin
-- Scan-Fotos werden bewusst NICHT gespeichert (Datenschutz, Konzept Kap. 7) — kein Bucket dafür.

insert into storage.buckets (id, name, public)
values
  ('progress-photos', 'progress-photos', false),
  ('recipe-images', 'recipe-images', true),
  ('broadcast-media', 'broadcast-media', false)
on conflict (id) do nothing;

-- progress-photos: kompletter Zugriff nur auf den eigenen Ordner
create policy "progress_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "progress_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "progress_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- recipe-images: öffentlicher Bucket (Lesen über public URL), Schreiben nur Admin
create policy "recipe_images_admin_write" on storage.objects
  for insert with check (bucket_id = 'recipe-images' and public.is_admin());
create policy "recipe_images_admin_update" on storage.objects
  for update using (bucket_id = 'recipe-images' and public.is_admin());
create policy "recipe_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'recipe-images' and public.is_admin());

-- broadcast-media: Abonnentinnen lesen (App holt signierte URLs), Admin schreibt
create policy "broadcast_media_select_subscribers" on storage.objects
  for select using (bucket_id = 'broadcast-media' and public.is_subscriber());
create policy "broadcast_media_admin_write" on storage.objects
  for insert with check (bucket_id = 'broadcast-media' and public.is_admin());
create policy "broadcast_media_admin_delete" on storage.objects
  for delete using (bucket_id = 'broadcast-media' and public.is_admin());
