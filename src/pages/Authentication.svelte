<script lang="ts">
    import {
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        sendPasswordResetEmail,
        sendEmailVerification,
        signOut,
    } from "firebase/auth";
    import { auth } from "../lib/services/firebase";
    import { authStore } from "../lib/stores/authStore.svelte";
    import { getErrorMessage } from "../lib/utils/authErrors";
    import Input from "../lib/components/Input.svelte";
    import Button from "../lib/components/Button.svelte";
    import Alert from "../lib/components/Alert.svelte";

    let mode = $state<"signin" | "signup" | "forgot" | "verify">("signin");
    let email = $state("");
    let password = $state("");
    let error = $state("");
    let message = $state("");
    let loading = $state(false);

    $effect(() => {
        if (authStore.user && !authStore.isVerified) {
            mode = "verify";
        } else if (!authStore.user && mode === "verify") {
            mode = "signin";
        }
    });

    const contentMap = {
        signin: {
            title: "Sign In",
            desc: "Access your notification dashboard",
        },
        signup: { title: "Create Account", desc: "Create an account to continue" },
        forgot: {
            title: "Reset Password",
            desc: "We'll send you a recovery link",
        },
        verify: { title: "Verify your email", desc: "" },
    };

    async function executeAction<T>(action: () => Promise<T>, successMsg = "") {
        error = "";
        message = "";
        loading = true;
        try {
            await action();
            if (successMsg) message = successMsg;
        } catch (e: unknown) {
            error = getErrorMessage(e);
        } finally {
            loading = false;
        }
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();

        if (mode === "signin") {
            await executeAction(() =>
                signInWithEmailAndPassword(auth, email, password),
            );
        } else if (mode === "signup") {
            await executeAction(async () => {
                const cred = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password,
                );
                await sendEmailVerification(cred.user);
                mode = "signin";
            }, "Account created! A verification email has been sent.");
        } else if (mode === "forgot") {
            await executeAction(async () => {
                await sendPasswordResetEmail(auth, email);
                mode = "signin";
            }, "Password reset email sent!");
        }
    }

    async function checkVerification() {
        await executeAction(async () => {
            await authStore.refreshStatus();
        });
        if (!error && !authStore.isVerified) {
            error = "Account still unverified. Please check your inbox.";
        }
    }

    function resend() {
        executeAction(async () => {
            if (auth.currentUser) await sendEmailVerification(auth.currentUser);
        }, "Verification email sent! Please check your inbox.");
    }
</script>

{#snippet passwordLabelRight()}
    {#if mode === "signin"}
        <button
            type="button"
            onclick={() => (mode = "forgot")}
            class="text-xs text-gray-500 hover:underline dark:text-gray-400"
        >
            Forgot password?
        </button>
    {/if}
{/snippet}

<div
    class="flex min-h-svh w-full flex-col overflow-y-auto bg-background px-6 pt-12 pb-24 text-foreground sm:items-center sm:justify-center sm:py-12"
>
    <div class="mx-auto w-full max-w-sm">
        <div class="mb-8 text-center sm:mb-10">
            <h1 class="text-2xl font-bold">{contentMap[mode].title}</h1>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {#if mode === "verify"}
                    We've sent a verification link to <span
                        class="font-semibold text-foreground"
                        >{authStore.user?.email}</span
                    >.
                {:else}
                    {contentMap[mode].desc}
                {/if}
            </p>
        </div>

        <Alert type="error" message={error} />
        <Alert type="success" {message} />

        {#if mode === "verify"}
            <div class="mt-10 space-y-4">
                <Button
                    onclick={checkVerification}
                    {loading}
                    className="w-full"
                >
                    I've verified my email
                </Button>
                <Button
                    variant="secondary"
                    onclick={resend}
                    {loading}
                    className="w-full"
                >
                    Resend verification email
                </Button>
                <button
                    onclick={() => signOut(auth)}
                    class="mt-6 block w-full text-center text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-rose-500"
                >
                    Sign out
                </button>
            </div>
        {:else}
            <form onsubmit={handleSubmit} class="space-y-6">
                <Input
                    type="email"
                    id="email"
                    label="Email Address"
                    bind:value={email}
                    placeholder="name@example.com"
                    required
                />
                {#if mode !== "forgot"}
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
                <Button type="submit" {loading} className="w-full">
                    {contentMap[mode].title}
                </Button>
            </form>

            <div class="mt-8 text-center text-sm">
                {#if mode === "signin"}
                    <span class="text-gray-500 dark:text-gray-400"
                        >Don't have an account?</span
                    >
                    <button
                        onclick={() => (mode = "signup")}
                        class="ml-1 font-semibold text-gray-800 hover:underline dark:text-white"
                    >
                        Sign Up
                    </button>
                {:else}
                    <button
                        onclick={() => (mode = "signin")}
                        class="font-semibold text-gray-800 hover:underline dark:text-white"
                    >
                        Back to Sign In
                    </button>
                {/if}
            </div>
        {/if}
    </div>
</div>
