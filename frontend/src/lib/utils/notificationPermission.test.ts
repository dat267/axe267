import { afterEach, describe, expect, it, vi } from "vitest";
import { sendLocalNotification } from "./notificationPermission";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendLocalNotification", () => {
  it("does not throw when the browser has no Notification API", () => {
    vi.stubGlobal("Notification", undefined);

    expect(() => sendLocalNotification("Build finished", { body: "ok" })).not.toThrow();
  });

  it("does not throw when the browser cannot construct notifications", () => {
    vi.stubGlobal(
      "Notification",
      class {
        static permission = "granted";
        constructor() {
          throw new TypeError("Illegal constructor");
        }
      },
    );

    expect(() => sendLocalNotification("Build finished", { body: "ok" })).not.toThrow();
  });
});
