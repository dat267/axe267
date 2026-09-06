import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal.svelte";

describe("Modal", () => {
  it("renders nothing when show is false", () => {
    render(Modal, { props: { show: false } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders content when show is true", () => {
    render(Modal, { props: { show: true } });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(Modal, { props: { show: true, title: "Confirm Delete" } });
    expect(screen.getByText("Confirm Delete")).toBeInTheDocument();
  });

  it("calls onClose when clicking the backdrop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(Modal, { props: { show: true, title: "Test", onClose } });
    const backdrop = document.querySelector('[aria-hidden="true"]');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when pressing Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(Modal, { props: { show: true, title: "Test", onClose } });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has a close button that calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(Modal, { props: { show: true, title: "Test", onClose } });
    const closeBtn = screen.getByLabelText("Close modal");
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hides the close button when showCloseButton is false", () => {
    render(Modal, { props: { show: true, showCloseButton: false } });
    expect(screen.queryByLabelText("Close modal")).not.toBeInTheDocument();
  });

  it("shows the close button in the footer", () => {
    render(Modal, { props: { show: true, title: "Test" } });
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("hides the footer when showFooter is false", () => {
    render(Modal, { props: { show: true, showFooter: false } });
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });
});
