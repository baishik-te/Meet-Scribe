

export function isActivePlan(
  planId: string,
  activePlanId: string | null | undefined
): boolean {
  return Boolean(activePlanId) && planId === activePlanId;
}


export function isPlanSelectDisabled(
  planId: string,
  activePlanId: string | null | undefined,
  loadingPlanId: string | null | undefined
): boolean {
  return isActivePlan(planId, activePlanId) || loadingPlanId === planId;
}
