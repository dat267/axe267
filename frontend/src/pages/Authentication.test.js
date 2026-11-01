import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

vi.mock("firebase/auth", () => ({ signOut: vi.fn() }));
vi.mock("../lib/services/firebase", () => ({ auth: { currentUser: null } }));
vi.mock("../lib/stores/authStore.svelte.js", () => ({
  authStore: { user: null, isVerified: false, refreshStatus: vi.fn() },
}));
vi.mock("../lib/services/authService", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
  sendVerification: vi.fn(),
}));

import Authentication from "./Authentication.svelte";
import { signUp, sendVerification } from "../lib/services/authService";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Authentication sign up", () => {
  it("does not claim the verification email was sent when sending fails", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ success: true, user: { uid: "user-1" } });
    sendVerification.mockResolvedValue({ error: "auth/too-many-requests" });

    render(Authentication);

    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await user.type(screen.getByLabelText("Email Address"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "create account" }));

    expect(await screen.findByText(/verification email could not be sent/i)).toBeInTheDocument();
    expect(screen.queryByText(/A verification email has been sent/)).not.toBeInTheDocument();
  });
});
