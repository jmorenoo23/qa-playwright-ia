import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { Flags } from 'lighthouse/types/externs';

export interface PerformanceMetrics {
  url: string;
  score: number;
  fcp: number;
  lcp: number;
  tti: number;
  tbt: number;
  cls: number;
  fullReportPath?: string;
}

export async function analyzePerformance(
  url: string,
  categories: string[] = ['performance'],
  saveReport: boolean = false,
  reportPath: string = `./reports/performance/lighthouse-${Date.now()}.json`
): Promise<PerformanceMetrics> {
  const chrome = await launch({ chromeFlags: ['--headless'] });

  const options: Flags = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: categories,
    port: chrome.port
  };

  const runnerResult = await lighthouse(url, options);
  await chrome.kill();

  if (!runnerResult) {
    throw new Error(`❌ Lighthouse no devolvió resultados para: ${url}`);
  }

  // Guardar el reporte completo si se solicita
  if (saveReport && runnerResult.report) {
    const fs = await import('fs');
    fs.writeFileSync(reportPath, runnerResult.report as string, 'utf-8');
    console.log(`📄 Reporte completo guardado en: ${reportPath}`);
  }

  const audits = runnerResult.lhr.audits;

  return {
    url,
    score: (runnerResult.lhr.categories.performance.score ?? 0) * 100,
    fcp: audits['first-contentful-paint'].numericValue ?? 0,
    lcp: audits['largest-contentful-paint'].numericValue ?? 0,
    tti: audits['interactive'].numericValue ?? 0,
    tbt: audits['total-blocking-time'].numericValue ?? 0,
    cls: audits['cumulative-layout-shift'].numericValue ?? 0,
    fullReportPath: saveReport ? reportPath : undefined
  };
}
