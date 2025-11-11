# Generate QR Code untuk Outlet

## ✅ URL yang Sudah Bekerja:

```
https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a
```

---

## 📱 Cara Generate QR Code:

### Option 1: Online Generator (Paling Mudah)

**1. QR Code Generator:**
- Buka: https://www.qr-code-generator.com/
- Pilih: **URL**
- Masukkan: `https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a`
- Klik: **Create QR Code**
- Download: **PNG** atau **PDF** (resolusi tinggi)
- Print dan tempel di outlet

**2. QRCode Monkey (Bisa Custom Design):**
- Buka: https://www.qrcode-monkey.com/
- Input URL: `https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a`
- Custom: Logo, warna, style (optional)
- Download: **PNG** (2000x2000px recommended)
- Print

**3. QR Code Generator (Free + Custom):**
- Buka: https://www.qr-code-generator.com/
- Free plan: 1 QR code
- Bisa add logo tengah
- Format: PNG/SVG/EPS

---

### Option 2: Canva (Recommended untuk Design Cantik)

1. Buka: https://www.canva.com/
2. Search template: **"QR Code Poster"**
3. Add QR code element
4. Input URL: `https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a`
5. Design sesuai brand (tambah text, logo, warna)
6. Download: **PDF Print** atau **PNG**

**Contoh Text untuk Poster:**
```
🏪 KANTIN KEJUJURAN
Scan untuk Belanja

[QR CODE]

📱 Scan → Pilih Produk → Bayar QRIS
Terima kasih atas kejujuran Anda!
```

---

### Option 3: Script Python (Untuk Banyak Outlet)

Jika kamu punya banyak outlet dan mau auto-generate:

<function_calls>
<invoke name="create_file">
<parameter name="content">import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
BASE_URL = "https://platform-konsinyasi-v1.vercel.app/kantin/"
OUTPUT_DIR = "qr_codes"

# Outlets data (from database)
outlets = [
    {"name": "Outlet Lobby A", "slug": "outlet_lobby_a"},
    # Add more outlets here
]

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

for outlet in outlets:
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    
    url = BASE_URL + outlet['slug']
    qr.add_data(url)
    qr.make(fit=True)
    
    # Create QR image
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # Create poster with text
    poster = Image.new('RGB', (800, 1000), 'white')
    draw = ImageDraw.Draw(poster)
    
    # Paste QR code
    qr_img = qr_img.resize((600, 600))
    poster.paste(qr_img, (100, 200))
    
    # Add text (you need a font file)
    try:
        font_title = ImageFont.truetype("arial.ttf", 60)
        font_subtitle = ImageFont.truetype("arial.ttf", 30)
    except:
        font_title = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()
    
    # Title
    draw.text((400, 50), "KANTIN KEJUJURAN", fill='black', 
              font=font_title, anchor="mm")
    
    # Outlet name
    draw.text((400, 120), outlet['name'], fill='black', 
              font=font_subtitle, anchor="mm")
    
    # Instructions
    draw.text((400, 850), "Scan untuk Belanja", fill='black', 
              font=font_subtitle, anchor="mm")
    
    draw.text((400, 920), "Terima kasih atas kejujuran Anda!", 
              fill='gray', font=font_subtitle, anchor="mm")
    
    # Save
    filename = f"{OUTPUT_DIR}/{outlet['slug']}.png"
    poster.save(filename, quality=95)
    print(f"✅ Generated: {filename}")

print(f"\n🎉 Done! QR codes saved in '{OUTPUT_DIR}/' folder")
