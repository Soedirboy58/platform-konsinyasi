-- Email Template Configuration for Supabase Auth
-- Untuk mengkonfigurasi email verifikasi, buka Supabase Dashboard:
-- Authentication → Email Templates → Confirm signup

-- ========================================
-- EMAIL TEMPLATE: CONFIRM SIGNUP (Verifikasi Email)
-- ========================================
-- Copy template dibawah ke Supabase Email Template Editor

/*
SUBJECT: Verifikasi Email - Platform Konsinyasi Katalara

BODY (HTML):
*/

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Email Anda</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; padding: 40px 0;">
        <tr>
            <td align="center" style="padding: 0;">
                <!-- Main Container -->
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    
                    <!-- Header with Gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                                🎉 Selamat Datang!
                            </h1>
                            <p style="margin: 10px 0 0; color: #d1fae5; font-size: 16px;">
                                Platform Konsinyasi by Katalara
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600;">
                                Hai {{ .ConfirmationURL }}! 👋
                            </h2>
                            
                            <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Terima kasih telah mendaftar sebagai <strong>Supplier</strong> di Platform Konsinyasi Katalara!
                            </p>
                            
                            <p style="margin: 0 0 25px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Untuk melanjutkan, silakan verifikasi email Anda dengan klik tombol di bawah:
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 0 auto 30px; border-collapse: collapse;">
                                <tr>
                                    <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                                        <a href="{{ .ConfirmationURL }}" 
                                           target="_blank" 
                                           style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: 0.5px;">
                                            ✅ Verifikasi Email Saya
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Info Box -->
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 0 0 25px; border-radius: 6px;">
                                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                                    <strong>📋 Langkah Selanjutnya:</strong><br/>
                                    1️⃣ Klik tombol verifikasi di atas<br/>
                                    2️⃣ Login ke portal supplier<br/>
                                    3️⃣ Lengkapi data bisnis Anda<br/>
                                    4️⃣ Mulai kelola produk & penjualan
                                </p>
                            </div>
                            
                            <!-- Alternative Link -->
                            <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.5;">
                                Atau copy & paste link berikut ke browser Anda:
                            </p>
                            <p style="margin: 0 0 25px; word-break: break-all;">
                                <a href="{{ .ConfirmationURL }}" 
                                   style="color: #10b981; text-decoration: none; font-size: 13px;">
                                    {{ .ConfirmationURL }}
                                </a>
                            </p>
                            
                            <!-- Security Notice -->
                            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 0 0 25px; border-radius: 6px;">
                                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                                    ⚠️ <strong>Penting:</strong> Link verifikasi ini akan kadaluarsa dalam <strong>24 jam</strong>. Jika Anda tidak melakukan pendaftaran, abaikan email ini.
                                </p>
                            </div>
                            
                            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                                Jika ada pertanyaan, hubungi kami di <a href="mailto:support@katalara.com" style="color: #10b981; text-decoration: none;">support@katalara.com</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px; color: #374151; font-size: 15px; font-weight: 600;">
                                Platform Konsinyasi
                            </p>
                            <p style="margin: 0 0 15px; color: #6b7280; font-size: 13px;">
                                Powered by <strong style="color: #10b981;">Katalara</strong>
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                © 2024 Katalara. All rights reserved.
                            </p>
                            
                            <!-- Social Links (Optional) -->
                            <div style="margin-top: 20px;">
                                <a href="#" style="display: inline-block; margin: 0 8px; text-decoration: none; color: #6b7280;">
                                    <span style="font-size: 20px;">🌐</span>
                                </a>
                                <a href="#" style="display: inline-block; margin: 0 8px; text-decoration: none; color: #6b7280;">
                                    <span style="font-size: 20px;">📧</span>
                                </a>
                                <a href="#" style="display: inline-block; margin: 0 8px; text-decoration: none; color: #6b7280;">
                                    <span style="font-size: 20px;">📱</span>
                                </a>
                            </div>
                        </td>
                    </tr>
                    
                </table>
                
                <!-- Disclaimer -->
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                        <td style="padding: 0 30px; text-align: center;">
                            <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                                Email ini dikirim otomatis. Mohon tidak membalas email ini.<br/>
                                Jika Anda tidak merasa mendaftar, abaikan email ini dengan aman.
                            </p>
                        </td>
                    </tr>
                </table>
                
            </td>
        </tr>
    </table>
</body>
</html>


-- ========================================
-- REDIRECT URL CONFIGURATION
-- ========================================
-- Di Supabase Dashboard:
-- Authentication → URL Configuration → Site URL & Redirect URLs

-- Site URL (Production):
https://konsinyasi.vercel.app

-- Redirect URLs (tambahkan semua):
https://konsinyasi.vercel.app/supplier/login
https://konsinyasi.vercel.app/auth/callback
http://localhost:3000/supplier/login
http://localhost:3000/auth/callback


-- ========================================
-- EMAIL SETTINGS
-- ========================================
-- Di Supabase Dashboard:
-- Authentication → Email Settings

-- Confirm Email: ENABLED (✅)
-- Double Confirm Email: DISABLED (optional)
-- Secure Email Change: ENABLED (✅)

-- Mailer Templates:
-- - Subject: Verifikasi Email - Platform Konsinyasi Katalara
-- - From Name: Platform Konsinyasi Katalara
-- - From Email: noreply@katalara.com (atau gunakan default Supabase)


-- ========================================
-- NOTES
-- ========================================
-- 1. Template menggunakan variable Supabase:
--    {{ .ConfirmationURL }} = Link verifikasi otomatis
--    {{ .Token }} = Token verifikasi (jika manual)
--    {{ .Email }} = Email user
--    {{ .SiteURL }} = Base URL aplikasi

-- 2. Setelah verifikasi, user akan redirect ke:
--    /auth/callback → lalu ke /supplier/login

-- 3. Pastikan file auth/callback/route.ts sudah ada

-- 4. Design responsif untuk mobile & desktop
-- 5. Brand colors: Green (#10b981) - Katalara
