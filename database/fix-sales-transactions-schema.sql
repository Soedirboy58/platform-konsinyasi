-- ================================================
-- FIX: Add supplier_id to sales_transactions
-- Run this BEFORE setup-wallet-and-shipments-SAFE.sql
-- ================================================

-- Add supplier_id column to sales_transactions
ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS supplier_id UUID;

-- Add index for performance (queries by supplier)
CREATE INDEX IF NOT EXISTS idx_sales_transactions_supplier 
ON public.sales_transactions(supplier_id);

-- Add columns needed by record_sale_with_commission function
ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS product_id UUID;

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS quantity INTEGER;

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(15,2);

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2);

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 70.00;

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(15,2);

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(15,2);

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS sale_date DATE DEFAULT CURRENT_DATE;

ALTER TABLE public.sales_transactions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for other common queries
CREATE INDEX IF NOT EXISTS idx_sales_transactions_product 
ON public.sales_transactions(product_id);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_date 
ON public.sales_transactions(sale_date DESC);

-- Optional: Add foreign keys for referential integrity
-- (Comment out if you want to skip this for now)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_sales_transactions_supplier'
    ) THEN
        ALTER TABLE public.sales_transactions 
        ADD CONSTRAINT fk_sales_transactions_supplier 
        FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_sales_transactions_product'
    ) THEN
        ALTER TABLE public.sales_transactions 
        ADD CONSTRAINT fk_sales_transactions_product 
        FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_sales_transactions_location'
    ) THEN
        ALTER TABLE public.sales_transactions 
        ADD CONSTRAINT fk_sales_transactions_location 
        FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- SUCCESS
SELECT 'SUCCESS: sales_transactions table updated with all required columns!' AS status;
