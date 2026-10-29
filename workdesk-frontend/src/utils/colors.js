/** A stable, friendly colour for each person (used for avatars and card borders). */
// Bright, friendly tones that match the violet/pink theme.
const PEOPLE_COLORS = ['#7C3AED', '#DB2777', '#0EA5E9', '#F97316', '#10B981', '#6366F1', '#E11D48', '#14B8A6'];
export function personColor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PEOPLE_COLORS[h % PEOPLE_COLORS.length];
}
