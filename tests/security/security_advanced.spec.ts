import { test, expect } from '@playwright/test';

test.describe('Seguridad avanzada', () => {
  test('Validación de cabeceras críticas', async ({ request }) => {
    const response = await request.get('https://www.saucedemo.com/');
    const headers = response.headers();

    console.log("🔐 Cabeceras:", headers);

    expect(headers['strict-transport-security'], 'HSTS activo').toBeTruthy();
    expect(headers['content-security-policy'], 'CSP definido').toBeTruthy();
    expect(headers['x-content-type-options'], 'X-Content-Type-Options nosniff').toBe('nosniff');
    expect(headers['x-frame-options'], 'Protección clickjacking').toMatch(/DENY|SAMEORIGIN/);
  });

  test('El sitio no debe ser vulnerable a XSS básico', async ({ page }) => {
    const payload = "<script>alert('xss')</script>";
    await page.goto(`https://www.saucedemo.com/?search=${encodeURIComponent(payload)}`);

    const bodyText = await page.textContent('body');
    expect(bodyText, 'No debe renderizar el payload XSS').not.toContain(payload);
  });

  test('Bloqueo tras múltiples intentos fallidos de login', async ({ page }) => {
    await page.goto('https://www.saucedemo.com/');

    for (let i = 0; i < 5; i++) {
      await page.fill('#user-name', `usuario_invalido_${i}`);
      await page.fill('#password', 'contraseña_invalida');
      await page.click('#login-button');
    }

    const error = await page.locator('[data-test="error"]');
    const errorText = await error.textContent();
    console.log("🔒 Mensaje tras intentos fallidos:", errorText);

    expect(errorText).toMatch(/locked|bloqueado|too many attempts/i);
  });
});
