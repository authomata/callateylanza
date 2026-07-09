# Cállate y Lanza — plataforma de kits de marca personal

Sistema de producción y entrega de los 10 entregables del programa. Una operadora toma la
transcripción de la entrevista + las conclusiones de Andrés y produce, edita, aprueba y entrega
los entregables para múltiples clientes en paralelo.

**Estado:** Fase 1 (MVP) — auth + roles, CRUD de clientes/proyectos, insumos, plantillas de
módulos en BD, generación **D0** y **D1** con **gate de aprobación en D1**, editor con historial de
versiones, **validador de voseo**, y export a PDF (vía impresión del navegador). Ver
`../.claude/plans/agile-cuddling-pearl.md` para el alcance y las fases siguientes.

## Stack
Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + Storage) ·
Anthropic (`claude-opus-4-8`, configurable por env).

## Puesta en marcha

1. **Variables de entorno** — copia `.env.example` a `.env.local` y complétalo:
   ```
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   ANTHROPIC_API_KEY, ANTHROPIC_MODEL=claude-opus-4-8
   ```

2. **Base de datos** — aplica el esquema y el seed a tu proyecto Supabase. Con la connection
   string de Postgres exportada como `DATABASE_URL`:
   ```bash
   export DATABASE_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"
   npm run db:push        # corre migrations/*.sql + seed.sql
   ```
   (Alternativa: pega el contenido de `supabase/migrations/*.sql` y `supabase/seed.sql` en el
   SQL Editor de Supabase, en orden.)

3. **Usuarios semilla + proyecto demo**:
   ```bash
   npm run seed           # crea Andrés (admin), Michelle (operador) y un proyecto demo
   ```
   Passwords por defecto `CambiaEsto123!` — cámbialas. El rol admin se asigna por allowlist de
   email en `supabase/migrations/0002_auth_hook.sql`.

4. **Correr**:
   ```bash
   npm run dev            # http://localhost:3000
   ```

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Aplica migraciones + seed a `$DATABASE_URL` |
| `npm run seed` | Crea usuarios y proyecto demo (usa `.env.local`) |

## Principios de diseño (aplicados en código)
1. **Prompts como datos** — cada módulo vive en `module_templates`; se edita desde `/templates`
   (admin) sin deploy, con versionado.
2. **Gate humano en D1** — nada de D2–D8 se genera hasta aprobar el Manual Maestro
   (`gate_bloqueado` + trigger `enforce_approval_gate` en la BD).
3. **Voz como entidad de primera clase** — `voice_docs` se inyecta en toda generación.
4. **Reflexión anclada** (Gancho → Ancla → Bajada) y **español de Chile / tuteo** —
   validador de voseo en `lib/validators/voseo.ts`, bloquea la aprobación.

## Estructura
```
app/(app)/dashboard        tabla de proyectos, semáforo, countdown día-7
app/(app)/projects/[id]    pantalla principal: checklist · editor · insumos/voz
app/(app)/templates        admin: plantillas de prompts (prompts-as-data)
app/api/generate           generación con streaming (Anthropic)
app/api/deliverables/[id]/approve   gate de aprobación (admin)
app/print/[id]             PDF de marca (portada + confidencial + pie)
lib/                       supabase, anthropic, prompts, validators, roles
supabase/                  migraciones + seed
```
