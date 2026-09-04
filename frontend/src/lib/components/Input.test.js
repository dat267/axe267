import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Input from "./Input.svelte";

describe("Input", () => {
  it("renders an input element", () => {
    render(Input, { props: { id: "test-input" } });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("accepts a value prop", () => {
    render(Input, { props: { id: "name", value: "John" } });
    expect(screen.getByRole("textbox")).toHaveValue("John");
  });

  it("updates value on user input", async () => {
    const user = userEvent.setup();
    render(Input, { props: { id: "name" } });
    const input = screen.getByRole("textbox");
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("renders the label when provided", () => {
    render(Input, { props: { id: "email", label: "Email Address" } });
    expect(screen.getByText("Email Address")).toBeInTheDocument();
  });

  it("does not render a label when not provided", () => {
    const { container } = render(Input, { props: { id: "no-label" } });
    expect(container.querySelector("label")).not.toBeInTheDocument();
  });

  it("sets the placeholder", () => {
    render(Input, { props: { id: "search", placeholder: "Search..." } });
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Search...");
  });

  it("disables the input when disabled prop is true", () => {
    render(Input, { props: { id: "disabled-input", disabled: true } });
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("sets the required attribute", () => {
    render(Input, { props: { id: "required-input", required: true } });
    expect(screen.getByRole("textbox")).toBeRequired();
  });

  it("sets the type attribute", () => {
    render(Input, { props: { id: "pw", type: "password" } });
    const input = document.getElementById("pw");
    expect(input).toHaveAttribute("type", "password");
  });
});