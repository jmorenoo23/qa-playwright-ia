import * as fs from 'fs';
import * as path from 'path';

interface Metrics {
  date: string;
  url: string;
  score: number;
  fcp: number;
  lcp: number;
  tti: number;
  tbt: number;
  cls: number;
}

function loadMetrics(): Metrics[] {
  const reportsDir = path.resolve(__dirname, '../reports/performance');
  if (!fs.existsSync(reportsDir)) {
    throw new Error(`❌ No se encontró la carpeta: ${reportsDir}`);
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
  const metrics: Metrics[] = [];

  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf-8'));

    metrics.push({
      date: new Date(parseInt(file.match(/\d+/)?.[0] || Date.now().toString())).toLocaleString(),
      url: content.lhr?.requestedUrl || "N/A",
      score: (content.lhr?.categories?.performance?.score || 0) * 100,
      fcp: content.lhr?.audits['first-contentful-paint']?.numericValue || 0,
      lcp: content.lhr?.audits['largest-contentful-paint']?.numericValue || 0,
      tti: content.lhr?.audits['interactive']?.numericValue || 0,
      tbt: content.lhr?.audits['total-blocking-time']?.numericValue || 0,
      cls: content.lhr?.audits['cumulative-layout-shift']?.numericValue || 0
    });
  }

  return metrics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function generateHTML(metrics: Metrics[]) {
  const labels = metrics.map(m => m.date);
  const score = metrics.map(m => m.score);
  const fcp = metrics.map(m => m.fcp);
  const lcp = metrics.map(m => m.lcp);
  const tti = metrics.map(m => m.tti);
  const tbt = metrics.map(m => m.tbt);
  const cls = metrics.map(m => m.cls);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Rendimiento</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    canvas { max-width: 900px; margin: 20px auto; display: block; }
  </style>
</head>
<body>
  <h1>📊 Reporte de Rendimiento Lighthouse</h1>
  <p>URL Analizada: <b>${metrics[metrics.length - 1]?.url}</b></p>
  <canvas id="scoreChart"></canvas>
  <canvas id="perfMetrics"></canvas>

  <script>
    const labels = ${JSON.stringify(labels)};
    const scoreData = ${JSON.stringify(score)};
    const fcp = ${JSON.stringify(fcp)};
    const lcp = ${JSON.stringify(lcp)};
    const tti = ${JSON.stringify(tti)};
    const tbt = ${JSON.stringify(tbt)};
    const cls = ${JSON.stringify(cls)};

    new Chart(document.getElementById('scoreChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Performance Score',
          data: scoreData,
          borderColor: 'green',
          backgroundColor: 'rgba(0,128,0,0.2)',
          fill: true
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });

    new Chart(document.getElementById('perfMetrics'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'FCP (ms)', data: fcp, backgroundColor: 'blue' },
          { label: 'LCP (ms)', data: lcp, backgroundColor: 'orange' },
          { label: 'TTI (ms)', data: tti, backgroundColor: 'purple' },
          { label: 'TBT (ms)', data: tbt, backgroundColor: 'red' },
          { label: 'CLS', data: cls, backgroundColor: 'gray' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  </script>
</body>
</html>`;
}

function main() {
  const metrics = loadMetrics();
  if (!metrics.length) {
    console.log("❌ No hay reportes para mostrar.");
    return;
  }

  const html = generateHTML(metrics);
  const outputPath = path.resolve(__dirname, '../reports/performance/performance_report.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`✅ Reporte generado: ${outputPath}`);
}

main();
