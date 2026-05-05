<script lang="ts">
  import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification
  } from "firebase/auth";
  import { auth } from "./firebase";
  import { getErrorMessage } from "./authErrors";
  import Input from "./ui/Input.svelte";
  import Button from "./ui/Button.svelte";
  import Alert from "./ui/Alert.svelte";

  let mode = $state<"signin" | "signup" | "forgot">("signin");
  let email = $state("");
  let password = $state("");
  let error = $state("");
  let message = $state("");
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    message = "";
    loading = true;

    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        message = "Account created! A verification email has been sent.";
        mode = "signin";
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        message = "Password reset email sent!";
        mode = "signin";
      }
    } catch (e: any) {
      error = getErrorMessage(e.code || e.message);
    } finally {
      loading = false;
    }
  }
</script>

{#snippet passwordLabelRight()}
  {#if mode === 'signin'}
    <button type="button" onclick={() => mode = 'forgot'} class="text-xs text-blue-600 hover:underline dark:text-blue-400">Forgot password?</button>
  {/if}
{/snippet}

<div class="flex min-h-svh w-full flex-col overflow-y-auto bg-background px-6 pt-12 pb-24 text-foreground sm:items-center sm:justify-center sm:py-12">
  <div class="mx-auto w-full max-w-sm">
    <div class="mb-8 text-center sm:mb-10">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      </div>
      <h1 class="text-2xl font-bold">
        {#if mode === 'signin'}Sign In{:else if mode === 'signup'}Create Account{:else}Reset Password{/if}
      </h1>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {#if mode === 'signin'}Access your notification dashboard{:else if mode === 'signup'}Join NotifiDash today{:else}We'll send you a recovery link{/if}
      </p>
    </div>

    <Alert type="error" message={error} />
    <Alert type="success" message={message} />

    <form onsubmit={handleSubmit} class="space-y-6">
      <Input
        type="email"
        id="email"
        label="Email Address"
        bind:value={email}
        placeholder="name@example.com"
        required
      />

      {#if mode !== 'forgot'}
        <Input
          type="password"
          id="password"
          label="Password"
          bind:value={password}
          placeholder="••••••••"
          required
          labelRight={passwordLabelRight}
        />
      {/if}

      <Button type="submit" loading={loading} className="w-full">
        {#if mode === 'signin'}Sign In{:else if mode === 'signup'}Create Account{:else}Send Reset Link{/if}
      </Button>
    </form>

    <div class="mt-8 text-center text-sm">
      {#if mode === 'signin'}
        <span class="text-gray-500 dark:text-gray-400">Don't have an account?</span>
        <button onclick={() => mode = 'signup'} class="ml-1 font-semibold text-blue-600 hover:underline dark:text-blue-400">Sign Up</button>
      {:else}
        <button onclick={() => mode = 'signin'} class="font-semibold text-blue-600 hover:underline dark:text-blue-400">Back to Sign In</button>
      {/if}
    </div>
  </div>
</div>
