// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScopeSpec } from "@/lib/ado";

const setScope = vi.fn();
let scope: ScopeSpec = { id: "active" };

vi.mock("@/store/connection", () => ({
  useConnectionStore: (sel: (s: unknown) => unknown) =>
    sel({ connection: { org: "Org", project: "Proj" }, clear: vi.fn() }),
}));
vi.mock("@/store/board", () => ({
  useBoardStore: (sel: (s: unknown) => unknown) => sel({ scope, setScope }),
}));
vi.mock("@/hooks/queries", () => ({ useIterations: () => ({ data: [] }) }));
vi.mock("@/lib/ado", async (orig) => ({ ...(await orig<object>()), deletePat: vi.fn() }));

import { Sidebar } from "./Sidebar";

beforeEach(() => {
  setScope.mockReset();
  scope = { id: "active" };
});
afterEach(cleanup);

describe("Sidebar area picker (#21)", () => {
  it("makes the 'area' scope reachable by typing a path + Enter", async () => {
    render(<Sidebar />);
    const input = screen.getByLabelText("Area path");
    await userEvent.type(input, "Team\\Web{Enter}");
    expect(setScope).toHaveBeenCalledWith({ id: "area", arg: "Team\\Web" });
  });

  it("strips a leading project prefix so full paths don't double up", async () => {
    render(<Sidebar />);
    await userEvent.type(screen.getByLabelText("Area path"), "Proj\\Team\\Web{Enter}");
    expect(setScope).toHaveBeenCalledWith({ id: "area", arg: "Team\\Web" });
  });

  it("ignores a blank area path", async () => {
    render(<Sidebar />);
    await userEvent.type(screen.getByLabelText("Area path"), "   {Enter}");
    expect(setScope).not.toHaveBeenCalled();
  });

  it("clears the area filter when the field is emptied while area is active", async () => {
    scope = { id: "area", arg: "Web" };
    render(<Sidebar />);
    const input = screen.getByLabelText("Area path");
    await userEvent.clear(input);
    await userEvent.type(input, "{Enter}");
    expect(setScope).toHaveBeenCalledWith({ id: "active" });
  });

  it("shows a clear control that resets the scope when area is active", async () => {
    scope = { id: "area", arg: "Team\\Web" };
    render(<Sidebar />);
    await userEvent.click(screen.getByLabelText("Clear area"));
    expect(setScope).toHaveBeenCalledWith({ id: "active" });
  });
});
