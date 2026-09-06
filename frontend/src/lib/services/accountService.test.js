import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateEmail, deleteAccount, reauthenticate } from "./accountService";

const mockUser = { email: "test@example.com" };

vi.mock("firebase/auth", () => ({
  verifyBeforeUpdateEmail: vi.fn(),
  deleteUser: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  EmailAuthProvider: {
    credential: vi.fn((email, password) => ({ email, password })),
  },
}));

import { verifyBeforeUpdateEmail, deleteUser, reauthenticateWithCredential } from "firebase/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateEmail", () => {
  it("returns success when email update succeeds", async () => {
    verifyBeforeUpdateEmail.mockResolvedValue(undefined);
    const result = await updateEmail(mockUser, "new@example.com");
    expect(result).toEqual({ success: true });
    expect(verifyBeforeUpdateEmail).toHaveBeenCalledWith(mockUser, "new@example.com");
  });

  it("returns requiresReauth when auth/requires-recent-login is thrown", async () => {
    verifyBeforeUpdateEmail.mockRejectedValue({ code: "auth/requires-recent-login" });
    const result = await updateEmail(mockUser, "new@example.com");
    expect(result).toEqual({ error: "auth/requires-recent-login", requiresReauth: true });
  });

  it("returns error for other errors", async () => {
    verifyBeforeUpdateEmail.mockRejectedValue({ code: "auth/email-already-in-use" });
    const result = await updateEmail(mockUser, "new@example.com");
    expect(result).toEqual({ error: "auth/email-already-in-use" });
  });
});

describe("deleteAccount", () => {
  it("returns success when deletion succeeds", async () => {
    deleteUser.mockResolvedValue(undefined);
    const result = await deleteAccount(mockUser);
    expect(result).toEqual({ success: true });
    expect(deleteUser).toHaveBeenCalledWith(mockUser);
  });

  it("returns requiresReauth when auth/requires-recent-login is thrown", async () => {
    deleteUser.mockRejectedValue({ code: "auth/requires-recent-login" });
    const result = await deleteAccount(mockUser);
    expect(result).toEqual({ error: "auth/requires-recent-login", requiresReauth: true });
  });

  it("returns error for other errors", async () => {
    deleteUser.mockRejectedValue({ code: "auth/operation-not-allowed" });
    const result = await deleteAccount(mockUser);
    expect(result).toEqual({ error: "auth/operation-not-allowed" });
  });
});

describe("reauthenticate", () => {
  it("returns success when reauth succeeds", async () => {
    reauthenticateWithCredential.mockResolvedValue(undefined);
    const result = await reauthenticate(mockUser, "password123");
    expect(result).toEqual({ success: true });
    expect(reauthenticateWithCredential).toHaveBeenCalled();
  });

  it("returns error when reauth fails", async () => {
    reauthenticateWithCredential.mockRejectedValue({ code: "auth/wrong-password" });
    const result = await reauthenticate(mockUser, "wrong");
    expect(result).toEqual({ error: "auth/wrong-password" });
  });
});
