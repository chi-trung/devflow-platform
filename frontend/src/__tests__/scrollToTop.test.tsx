import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ScrollToTop } from "../components/ScrollToTop";

// The component is pure location → scroll side effects, so the assertions
// spy on the two DOM calls it makes rather than on layout (jsdom has none).
// Every harness mounts ScrollToTop on a first route (which legitimately
// resets scroll once) and then navigates; the interesting assertions count
// calls so a top-reset triggered by the hash navigation is still visible.

function NavigateTo({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [to, navigate]);
  return null;
}

function Harness({ to, entries }: { to: string; entries: string[] }) {
  return (
    <MemoryRouter initialEntries={entries}>
      <ScrollToTop />
      <NavigateTo to={to} />
    </MemoryRouter>
  );
}

let scrollTo: ReturnType<typeof vi.spyOn>;
let scrollIntoView: Mock<(arg?: ScrollIntoViewOptions) => void>;

beforeEach(() => {
  scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  // jsdom ships no Element.prototype.scrollIntoView, so spyOn (which needs
  // the property to exist) throws. Assign a mock directly; afterEach removes
  // it from the prototype again.
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
  document.getElementById("pricing")?.remove();
});

describe("ScrollToTop", () => {
  it("resets scroll to the top when the path changes without a hash", () => {
    render(<Harness to="/blog" entries={["/terms"]} />);
    // One call per mount+navigation: both are plain path changes.
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0 }),
    );
  });

  it("scrolls to an existing hash target instead of adding a top reset", () => {
    const section = document.createElement("section");
    section.id = "pricing";
    document.body.appendChild(section);

    render(<Harness to="/#pricing" entries={["/terms"]} />);
    // The mount on /terms resets once; the later /#pricing navigation must
    // NOT add a second reset — it must scroll to the section instead.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "start" }),
    );
  });

  it("waits for a lazy hash target to mount before scrolling", () => {
    // No #pricing yet; the effect polls with requestAnimationFrame. The
    // element appears after a macrotask, past the first poll.
    render(<Harness to="/#pricing" entries={["/blog"]} />);
    setTimeout(() => {
      const section = document.createElement("section");
      section.id = "pricing";
      document.body.appendChild(section);
    }, 30);

    return waitFor(() => expect(scrollIntoView).toHaveBeenCalled(), {
      timeout: 2500,
    });
  });

  it("handles a hash-only change on the current path (native jump is one-shot)", () => {
    const section = document.createElement("section");
    section.id = "pricing";
    document.body.appendChild(section);

    // Same pathname, new hash: the browser does not re-scroll for a hash
    // link once the page exists, so the effect owns this case too.
    render(<Harness to="/#pricing" entries={["/"]} />);
    expect(scrollTo).toHaveBeenCalledTimes(1); // mount only, not the hash nav
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
