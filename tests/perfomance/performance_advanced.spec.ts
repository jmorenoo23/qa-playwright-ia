import { test, expect } from '@playwright/test';
import { analyzePerformance } from '../../utils/performanceUtils';

test.describe('Performance avanzada con métricas detalladas', () => {
  test('Validar métricas principales', async () => {
    const metrics = await analyzePerformance('https://www.saucedemo.com/', ['performance'], true);

    console.log("📊 Métricas detalladas:", metrics);

    expect(metrics.score).toBeGreaterThan(80);
    expect(metrics.fcp).toBeLessThan(2000);  // 2s
    expect(metrics.lcp).toBeLessThan(2500);  // 2.5s
    expect(metrics.tti).toBeLessThan(4000);  // 4s
    expect(metrics.tbt).toBeLessThan(300);   // 300ms
    expect(metrics.cls).toBeLessThan(0.1);   // CLS aceptable
  });
});
