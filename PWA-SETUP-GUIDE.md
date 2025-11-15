# PWA Setup Guide

## ✅ PWA sudah disetup dengan fitur:

### 1. **Install to Home Screen**
- Android: Chrome akan menampilkan banner "Add to Home Screen"
- iOS: Safari → Share → Add to Home Screen

### 2. **Offline Mode**
- Service Worker otomatis cache assets
- Halaman offline custom (`/offline.html`)
- Auto-reconnect saat online kembali

### 3. **App-like Experience**
- Fullscreen mode (tanpa address bar)
- Custom splash screen
- App icon di home screen

### 4. **Fast Loading**
- Assets di-cache otomatis (fonts, images, JS, CSS)
- Data API di-cache dengan NetworkFirst strategy
- Stale-while-revalidate untuk optimal performance

### 5. **Shortcuts**
- Dashboard
- Laporan
- Pengaturan

---

## 📱 Testing PWA

### Development (localhost)
```bash
npm run build
npm start
```

Buka Chrome DevTools → Application → Manifest & Service Workers

### Production (Vercel)
1. Deploy ke Vercel
2. Buka di mobile browser (Chrome/Safari)
3. Klik "Add to Home Screen"

---

## 🎨 Customization

### Icons Required:
- `/public/icon-192.png` (192x192)
- `/public/icon-512.png` (512x512)
- `/public/apple-icon.png` (180x180)
- `/public/favicon.ico`

### Screenshots (optional):
- `/public/screenshot-mobile.png` (540x720)
- `/public/screenshot-desktop.png` (1280x720)

### Theme Colors:
- Primary: `#10b981` (green)
- Background: `#ffffff`

---

## 🔧 Configuration Files

### `manifest.json`
- App name, description, icons
- Display mode (standalone)
- Theme colors
- Shortcuts

### `next.config.js`
- PWA wrapper dengan next-pwa
- Runtime caching strategies
- Disable di development mode

### `layout.tsx`
- Metadata untuk PWA
- Apple Web App capable
- Viewport settings

---

## 📊 Caching Strategies

1. **CacheFirst** - Font files, audio, video
2. **StaleWhileRevalidate** - Images, CSS, JS
3. **NetworkFirst** - HTML pages, JSON data, API calls
4. **NetworkOnly** - `/api/*` endpoints

---

## 🚀 Benefits

✅ **Faster loading** - Assets cached locally
✅ **Offline access** - Core features work offline
✅ **Native feel** - Fullscreen, no browser UI
✅ **SEO friendly** - robots.txt included
✅ **Auto-update** - Service worker updates automatically

---

## ⚠️ Notes

- PWA disabled di development mode
- Service worker hanya aktif di HTTPS/localhost
- iOS Safari support terbatas (no push notifications)
- Clear cache: DevTools → Application → Clear Storage

---

## 🎯 Next Steps

1. ✅ Setup completed
2. 📸 Add icon files (icon-192.png, icon-512.png, apple-icon.png)
3. 📸 Add screenshot files (optional)
4. 🚀 Deploy & test di mobile device
5. 🔔 (Optional) Add push notifications

---

Enjoy your Progressive Web App! 🎉
