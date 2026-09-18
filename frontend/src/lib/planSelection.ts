// Pure, dependency-free helpers for plan-selection UI (UserDashboard, Profile).
//
// Extracted so the active-plan detection logic can be unit- and property-tested
// in isolation (no React, no network). Both functions are referentially
// transparent.
//
// Design: "UserDashboard redesign", Property 4 (active-plan detection).
// Validates: Requirement 3.7

/**
 * Active-plan detection (Property 4 / Requirement 3.7).
 *
 * A plan is considered the active plan if and only if there is a truthy active
 * plan id AND the plan's id equals that active plan id. When there is no active
 * subscription (`activePlanId` is null/undefined/empty), no plan is active.
 */
export function isActivePlan(
  planId: string,
  activePlanId: string | null | undefined
): boolean {
  return Boolean(activePlanId) && planId === activePlanId;
}

/**
 * Whether a plan's selection control should be disabled.
 *
 * The control is disabled when the plan is the active plan, or while a checkout
 * request for that specific plan is in flight (`loadingPlanId === planId`).
 */
export function isPlanSelectDisabled(
  planId: string,
  activePlanId: string | null | undefined,
  loadingPlanId: string | null | undefined
): boolean {
  return isActivePlan(planId, activePlanId) || loadingPlanId === planId;
}
