// Side-menu items for each role. `icon` is a key in src/components/ui/Icon.jsx.
// `short` is the label used on the phone bottom bar.
export const ADMIN_NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', short: 'Home', icon: 'dashboard' },
      { to: '/tasks', label: 'Tasks', icon: 'tasks' },
    ],
  },
  {
    section: 'Manage',
    items: [
      { to: '/employees', label: 'Employees', short: 'People', icon: 'people' },
      { to: '/workflows', label: 'Workflows (FMS)', short: 'FMS', icon: 'flow' },
      { to: '/recurring', label: 'Repeating tasks', short: 'Repeat', icon: 'repeat' },
      { to: '/holidays', label: 'Holidays', icon: 'holiday' },
    ],
  },
  {
    section: 'Insights',
    items: [{ to: '/reports', label: 'Reports', icon: 'reports' }],
  },
];

export const EMPLOYEE_NAV = [
  {
    section: 'My workspace',
    items: [
      { to: '/', label: 'My work', short: 'Work', icon: 'calendar' },
      { to: '/tasks', label: 'My tasks', short: 'Tasks', icon: 'tasks' },
      { to: '/workflows', label: 'Workflows (FMS)', short: 'FMS', icon: 'flow' },
      { to: '/reports', label: 'My summary', short: 'Summary', icon: 'reports' },
    ],
  },
  {
    section: 'Office',
    items: [{ to: '/holidays', label: 'Holidays', icon: 'holiday' }],
  },
];

/** Titles for pages that are not in the side menu, matched in order. */
export const PAGE_TITLES = [
  [/^\/employees\/\d+/, 'Employee profile'],
  [/^\/tasks\/\d+/, 'Task'],
  [/^\/workflows\/new/, 'New FMS'],
  [/^\/workflows\/\d+\/edit/, 'Edit FMS'],
  [/^\/workflows\/\d+/, 'FMS sheet'],
  [/^\/account/, 'My account'],
];

/**
 * The title for a page. Menu pages use their menu label, so the side menu,
 * the top bar and the page heading always say the same thing.
 */
export function pageTitle(pathname, isAdmin) {
  const nav = (isAdmin ? ADMIN_NAV : EMPLOYEE_NAV).flatMap((g) => g.items);
  const extra = PAGE_TITLES.find(([re]) => re.test(pathname));
  if (extra) return extra[1];
  return nav.find((n) => n.to === pathname)?.label || '';
}
