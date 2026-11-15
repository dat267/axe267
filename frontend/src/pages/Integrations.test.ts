import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/services/firebase", () => ({ auth: { currentUser: null } }));
vi.mock("../lib/stores/authStore.svelte.ts", () => ({
  authStore: { user: { uid: "user-1", email: "user@example.com" } },
}));
vi.mock("../lib/services/apiKeyService", () => ({
  createApiKey: vi.fn(),
  subscribeApiKeys: vi.fn(() => () => {}),
  deleteApiKey: vi.fn(),
}));

import Integrations from "./Integrations.svelte";

afterEach(() => {
  cleanup();
});

function payloadFromCurlCommand(command: string) {
  const match = command.match(/-d '([\s\S]*)'$/);
  if (!match) throw new Error("Could not find the -d payload");
  return JSON.parse(match[1].replace(/'\\''/g, "'"));
}

describe("Integrations generated curl command", () => {
  it("keeps the payload valid when fields contain quotes", async () => {
    const user = userEvent.setup();
    render(Integrations);

    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, `A "quoted" title's`);

    const command = document.querySelector("pre code")?.textContent ?? "";
    expect(command).toContain("curl -X POST");

    const payload = payloadFromCurlCommand(command);
    expect(payload).toMatchObject({
      type: "info",
      source: "CLI",
      title: `A "quoted" title's`,
      message: "Message from curl",
      category: "system",
    });
  });
});
