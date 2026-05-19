// ============================================================
// FIREBASE CONFIGURATION
// Replace with your actual Firebase project config
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA280RE5lycIE-MVxMvzWdb__Lwa0OzNBg",
  authDomain: "geoexam-portal.firebaseapp.com",
  projectId: "geoexam-portal",
  storageBucket: "geoexam-portal.firebasestorage.app",
  messagingSenderId: "203992322500",
  appId: "1:203992322500:web:e21f36d5c3f71c46715491",
  measurementId: "G-GM07Z8LPVH"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ============================================================
// GLOBAL UTILITIES
// ============================================================
const Utils = {
  // Show toast notification
  toast(msg, type = 'info', duration = 3500) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    document.getElementById('toast-container')?.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration);
  },

  // Format time MM:SS
  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  // Generate unique ID
  uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2); },

  // Deep clone
  clone(obj) { return JSON.parse(JSON.stringify(obj)); },

  // Check if admin
  async isAdmin(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists && doc.data().role === 'admin';
  }
};
