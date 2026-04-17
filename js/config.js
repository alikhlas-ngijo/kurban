// config.js - Konfigurasi Global Sistem Kurban Masjid Al-Ikhlas

// ==================== WAJIB DIISI ====================
// Ganti URL di bawah dengan URL Web App dari Apps Script Anda
// Contoh: 'https://script.google.com/macros/s/AKfycbwXYZ123456789/exec'
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzUEK3iLbos5PvYffPx3Ym2d3In1u9M6einolEizkTqX7rh9k9R9XP3eH2X4fVPeOXR/exec';

// ==================== VALIDASI (Tanpa Alert Mengganggu) ====================
// Hanya log ke console, tidak menampilkan alert ke user
if (!API_BASE_URL || API_BASE_URL.includes('YOUR_SCRIPT_ID') || API_BASE_URL === 'https://script.google.com/macros/s/AKfycbyxeIOXLb5.../exec') {
    console.error('❌ API_BASE_URL belum diisi dengan benar. Ganti dengan URL Web App asli Anda.');
    // Tidak ada alert() agar tidak mengganggu proses login
} else {
    console.log('✅ API_BASE_URL sudah dikonfigurasi:', API_BASE_URL.substring(0, 50) + '...');
}

// ==================== KONFIGURASI TAMBAHAN ====================
const APP_CONFIG = {
    APP_NAME: 'Sistem Kurban Masjid Al-Ikhlas',
    APP_VERSION: '2.0.0',
    SESSION_TIMEOUT: 3600000, // 1 jam
    AUTO_REFRESH_INTERVAL: 50 * 60 * 1000 // 50 menit
};

// Tidak ada alert() atau prompt() yang mengganggu
console.log(`${APP_CONFIG.APP_NAME} v${APP_CONFIG.APP_VERSION} siap digunakan`);