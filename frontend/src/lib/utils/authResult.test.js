import { describe, it, expect } from "vitest";
import { runAuthOp } from "./authResult";

describe("runAuthOp", () => {
  it("returns success when the operation resolves with no extra data", async () => {
    expect(await runAuthOp(async () => {})).toEqual({ success: true });
  });

  it("merges the operation's return value into the success result", async () => {
    expect(await runAuthOp(async () => ({ user: { uid: "u1" } }))).toEqual({
      success: true,
      user: { uid: "u1" },
    });
  });

  it("returns error code when the operation rejects with a code", async () => {
    expect(
      await runAuthOp(async () => {
        throw { code: "auth/wrong-password" };
      }),
    ).toEqual({
      error: "auth/wrong-password",
    });
  });

  it("falls back to the error message when no code is present", async () => {
    expect(
      await runAuthOp(async () => {
        throw new Error("network down");
      }),
    ).toEqual({
      error: "network down",
    });
  });

  it("flags requiresReauth for auth/requires-recent-login when reauthable", async () => {
    expect(
      await runAuthOp(
        async () => {
          throw { code: "auth/requires-recent-login" };
        },
        { reauthable: true },
      ),
    ).toEqual({ error: "auth/requires-recent-login", requiresReauth: true });
  });

  it("does not flag requiresReauth for other errors when reauthable", async () => {
    expect(
      await runAuthOp(
        async () => {
          throw { code: "auth/other" };
        },
        { reauthable: true },
      ),
    ).toEqual({
      error: "auth/other",
    });
  });

  it("does not flag requiresReauth when not reauthable", async () => {
    expect(
      await runAuthOp(async () => {
        throw { code: "auth/requires-recent-login" };
      }),
    ).toEqual({
      error: "auth/requires-recent-login",
    });
  });
});
