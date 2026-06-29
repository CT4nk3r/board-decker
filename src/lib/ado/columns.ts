/** Pure helpers for deriving board columns and valid drag targets per type. */

import { STATE_CATEGORY_ORDER, type AdoState } from "./types";

/** One work item type's state list, or `null` when its lookup failed. */
export interface TypeStates {
  type: string;
  states: AdoState[] | null;
}

export interface BuiltColumns {
  /** De-duped, category-ordered union of all loaded states (board columns). */
  columns: AdoState[];
  /** Allowed state names per type — preserves type-specific workflows (#23). */
  statesByType: Record<string, string[]>;
  /** Types whose state lookup failed; columns may be incomplete (#22). */
  failedTypes: string[];
}

/**
 * Merge per-type states into the board column set. Types that failed to load are
 * recorded in `failedTypes` (not silently dropped); successful ones populate
 * `statesByType` and the ordered, de-duplicated `columns`.
 */
export function buildColumns(perType: TypeStates[]): BuiltColumns {
  const failedTypes = perType.filter((r) => r.states === null).map((r) => r.type);
  const statesByType: Record<string, string[]> = {};
  const merged = new Map<string, AdoState & { order: number }>();
  let idx = 0;
  for (const { type, states } of perType) {
    if (!states) continue;
    statesByType[type] = states.map((s) => s.name);
    for (const s of states) {
      const key = s.name.toLowerCase();
      if (!merged.has(key)) {
        const catRank = STATE_CATEGORY_ORDER[String(s.category)] ?? 2;
        merged.set(key, { ...s, order: catRank * 1000 + idx });
      }
      idx++;
    }
  }
  const columns = [...merged.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...rest }) => rest);
  return { columns, statesByType, failedTypes };
}

/** True only when every type's state lookup failed (so the query should error). */
export function allTypesFailed(typeCount: number, failedCount: number): boolean {
  return typeCount > 0 && failedCount === typeCount;
}

/**
 * Whether a card of `type` may move to `target`. Unknown types or types whose
 * states didn't load are permissive (never block a move we can't validate).
 */
export function isAllowedTarget(
  statesByType: Record<string, string[]> | undefined,
  type: string,
  target: string,
): boolean {
  const list = statesByType?.[type];
  if (!list || list.length === 0) return true;
  return list.some((s) => s.toLowerCase() === target.toLowerCase());
}
