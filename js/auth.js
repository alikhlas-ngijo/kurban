// auth.js - Manajemen Autentikasi dan Session
// Menggunakan API_BASE_URL dari config.js

const STORAGE_TOKEN_KEY = 'kurban_token';
const STORAGE_USER_KEY = 'kurban_user';

function getToken() {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
}

function setAuth(token, userData) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
    console.log('setAuth - token:', token.substring(0,20)+'...', 'userData:', userData);
}

function clearAuth() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    console.log('clearAuth - localStorage cleared');
}

function getUser() {
    const userStr = localStorage.getItem(STORAGE_USER_KEY);
    if (!userStr) return null;
    try {
        const user = JSON.parse(userStr);
        console.log('getUser - parsed:', user);
        return user;
    } catch (e) {
        console.error('Gagal parse user data:', e);
        return null;
    }
}

function isLoggedIn() {
    const loggedIn = getToken() !== null && getUser() !== null;
    console.log('isLoggedIn:', loggedIn);
    return loggedIn;
}

async function login(username, password) {
    if (!API_BASE_URL) {
        console.error('API_BASE_URL tidak diset');
        return { success: false, message: 'API_BASE_URL tidak diset.' };
    }
    try {
        const url = `${API_BASE_URL}?action=login`;
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        console.log('Login request to:', url);
        const response = await fetch(url, { method: 'POST', body: formData });
        console.log('Login response status:', response.status);
        
        const result = await response.json();
        console.log('Login response JSON:', result);

        if (result.status === 'success') {
            // Normalisasi role (pastikan lowercase)
            let role = (result.role || '').toLowerCase();
            let rt = result.rt ? String(result.rt) : null;
            
            console.log('Normalized role:', role, 'rt:', rt);
            
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
        console.error('Login error:', error);
        return { success: false, message: 'Tidak dapat terhubung ke server.' };
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
    window.location.href = 'index.html';
}

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

function requireAuth(allowedRoles = []) {
    console.log('requireAuth called, allowedRoles:', allowedRoles);
    if (!isLoggedIn()) {
        console.log('Not logged in, redirect to index.html');
        window.location.href = 'index.html';
        return false;
    }
    const user = getUser();
    if (!user) {
        console.log('User data missing, redirect to index.html');
        window.location.href = 'index.html';
        return false;
    }
    console.log('Current user role:', user.role);
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        console.log('Role not allowed, redirecting based on role:', user.role);
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

// Auto refresh token setiap 50 menit
if (typeof window !== 'undefined') {
    setInterval(async () => {
        if (isLoggedIn() && API_BASE_URL) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                console.warn('Token refresh failed, logging out...');
                clearAuth();
                window.location.href = 'index.html';
            }
        }
    }, 50 * 60 * 1000);
}

console.log('✅ auth.js loaded');