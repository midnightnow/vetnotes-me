# VetNotes Deployment Guide

## 🏗️ Architecture Overview

VetNotes Web is a static SvelteKit application designed for high-performance clinical data entry. It is designed to be hosted on Firebase Hosting but can be deployed to any static site host (Vercel, Netlify, GitHub Pages, etc.).

---

## 🚀 Quick Deploy (Firebase)

```bash
cd vetnotes-web

# 1. Build the application
npm run build

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 🔧 Configuration Files

### `.firebaserc`
Contains the mapping of local aliases to Firebase projects.
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

### `firebase.json`
Configuration for Firebase Hosting behavior.
```json
{
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

---

## 📦 Build Process

The build process uses Vite to generate a static production version of the app:
1. `npm run build` – Vite builds the SvelteKit static site into `./build`
2. `firebase deploy` – Pushes the built assets to the hosting provider.

---

## 🌐 Custom Domains

To use your own domain (e.g., `vetnotes.me`):
1. Navigate to Firebase Console → Hosting → Add custom domain.
2. Follow the DNS verification steps.
3. Once verified, Firebase will automatically provision SSL certificates.

---

## 🔐 Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_GEMINI_API_KEY` | `.env` (optional) | Default API key for development |
| `VITE_VETNOTES_API_URL` | `.env` (optional) | Backend API endpoint for PIMS sync |

---

## 📊 Core Features (Open Source)

- **Voice Recording:** Real-time capture of clinical consultations.
- **Web Speech API:** Local transcription of spoken words.
- **PII Redaction:** Automatic scrubbing of sensitive client data.
- **Clinical Structuring:** Rule-based conversion of transcripts to SOAP format.
- **PIMS Integration:** Standardized export for major practice management systems.
- **Offline Capability:** Core functions work without an active internet connection.

---

## 🐛 Troubleshooting

### "Site not found" after deploy
- Ensure the custom domain DNS has propagated.
- Check Firebase Console → Hosting → Domain status.

### Build issues
- Ensure you are running Node.js v18+.
- Verify all dependencies are installed with `npm install`.

---

## 📅 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-19 | Initial Professional Open Source Release |
