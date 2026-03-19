# VetNotes: Open Source Clinical Documentation for Veterinarians

> **Your Records. Your Control.**
> 
> *VetNotes is a free, open-source tool designed to help veterinary clinicians create high-quality medical records without being locked into proprietary systems.*

---

## 🐾 What is VetNotes?

In modern veterinary practice, we often rely on Corporate Practice Management Systems (PMS/ERP) that we don't truly control. **VetNotes** changes that. It provides an independent, professional-grade interface for recording consultations and generating structured SOAP notes.

Whether you're a solo practitioner or part of a large clinic, VetNotes ensures your clinical reasoning and data belong to **you**.

---

## ✨ Key Features

- **Open Source:** Transparent, auditable, and free forever. No "data hostage" situations.
- **Privacy-First:** Audio never leaves your device. Transcription and PII (Personally Identifiable Information) scrubbing happen locally.
- **AIVA Integration:** Leverages clinical intelligence to turn raw speech into professional medical notes.
- **Clinical Structure:** Automatically organizes your consultation into S-O-A-P format with optional POMR structure.
- **Portable Formats:** Export your notes in standard formats that can be pasted into any PMS (ezyVet, RxWorks, Neo, etc.).

---

## 🚀 Getting Started (Simple Steps for Vets)

You don't need to be a programmer to use VetNotes.

### Option 1: Use the Web App (Easiest)
Simply visit [**vetnotes.me**](https://vetnotes.me) in your browser. 
1. Click the microphone icon.
2. Record your consultation.
3. Review your structured SOAP note.
4. Copy and paste into your medical record system.

### Option 2: Desktop Integration (Advanced)
For clinicians requiring direct PIMS synchronization and offline capabilities, we recommend the professional clinical core.

---

## 🛠 For Technical Users (Developers)

If you'd like to run your own instance or contribute to the project:

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/midnightnow/vetnotes-web.git

# 2. Enter the directory
cd vetnotes-web

# 3. Install dependencies
npm install

# 4. Start the app locally
npm run dev
```
Open your browser to `http://localhost:5173`.

---

## 📈 Professional Clinical Ecosystem

VetNotes Web is the entry-level open-source core. For clinicians requiring enterprise-grade solutions, the ecosystem provides:

- **Advanced Automation:** Direct PIMS synchronization and batch processing.
- **Enterprise Support:** Managed deployments and custom clinical templates.
- **Premium Intelligence:** Cloud-based transcription for high-volume environments.

---

## 📜 The .vet Standard

We are establishing the `.vet` file format as an open-source standard for veterinary clinical data exchange. By using a common, open format, we enable a future where veterinary software works together seamlessly while keeping the clinician at the center of the data ecosystem.

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

*Built with ❤️ by the Clinical AI community.*
