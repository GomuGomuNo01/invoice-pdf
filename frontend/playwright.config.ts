import { defineConfig, devices } from '@playwright/test';

const isWindows = process.platform === 'win32';

/**
 * Tests de bout en bout : démarrent le backend (port 8080) et le frontend (port 5173)
 * s'ils ne tournent pas déjà.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: isWindows ? String.raw`.\mvnw.cmd -q spring-boot:run` : './mvnw -q spring-boot:run',
      cwd: '../backend',
      url: 'http://localhost:8080/actuator/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { INVOICE_RATE_LIMIT_PER_MINUTE: '1000' },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
