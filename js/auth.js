// auth.js - Manajemen Autentikasi dan Session untuk Sistem Kurban
// Menggunakan API_BASE_URL dari config.js (dimuat sebelumnya)

// ======================= KONSTANTA =======================
const STORAGE_TOKEN_KEY = 'kurban_token';
const STORAGE_USER_KEY = 'kurban_user';

// ======================= CEK DEPENDENSI =======================
if (typeof API_BASE_URL === 'undefined') {
    console.error('ERROR: API_BASE_URL tidak didefinisikan. Pastikan config.js dimuat sebelum auth.js');
} else {
    console.log('Auth.js: API_BASE_URL tersedia');
}

// ======================= FUNGSI DASAR =======================
function getToken() {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
}

function setAuth(token, userData) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
}

function clearAuth() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
}

function getUser() {
    const userStr = localStorage.getItem(STORAGE_USER_KEY);
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        console.error('Gagal parse user data:', e);
        return null;
    }
}

function isLoggedIn() {
    return getToken() !== null && getUser() !== null;
}

// ======================= LOGIN & LOGOUT =======================
async function login(username, password) {
    if (!API_BASE_URL) {
        console.error('API_BASE_URL tidak diset');
        return { success: false, message: 'Konfigurasi API belum benar. Hubungi administrator.' };
    }
    
    try {
        const url = `${API_BASE_URL}?action=login`;
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        
        const response = await fetch(url, { method: 'POST', body: formData });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            setAuth(result.token, {
                username: username,
                role: result.role,
                rt: result.rt || null
            });
            return { success: true, role: result.role, rt: result.rt };
        } else {
            return { success: false, message: result.message || 'Login gagal' };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Tidak dapat terhubung ke server. Periksa koneksi dan URL API.' };
    }
}

async function logout() {
    const token = getToken();
    if (token && API_BASE_URL) {
        try {
            const url = `${API_BASE_URL}?action=logout`;
            const formData = new FormData();
            formData.append('token', token);
            await fetch(url, { method: 'POST', body: formData });
        } catch(e) {
            console.warn('Logout server error:', e);
        }
    }
    clearAuth();
    // Redirect ke halaman publik (landing page)
    window.location.href = 'index.html';
}

// ======================= VALIDASI & REFRESH =======================
async function validateToken() {
    const token = getToken();
    if (!token || !API_BASE_URL) return false;
    try {
        const url = `${API_BASE_URL}?action=validateToken`;
        const formData = new FormData();
        formData.append('token', token);
        const response = await fetch(url, { method: 'POST', body: formData });
        const result = await response.json();
        return result.status === 'success';
    } catch (error) {
        return false;
    }
}

async function refreshToken() {
    const token = getToken();
    if (!token || !API_BASE_URL) return false;
    try {
        const url = `${API_BASE_URL}?action=refreshToken`;
        const formData = new FormData();
        formData.append('token', token);
        const response = await fetch(url, { method: 'POST', body: formData });
        const result = await response.json();
        if (result.status === 'success' && result.newToken) {
            const user = getUser();
            setAuth(result.newToken, user);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// ======================= MIDDLEWARE =======================
function requireAuth(allowedRoles = []) {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';   // Redirect ke landing publik jika belum login
        return false;
    }
    
    const user = getUser();
    if (!user) {
        window.location.href = 'index.html';
        return false;
    }
    
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Jika role tidak diizinkan, redirect ke halaman yang sesuai
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (user.role === 'rt') {
            window.location.href = 'rt.html';
        } else {
            window.location.href = 'index.html';
        }
        return false;
    }
    return true;
}

// ======================= AUTO REFRESH TOKEN =======================
if (typeof window !== 'undefined') {
    setInterval(async () => {
        if (isLoggedIn() && API_BASE_URL) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                // Jika refresh gagal, logout otomatis (akan redirect ke index.html)
                console.warn('Token refresh failed, logging out...');
                clearAuth();
                window.location.href = 'index.html';
            }
        }
    }, 50 * 60 * 1000); // 50 menit
}

// ======================= EKSPOR GLOBAL =======================
// Semua fungsi sudah tersedia global