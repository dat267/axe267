<script lang="ts">
import { onMount } from "svelte";
import { Link } from "svelte-routing";
import Button from "../lib/components/Button.svelte";
const quotes = [
{ text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
{ text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
{ text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
{ text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
{ text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
{ text: "Before software can be reusable it first has to be usable.", author: "Ralph Johnson" },
{ text: "Code is like humor. When you have to explain it, it is bad.", author: "Cory House" },
{ text: "Fix the cause, not the symptom.", author: "Steve Maguire" },
{ text: "Java is to JavaScript what car is to Carpet.", author: "Chris Heilmann" },
{ text: "Knowledge is power.", author: "Francis Bacon" }
];
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
let seed = 0;
for (let i = 0; i < today.length; i++) {
seed = (seed * 31 + today.charCodeAt(i)) | 0;
}
function random() {
seed = (1664525 * seed + 1013904223) >>> 0;
return seed / 0xffffffff;
}
const quoteIndex = Math.floor(random() * quotes.length);
const selectedQuote = quotes[quoteIndex];
const shiftKey = Math.floor(random() * 25) + 1;
const originalQuote = selectedQuote.text;
const originalAuthor = selectedQuote.author;
function shiftText(text: string, shift: number): string {
return text.split("").map(char => {
const code = char.charCodeAt(0);
if (code >= 65 && code <= 90) {
return String.fromCharCode(((code - 65 + shift) % 26) + 65);
}
if (code >= 97 && code <= 122) {
return String.fromCharCode(((code - 97 + shift) % 26) + 97);
}
return char;
}).join("");
}
const challengeText = shiftText(originalQuote, shiftKey);
let activeTab = $state("daily");
let customInput = $state("");
let customShift = $state(3);
const customEncrypted = $derived(shiftText(customInput, customShift));
let userShift = $state(0);
const decryptedPreview = $derived(shiftText(challengeText, userShift));
const isCorrect = $derived(decryptedPreview.toLowerCase() === originalQuote.toLowerCase());
let showStats = $state(false);
let timeUntilNext = $state("");
function handleSubmit() {
if (!isCorrect) return;
localStorage.setItem("axe_cipher_solved_date", today);
showStats = true;
}
function updateCountdown() {
const now = new Date();
const nextMidnight = new Date();
nextMidnight.setHours(24, 0, 0, 0);
const diff = nextMidnight.getTime() - now.getTime();
if (diff <= 0) {
timeUntilNext = "00:00:00";
return;
}
const hours = Math.floor(diff / 3600000);
const minutes = Math.floor((diff % 3600000) / 60000);
const seconds = Math.floor((diff % 60000) / 1000);
timeUntilNext = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function handleKeyDown(e: KeyboardEvent) {
if (showStats) return;
if (e.key === "ArrowLeft") {
userShift = (userShift - 1 + 26) % 26;
} else if (e.key === "ArrowRight") {
userShift = (userShift + 1) % 26;
} else if (e.key === "Enter") {
handleSubmit();
}
}
let copied = $state(false);
let copyTimer: any;
function triggerCopyToast() {
copied = true;
clearTimeout(copyTimer);
copyTimer = setTimeout(() => { copied = false; }, 2000);
}
function copyCiphertext() {
navigator.clipboard.writeText(customEncrypted);
triggerCopyToast();
}
onMount(() => {
if (localStorage.getItem("axe_cipher_solved_date") === today) {
showStats = true;
}
const interval = setInterval(updateCountdown, 1000);
updateCountdown();
window.addEventListener("keydown", handleKeyDown);
return () => {
clearInterval(interval);
window.removeEventListener("keydown", handleKeyDown);
};
});
function isLetter(char: string): boolean {
return /[a-zA-Z]/.test(char);
}
</script>
<svelte:window onkeydown={handleKeyDown} />
<div>
<div class="mb-12">
<h1 class="text-2xl font-bold tracking-tight lowercase">cipher</h1>
<p class="text-xs text-gray-500 mt-2">Solve daily puzzles or create your own ciphers.</p>
</div>
<div class="flex border-b border-border mb-8 select-none">
<button onclick={() => activeTab = "daily"} class="px-6 py-3 font-bold uppercase tracking-wider text-xs border-b-2 {activeTab === 'daily' ? 'border-foreground text-foreground' : 'border-transparent text-gray-500 hover:text-foreground'} transition-none cursor-pointer">
daily puzzle
</button>
<button onclick={() => activeTab = "create"} class="px-6 py-3 font-bold uppercase tracking-wider text-xs border-b-2 {activeTab === 'create' ? 'border-foreground text-foreground' : 'border-transparent text-gray-500 hover:text-foreground'} transition-none cursor-pointer">
cipher creator
</button>
</div>
<div class="space-y-12">
{#if activeTab === "daily"}
{#if showStats}
<div class="rounded-md border border-border bg-surface p-8 space-y-8 select-none text-center">
<div class="flex flex-col items-center justify-center gap-2">
<span class="text-xs font-bold uppercase tracking-widest text-emerald-500">access granted</span>
<h2 class="text-xl font-bold tracking-tight lowercase">decryption complete</h2>
</div>
<div class="text-left bg-background p-6 rounded border border-border/50">
<p class="font-mono text-sm leading-relaxed text-foreground select-none">
{#each originalQuote.split(" ") as word}
<span class="inline-block mr-3 mb-2">
{#each word.split("") as char}
<span class="inline-block {isLetter(char) ? 'border-b border-foreground/30 font-extrabold text-foreground' : 'text-gray-400 dark:text-gray-600'}">
{char}
</span>
{/each}
</span>
{/each}
</p>
<p class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-4">&mdash; {originalAuthor}</p>
</div>
<div class="flex flex-col items-center gap-4">
<div class="text-center">
<span class="block text-[10px] font-bold uppercase tracking-widest text-gray-500">next daily puzzle in</span>
<span class="block text-xl font-mono font-bold mt-1 text-foreground">{timeUntilNext}</span>
</div>
<Link to="/" class="inline-flex rounded-md px-6 py-3 font-bold uppercase tracking-wider text-xs border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-none select-none cursor-pointer">back to home</Link>
</div>
</div>
{:else}
<div class="space-y-8">
<div class="rounded-md border border-border bg-surface p-6">
<p class="font-mono text-sm leading-relaxed text-foreground select-none">
{#each decryptedPreview.split(" ") as word}
<span class="inline-block mr-3 mb-2">
{#each word.split("") as char}
<span class="inline-block {isLetter(char) ? 'border-b border-foreground/30 font-extrabold text-foreground' : 'text-gray-400 dark:text-gray-600'}">
{char}
</span>
{/each}
</span>
{/each}
</p>
<p class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-4">&mdash; {originalAuthor}</p>
</div>
<div class="space-y-6">
<div class="flex flex-col gap-4">
<div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
<span>decryption key (shift)</span>
<span class="text-foreground font-mono text-sm">+{userShift}</span>
</div>
<input type="range" min="0" max="25" bind:value={userShift} class="w-full h-2 bg-background border border-border rounded-lg appearance-none cursor-pointer accent-foreground focus:outline-none" />
</div>
<div class="text-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
tip: use <kbd class="px-1.5 py-0.5 border border-border rounded bg-background font-mono text-[9px]">left</kbd> / <kbd class="px-1.5 py-0.5 border border-border rounded bg-background font-mono text-[9px]">right</kbd> arrow keys to fine-tune shift
</div>
</div>
<div class="pt-4">
<Button variant="primary" disabled={!isCorrect} onclick={handleSubmit} className="w-full">
submit decryption
</Button>
</div>
</div>
{/if}
{:else}
<div class="space-y-8">
<div class="flex flex-col gap-2">
<label for="secret-message" class="text-[10px] font-bold uppercase tracking-widest text-gray-500">enter secret message</label>
<textarea id="secret-message" bind:value={customInput} placeholder="Type your secret message here..." class="w-full min-h-24 p-4 rounded-md border border-border bg-background text-foreground font-mono text-sm focus:outline-none focus:border-foreground"></textarea>
</div>
<div class="flex flex-col gap-4">
<div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
<span>encryption shift</span>
<span class="text-foreground font-mono text-sm">+{customShift}</span>
</div>
<input type="range" min="1" max="25" bind:value={customShift} class="w-full h-2 bg-background border border-border rounded-lg appearance-none cursor-pointer accent-foreground focus:outline-none" />
</div>
{#if customInput}
<div class="space-y-4">
<span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">encrypted ciphertext</span>
<div class="rounded-md border border-border bg-surface p-6 font-mono text-sm leading-relaxed text-foreground select-all break-all">
{customEncrypted}
</div>
<div class="flex gap-4">
<Button variant="primary" onclick={copyCiphertext} className="w-full">
copy ciphertext
</Button>
</div>
{#if copied}
<div class="text-center text-xs font-bold uppercase tracking-widest text-emerald-500">
copied to clipboard!
</div>
{/if}
</div>
{/if}
</div>
{/if}
</div>
</div>
<style>
input[type="range"]::-webkit-slider-runnable-track{background:transparent;}
input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;background:currentColor;border-radius:0;border:none;cursor:pointer;}
input[type="range"]::-moz-range-thumb{width:16px;height:16px;background:currentColor;border-radius:0;border:none;cursor:pointer;}
</style>
