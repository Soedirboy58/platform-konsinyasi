import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailTemplate {
  subject: string;
  html: string;
}

function getEmailTemplate(notification: any, baseUrl: string): EmailTemplate {
  const templates: Record<string, EmailTemplate> = {
    PRODUCT_APPROVAL: {
      subject: '🔔 Produk Baru Menunggu Persetujuan',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; }
            .button { 
              display: inline-block; 
              background: #2563eb; 
              color: white !important; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px;
              margin-top: 20px;
            }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; padding: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">Produk Baru Menunggu Review</h2>
          </div>
          <div class="content">
            <p>Halo Admin,</p>
            <p>${notification.message}</p>
            <a href="${baseUrl}${notification.action_url}" class="button">Review Produk Sekarang</a>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Produk ini perlu disetujui sebelum bisa ditampilkan di kantin.
            </p>
          </div>
          <div class="footer">
            Platform Konsinyasi v2.0 | © 2024
          </div>
        </body>
        </html>
      `
    },
    
    STOCK_ADJUSTMENT: {
      subject: '📦 Klaim Stok Perlu Direview',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; }
            .button { 
              display: inline-block; 
              background: #f59e0b; 
              color: white !important; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">Klaim Stok Hilang/Rusak</h2>
          </div>
          <div class="content">
            <p>${notification.message}</p>
            <a href="${baseUrl}${notification.action_url}" class="button">Lihat Detail Klaim</a>
          </div>
        </body>
        </html>
      `
    },
    
    LOW_STOCK: {
      subject: '⚠️ Stok Produk Menipis',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; }
            .alert { 
              background: #fee2e2; 
              border-left: 4px solid #dc2626; 
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .button { 
              display: inline-block; 
              background: #dc2626; 
              color: white !important; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">⚠️ Alert: Stok Menipis</h2>
          </div>
          <div class="content">
            <div class="alert">
              <strong>Perhatian!</strong><br>
              ${notification.message}
            </div>
            <p>Segera lakukan restock untuk menghindari kekosongan stok.</p>
            <a href="${baseUrl}${notification.action_url}" class="button">Restock Sekarang</a>
          </div>
        </body>
        </html>
      `
    },
    
    EXPIRY_WARNING: {
      subject: '⏰ Produk Akan Kadaluwarsa',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: #ea580c; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; }
            .warning { 
              background: #fed7aa; 
              border-left: 4px solid #ea580c; 
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .button { 
              display: inline-block; 
              background: #ea580c; 
              color: white !important; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">⏰ Peringatan Kadaluwarsa</h2>
          </div>
          <div class="content">
            <div class="warning">
              <strong>Perhatian Urgent!</strong><br>
              ${notification.message}
            </div>
            <p><strong>Tindakan yang bisa dilakukan:</strong></p>
            <ul>
              <li>Tarik produk dari display</li>
              <li>Berikan diskon khusus</li>
              <li>Catat sebagai loss jika sudah kadaluwarsa</li>
            </ul>
            <a href="${baseUrl}${notification.action_url}" class="button">Lihat Detail</a>
          </div>
        </body>
        </html>
      `
    }
  };

  return templates[notification.type] || {
    subject: notification.title,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${notification.title}</h2>
        <p>${notification.message}</p>
      </body>
      </html>
    `
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { notificationId } = await req.json();
    
    if (!notificationId) {
      throw new Error('notificationId is required');
    }

    console.log(`Processing notification: ${notificationId}`);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get notification with recipient details
    const { data: notification, error: notifError } = await supabaseClient
      .from('notifications')
      .select(`
        *,
        profiles:recipient_id (
          email,
          full_name
        )
      `)
      .eq('id', notificationId)
      .single();

    if (notifError || !notification) {
      throw new Error(`Notification not found: ${notifError?.message}`);
    }

    if (!notification.profiles?.email) {
      throw new Error('Recipient email not found');
    }

    console.log(`Sending email to: ${notification.profiles.email}`);

    // Get email template
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://konsinyasi.vercel.app';
    const emailTemplate = getEmailTemplate(notification, baseUrl);

    // Check if Resend API key is configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured, skipping email send');
      return new Response(
        JSON.stringify({
          success: true,
          notificationId,
          message: 'Email skipped (no API key configured)',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Send email via Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || 'Platform Konsinyasi <noreply@konsinyasi.com>',
        to: [notification.profiles.email],
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log('Email sent successfully:', emailResult);

    // Log activity
    await supabaseClient
      .from('activity_logs')
      .insert({
        action: 'email_sent',
        table_name: 'notifications',
        record_id: notificationId,
        new_values: {
          email_id: emailResult.id,
          recipient: notification.profiles.email
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        notificationId,
        emailId: emailResult.id,
        recipient: notification.profiles.email,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error:', error);
    
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
 * supabase functions deploy notification-dispatcher
 * 
 * ENVIRONMENT VARIABLES NEEDED:
 * - RESEND_API_KEY (get from resend.com)
 * - FRONTEND_URL (optional, defaults to https://konsinyasi.vercel.app)
 * - EMAIL_FROM (optional, defaults to Platform Konsinyasi <noreply@konsinyasi.com>)
 * 
 * TEST:
 * curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/notification-dispatcher \
 *   -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
 *   -H "Content-Type: application/json" \
 *   -d '{"notificationId": "your-notification-uuid"}'
 */