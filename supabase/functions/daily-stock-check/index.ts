import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting daily stock check...');
    
    // Create Supabase client dengan SERVICE ROLE key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if already ran today (idempotency)
    const today = new Date().toISOString().split('T')[0];
    const { data: existingRun } = await supabaseClient
      .from('activity_logs')
      .select('id')
      .eq('action', 'daily_stock_check')
      .gte('created_at', today)
      .maybeSingle();

    if (existingRun) {
      console.log('Stock check already ran today');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Already ran today',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Call database function untuk check low stock
    console.log('Checking low stock items...');
    const { data: lowStockResult, error: lowStockError } = await supabaseClient
      .rpc('send_low_stock_notifications');

    if (lowStockError) {
      console.error('Low stock check error:', lowStockError);
      throw lowStockError;
    }

    console.log(`Low stock notifications sent: ${lowStockResult}`);

    // Call database function untuk check expiring products
    console.log('Checking expiring products...');
    const { data: expiryResult, error: expiryError } = await supabaseClient
      .rpc('send_expiry_warnings');

    if (expiryError) {
      console.error('Expiry check error:', expiryError);
      throw expiryError;
    }

    console.log(`Expiry warnings sent: ${expiryResult}`);

    // Log this execution
    await supabaseClient
      .from('activity_logs')
      .insert({
        action: 'daily_stock_check',
        table_name: 'edge_functions',
        record_id: crypto.randomUUID(),
        new_values: {
          lowStockNotifications: lowStockResult,
          expiryWarnings: expiryResult
        }
      });

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results: {
          lowStockNotifications: lowStockResult || 0,
          expiryWarnings: expiryResult || 0,
          totalNotifications: (lowStockResult || 0) + (expiryResult || 0)
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

/* 
 * DEPLOYMENT:
 * supabase functions deploy daily-stock-check
 * 
 * TEST:
 * curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-stock-check \
 *   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
 *   -H "Content-Type: application/json"
 */