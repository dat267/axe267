import { describe, it, expect, vi, beforeEach } from "vitest";
import { signIn, signUp, resetPassword, sendVerification } from "./authService";

const mockUser = { email: "test@example.com" };
const mockAuth = { currentUser: mockUser };

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
}));

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signIn", () => {
  it("returns success on valid credentials", async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    const result = await signIn(mockAuth, "test@example.com", "password");
    expect(result).toEqual({ success: true });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      "test@example.com",
      "password",
    );
  });

  it("returns error on invalid credentials", async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: "auth/user-not-found" });
    const result = await signIn(mockAuth, "test@example.com", "wrong");
    expect(result).toEqual({ error: "auth/user-not-found" });
  });
});

describe("signUp", () => {
  it("returns success with user on creation", async () => {
    createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    const result = await signUp(mockAuth, "new@example.com", "password");
    expect(result).toEqual({ success: true, user: mockUser });
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      "new@example.com",
      "password",
    );
  });

  it("returns error on existing email", async () => {
    createUserWithEmailAndPassword.mockRejectedValue({
      code: "auth/email-already-in-use",
    });
    const result = await signUp(mockAuth, "existing@example.com", "password");
    expect(result).toEqual({ error: "auth/email-already-in-use" });
  });
});

describe("resetPassword", () => {
  it("returns success when email is sent", async () => {
    sendPasswordResetEmail.mockResolvedValue(undefined);
    const result = await resetPassword(mockAuth, "test@example.com");
    expect(result).toEqual({ success: true });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      mockAuth,
      "test@example.com",
    );
  });

  it("returns error on failure", async () => {
    sendPasswordResetEmail.mockRejectedValue({
      code: "auth/user-not-found",
    });
    const result = await resetPassword(mockAuth, "missing@example.com");
    expect(result).toEqual({ error: "auth/user-not-found" });
  });
});

describe("sendVerification", () => {
  it("returns success when email is sent", async () => {
    sendEmailVerification.mockResolvedValue(undefined);
    const result = await sendVerification(mockUser);
    expect(result).toEqual({ success: true });
    expect(sendEmailVerification).toHaveBeenCalledWith(mockUser);
  });

  it("returns error on failure", async () => {
    sendEmailVerification.mockRejectedValue({ code: "auth/too-many-requests" });
    const result = await sendVerification(mockUser);
    expect(result).toEqual({ error: "auth/too-many-requests" });
  });
});