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
        
        // Tambahkan parameter (jangan ubah tipe data jika tidak perlu)
        for (const key in params) {
            if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null) {
                let value = params[key];
                // Jika value adalah object, stringify
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                formData.append(key, value);
                console.log(`📦 [${action}] Param ${key}:`, typeof value === 'string' ? value.substring(0, 50) : value);
            }
        }
        
        console.log(`🚀 [${action}] Sending request to: ${url}`);
        
        const response = await fetch(url, { 
            method: 'POST', 
            body: formData,
            mode: 'cors',
            credentials: 'omit'
        });
        
        // Baca response sebagai text terlebih dahulu
        let responseText = await response.text();
        console.log(`📡 [${action}] Response status: ${response.status}`);
        console.log(`📄 [${action}] Raw response (first 200 chars): ${responseText.substring(0, 200)}`);
        
        // Cek apakah respons adalah HTML (biasanya error 400/500 dari Apps Script)
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            console.error(`❌ [${action}] Server returned HTML error page`);
            throw new Error('Server mengembalikan halaman error. Periksa kembali URL Web App atau deploy ulang.');
        }
        
        // Hapus prefix keamanan Google Apps Script: )]}'
        let cleanText = responseText;
        if (cleanText.startsWith(')]}')) {
            cleanText = cleanText.substring(3);
            console.log(`🔧 [${action}] Removed Google security prefix`);
        }
        
        // Coba parse JSON
        let result;
        try {
            result = JSON.parse(cleanText);
        } catch (e) {
            console.error(`❌ [${action}] JSON parse error:`, cleanText);
            // Jika tidak bisa parse, coba ekstrak pesan error dari response text
            let errorMsg = 'Respons tidak valid dari server (bukan JSON)';
            if (cleanText.includes('"error"')) {
                const match = cleanText.match(/"error":"([^"]+)"/);
                if (match) errorMsg = match[1];
            } else if (cleanText.includes('"message"')) {
                const match = cleanText.match(/"message":"([^"]+)"/);
                if (match) errorMsg = match[1];
            }
            throw new Error(errorMsg);
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
            message = '⛔ Gagal terhubung ke server. CORS terblokir. Solusi: Jalankan Chrome dengan --disable-web-security (lihat petunjuk di console).';
        }
        if (error.message.includes('HTTP 400')) {
            message = '❌ Error 400: Request tidak valid. Cek parameter atau token.';
        }
        if (error.message.includes('halaman error')) {
            message = '❌ Server error (400/500). Pastikan Web App sudah dideploy dengan benar dan akses "Anyone".';
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
    return apiCall('addPenerima', { nama, rt: String(rt), alamat });
}

async function updatePenerima(data) {
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

console.log('✅ api.js loaded');