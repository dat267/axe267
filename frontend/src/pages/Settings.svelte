<script lang="ts">
  import { auth } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte.ts";
  import { getErrorMessage } from "../lib/utils/authErrors.ts";
  import { updateEmail, deleteAccount, reauthenticate } from "../lib/services/accountService";
  import Input from "../lib/components/Input.svelte";
  import Button from "../lib/components/Button.svelte";
  import Alert from "../lib/components/Alert.svelte";

  let newEmail = $state("");
  let password = $state("");
  let error = $state("");
  let message = $state("");
  let loading = $state(false);
  let showReauth = $state(false);
  let pendingAction = $state<"email" | "delete" | null>(null);

  async function handleUpdateEmail(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    message = "";
    loading = true;
    pendingAction = "email";

    try {
      const user = auth.currentUser;
      if (!user) return;
      const result = await updateEmail(user, newEmail);
      if (result.success) {
        message = "A verification email has been sent to your new address. Please verify it to complete the change.";
        newEmail = "";
      } else if (result.requiresReauth) {
        showReauth = true;
        error = getErrorMessage(result.error);
      } else {
        error = getErrorMessage(result.error);
      }
    } finally {
      loading = false;
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you absolutely sure? This action is permanent and cannot be undone.")) return;

    error = "";
    loading = true;
    pendingAction = "delete";

    try {
      const user = auth.currentUser;
      if (!user) return;
      const result = await deleteAccount(user);
      if (!result.success && result.requiresReauth) {
        showReauth = true;
        error = getErrorMessage(result.error);
      } else if (!result.success) {
        error = getErrorMessage(result.error);
      }
    } finally {
      loading = false;
    }
  }

  async function handleReauth(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    loading = true;
    try {
      const user = auth.currentUser;
      if (!user) return;
      const result = await reauthenticate(user, password);
      if (result.success) {
        showReauth = false;
        password = "";

        if (pendingAction === "email") {
          await performUpdateEmail();
        } else if (pendingAction === "delete") {
          await handleDeleteAccount();
        }
      } else {
        error = getErrorMessage(result.error || "auth/invalid-credential");
      }
    } finally {
      loading = false;
    }
  }

  async function performUpdateEmail() {
    error = "";
    message = "";
    loading = true;
    try {
      const user = auth.currentUser;
      if (!user) return;
      const result = await updateEmail(user, newEmail);
      if (result.success) {
        message = "A verification email has been sent to your new address. Please verify it to complete the change.";
        newEmail = "";
      } else {
        error = getErrorMessage(result.error);
      }
    } finally {
      loading = false;
    }
  }
</script>

<div>
  <div class="mb-12">
    <h1 class="text-2xl font-bold tracking-tight lowercase">account settings</h1>
    <p class="text-xs text-gray-500 mt-2">Manage your identity and security.</p>
  </div>

  <div class="space-y-12">
    {#if showReauth}
      <div class="border-b border-border/50 pb-10">
        <h2 class="text-xs font-bold uppercase tracking-widest text-foreground mb-4">security confirmation</h2>
        <p class="mb-6 text-xs text-gray-500">Confirm your password to proceed.</p>
        <form onsubmit={handleReauth} class="max-w-md space-y-6">
          <Input type="password" id="password" label="Password" bind:value={password} placeholder="••••••••" required />
          <div class="flex gap-4">
            <Button type="submit" {loading} className="grow">confirm</Button>
            <Button
              type="button"
              variant="ghost"
              onclick={() => {
                showReauth = false;
                password = "";
                error = "";
              }}>cancel</Button
            >
          </div>
        </form>
      </div>
    {/if}

    <div class="border-b border-border/50 pb-10">
      <h2 class="text-xs font-bold uppercase tracking-widest text-foreground mb-6">email address</h2>
      {#if !showReauth}<Alert type="error" message={error} />{/if}
      <Alert type="success" {message} />
      <div class="space-y-8">
        <div class="flex flex-col gap-1.5 min-w-0">
          <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/50">current email</span>
          <p class="text-xs font-bold truncate text-foreground">{authStore.user?.email}</p>
        </div>
        <form onsubmit={handleUpdateEmail} class="space-y-8 pt-8 border-t border-border/30">
          <Input
            type="email"
            id="newEmail"
            label="New Email Address"
            bind:value={newEmail}
            disabled={showReauth}
            placeholder="new@example.com"
            required
          />
          <Button type="submit" variant="secondary" disabled={loading || showReauth} className="w-full sm:w-auto"
            >update email</Button
          >
        </form>
      </div>
    </div>

    <div class="pb-20">
      <h2 class="text-xs font-bold uppercase tracking-widest text-rose-500 mb-4">danger zone</h2>
      <p class="text-xs text-gray-500 max-w-2xl mb-6">
        Deleting your account is permanent. This removes your sign-in account; notifications and API keys are not deleted
        automatically.
      </p>
      <Button variant="danger" onclick={handleDeleteAccount} disabled={loading || showReauth} className="w-full sm:w-auto"
        >delete account</Button
      >
    </div>
  </div>
</div>
