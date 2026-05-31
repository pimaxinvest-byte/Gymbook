# GymBook — Sistema de Reservas para Gimnasios

App full-stack mobile-first para gestionar reservas de espacios y sesiones en un gimnasio.

## Stack

- **Frontend/Backend**: Next.js 16 (App Router)
- **Base de datos**: PostgreSQL (Railway)
- **ORM**: Prisma 5
- **Auth**: NextAuth.js v5
- **UI**: Tailwind CSS + Radix UI
- **Calendario**: FullCalendar
- **Notificaciones**: Telegram Bot API

## Instalación local

### 1. Variables de entorno

```bash
cp .env.example .env.local
# Edita .env.local con tus valores
```

### 2. Instalar y configurar

```bash
npm install
npm run db:push     # Crear tablas
npm run db:seed     # Datos de ejemplo
npm run dev         # http://localhost:3000
```

## Cuentas de demo

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@gymbook.com | admin123 |
| Profesor | carlos@gymbook.com | teacher123 |
| Cliente | ana@example.com | client123 |

## Deploy en Railway

1. Crea un proyecto en Railway con plugin PostgreSQL
2. Añade las variables de entorno (ver `.env.example`)
3. Build: `npm run build` · Start: `npm run start`
4. Ejecuta migraciones: `railway run npm run db:migrate && railway run npm run db:seed`

## Estructura

```
src/app/
├── (auth)/login + register    # Autenticación
├── admin/dashboard            # Stats y gestión
├── admin/teachers             # Gestión de profesores  
├── admin/spaces               # Gestión de espacios
├── admin/activities           # Gestión de actividades
├── calendar/                  # Calendario principal
├── book/                      # Reservar sesión (cliente)
├── my-bookings/               # Mis reservas
├── settings/                  # Configuración + Telegram
└── api/                       # API routes completas
```
