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

  it("decodes the avatarUrl claim when the backend sent one", () => {
    // The backend omits the claim entirely (never sends "null") for users
    // without a picture — decodeJwt must surface exactly what was signed.
    const payload = {
      sub: "789",
      email: "oauth@test.com",
      avatarUrl: "https://lh3.googleusercontent.com/pic",
    };
    const base64 = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = decodeJwt(`header.${base64}.signature`);
    expect(result?.avatarUrl).toBe("https://lh3.googleusercontent.com/pic");
    expect(decodeJwt(`header.${btoa(JSON.stringify({ sub: "1", email: "a@b.c" })).replace(/=+$/, "")}.sig`)?.avatarUrl)
      .toBeUndefined();
  });
});
