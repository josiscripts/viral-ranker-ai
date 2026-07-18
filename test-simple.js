import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('1. Navegando a localhost:3000...');
  const response = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  console.log(`   Status: ${response?.status()}`);

  // Esperar 5 segundos para que React cargue
  console.log('2. Esperando 5 segundos para que React cargue...');
  await page.waitForTimeout(5000);

  // Verificar errores en la consola
  console.log('\n3. Verificando errores en consola del navegador...');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    errors.push(`[pageerror] ${err.message}`);
  });

  // Buscar cualquier elemento visible
  console.log('\n4. Buscando elementos en el DOM...');
  const elementCount = await page.evaluate(() => {
    return {
      textareas: document.querySelectorAll('textarea').length,
      divs: document.querySelectorAll('div').length,
      buttons: document.querySelectorAll('button').length,
      h1: document.querySelectorAll('h1').length,
      body: !!document.body
    };
  });
  console.log(`   Elementos encontrados:`, elementCount);

  // Buscar el contenedor principal
  console.log('\n5. Buscando contenedor principal...');
  const mainContent = await page.evaluate(() => {
    const app = document.getElementById('root') || document.getElementById('app');
    if (app) {
      return {
        found: true,
        hasContent: !!app.innerHTML,
        contentLength: app.innerHTML.length,
        textContent: app.textContent?.substring(0, 100)
      };
    }
    return { found: false };
  });
  console.log(`   Contenedor principal:`, mainContent);

  if (errors.length > 0) {
    console.log('\n6. ERRORES ENCONTRADOS:');
    errors.forEach(err => console.log(`   ${err}`));
  }

  // Tomar screenshot
  console.log('\n7. Tomando screenshot...');
  await page.screenshot({ path: 'debug-page.png' });
  console.log('   Screenshot guardado: debug-page.png');

  await browser.close();
  console.log('\n✅ Debug completado');
})().catch(console.error);
