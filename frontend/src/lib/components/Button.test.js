import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { text } from "./test-utils.js";
import Button from "./Button.svelte";

describe("Button", () => {
  it("renders children text", () => {
    render(Button, { props: { children: text("Click me") } });
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("applies the primary variant by default", () => {
    render(Button, { props: { children: text("Save") } });
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-foreground");
  });

  it("applies secondary variant", () => {
    render(Button, { props: { variant: "secondary", children: text("Cancel") } });
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-surface");
  });

  it("applies danger variant", () => {
    render(Button, { props: { variant: "danger", children: text("Delete") } });
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-rose-500");
  });

  it("applies ghost variant", () => {
    render(Button, { props: { variant: "ghost", children: text("Ghost") } });
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("text-gray-500");
  });

  it("disables the button when disabled prop is true", () => {
    render(Button, { props: { disabled: true, children: text("Disabled") } });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables the button when loading prop is true", () => {
    render(Button, { props: { loading: true, children: text("Loading") } });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loading text instead of children when loading", () => {
    render(Button, { props: { loading: true, children: text("Submit") } });
    expect(screen.getByText("loading...")).toBeInTheDocument();
    expect(screen.queryByText("Submit")).not.toBeInTheDocument();
  });

  it("calls onclick when clicked", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(Button, { props: { children: text("Click"), onclick: () => { clicked = true; } } });
    await user.click(screen.getByRole("button"));
    expect(clicked).toBe(true);
  });

  it("does not call onclick when disabled", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(Button, { props: { disabled: true, children: text("Click"), onclick: () => { clicked = true; } } });
    await user.click(screen.getByRole("button"));
    expect(clicked).toBe(false);
  });

  it("accepts additional className", () => {
    render(Button, { props: { className: "extra-class", children: text("Styled") } });
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("extra-class");
  });

  it("sets the button type attribute", () => {
    render(Button, { props: { type: "submit", children: text("Submit") } });
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});