import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "firebase/auth";
import { updateEmail, deleteAccount, reauthenticate } from "./accountService";

const mockUser = { email: "test@example.com" } as unknown as User;

vi.mock("firebase/auth", () => ({
  verifyBeforeUpdateEmail: vi.fn(),
  deleteUser: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  EmailAuthProvider: {
    credential: vi.fn((email: string, password: string) => ({ email, password })),
  },
}));

import { verifyBeforeUpdateEmail, deleteUser, reauthenticateWithCredential } from "firebase/auth";

const updateEmailMock = vi.mocked(verifyBeforeUpdateEmail);
const deleteUserMock = vi.mocked(deleteUser);
const reauthMock = vi.mocked(reauthenticateWithCredential);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateEmail", () => {
  it("returns success when email update succeeds", async () => {
    updateEmailMock.mockResolvedValue(undefined);
    const result = await updateEmail(mockUser, "new@example.com");
    expect(result).toEqual({ success: true });
    expect(updateEmailMock).toHaveBeenCalledWith(mockUser, "new@example.com");
  });

  it("returns requiresReauth when auth/requires-recent-login is thrown", async () => {
    updateEmailMock.mockRejectedValue({ code: "auth/requires-recent-login" });
    const result = await updateEmail(mockUser, "new@example.com");
    expect(result).toEqual({ error: "auth/requires-recent-login", requiresReauth: true });
  });

  it("returns error for other errors", async () => {
    updateEmailMock.mockRejectedValue({ code: "auth/email-already-in-use" });
    const result = await updateEmail(mockUser, "new@example.com");
    expect(result).toEqual({ error: "auth/email-already-in-use" });
  });
});

describe("deleteAccount", () => {
  it("returns success when deletion succeeds", async () => {
    deleteUserMock.mockResolvedValue(undefined);
    const result = await deleteAccount(mockUser);
    expect(result).toEqual({ success: true });
    expect(deleteUserMock).toHaveBeenCalledWith(mockUser);
  });

  it("returns requiresReauth when auth/requires-recent-login is thrown", async () => {
    deleteUserMock.mockRejectedValue({ code: "auth/requires-recent-login" });
    const result = await deleteAccount(mockUser);
    expect(result).toEqual({ error: "auth/requires-recent-login", requiresReauth: true });
  });

  it("returns error for other errors", async () => {
    deleteUserMock.mockRejectedValue({ code: "auth/operation-not-allowed" });
    const result = await deleteAccount(mockUser);
    expect(result).toEqual({ error: "auth/operation-not-allowed" });
  });
});

describe("reauthenticate", () => {
  it("returns success when reauth succeeds", async () => {
    reauthMock.mockResolvedValue({} as Awaited<ReturnType<typeof reauthenticateWithCredential>>);
    const result = await reauthenticate(mockUser, "password123");
    expect(result).toEqual({ success: true });
    expect(reauthMock).toHaveBeenCalled();
  });

  it("returns error when reauth fails", async () => {
    reauthMock.mockRejectedValue({ code: "auth/wrong-password" });
    const result = await reauthenticate(mockUser, "wrong");
    expect(result).toEqual({ error: "auth/wrong-password" });
  });
});
