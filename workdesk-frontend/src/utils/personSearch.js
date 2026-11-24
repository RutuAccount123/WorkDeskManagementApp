/**
 * Employee search used on the Employees page and the admin dashboard.
 * Matches every word typed against name, employee code, department, designation, email and phone,
 * ignoring capitals and extra spaces. "rahul acc" finds Rahul in Accounts.
 */
export function matchesPerson(person, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [person?.fullName, person?.employeeCode, person?.department, person?.designation, person?.email, person?.phone]
    .filter(Boolean).join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
}
