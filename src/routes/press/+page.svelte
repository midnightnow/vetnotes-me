<script lang="ts">
    import { ExternalLink } from 'lucide-svelte';

    const coverage = [
        {
            outlet: 'dvm360',
            title: 'Vet Scene Down Under: Veterinarian builds clinical software',
            date: '2026-05',
            url: 'http://dvm360.com/view/vet-scene-down-under-veterinarian-builds-clinical-software',
            type: 'Feature',
        },
    ];

    const features = [
        { name: 'Voice-to-SOAP', desc: 'Speak naturally during consult — AI structures into SOAP format automatically' },
        { name: 'PII Redaction', desc: 'Client personal information redacted locally before any cloud processing' },
        { name: 'Template Library', desc: 'Species-specific templates for wellness, dental, surgical, emergency, and exotic consults' },
        { name: 'Shorthand Engine', desc: 'Veterinary abbreviation expansion — type "hge" and get full clinical terminology' },
        { name: 'Billing Tray', desc: 'Volatile billing suggestions generated from clinical content in real-time' },
        { name: 'VetSorcery Sync', desc: 'Push completed notes directly to VetSorcery patient records (Pro tier)' },
    ];
</script>

<svelte:head>
    <title>Press & Media — VetNotes</title>
    <meta name="description" content="Press kit and media resources for VetNotes — the AI-powered veterinary clinical documentation tool. Voice-to-SOAP notes with local PII redaction." />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-gray-100">

    <!-- Navigation -->
    <header class="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
        <nav class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" class="flex items-center gap-2">
                <div class="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <span class="text-white text-[9px] font-black">VN</span>
                </div>
                <span class="font-bold text-white text-sm">VetNotes</span>
            </a>
            <div class="flex items-center gap-5">
                <a href="/" class="text-sm text-gray-400 hover:text-white transition-colors">Home</a>
                <a href="https://vetsorcery.com" class="text-sm text-gray-400 hover:text-white transition-colors">VetSorcery</a>
                <a href="https://aiva.vet" class="text-sm text-gray-400 hover:text-white transition-colors">AIVA</a>
            </div>
        </nav>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-16 space-y-16">

        <!-- Hero -->
        <section>
            <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
                Press & Media
            </h1>
            <p class="text-lg text-gray-400 max-w-2xl leading-relaxed">
                Resources for journalists covering AI clinical documentation, veterinary workflow automation, 
                and the future of medical note-taking.
            </p>
        </section>

        <!-- About VetNotes -->
        <section class="space-y-6">
            <h2 class="text-xl font-bold text-white">About VetNotes</h2>
            <div class="grid md:grid-cols-2 gap-4">
                <div class="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                    <div class="text-[10px] uppercase tracking-widest font-semibold text-emerald-400 mb-2">What It Is</div>
                    <p class="text-gray-300 text-sm leading-relaxed">
                        AI-powered voice-to-SOAP clinical documentation for veterinarians. Speak naturally during 
                        a consult and get structured medical records — no typing, no templates to fill.
                    </p>
                </div>
                <div class="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                    <div class="text-[10px] uppercase tracking-widest font-semibold text-emerald-400 mb-2">Pricing</div>
                    <p class="text-gray-300 text-sm leading-relaxed">
                        Free tier available — no account required for core voice-to-SOAP features. 
                        Pro tier ($49/mo) adds VetSorcery sync, advanced templates, and priority processing.
                    </p>
                </div>
                <div class="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                    <div class="text-[10px] uppercase tracking-widest font-semibold text-emerald-400 mb-2">Privacy</div>
                    <p class="text-gray-300 text-sm leading-relaxed">
                        PII redaction runs locally in the browser before any data leaves the device. 
                        Client names, addresses, and phone numbers are stripped before cloud processing.
                    </p>
                </div>
                <div class="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                    <div class="text-[10px] uppercase tracking-widest font-semibold text-emerald-400 mb-2">Ecosystem</div>
                    <p class="text-gray-300 text-sm leading-relaxed">
                        Part of the AIVA product family. Standalone at vetnotes.me, or integrated as the 
                        documentation engine inside VetSorcery practice management.
                    </p>
                </div>
            </div>
        </section>

        <!-- Features -->
        <section class="space-y-6">
            <h2 class="text-xl font-bold text-white">Key Features</h2>
            <div class="grid md:grid-cols-2 gap-3">
                {#each features as feature}
                    <div class="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
                        <h3 class="text-sm font-bold text-emerald-400 mb-1">{feature.name}</h3>
                        <p class="text-xs text-gray-400 leading-relaxed">{feature.desc}</p>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Key Messages -->
        <section class="space-y-6">
            <h2 class="text-xl font-bold text-white">Key Messages</h2>
            <div class="space-y-4">
                <div class="p-5 border-l-4 border-emerald-500 bg-emerald-950/30 rounded-r-xl">
                    <p class="text-gray-200 font-medium italic text-sm">
                        "VetNotes cuts clinical documentation time from 8 minutes per consult to near-zero — 
                        just speak naturally and the AI structures your notes."
                    </p>
                </div>
                <div class="p-5 border-l-4 border-emerald-500 bg-emerald-950/30 rounded-r-xl">
                    <p class="text-gray-200 font-medium italic text-sm">
                        "Privacy-first by design. PII redaction happens in the browser — client data never 
                        leaves the device unprotected."
                    </p>
                </div>
                <div class="p-5 border-l-4 border-emerald-500 bg-emerald-950/30 rounded-r-xl">
                    <p class="text-gray-200 font-medium italic text-sm">
                        "Free to use, no account required. We believe every vet should have access to AI 
                        documentation tools regardless of what PMS they use."
                    </p>
                </div>
            </div>
        </section>

        <!-- Coverage -->
        <section class="space-y-6">
            <h2 class="text-xl font-bold text-white">Media Coverage</h2>
            <div class="space-y-3">
                {#each coverage as item}
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block p-5 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-700 transition-all group"
                    >
                        <div class="flex items-center gap-3 mb-2">
                            <span class="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">
                                {item.type}
                            </span>
                            <span class="text-sm text-gray-500">{item.date} · {item.outlet}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <h3 class="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm">{item.title}</h3>
                            <ExternalLink class="w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors" />
                        </div>
                    </a>
                {/each}
            </div>
        </section>

        <!-- Founder -->
        <section class="space-y-6">
            <h2 class="text-xl font-bold text-white">Founder</h2>
            <div class="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                <div class="flex flex-col md:flex-row gap-6 items-start">
                    <div class="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0">
                        DM
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white mb-1">Dr. Dallas McMillan, BVSc</h3>
                        <p class="text-sm text-emerald-400 font-medium mb-3">Veterinarian & Founder, AIVA Pty Ltd</p>
                        <p class="text-gray-400 text-sm leading-relaxed">
                            A practicing veterinarian with 25 years of clinical experience who built VetNotes 
                            because he was tired of spending more time typing notes than examining patients. 
                            VetNotes is the documentation engine that powers VetSorcery, available standalone 
                            for any vet regardless of their practice management system.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Product Ecosystem -->
        <section class="space-y-6">
            <h2 class="text-xl font-bold text-white">AIVA Product Ecosystem</h2>
            <div class="grid md:grid-cols-2 gap-3">
                <a href="https://vetsorcery.com" target="_blank" rel="noopener noreferrer" class="p-4 border border-slate-800 rounded-xl hover:border-emerald-700 transition-colors group bg-slate-900">
                    <h3 class="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm mb-1">VetSorcery</h3>
                    <p class="text-xs text-gray-500">AI practice management — voice scribe, billing, scheduling</p>
                </a>
                <div class="p-4 border border-emerald-700 rounded-xl bg-emerald-950/30">
                    <h3 class="font-bold text-emerald-400 text-sm mb-1">VetNotes ← You are here</h3>
                    <p class="text-xs text-gray-500">Standalone AI clinical documentation</p>
                </div>
                <a href="https://aivet.dev" target="_blank" rel="noopener noreferrer" class="p-4 border border-slate-800 rounded-xl hover:border-emerald-700 transition-colors group bg-slate-900">
                    <h3 class="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm mb-1">AiVet</h3>
                    <p class="text-xs text-gray-500">Signal extraction & behavioral monitoring framework</p>
                </a>
                <a href="https://aiva.vet" target="_blank" rel="noopener noreferrer" class="p-4 border border-slate-800 rounded-xl hover:border-emerald-700 transition-colors group bg-slate-900">
                    <h3 class="font-bold text-white group-hover:text-emerald-400 transition-colors text-sm mb-1">AIVA</h3>
                    <p class="text-xs text-gray-500">AI voice agent for vet clinics & small business</p>
                </a>
            </div>
        </section>

        <!-- Media Kit Link -->
        <section>
            <div class="p-5 bg-slate-900 border border-slate-800 rounded-xl text-center">
                <p class="text-gray-400 text-sm mb-3">Full media kit with downloadable logos, brand colors, and boilerplate:</p>
                <a href="https://vetsorcery.com/press/assets" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-emerald-400 font-semibold hover:text-emerald-300 transition-colors text-sm">
                    vetsorcery.com/press/assets
                    <ExternalLink class="w-3.5 h-3.5" />
                </a>
            </div>
        </section>

        <!-- Contact -->
        <section>
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <h2 class="text-xl font-bold text-white mb-3">Media Contact</h2>
                <p class="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                    For press inquiries, demos, or interview requests:
                </p>
                <div class="space-y-1 text-gray-300 text-sm mb-6">
                    <p><span class="text-gray-500">Email:</span> hello@aiva.vet</p>
                    <p><span class="text-gray-500">Press:</span> press@vetsorcery.com</p>
                </div>
                <p class="text-xs text-gray-600">
                    We typically respond within 24 hours.
                </p>
            </div>
        </section>

    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-800 py-8 px-6">
        <div class="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            <p>© 2026 AIVA Pty Ltd. All rights reserved.</p>
            <div class="flex gap-5">
                <a href="https://vetsorcery.com" class="hover:text-white transition-colors">VetSorcery</a>
                <a href="https://aivet.dev" class="hover:text-white transition-colors">AiVet</a>
                <a href="https://aiva.vet" class="hover:text-white transition-colors">AIVA</a>
            </div>
        </div>
    </footer>

</div>
