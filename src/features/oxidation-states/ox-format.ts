export function formatState(state: number): string {
  if (state === 0) return '0';
  if (state > 0) return `+${state}`;
  return `\u2212${Math.abs(state)}`;
}

export function stateColor(state: number): string {
  if (state > 0) return '#dc2626';
  if (state < 0) return '#2563eb';
  return '#6b7280';
}
