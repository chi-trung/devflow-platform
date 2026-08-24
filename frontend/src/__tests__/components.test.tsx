import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { Skeleton } from "../components/ui/Skeleton";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies tone class", () => {
    render(<Badge tone="red">Bug</Badge>);
    const el = screen.getByText("Bug");
    expect(el.className).toContain("bg-destructive/10");
  });

  it("defaults to neutral tone", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toContain("bg-elevated");
  });
});

describe("Avatar", () => {
  it("renders initials from name", () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders single letter for single name", () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders ? for empty name", () => {
    render(<Avatar name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("applies sm size class by default", () => {
    render(<Avatar name="Test" />);
    const el = screen.getByText("T");
    expect(el.className).toContain("size-6");
  });

  it("applies md size class when specified", () => {
    render(<Avatar name="Test" size="md" />);
    const el = screen.getByText("T");
    expect(el.className).toContain("size-9");
  });

  it("produces consistent color from id", () => {
    const { rerender } = render(<Avatar name="Alice" id="user-1" />);
    const color1 = screen.getByText("A").className;
    rerender(<Avatar name="Alice" id="user-1" />);
    const color2 = screen.getByText("A").className;
    expect(color1).toBe(color2);
  });
});

describe("Skeleton", () => {
  it("renders with aria-hidden", () => {
    render(<Skeleton />);
    const el = document.querySelector(".skeleton");
    expect(el).toHaveAttribute("aria-hidden");
  });

  it("applies custom className", () => {
    const { container } = render(<Skeleton className="w-48 h-4" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("w-48");
    expect(el.className).toContain("h-4");
  });
});
