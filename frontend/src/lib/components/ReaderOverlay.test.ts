import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import userEvent from "@testing-library/user-event";
import ReaderOverlay from "./ReaderOverlay.svelte";
import type { EpubSearchResult } from "epubjs";

interface PendingSearch {
  query: string;
  resolve: (results: EpubSearchResult[]) => void;
}

describe("ReaderOverlay", () => {
  it("renders header with book title", () => {
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test Book",
        onClose: vi.fn(),
      },
    });
    expect(screen.getByText("Test Book")).toBeInTheDocument();
  });

  it("keeps the full book title available when the narrow header truncates it", () => {
    const title = "An unusually long title that should not push the reader controls off screen";
    render(ReaderOverlay, {
      props: {
        currentBookName: title,
        onClose: vi.fn(),
      },
    });

    const titleElement = screen.getByText(title);
    expect(titleElement).toHaveAttribute("title", title);
    expect(titleElement).toHaveClass("block", "truncate");
    expect(screen.getByLabelText("Close reader")).toBeInTheDocument();
  });

  it("shows progress percentage when > 0", () => {
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        progress: 0.42,
        onClose: vi.fn(),
      },
    });
    expect(screen.getByText("42% read")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        onClose,
      },
    });
    await user.click(screen.getByLabelText("Close reader"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onNext and onPrev via footer buttons", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        onClose: vi.fn(),
        onNext,
        onPrev,
      },
    });
    await user.click(screen.getByLabelText("Next"));
    expect(onNext).toHaveBeenCalledOnce();
    await user.click(screen.getByLabelText("Prev"));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("toggles toc panel when toc button is clicked", async () => {
    const user = userEvent.setup();
    const toc = [{ label: "Chapter 1", target: "epubcfi(/6/2)", level: 0 }];
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        toc,
        onClose: vi.fn(),
        onJumpTo: vi.fn(),
      },
    });
    // TOC panel should not be visible initially
    expect(screen.queryByText("contents")).not.toBeInTheDocument();
    // Click the TOC button
    const tocBtn = screen.getByLabelText("Table of contents");
    await user.click(tocBtn);
    // TOC panel should now be visible
    expect(screen.getByText("contents")).toBeInTheDocument();
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
  });

  it("toggles search panel when search button is clicked", async () => {
    const user = userEvent.setup();
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        onClose: vi.fn(),
        onSearch: vi.fn(),
      },
    });
    expect(screen.queryByText("find keyword")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Search book"));
    expect(screen.getByText("find keyword")).toBeInTheDocument();
  });

  it("toggles settings panel when settings button is clicked", async () => {
    const user = userEvent.setup();
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        onClose: vi.fn(),
        onApplyTypography: vi.fn(),
        onSwitchFlow: vi.fn(),
      },
    });
    expect(screen.queryByText("font size (px)")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Typography settings"));
    expect(screen.getByText("font size (px)")).toBeInTheDocument();
  });

  it("calls onSearch when search is submitted", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn().mockResolvedValue([]);
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        onClose: vi.fn(),
        onSearch,
      },
    });
    // Open search panel
    await user.click(screen.getByLabelText("Search book"));
    // Type a query
    const input = screen.getByLabelText("find keyword");
    await user.type(input, "hello");
    // Press enter
    await user.keyboard("{Enter}");
    expect(onSearch).toHaveBeenCalledWith("hello");
  });

  it("ignores stale search results after a newer search", async () => {
    const user = userEvent.setup();
    const pending: PendingSearch[] = [];
    const onSearch = vi.fn(
      (query: string) =>
        new Promise<EpubSearchResult[]>((resolve) => {
          pending.push({ query, resolve });
        }),
    );
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        onClose: vi.fn(),
        onSearch,
      },
    });

    await user.click(screen.getByLabelText("Search book"));
    const input = screen.getByLabelText("find keyword");
    await user.type(input, "first");
    await user.keyboard("{Enter}");
    await user.clear(input);
    await user.type(input, "second");
    await user.keyboard("{Enter}");

    expect(onSearch).toHaveBeenNthCalledWith(1, "first");
    expect(onSearch).toHaveBeenNthCalledWith(2, "second");

    pending[1].resolve([{ cfi: "epubcfi(/6/2)", excerpt: "second result" }]);
    await Promise.resolve();
    await tick();
    expect(screen.getByText(/\.\.\.second result\.\.\./)).toBeInTheDocument();

    pending[0].resolve([{ cfi: "epubcfi(/6/4)", excerpt: "first result" }]);
    await Promise.resolve();
    await tick();
    expect(screen.queryByText(/\.\.\.first result\.\.\./)).not.toBeInTheDocument();
    expect(screen.getByText(/\.\.\.second result\.\.\./)).toBeInTheDocument();
  });

  it("calls onJumpTo when a toc item is clicked", async () => {
    const user = userEvent.setup();
    const onJumpTo = vi.fn();
    const toc = [{ label: "Chapter 1", target: "epubcfi(/6/2)", level: 0 }];
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        toc,
        onClose: vi.fn(),
        onJumpTo,
      },
    });
    await user.click(screen.getByLabelText("Table of contents"));
    await user.click(screen.getByText("Chapter 1"));
    expect(onJumpTo).toHaveBeenCalledWith("epubcfi(/6/2)");
  });

  it("calls onThemeCycle when theme button is clicked", async () => {
    const user = userEvent.setup();
    const onThemeCycle = vi.fn();
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        onClose: vi.fn(),
        onThemeCycle,
      },
    });
    await user.click(screen.getByLabelText("Cycle theme"));
    expect(onThemeCycle).toHaveBeenCalledOnce();
  });

  it("applies default typography when reset defaults is clicked", async () => {
    const user = userEvent.setup();
    const onApplyTypography = vi.fn();
    render(ReaderOverlay, {
      props: {
        currentBookName: "Test",
        fontSize: 24,
        fontFamily: "ui-monospace, monospace",
        lineHeight: 2,
        onClose: vi.fn(),
        onApplyTypography,
        onSwitchFlow: vi.fn(),
      },
    });

    await user.click(screen.getByLabelText("Typography settings"));
    await user.click(screen.getByText("reset defaults"));

    expect(onApplyTypography).toHaveBeenCalledWith({
      fontSize: 16,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      lineHeight: 1.5,
    });
  });
});

describe("ReaderOverlay contents panel", () => {
  const toc = [
    { label: "Chapter 1", target: "epubcfi(/6/2)", level: 0 },
    { label: "A Section With No Target", target: "", level: 1 },
    { label: "Chapter 2", target: "epubcfi(/6/4)", level: 1 },
  ];

  it("closes the contents panel after a chapter is selected", async () => {
    const user = userEvent.setup();
    const onJumpTo = vi.fn();
    render(ReaderOverlay, {
      props: { currentBookName: "Test", toc, onClose: vi.fn(), onJumpTo },
    });

    await user.click(screen.getByLabelText("Table of contents"));
    await user.click(screen.getByRole("button", { name: "Chapter 1" }));
    await tick();

    expect(onJumpTo).toHaveBeenCalledWith("epubcfi(/6/2)");
    expect(screen.queryByText("contents")).not.toBeInTheDocument();
  });

  it("marks the selected chapter busy while the jump is in flight", async () => {
    const user = userEvent.setup();
    let resolveJump!: (value: void) => void;
    const onJumpTo = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveJump = resolve;
        }),
    );
    render(ReaderOverlay, {
      props: { currentBookName: "Test", toc, onClose: vi.fn(), onJumpTo },
    });

    await user.click(screen.getByLabelText("Table of contents"));
    const chapter = screen.getByRole("button", { name: "Chapter 1" });
    await user.click(chapter);

    expect(chapter).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("contents")).toBeInTheDocument();

    resolveJump();
    await vi.waitFor(() => expect(screen.queryByText("contents")).not.toBeInTheDocument());
  });

  it("keeps the panel open and reports a failed jump", async () => {
    const user = userEvent.setup();
    const onJumpTo = vi.fn().mockResolvedValue(false);
    render(ReaderOverlay, {
      props: { currentBookName: "Test", toc, onClose: vi.fn(), onJumpTo },
    });

    await user.click(screen.getByLabelText("Table of contents"));
    await user.click(screen.getByRole("button", { name: "Chapter 1" }));
    await tick();

    expect(screen.getByText("contents")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not open that chapter");
  });

  it("does not present entries without a target as clickable", async () => {
    const user = userEvent.setup();
    const onJumpTo = vi.fn();
    render(ReaderOverlay, {
      props: { currentBookName: "Test", toc, onClose: vi.fn(), onJumpTo },
    });

    await user.click(screen.getByLabelText("Table of contents"));
    const group = screen.getByText("A Section With No Target");
    expect(screen.queryByRole("button", { name: "A Section With No Target" })).not.toBeInTheDocument();
    expect(group).toHaveAttribute("aria-disabled", "true");

    await user.click(group);
    expect(onJumpTo).not.toHaveBeenCalled();
  });

  it("labels the close control, moves focus into the panel, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(ReaderOverlay, {
      props: { currentBookName: "Test", toc, onClose: vi.fn(), onJumpTo: vi.fn() },
    });

    const toggle = screen.getByLabelText("Table of contents");
    await user.click(toggle);
    await tick();
    expect(screen.getByLabelText("Close contents")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("contents")).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("closes the contents panel from its close button", async () => {
    const user = userEvent.setup();
    render(ReaderOverlay, {
      props: { currentBookName: "Test", toc, onClose: vi.fn(), onJumpTo: vi.fn() },
    });

    await user.click(screen.getByLabelText("Table of contents"));
    await user.click(screen.getByLabelText("Close contents"));
    expect(screen.queryByText("contents")).not.toBeInTheDocument();
  });

  it("shows an empty state when the book has no contents", async () => {
    const user = userEvent.setup();
    render(ReaderOverlay, {
      props: { currentBookName: "Test", toc: [], onClose: vi.fn() },
    });

    await user.click(screen.getByLabelText("Table of contents"));
    expect(screen.getByText("No contents available.")).toBeInTheDocument();
  });
});
