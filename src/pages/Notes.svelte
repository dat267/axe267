<script lang="ts">
    import { onMount } from "svelte";
    import { authStore } from "../lib/stores/authStore.svelte";
    import {
        subscribeNotes,
        createNote,
        updateNote,
        deleteNote,
        togglePin,
        type Note,
    } from "../lib/services/noteService";
    import Button from "../lib/components/Button.svelte";
    import Modal from "../lib/components/Modal.svelte";
    import Alert from "../lib/components/Alert.svelte";

    let notes = $state<Note[]>([]);
    let searchQuery = $state("");
    let noteLimit = $state(50);
    let showModal = $state(false);
    let editingNote = $state<Note | null>(null);
    let loading = $state(false);
    let error = $state("");
    let contentElement = $state<HTMLTextAreaElement | null>(null);

    let form = $state({
        title: "",
        content: "",
    });

    let filteredNotes = $derived(
        notes.filter(n => {
            const title = n.title || "";
            const content = n.content || "";
            const query = searchQuery.toLowerCase();
            return title.toLowerCase().includes(query) || 
                   content.toLowerCase().includes(query);
        })
    );

    let pinnedNotes = $derived(filteredNotes.filter(n => n.isPinned));
    let otherNotes = $derived(filteredNotes.filter(n => !n.isPinned));

    $effect(() => {
        const user = authStore.user;
        if (user?.email) {
            const unsubscribe = subscribeNotes(user.email, (data) => {
                notes = data;
            }, noteLimit);
            return () => unsubscribe();
        }
    });

    function loadMore() {
        noteLimit += 50;
    }

    $effect(() => {
        if (showModal && contentElement) {
            contentElement.focus();
        }
    });

    function openCreate() {
        editingNote = null;
        form.title = "";
        form.content = "";
        error = "";
        showModal = true;
    }

    function openEdit(note: Note) {
        editingNote = note;
        form.title = note.title;
        form.content = note.content;
        error = "";
        showModal = true;
    }

    async function handleSave() {
        if (!form.title.trim() && !form.content.trim()) {
            showModal = false;
            return;
        }

        const title = form.title.trim();
        const content = form.content.trim();

        loading = true;
        try {
            if (editingNote) {
                await updateNote(editingNote.id, title, content);
            } else {
                if (authStore.user?.email) {
                    await createNote(authStore.user.email, title, content);
                }
            }
            showModal = false;
            form.title = "";
            form.content = "";
        } catch (e: any) {
            error = e.message || "Failed to save note";
        } finally {
            loading = false;
        }
    }

    async function handleTogglePin(e: MouseEvent, note: Note) {
        e.stopPropagation();
        try {
            await togglePin(note.id, note.isPinned);
        } catch (e: any) {
            alert(e.message || "Failed to toggle pin");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete note?")) return;
        try {
            await deleteNote(id);
            if (showModal && editingNote?.id === id) showModal = false;
        } catch (e: any) {
            alert(e.message || "Failed to delete note");
        }
    }

    function formatTime(timestamp: any) {
        if (!timestamp) return "Just now";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    }
</script>

{#snippet noteCard(note: Note)}
    <div 
        class="break-inside-avoid group relative flex flex-col rounded-xl border border-border bg-surface p-4 transition-all hover:border-gray-500/30 hover:shadow-md cursor-pointer"
        onclick={() => openEdit(note)}
    >
        <div class="flex items-center justify-between gap-2 mb-2 min-h-[28px]">
            <h3 class="font-bold text-sm text-foreground line-clamp-2 grow">{note.title || ''}</h3>
            <button 
                onclick={(e) => handleTogglePin(e, note)}
                class="shrink-0 p-1.5 rounded-full transition-all {note.isPinned ? 'text-gray-800 dark:text-white opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-500/10'}"
                aria-label={note.isPinned ? "Unpin note" : "Pin note"}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={note.isPinned ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="17" x2="12" y2="22"></line>
                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                </svg>
            </button>
        </div>
        <p class="mb-4 line-clamp-6 text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap overflow-hidden">
            {note.content}
        </p>
        <div class="mt-auto flex items-center justify-between">
            <span class="text-[10px] font-medium text-gray-400">
                {formatTime(note.createdAt)}
            </span>
            <button 
                onclick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                class="rounded-md p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                aria-label="Delete note"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    </div>
{/snippet}

<div class="mx-auto w-full max-w-5xl p-4 md:p-8">
    <!-- Header & Search -->
    <div class="mb-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold tracking-tight">Notes</h1>
        <div class="flex items-center gap-3 w-full sm:max-w-md">
            <div class="relative flex-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input 
                    type="text" 
                    bind:value={searchQuery}
                    placeholder="Search notes..." 
                    class="w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:border-gray-500 transition-colors"
                />
            </div>
            <button 
                onclick={openCreate}
                class="shrink-0 flex items-center justify-center rounded-lg border border-border bg-surface p-2 text-gray-500 hover:border-gray-500/30 hover:text-foreground shadow-sm hover:shadow-md transition-all"
                aria-label="Create new note"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
        </div>
    </div>

    {#if filteredNotes.length === 0}
        <div class="mt-20 flex flex-col items-center justify-center text-gray-400">
            <p class="text-lg">{searchQuery ? 'No matching notes' : 'Your notes will appear here'}</p>
        </div>
    {:else}
        {#if pinnedNotes.length > 0}
            <div class="mb-8">
                <h2 class="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Pinned</h2>
                <div class="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 space-y-4">
                    {#each pinnedNotes as note (note.id)}
                        {@render noteCard(note)}
                    {/each}
                </div>
            </div>
        {/if}

        {#if pinnedNotes.length > 0 && otherNotes.length > 0}
            <h2 class="mt-12 mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Others</h2>
        {/if}

        <div class="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 space-y-4">
            {#each otherNotes as note (note.id)}
                {@render noteCard(note)}
            {/each}
        </div>

        {#if notes.length >= noteLimit}
            <div class="mt-12 flex justify-center pb-10">
                <button
                    onclick={loadMore}
                    class="rounded-lg border border-border px-6 py-2 text-sm font-semibold text-foreground/70 hover:bg-gray-500/10 hover:text-foreground transition-all"
                >
                    Load More
                </button>
            </div>
        {/if}
    {/if}
</div>

<Modal
    show={showModal}
    title=""
    onClose={handleSave}
    showCloseButton={false}
    showFooter={false}
>
    <div class="space-y-4">
        <Alert type="error" message={error} />
        
        <div class="flex items-center justify-between gap-4 min-h-[32px]">
            <input
                bind:value={form.title}
                placeholder="Title"
                class="w-full bg-transparent text-lg font-bold outline-none border-none p-0"
            />
            <button 
                onclick={() => {
                    if (editingNote) {
                        togglePin(editingNote.id, editingNote.isPinned);
                        // Local update for immediate feedback
                        editingNote.isPinned = !editingNote.isPinned;
                    }
                }}
                class="shrink-0 p-1.5 rounded-full transition-all {editingNote?.isPinned ? 'text-gray-800 dark:text-white' : 'text-gray-400 hover:bg-gray-500/10'}"
                aria-label={editingNote?.isPinned ? "Unpin note" : "Pin note"}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={editingNote?.isPinned ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="17" x2="12" y2="22"></line>
                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                </svg>
            </button>
        </div>

        <textarea
            bind:this={contentElement}
            bind:value={form.content}
            placeholder="Note"
            class="w-full bg-transparent text-sm outline-none resize-none min-h-[200px] border-none p-0 mt-2"
        ></textarea>

        <div class="flex justify-end pt-4">
            <Button {loading} className="px-6!" onclick={handleSave}>Close</Button>
        </div>
    </div>
</Modal>
