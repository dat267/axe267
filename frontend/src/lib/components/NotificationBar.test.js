import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/svelte";
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
        notifications: [{ id: "1", title: "Test" }],
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
        notifications: [{ id: "1", title: "Test" }],
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

  it("calls onSignOut when signout button is clicked", async () => {
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
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
