-- Session 14: Admin liest Nutzer-/Abo-/Einlösedaten über RLS (KEIN Service Role nötig).
-- Bewusst NUR select — subscriptions/voucher_redemptions bleiben client-unbeschreibbar.
create policy "profiles_admin_select" on public.profiles
  for select using (public.is_admin());
create policy "subscriptions_admin_select" on public.subscriptions
  for select using (public.is_admin());
create policy "voucher_redemptions_admin_select" on public.voucher_redemptions
  for select using (public.is_admin());

-- Broadcast-Bilder: Admin-Vorschau unabhängig vom eigenen Abo-Status
create policy "broadcast_media_admin_select" on storage.objects
  for select using (bucket_id = 'broadcast-media' and public.is_admin());
