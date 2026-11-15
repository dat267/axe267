import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import NotificationBar from "./NotificationBar.svelte";

vi.mock("../services/notificationService", () => ({
  subscribeNotifications: vi.fn(() => vi.fn()),
  deleteNotification: vi.fn(),
  clearAllNotifications: vi.fn(),
  getNotificationsCount: vi.fn().mockResolvedValue(0),
}));

vi.mock("../utils/notificationPermission.js", () => ({
  requestNotificationPermission: vi.fn(),
  sendLocalNotification: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("NotificationBar", () => {
  it("keeps the existing header button spacing", () => {
    render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
      },
    });

    expect(screen.getByLabelText("Home").parentElement).toHaveClass("gap-2");
    expect(screen.getByLabelText("Cycle theme").parentElement).toHaveClass("gap-2");
  });

  it("renders theme and signout buttons", () => {
    render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
      },
    });
    expect(screen.getByLabelText("Cycle theme")).toBeInTheDocument();
    expect(screen.getByLabelText("Sign out")).toBeInTheDocument();
  });

  it("renders home button", () => {
    render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
      },
    });
    expect(screen.getByLabelText("Home")).toBeInTheDocument();
  });

  it.each([
    ["Home", "/settings"],
    ["Back", "/notifications"],
  ])("navigates to / client-side when %s is clicked", async (label, currentPath) => {
    const user = userEvent.setup();
    history.replaceState({}, "", currentPath);
    const pushState = vi.spyOn(history, "pushState");
    render(NotificationBar, {
      props: {
        currentPath,
        notifications: [],
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
        onClearAll: vi.fn(),
      },
    });

    const clicked = new Promise<Event>((resolve) => {
      screen.getByLabelText(label).addEventListener("click", resolve, { once: true });
    });
    await user.click(screen.getByLabelText(label));
    const event = await clicked;

    expect(event.defaultPrevented).toBe(true);
    expect(pushState).toHaveBeenCalledWith(expect.anything(), "", "/");
    expect(window.location.pathname).toBe("/");
  });

  it("shows disabled back button on home page", () => {
    const { container } = render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
      },
    });
    const backDiv = container.querySelector(".cursor-not-allowed");
    expect(backDiv).toBeInTheDocument();
  });

  it("shows active back button when not on home page", () => {
    render(NotificationBar, {
      props: {
        currentPath: "/notifications",
        notifications: [],
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
        onClearAll: vi.fn(),
      },
    });
    const backLink = screen.getByLabelText("Back");
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("shows clear-all button on notifications page", () => {
    render(NotificationBar, {
      props: {
        currentPath: "/notifications",
        notifications: [{ id: "1" }],
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
        onClearAll: vi.fn(),
      },
    });
    expect(screen.getByLabelText("Clear all notifications")).toBeInTheDocument();
  });

  it("hides clear-all button on non-notifications page", () => {
    render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
      },
    });
    expect(screen.queryByLabelText("Clear all notifications")).not.toBeInTheDocument();
  });

  it("calls onClearAll when clear-all button is clicked twice", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn().mockResolvedValue(undefined);
    render(NotificationBar, {
      props: {
        currentPath: "/notifications",
        notifications: [{ id: "1" }],
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
        onClearAll,
      },
    });
    const btn = screen.getByLabelText("Clear all notifications");
    // First click: shows confirm
    await user.click(btn);
    expect(screen.getByLabelText("Confirm clear all")).toBeInTheDocument();
    // Second click: triggers clear
    await user.click(screen.getByLabelText("Confirm clear all"));
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("disables clear-all button when notifications are empty", () => {
    render(NotificationBar, {
      props: {
        currentPath: "/notifications",
        notifications: [],
        onThemeCycle: vi.fn(),
        onSignOut: vi.fn(),
        onClearAll: vi.fn(),
      },
    });
    expect(screen.getByLabelText("Clear all notifications")).toBeDisabled();
  });

  it("calls onThemeCycle when theme button is clicked", async () => {
    const user = userEvent.setup();
    const onThemeCycle = vi.fn();
    render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle,
        onSignOut: vi.fn(),
      },
    });
    await user.click(screen.getByLabelText("Cycle theme"));
    expect(onThemeCycle).toHaveBeenCalledOnce();
  });

  it("asks for confirmation before signing out", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle: vi.fn(),
        onSignOut,
      },
    });
    await user.click(screen.getByLabelText("Sign out"));
    expect(onSignOut).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "sign out?" });

    await user.click(within(dialog).getByRole("button", { name: "sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not sign out when the prompt is cancelled", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(NotificationBar, {
      props: {
        currentPath: "/",
        onThemeCycle: vi.fn(),
        onSignOut,
      },
    });
    await user.click(screen.getByLabelText("Sign out"));
    await user.click(screen.getByRole("button", { name: "cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSignOut).not.toHaveBeenCalled();
  });
});
