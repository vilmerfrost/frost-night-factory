CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.user_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL,
    dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_preferences
ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for users based on user_id" ON public.user_preferences
AS PERMISSIVE FOR SELECT
TO AUTHENTICATED
USING (auth.uid() = user_id);

CREATE POLICY "Enable update access for users based on user_id" ON public.user_preferences
AS PERMISSIVE FOR UPDATE
TO AUTHENTICATED
USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users" ON public.user_preferences
AS PERMISSIVE FOR INSERT
TO AUTHENTICATED
WITH CHECK (auth.uid() = user_id);
