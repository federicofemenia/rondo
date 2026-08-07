# BETA DEPLOYMENT

Guía para desplegar Rondo como beta cerrada:

```text
Frontend React/Vite → Vercel
Backend Fastify      → Render (plan Free)
PostgreSQL remoto    → Neon (o Render Postgres pago)
Autenticación        → Nativa (username + password + sesión por cookie) -- ver docs/AUTHENTICATION.md
```

Reemplazá los placeholders `<VERCEL_BETA_URL>` y `<RENDER_BACKEND_URL>` por las URLs reales una vez creados los servicios. No son URLs reales todavía.

---

## Requisitos

```text
Node    22.x (fijado en package.json → engines.node)
pnpm    9.15.0 (fijado en package.json → packageManager; Render/Vercel lo activan vía `corepack enable`)
```

`engines.node` es informativo para Render/Vercel — no rompe el desarrollo local si tenés otra versión de Node instalada, pero usá 22.x para minimizar diferencias con producción.

---

## Entornos

Rondo mantiene tres entornos separados:

```text
local        → rondo_dev, en tu Postgres local
beta         → base remota dedicada (Neon o Render Postgres)
production   → futura, base remota separada de beta
```

**La base local (`rondo_dev`) nunca se usa para la beta.** No apuntes `DATABASE_URL` de beta a tu Postgres local, ni viceversa.

---

## Guía paso a paso

### 1. Crear el PostgreSQL remoto

Elegí uno:

- **Neon** (recomendado): creá un proyecto en [neon.tech](https://neon.tech), rama `main`, base `rondo_beta`.
- **Render Postgres pago**: creá una instancia paga (no la gratuita, que se elimina tras un período de inactividad).

No uses un plan gratuito que se borre solo — la beta necesita persistencia entre sesiones de los testers. Copiá el connection string con SSL (`?sslmode=require` en Neon) y guardalo para el paso 4 — no lo pegues en ningún archivo del repo.

### 2. (Opcional) Crear el bucket de Cloudflare R2 para avatares

Ver [Avatar (Cloudflare R2)](./AUTHENTICATION.md#avatar-cloudflare-r2) en `docs/AUTHENTICATION.md`. Si se omite este paso, la carga de avatar queda deshabilitada con un mensaje claro — el resto de la app funciona igual.

### 3. Crear el backend en Render

**New → Blueprint** (o **New → Web Service** si preferís configurarlo a mano) → conectá el repo de GitHub `federicofemenia/rondo`. Con `render.yaml` en la raíz del repo (recomendado), Render detecta el Blueprint automáticamente:

```text
Root Directory:    (vacío / raíz del repo)
Runtime:           Node
Plan:              Free
Build Command:     corepack enable && pnpm install --frozen-lockfile && pnpm --filter @rondo/backend predeploy && pnpm build:backend
Start Command:     pnpm --filter @rondo/backend start
Health Check Path: /health
```

Esos son los valores exactos de `render.yaml` — si configurás el servicio a mano en vez de usar el Blueprint, copialos literal.

**Por qué las migraciones corren dentro del Build Command:** el plan Free de Render no garantiza tener disponible el "Pre-Deploy Command" (es una función de nivel dashboard/plan que varía entre versiones del Blueprint), así que en vez de depender de eso, `pnpm --filter @rondo/backend predeploy` — que corre `prisma generate` y después `prisma migrate deploy`, nunca `migrate dev`, nunca un reset — se ejecuta directamente como parte del build, antes de compilar. Render expone las variables de entorno del servicio también durante el build, así que `DATABASE_URL` está disponible en ese momento. **Si una migración falla, el build falla** y el deploy anterior sigue sirviendo tráfico — no hay corte de servicio por una migración rota.

`pnpm build:backend` (`pnpm --filter @rondo/backend... build` desde la raíz) compila `@rondo/contracts` y después `@rondo/backend` — el `...` incluye las dependencias del workspace del backend.

El Start Command ejecuta el backend ya compilado (`node dist/main.js` vía el script `start`) — nunca `tsx watch`, `nodemon` ni ningún comando de desarrollo.

### 4. Configurar variables de entorno en Render

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | el connection string del paso 1 |
| `FRONTEND_URL` | `<VERCEL_BETA_URL>` (podés completarlo después del paso 10 y volver a desplegar) — sin barra final |
| `SESSION_COOKIE_NAME` / `SESSION_TTL_DAYS` | opcional — defaults seguros (`rondo_session` / `30`) ya están en el código |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | del paso 2, si configuraste avatar |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | ver [`docs/WEB_PUSH.md`](./WEB_PUSH.md) — también obligatorias en producción |

**No configures `PORT` manualmente.** Render inyecta su propio `PORT` en runtime y el backend lo lee de `process.env.PORT` (`apps/backend/src/main.ts`) — fijar un valor propio en el dashboard lo pisaría y el health check fallaría.

`DATABASE_URL` y `FRONTEND_URL` son **obligatorias**: el backend falla al arrancar en `NODE_ENV=production` si falta alguna (validación en `apps/backend/src/config/env.ts`).

### 5. Desplegar el backend

Dispará el deploy desde Render (o hacé push a la rama conectada). El Build Command del paso 3 aplica las migraciones antes de que el nuevo build sirva tráfico.

### 6. Verificar `/health`

```bash
curl https://<RENDER_BACKEND_URL>/health
```

No depende de la base de datos — si falla, el problema es el arranque del proceso. Este es el único endpoint configurado como Health Check Path automático de Render (nunca `/health/database` — un health check automático no debe depender de la base, para no reiniciar el servicio en un blip transitorio de conexión).

### 7. Verificar `/health/database`

```bash
curl https://<RENDER_BACKEND_URL>/health/database
```

Confirma la conexión a Postgres sin exponer credenciales en la respuesta (el detalle del error queda solo en los logs del servicio). Es una verificación manual del paso 5, no el health check automático de Render.

### 8. Ejecutar el seed base

Una sola vez (es idempotente, podés repetirlo sin miedo), desde tu máquina con la `DATABASE_URL` de beta:

```bash
cd apps/backend
DATABASE_URL=<connection string de beta> pnpm seed:base
```

Esto crea los deportes, modalidades, Club Señor Pato, sus 4 canchas, horarios y la noticia de bienvenida. No borra nada existente. **No se ejecuta automáticamente en el build de Render** — es un paso manual, deliberadamente separado del deploy.

No corras `pnpm prisma:seed` (el seed completo con partidos/usuarios demo de desarrollo local) contra beta — esas cuentas son fixtures de prueba, no testers reales.

### 9. Crear el proyecto frontend en Vercel

**New Project** dentro del workspace existente de Vercel → importá el repo `federicofemenia/rondo`. No hace falta crear un Team nuevo ni un repositorio nuevo; el proyecto puede llamarse `rondo-beta`. Configuración (ver [Frontend en Vercel](#frontend-en-vercel) para el detalle):

```text
Root Directory:    (vacío / raíz del repositorio)
Framework Preset:  Other
Install Command:   pnpm install --frozen-lockfile (default; Vercel detecta el workspace de pnpm en la raíz)
Build Command:     pnpm build:frontend
Output Directory:  apps/frontend/dist
```

### 10. Configurar `vercel.json` con la URL real del backend, y variables en Vercel

`vercel.json` (raíz del repo) hace de proxy same-origin — ver [Proxy same-origin](./AUTHENTICATION.md#proxy-same-origin). Editá el `destination` de sus rewrites `/api/:path*` y `/health` para que apunten a `<RENDER_BACKEND_URL>` real (por defecto tiene un placeholder, `https://rondo-backend.onrender.com` — confirmá que coincide con la URL real de tu servicio de Render antes de depender de esto).

| Variable (Vercel) | Valor |
|---|---|
| `VITE_API_BASE_URL` | dejar vacío (paths relativos, resueltos por el rewrite de `vercel.json`) |
| `VITE_BETA_SIGN_UP_ENABLED` | `false` (o `true` solo si de verdad querés registro público en la beta) |
| `VITE_VAPID_PUBLIC_KEY` | la misma clave pública VAPID configurada en Render (ver [`docs/WEB_PUSH.md`](./WEB_PUSH.md)) |

Ningún secreto de backend (`DATABASE_URL`, claves de R2, etc.) va en Vercel.

**Antes de confiar en el proxy para nada más**: hacer el smoke test descripto en [Proxy same-origin](./AUTHENTICATION.md#proxy-same-origin) (confirmar que `Set-Cookie` sobrevive el rewrite en un browser real).

### 11. Desplegar el frontend

Dispará el deploy desde Vercel (o push a la rama conectada).

### 12. Copiar la URL de Vercel a `FRONTEND_URL` de Render

Una vez que Vercel te da la URL definitiva (`<VERCEL_BETA_URL>`), volvé a Render → variables de entorno → completá `FRONTEND_URL` con esa URL (sin barra final).

### 13. Redeploy del backend

Como `FRONTEND_URL` cambió (afecta el allowlist de CORS y del guard CSRF), volvé a desplegar el backend en Render para que tome el nuevo valor.

### 14. Reset de la beta anterior, crear cuentas reales

Ver [Reset controlado de datos de la beta anterior](./AUTHENTICATION.md#reset-controlado-de-datos-de-la-beta-anterior) y [Crear un SUPERADMIN](./AUTHENTICATION.md#crear-un-superadmin) en `docs/AUTHENTICATION.md`. **Cada paso destructivo o de creación de cuenta real en producción requiere aprobación explícita, uno por uno** — nunca automatizar esta secuencia.

### 15. Prueba con dos usuarios en celulares/navegadores distintos

Ver [Checklist E2E](#checklist-e2e) completa más abajo.

### Rollback básico

- **Backend**: en Render, pestaña **Events** o **Deploys** del servicio → **Rollback** al deploy anterior. Las migraciones de Prisma son aditivas en este proyecto (nunca se edita una migración vieja), así que un rollback de código no debería dejar el schema desalineado; si una migración nueva rompió algo, corregí hacia adelante con una migración nueva en vez de revertir la aplicada.
- **Frontend**: en Vercel, pestaña **Deployments** → elegí un deploy anterior → **Promote to Production**.

### Consultar logs

- **Render**: pestaña **Logs** del servicio (tiempo real y búsqueda), incluyendo el log del Build Command (ahí se ve si `prisma migrate deploy` falló). Los errores de `/health/database` loguean el detalle ahí, nunca en la respuesta HTTP.
- **Vercel**: pestaña **Logs** del proyecto para errores de build; para errores de runtime del cliente, la consola del navegador (no hay funciones serverless propias en este proyecto).

### Cómo volver a desplegar

- **Backend**: push a la rama conectada en Render, o **Manual Deploy** desde el dashboard. El Build Command vuelve a correr `predeploy` (`migrate deploy`) automáticamente antes de cada build.
- **Frontend**: push a la rama conectada en Vercel, o **Redeploy** desde el dashboard.

---

## Base de datos remota

El backend usa `DATABASE_URL` sin asumir el proveedor — cualquier Postgres compatible con Prisma funciona (Neon, Render Postgres, Supabase, RDS, etc.). No hay nada en el código que codifique un dominio o proveedor específico.

### Migraciones

```bash
pnpm --filter @rondo/backend prisma:migrate:deploy
# equivalente: pnpm deploy:migrate (alias en el package.json raíz)
```

en producción/beta — este es el comando que corre automáticamente dentro del Build Command de Render (ver paso 3). **Nunca** `prisma:migrate` (= `migrate dev`) contra una base remota — es interactivo, pensado para desarrollo local, y puede intentar generar una shadow database que no vas a tener permisos para crear. Nunca `prisma db push`. Nunca resetear la base. Las migraciones existentes no se modifican — todo cambio de schema es una migración nueva.

Si por algún motivo necesitás aplicar migraciones a mano (fuera de un deploy de Render, por ejemplo para diagnosticar un problema), corré desde tu máquina con acceso a la `DATABASE_URL` de beta:

```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

### Seed

```bash
pnpm --filter @rondo/backend seed:base   # catálogo: deportes, club, canchas, horarios, noticia — idempotente, no borra nada
pnpm --filter @rondo/backend seed:beta   # opcional, manual: perfiles deportivos demo para testers YA registrados
```

`seed:beta` busca cada username de `BETA_TESTER_USERNAMES` (editable en `apps/backend/src/infrastructure/database/seedBeta.ts`) y solo actúa sobre los que ya se registraron (`POST /api/v1/auth/register`). No se ejecuta automáticamente en ningún deploy — es manual, una vez, después de que los testers ya se hayan registrado, y solo si el dueño del proyecto decide correrlo.

El seed completo de desarrollo (`pnpm prisma:seed`, con usuarios demo y partidos/invitaciones/chat de prueba) sigue existiendo tal cual para uso **exclusivamente local** — nunca correrlo contra beta.

### Cuentas de testers

Los testers se registran ellos mismos (`POST /api/v1/auth/register`, o el formulario de registro si `VITE_BETA_SIGN_UP_ENABLED=true`). No implementamos "Entrar como usuario" ni ningún mecanismo para cambiar de identidad por query param o por un `userId` mandado desde el frontend — cada tester entra con su propia cuenta, siempre. Ver [docs/AUTHENTICATION.md](./AUTHENTICATION.md) para el detalle completo del flujo.

---

## Backend en Render

Fastify ya escucha en el host y puerto correctos (`apps/backend/src/main.ts`, `apps/backend/src/config/env.ts`):

```ts
await app.listen({ port: env.PORT, host: env.HOST });
```

`HOST` por defecto es `0.0.0.0` y `PORT` lee `process.env.PORT` (Render lo inyecta automáticamente en runtime; el valor en `.env.example` es solo el default local, y `render.yaml` deliberadamente no fija `PORT`). No hay un puerto de producción fijo hardcodeado.

`GET /health` y `GET /health/database` ya existen. `/health` no depende de la base — es el único configurado como Health Check Path automático de Render. `/health/database` corre `SELECT 1` y devuelve `status`/`database`/`timestamp` sin el detalle del error (que sí se loguea server-side); es para verificación manual, no para el health check automático.

### Build y migraciones

Ver el paso 3 de la guía y `render.yaml` para el Build Command exacto. Resumen: `corepack enable` → `pnpm install --frozen-lockfile` → `pnpm --filter @rondo/backend predeploy` (Prisma Client + `migrate deploy`) → `pnpm build:backend` (compila `@rondo/contracts` y `@rondo/backend`). Todo en un solo comando para no depender del Pre-Deploy Command de Render, que no está garantizado en el plan Free.

### Variables del backend

Ver `apps/backend/.env.example`. En producción (`NODE_ENV=production`) son obligatorias `DATABASE_URL` y `FRONTEND_URL` — el arranque falla con un mensaje claro si falta alguna (`apps/backend/src/config/env.ts`).

### CORS y CSRF

Ver [CORS y CSRF](./AUTHENTICATION.md#cors-y-csrf) en `docs/AUTHENTICATION.md`. `apps/backend/src/app/cors.ts` arma una lista explícita de orígenes permitidos: siempre `http://localhost:5173`, más `FRONTEND_URL` si está configurado. Nunca `origin: true` ni `*`.

---

## Frontend en Vercel

### Variables

Ver `apps/frontend/.env.example`:

```env
VITE_API_BASE_URL=
VITE_BETA_SIGN_UP_ENABLED=false
VITE_VAPID_PUBLIC_KEY=
```

`VITE_API_BASE_URL` se deja vacío por defecto — la API se llama por paths relativos, resueltos same-origin por el rewrite de `vercel.json` (ver [Proxy same-origin](./AUTHENTICATION.md#proxy-same-origin)). La URL de la API se lee desde un único lugar (`apps/frontend/src/runtimeConfig.ts`). No quedan URLs `localhost` hardcodeadas.

### SPA routing

La app actual navega con estado interno de React (`currentView` en `App.tsx`), no con rutas de URL reales — no existen todavía rutas como `/matches/:matchId` en la barra de direcciones. De todas formas, `/vercel.json` (en la raíz del repo) agrega un rewrite catch-all a `index.html` como protección: si en el futuro se agrega ruteo real, o si alguien navega directo a una URL no-raíz, Vercel sirve la SPA en vez de un 404. Este rewrite catch-all va **después** de los rewrites de `/api/*` y `/health` (el orden importa: Vercel aplica el primer rewrite que matchea).

### Monorepo (configuración exacta a copiar en Vercel)

```text
Root Directory:    (vacío / raíz del repositorio)
Framework Preset:  Other
Install Command:   pnpm install --frozen-lockfile (default; Vercel detecta el workspace de pnpm en la raíz)
Build Command:     pnpm build:frontend
Output Directory:  apps/frontend/dist
```

**Por qué Root Directory es la raíz del repo (y no `apps/frontend`):** `@rondo/frontend` depende de dos paquetes internos del workspace, `@rondo/contracts` y `@rondo/config` (ambos con `main`/`types` apuntando a `dist/`, sin código fuente publicado). Si el Root Directory fuera `apps/frontend`, Vercel no vería el resto del monorepo y esas dependencias workspace:* no se podrían instalar ni compilar. Con Root Directory en la raíz, `pnpm install` resuelve el workspace completo y `pnpm build:frontend` (alias de `pnpm --filter @rondo/frontend... build`) compila primero `@rondo/contracts` y `@rondo/config`, y recién después `@rondo/frontend` — el `...` incluye exactamente esas dependencias internas. `Framework Preset: Other` evita que Vercel intente autodetectar comandos de Vite a partir del `package.json` de la raíz (que no tiene Vite como dependencia directa).

`apps/frontend/package.json`'s `build` script ya corre `tsc --noEmit && vite build` — falla el deploy si hay errores de tipos.

`vercel.json` vive en la raíz del repo (`/vercel.json`), no dentro de `apps/frontend`, precisamente porque el Root Directory configurado en Vercel es la raíz — ahí es donde Vercel lo busca. No debe haber una segunda copia en `apps/frontend/vercel.json`.

---

## Checklist E2E

### Usuario A: registro y primer partido

- [ ] Registro con username + contraseña.
- [ ] Entra directo a Home, sin datos de una sesión anterior.
- [ ] Crear partido.
- [ ] Configurar día y franja.
- [ ] Buscar candidato.
- [ ] Enviar invitación.
- [ ] Ver la invitación como pendiente.
- [ ] Activar push notifications.
- [ ] Cerrar sesión.

### Usuario B en el mismo dispositivo (otro navegador o ventana de incógnito, o el mismo tras el logout de A)

- [ ] Registro con su propia cuenta.
- [ ] No ve ningún dato de A (matches, invitaciones, club).
- [ ] Activar/reconciliar push — la suscripción queda asociada a B, no a A.
- [ ] Ver la tarjeta de invitación si A lo invitó antes de cerrar sesión (puede tardar hasta 20s por el polling).
- [ ] Aceptar.
- [ ] Abrir el partido.
- [ ] Aparecer como confirmado.
- [ ] Enviar un mensaje en el chat.

### Aislamiento de push

- [ ] Un push disparado para A no le llega al dispositivo (A ya cerró sesión ahí).
- [ ] Un push disparado para B sí le llega.

### Organizador (usuario A) nuevamente

- [ ] Ver al participante confirmado (polling de MatchDetail, hasta 20s).
- [ ] Ver el mensaje en el chat (polling propio del chat, hasta 10s).
- [ ] Responder.
- [ ] Cancelar el partido de prueba.

### Verificaciones adicionales

- [ ] Persistencia después de logout/login: los datos siguen ahí (cookie de sesión persiste).
- [ ] Rutas directas después de refrescar: la app no debe mostrar un 404 de Vercel (ver SPA routing arriba); la sesión tampoco se pierde al refrescar.
- [ ] CORS: el navegador no debe mostrar errores de CORS en la consola.
- [ ] Expiración de sesión: si la cookie expira (o se revoca) mientras la app está abierta, la siguiente llamada debe fallar con un error comprensible, no con una pantalla en blanco.
- [ ] Backend despertando: si Render tardó en responder, la app mostró "Estamos iniciando el servidor de Rondo" en vez de un error técnico inmediato, con opción de reintentar.
- [ ] No hay datos de la base local (`rondo_dev`) visibles en la beta — todo lo que se ve viene de la base remota de beta.
- [ ] SUPERADMIN entra al panel de administración; un usuario común no lo ve.
- [ ] La PWA sigue instalable y funcional (ver `docs/PWA.md`).

No afirmes que se probó en dispositivos reales si no se hizo.

---

## Seguridad

- [ ] `.env` y `.env.*` (salvo `.env.example`) están en `.gitignore` — ya lo están, verificado.
- [ ] `.env.example` (backend y frontend) no tiene secretos reales.
- [ ] `DATABASE_URL` solo en el backend.
- [ ] Credenciales de R2 solo en el backend, nunca expuestas al frontend (el frontend solo recibe una URL presignada de corta duración).
- [ ] Ningún log del backend imprime tokens, hashes de sesión ni contraseñas.
- [ ] Las contraseñas de los testers nunca se generan ni se commitean en el repo — cada tester elige la suya al registrarse.
- [ ] CORS restrictivo (ver arriba), más el guard CSRF de Origin (ver `docs/AUTHENTICATION.md`).
- [ ] La cookie de sesión es httpOnly + secure (en prod) + sameSite=lax — nunca accesible desde JS, nunca en `localStorage`.
- [ ] Los endpoints protegidos siguen validando la sesión en cada request (`requireAuth`).

---

## Limitaciones del plan gratuito

- **Render free**: el servicio se "duerme" tras un período sin tráfico y tarda unos segundos en responder al primer request — de ahí la pantalla "Estamos iniciando el servidor de Rondo" con reintentos limitados en el frontend. Para una beta con testers activos, considerá el plan pago si la demora molesta.
- **Neon free** (si lo usás en vez de un plan pago): tiene límites de cómputo/almacenamiento y puede pausar el proyecto por inactividad — igual que con Render, para una beta que necesita persistir datos entre sesiones, un plan pago (o al menos uno sin auto-pausa agresiva) es más seguro.
- **Vercel**: sin límites relevantes para una beta cerrada de este tamaño en el plan Hobby.

---

## Fuera de alcance de este slice

No se implementó (a propósito): email, verificación de email, login social/OAuth, MFA, SMS, recuperación de contraseña automática por email, CAPTCHA, passkeys, SSO, WebSockets, dominios custom, CI/CD, Docker, observabilidad paga, backups propios, cuenta compartida, impersonación de usuarios, eliminación de cuenta self-service.
