-- Imágenes del catálogo (Adiviná la imagen): bucket público "imagenes" en Supabase Storage.
-- Leer: cualquiera (el proyector las muestra). Subir, cambiar o borrar: solo admins.
-- Los nombres de archivo son al azar (no delatan la respuesta).
-- Guarda: la base de pruebas local (PGlite) no tiene el esquema storage.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Sin esquema storage: se saltea el bucket de imágenes.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('imagenes', 'imagenes', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy admin_sube_imagenes on storage.objects for insert to authenticated
    with check (bucket_id = 'imagenes' and (select public.is_admin()))$p$;
  execute $p$create policy admin_cambia_imagenes on storage.objects for update to authenticated
    using (bucket_id = 'imagenes' and (select public.is_admin()))$p$;
  execute $p$create policy admin_borra_imagenes on storage.objects for delete to authenticated
    using (bucket_id = 'imagenes' and (select public.is_admin()))$p$;
  execute $p$create policy admin_lista_imagenes on storage.objects for select to authenticated
    using (bucket_id = 'imagenes' and (select public.is_admin()))$p$;
end $$;
