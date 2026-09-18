// Pure, dependency-free helpers for the Call_Toolbar.
//
// Extracted so they can be unit- and property-tested in isolation (no React,
// no LiveKit, no network). `toggleWithRollback` captures the single behavior
// shared by the Camera, Mic, Screen Share, and Record toggles: attempt the
// underlying operation and only commit the flipped state when it succeeds.
//
// Design: "CallRoom → Call_Toolbar", Property 1 (toggle-with-rollback) and
// Property 8 (leave-call branch on callId).

/**
 * Result of a toggle-with-rollback attempt.
 *
 * - `next`  — the boolean state after the attempt. On success this is `!current`;
 *   on failure it stays `current` (rollback).
 * - `ok`    — whether the underlying operation succeeded.
 * - `error` — the throwable captured on failure (undefined on success), so the
 *   caller can map/surface it (e.g. via `mapMediaError` + `InlineNotice`).
 */
export interface ToggleResult {
  next: boolean;
  ok: boolean;
  error?: unknown;
}

/**
 * Toggle-with-rollback (Property 1 / Requirements 8.2–8.6, 8.8, 8.9, 8.10).
 *
 * Given the `current` boolean control state and an async `op` that performs the
 * underlying side effect for the *target* state (`!current`):
 *   - if `op` resolves, the returned `next` is `!current` (the flip is committed);
 *   - if `op` rejects/throws, the returned `next` stays `current` (rollback) and
 *     the throwable is returned in `error`, so the caller can raise an error
 *     indication without changing the control state.
 *
 * The function never throws — failures are reported through the result.
 *
 * The chat panel toggle has no fallible operation; callers can either flip its
 * state directly or pass a no-op `op` (which always resolves → always flips).
 */
export async function toggleWithRollback(
  current: boolean,
  op: (target: boolean) => unknown | Promise<unknown>
): Promise<ToggleResult> {
  const target = !current;
  try {
    await op(target);
    return { next: target, ok: true };
  } catch (error) {
    return { next: current, ok: false, error };
  }
}

/**
 * Whether activating Leave should call `POST /user/calls/end`
 * (Property 8 / Requirements 8.12, 8.13).
 *
 * The endpoint is invoked if and only if a non-empty `callId` is present. In
 * all cases the caller still disconnects the session and navigates to the
 * dashboard — this predicate only governs the endpoint branch.
 */
export function shouldCallEndEndpoint(callId: string | null | undefined): boolean {
  return typeof callId === 'string' && callId.length > 0;
}
