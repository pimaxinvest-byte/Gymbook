# GymBook — Context Summary para integración Harbiz
**Fecha:** 2026-05-31 | **Versión app:** v1.2.0

---

## Stack detectado
| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 App Router, TypeScript |
| ORM/DB | Prisma 5 + PostgreSQL (Railway) |
| Auth | NextAuth v5 JWT, Credentials provider |
| Mensajería | Telegram Bot API v7 (webhook bidireccional) |
| Deploy | Railway (Node 22, Railpack) |
| Timezone | Europe/Madrid (todo el sistema) |

---

## Modelos relevantes para integración Harbiz

### Entidades core
| Modelo | Campos clave | Notas |
|---|---|---|
| User | id, email, name, role, telegramChatId | Padre de Teacher y Client |
| Teacher | id, userId, color, specialties[] | Relación 1:1 con User |
| Client | id, userId, status (PENDING/ACTIVE/REJECTED/SUSPENDED), phone, goals, preferredTeacherId | |
| ClientTeacher | clientId, teacherId | Máx 2 profesores por cliente |
| Booking | id, teacherId, clientId, spaceId, activityId, startDatetime, endDatetime, status, sessionType, capacity | |
| ClientCredits | id, clientId, teacherId, creditType, balance, totalAssigned, paymentStatus, amountPaid | |
| CreditLog | id, clientCreditsId, clientId, actionType, amount, bookingId | Audit trail completo |
| AvailabilitySlot | id, teacherId, spaceId, activityId, startDatetime, endDatetime, isRecurring | |

### Enums relevantes
- BookingStatus: AVAILABLE / BOOKED / CANCELLED / COMPLETED / BLOCKED
- SessionType: INDIVIDUAL / SGT
- CreditType: INDIVIDUAL / SGT
- PaymentStatus: PAID / UNPAID / PARTIAL
- ClientStatus: PENDING / ACTIVE / REJECTED / SUSPENDED

---

## Endpoints internos relevantes para Harbiz

### Lectura
- GET /api/clients — lista clientes (ADMIN/TEACHER)
- GET /api/teachers — lista profesores
- GET /api/bookings?teacherId=&start=&end= — reservas por rango
- GET /api/credits?clientId=&teacherId= — créditos
- GET /api/stats?period=&teacherId= — estadísticas
- GET /api/bookings/export-ics — exportación ICS por profesor

### Escritura (no tocar en fase estudio)
- POST /api/credits — asignar créditos
- POST /api/bookings/client-book — crear reserva cliente
- POST /api/bookings/teacher-book — profesor reserva para cliente

---

## Dónde encajará Harbiz

```
src/integrations/harbiz/
  HarbizAdapter.ts          ← interfaz base
  HarbizCsvAdapter.ts       ← si Harbiz exporta CSV
  HarbizApiAdapter.ts       ← si hay API observable
  HarbizIcsAdapter.ts       ← para reservas vía ICS
  mapper.ts                 ← Harbiz model → GymBook model
  syncService.ts            ← orquestador
  syncLogs.ts               ← logging
  types.ts                  ← interfaces

Nuevas tablas (pendiente diseño):
  teacher_harbiz_connections
  external_id_mappings
  external_sync_logs
  sync_batches
```

**Punto de entrada UI:** Botón "Sincronizar Harbiz" en /teacher/clients o /admin/teachers por profesor.

---

## Riesgos iniciales

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Harbiz no tiene API pública documentada | ALTO | Inspeccionar network tab para API interna |
| Duplicados cliente por email | MEDIO | Dedup por email antes de import |
| Conflicto de horarios en reservas | MEDIO | Usar checkBookingConflicts() existente |
| Sobrescritura de datos locales | ALTO | Dry-run + confirmación antes de escribir |
| Cambio de UI de Harbiz rompe Playwright | MEDIO | Selectores robustos + feature flag |
| Timezone mismatch | BAJO | Normalizar a Europe/Madrid siempre |

---

## Decisión inicial
- **No tocar core de la app** durante la fase de estudio.
- **No modificar datos en Harbiz** durante la inspección.
- **No guardar credentials** en archivos.
- Esperar resultado de inspección Agente 1 antes de elegir método.
