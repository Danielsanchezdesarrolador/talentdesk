# TD-B01 — Espacio integral por vacante
Base d03021789a2ed166ccd29037a1c3a9f25b55382c. Abrir proceso por vacante, resumen con indicadores derivados, cobertura manual+confirmados distinguida, postulaciones y ficha, vínculo de candidato existente, importación obligatoriamente vinculada, llamadas, agenda/entrevistas y evaluación, documentos/checklist, ingresos y comunicaciones/historial por fuente. Reutiliza estados y commits completos (no filtra datasets persistidos); filtros UI por applicationId y scope, conflicto agenda sigue global. Vacante cerrada bloquea operaciones de modificación en workspace. No persistencia nueva, no envío. Navegación fuera conserva borradores mientras workspace abierto; cerrar/cambiar/editar pide confirmación. No amplía permisos ni datos reales. Tres pruebas de dominio nuevas (140 programadas), QA workspace desktop/mobile y OCR pendiente. Sin despliegue. C/D/E pendientes, aceptación visual/física posterior.

A/B CI 45464365663/job 138695348262: 140/140, npm ci/build PASS, audit 0, BULK_INCOME_PASS/PROCESS_WORKSPACE_PASS/OCR_PNG_PASS escritorio; PDF OCR FAIL getOrInsertComputed ausente, móvil no alcanzado.
PDF.js legacy publicado como corrección candidata; nuevo CI pendiente.


## Evidencia de cierre técnico
CI 45465159682/job 138698001579, SHA 96ebbd9d7bba55df6895aece845ffbe53fd229c3: SUCCESS; 145/145, npm ci y build PASS, npm audit 0 reportadas; BULK_INCOME_PASS, PAYROLL_EXPORT_PASS, PROCESS_WORKSPACE_PASS, OCR_PNG_PASS, OCR_PDF_PASS y BROWSER_PASS en Chromium 1366x900 y 390x844. OCR legacy resuelve el fallo observado. Alcance sintético, no prueba física ni aceptación institucional.
Sin aceptación física, envío, escritura en Excel ni nuevo despliegue. REM01 sigue sujeto a confirmación de formato completo y reglas del destino.
