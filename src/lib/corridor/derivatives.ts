/** Funding / basis only tilt width. They never move the center. */

export type DerivativesSnap = {
  funding: number | null;
  basis: number | null;
};

export function derivativesTilt(
  snap: DerivativesSnap | null | undefined,
): { lo: number; hi: number; w: number } {
  let lo = 1;
  let hi = 1;
  let w = 1;
  if (!snap) return { lo, hi, w };
  const f = snap.funding;
  const b = snap.basis;
  if (f != null && Number.isFinite(f)) {
    if (f > 0.0003) hi *= 1 + Math.min(0.08, (f - 0.0003) * 80);
    if (f < -0.0002) lo *= 1 + Math.min(0.08, (-f - 0.0002) * 80);
    if (Math.abs(f) > 0.0004) w *= 1.05;
  }
  if (b != null && Number.isFinite(b) && Math.abs(b) > 0.002) {
    w *= 1 + Math.min(0.06, (Math.abs(b) - 0.002) * 10);
  }
  return { lo, hi, w };
}

export function derivativesDriver(snap: DerivativesSnap | null | undefined): string | null {
  if (!snap) return null;
  const f = snap.funding;
  if (f == null || !Number.isFinite(f)) return null;
  if (f > 0.0005) {
    return "Фандинг высокий: лонги переплачивают. Верх коридора чуть шире — толпа может вытряхнуться вниз, но и вынос вверх остаётся в игре.";
  }
  if (f < -0.0004) {
    return "Фандинг отрицательный: шорты платят. Низ коридора чуть шире.";
  }
  return null;
}
