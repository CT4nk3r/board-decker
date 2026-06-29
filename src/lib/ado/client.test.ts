import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

import { validateConnection } from "./client";
import { updateWorkItem } from "./client";
import { isConflict } from "@/hooks/writePath";
import type { AdoConnection } from "./types";
import type { AdoPatchOp } from "./fields";

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

describe("updateWorkItem rev guard", () => {
  const u: AdoConnection = { org: "o", project: "p" };
  const ok = (rev: number) => ({ status: 200, ok: true, body: { id: 1, rev, fields: {} } });
  const ops: AdoPatchOp[] = [{ op: "add", path: "/fields/System.Title", value: "Hi" }];

  it("prepends a test op on /rev when a rev is supplied", async () => {
    invokeMock.mockResolvedValue(ok(8));
    await updateWorkItem(u, 1, ops, 7);
    const body = invokeMock.mock.calls[0][1].body as AdoPatchOp[];
    expect(body[0]).toEqual({ op: "test", path: "/rev", value: 7 });
    expect(body[1]).toEqual(ops[0]);
  });

  it("sends raw ops when no rev is supplied", async () => {
    invokeMock.mockResolvedValue(ok(2));
    await updateWorkItem(u, 1, ops);
    expect(invokeMock.mock.calls[0][1].body as AdoPatchOp[]).toEqual(ops);
  });

  it("surfaces a 409 the rev test-op triggers as a conflict", async () => {
    invokeMock.mockResolvedValue({ status: 409, ok: false, body: { message: "rev conflict" } });
    const err = await updateWorkItem(u, 1, ops, 7).catch((e) => e);
    expect(err.status).toBe(409);
    expect(isConflict(err)).toBe(true);
  });
});
