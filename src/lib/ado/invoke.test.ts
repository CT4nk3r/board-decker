import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { adoRequest, AdoError } from "./invoke";

const ok = (body: unknown) => ({ status: 200, ok: true, body });
const fail = (status: number, body: unknown = {}) => ({ status, ok: false, body });

beforeEach(() => {
  invokeMock.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("adoRequest auth handling", () => {
  it("returns body on a clean 200", async () => {
    invokeMock.mockResolvedValue(ok({ id: "1" }));
    await expect(adoRequest({ method: "GET", url: "u" })).resolves.toEqual({ id: "1" });
  });

  it("treats 203 as auth failure", async () => {
    invokeMock.mockResolvedValue({ status: 203, ok: false, body: null });
    await expect(adoRequest({ method: "GET", url: "u" })).rejects.toMatchObject({ status: 203 });
  });

  it("treats an HTML sign-in body on a 2xx as 203 auth failure", async () => {
    invokeMock.mockResolvedValue(ok("<html><body>Sign in</body></html>"));
    await expect(adoRequest({ method: "GET", url: "u" })).rejects.toMatchObject({ status: 203 });
  });

  it("does not retry non-throttle 4xx", async () => {
    invokeMock.mockResolvedValueOnce(fail(404, { message: "nope" }));
    await expect(adoRequest({ method: "GET", url: "u" })).rejects.toMatchObject({ status: 404 });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});

describe("adoRequest backoff", () => {
  it("returns the body and calls invoke once on success", async () => {
    invokeMock.mockResolvedValueOnce(ok({ value: 1 }));
    await expect(adoRequest({ method: "GET", url: "u" })).resolves.toEqual({ value: 1 });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("retries 429 then succeeds", async () => {
    invokeMock.mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(ok("done"));
    const p = adoRequest({ method: "GET", url: "u" });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("done");
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("retries 503 up to maxRetries then throws AdoError", async () => {
    invokeMock.mockResolvedValue(fail(503, { message: "busy" }));
    const p = adoRequest({ method: "GET", url: "u", maxRetries: 2 });
    const assertion = expect(p).rejects.toBeInstanceOf(AdoError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(invokeMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("honors Retry-After (seconds) from the error body before the next attempt", async () => {
    invokeMock.mockResolvedValueOnce(fail(429, { retryAfter: 2 })).mockResolvedValueOnce(ok("ok"));
    const p = adoRequest({ method: "GET", url: "u" });
    await vi.advanceTimersByTimeAsync(1900);
    expect(invokeMock).toHaveBeenCalledTimes(1); // still waiting the ~2s
    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toBe("ok");
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
