# VetNotes Open Source

> **Like WordPress.org, but for veterinary SOAP notes.**

VetNotes is a free, open-source tool that helps veterinarians create professional medical records without being locked into proprietary systems. Your records, your control.

---

## 🐾 The WordPress Model for VetNotes

| Product | Equivalent | Price | What You Get |
|---------|------------|-------|--------------|
| **vetnotes-me** (GitHub) | **WordPress.org** | **Free** | Self-hosted, DIY, 5 templates, local SOAP, PII redaction, `.vet` export. |
| **[vetnotes.me](https://vetnotes.me)** (Hosted) | **WordPress.com** | **~$10/mo** | Hosted convenience, zero-config, auto-backups, basic support. |
| **[vetnotes.pro](https://vetnotes.pro)** (Premium) | **WordPress VIP** | **~$50/mo** | Full clinical suite, AIVA Voice, Premium Charge Detection, advanced templates, PIMS sync. |
| **VetSorcery** | **Enterprise** | **Custom** | Full PMS/EMR, Inventory, Multi-practice management, Biosecurity (Northern Shield). |

---

## ✨ Open Source Core Features (vetnotes-me)

- **5 Clinical Templates**: Wellness, Sick Visit, Vaccination, Procedure, Admission
- **Local-First**: All processing happens in your browser
- **PII Redaction**: Automatic scrubbing of client names, phone numbers, addresses
- **SOAP + POMR**: Structured notes with Problem-Oriented Medical Record support
- **Export Formats**: Copy/paste into any PMS (ezyVet, RxWorks, Neo)

---

## 🚀 Quick Start (Self-Hosted)

```bash
# Clone the repository
git clone https://github.com/midnightnow/vetnotes-me.git

# Enter directory
cd vetnotes-me

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 💰 Need Hosting or Premium Features?

| If you want... | Go to... |
|----------------|----------|
| Zero-config hosting, automatic updates | **[vetnotes.me](https://vetnotes.me)** ($10/mo) |
| Voice transcription, revenue detection, PIMS sync | **[vetnotes.pro](https://vetnotes.pro)** ($50/mo) |
| Full practice management system | **[VetSorcery](https://vetsorcery.com)** (custom pricing) |

---

## 📜 The .vet Standard

VetNotes uses the `.vet` file format — an open-source standard for veterinary clinical data exchange. Your notes are portable, not trapped.

---
 
## Module 1 CPD Academy Launch Flow
 
Module 1 is titled The AIVA Practice Audit. This module is seeded automatically when the application starts. The seed process ensures that the audit case, the private reveal document, and the CPD session all exist in the database.
 
The session record links to the case via the case_ids field. The page route for a specific module is /cpd/[moduleId]. The server load function queries the cpd_sessions collection for a session where the module_id matches the route parameter. It then loads each linked case from the cpd_cases collection and returns both to the page component. The page renders the session title, the session description, and a list of cases included in the module.
 
To start the module, navigate to /cpd and open the module card. The module is free to access and awards 0.5 CPD hours on successful completion. The cases are listed in sequence order within the module.
 
---
 
## Contributing
 
PRs welcome. Please open an issue before major changes.
 
## ⚖️ License
 
MIT License — use, modify, and distribute freely.
 
---
 
Built with ❤️ by **[AIVET.dev](https://aivet.dev)**
