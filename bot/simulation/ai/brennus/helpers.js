export function SquareDistance(a, b)
{
	return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
}

/** attackMove filter: engage enemy units only on the way. UnitAI's
 * attackfilter reads targetClasses.attack — a plain "Unit" string has no
 * .attack and filtered nothing, so marching armies stopped to capture
 * every house they passed (s31: a 94-man raid stalled 12 min in Petra's
 * housing ring 100 m short of the CC). */
export const UNITS_ONLY = { "attack": "Unit" };
