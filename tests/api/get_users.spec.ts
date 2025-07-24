import { test, expect, request } from '@playwright/test';

test('Obtener lista de usuarios', async ({ request }) => {
  const response = await request.get('https://reqres.in/api/users?page=2');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.data.length).toBeGreaterThan(0);
});
