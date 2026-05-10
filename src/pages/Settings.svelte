<script lang="ts">
  import {
    verifyBeforeUpdateEmail,
    reauthenticateWithCredential,
    EmailAuthProvider,
    deleteUser,
  } from "firebase/auth";
  import { auth } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte.ts";
  import { getErrorMessage } from "../lib/utils/authErrors";
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
      if (auth.currentUser) {
        await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
        message =
          "A verification email has been sent to your new address. Please verify it to complete the change.";
        newEmail = "";
      }
    } catch (e: any) {
      if (e.code === "auth/requires-recent-login") {
        showReauth = true;
        error = getErrorMessage(e.code);
      } else {
        error = getErrorMessage(e.code || e.message);
      }
    } finally {
      loading = false;
    }
  }

  async function handleDeleteAccount() {
    if (
      !confirm(
        "Are you absolutely sure? This action is permanent and cannot be undone.",
      )
    )
      return;

    error = "";
    loading = true;
    pendingAction = "delete";

    try {
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
    } catch (e: any) {
      if (e.code === "auth/requires-recent-login") {
        showReauth = true;
        error = getErrorMessage(e.code);
      } else {
        error = getErrorMessage(e.code || e.message);
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
      if (auth.currentUser?.email) {
        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          password,
        );
        await reauthenticateWithCredential(auth.currentUser, credential);
        showReauth = false;
        password = "";

        if (pendingAction === "email") {
          await performUpdateEmail();
        } else if (pendingAction === "delete") {
          await handleDeleteAccount();
        }
      }
    } catch (e: any) {
      error = getErrorMessage(e.code || "auth/invalid-credential");
    } finally {
      loading = false;
    }
  }

  async function performUpdateEmail() {
    error = "";
    message = "";
    loading = true;
    try {
      if (auth.currentUser) {
        await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
        message =
          "A verification email has been sent to your new address. Please verify it to complete the change.";
        newEmail = "";
      }
    } catch (e: any) {
      error = getErrorMessage(e.code || e.message);
    } finally {
      loading = false;
    }
  }
</script>

<div>
  <div class="mb-12">
    <h1 class="text-2xl font-bold tracking-tight lowercase">account settings</h1>
    <p class="text-sm text-gray-500 mt-1">Manage your identity and security.</p>
  </div>

  <div class="space-y-12">
    <!-- Security Confirmation -->
    {#if showReauth}
      <div class="border-b border-border/50 pb-10">
        <h2 class="text-lg font-bold tracking-tight lowercase mb-1">security confirmation</h2>
        <p class="mb-8 text-sm text-gray-500">Confirm your password to proceed.</p>

        <form onsubmit={handleReauth} class="max-w-md space-y-6">
          <Input type="password" id="password" label="Password" bind:value={password} placeholder="••••••••" required />
          <div class="flex gap-4">
            <Button type="submit" {loading} className="grow">confirm</Button>
            <Button type="button" variant="ghost" onclick={() => { showReauth = false; password = ""; error = ""; }}>cancel</Button>
          </div>
        </form>
      </div>
    {/if}

    <!-- Email Management -->
    <div class="border-b border-border/50 pb-10">
      <h2 class="text-lg font-bold tracking-tight lowercase mb-8">email address</h2>
      
      {#if !showReauth}<Alert type="error" message={error} />{/if}
      <Alert type="success" {message} />

      <div class="space-y-8">
        <div class="flex flex-col gap-1.5 min-w-0">
          <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/50">current email</span>
          <p class="text-sm font-bold truncate">{authStore.user?.email}</p>
        </div>

        <form onsubmit={handleUpdateEmail} class="space-y-8 pt-8 border-t border-border/30">
          <Input type="email" id="newEmail" label="New Email Address" bind:value={newEmail} disabled={showReauth} placeholder="new@example.com" required />
          <Button type="submit" variant="secondary" disabled={loading || showReauth} className="w-full sm:w-auto">update email</Button>
        </form>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="pb-20">
      <h2 class="text-lg font-bold tracking-tight lowercase text-rose-500 mb-2">danger zone</h2>
      <p class="text-sm text-gray-500 max-w-2xl mb-8">
        Deleting your account is permanent. This will remove all your data, notifications, and integration keys instantly.
      </p>
      <Button variant="danger" onclick={handleDeleteAccount} disabled={loading || showReauth} className="w-full sm:w-auto">delete account</Button>
    </div>
  </div>
</div>
