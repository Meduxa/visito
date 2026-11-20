// Visito's legal documents as PDFs (Georgian and English), from the same texts the
// website shows: docs/legal/visito-legal.{ka,en}.json → docs/legal/pdf/*.pdf.
// No logo on purpose (the logo is about to change). Run: node scripts/legal-pdf.mjs
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "docs/legal/pdf");
mkdirSync(out, { recursive: true });
const font = (w) => pathToFileURL(resolve(root, `src/app/fonts/FiraGO-${w}.woff2`)).href;

const DOCS = ["terms", "privacy", "dpa", "payments"];
const FILE = {
  terms: "Terms-of-Service",
  privacy: "Privacy-Policy",
  dpa: "Data-Processing-Agreement",
  payments: "Payments-and-Refunds",
};
const LABEL = {
  ka: { version: "ვერსია", effective: "ძალაშია", date: "2026 წლის 14 ნოემბრიდან" },
  en: { version: "Version", effective: "Effective", date: "from 14 November 2026" },
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function body(text) {
  let html = "";
  let list = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) {
      if (!list) html += "<ul>";
      list = true;
      html += `<li>${esc(line.slice(2))}</li>`;
    } else {
      if (list) html += "</ul>";
      list = false;
      if (line.trim()) html += `<p>${esc(line)}</p>`;
    }
  }
  return html + (list ? "</ul>" : "");
}

function page(doc, lang, src) {
  const d = src[doc];
  const l = LABEL[lang];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:FiraGO;src:url(${font("Regular")});font-weight:400}
@font-face{font-family:FiraGO;src:url(${font("Medium")});font-weight:500}
@font-face{font-family:FiraGO;src:url(${font("SemiBold")});font-weight:600}
@font-face{font-family:FiraGO;src:url(${font("Bold")});font-weight:700}
body{font-family:FiraGO,sans-serif;color:#1f2937;font-size:10.5pt;line-height:1.55;margin:0}
.brand{font-size:9pt;color:#6b7280;letter-spacing:.02em;margin:0 0 18pt}
h1{font-size:19pt;font-weight:700;margin:0 0 4pt;color:#111827}
.meta{font-size:9pt;color:#6b7280;margin:0 0 20pt;padding-bottom:12pt;border-bottom:1px solid #e5e7eb}
h2{font-size:11.5pt;font-weight:600;margin:16pt 0 5pt;color:#111827;break-after:avoid}
p{margin:0 0 6pt}
ul{margin:0 0 6pt;padding-left:16pt}
li{margin:0 0 3pt}
section{break-inside:avoid-page}
</style></head><body>
<p class="brand">Visito · visito.ge</p>
<h1>${esc(d.title)}</h1>
<p class="meta">${l.version}: ${src.version} · ${l.effective} ${l.date}</p>
${d.sections.map((s) => `<section><h2>${esc(s.h)}</h2>${body(s.p)}</section>`).join("\n")}
</body></html>`;
}

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 794, height: 1123 } });
for (const lang of ["ka", "en"]) {
  const src = JSON.parse(readFileSync(resolve(root, `docs/legal/visito-legal.${lang}.json`), "utf8"));
  for (const doc of DOCS) {
    await tab.setContent(page(doc, lang, src), { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    const file = resolve(out, `Visito-${FILE[doc]}-${lang.toUpperCase()}.pdf`);
    await tab.pdf({
      path: file,
      format: "A4",
      margin: { top: "18mm", bottom: "18mm", left: "18mm", right: "18mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:8px;color:#9ca3af;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    if (process.env.PREVIEW)
      await tab.screenshot({
        path: file.replace(/.pdf$/, ".png"),
        clip: { x: 0, y: 0, width: 794, height: 1123 },
      });
    console.log(file);
  }
}
await browser.close();
