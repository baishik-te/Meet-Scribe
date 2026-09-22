
export interface ToggleResult {
  next: boolean;
  ok: boolean;
  error?: unknown;
}

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

export function shouldCallEndEndpoint(callId: string | null | undefined): boolean {
  return typeof callId === 'string' && callId.length > 0;
}
