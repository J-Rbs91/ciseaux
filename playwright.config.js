// Configuration Playwright pour l'audit e2e du CRM (Offres / Campagnes / Templates / Segmentation).
// L'app est 100% statique (HTML + localStorage) : on la sert en local sur 127.0.0.1:8099.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:8099',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'python3 -m http.server 8099 --bind 127.0.0.1',
    cwd: __dirname,
    url: 'http://127.0.0.1:8099/index.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
