import { test, expect } from "@playwright/test";

const BASE_URL = "https://miapp-qa.com";
const LOGIN_URL = `${BASE_URL}/login`;
const PERSONAL_AREA_URL = `${BASE_URL}/mis-datos`;

const USERS = {
  valid: { email: "qa_user@miapp.com", password: "Passw0rd123" },
  invalidEmail: { email: "fake_user@miapp.com", password: "Passw0rd123" },
  invalidPassword: { email: "qa_user@miapp.com", password: "WrongPass123" }
};

const SELECTORS = {
  loginLink: { role: "link" as const, name: /iniciar sesión/i },
  emailField: { label: /email/i },
  passwordField: { label: /contraseña/i },
  submitButton: { role: "button" as const, name: /enviar/i }
};

test.describe("Login tests", () => {
  test("TC001 - El usuario puede acceder a la página de login desde la página principal", async ({ page }) => {
    await page.goto(BASE_URL);
    const loginLink = page.getByRole(SELECTORS.loginLink.role, SELECTORS.loginLink);
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(LOGIN_URL);
  });

  test("TC002 - El formulario de login es accesible con teclado", async ({ page }) => {
    const [user, password] = USERS.valid.email.split("@");
    await page.goto(LOGIN_URL);
    const emailField = page.getByLabel(SELECTORS.emailField.label);
    await emailField.fill(`${user}@miapp.com`); // Correo electrónico del usuario registrado
    const passwordField = page.getByLabel(SELECTORS.passwordField.label);
    await passwordField.fill("Passw0rd123"); // Contraseña válida
    await passwordField.press("Enter"); // Enviar el formulario con Enter
    await expect(page).toHaveURL(PERSONAL_AREA_URL);
  });
});

// Test para revisión: TC003 - El usuario no puede acceder a la página de login desde la página principal si no hay botón o enlace visibles
test("TC003 - El usuario no puede acceder a la página de login desde la página principal si no hay botón o enlace visibles", async ({ page }) => {
  // [REVISAR] Agregar código para validar que no exista un botón o enlace a la página de login visible en la página principal
});