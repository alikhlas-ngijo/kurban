// auth.js - Manajemen Autentikasi dan Session (Terintegrasi dengan api.js)
// Menggunakan API_BASE_URL dari config.js dan fungsi apiCall/apiPublic dari api.js

const STORAGE_TOKEN_KEY = 'kurban_token';
const STORAGE_USER_KEY = 'kurban_user';

// ======================= FUNGSI DASAR =======================
function getToken() {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
}

function setAuth(token, userData) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
    console.log('✅ setAuth - token:', token.substring(0,20)+'...', 'userData:', userData);
}

function clearAuth() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    console.log('🗑️ clearAuth - localStorage cleared');
}

function getUser() {
    const userStr = localStorage.getItem(STORAGE_USER_KEY);
    if (!userStr) return null;
    try {
        const user = JSON.parse(userStr);
        // Normalisasi role (pastikan lowercase)
        if (user.role) user.role = user.role.toLowerCase();
        return user;
    } catch (e) {
        console.error('Gagal parse user data:', e);
        return null;
    }
}

function isLoggedIn() {
    const loggedIn = getToken() !== null && getUser() !== null;
    console.log('🔍 isLoggedIn:', loggedIn);
    return loggedIn;
}

// ======================= LOGIN (Menggunakan apiPublic untuk fleksibilitas CORS) =======================
async function login(username, password) {
    if (!API_BASE_URL) {
        console.error('API_BASE_URL tidak diset');
        return { success: false, message: 'API_BASE_URL tidak diset. Periksa config.js.' };
    }

    try {
        // Gunakan FormData seperti di apiCall, tapi tanpa token (public)
        const url = `${API_BASE_URL}?action=login`;
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        console.log('📡 Login request ke:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow'
        });

        console.log('📡 Login response status:', response.status);

        // Baca response text untuk debugging
        let responseText = await response.text();
        console.log('📄 Login raw response (first 300 chars):', responseText.substring(0, 300));

        // Cek apakah respons adalah HTML (error CORS atau redirect)
        if (responseText.trim().startsWith('<!DOCTYPE') || 
            responseText.trim().startsWith('<html') || 
            responseText.includes('<HTML>')) {
            console.error('❌ Server returned HTML instead of JSON.');
            let errorMsg = 'Server mengembalikan halaman HTML. Pastikan Web App dideploy dengan akses "Anyone" (bukan "Anyone with link").';
            if (responseText.includes('Moved Temporarily') || responseText.includes('Redirect')) {
                errorMsg = 'Redirect terjadi. Coba deploy ulang Web App dan pastikan akses "Anyone".';
            }
            return { success: false, message: errorMsg };
        }

        // Hapus prefix keamanan Google Apps Script: )]}'
        let cleanText = responseText;
        if (cleanText.startsWith(')]}')) {
            cleanText = cleanText.substring(3);
            console.log('🔧 Removed Google security prefix');
        }

        let result;
        try {
            result = JSON.parse(cleanText);
        } catch (e) {
            console.error('❌ JSON parse error:', cleanText);
            return { success: false, message: 'Respons tidak valid dari server (bukan JSON). Periksa URL Web App.' };
        }

        console.log('📦 Login response JSON:', result);

        if (result.status === 'success') {
            // Normalisasi role dan rt
            let role = (result.role || '').toLowerCase();
            let rt = result.rt ? String(result.rt) : null;
            
            console.log('✅ Login success - role:', role, 'rt:', rt);
            
            setAuth(result.token, {
                username: username,
                role: role,
                rt: rt
            });
            return { success: true, role: role, rt: rt };
        } else {
            return { success: false, message: result.message || 'Login gagal' };
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        let message = 'Tidak dapat terhubung ke server. ';
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            message += 'CORS terblokir. Pastikan Web App dideploy dengan akses "Anyone" (bukan "Anyone with link").';
        } else if (error.message.includes('HTML') || error.message.includes('Redirect')) {
            message += 'Server mengembalikan redirect. Periksa konfigurasi Web App.';
        } else {
            message += error.message;
        }
        return { success: false, message: message };
    }
}

// ======================= LOGOUT =======================
async function logout() {
    const token = getToken();
    if (token && API_BASE_URL) {
        try {
            // Gunakan apiCall jika memungkinkan, tapi hati-hati karena apiCall memerlukan token dan akan gagal jika session invalid
            // Lebih aman pakai fetch langsung
            const url = `${API_BASE_URL}?action=logout`;
            const formData = new FormData();
            formData.append('token', token);
            await fetch(url, { method: 'POST', body: formData, mode: 'cors', credentials: 'omit' });
        } catch(e) {
            console.warn('Logout server error (ignored):', e);
        }
    }
    clearAuth();
    window.location.href = 'index.html';
}

// ======================= VALIDASI TOKEN =======================
async function validateToken() {
    const token = getToken();
    if (!token || !API_BASE_URL) return false;
    try {
        const url = `${API_BASE_URL}?action=validateToken`;
        const formData = new FormData();
        formData.append('token', token);
        const response = await fetch(url, { method: 'POST', body: formData, mode: 'cors' });
        const result = await response.json();
        return result.status === 'success';
    } catch (error) {
        console.warn('validateToken error:', error);
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
        const response = await fetch(url, { method: 'POST', body: formData, mode: 'cors' });
        const result = await response.json();
        if (result.status === 'success' && result.newToken) {
            const user = getUser();
            setAuth(result.newToken, user);
            return true;
        }
        return false;
    } catch (error) {
        console.warn('refreshToken error:', error);
        return false;
    }
}

// ======================= AUTHORIZATION GUARD =======================
function requireAuth(allowedRoles = []) {
    console.log('🛡️ requireAuth called, allowedRoles:', allowedRoles);
    if (!isLoggedIn()) {
        console.log('❌ Not logged in, redirect to index.html');
        window.location.href = 'index.html';
        return false;
    }
    const user = getUser();
    if (!user) {
        console.log('❌ User data missing, redirect to index.html');
        window.location.href = 'index.html';
        return false;
    }
    console.log('👤 Current user role:', user.role);
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        console.log('⛔ Role not allowed, redirecting based on role:', user.role);
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
                console.warn('⚠️ Token refresh failed, logging out...');
                clearAuth();
                window.location.href = 'index.html';
            }
        }
    }, 50 * 60 * 1000); // 50 menit
}

console.log('✅ auth.js loaded (dengan perbaikan CORS dan error handling)');