// api.js - Wrapper untuk komunikasi dengan backend Apps Script
// Menggunakan API_BASE_URL dari config.js

// ======================= CEK DEPENDENSI =======================
if (typeof API_BASE_URL === 'undefined') {
    console.error('ERROR: API_BASE_URL tidak didefinisikan. Pastikan config.js dimuat sebelum api.js');
}

// ======================= FUNGSI DASAR =======================
function getAuthToken() {
    return localStorage.getItem('kurban_token');
}

/**
 * Melakukan request ke backend Apps Script
 * @param {string} action - Nama action (sesuai switch di doPost)
 * @param {Object} params - Parameter yang akan dikirim
 * @param {boolean} needAuth - Apakah perlu menyertakan token (default true)
 * @returns {Promise<Object>} - Response JSON
 */
async function apiCall(action, params = {}, needAuth = true) {
    try {
        if (!API_BASE_URL) {
            throw new Error('API_BASE_URL tidak diset. Periksa config.js');
        }

        const url = `${API_BASE_URL}?action=${action}`;
        const formData = new FormData();
        
        if (needAuth) {
            const token = getAuthToken();
            if (!token) {
                throw new Error('Token tidak ditemukan. Silakan login ulang.');
            }
            formData.append('token', token);
            console.log(`🔐 [${action}] Token sent: ${token.substring(0, 20)}...`);
        }
        
        // Tambahkan parameter – konversi semua ke string untuk menghindari error 400
        for (const key in params) {
            if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null) {
                let value = params[key];
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                } else {
                    value = String(value); // Pastikan string
                }
                formData.append(key, value);
                console.log(`📦 [${action}] Param ${key}:`, value.substring(0, 50));
            }
        }
        
        console.log(`🚀 [${action}] Sending POST request to: ${url}`);
        
        const response = await fetch(url, { 
            method: 'POST', 
            body: formData,
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow'   // Penting untuk mengikuti redirect Google
        });
        
        console.log(`📡 [${action}] Response status: ${response.status}`);
        
        // Baca response sebagai text
        let responseText = await response.text();
        console.log(`📄 [${action}] Raw response (first 300 chars): ${responseText.substring(0, 300)}`);
        
        // Cek apakah respons adalah HTML (error atau redirect)
        if (responseText.trim().startsWith('<!DOCTYPE') || 
            responseText.trim().startsWith('<html') || 
            responseText.includes('<HTML>')) {
            console.error(`❌ [${action}] Server returned HTML.`);
            let errorMsg = 'Server mengembalikan halaman HTML. Pastikan Web App dideploy dengan akses "Anyone" (bukan "Anyone with link").';
            if (responseText.includes('Moved Temporarily') || responseText.includes('Redirect')) {
                errorMsg = 'Redirect terjadi. Coba deploy ulang Web App dan pastikan akses "Anyone".';
            }
            throw new Error(errorMsg);
        }
        
        // Hapus prefix keamanan Google Apps Script: )]}'
        let cleanText = responseText;
        if (cleanText.startsWith(')]}')) {
            cleanText = cleanText.substring(3);
            console.log(`🔧 [${action}] Removed Google security prefix`);
        }
        
        // Parse JSON
        let result;
        try {
            result = JSON.parse(cleanText);
        } catch (e) {
            console.error(`❌ [${action}] JSON parse error:`, cleanText);
            throw new Error('Respons tidak valid dari server (bukan JSON)');
        }
        
        // Jika session expired, panggil logout jika tersedia
        if (result.status === 'error' && (result.message === 'Session invalid' || result.message === 'Unauthorized')) {
            console.warn('⚠️ Session expired, logging out...');
            if (typeof logout !== 'undefined') {
                await logout();
            } else {
                localStorage.removeItem('kurban_token');
                localStorage.removeItem('kurban_user');
                window.location.href = 'index.html';
            }
            throw new Error('Sesi habis, silakan login kembali');
        }
        
        console.log(`✅ [${action}] Success:`, result.status);
        return result;
    } catch (error) {
        console.error(`❌ API Error [${action}]:`, error);
        let message = error.message;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            message = '⛔ Gagal terhubung ke server. CORS terblokir. Pastikan Web App dideploy dengan akses "Anyone" dan gunakan Live Server atau hosting HTTPS.';
        }
        if (error.message.includes('Redirect') || error.message.includes('HTML')) {
            message = '❌ Server mengembalikan redirect. Pastikan Web App dideploy dengan benar dan akses "Anyone" (bukan "Anyone with link").';
        }
        return { status: 'error', message: message };
    }
}

/**
 * Panggilan API publik (tanpa token)
 */
async function apiPublic(action, params = {}) {
    return apiCall(action, params, false);
}

// ======================= WRAPPER FUNGSI SPESIFIK =======================

// Dashboard
async function getDashboard() {
    return apiCall('getDashboard');
}

// Pendaftar (menunggu konfirmasi) - khusus admin
async function getPendaftar() {
    return apiCall('getPendaftar');
}

// Pekurban (sudah lunas) - khusus admin
async function getPekurban() {
    return apiCall('getPekurban');
}

// Konfirmasi pembayaran
async function confirmPembayaran(id) {
    return apiCall('confirmPembayaran', { id });
}

// Hewan CRUD
async function getHewan() {
    return apiCall('getHewan');
}

async function addHewan(data) {
    return apiCall('addHewan', data);
}

async function updateHewan(data) {
    return apiCall('updateHewan', data);
}

async function deleteHewan(id) {
    return apiCall('deleteHewan', { id });
}

// Distribusi
async function getDistribusi() {
    return apiCall('getDistribusi');
}

async function updateChecklist(idDistribusi, checklistJson, status) {
    return apiCall('updateChecklist', { idDistribusi, checklistJson, status });
}

async function initDistribusiAll() {
    return apiCall('initDistribusiAll');
}

// Penerima RT
async function getPenerimaRT(rt) {
    if (!rt) {
        console.error('getPenerimaRT: parameter rt wajib diisi');
        return { status: 'error', message: 'Parameter RT tidak boleh kosong' };
    }
    // Pastikan rt dikirim sebagai string
    return apiCall('getPenerimaRT', { rt: String(rt) });
}

async function getAllPenerima() {
    return apiCall('getAllPenerima');
}

async function addPenerima(nama, rt, alamat) {
    // Jika rt tidak disediakan, backend akan mengambil dari token
    const payload = { nama, alamat };
    if (rt) payload.rt = String(rt);
    return apiCall('addPenerima', payload);
}

async function updatePenerima(data) {
    // Pastikan id dan field lainnya sudah termasuk, rt opsional
    if (data.rt) data.rt = String(data.rt);
    return apiCall('updatePenerima', data);
}

async function deletePenerima(id) {
    return apiCall('deletePenerima', { id });
}

async function importPenerimaCSV(rt, csvData) {
    return apiCall('importPenerimaCSV', { rt: String(rt), csvData });
}

// Laporan
async function getLaporan() {
    return apiCall('getLaporan');
}

// Kelompok Sapi
async function getKelompokSapi() {
    return apiCall('getKelompokSapi');
}

async function getAnggotaKelompok(kelompok) {
    return apiCall('getAnggotaKelompok', { kelompok });
}

// ======================= EKSPOR GLOBAL =======================
window.getDashboard = getDashboard;
window.getPendaftar = getPendaftar;
window.getPekurban = getPekurban;
window.confirmPembayaran = confirmPembayaran;
window.getHewan = getHewan;
window.addHewan = addHewan;
window.updateHewan = updateHewan;
window.deleteHewan = deleteHewan;
window.getDistribusi = getDistribusi;
window.updateChecklist = updateChecklist;
window.initDistribusiAll = initDistribusiAll;
window.getPenerimaRT = getPenerimaRT;
window.getAllPenerima = getAllPenerima;
window.addPenerima = addPenerima;
window.updatePenerima = updatePenerima;
window.deletePenerima = deletePenerima;
window.importPenerimaCSV = importPenerimaCSV;
window.getLaporan = getLaporan;
window.getKelompokSapi = getKelompokSapi;
window.getAnggotaKelompok = getAnggotaKelompok;
window.apiCall = apiCall;
window.apiPublic = apiPublic;
window.getAuthToken = getAuthToken;

console.log('✅ api.js loaded (dengan perbaikan CORS dan konversi string)');