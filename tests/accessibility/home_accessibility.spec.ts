import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accesibilidad avanzada - Home', () => {
  test('Debe cumplir WCAG A y AA sin violaciones críticas', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/');

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa']) // Solo validamos reglas críticas
      .analyze();

    if (violations.length > 0) {
      console.log(`⚠️ Se encontraron ${violations.length} violaciones:`);
      violations.forEach(v =>
        console.log(`- [${v.id}] ${v.description} (Impacto: ${v.impact})`));
    }

    // Fallamos si hay violaciones de impacto crítico o serio
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical.length, 'Violaciones críticas o serias').toBe(0);
  });

  test('Todos los botones e inputs deben tener nombres accesibles', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/');

    const buttons = await page.locator('button, input[type="submit"]');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const name = await buttons.nth(i).getAttribute('aria-label');
      const text = await buttons.nth(i).textContent();
      expect(name || text, `El botón #${i + 1} debe tener nombre accesible`).toBeTruthy();
    }
  });
});
