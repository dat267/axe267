import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Lazy from "./Lazy.svelte";
import Alert from "./Alert.svelte";

afterEach(() => {
  cleanup();
});

describe("Lazy", () => {
  it("shows a retry action when a route chunk fails to load", async () => {
    const user = userEvent.setup();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockImplementationOnce(() => new Promise(() => {}));

    render(Lazy, { props: { load } });

    expect(await screen.findByText("failed to load")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "retry" }));
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText("loading...")).toBeInTheDocument();
  });

  it("keeps the current route visible while a replacement loader is pending", async () => {
    const loadFirst = vi.fn().mockResolvedValue({ default: Alert });
    const { rerender } = render(Lazy, {
      props: { load: loadFirst, message: "loaded page" },
    });

    expect(await screen.findByText("loaded page")).toBeInTheDocument();

    const loadSecond = vi.fn(() => new Promise<{ default: unknown }>(() => {}));
    await rerender({ load: loadSecond, message: "loaded page" });

    expect(screen.getByText("loaded page")).toBeInTheDocument();
  });
});
