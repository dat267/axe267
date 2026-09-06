import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ReaderOverlay from "./ReaderOverlay.svelte";

const mockRenderer = {
  next: vi.fn(),
  prev: vi.fn(),
  jumpTo: vi.fn(),
  search: vi.fn().mockResolvedValue([]),
  applyTypography: vi.fn(),
  rendition: {},
};

describe("ReaderOverlay", () => {
  it("renders header with book title", () => {
    render(ReaderOverlay, {
      props: {
        renderer: mockRenderer,
        currentBookName: "Test Book",
        onClose: vi.fn(),
      },
    });
    expect(screen.getByText("Test Book")).toBeInTheDocument();
  });

  it("shows progress percentage when > 0", () => {
    render(ReaderOverlay, {
      props: {
        renderer: mockRenderer,
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
        renderer: mockRenderer,
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
        renderer: mockRenderer,
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
        renderer: mockRenderer,
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
        renderer: mockRenderer,
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
        renderer: mockRenderer,
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
        renderer: mockRenderer,
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

  it("calls onJumpTo when a toc item is clicked", async () => {
    const user = userEvent.setup();
    const onJumpTo = vi.fn();
    const toc = [{ label: "Chapter 1", target: "epubcfi(/6/2)", level: 0 }];
    render(ReaderOverlay, {
      props: {
        renderer: mockRenderer,
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
        renderer: mockRenderer,
        currentBookName: "Test",
        onClose: vi.fn(),
        onThemeCycle,
      },
    });
    await user.click(screen.getByLabelText("Cycle theme"));
    expect(onThemeCycle).toHaveBeenCalledOnce();
  });
});
