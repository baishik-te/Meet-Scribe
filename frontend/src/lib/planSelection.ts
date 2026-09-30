

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

export function formatBillingPeriod(period?: string): string {
  switch (period) {
    case '3_months':
      return '3 months';
    case '6_months':
      return '6 months';
    case 'year':
      return 'year';
    case 'month':
    default:
      return 'month';
  }
}

export function formatBillingPeriodShort(period?: string): string {
  switch (period) {
    case '3_months':
      return '3 mo';
    case '6_months':
      return '6 mo';
    case 'year':
      return 'yr';
    case 'month':
    default:
      return 'mo';
  }
}

export function formatBillingRate(price: number | string, period?: string): string {
  return `$${price}/${formatBillingPeriodShort(period)}`;
}
