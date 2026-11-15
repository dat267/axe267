import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Auth, User, UserCredential } from "firebase/auth";
import { signIn, signUp, resetPassword, sendVerification } from "./authService";

const mockUser = { email: "test@example.com" } as unknown as User;
const mockAuth = { currentUser: mockUser } as unknown as Auth;

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

const signInMock = vi.mocked(signInWithEmailAndPassword);
const signUpMock = vi.mocked(createUserWithEmailAndPassword);
const resetMock = vi.mocked(sendPasswordResetEmail);
const verifyMock = vi.mocked(sendEmailVerification);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signIn", () => {
  it("returns success on valid credentials", async () => {
    signInMock.mockResolvedValue({ user: mockUser } as unknown as UserCredential);
    const result = await signIn(mockAuth, "test@example.com", "password");
    expect(result).toEqual({ success: true });
    expect(signInMock).toHaveBeenCalledWith(mockAuth, "test@example.com", "password");
  });

  it("returns error on invalid credentials", async () => {
    signInMock.mockRejectedValue({ code: "auth/user-not-found" });
    const result = await signIn(mockAuth, "test@example.com", "wrong");
    expect(result).toEqual({ error: "auth/user-not-found" });
  });
});

describe("signUp", () => {
  it("returns success with user on creation", async () => {
    signUpMock.mockResolvedValue({ user: mockUser } as unknown as UserCredential);
    const result = await signUp(mockAuth, "new@example.com", "password");
    expect(result).toEqual({ success: true, user: mockUser });
    expect(signUpMock).toHaveBeenCalledWith(mockAuth, "new@example.com", "password");
  });

  it("returns error on existing email", async () => {
    signUpMock.mockRejectedValue({
      code: "auth/email-already-in-use",
    });
    const result = await signUp(mockAuth, "existing@example.com", "password");
    expect(result).toEqual({ error: "auth/email-already-in-use" });
  });
});

describe("resetPassword", () => {
  it("returns success when email is sent", async () => {
    resetMock.mockResolvedValue(undefined);
    const result = await resetPassword(mockAuth, "test@example.com");
    expect(result).toEqual({ success: true });
    expect(resetMock).toHaveBeenCalledWith(mockAuth, "test@example.com");
  });

  it("returns error on failure", async () => {
    resetMock.mockRejectedValue({
      code: "auth/user-not-found",
    });
    const result = await resetPassword(mockAuth, "missing@example.com");
    expect(result).toEqual({ error: "auth/user-not-found" });
  });
});

describe("sendVerification", () => {
  it("returns success when email is sent", async () => {
    verifyMock.mockResolvedValue(undefined);
    const result = await sendVerification(mockUser);
    expect(result).toEqual({ success: true });
    expect(verifyMock).toHaveBeenCalledWith(mockUser);
  });

  it("returns error on failure", async () => {
    verifyMock.mockRejectedValue({ code: "auth/too-many-requests" });
    const result = await sendVerification(mockUser);
    expect(result).toEqual({ error: "auth/too-many-requests" });
  });
});
