<script lang="ts">
  import {
    verifyBeforeUpdateEmail,
    reauthenticateWithCredential,
    EmailAuthProvider,
    deleteUser,
  } from "firebase/auth";
  import { auth } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte";
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
          // Manually trigger the follow-up action without passing an event
          // since handleUpdateEmail now expects one. We can just call the logic.
          // Alternatively, we can refactor the logic out.
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
    <h1 class="text-2xl font-bold tracking-tight">Account Settings</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400">Manage your profile, security, and preferences</p>
  </div>

  <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
    <!-- Main Settings Area -->
    <div class="lg:col-span-8 space-y-8">
      {#if showReauth}
        <section class="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 class="text-lg font-semibold text-foreground mb-1">
            Security Confirmation
          </h2>
          <p class="mb-6 text-sm text-gray-500">
            For your security, please confirm your password to proceed.
          </p>

          <form onsubmit={handleReauth} class="max-w-md space-y-4">
            <Input
              type="password"
              id="password"
              label="Password"
              bind:value={password}
              placeholder="••••••••"
              required
            />
            <div class="flex gap-3 pt-2">
              <Button type="submit" {loading} className="grow">
                Confirm
              </Button>
              <Button
                type="button"
                variant="ghost"
                onclick={() => {
                  showReauth = false;
                  password = "";
                  error = "";
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </section>
      {/if}

      <section class="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 class="mb-6 text-lg font-semibold">Email Address</h2>

        {#if !showReauth}
          <Alert type="error" message={error} />
        {/if}
        <Alert type="success" {message} />

        <div class="space-y-6">
          <div class="flex flex-col gap-1 min-w-0">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Current Email</span>
            <p class="text-sm font-medium truncate">{authStore.user?.email}</p>
          </div>

          <form onsubmit={handleUpdateEmail} class="space-y-6 pt-6 border-t border-border">
            <Input
              type="email"
              id="newEmail"
              label="New Email Address"
              bind:value={newEmail}
              disabled={showReauth}
              placeholder="new@example.com"
              required
            />
            <div class="flex justify-start">
              <Button
                type="submit"
                variant="secondary"
                disabled={loading || showReauth}
                className="w-full sm:w-auto"
              >
                Update Email
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section class="rounded-xl border border-rose-500/20 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-rose-600 dark:text-rose-400">
          Danger Zone
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Deleting your account is permanent and cannot be undone. All your notifications, notes, and API keys will be lost.
        </p>
        <div class="mt-6 flex justify-start">
          <Button
            variant="danger"
            onclick={handleDeleteAccount}
            disabled={loading || showReauth}
            className="w-full sm:w-auto"
          >
            Delete Account
          </Button>
        </div>
      </section>
    </div>

    <!-- Sidebar / Info Area -->
    <div class="lg:col-span-4 space-y-6">
      <div class="rounded-xl border border-border bg-gray-500/5 p-6">
        <h3 class="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Account Stats</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500">Status</span>
            <span class="font-medium text-emerald-600">Active</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500">Member Since</span>
            <span class="font-medium text-foreground">
              {authStore.user?.metadata.creationTime ? new Date(authStore.user.metadata.creationTime).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
