import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { validateConnection } from "./client";

const conn = { org: "o", project: "p" };
beforeEach(() => invokeMock.mockReset());

describe("validateConnection shape check", () => {
  it("accepts a real project shape", async () => {
    invokeMock.mockResolvedValue({ status: 200, ok: true, body: { id: "abc", name: "Proj" } });
    await expect(validateConnection(conn, "pat")).resolves.toEqual({ id: "abc", name: "Proj" });
  });

  it("rejects a 2xx body missing id/name (HTML sign-in)", async () => {
    invokeMock.mockResolvedValue({ status: 200, ok: true, body: { foo: 1 } });
    await expect(validateConnection(conn, "pat")).rejects.toMatchObject({ status: 203 });
  });
});
