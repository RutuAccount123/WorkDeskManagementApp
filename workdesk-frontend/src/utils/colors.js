/** A stable, friendly colour for each person (used for avatars and card borders). */
const PEOPLE_COLORS = ['#2E7D16', '#176B3B', '#0F6B54', '#3F751F', '#1B6B45', '#276749', '#0E6655', '#4D7C0F'];
export function personColor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PEOPLE_COLORS[h % PEOPLE_COLORS.length];
}
