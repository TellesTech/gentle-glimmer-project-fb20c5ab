-- Add delivery_method column to autentique_signers table
ALTER TABLE public.autentique_signers 
ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'email';

-- Add comment for documentation
COMMENT ON COLUMN public.autentique_signers.delivery_method IS 'Delivery method: email or whatsapp';