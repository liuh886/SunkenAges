import { chromium } from '@playwright/test';

const executablePath = process.env.CHROME_BIN;
const appUrl = process.env.APP_URL || 'http://127.0.0.1:4173/SunkenAges/';
if (!executablePath) throw new Error('CHROME_BIN is required for browser smoke.');

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /潮门避难站/ }).click();
  await page.getByText('潮门站可直接体验').waitFor();
  await page.getByRole('button', { name: /开始第 2 关/ }).click();
  await page.locator('.game-host canvas').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: '返回水面' }).click();
  await page.locator('.briefing-screen').waitFor({ state: 'visible' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!fitsViewport) throw new Error('Mobile layout overflows horizontally.');

  if (runtimeErrors.length) {
    throw new Error(`Browser runtime errors: ${runtimeErrors.join(' | ')}`);
  }
} finally {
  await browser.close();
}
