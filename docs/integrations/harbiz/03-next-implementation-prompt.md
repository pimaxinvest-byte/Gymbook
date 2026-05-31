# Prompt de implementación — Integración Harbiz

> Copia este prompt completo al siguiente agente de implementación.

---

## Contexto del proyecto

**App:** GymBook — Next.js 16 App Router, TypeScript, Prisma 5 + PostgreSQL, NextAuth v5 JWT  
**Repo:** `C:\Users\pietr\gym-booking`  
**Archivos de contexto:**
- `docs/integrations/harbiz/00-context-summary.md` — stack y modelos GymBook
- `docs/integrations/harbiz/01-harbiz-inspection-report.md` — hallazgos Harbiz
- `docs/integrations/harbiz/02-sync-architecture-plan.md` — arquitectura completa

Lee esos 3 archivos antes de escribir cualquier código.

---

## Lo que tienes que implementar

Integración **Harbiz → GymBook** (import unidireccional, READ-ONLY de Harbiz).

### Fase 1: Prisma schema

Añadir al final de `prisma/schema.prisma`:

```prisma
model TeacherHarbizConnection {
  id           String   @id @default(cuid())
  teacherId    String   @unique
  teacher      Teacher  @relation(fields: [teacherId], references: [id])
  harbizProfId String?
  lastSyncAt   DateTime?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  syncLogs     ExternalSyncLog[]
}

model ExternalIdMapping {
  id          String   @id @default(cuid())
  entityType  String   // "CLIENT" | "BOOKING" | "CREDIT"
  gymBookId   String
  externalId  String
  source      String   @default("HARBIZ")
  createdAt   DateTime @default(now())
  @@unique([entityType, externalId, source])
  @@unique([entityType, gymBookId, source])
}

model ExternalSyncLog {
  id              String   @id @default(cuid())
  connectionId    String
  connection      TeacherHarbizConnection @relation(fields: [connectionId], references: [id])
  syncType        String   @default("FULL")
  status          String   @default("PENDING")
  dryRun          Boolean  @default(true)
  clientsFound    Int      @default(0)
  clientsCreated  Int      @default(0)
  clientsUpdated  Int      @default(0)
  sessionsFound   Int      @default(0)
  sessionsCreated Int      @default(0)
  packsFound      Int      @default(0)
  packsCreated    Int      @default(0)
  errors          Json?
  diffJson        Json?
  startedAt       DateTime @default(now())
  completedAt     DateTime?
}
```

Luego: `npx prisma migrate dev --name harbiz-integration`

### Fase 2: src/integrations/harbiz/types.ts

Copiar las interfaces del archivo `02-sync-architecture-plan.md` sección 5.

### Fase 3: src/integrations/harbiz/HarbizDdpClient.ts

```typescript
// Dependencias: npm install simpleddp ws
// El código esquema está en 02-sync-architecture-plan.md sección 6.
// IMPORTANTE: El password se debe pasar ya hasheado (SHA-256) desde fuera.
// NUNCA loguear el token, el email, ni el password.
```

Puntos clave:
- URL WebSocket: `wss://app.harbiz.io/sockjs/[random]/[random]/websocket` — usar `simpleddp` que maneja SockJS
- Auth: `Meteor.call('login', {user: {email}, password: {digest: sha256(password), algorithm: 'sha-256'}})`
- Método clientes: `professional.clients.getPaginatedClients`
- Método sesiones: `allLiveSessionsByDateMethod`
- Método packs: `sessionPacks.getSessionPacksByClientId`
- Método tipos: `getAllSessionTypes`

### Fase 4: src/integrations/harbiz/mapper.ts

Ver sección 7 del plan. Asegurar:
- Fechas → `normalizeToMadrid()` (usar `date-fns-tz` con `Europe/Madrid`)
- Email → `.toLowerCase().trim()`
- Dedup logic: primero `ExternalIdMapping`, luego cruzar por email

### Fase 5: src/integrations/harbiz/syncService.ts

```typescript
export async function runHarbizSync(opts: {
  teacherId: string;
  dryRun: boolean;
  dateRangeStart?: Date; // default: hace 3 meses
  dateRangeEnd?: Date;   // default: hoy + 1 mes
}): Promise<HarbizSyncResult>
```

Lógica:
1. Crear registro `ExternalSyncLog` con status "PENDING"
2. Conectar `HarbizDdpClient` con credentials de env vars
3. Paginar clientes (10 por llamada)
4. Para cada cliente: resolver dedup, preparar operación
5. Fetch sesiones por rango de fechas
6. Fetch packs por clientId
7. Si `dryRun=false`: ejecutar `prisma.$transaction` con todas las escrituras
8. Actualizar `ExternalSyncLog` con resultado
9. Desconectar DDP

### Fase 6: src/app/api/harbiz/sync/route.ts

```typescript
// POST /api/harbiz/sync?dryRun=true
// Auth: ADMIN only
// Body: { teacherId?: string }
// Llama runHarbizSync(), devuelve HarbizSyncResult
```

### Fase 7: src/app/admin/harbiz/page.tsx

UI con:
1. Card de estado: último sync, errores, conexión
2. Botón "Previsualizar sync" → dry-run → muestra tabla diff
3. Si dry-run OK → botón "Confirmar sync"
4. Tabla diff: columnas Entidad | Acción | Datos | ID Harbiz

---

## Reglas de seguridad obligatorias

1. **NUNCA guardar en DB**: `HARBIZ_EMAIL`, `HARBIZ_PASSWORD`, tokens DDP
2. Las credenciales sólo en env vars Railway: `HARBIZ_EMAIL`, `HARBIZ_PASSWORD`
3. **NUNCA loguear** emails, nombres o teléfonos de clientes en logs/console
4. `diffJson` en DB: sólo IDs y tipos, no PII
5. Dry-run por defecto: `dryRun=true` si no se especifica
6. Rate limit: no más de 1 sync real cada 15 minutos
7. Si la conexión DDP falla → no crashear la app, devolver error limpio

---

## Variables de entorno a añadir (Railway)

```
HARBIZ_EMAIL=<email del profesional en Harbiz>
HARBIZ_PASSWORD=<password de Harbiz>
```

Añadir también a `.env.example` (sin valores).

---

## Tests a añadir (src/__tests__/harbiz-sync.test.ts)

Cubrir con Vitest (pure functions, sin DDP real):
- `mapClientToGymBook()` — campos mapeados correctamente
- `mapSessionToGymBook()` — timezone normalizado a Europe/Madrid
- `mapPackToGymBook()` — balance y paymentStatus
- `dedupClient()` — prioridad: ExternalIdMapping → email → crear
- `dedupSession()` — skip si ya existe mapping
- Funciones de validación de schema

---

## Checklist final

- [ ] `npx prisma migrate dev` sin errores
- [ ] `npx vitest run` — todos los tests pasan (incluido 51 existentes)
- [ ] API route devuelve 401 si no es ADMIN
- [ ] Dry-run no modifica ningún dato en GymBook
- [ ] Logs no contienen PII (nombres, emails, teléfonos)
- [ ] `HarbizDdpClient.disconnect()` se llama siempre (finally block)
- [ ] Build Next.js sin errores TypeScript
- [ ] Commit con mensaje descriptivo, push a main

---

## Lo que NO debes hacer

- ❌ Modificar datos en Harbiz (es READ-ONLY)
- ❌ Guardar password Harbiz en DB o archivos
- ❌ Borrar o modificar clientes/reservas existentes en GymBook sin confirmación explícita
- ❌ Correr sync automático sin botón manual de confirmación
- ❌ Saltarte los tests existentes
