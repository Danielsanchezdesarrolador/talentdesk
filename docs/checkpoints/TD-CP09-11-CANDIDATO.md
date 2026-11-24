# TD-CP09–11 — Administración, indicadores y simulación
Base edc313511b881f0521af4e0ac90da646a2a41962. Fecha 24/11/2026.
CP09: catálogo nueve flujos. PA-01 y PA-02 preparan JSON desde ingreso confirmado DEMO con identificador y snapshot; simulación explícita local sin red, no se indica enviado ni entregado. Bloqueo duplicado flujo+ingreso, historial. PA-03–09 solo planificados. No Microsoft real, endpoints, credenciales ni tokens. No sustituye idempotencia transaccional de backend.
CP10: documentos por postulación, fecha límite, estados, referencia textual ficticia, historial, búsqueda por estado y vencidos. No se suben/leen archivos. Tareas con prioridad, fecha, vacante opcional, estado e historial; ferias con fecha/lugar, estado, cantidad de contactos e historial. Alertas dentro de la aplicación, no notificaciones externas.
CP11: reporte mensual por fechas registradas, CSV resumen, cobertura actual (no histórica) por unidad, indicadores y dashboard de prioridades/agenda. Fechas de eventos ISO en reportes agrupadas por prefijo UTC cuando son timestamps; fechas de agenda son locales. No métricas de desempeño individual automatizadas.
11 pruebas nuevas más 44 previas; CI y navegador pendientes. Solo DEMO local, sin autenticación, sincronización o despliegue. Aceptación humana pendiente. No incorporar datos reales.

Resultado confirmado: CI 45446217231 / job 138630598119 / SHA 1ef9847da39343895c0a896bed8befb8646f1085: 55/55, build y Chromium ambos tamaños PASS. CP09 solo simulación local de PA-01/02; no conexión externa.
