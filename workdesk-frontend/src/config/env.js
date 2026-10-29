// Central place for build-time settings (from the .env file).
// VITE_USE_MOCK=true  → dummy data in the browser, no backend needed.
// VITE_USE_MOCK=false → real Spring Boot API.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const API_URL = import.meta.env.VITE_API_URL || '';
export const APP_NAME = 'Work Desk';
