import { describe, it, expect } from "vitest";
import { decodeJwt } from "../lib/jwt";

describe("decodeJwt", () => {
  it("decodes a valid JWT payload", () => {
    const payload = { sub: "123", email: "test@example.com", displayName: "Test User" };
    const base64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `header.${base64}.signature`;

    const result = decodeJwt(token);
    expect(result).toEqual(payload);
  });

  it("returns null for invalid token", () => {
    expect(decodeJwt("invalid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeJwt("")).toBeNull();
  });

  it("returns null for malformed JSON in payload", () => {
    const base64 = btoa("not-json").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeJwt(`.${base64}.`)).toBeNull();
  });

  it("decodes token with optional fields", () => {
    const payload = { sub: "456", email: "user@test.com" };
    const base64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const token = `header.${base64}.signature`;

    const result = decodeJwt(token);
    expect(result).toEqual({ sub: "456", email: "user@test.com" });
  });
});
