-- Run once in the Supabase SQL Editor.
-- The upload policy is public because the static site has no login; visitors can upload images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'scene-photos',
    'scene-photos',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists scene_photos_public_read on storage.objects;
create policy scene_photos_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'scene-photos');

drop policy if exists scene_photos_public_upload on storage.objects;
create policy scene_photos_public_upload
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'scene-photos');

drop policy if exists scene_photos_public_delete on storage.objects;
create policy scene_photos_public_delete
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'scene-photos');insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'scene-photos',
    'scene-photos',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists scene_photos_public_read on storage.objects;
create policy scene_photos_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'scene-photos');

drop policy if exists scene_photos_public_upload on storage.objects;
create policy scene_photos_public_upload
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'scene-photos');

