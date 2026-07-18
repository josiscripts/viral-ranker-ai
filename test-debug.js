import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('Abriendo...');
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const textareaCount = await page.evaluate(() => document.querySelectorAll('textarea').length);
  console.log(`Textareas encontrados: ${textareaCount}`);

  const hasContent = await page.evaluate(() => document.body.innerHTML.length);
  console.log(`Contenido de página: ${hasContent} caracteres`);

  const title = await page.title();
  console.log(`Título de página: ${title}`);

  await browser.close();
})();
