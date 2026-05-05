<script lang="ts">
  import { 
    verifyBeforeUpdateEmail, 
    reauthenticateWithCredential, 
    EmailAuthProvider,
    deleteUser 
  } from "firebase/auth";
  import { auth } from "./firebase";
  import { authStore } from "./authStore.svelte";
  import { getErrorMessage } from "./authErrors";
  import Input from "./ui/Input.svelte";
  import Button from "./ui/Button.svelte";
  import Alert from "./ui/Alert.svelte";

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
        message = "A verification email has been sent to your new address. Please verify it to complete the change.";
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
    if (!confirm("Are you absolutely sure? This action is permanent and cannot be undone.")) return;
    
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
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
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
        message = "A verification email has been sent to your new address. Please verify it to complete the change.";
        newEmail = "";
      }
    } catch (e: any) {
      error = getErrorMessage(e.code || e.message);
    } finally {
      loading = false;
    }
  }
</script>

<div class="mx-auto w-full max-w-2xl p-4 md:p-8">
  <div class="mb-10">
    <h1 class="text-2xl font-bold">Account Settings</h1>
    <p class="text-sm text-gray-400">Manage your profile and security</p>
  </div>

  {#if showReauth}
    <div class="mb-10 border-b border-border pb-10">
      <h2 class="text-lg font-semibold text-blue-600 dark:text-blue-400">Security Confirmation</h2>
      <p class="mb-6 text-sm text-gray-500">For your security, please confirm your password to proceed with this sensitive action.</p>
      
      <form onsubmit={handleReauth} class="max-w-md space-y-4">
        <Input
          type="password"
          id="password"
          label="Password"
          bind:value={password}
          placeholder="••••••••"
          required
        />
        <div class="flex gap-4 pt-2">
          <Button type="submit" loading={loading} className="flex-grow">
            Confirm Password
          </Button>
          <Button
            type="button"
            variant="ghost"
            onclick={() => { showReauth = false; password = ""; error = ""; }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  {/if}

  <div class="space-y-12">
    <section>
      <h2 class="mb-6 text-lg font-semibold">Email Address</h2>
      
      {#if !showReauth}
        <Alert type="error" message={error} />
      {/if}
      <Alert type="success" message={message} />

      <div class="max-w-md space-y-6">
        <div>
          <span class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Current Email</span>
          <p class="font-medium">{authStore.user?.email}</p>
        </div>

        <form onsubmit={handleUpdateEmail} class="space-y-4 pt-2 border-t border-border">
          <Input
            type="email"
            id="newEmail"
            label="New Email Address"
            bind:value={newEmail}
            disabled={showReauth}
            placeholder="new@example.com"
            required
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={loading || showReauth}
          >
            Update Email
          </Button>
        </form>
      </div>
    </section>

    <section class="pt-10 border-t border-border">
      <h2 class="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
      <p class="mt-1 text-sm text-gray-500">Deleting your account is permanent and cannot be undone.</p>
      <div class="mt-6">
        <Button 
          variant="danger"
          onclick={handleDeleteAccount}
          disabled={loading || showReauth}
        >
          Delete Account
        </Button>
      </div>
    </section>
  </div>
</div>
