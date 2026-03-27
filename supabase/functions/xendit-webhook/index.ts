import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  // Hanya terima POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verifikasi webhook token dari Xendit
  const webhookToken = req.headers.get('x-callback-token');
  const expectedToken = Deno.env.get('XENDIT_WEBHOOK_TOKEN');

  if (!expectedToken || webhookToken !== expectedToken) {
    console.error('Invalid webhook token');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  console.log('Xendit webhook received:', JSON.stringify(payload, null, 2));

  // Xendit QRIS webhook event: 'qr.payment'
  // Status sukses: 'SUCCEEDED'
  if (payload.event !== 'qr.payment' || payload.data?.status !== 'SUCCEEDED') {
    // Bukan event pembayaran sukses — abaikan tapi kembalikan 200
    return new Response('OK', { status: 200 });
  }

  const referenceId: string = payload.data?.reference_id;  // = transaction_code
  const paidAmount: number = payload.data?.amount;
  const paidAt: string = payload.data?.created ?? new Date().toISOString();

  if (!referenceId) {
    console.error('Missing reference_id in webhook payload');
    return new Response('Missing reference_id', { status: 400 });
  }

  // Init Supabase client dengan service role key
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Cari transaksi berdasarkan transaction_code
  const { data: transaction, error: findError } = await supabase
    .from('sales_transactions')
    .select('id, status, total_amount')
    .eq('transaction_code', referenceId)
    .single();

  if (findError || !transaction) {
    console.error('Transaction not found for reference_id:', referenceId, findError);
    return new Response('Transaction not found', { status: 404 });
  }

  // Idempotency: skip jika sudah PAID
  if (transaction.status === 'PAID') {
    console.log('Transaction already PAID, skipping:', referenceId);
    return new Response('Already processed', { status: 200 });
  }

  // Validasi amount (toleransi Rp 1 untuk floating point)
  if (paidAmount !== undefined && Math.abs(transaction.total_amount - paidAmount) > 1) {
    console.error(`Amount mismatch: DB=${transaction.total_amount}, Xendit=${paidAmount}`);
    return new Response('Amount mismatch', { status: 400 });
  }

  // Konfirmasi pembayaran via RPC yang sudah ada
  const { data: confirmData, error: confirmError } = await supabase.rpc(
    'confirm_payment_with_method',
    {
      p_transaction_id: transaction.id,
      p_payment_method: 'QRIS',
    }
  );

  if (confirmError) {
    console.error('Error confirming payment:', confirmError);
    return new Response('Error confirming payment', { status: 500 });
  }

  if (!confirmData?.[0]?.success) {
    console.error('confirm_payment_with_method returned failure:', confirmData);
    return new Response('Confirm payment failed', { status: 500 });
  }

  // Catat timestamp pembayaran dari Xendit
  await supabase
    .from('sales_transactions')
    .update({ payment_paid_at: paidAt })
    .eq('id', transaction.id);

  console.log('Payment confirmed for transaction:', referenceId);
  return new Response('OK', { status: 200 });
});
