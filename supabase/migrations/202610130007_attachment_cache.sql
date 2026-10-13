begin;
-- Harden previously uploaded objects too; content and attachment records stay intact.
update storage.objects set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{cacheControl}','"max-age=0"'::jsonb)
where bucket_id='session-attachments';
commit;
