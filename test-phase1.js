import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Test Desktop
  console.log('='.repeat(60));
  console.log('🖥️  PRUEBAS DESKTOP (1280x720)');
  console.log('='.repeat(60));

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('\n🌐 Abriendo localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Hacer click en el botón OPEN TOOL del RANKING EDITOR
  console.log('Abriendo el editor de ranking...');
  await page.click('text=RANKING EDITOR');
  await page.waitForTimeout(1000);
  const openToolButtons = await page.locator('text=OPEN TOOL').all();
  if (openToolButtons.length > 0) {
    await openToolButtons[0].click();
  }

  // Esperar a que React monte el textarea
  console.log('Esperando textarea...');
  await page.waitForSelector('textarea', { timeout: 10000 });
  console.log('✅ Textarea encontrado\n');

  // Test 1: Escribir 20 caracteres
  console.log('📝 Test 1: Escribiendo 20 caracteres...');
  await titleTextarea.click();
  await page.keyboard.type('GREAT VIRAL RANKING', { delay: 15 });
  let value = await titleTextarea.inputValue();
  console.log(`   Texto: "${value}"`);
  console.log(`   Longitud: ${value.length} caracteres`);

  // Test 2: Agregar 12 más para llegar a 32
  console.log('\n📝 Test 2: Escribiendo 12 caracteres más (total 32)...');
  await page.keyboard.type(' TOP MOMENT', { delay: 15 });
  value = await titleTextarea.inputValue();
  console.log(`   Texto: "${value}"`);
  console.log(`   Longitud: ${value.length} caracteres`);

  // Test 3: Intentar escribir un carácter más
  console.log('\n📝 Test 3: Intentando escribir carácter 33 (debe bloquearse)...');
  const valueAntes = await titleTextarea.inputValue();
  await page.keyboard.type('XXXXX', { delay: 15 });
  const valueDespues = await titleTextarea.inputValue();
  const bloqueado = valueAntes === valueDespues;
  console.log(`   Valor antes:  "${valueAntes}" (${valueAntes.length} chars)`);
  console.log(`   Valor después: "${valueDespues}" (${valueDespues.length} chars)`);
  console.log(`   ✅ Bloqueado correctamente: ${bloqueado ? 'SÍ' : 'NO'}`);

  // Test 4: Verificar contador
  console.log('\n👁️  Test 4: Verificando contador...');
  const counterText = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    const counterDiv = divs.find(d => d.textContent.includes('/32'));
    return counterDiv ? counterDiv.textContent.trim() : null;
  });
  console.log(`   Contador visible: ${counterText || '❌ NO ENCONTRADO'}`);
  console.log(`   ✅ Formato correcto: ${counterText && counterText.includes('/32') ? 'SÍ' : 'NO'}`);

  // Screenshot desktop
  await page.screenshot({ path: 'phase1-desktop.png' });
  console.log(`   📸 Screenshot: phase1-desktop.png`);

  await page.close();

  // Test Mobile
  console.log('\n' + '='.repeat(60));
  console.log('📱 PRUEBAS MOBILE (390x844)');
  console.log('='.repeat(60));

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });

  console.log('\n🌐 Abriendo localhost:3000 en mobile...');
  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Hacer click en el editor de ranking
  console.log('Abriendo el editor de ranking en mobile...');
  await mobilePage.click('text=RANKING EDITOR');
  await mobilePage.waitForTimeout(1000);
  const mobileOpenToolButtons = await mobilePage.locator('text=OPEN TOOL').all();
  if (mobileOpenToolButtons.length > 0) {
    await mobileOpenToolButtons[0].click();
  }

  console.log('Esperando textarea...');
  await mobilePage.waitForSelector('textarea', { timeout: 10000 });
  console.log('✅ Textarea encontrado en mobile\n');

  console.log('📝 Escribiendo 32 caracteres en mobile...');
  await mobileTextarea.click();
  await mobilePage.keyboard.type('GREAT VIRAL RANKING TOP MOMENT', { delay: 10 });

  const mobileValue = await mobileTextarea.inputValue();
  console.log(`   Texto: "${mobileValue}"`);
  console.log(`   Longitud: ${mobileValue.length} caracteres`);

  const mobileCounterText = await mobilePage.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    const counterDiv = divs.find(d => d.textContent.includes('/32'));
    return counterDiv ? counterDiv.textContent.trim() : null;
  });
  console.log(`   Contador: ${mobileCounterText || '❌ NO ENCONTRADO'}`);

  // Screenshot mobile
  await mobilePage.screenshot({ path: 'phase1-mobile.png' });
  console.log(`   📸 Screenshot: phase1-mobile.png`);

  await mobilePage.close();
  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log('✅ TODAS LAS PRUEBAS COMPLETADAS');
  console.log('='.repeat(60) + '\n');
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
