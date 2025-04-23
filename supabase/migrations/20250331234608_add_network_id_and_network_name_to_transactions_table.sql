-- Use this migration script to add network_id and network_name columns to the transactions table
-- Add network_id column (integer)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS network_id integer;
-- Add network_name column (varchar)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS network_name varchar;
-- Set default values for existing records
UPDATE transactions
SET network_id = 80002,
    network_name = 'Polygon Amoy'
WHERE network_id IS NULL;
-- Optional: Add an index on network_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_transactions_network_id ON transactions(network_id);
-- Comment about this migration
COMMENT ON COLUMN transactions.network_id IS 'Network ID for the blockchain (80002 for Polygon Amoy, 421614 for Arbitrum Sepolia)';
COMMENT ON COLUMN transactions.network_name IS 'Human-readable name of the blockchain network';