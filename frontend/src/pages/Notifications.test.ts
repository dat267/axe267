import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Notifications from "./Notifications.svelte";

const notification = {
  id: "n1",
  userEmail: "user@example.com",
  title: "Build",
  message: "Done",
  source: "CI",
  type: "info",
  category: "system",
  createdAt: null,
};

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Notifications", () => {
  it("does not open the detail modal when Enter activates dismiss", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(Notifications, { props: { notifications: [notification], onDismiss } });

    const dismiss = screen.getByLabelText("Dismiss notification");
    dismiss.focus();
    await user.keyboard("{Enter}");

    expect(onDismiss).toHaveBeenCalledWith("n1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
