import { http } from './http.js';

/** Shareable FMS form links (/f/:token). No sign-in needed: the token is the permission. */
export const publicFormService = {
  /** The FMS name, description and form fields behind a link. */
  get: (token) => http(`/api/public/forms/${encodeURIComponent(token)}`),
  /**
   * Sends the filled form; it is saved as a new entry (run) of that FMS.
   * filledByName: the visitor's name (needed only when not signed in; signed-in members are known).
   */
  submit: (token, formData, filledByName) => http(`/api/public/forms/${encodeURIComponent(token)}`,
    { method: 'POST', body: { formData, filledByName } }),
};

/** "Site Enquiry (Pune)" → "site-enquiry-pune". Empty when the name has no a–z / 0–9 letters. */
export const nameSlug = (name) => String(name || '').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

/**
 * The short link to share, with the FMS name in it so people know which form it is:
 * https://workdesk.example.com/f/site-enquiry-k3X9pQ2mZa
 * Only the code after the last "-" matters, so renaming the FMS does not break links already shared.
 */
export const formLinkUrl = (token, name) => {
  const slug = nameSlug(name);
  return `${window.location.origin}/f/${slug ? `${slug}-` : ''}${token}`;
};
