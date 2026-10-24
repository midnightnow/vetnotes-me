# VetNotes

VetNotes is a consult scribe for veterinarians. You talk through the consult, and VetNotes drafts a
SOAP note for you to review, then copy into your practice system or export as a `.vet` file.
The code is open source (MIT). The hosted app runs at **[vetnotes.me](https://vetnotes.me)**.

---

## Plans (as sold on vetnotes.me/pricing)

| Plan | Price | What you get |
|------|-------|--------------|
| **VetNotes Scribe** | Free during beta | Voice capture, the SOAP note editor, patient record pages. Notes are structured locally with keyword rules. |
| **VetNotes Basic** | A$10/mo (30-day free trial) | Cloud SOAP structuring from voice, extended templates. |
| **VetNotes Pro** | A$49/mo | Cloud SOAP structuring, charge detection on every consult, advanced templates, sync to VetSorcery. |
| **CPD Academy** | Free cases; paid certification not yet on sale | Clinical cases with scoring and a self-directed study record. **Not accredited CPD.** |
| **[VetSorcery](https://vetsorcery.com)** | From A$199/mo for the first vet, A$100 per additional vet | The full practice-management system. VetNotes Pro is included. |

"Sync to your practice system" means **VetSorcery**. There is no direct integration with ezyVet,
RxWorks, IDEXX Neo or other PMS. For those, copy the note across.

---

## How your data is handled (accurately)

- **Speech-to-text** uses the browser's Web Speech API. In Chrome and Edge the browser sends the
  audio to its vendor's speech service (Google or Microsoft). It is **not** transcribed on your
  device, and VetNotes cannot redact it before that happens.
- **PII redaction** (`src/lib/utils/redactor.ts`) runs in the browser on the *transcript text*,
  scrubbing client names, phone numbers and addresses before the text is sent for cloud structuring.
- **Cloud SOAP structuring** (Basic/Pro) sends the redacted transcript to the VetNotes server
  (`/api/soap/structure`), which calls Google Vertex AI (Gemini). No AI key is shipped in the browser.
- **Local structuring** (free tier, or whenever the cloud path is unavailable) uses keyword rules in
  the browser. The status line says which path produced the note.
- **Signed-in data** (notes sync, CPD records, entitlements) is stored in Google Cloud Firestore.

---

## Quick start (self-hosted / development)

```bash
git clone https://github.com/midnightnow/vetnotes-me.git
cd vetnotes-me
npm install
npm run dev     # http://localhost:3000
npm test
```

Cloud structuring and payments need server configuration and Google Cloud credentials (see
[DEPLOYMENT.md](DEPLOYMENT.md)). Without them, the app runs with local structuring only.

---

## The .vet format

VetNotes can export a note as a `.vet` file, a JSON format for veterinary clinical records, so notes
are portable.

---

## CPD Academy

Module 1, *The AIVA Practice Audit*, is seeded when the application starts: the audit case, the
private reveal document and the CPD session. The session links to its cases through `case_ids`. The
route `/cpd/[moduleId]` loads the session from `cpd_sessions` and its cases from `cpd_cases`.

Completing a module records self-directed study time (Module 1: 0.5 hours). This is a personal
record, **not an accredited CPD award**. No accreditation is held with any veterinary board.

---

## Deploying

See [DEPLOYMENT.md](DEPLOYMENT.md). In short: vetnotes.me is Cloud Run `vetnotes-cpd-ssr`, deployed
with `npm run deploy:ssr` from a clean checkout of `main`.

## Contributing

PRs welcome. Please open an issue before major changes.

## License

MIT License — use, modify, and distribute freely.
