# Harbiz — Informe de Inspección Técnica
**Fecha:** 2026-05-31 | **Agente:** Inspector Chrome | **Estado:** COMPLETADO

> ⚠️ Datos personales enmascarados. No se modificó ningún dato en Harbiz.

---

## 1. Stack técnico detectado

| Componente | Tecnología |
|---|---|
| Framework backend/frontend | **Meteor.js 3.4** (Blaze templates) |
| Protocolo de datos | **DDP** (Distributed Data Protocol) sobre **SockJS** |
| Storage archivos | Google Cloud Storage (`harbiz-app-production`) |
| Router | FlowRouter (152 rutas registradas) |
| Analytics | Facebook Pixel, HubSpot, MontiaAPM |
| Pagos | Stripe |
| **API REST pública** | ❌ **NO existe** |

### Implicación crítica
Harbiz no expone ninguna REST API. **Toda la comunicación de datos ocurre via DDP** (WebSocket bidireccional, protocolo propietario de Meteor). Los `Meteor.call()` son RPCs sobre SockJS, no llamadas HTTP.

---

## 2. Rutas FlowRouter relevantes (de 152 totales)

```
/home-profesional              ← Dashboard principal
/agenda                        ← Calendario mensual
/sessions                      ← Sesiones agendadas (lista)
/session-types                 ← Tipos de sesiones
/appointments                  ← Horario de citas
/clientes/listado              ← Lista de clientes
/clientes/:clientId/planificacion
/clientes/:clientId/nutricion
/clientes/:clientId/informacion/:tab?   ← tabs: general, plan-y-productos, historial, negocio
/clientes/:clientId/documentos
/clientes/:clientId/evolucion/:tab?
/pagos                         ← Pagos externos
/pagos-harbiz/planes           ← Planes Harbiz
/pagos-harbiz/facturas         ← Facturas
/dashboard-business            ← Dashboard negocio
/dashboard-reports             ← Reportes
/equipo                        ← Equipo de profesionales
/libreria/ejercicios           ← Biblioteca ejercicios
/libreria/workouts             ← Biblioteca workouts
/libreria/nutricion            ← Biblioteca nutrición
/libreria/programas            ← Programas
/etiquetas                     ← Tags/etiquetas
/leads                         ← Leads/prospectos
```

---

## 3. Meteor Collections cliente (mini-mongo)

Estas colecciones existen en el cliente pero se pueblan **sólo cuando hay subscriptions activas**. En la práctica, la mayoría de datos se carga via `Meteor.call` (métodos RPC), no subscriptions.

| Variable global | Nombre colección | Descripción GymBook equiv. |
|---|---|---|
| `Clients` | `clients` | Client |
| `Professionals` | `professionals` | Teacher |
| `SessionTypes` | `sessionTypes` | Activity |
| `SubscriptionPlans` | `subscriptionPlans` | CreditType / plan |
| `CalEvents` | `calEvents` | Booking |
| `VideoSessions` | `videoSessions` | Booking (online) |
| `LiveSessions` | `liveSessions` | Booking (live/presencial) |
| `Workouts` | `workouts` | — |
| `NutritionPlans` | `nutritionPlans` | — |
| `Guests` | `guests` | — |
| `Leads` | `leads` | — |
| `Messages` | `messages` | — |
| `Addons` | `addons` | — |
| `FilesForClients` | `filesForClients` | — |
| `ConsentsLog` | `consentsLog` | — |

**Subscriptions activas en home-profesional:**
- `meteor.loginServiceConfiguration`
- `_roles`
- `meteor_autoupdate_clientVersions`
- `professionalProfile`
- `appEvents`

---

## 4. Métodos DDP descubiertos (`Meteor.call`)

### 4.1 Clientes

| Método | Args (keys) | Equivalente GymBook |
|---|---|---|
| `professional.clients.getPaginatedClients` | `{limit,skip,sort}`, `{clientType,search,filters}`, `boolean` | GET /api/clients |
| `professional.clients.getActiveClientsCount` | — | — |
| `professional.clients.getArchivedClientsCount` | — | — |
| `professional.clients.getLeadClientsCount` | — | — |
| `professional.clients.getGuestsCount` | — | — |
| `professional.clients.getAssignedClientsCount` | — | — |
| `professional.clients.getAssignedToMeClientsCount` | — | — |
| `professional.clients.getUnassignedClientsCount` | — | — |
| `client.getById` | `{clientId}` | — |
| `client.getClientSectionInfoById` | `{clientId}` | — |
| `client.getClientPrograms` | `{clientId}` | — |
| `client.taxInformation.get` | `string` (clientId) | — |

### 4.2 Sesiones / Reservas (≡ Bookings)

| Método | Args (keys) | Equivalente GymBook |
|---|---|---|
| `allLiveSessionsByDateMethod` | `{startDate,endDate,options}` | **GET /api/bookings** ← KEY |
| `liveSessions.allLiveSessionsByMonth` | `{startDate,endDate,profId,filter}` | GET /api/bookings (mensual) |
| `calEventsProf.allCalEventsProfByMonth` | `{startDate,endDate,profId,filter}` | Eventos calendario |
| `reminders.allRemindersProfByMonth` | `{startDate,endDate,profId,filter}` | Recordatorios |
| `privateEvents.allPrivateEventsProfByMonth` | `{startDate,endDate,profId,filter}` | Eventos privados |
| `calEvents.getByClientId` | `string, arr, arr` | Reservas de un cliente |
| `calEventsNutrition.getByClientId` | `string, arr, arr` | — |

### 4.3 Tipos de sesiones (≡ Activities)

| Método | Args | Equivalente GymBook |
|---|---|---|
| `getAllSessionTypes` | — | GET /api/activities |

**Tipos observados en UI:** "Consulta online", "Entrenamiento presencial"

### 4.4 Planes / Bonos / Créditos (≡ Credits)

| Método | Args (keys) | Equivalente GymBook |
|---|---|---|
| `sessionPacks.getSessionPacksByClientId` | `string` (clientId) | **GET /api/credits** ← KEY |
| `subscriptionPlans.getListActives` | — | — |
| `subscriptionPlans.getListActivePaginated` | `{limit,toSkip,search}` | — |
| `client.getOfferedPlans` | `{clientId,search,limit,skip,sort}` | — |
| `client.getAddons` | `{clientId,search,limit,skip,sort}` | — |
| `client.getPrivateAddons` | `{clientId,search,limit,skip,sort}` | — |
| `getAddonsByProf` | `{search,limit}` | — |
| `getPrivateAddonsToOffered` | `string,string,number` | — |

### 4.5 Profesionales / Equipo

| Método | Args | Equivalente GymBook |
|---|---|---|
| `professional.getByUserId` | — | GET /api/teachers |
| `professional.getPublicInfoByUserId` | `string` (userId) | — |
| `professional.getPaymentsInfoById` | `string` | — |
| `getAllTeamProfessionals` | `{includeSelf}` | — |
| `allCollaborators` | `{userId,profId,includeSelf}` | — |

### 4.6 Negocio / Finanzas

| Método | Args (keys) | Descripción |
|---|---|---|
| `business.dashboard.finance.indicators` | `{from,to}` | KPIs financieros del período |
| `business.dashboard.finance.harbizListPlan` | `{from,to,limit,skip,sort,plans,addons,search}` | Lista planes cobrados |
| `business.dashboard.finance.harbizListProducts` | `{from,to,limit,skip,sort,plans,addons,search}` | Lista productos cobrados |
| `business.dashboard.finance.externalReceiptsStatus` | `{from,to}` | Recibos externos |
| `business.dashboard.finance.externalSells` | `{from,to}` | Ventas externas |
| `business.dashboard.finance.harbizBalancePlans` | `{from,to}` | Balance planes |
| `business.dashboard.finance.harbizBalanceProducts` | `{from,to}` | Balance productos |
| `stripeCouponList` | — | Cupones Stripe |

### 4.7 Otros métodos útiles

| Método | Args | Descripción |
|---|---|---|
| `tags.getAllTags` | — | Etiquetas |
| `notesByClientPaginated` | `{clientId,limit,skip,sort,filters,search}` | Notas por cliente |
| `reminders.getByClientId` | `string, arr, arr` | Recordatorios del cliente |
| `forms.getFormsPaginated` | `{limit,search,formId}` | Formularios |
| `images.getAllLiveSessionImages` | — | Imágenes de sesiones |
| `getAutomationStartDate` | `{clientId}` | Automatizaciones |
| `nutrition.getRecipesProfessional` | `string, number` | — |

---

## 5. Schema de campos (UI observada)

### Cliente (visible en `/clientes/:id/informacion/general`)
```
nombre          (string)    — nombre completo
apellido        (string)    — dentro del nombre
email           (string)    — identificador único
telefono        (string)    — puede estar vacío
fechaNacimiento (date)      — "dd/mm/yyyy (edad)"
numeroId        (string)    — DNI/NIF (puede vacío)
direccion       (string)
ciudad          (string)
cp              (string)
etiquetas       (array)     — tags personalizados
profesionales   (array)     — profesionales asignados
fechaActivacion (date)
tieneApp        (boolean)   — si descargó la app
plan            (string)    — nombre del plan activo
estadoPlan      (enum)      — "Sin plan de pago" | otros
ultimoPago      (date)
cumplimientoS   (number)    — % semanal
cumplimientoM   (number)    — % mensual
tipo            (enum)      — "presencial" | "online"
```

### Sesiones agendadas (visible en `/sessions`)
```
startDate       (date)
sessionType     (string)    — "Entrenamiento Personal"
tags            (array)     — ["Entrenamiento presencial", "Sesión presencial"]
presencial      (boolean)
online          (boolean)
clientId        (string)    — ID Meteor del cliente
```

### Tipos de sesiones (visible en `/session-types`)
```
nombre          (string)    — "Consulta online", "Entrenamiento presencial"
color           (string)    — hex color
createdAt       (date)
```

### Estadísticas de sesiones (`/sessions`)
```
totalSesiones   (number)    — 20 (presenciales + online)
asistencia      (number%)   — 0% (0/19)
presenciales    (number)    — 20
online          (number)    — 0
```

---

## 6. Método de integración viable

### ❌ No viable: REST API
No existe ninguna API REST pública o privada documentada en Harbiz.

### ✅ Viable: DDP Client (método principal)
Usar una librería DDP cliente para conectarse al WebSocket SockJS de Harbiz:

```
WebSocket URL: wss://app.harbiz.io/sockjs/*/*/websocket
               (SockJS usa paths con tokens aleatorios)
Protocolo: DDP sobre SockJS
Auth: Meteor.call("login", {user: {email}, password: {digest}}) → token JWT
```

**Librerías candidatas:**
- `ddp` (npm) — cliente DDP puro para Node.js
- `simpleddp` (npm) — wrapper más amigable
- `node-ddp-client` — alternativa

**Flujo de integración:**
1. Conectar al WebSocket SockJS de Harbiz
2. Autenticar con credenciales del profesional → obtener userId + token
3. Llamar `professional.clients.getPaginatedClients` → lista de clientes
4. Por cliente: `client.getById`, `sessionPacks.getSessionPacksByClientId`
5. Llamar `allLiveSessionsByDateMethod` con rango de fechas → sesiones
6. Llamar `getAllSessionTypes` → tipos de sesión
7. Mapear entidades Harbiz → GymBook (ver mapper.ts)

### ❌ No viable: Export manual (CSV)
**Confirmado**: Harbiz **no tiene opción de exportar CSV**. La selección múltiple de clientes sólo muestra: "Asignar profesionales", "Asignar etiquetas", "Archivar". No existe botón de descarga/exportación ni en la UI ni en métodos DDP capturados.

### ❌ No viable: Scraping HTML
La app es una SPA Blaze (DOM generado por JS), sin HTML estático parseable.

### ❌ No viable: ICS para sesiones
No se encontró opción de export ICS de sesiones (sólo el calendario de Google puede sincronizarse según la UI).

---

## 7. Riesgos actualizados

| Riesgo | Severidad | Detalle | Mitigación |
|---|---|---|---|
| No hay API REST pública | ALTO | Confirmado: sólo DDP | Usar ddp npm client |
| SockJS path cambia en cada conexión | MEDIO | El path incluye tokens random | Usar librería SockJS compatible |
| Auth token Harbiz puede expirar | MEDIO | Tokens Meteor tienen TTL | Reconectar + re-auth automático |
| Rate limiting no conocido | MEDIO | No documentado | Respetar pausas entre llamadas |
| Cambio de métodos DDP en updates Harbiz | ALTO | Sin API contrato | Feature flag + version check |
| Duplicados por email en GymBook | MEDIO | Dedup necesario | Cruzar por email antes de import |
| Timezone | BAJO | Harbiz: puede ser UTC o local | Normalizar a Europe/Madrid |
| Datos sensibles en logs | ALTO | Nombres, emails, teléfonos | Enmascarar siempre en logs |

---

## 8. Entidades Harbiz → GymBook (mapping preliminar)

| Harbiz | GymBook | Clave de matching |
|---|---|---|
| Cliente (clients collection) | Client | email |
| Profesional (professionals) | Teacher | email / userId |
| Tipo de sesión (session-types) | Activity | nombre |
| LiveSession / CalEvent | Booking | startDate + clientId + profId |
| SessionPack (bono) | ClientCredits | clientId + sessionType |
| SubscriptionPlan | — (sin equivalente directo) | — |
| Tag | — | — |

---

## 9. Datos enmascarados observados

En el proceso de inspección se vieron datos reales (sin copiar ni guardar):
- [NOMBRE] [APELLIDO] — varios clientes activos (26 activos, 3 archivados)
- [EMAIL]@gmail.com / [EMAIL]@hotmail.com — emails de clientes
- Fecha nacimiento: [FECHA] (edad observada)
- 20 sesiones en período 31/05–15/06/2026

---

## 10. Próximos pasos recomendados

1. **Verificar export CSV** — explorar botón exportar en `/clientes/listado`
2. **Prueba DDP auth** — conectar con `simpleddp` en Node.js, autenticar, llamar `professional.getByUserId`
3. **Inspeccionar respuesta de métodos clave** — capturar schema completo de `professional.clients.getPaginatedClients` y `sessionPacks.getSessionPacksByClientId`
4. **Diseñar mapper** — `HarbizClient → GymBookClient`, `HarbizSession → GymBookBooking`
5. **Diseñar dry-run** — sync sin escritura real en GymBook, con diff report
