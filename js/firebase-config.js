// ============================================================
// FIREBASE CONFIGURATION — GeoExam Portal
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyA280RE5lycIE-MVxMvzWdb__Lwa0OzNBg",
  authDomain:        "geoexam-portal.firebaseapp.com",
  projectId:         "geoexam-portal",
  storageBucket:     "geoexam-portal.firebasestorage.app",
  messagingSenderId: "203992322500",
  appId:             "1:203992322500:web:e21f36d5c3f71c46715491",
  measurementId:     "G-GM07Z8LPVH"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Enable Firestore offline persistence (helps with slow connections)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence unavailable (multiple tabs open).');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported in this browser.');
  }
});

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

  // Format time HH:MM:SS
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
    try {
      const doc = await db.collection('users').doc(uid).get();
      return doc.exists && doc.data().role === 'admin';
    } catch(e) {
      console.error('isAdmin check failed:', e);
      return false;
    }
  },

  // Convert a File object to a base64 data URL string (FREE — no Storage needed!)
  // Resizes large images to keep Firestore doc under 1 MB.
  imageToBase64(file, maxPx = 900) {
    return new Promise((resolve, reject) => {
      if (!file) { resolve(''); return; }
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxPx || h > maxPx) {
            const ratio = Math.min(maxPx / w, maxPx / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
};
