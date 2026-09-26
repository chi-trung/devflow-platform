import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../lib/api";

// A 202 with no body is a contract, not an accident: forgot-password and
// resend-verification must answer identically whether or not the address is
// registered, or they become an account-enumeration oracle. `Accepted()` gives
// them `Content-Length: 0`.
//
// api() used to end every 2xx with `response.json()`, which throws
// `SyntaxError: Unexpected end of JSON input` on that body. Both pages catch
// and render `err.message`, so a successful request put a JSON parser message
// in front of the user. Nothing pinned the tolerance, so it is pinned here.

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The real shape: 202, no content-type, Content-Length: 0. */
function emptyAccepted() {
  return new Response(null, { status: 202 });
}

describe("api() tolerates a successful empty body", () => {
  // api() memoizes GETs in a module-level cache, so each case needs its own
  // path or a later test silently reads an earlier one's stored response.
  it("resolves undefined for a 202 that declares Content-Length: 0", async () => {
    fetchMock.mockResolvedValue(emptyAccepted());

    await expect(api<void>("/auth/forgot-password", { method: "POST" })).resolves
      .toBeUndefined();
  });

  it("resolves undefined when the body is empty but the length header is absent", async () => {
    // A streamed or length-unknown response has no content-length at all, so
    // a header-only check would let this through to JSON.parse("") and throw.
    // Some proxies and every 2xx body-less shape can land here.
    const response = new Response(null, { status: 202 });
    Object.defineProperty(response.headers, "get", {
      value: () => null,
    });
    fetchMock.mockResolvedValue(response);

    await expect(
      api<void>("/auth/resend-verification", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("still parses a body that is present", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "a", refreshToken: "b" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      api<{ accessToken: string }>("/auth/session-probe"),
    ).resolves.toEqual({ accessToken: "a", refreshToken: "b" });
  });

  it("still surfaces a parse error for a body that claims JSON but is malformed", async () => {
    // The tolerance is for an EMPTY body, not for broken JSON. Silently
    // returning undefined here would turn every server-side parse bug into a
    // mysterious "data is undefined" further up.
    fetchMock.mockResolvedValue(
      new Response("{ not json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api("/auth/malformed-probe")).rejects.toThrow(SyntaxError);
  });

  it("does not consume the body before the error path reads it", async () => {
    // The error path is unchanged, but a body-reading helper that eagerly
    // drained the response would make a subsequent read return "" and turn
    // every ProblemDetails into a bare "Request failed".
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Email chưa xác minh" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api("/auth/403-probe")).rejects.toThrow("Email chưa xác minh");
  });
});
