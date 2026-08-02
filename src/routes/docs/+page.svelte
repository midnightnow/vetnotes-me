<script lang="ts">
  // Documentation for the whole product family. Every claim here describes
  // behaviour that exists today — where something is beta, unlisted or not
  // built, this page says so rather than implying it works.
  const apps = [
    {
      id: 'scribe',
      name: 'VetNotes Scribe',
      icon: '🩺',
      where: 'vetnotes.me',
      oneLiner: 'Speak the consult, get a structured SOAP note you can edit.',
      status: 'Free during beta',
      quickStart: [
        'Open vetnotes.me — the editor is the home page, no setup.',
        'Sign in with Google to save notes to a patient record. Skip it to try the editor without saving.',
        'Press record and talk through the consult the way you normally would.',
        'Stop recording. The note appears in SOAP sections — read it, correct it, keep it.'
      ],
      extended: [
        {
          h: 'What it actually does',
          p: `The editor captures audio in the browser and turns the transcript into a structured note under the usual headings — subjective, objective, assessment, plan. It is a drafting aid: the note arrives as editable text, not as a signed clinical record. Nothing is filed anywhere until you save it against a patient.`
        },
        {
          h: 'Working with patient records',
          p: `Signed-in users get patient pages at /patient/{slug}, where saved notes accumulate in date order. The patient record is the unit of history — open the animal, see every consult note written for it. Notes saved without a patient stay loose in the editor session and are lost on reload, which is deliberate: unattached clinical text should not persist quietly.`
        },
        {
          h: 'Dictation habits that work',
          p: `Speak in the order you want the note to read, and say the section aloud when you switch ("assessment: …"). Say numbers with units. If the room is noisy, pause rather than raise your voice — the transcript degrades much faster with competing speech than with silence. Re-record a section rather than fighting a bad transcript; correction is cheap, transcription of a mess is not.`
        },
        {
          h: 'What it does not do',
          p: `It does not bill, book, or send anything. It does not sign your notes or claim regulatory compliance. It has no offline mode in the browser — a dropped connection during recording loses that recording. Treat every generated note as a draft you are professionally responsible for reading.`
        }
      ]
    },
    {
      id: 'practice',
      name: 'VetSorcery Practice OS',
      icon: '🏥',
      where: 'vetsorcery.com',
      oneLiner: 'The clinic system: appointments, patients, billing, dental, drug register.',
      status: 'Paid plans, live',
      quickStart: [
        'Open vetsorcery.com/demo — a full seeded clinic, no login, nothing to install.',
        'Walk the board: pick an appointment, open the consult, write a plan.',
        'Stage the bill straight from that plan — the charges follow the clinical decisions.',
        'When you want a real clinic, see vetsorcery.com/plans and sign up there.'
      ],
      extended: [
        {
          h: 'The daily loop',
          p: `The board is the home surface — today's appointments as columns by state, so the clinic can see at a glance who is waiting, in-consult, or ready to discharge. Opening an appointment gives the consult view: patient history on one side, the note you are writing on the other. Finishing a consult moves the animal along the board and leaves the note attached to the patient permanently.`
        },
        {
          h: 'Billing follows the clinical plan',
          p: `Charges are staged from what you actually planned, rather than typed again into a separate invoice screen. Write the plan, confirm the line items it implies, adjust, then take payment. This is the part most practice software gets wrong by making billing a second, forgetful data-entry pass — the whole point is that the clinical record is the source.`
        },
        {
          h: 'Dental charting and the S8 register',
          p: `Dental work is charted on a species-correct odontogram — canine, feline and equine morphologies are distinct, not one chart relabelled. Controlled drugs are recorded in an S8 register with a fail-closed gate: if the register cannot be written, the workflow stops rather than proceeding silently. Both exist because they are the parts of practice where a sloppy record is a legal problem, not just an inconvenience.`
        },
        {
          h: 'Referrals and imaging',
          p: `Cases can be routed to specialists through the referral loop, and imaging studies attach to the patient record. Imaging has its own dedicated app (below) — inside the practice system, the useful thing is that a study and its report live with the animal rather than in a separate silo someone has to remember to check.`
        }
      ]
    },
    {
      id: 'phone',
      name: 'AIVA Phone Agent',
      icon: '📞',
      where: 'aiva.vet',
      oneLiner: 'Answers the clinic phone, books the appointment, writes it to the diary.',
      status: 'Live demo; provisioning per-clinic on request',
      quickStart: [
        'Open aiva.vet/demo — no login.',
        'Use the on-page demo, or call the demo number listed there and speak to it like a client would.',
        'Ask for an appointment: give a pet name, a reason, and a rough time.',
        'The booking lands in the demo clinic diary — the demo shows you the record it created.'
      ],
      extended: [
        {
          h: 'What the caller experiences',
          p: `A caller rings and talks normally. The agent takes the reason for the visit, the animal, and a preferred time, then confirms a slot against real availability rather than promising anything the diary cannot honour. The recorded demos on aiva.vet are replays of genuine runs, not scripted mockups — that distinction matters and we hold to it.`
        },
        {
          h: 'What the clinic sees',
          p: `Bookings arrive in the clinic's appointment list like any other, with the call's context attached, so the vet opening the consult knows why the animal is coming in. Nothing is silently auto-confirmed that a human cannot see and change.`
        },
        {
          h: 'Getting a number for your clinic',
          p: `Phone provisioning is deliberately switched off by default and enabled per clinic. This is not a self-serve toggle today — it is a conversation, because a phone number answering as your practice is a commitment we would rather set up with you than let a signup form arrange. Ask via a support ticket and it gets turned on for your account.`
        },
        {
          h: 'Honest limits',
          p: `It is a receptionist for booking, not a triage service and not clinical advice. Genuine emergencies need a human, and the agent is built to hand off rather than improvise. Accents, background noise and multi-animal households are where it most often needs a person to intervene.`
        }
      ]
    },
    {
      id: 'imaging',
      name: 'Imaging',
      icon: '🩻',
      where: 'aiva.vet/imaging',
      oneLiner: 'View DICOM studies, chart dental findings, get AI-assisted reads.',
      status: 'Live, sign-in required',
      quickStart: [
        'Open aiva.vet/imaging and sign in.',
        'Upload a study — DICOM files are converted automatically for viewing.',
        'Review it in the viewer; link it to a patient so it lands in that animal’s history.',
        'Optionally request an AI-assisted read, which returns findings for you to confirm.'
      ],
      extended: [
        {
          h: 'Viewing and conversion',
          p: `DICOM is converted on upload so studies open in the browser without a desktop viewer. Images stay tied to the tenant that uploaded them — cross-clinic access is denied at the storage layer, not merely hidden in the interface.`
        },
        {
          h: 'AI-assisted reads',
          p: `An assisted read produces structured findings against the image. It is decision support: it is there to catch what a tired eye misses at the end of a long day, and every finding is yours to confirm or reject. A report is generated only when you ask for one, and it is attributed as AI-assisted rather than presented as a specialist opinion.`
        },
        {
          h: 'Dental odontogram',
          p: `Dental findings chart onto a species-correct tooth map shared with the practice system, so a chart made here reads identically in the clinic record. Same anatomy, same numbering, no translation step.`
        }
      ]
    }
  ];

  let open: string | null = $state(null);
  const toggle = (id: string) => (open = open === id ? null : id);
</script>

<svelte:head>
  <title>Documentation | VetNotes</title>
  <meta
    name="description"
    content="How to use VetNotes Scribe, VetSorcery Practice OS, the AIVA phone agent and Imaging — quick starts first, full walkthroughs below."
  />
</svelte:head>

<div class="min-h-screen bg-slate-50 py-16 px-4">
  <div class="max-w-4xl mx-auto">
    <header class="mb-12">
      <h1 class="text-4xl font-extrabold text-slate-900 mb-3">Documentation</h1>
      <p class="text-lg text-slate-600">
        Four apps, four jobs. Each one below starts with the shortest path to seeing it work,
        then explains the whole thing properly underneath. Nothing here describes a feature
        that doesn't exist yet.
      </p>
    </header>

    <nav class="mb-12 flex flex-wrap gap-2">
      {#each apps as app}
        <a
          href="#{app.id}"
          class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors"
        >
          <span aria-hidden="true">{app.icon}</span> {app.name}
        </a>
      {/each}
    </nav>

    <div class="space-y-8">
      {#each apps as app}
        <section id={app.id} class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-8">
          <div class="p-8">
            <div class="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 class="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <span aria-hidden="true">{app.icon}</span>
                  {app.name}
                </h2>
                <p class="text-slate-600 mt-1">{app.oneLiner}</p>
              </div>
              <div class="text-right">
                <span class="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  {app.status}
                </span>
                <p class="text-xs text-slate-400 mt-1 font-mono">{app.where}</p>
              </div>
            </div>

            <div class="mt-8">
              <h3 class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Quick start</h3>
              <ol class="space-y-3">
                {#each app.quickStart as step, i}
                  <li class="flex gap-3 text-slate-700">
                    <span
                      class="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center"
                    >{i + 1}</span>
                    <span class="pt-0.5">{step}</span>
                  </li>
                {/each}
              </ol>
            </div>
          </div>

          <div class="border-t border-slate-100">
            <button
              onclick={() => toggle(app.id)}
              aria-expanded={open === app.id}
              aria-controls="{app.id}-extended"
              class="w-full px-8 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <span class="text-sm font-semibold text-slate-700">
                {open === app.id ? 'Hide' : 'Read'} the full guide to {app.name}
              </span>
              <span class="text-slate-400 text-lg" aria-hidden="true">{open === app.id ? '−' : '+'}</span>
            </button>

            {#if open === app.id}
              <div id="{app.id}-extended" class="px-8 pb-8 space-y-6 border-t border-slate-100 pt-6">
                {#each app.extended as block}
                  <div>
                    <h4 class="font-bold text-slate-900 mb-2">{block.h}</h4>
                    <p class="text-slate-600 leading-relaxed">{block.p}</p>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </section>
      {/each}
    </div>

    <p class="text-center text-sm text-slate-400 mt-12">
      Something here wrong or missing?
      <a href="/tickets" class="text-blue-600 hover:underline">Open a support ticket</a>
      — a real person reads every one.
    </p>
  </div>
</div>
