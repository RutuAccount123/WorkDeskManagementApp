import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetMockData, setMockDelay } from '@/mock/mockServer.js';

// Every test starts with fresh sample data and no pretend network delay.
setMockDelay(0);
beforeEach(() => {
  localStorage.clear();
  resetMockData();
});
afterEach(() => cleanup());
