# TD-CP02 — Validación de candidato y QA de navegador
24/11/2026. Commit de código 84f993e4684336eb4d2cd4168d28d1a2f6a5889b.
CI run 45437200482 / job 138598133423: SUCCESS. Logs: tests 9, pass 9, fail 0; TypeScript y build Vite 6.4.1 correctos. Artefacto npm-lockfile 14941712177 recuperado, aún no incorporado a Git.
Se añade una prueba de navegador Chromium sobre preview local del build: 1366x900 y 390x844, alta, duplicado, edición, borrador entre módulos, recarga, búsqueda, cierre, filtros y desbordamiento horizontal de Inicio. Solo fixtures sintéticos. Browser QA se instala de forma aislada del bundle. Resultado de nueva CI pendiente. Sin despliegue; no autentica ni certifica PWA física. CP02 permanece abierto.

## Corrección del entorno
Run 45437812741 / job 138600321924, SHA 71dd37014795370370b8f1db9160f0dd148e27fa: 9/9 pruebas y build PASS, instalación de Chromium FAIL por Ubuntu 26.04 no soportado por Playwright 1.56.1, recorrido SKIP. Corrección acotada: runner ubuntu-24.04, mismo navegador y misma prueba; no alterar lógica para resolver problema de infraestructura. Resultado pendiente. Aprendizaje candidato reutilizable: fijar imagen compatible del runner para evitar cambios de ubuntu-latest; no incorporar a biblioteca privada hasta comprobarlo.

Run 45438132159 / job 138601460930: instalación Chromium PASS en Ubuntu 24.04, pruebas de dominio y build PASS. Recorrido FAIL por timeout getByLabel('Estado', exact:true) después de alta, duplicado, edición, navegación y recarga en escritorio. Se añade aria-label explícita al select, manteniendo la prueba. No se declara PASS del recorrido completo.
