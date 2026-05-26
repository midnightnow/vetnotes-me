<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { user } from '$lib/stores/auth';
    import { db, auth } from '$lib/firebase';
    import {
        collection,
        query,
        where,
        orderBy,
        onSnapshot,
        addDoc,
        serverTimestamp,
        type Unsubscribe,
    } from 'firebase/firestore';

    // ── Types ─────────────────────────────────────────────────────────────────

    interface Ticket {
        id: string;
        title?: string;
        subject?: string;
        description: string;
        category: 'bug' | 'feature' | 'question' | 'setup';
        priority: 'low' | 'medium' | 'high';
        status: 'open' | 'in_progress' | 'resolved' | 'closed';
        site_id: string;
        user_email: string;
        user_uid?: string;
        ai_response?: string;
        created_at: any;
    }

    interface TicketComment {
        id: string;
        body: string;
        authorRole: 'user' | 'admin';
        authorName: string;
        createdAt: any;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    let tickets: Ticket[] = [];
    let loading = true;
    let expandedId: string | null = null;
    let showNewForm = false;

    // New ticket form
    let newTitle = '';
    let newDescription = '';
    let newCategory: Ticket['category'] = 'question';
    let submitting = false;
    let submitError = '';

    // Comments
    let comments: Record<string, TicketComment[]> = {};
    let commentInputs: Record<string, string> = {};
    let commentSending: Record<string, boolean> = {};
    let commentUnsubs: Unsubscribe[] = [];

    let ticketUnsub: Unsubscribe | null = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    onMount(() => {
        const unsub = user.subscribe(($user) => {
            if ($user) {
                subscribeToTickets($user.uid, $user.email || '');
            } else {
                tickets = [];
                loading = false;
            }
        });
        return unsub;
    });

    onDestroy(() => {
        ticketUnsub?.();
        commentUnsubs.forEach((u) => u());
    });

    // ── Subscriptions ─────────────────────────────────────────────────────────

    function subscribeToTickets(uid: string, email: string) {
        ticketUnsub?.();

        // Query global support_tickets by user_uid OR user_email
        // Try uid first (most reliable for signed-in users)
        const ticketsRef = collection(db, 'support_tickets');
        const q = query(
            ticketsRef,
            where('user_uid', '==', uid),
            orderBy('created_at', 'desc'),
        );

        ticketUnsub = onSnapshot(
            q,
            (snap) => {
                let results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
                
                // Also try email-based query for tickets created without uid
                if (email) {
                    const qEmail = query(
                        ticketsRef,
                        where('user_email', '==', email),
                        orderBy('created_at', 'desc'),
                    );
                    onSnapshot(qEmail, (emailSnap) => {
                        const emailResults = emailSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
                        // Merge, deduplicate by id
                        const merged = new Map<string, Ticket>();
                        for (const t of results) merged.set(t.id, t);
                        for (const t of emailResults) merged.set(t.id, t);
                        tickets = [...merged.values()].sort((a, b) => {
                            const aTime = a.created_at?.seconds || 0;
                            const bTime = b.created_at?.seconds || 0;
                            return bTime - aTime;
                        });
                        loading = false;
                    });
                } else {
                    tickets = results;
                    loading = false;
                }
            },
            () => {
                // If uid query fails (no index), fall back to email only
                if (email) {
                    const qEmail = query(
                        ticketsRef,
                        where('user_email', '==', email),
                        orderBy('created_at', 'desc'),
                    );
                    ticketUnsub = onSnapshot(qEmail, (snap) => {
                        tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
                        loading = false;
                    }, () => { loading = false; });
                } else {
                    loading = false;
                }
            },
        );
    }

    function subscribeToComments(ticketId: string) {
        const commentsRef = collection(db, 'support_tickets', ticketId, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            comments[ticketId] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketComment));
            comments = comments; // trigger reactivity
        });
        commentUnsubs.push(unsub);
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    function toggleExpand(ticketId: string) {
        if (expandedId === ticketId) {
            expandedId = null;
        } else {
            expandedId = ticketId;
            if (!comments[ticketId]) {
                subscribeToComments(ticketId);
            }
        }
    }

    async function handleCreateTicket() {
        if (!newTitle.trim() || !newDescription.trim()) return;
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        submitting = true;
        submitError = '';

        try {
            await addDoc(collection(db, 'support_tickets'), {
                site_id: 'vetnotes_me',
                category: newCategory,
                priority: 'medium',
                title: newTitle.trim(),
                description: newDescription.trim(),
                status: 'open',
                user_email: currentUser.email || 'anonymous',
                user_uid: currentUser.uid,
                page: typeof window !== 'undefined' ? window.location.pathname : '/',
                created_at: serverTimestamp(),
            });
            newTitle = '';
            newDescription = '';
            newCategory = 'question';
            showNewForm = false;
        } catch (e: any) {
            submitError = e.message || 'Failed to create ticket';
        } finally {
            submitting = false;
        }
    }

    async function sendComment(ticketId: string) {
        const body = commentInputs[ticketId]?.trim();
        if (!body) return;
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        commentSending[ticketId] = true;

        try {
            await addDoc(collection(db, 'support_tickets', ticketId, 'comments'), {
                ticketId,
                authorId: currentUser.uid,
                authorName: currentUser.displayName || 'User',
                authorEmail: currentUser.email || '',
                authorRole: 'user',
                body,
                createdAt: serverTimestamp(),
            });
            commentInputs[ticketId] = '';
        } catch (e) {
            console.error('Failed to send comment:', e);
        } finally {
            commentSending[ticketId] = false;
        }
    }

    function handleCommentKeydown(e: KeyboardEvent, ticketId: string) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendComment(ticketId);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function formatDate(ts: any): string {
        if (!ts) return '—';
        if (ts.toDate) return ts.toDate().toLocaleDateString();
        if (typeof ts === 'string') return new Date(ts).toLocaleDateString();
        return '—';
    }

    const STATUS_LABELS: Record<string, { label: string; class: string }> = {
        open: { label: 'Open', class: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
        in_progress: { label: 'In Progress', class: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
        resolved: { label: 'Resolved', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        closed: { label: 'Closed', class: 'bg-white/10 text-white/40 border-white/10' },
    };

    const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
        bug: { icon: '🐛', label: 'Bug' },
        feature: { icon: '💡', label: 'Feature' },
        question: { icon: '❓', label: 'Question' },
        setup: { icon: '⚙️', label: 'Setup' },
    };
</script>

<div class="max-w-3xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-2xl font-bold text-white">My Tickets</h1>
            <p class="text-sm text-white/40 mt-1">Track your support requests and bug reports.</p>
        </div>
        {#if $user}
            <button
                on:click={() => showNewForm = true}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                New Ticket
            </button>
        {/if}
    </div>

    <!-- Not signed in -->
    {#if !$user}
        <div class="text-center py-16 text-white/40">
            <p class="text-sm">Sign in to view and create support tickets.</p>
        </div>

    <!-- Loading -->
    {:else if loading}
        <div class="flex items-center justify-center py-16">
            <div class="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>

    <!-- Empty state -->
    {:else if tickets.length === 0}
        <div class="text-center py-16 space-y-3">
            <div class="text-4xl opacity-40">🎫</div>
            <p class="text-sm font-medium text-white/50">No tickets yet.</p>
            <p class="text-xs text-white/30 max-w-sm mx-auto">
                Use the chat widget or click "New Ticket" to report issues or ask for help.
            </p>
        </div>

    <!-- Ticket list -->
    {:else}
        <div class="space-y-3">
            {#each tickets as ticket (ticket.id)}
                {@const status = STATUS_LABELS[ticket.status] || STATUS_LABELS.open}
                {@const cat = CATEGORY_LABELS[ticket.category] || CATEGORY_LABELS.question}
                {@const isExpanded = expandedId === ticket.id}

                <div class="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
                    <!-- Summary row -->
                    <button
                        class="w-full flex items-center gap-3 px-4 py-3 text-left"
                        on:click={() => toggleExpand(ticket.id)}
                    >
                        <!-- Category -->
                        <span class="text-sm flex-shrink-0">{cat.icon}</span>

                        <!-- Title -->
                        <span class="flex-1 text-sm font-medium text-white truncate">
                            {ticket.title || ticket.subject || ticket.description?.slice(0, 60) || 'Untitled'}
                        </span>

                        <!-- Status badge -->
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-medium border flex-shrink-0 {status.class}">
                            {status.label}
                        </span>

                        <!-- Date -->
                        <span class="text-[11px] text-white/30 flex-shrink-0 hidden sm:block">
                            {formatDate(ticket.created_at)}
                        </span>

                        <!-- Chevron -->
                        <svg
                            class="w-4 h-4 text-white/30 flex-shrink-0 transition-transform {isExpanded ? 'rotate-180' : ''}"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>

                    <!-- Expanded detail -->
                    {#if isExpanded}
                        <div class="px-4 pb-4 pt-1 border-t border-white/5 space-y-4">
                            <p class="text-sm text-white/70 whitespace-pre-wrap">{ticket.description}</p>
                            <p class="text-[11px] text-white/30">Submitted {formatDate(ticket.created_at)}</p>

                            <!-- Comments thread -->
                            <div class="border-t border-white/5 pt-3 space-y-3">
                                <p class="text-[11px] font-medium text-white/40 uppercase tracking-wide">Conversation</p>

                                {#if comments[ticket.id]?.length}
                                    <div class="space-y-2 max-h-48 overflow-y-auto">
                                        {#each comments[ticket.id] as c}
                                            <div class="flex {c.authorRole === 'admin' ? 'justify-start' : 'justify-end'}">
                                                <div class="max-w-[80%] px-3 py-2 rounded-lg text-sm {c.authorRole === 'admin' ? 'bg-blue-600/20 text-blue-200 border border-blue-500/20' : 'bg-white/5 text-white/70'}">
                                                    <span class="text-[10px] text-white/30 block mb-0.5">
                                                        {c.authorRole === 'admin' ? '🛡️ Support Team' : 'You'}
                                                        {#if c.createdAt?.toDate}
                                                            · {c.createdAt.toDate().toLocaleDateString()}
                                                        {/if}
                                                    </span>
                                                    <p class="whitespace-pre-wrap">{c.body}</p>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <p class="text-xs text-white/20 italic">No replies yet.</p>
                                {/if}

                                <!-- Reply input (if not closed) -->
                                {#if ticket.status !== 'closed'}
                                    <div class="flex gap-2">
                                        <input
                                            type="text"
                                            bind:value={commentInputs[ticket.id]}
                                            on:keydown={(e) => handleCommentKeydown(e, ticket.id)}
                                            placeholder="Add a reply…"
                                            class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            on:click={() => sendComment(ticket.id)}
                                            disabled={!commentInputs[ticket.id]?.trim() || commentSending[ticket.id]}
                                            class="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                                            aria-label="Send reply"
                                        >
                                            {#if commentSending[ticket.id]}
                                                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            {:else}
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                                                </svg>
                                            {/if}
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- New Ticket Modal -->
{#if showNewForm}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div class="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 class="text-base font-semibold text-white">New Support Ticket</h2>
                <button
                    on:click={() => showNewForm = false}
                    class="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                    aria-label="Close"
                >
                    <svg class="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Form -->
            <form on:submit|preventDefault={handleCreateTicket} class="px-6 py-5 space-y-4">
                <div>
                    <label class="block text-xs font-medium text-white/50 mb-1">Title *</label>
                    <input
                        type="text"
                        bind:value={newTitle}
                        placeholder="Brief summary of the issue"
                        required
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div>
                    <label class="block text-xs font-medium text-white/50 mb-1">Description *</label>
                    <textarea
                        bind:value={newDescription}
                        placeholder="Describe the issue — steps to reproduce, what you expected, etc."
                        required
                        rows="4"
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500 resize-none"
                    ></textarea>
                </div>

                <div>
                    <label class="block text-xs font-medium text-white/50 mb-1">Category</label>
                    <select
                        bind:value={newCategory}
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="question">❓ Question</option>
                        <option value="bug">🐛 Bug</option>
                        <option value="setup">⚙️ Setup Help</option>
                        <option value="feature">💡 Feature Request</option>
                    </select>
                </div>

                {#if submitError}
                    <p class="text-xs text-red-400">{submitError}</p>
                {/if}

                <div class="flex items-center justify-end gap-3 pt-1">
                    <button
                        type="button"
                        on:click={() => showNewForm = false}
                        class="px-4 py-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !newTitle.trim() || !newDescription.trim()}
                        class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                        {#if submitting}
                            <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {/if}
                        Submit Ticket
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
