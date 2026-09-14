import type { NewsType } from "./types.ts";

/** Only hard news may nudge the center. Rumors and noise only change width. */
export function newsShiftForCenter(
  type: NewsType | undefined,
  shift: number,
  title?: string,
): number {
  if (type === "HACK" || type === "REGULATION" || type === "LISTING") return shift;
  if (title && /(^|[^\p{L}\p{N}])etf($|[^\p{L}\p{N}])/iu.test(title)) return shift;
  return 0;
}
