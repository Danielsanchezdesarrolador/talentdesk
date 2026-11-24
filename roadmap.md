# TalentDesk 1.0 — Roadmap
Objetivo: gestionar vacantes, candidatos, contactos, entrevistas e ingresos desde una web/PWA personal. Excel como intercambio, no fuente principal. Presupuesto objetivo cero; sin pagos ni comercialización.

| Etapa | Estado | Salida verificable |
|---|---|---|
| TD-CP01 Definición | Cerrado (alcance inicial) | Alcance inicial y diseño Studio aprobados; backend real y activos finales diferidos |
| TD-CP02 Cimientos | Validado técnicamente (DEMO) | Primera operación persistente sintética y validación en navegador; acceso privado requerido antes de datos reales |
| TD-CP03 Catálogos | Validado técnicamente (DEMO) | Cargos, unidades, jefaturas, horarios, rentas, empresas y plantillas editables con datos ficticios; condiciones asociables a vacantes |
| TD-CP04 Vacantes | Validado técnicamente (DEMO) | Crear, editar, buscar y cerrar vacantes con historial |
| TD-CP05 Candidatos | Validado técnicamente (DEMO) | Ficha única, CV sintético, postulaciones y detección de duplicados |
| TD-CP06 Llamados | Validado técnicamente (DEMO) | Cola de contactos, resultados y seguimiento |
| TD-CP07 Entrevistas | Validado técnicamente (DEMO) | Agenda, asistencia, feedback y decisión humana |
| TD-CP08 Ingresos | Validado técnicamente (DEMO) | Autocompletar condiciones, elegir empresa, generar fila y borrador de correo |
| TD-CP09 Automatización | Simulación validada (DEMO); integración pendiente | PA-01/02 preparación y simulación, siete flujos restantes planificados; integración real requiere autorización |
| TD-CP10 Documentos | Validado técnicamente (DEMO) | Seguimiento documental e historial |
| TD-CP11 Indicadores | Validado técnicamente (DEMO) | Dashboard y reportes calculados desde registros |
| TD-CP12 PWA | CI PASS; LIVE reportado, aceptación pendiente | Prueba física, recuperación y aceptación según alcance autorizado |

MVP: recorrido completo sintético desde vacante hasta fila de ingreso y borrador de correo, sin depender de integraciones externas. React/TypeScript/Vite para DEMO local; backend real por decidir. Integraciones Microsoft sujetas a permisos y licencias. No publicar datos reales ni recursos privados.

## Optimización Smart — roadmap maestro
| Bloque | Estado | Resultado esperado |
|---|---|---|
| TD-R01 Investigación | Base documental inicial | Patrones ATS y selección tecnológica; sin copiar código externo |
| TD-R02 Autocompletado | Validado técnicamente (DEMO) | Vacantes rápidas, reutilización y lectura asistida de texto |
| TD-R03 Importación | Validado técnicamente (alcance textual) | CSV/TSV/XLSX, PDF textual, texto pegado, plantillas y revisión masiva; OCR pendiente |
| TD-R04 Studio | Validado técnicamente (DEMO) | Diseño compacto, navegación y búsqueda |
| TD-R05 Productividad | Ampliación local validada | Acciones, seguimiento, citaciones locales e ICS; Microsoft pendiente |
| TD-R06 Ingresos | Validado técnicamente (dominio y exportación navegador) | Preparación masiva; recorrido de preparación en navegador pendiente |
| TD-R07 Datos privados | Fundamentos DEMO validados | Respaldo cifrado y protocolo de revisiones; backend/identidad autorizados pendientes |
| TD-R08 Microsoft | Alcance local validado; proveedor pendiente | Vistas PA-06 a PA-09, ICS/citación e importación manual; conexiones requieren autorización |
| TD-R09 Optimización | Checklist y reportes locales validados | Checklist masivo y reportes semanales; medición real y aceptación pendientes |

| TD-CIT01 Citaciones masivas | Validado técnicamente (DEMO) | Pegado Excel, horarios, revisión individual y exportación CSV DEMO; envío institucional pendiente |

| TD-CIT02 Agenda masiva | Validado técnicamente (DEMO) | Agendar y reprogramar postulaciones, conservar historial, controlar hora exacta; CI PASS |

| TD-COM01 Comunicaciones | Validado técnicamente (DEMO) | Centro de borradores desde fuentes existentes, revisión y exportación; sin envío |

| TD-COM02 Historial y consolidación | Validado técnicamente (DEMO) | Borradores revisados persistentes y CV textual mejorado; CI PASS |

| TD-SMART-RC01 Consolidación DEMO | Candidato | OCR local, prueba de ingresos masivos completa, auditoría y recuperación de lockfile; CI pendiente |
