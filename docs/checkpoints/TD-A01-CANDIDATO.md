# TD-A01 — Cierre técnico Smart
RC02 CI 45462586404/job 138688914038: 137/137, build PASS, audit 0, BULK_INCOME_PASS y OCR_PNG_PASS 1366; OCR PDF timeout, móvil no alcanzado. Render LIVE reportado por propietario, SHA no comprobado por falta de acceso a cuenta nueva.
Lock exacto verificado SHA256 3100aa4b6f633b148aaeec01d89c86403fff1eb5ee8c1f83274ed44f0c84d497, 106 entradas, raíz coincide, registry público. npm ci. OCR PDF: recursos locales de PDF.js y contexto explícito; hipótesis de recursos/renderizado sin causa demostrada; alerta QA visible. Referencia API https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html. CI pendiente, sin despliegue.
A/B CI 45464365663/job 138695348262: 140/140, npm ci/build PASS, audit 0, BULK_INCOME_PASS/PROCESS_WORKSPACE_PASS/OCR_PNG_PASS escritorio; PDF OCR FAIL getOrInsertComputed ausente, móvil no alcanzado.
PDF.js legacy publicado como corrección candidata; nuevo CI pendiente.


## Evidencia de cierre técnico
CI 45465159682/job 138698001579, SHA 96ebbd9d7bba55df6895aece845ffbe53fd229c3: SUCCESS; 145/145, npm ci y build PASS, npm audit 0 reportadas; BULK_INCOME_PASS, PAYROLL_EXPORT_PASS, PROCESS_WORKSPACE_PASS, OCR_PNG_PASS, OCR_PDF_PASS y BROWSER_PASS en Chromium 1366x900 y 390x844. OCR legacy resuelve el fallo observado. Alcance sintético, no prueba física ni aceptación institucional.
Sin aceptación física, envío, escritura en Excel ni nuevo despliegue. REM01 sigue sujeto a confirmación de formato completo y reglas del destino.
