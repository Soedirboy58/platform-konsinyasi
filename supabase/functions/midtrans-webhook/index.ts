import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

serve(async (req: Request) => {
  // Hanya terima POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  console.log('Midtrans webhook received:', JSON.stringify(payload, null, 2));

  // Verifikasi signature Midtrans:
  // SHA512(order_id + status_code + gross_amount + server_key)
  const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
  if (!serverKey) {
    console.error('MIDTRANS_SERVER_KEY not set');
    return new Response('Server misconfigured', { status: 500 });
  }

  const rawSig = `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-512', encoder.encode(rawSig));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (computedSig !== payload.signature_key) {
    console.error('Invalid Midtrans signature');
    return new Response('Unauthorized', { status: 401 });
  }

  // Hanya proses status pembayaran berhasil
  const successStatuses = ['settlement', 'capture'];
  if (!successStatuses.includes(payload.transaction_status)) {
    console.log(`Skipping status: ${payload.transaction_status}`);
    return new Response('OK', { status: 200 });
  }

  // Pastikan payment_type QRIS
  if (payload.payment_type !== 'qris') {
    console.log(`Skipping payment_type: ${payload.payment_type}`);
    return new Response('OK', { status: 200 });
  }

  const orderId: string = payload.order_id; // = transaction_code dari platform
  const paidAt: string = payload.settlement_time ?? new Date().toISOString();

  if (!orderId) {
    console.error('Missing order_id in webhook payload');
    return new Response('Missing order_id', { status: 400 });
  }

  // Init Supabase client dengan service role key
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Cari transaksi berdasarkan transaction_code = order_id
  const { data: transaction, error: findError } = await supabase
    .from('sales_transactions')
    .select('id, status, total_amount')
    .eq('transaction_code', orderId)
    .single();

  if (findError || !transaction) {
    console.error('Transaction not found for order_id:', orderId, findError);
    return new Response('Transaction not found', { status: 404 });
  }

  // Idempotency: skip jika sudah COMPLETED
  if (transaction.status === 'COMPLETED') {
    console.log('Transaction already COMPLETED, skipping:', orderId);
    return new Response('Already processed', { status: 200 });
  }

  // Validasi nominal (toleransi Rp 1 untuk floating point)
  const paidAmount = parseFloat(payload.gross_amount);
  if (!isNaN(paidAmount) && Math.abs(transaction.total_amount - paidAmount) > 1) {
    console.error(`Amount mismatch: DB=${transaction.total_amount}, Midtrans=${paidAmount}`);
    return new Response('Amount mismatch', { status: 400 });
  }

  // Konfirmasi pembayaran via RPC yang sudah ada di platform
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

  // Catat timestamp pembayaran dari Midtrans
  await supabase
    .from('sales_transactions')
    .update({ payment_paid_at: paidAt })
    .eq('id', transaction.id);

  console.log('Payment confirmed for transaction:', orderId);
  return new Response('OK', { status: 200 });
});
