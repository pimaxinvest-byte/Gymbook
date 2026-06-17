---
title: GymBook NXT - Project Memory
---

# GymBook NXT - Project Memory

**Fecha de actualización:** 17 de junio de 2026  
**Estado actual:** Fase de definición de arquitectura y MVP

---

## 1. Visión General del Proyecto

**GymBook NXT** es la evolución de la plataforma GymBook. Se desarrolla en dos macro-fases:

### Macro Fase I: App Fitness Centrada en el Entrenador
App profesional orientada a entrenadores personales y coaches. Enfoque en:
- Entrenamiento con progresión inteligente
- Nutrición personalizada
- Seguimiento de progreso
- Relación cercana entrenador-cliente

### Macro Fase II: Plataforma Integral para Gimnasios
Expansión hacia gestión completa de gimnasios, incluyendo:
- Reservas y control de acceso
- Domótica e integración hardware
- Facturación y módulo fiscal por país
- Gestión operativa del gimnasio

---

## 2. Requisitos Clave

- **White-label / Multi-tenant**: Cada gimnasio o entrenador puede personalizar completamente la aplicación con su marca, logo y configuración.
- **Módulo Fiscal Futuro**: Preparado para facturación e impuestos por país (configurable).
- **Web-First + PWA**: Optimizada para Android e iOS mediante PWA. Excelente soporte en Safari, Chrome y Edge.
- **Escalabilidad**: Arquitectura modular que permite pasar de Fase I a Fase II sin reescribir el core.

---

## 3. Stack Tecnológico Propuesto

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind
- **UI**: shadcn/ui o similar + sistema de diseño propio
- **Backend**: Next.js API Routes + Prisma + PostgreSQL (Supabase o Railway)
- **Autenticación**: NextAuth.js / Auth.js
- **Estado y Datos**: TanStack Query + Zustand
- **Arquitectura**: Feature-Sliced Design (recomendada)
- **Notificaciones**: Telegram (heredado) + futuro email/push
- **PWA**: Next-PWA o similar para experiencia móvil nativa

---

## 4. Referencias Analizadas

| App          | Lo mejor para copiar                     | Qué evitar                     |
|--------------|------------------------------------------|--------------------------------|
| **wger**     | Estructura de datos (Exercise, Routine, Session, progresión) | UI antigua                     |
| **Virtuagym**| Modelo todo-en-uno + white-label         | Demasiado corporativo          |
| **RAULFITNESS** | Onboarding profundo + relación coach-cliente | Dependencia total 1:1         |

---

## 5. Decisiones de Arquitectura

- Usar **Feature-Sliced Design** para mantener escalabilidad entre Fase I y Fase II.
- Crear un sistema de **Tenant / Organization** desde el día 1.
- El módulo de **Facturación/Fiscal** será un feature opcional y configurable por país.
- Mantener el sistema de **reservas** existente como un módulo (`features/booking`).
- Priorizar **web + PWA** antes de desarrollar apps nativas.

---

## 6. Estado Actual (17/06/2026)

- Análisis de repositorios existentes completado (`Gymbook` + `Pfin`).
- Skill de análisis de apps fitness implementado y utilizado.
- Visión por fases definida (Fase I → Entrenador | Fase II → Gimnasio completo).
- Descripción del proyecto actualizada.
- Memoria del proyecto creada.

---

## 7. Próximos Pasos Recomendados

1. Definir **Núcleo + MVP de la Fase I** (App centrada en el entrenador).
2. Diseñar la **estructura de datos** inspirada en wger + necesidades del proyecto.
3. Crear el **Design System** base (tokens, componentes principales).
4. Decidir si empezamos implementando en el repo actual o creamos estructura nueva.

---

## 8. Enlaces Importantes

- Repo principal: https://github.com/pimaxinvest-byte/Gymbook
- Repo secundario (Pfin): https://github.com/pimaxinvest-byte/Pfin

---

**Nota**: Este archivo actúa como memoria viva del proyecto. Se actualizará conforme avancemos.