import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:8132', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'edge-android', use: {
      ...devices['Pixel 7'],
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36 EdgA/142.0'
    } }
  ],
  webServer: { command: 'npm run serve', url: 'http://127.0.0.1:8132', reuseExistingServer: !process.env.CI }
});
