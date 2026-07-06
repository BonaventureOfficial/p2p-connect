ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_profiles_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;