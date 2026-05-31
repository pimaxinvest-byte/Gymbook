# Harbiz ↔ GymBook — Plan de Arquitectura Sync
**Fecha:** 2026-05-31 | **Basado en:** 01-harbiz-inspection-report.md

---

## 1. Decisión de método: DDP Client

**Método elegido: DDP Client via `simpleddp` (npm)**

Fundamento:
- Harbiz = Meteor.js 3.4, protocolo DDP sobre SockJS
- No existe REST API ni CSV export
- `simpleddp` es el cliente DDP más moderno para Node.js
- Permite login, llamadas a métodos y subscriptions desde TypeScript

```
npm install simpleddp ws @types/ws
```

---

## 2. Flujo de sincronización (READ-ONLY de Harbiz)

```
┌──────────────────────────────────────────────────┐
│                  syncService.ts                  │
│                                                  │
│  1. HarbizDdpClient.connect()                   │
│  2. HarbizDdpClient.login(email, password)       │
│  3. Fetch clients  → professional.clients.getPaginatedClients │
│  4. Fetch sessions → allLiveSessionsByDateMethod  │
│  5. Fetch packs    → sessionPacks.getSessionPacksByClientId   │
│  6. HarbizDdpClient.disconnect()                 │
│                                                  │
│  7. mapper.ts: HarbizClient  → GymBook Client    │
│  8. mapper.ts: HarbizSession → GymBook Booking   │
│  9. mapper.ts: HarbizPack    → GymBook Credits   │
│                                                  │
│  10. Dry-run diff: qué crear / actualizar        │
│  11. Confirmación usuario en UI                  │
│  12. Escribir a GymBook DB (Prisma)              │
│  13. Guardar logs en external_sync_logs          │
└──────────────────────────────────────────────────┘
```

**Dirección de sync: Harbiz → GymBook (import)**
- Harbiz es READ-ONLY durante toda la integración
- GymBook es la fuente de verdad después del import

---

## 3. Estructura de archivos

```
src/integrations/harbiz/
  types.ts                  ← Interfaces TypeScript de entidades Harbiz
  HarbizDdpClient.ts        ← Wrapper sobre simpleddp (connect/login/call/disconnect)
  mapper.ts                 ← HarbizClient → GymBook models
  syncService.ts            ← Orquestador principal (lógica dry-run + commit)
  syncLogs.ts               ← Helpers para external_sync_logs
  constants.ts              ← Nombres de métodos DDP, timeouts

src/app/api/harbiz/
  sync/route.ts             ← POST /api/harbiz/sync?dryRun=true|false
  status/route.ts           ← GET /api/harbiz/status (último sync)

src/app/admin/harbiz/
  page.tsx                  ← UI de configuración y botón "Sincronizar Harbiz"
```

---

## 4. Schema de nuevas tablas Prisma

```prisma
model TeacherHarbizConnection {
  id          String   @id @default(cuid())
  teacherId   String   @unique
  teacher     Teacher  @relation(fields: [teacherId], references: [id])
  harbizEmail String                    // [EMAIL] profesional en Harbiz
  harbizProfId String?                  // ID interno Harbiz del profesional
  lastSyncAt  DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  syncLogs    ExternalSyncLog[]
}

model ExternalIdMapping {
  id           String   @id @default(cuid())
  entityType   String                    // "CLIENT" | "BOOKING" | "CREDIT"
  gymBookId    String
  externalId   String                    // ID Meteor en Harbiz
  source       String   @default("HARBIZ")
  createdAt    DateTime @default(now())
  @@unique([entityType, externalId, source])
  @@unique([entityType, gymBookId, source])
}

model ExternalSyncLog {
  id              String   @id @default(cuid())
  connectionId    String
  connection      TeacherHarbizConnection @relation(fields: [connectionId], references: [id])
  syncType        String                  // "FULL" | "INCREMENTAL"
  status          String                  // "PENDING" | "DRY_RUN" | "COMPLETED" | "FAILED"
  dryRun          Boolean  @default(true)
  clientsFound    Int      @default(0)
  clientsCreated  Int      @default(0)
  clientsUpdated  Int      @default(0)
  sessionsFound   Int      @default(0)
  sessionsCreated Int      @default(0)
  packsFound      Int      @default(0)
  packsCreated    Int      @default(0)
  errors          Json?                   // array de errores
  diffJson        Json?                   // diff completo (dry-run)
  startedAt       DateTime @default(now())
  completedAt     DateTime?
}
```

---

## 5. Interfaces TypeScript (types.ts)

```typescript
// Harbiz entities (campos observados vía UI + DDP)
export interface HarbizClient {
  _id: string;
  userId?: string;
  profId: string;
  name: string;
  lastname?: string;
  email: string;
  phone?: string;
  birthdate?: Date;
  tags?: string[];
  status: 'active' | 'archived' | 'lead' | 'guest';
  type: 'presencial' | 'online';
  activationDate?: Date;
  plan?: string;
  planStatus?: string;
  lastPayment?: Date;
  weeklyCompliance?: number;
  monthlyCompliance?: number;
}

export interface HarbizSession {
  _id: string;
  clientId: string;
  profId: string;
  sessionTypeId: string;
  sessionTypeName: string;
  startDate: Date;
  endDate?: Date;
  status: 'scheduled' | 'completed' | 'cancelled';
  isPresencial: boolean;
  isOnline: boolean;
  attended?: boolean;
}

export interface HarbizSessionPack {
  _id: string;
  clientId: string;
  profId: string;
  sessionTypeId: string;
  sessionTypeName: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: 'active' | 'expired' | 'completed';
  startDate?: Date;
  endDate?: Date;
  price?: number;
  paymentStatus?: 'paid' | 'pending';
}

export interface HarbizSessionType {
  _id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface HarbizSyncResult {
  dryRun: boolean;
  clients: { found: number; toCreate: number; toUpdate: number; skipped: number };
  sessions: { found: number; toCreate: number; toUpdate: number };
  packs: { found: number; toCreate: number; toUpdate: number };
  errors: string[];
  diff: HarbizDiffItem[];
}

export interface HarbizDiffItem {
  entity: 'CLIENT' | 'SESSION' | 'PACK';
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  harbizId: string;
  gymBookId?: string;
  data: Record<string, unknown>;
  reason?: string;
}
```

---

## 6. HarbizDdpClient.ts (esquema)

```typescript
import SimpleDDP from 'simpleddp';
import { ws } from 'simpleddp/plugins/simpleddp-plugin-ejson';

export class HarbizDdpClient {
  private ddp: SimpleDDP;
  private connected = false;

  constructor(private readonly endpoint = 'wss://app.harbiz.io/sockjs/*/*/websocket') {}

  async connect(): Promise<void> {
    this.ddp = new SimpleDDP({
      endpoint: this.endpoint,
      SocketConstructor: ws,
      reconnectInterval: 5000,
    });
    await this.ddp.connect();
    this.connected = true;
  }

  async login(email: string, hashedPassword: string): Promise<string> {
    // Meteor login: SHA-256 hash del password
    const result = await this.ddp.call('login', {
      user: { email },
      password: { digest: hashedPassword, algorithm: 'sha-256' }
    });
    return result.token;
  }

  async getClients(opts: { limit: number; skip: number }): Promise<HarbizClient[]> {
    return this.ddp.call('professional.clients.getPaginatedClients',
      { limit: opts.limit, skip: opts.skip, sort: { activationDate: -1 } },
      { clientType: 'active', search: '', filters: {} },
      false
    );
  }

  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<HarbizSession[]> {
    return this.ddp.call('allLiveSessionsByDateMethod', {
      startDate, endDate, options: {}
    });
  }

  async getSessionPacksByClient(clientId: string): Promise<HarbizSessionPack[]> {
    return this.ddp.call('sessionPacks.getSessionPacksByClientId', clientId);
  }

  async getSessionTypes(): Promise<HarbizSessionType[]> {
    return this.ddp.call('getAllSessionTypes');
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.ddp.disconnect();
      this.connected = false;
    }
  }
}
```

---

## 7. mapper.ts (esquema)

```typescript
// HarbizClient → GymBook Client (para upsert)
export function mapClientToGymBook(hc: HarbizClient, teacherId: string) {
  return {
    name: `${hc.name} ${hc.lastname || ''}`.trim(),
    email: hc.email.toLowerCase(),
    phone: hc.phone || null,
    goals: null,
    status: hc.status === 'active' ? 'ACTIVE' : 'SUSPENDED',
    preferredTeacherId: teacherId,
    // Campos de seguimiento
    _harbizId: hc._id,
    _harbizType: hc.type,  // presencial / online
  };
}

// HarbizSession → GymBook Booking
export function mapSessionToGymBook(hs: HarbizSession, gymBookClientId: string, gymBookTeacherId: string, activityId: string) {
  return {
    clientId: gymBookClientId,
    teacherId: gymBookTeacherId,
    activityId,
    startDatetime: normalizeToMadrid(hs.startDate),
    endDatetime: normalizeToMadrid(hs.endDate || addHour(hs.startDate)),
    status: hs.status === 'completed' ? 'COMPLETED' : hs.status === 'cancelled' ? 'CANCELLED' : 'BOOKED',
    sessionType: hs.isOnline ? 'INDIVIDUAL' : 'INDIVIDUAL',
    capacity: 1,
    _harbizId: hs._id,
  };
}

// HarbizSessionPack → GymBook ClientCredits
export function mapPackToGymBook(hp: HarbizSessionPack, gymBookClientId: string, gymBookTeacherId: string) {
  return {
    clientId: gymBookClientId,
    teacherId: gymBookTeacherId,
    creditType: 'INDIVIDUAL',
    balance: hp.remainingSessions,
    totalAssigned: hp.totalSessions,
    paymentStatus: hp.paymentStatus === 'paid' ? 'PAID' : 'UNPAID',
    amountPaid: null,
    notes: `Importado de Harbiz: ${hp.sessionTypeName}`,
    _harbizId: hp._id,
  };
}
```

---

## 8. Lógica de dedup y resolución de conflictos

### Clientes
1. Buscar en `ExternalIdMapping` por `{entityType: "CLIENT", externalId: harbizId}`
2. Si no existe, buscar `User` por `email`
3. Si existe User → marcar como UPDATE (sincronizar datos)
4. Si no existe → marcar como CREATE (nuevo cliente)
5. Dry-run: mostrar diff sin escribir

### Sesiones
1. Buscar en `ExternalIdMapping` por `{entityType: "BOOKING", externalId: harbizSessionId}`
2. Si ya existe → SKIP (ya importada)
3. Si no → buscar conflicto con `checkBookingConflicts()` existente
4. Si no hay conflicto → CREATE

### Créditos (SessionPacks)
1. Buscar en `ExternalIdMapping` por `{entityType: "CREDIT", externalId: harbizPackId}`
2. Si existe → UPDATE balance si cambió
3. Si no existe → CREATE

---

## 9. UI: Pantalla de sync

**Ruta:** `/admin/harbiz` (admin sólo)

Flujo:
1. Admin ve configuración: email Harbiz, último sync, estado
2. Pulsa "Previsualizar sync" → POST /api/harbiz/sync?dryRun=true
3. App conecta a Harbiz DDP, corre sync completo en dry-run
4. Muestra diff: "26 clientes encontrados (3 nuevos, 2 actualizados, 21 ya existen)"
5. Admin pulsa "Confirmar sync" → POST /api/harbiz/sync?dryRun=false
6. Se escriben cambios en GymBook DB
7. Logs guardados en `ExternalSyncLog`

**UI components:**
- `SyncPreviewTable` — tabla diff con colores (verde=crear, amarillo=update, gris=skip)
- `SyncStatusBadge` — último sync, errores
- `SyncConfigForm` — email/password Harbiz (se guarda sólo en env vars, NUNCA en DB)

---

## 10. Seguridad

- **Credenciales Harbiz**: NUNCA en DB. En variables de entorno: `HARBIZ_EMAIL`, `HARBIZ_PASSWORD`
- **Password hashing**: SHA-256 del password para la llamada DDP login (Meteor standard)
- **Datos en logs**: Solo IDs y contadores, nunca nombres/emails en `diffJson`
- **Rate limiting**: Max 1 sync cada 15 minutos (Redis o simple timestamp en DB)
- **Timeout**: DDP connection timeout 30s, desconectar si no responde

---

## 11. Fases de implementación

| Fase | Tarea | Estimación |
|---|---|---|
| 1 | Prisma schema (3 tablas nuevas) + migración | 1h |
| 2 | `types.ts` + `HarbizDdpClient.ts` + test conexión | 2h |
| 3 | `mapper.ts` con las 3 entidades | 1h |
| 4 | `syncService.ts` dry-run completo | 2h |
| 5 | `POST /api/harbiz/sync` route | 1h |
| 6 | UI `/admin/harbiz` — config + preview + confirm | 2h |
| 7 | Tests Vitest para mapper y lógica de dedup | 1h |
| **Total** | | **~10h** |

---

## 12. Riesgos técnicos específicos

| Riesgo | Prob. | Impacto | Plan |
|---|---|---|---|
| SockJS path change (random tokens en URL) | MEDIO | ALTO | simpleddp maneja SockJS automáticamente |
| Meteor actualiza nombres de métodos DDP | BAJO | ALTO | Feature flag + test de conectividad antes de sync |
| `allLiveSessionsByDateMethod` devuelve sólo sesiones propias | MEDIO | MEDIO | Verificar con rango amplio de fechas |
| SessionPack schema diferente a lo asumido | MEDIO | ALTO | Inspeccionar respuesta real antes de mapear |
| 2FA activado en cuenta Harbiz | BAJO | CRÍTICO | Verificar con el usuario |
| Timeout en sync de 26 clientes | BAJO | BAJO | Paginar: 10 clientes a la vez |
