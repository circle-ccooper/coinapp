-- Add username column to the profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username varchar;

-- Create an index on username for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Comment on the username column
COMMENT ON COLUMN public.profiles.username IS 'Unique username identifier for the user';