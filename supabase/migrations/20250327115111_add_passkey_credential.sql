-- In Supabase SQL editor:
-- Add passkey_credential column to wallets table
ALTER TABLE wallets
ADD COLUMN passkey_credential TEXT;