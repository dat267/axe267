import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import Alert from "./Alert.svelte";

describe("Alert", () => {
  it("renders nothing when message is empty", () => {
    render(Alert, { props: { message: "" } });
    expect(screen.queryByText(/./)).not.toBeInTheDocument();
  });

  it("renders nothing when message is null", () => {
    render(Alert, { props: { message: null } });
    expect(screen.queryByText(/./)).not.toBeInTheDocument();
  });

  it("renders the message text", () => {
    render(Alert, { props: { message: "Something went wrong" } });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("applies the info style by default", () => {
    render(Alert, { props: { message: "Info message" } });
    const el = screen.getByText("Info message");
    expect(el.className).toContain("text-foreground");
    expect(el.className).toContain("border-border");
  });

  it("applies the error style", () => {
    render(Alert, { props: { type: "error", message: "Error message" } });
    const el = screen.getByText("Error message");
    expect(el.className).toContain("text-rose-600");
    expect(el.className).toContain("border-rose-500");
  });

  it("applies the success style", () => {
    render(Alert, { props: { type: "success", message: "Success message" } });
    const el = screen.getByText("Success message");
    expect(el.className).toContain("text-emerald-600");
    expect(el.className).toContain("border-emerald-500");
  });
});
