# 🪨 GeoExam Portal — GATE Geology CBT Platform

A complete **Computer-Based Test (CBT) portal** modelled on the NTA JEE interface, built for **GATE Geology** preparation. Includes a full admin panel, question bank with PDF bulk-upload, JEE-style exam window, detailed analytics, ranklist, and 50+ seeded GATE Geology PYQs (2017–2024).

---

## 💰 100% Free — No Firebase Storage Used

Images are handled in two free ways:
1. **Upload JPEG/PNG** → automatically resized and converted to base64, stored directly inside the Firestore document (no Storage bucket needed)
2. **Paste an image URL** → any publicly hosted image URL (Google Drive, Imgur, your own host) is stored as a string

**Firestore free tier limits** (Spark plan — always free):
| Resource | Free limit |
|----------|-----------|
| Stored data | 1 GiB |
| Document reads | 50,000 / day |
| Document writes | 20,000 / day |
| Document deletes | 20,000 / day |
| Network egress | 10 GiB / month |

> 💡 **Image size tip:** Each Firestore document is limited to **1 MB**. The portal auto-resizes uploaded images to max 900×900px at 82% JPEG quality, which typically produces files of 50–150 KB — well within limits. For very large diagrams, use the **URL** option instead (host the image on Imgur or Google Drive).

---

```
exam-portal/
├── index.html                  ← Login / Sign-up page
├── 404.html                    ← Error page
├── firestore.rules             ← Firestore security rules (paste into Firebase Console)
├── firestore.indexes.json      ← Required composite indexes
├── css/
│   └── global.css              ← All shared styles
├── js/
│   └── firebase-config.js      ← Firebase init + Utils (EDIT THIS FIRST)
├── pages/                      ← Student-facing pages
│   ├── dashboard.html          ← Student home, available exams, recent attempts
│   ├── exam-instructions.html  ← Pre-exam instructions (JEE style)
│   ├── exam.html               ← MAIN EXAM WINDOW (timer, palette, calculator)
│   ├── result.html             ← Detailed score analysis + question review
│   ├── my-results.html         ← All past attempts with filters
│   └── ranklist.html           ← Per-exam ranklist with top-3 podium
└── admin/
    ├── index.html              ← Admin dashboard (sidebar nav)
    ├── seed-pyq.html           ← One-click GATE Geology PYQ seeder
    └── js/
        └── admin.js            ← All admin logic
```

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → give it a name (e.g. `geoexam-portal`) → Continue
3. Enable/disable Google Analytics as you prefer → **Create project**

---

### Step 2 — Enable Firebase Services

Inside your Firebase project:

#### Authentication
1. Left sidebar → **Build → Authentication**
2. Click **"Get started"**
3. Enable **Email/Password** provider → Save

#### Firestore Database
1. Left sidebar → **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **Production mode** → Select your region → Done

> ✅ That's all you need! **No Storage setup required** — images are stored free inside Firestore.

---

### Step 3 — Get Your Firebase Config

1. In Firebase Console → **Project Settings** (gear icon ⚙️ top-left)
2. Scroll to **"Your apps"** → Click **"</> Web"**
3. Register the app (give it a nickname) → Copy the `firebaseConfig` object

Open `js/firebase-config.js` and **replace** the placeholder values:

```javascript
const firebaseConfig = {
  apiKey:            "YOUR_ACTUAL_API_KEY",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
  // No storageBucket — Storage is NOT used (keeps it free!)
};
```

---

### Step 4 — Apply Firestore Security Rules

1. Firebase Console → **Firestore Database → Rules tab**
2. **Delete** the default rules
3. Open `firestore.rules` from this project
4. **Paste** the entire contents into the Rules editor
5. Click **"Publish"**

Then apply Storage rules:
1. Firebase Console → **Storage → Rules tab**
2. Paste the Storage rules section from `firestore.rules` (the commented-out block at the bottom)
3. Click **"Publish"**

---

### Step 5 — Create Composite Indexes

Firebase requires composite indexes for multi-field queries. You have two options:

**Option A — Manual (Recommended)**
1. Firebase Console → **Firestore → Indexes tab**
2. Create each index from `firestore.indexes.json`:
   - `attempts`: userId ASC + status ASC + submittedAt DESC
   - `attempts`: userId ASC + examId ASC + status ASC
   - `attempts`: examId ASC + status ASC + totalScore DESC
   - `exams`:    published ASC + createdAt DESC
   - `questions`: type ASC + createdAt DESC

**Option B — Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project
# copy firestore.indexes.json to project root
firebase deploy --only firestore:indexes
```

---

### Step 6 — Create the First Admin Account

1. Open `index.html` in your browser (or serve it — see Step 8)
2. Click **Sign Up** and create your account normally
3. Go to **Firebase Console → Firestore → Data**
4. Find the `users` collection → find your user document (the UID)
5. Edit the document → change `role` field from `"student"` to `"admin"`
6. Refresh the portal — you'll now be redirected to the Admin panel

---

### Step 7 — Seed GATE Geology PYQs

1. Log in as Admin → you'll land on the Admin Dashboard
2. Open `admin/seed-pyq.html` directly in browser (or add it as a nav link)
3. Click **"🚀 Seed Questions"**
4. Wait for all 50+ PYQs (2017–2024) to be uploaded to Firestore
5. The seeder skips duplicates if run again

---

### Step 8 — Serving the Portal

#### Local Development (quickest)
```bash
# Using Python (no install needed)
cd exam-portal
python3 -m http.server 8080
# Open: http://localhost:8080
```

#### Using Live Server (VS Code)
- Install the **Live Server** extension in VS Code
- Right-click `index.html` → "Open with Live Server"

#### Production Deployment — Firebase Hosting (Recommended)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: . (current)
# Single page app: No
# Overwrite index.html: No
firebase deploy
```

#### Other Static Hosts
Upload the entire `exam-portal/` folder to:
- **Netlify** — drag & drop at netlify.com/drop
- **Vercel** — `vercel --prod`
- **GitHub Pages** — push to gh-pages branch

---

## 🎓 Admin Portal Guide

### Adding Questions

| Method | How |
|--------|-----|
| **Single Question** | Admin → "Add Single Question" → fill form → choose type (SCQ/MCQ/NAT) → mark correct answer(s) → Save |
| **Bulk PDF Upload** | Admin → "Bulk Upload PDF" → drop PDF → system extracts text, auto-detects questions → review each → Save All |
| **PYQ Seeder** | Visit `admin/seed-pyq.html` → click Seed (one-time) |

### Question Types & Marking

| Type | Description | Correct | Wrong | Partial |
|------|-------------|---------|-------|---------|
| **SCQ** | Single Correct | +marks | −neg marks | — |
| **MCQ** | Multiple Correct | +full (all correct) or proportional | −neg (any wrong selected) | +proportional if subset correct |
| **NAT** | Numerical Answer | +marks (within tolerance) | 0 | — |

### Creating an Exam

1. Admin → **"Create Exam"**
2. Fill title, duration, start/end times
3. Add **sections** (e.g. "General Aptitude", "Geology Core")
4. Pick questions from the question picker (search by text, type, year)
5. Assign each question to a section
6. Check "Publish immediately" or leave as Draft
7. Click **Save Exam**

### Managing Questions in an Exam
- Edit any exam → add/remove questions → re-save
- Publish/Unpublish toggle on the Exams list

---

## 🖥️ Exam Window Features

| Feature | Detail |
|---------|--------|
| **JEE-Style Interface** | Section tabs, question palette (colour-coded), timer top-right |
| **Question Palette** | 5 states: Not Visited (grey), Not Answered (red), Answered (green), Marked for Review (purple), Answered+Marked (amber) |
| **Scientific Calculator** | On-screen: +, −, ×, ÷, √, x², log, ln, sign toggle |
| **Auto-Save** | Answers and remaining time saved to Firestore every 15 seconds |
| **Session Resume** | If browser closes, in-progress exam resumes from saved state |
| **Submit Confirmation** | Shows answered/unanswered/marked counts before final submit |
| **Prevent Accidental Close** | `beforeunload` warning if user tries to navigate away |

---

## 📊 Result & Analytics Features

- **Score card** with % and raw score
- **Rank** among all candidates for that exam
- **Percentile** calculation
- **Donut chart** — correct / wrong / partial / skipped
- **Performance bars** — accuracy, score%, correct rate, wrong rate
- **Question-wise review** — filterable by result type; shows your answer vs correct answer + solution

---

## 🔧 Customisation Tips

### Change Exam Branding
Edit the `<nav>` section in any HTML file. The emoji `🪨` and "GeoExam Portal" text appear in the navbar brand.

### Add More PYQ Questions
Open `admin/seed-pyq.html`, scroll to the `GATE_GEOLOGY_PYQs` array, and add more question objects following the same schema:
```javascript
{
  year: '2024',
  type: 'scq',           // 'scq' | 'mcq' | 'nat'
  text: 'Question text here...',
  options: [
    { text: 'Option A' },
    { text: 'Option B' },
    { text: 'Option C' },
    { text: 'Option D' }
  ],
  correctOptions: [1],   // 0-indexed; for MCQ: [0,2,3]
  correctAnswer: null,   // for NAT only: '3.14'
  posMarks: 1,
  negMarks: 0.33,
  tolerance: 0,          // for NAT only
  tags: ['Geology', 'GATE 2024'],
  solution: 'Explanation here...'
}
```

### Change Default Marking Scheme
In `admin/index.html` → "Add Single Question" form, change the default values of `q-pos` (positive marks) and `q-neg` (negative marks) inputs.

---

## ⚠️ Known Limitations & Notes

- **PDF Auto-crop**: The PDF question extractor uses a heuristic text-splitting approach. For best results, ensure your PDF has text-selectable content (not scanned images). After extraction, always review and edit each question before saving.
- **Image Questions**: For questions with diagrams/images, use the "Add Single Question" → image upload field. The image is stored in Firebase Storage.
- **Concurrent Exams**: The portal supports multiple concurrent exams. Students can only submit each exam once.
- **No timer sync**: The countdown timer runs client-side. The remaining seconds are synced to Firestore every 15s. Server-side time enforcement requires a Cloud Function (future enhancement).

---

## 🛠️ Future Enhancements (Roadmap)

- [ ] Cloud Function for server-side exam time enforcement
- [ ] OTP/email verification on signup
- [ ] Bulk question import via Excel/CSV
- [ ] Section-wise negative marking override
- [ ] Student profile with performance trends over time
- [ ] Email notifications for exam results
- [ ] Mobile-responsive exam window
- [ ] Question difficulty tagging and adaptive practice mode

---

## 📞 Support

For Firebase-specific issues, refer to:
- [Firebase Docs](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
