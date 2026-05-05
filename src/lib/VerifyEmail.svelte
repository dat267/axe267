<script lang="ts">
  import { sendEmailVerification, signOut } from "firebase/auth";
  import { auth } from "./firebase";
  import { authStore } from "./authStore.svelte.ts";
  import { getErrorMessage } from "./authErrors";
  import Button from "./ui/Button.svelte";
  import Alert from "./ui/Alert.svelte";

  let loading = $state(false);
  let message = $state("");
  let error = $state("");

  async function resend() {
    loading = true;
    error = "";
    message = "";
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        message = "Verification email sent! Please check your inbox.";
      }
    } catch (e: any) {
      error = getErrorMessage(e.code || e.message);
    } finally {
      loading = false;
    }
  }

  async function logout() {
    await signOut(auth);
  }

  async function checkVerification() {
    loading = true;
    error = "";
    message = "";
    try {
      // Call the centralized refresh method
      await authStore.refreshStatus();
      
      if (!authStore.isVerified) {
        error = "Account still unverified. Please check your inbox and click the link in the email.";
      }
    } catch (e: any) {
      error = getErrorMessage(e.code || e.message);
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-svh w-full flex-col overflow-y-auto bg-background px-6 pt-12 pb-24 text-center text-foreground sm:items-center sm:justify-center sm:py-12">
  <div class="mx-auto w-full max-w-sm">
    <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
    </div>
    
    <h1 class="text-2xl font-bold">Verify your email</h1>
    <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
      We've sent a verification link to <span class="font-semibold text-foreground">{authStore.user?.email}</span>.
    </p>
    
    <div class="mt-10 space-y-4">
      <Alert type="success" message={message} />
      <Alert type="error" message={error} />

      <Button
        onclick={checkVerification}
        loading={loading}
        className="w-full"
      >
        I've verified my email
      </Button>

      <Button
        variant="secondary"
        onclick={resend}
        loading={loading}
        className="w-full"
      >
        Resend verification email
      </Button>

      <button
        onclick={logout}
        class="mt-6 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 transition-colors"
      >
        Sign out and use a different email
      </button>
    </div>
  </div>
</div>
