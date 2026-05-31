# GymBook — Sistema de Reservas para Gimnasio

App full-stack mobile-first para gestionar reservas, profesores, clientes y notificaciones Telegram en un gimnasio.

**Producción:** https://gymbook-app-production.up.railway.app  
**Bot Telegram:** @Daddysgymbook_bot  
**Repositorio:** github.com/pimaxinvest-byte/Gymbook

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, TypeScript) |
| Base de datos | PostgreSQL en Railway |
| ORM | Prisma 5 |
| Auth | NextAuth.js v5 (JWT, Credentials) |
| UI | Tailwind CSS + Radix UI + Lucide |
| Calendario | FullCalendar 6 (timeGridWeek) |
| Notificaciones | Telegram Bot API (`@Daddysgymbook_bot`) |
| Tests | Vitest 4 |

---

## Instalación local

```bash
# 1. Variables de entorno
cp .env.example .env.local
# Edita .env.local con tus valores (ver sección Variables más abajo)

# 2. Instalar dependencias
npm install

# 3. Crear tablas en la base de datos
npm run db:push

# 4. Cargar datos reales (profesores, espacios, actividades)
npm run db:seed

# 5. Iniciar servidor de desarrollo
npm run dev  # http://localhost:3000

# 6. Tests
npm test
```

---

## Variables de entorno requeridas

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="una-cadena-larga-y-aleatoria"
NEXTAUTH_URL="https://tu-dominio.railway.app"
TELEGRAM_BOT_TOKEN="token-del-bot"        # Sin exponer en frontend
TELEGRAM_BOT_NAME="Daddysgymbook_bot"
NEXT_PUBLIC_TELEGRAM_BOT_NAME="Daddysgymbook_bot"
CRON_SECRET="secreto-para-endpoint-cron"  # Opcional, protege /api/cron/reminders
```

---

## Cuentas de acceso

| Rol | Email | Contraseña inicial | Descripción |
|---|---|---|---|
| Admin | admin@gymbook.com | admin123 | Acceso completo |
| Profesor | max.romeo@me.com | Max123 | Max Romeo — Entrenamiento Personal |
| Profesor | rohypus@gmail.com | Pietro123 | Pietro Anoe — Entrenamiento Personal |
| Profesor | lolamarca@hotmail.es | *(ver seed log)* | Lola Martin Carmona — Yoga |

> ⚠️ Cambiar contraseñas en el primer inicio de sesión desde **Ajustes → Perfil**.

---

## Roles y permisos

| Rol | Acceso |
|---|---|
| **ADMIN** | Panel completo: profesores, clientes, actividades, espacios, Telegram, stats |
| **TEACHER** | Planning semanal, disponibilidades recurrentes, clientes asignados, créditos |
| **CLIENT** | Reservar sesiones, ver historial, créditos, notificaciones Telegram |

---

## Flujo principal

```
Profesor abre disponibilidad (recurrente) 
  → Cliente reserva franja disponible (descuenta 1 crédito)
    → Telegram confirma a cliente y profesor
      → Recordatorio 24h + 1h antes (cron /api/cron/reminders)
        → Cliente hace check-in en sesión
```

---

## Onboarding de clientes

1. Cliente se registra en `/register` (nombre, email, teléfono, objetivo)
2. Estado inicial: **PENDING** — no puede reservar todavía
3. Admin recibe aviso por Telegram y en `/admin/clients`
4. Admin aprueba → cliente recibe mensaje de bienvenida → puede reservar
5. Admin rechaza → cliente recibe notificación con motivo

---

## Telegram Bot — Comandos

| Comando | Descripción |
|---|---|
| `/reservas` | Ver próximas sesiones |
| `/cancelar` | Cancelar una reserva (inline keyboard) |
| `/checkin` | Confirmar asistencia (disponible 2h antes) |
| `/creditos` | Ver saldo de créditos |
| `/espera` | Ver posición en lista de espera |
| `/ayuda` | Ayuda y lista de comandos |

**Conectar Telegram:** Ajustes → "Conectar Telegram" → `/start` en el bot

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login           # Login
│   ├── (auth)/register        # Registro extendido con onboarding
│   ├── admin/
│   │   ├── dashboard/         # Stats globales
│   │   ├── teachers/          # Profesores + actividades asignadas
│   │   ├── clients/           # Lista clientes, aprobar/rechazar
│   │   ├── activities/        # Gestión de actividades
│   │   └── spaces/            # Espacios (SALA / EXTERIOR)
│   ├── teacher/
│   │   ├── schedule/          # Planning semanal + nueva disponibilidad
│   │   ├── availability/      # Disponibilidades recurrentes
│   │   └── clients/           # Clientes asignados + reservar para ellos
│   ├── book/                  # Reservar sesión (cliente)
│   ├── calendar/              # Calendario compartido
│   ├── my-bookings/           # Historial de reservas
│   ├── credits/               # Gestión de créditos
│   ├── settings/              # Perfil + config Telegram
│   └── api/
│       ├── bookings/          # CRUD reservas + client-book + teacher-book
│       ├── bookings/recurrent/# Disponibilidades recurrentes
│       ├── admin/clients/     # Aprobar/rechazar clientes
│       ├── admin/telegram/    # Broadcast PDF / invite links
│       ├── cron/reminders/    # Recordatorios 24h y 1h (cron job)
│       ├── telegram/          # Webhook + deep-link connect
│       └── settings/          # Config general + Telegram
├── lib/
│   ├── telegram.ts            # Notificaciones: created/cancelled/modified
│   ├── booking-conflicts.ts   # Validación solapamientos espacio+profesor
│   └── auth.ts                # NextAuth config
└── __tests__/
    └── business-rules.test.ts # 31 tests (vitest)
```

---

## Reglas de negocio clave

- Un mismo espacio no puede tener dos reservas solapadas
- Un profesor no puede estar en dos sesiones a la vez
- **Entrenamiento Personal**: máximo 1 cliente por sesión
- **Yoga (SGT)**: máximo 5 clientes por sesión (lista de espera si lleno)
- Un cliente puede tener máximo 2 profesores asignados
- Los créditos caducan a los 6 meses de ser asignados
- Cancelación con devolución de crédito si se cancela con `X` horas de antelación (configurable, default 24h)
- Cliente nuevo = estado PENDING hasta aprobación admin

---

## Deploy en Railway

1. Crear proyecto Railway con plugin **PostgreSQL**
2. Conectar repositorio GitHub → auto-deploy en cada push a `main`
3. Añadir variables de entorno (ver sección Variables)
4. Ejecutar seed: `railway run npm run db:seed`
5. Configurar cron job para recordatorios:
   ```
   Cada 30 min → GET https://tu-app.railway.app/api/cron/reminders
   Header: x-cron-secret: $CRON_SECRET
   ```

---

## Tests

```bash
npm test           # Vitest — 31 tests
npm run test:watch # Modo watch
```

Cobertura: conflictos espacio/profesor, capacidad Yoga/EP, créditos, onboarding, Telegram guard, política cancelación.

---

*GymBook v1.2.0 — Desarrollado por Pietro Anoe · @rohypus*
