import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { adoRequest, AdoError } from "./invoke";

beforeEach(() => invokeMock.mockReset());

describe("adoRequest auth handling", () => {
  it("returns body on a clean 200", async () => {
    invokeMock.mockResolvedValue({ status: 200, ok: true, body: { id: "1" } });
    await expect(adoRequest({ method: "GET", url: "u" })).resolves.toEqual({ id: "1" });
  });

  it("treats 203 as auth failure", async () => {
    invokeMock.mockResolvedValue({ status: 203, ok: false, body: null });
    await expect(adoRequest({ method: "GET", url: "u" })).rejects.toMatchObject({ status: 203 });
  });

  it("treats an HTML sign-in body on a 2xx as 203 auth failure", async () => {
    invokeMock.mockResolvedValue({ status: 200, ok: true, body: "<html><body>Sign in</body></html>" });
    let err: AdoError | undefined;
    try {
      await adoRequest({ method: "GET", url: "u" });
    } catch (e) {
      err = e as AdoError;
    }
    expect(err).toBeInstanceOf(AdoError);
    expect(err?.status).toBe(203);
  });

  it("throws on non-ok status", async () => {
    invokeMock.mockResolvedValue({ status: 404, ok: false, body: { message: "nope" } });
    await expect(adoRequest({ method: "GET", url: "u" })).rejects.toMatchObject({ status: 404 });
  });
});
