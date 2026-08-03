# BETA DEPLOYMENT

Guía para desplegar Rondo como beta cerrada:

```text
Frontend React/Vite → Vercel
Backend Fastify      → Render (plan Free)
PostgreSQL remoto    → Neon (o Render Postgres pago)
Autenticación        → Clerk (username + password)
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

No uses un plan gratuito que se borre solo — la beta necesita persistencia entre sesiones de los testers. Copiá el connection string con SSL (`?sslmode=require` en Neon) y guardalo para el paso 5 — no lo pegues en ningún archivo del repo.

### 2. Crear/configurar Clerk Beta

Creá una instancia de Clerk **separada** de la de desarrollo local (o un entorno "Beta" dentro del mismo proyecto Clerk, si tu plan lo permite). Configurá manualmente (ver checklist completa en [Clerk: configuración manual](#clerk-configuración-manual-obligatoria) más abajo):

- Username habilitado y requerido para sign-up, Password habilitado, Email/Phone no requeridos.
- Todos los proveedores OAuth deshabilitados.
- Client Trust / Attack Protection revisado para testers de confianza.

Además, en **Clerk Dashboard → Users**, abrí el usuario que va a administrar Señor Pato y copiá su **User ID** (`user_xxx...`) — va en `BOOTSTRAP_ADMIN_CLERK_USER_ID` (paso 5).

### 3. Crear cuentas de testers

Ver [Cuentas de testers](#cuentas-de-testers) más abajo. Hacelo manualmente desde el Clerk Dashboard (o el registro de la app si `VITE_BETA_SIGN_UP_ENABLED=true`) — nunca generes contraseñas en el seed ni las commitees.

### 4. Crear el backend en Render

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

### 5. Configurar variables de entorno en Render

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | el connection string del paso 1 |
| `CLERK_SECRET_KEY` | Secret Key de la instancia de beta de Clerk |
| `FRONTEND_URL` | `<VERCEL_BETA_URL>` (podés completarlo después del paso 12 y volver a desplegar) — sin barra final |
| `BOOTSTRAP_ADMIN_CLERK_USER_ID` | el User ID del paso 2 |
| `BOOTSTRAP_ADMIN_USERNAME` | opcional, no usar en beta (ver más abajo) |

**No configures `PORT` manualmente.** Render inyecta su propio `PORT` en runtime y el backend lo lee de `process.env.PORT` (`apps/backend/src/main.ts`) — fijar un valor propio en el dashboard lo pisaría y el health check fallaría.

`DATABASE_URL`, `CLERK_SECRET_KEY` y `FRONTEND_URL` son **obligatorias**: el backend falla al arrancar en `NODE_ENV=production` si falta alguna (validación en `apps/backend/src/config/env.ts`).

### 6. Desplegar el backend

Dispará el deploy desde Render (o hacé push a la rama conectada). El Build Command del paso 4 aplica las migraciones antes de que el nuevo build sirva tráfico.

### 7. Verificar `/health`

```bash
curl https://<RENDER_BACKEND_URL>/health
```

No depende de Clerk ni de la base — si falla, el problema es el arranque del proceso. Este es el único endpoint configurado como Health Check Path automático de Render (nunca `/health/database` — un health check automático no debe depender de la base, para no reiniciar el servicio en un blip transitorio de conexión).

### 8. Verificar `/health/database`

```bash
curl https://<RENDER_BACKEND_URL>/health/database
```

Confirma la conexión a Postgres sin exponer credenciales en la respuesta (el detalle del error queda solo en los logs del servicio). Es una verificación manual del paso 6, no el health check automático de Render.

### 9. Ejecutar el seed base

Una sola vez (es idempotente, podés repetirlo sin miedo), desde tu máquina con la `DATABASE_URL` de beta:

```bash
cd apps/backend
DATABASE_URL=<connection string de beta> pnpm seed:base
```

Esto crea los deportes, modalidades, Club Señor Pato, sus 4 canchas, horarios y la noticia de bienvenida. No borra nada existente. **No se ejecuta automáticamente en el build de Render** — es un paso manual, deliberadamente separado del deploy.

No corras `pnpm prisma:seed` (el seed completo con partidos/usuarios demo de `seed_juan_perez` y compañía) contra beta — esas identidades no son cuentas Clerk reales y nunca van a poder loguearse.

### 10. Crear el proyecto frontend en Vercel

**New Project** dentro del workspace existente de Vercel → importá el repo `federicofemenia/rondo`. No hace falta crear un Team nuevo ni un repositorio nuevo; el proyecto puede llamarse `rondo-beta`. Configuración (ver [Frontend en Vercel](#frontend-en-vercel) para el detalle):

```text
Root Directory:    (vacío / raíz del repositorio)
Framework Preset:  Other
Install Command:   pnpm install --frozen-lockfile (default; Vercel detecta el workspace de pnpm en la raíz)
Build Command:     pnpm build:frontend
Output Directory:  apps/frontend/dist
```

### 11. Configurar variables en Vercel

| Variable | Valor |
|---|---|
| `VITE_API_BASE_URL` | `https://<RENDER_BACKEND_URL>` (sin barra final, sin `/api/v1`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable Key de la instancia de beta de Clerk |
| `VITE_BETA_SIGN_UP_ENABLED` | `false` (o `true` solo si de verdad querés registro público en la beta) |

Ningún secreto de backend (`CLERK_SECRET_KEY`, `DATABASE_URL`, `BOOTSTRAP_ADMIN_CLERK_USER_ID`) va en Vercel.

### 12. Desplegar el frontend

Dispará el deploy desde Vercel (o push a la rama conectada).

### 13. Copiar la URL de Vercel a `FRONTEND_URL` de Render

Una vez que Vercel te da la URL definitiva (`<VERCEL_BETA_URL>`), volvé a Render → variables de entorno → completá `FRONTEND_URL` con esa URL (sin barra final).

### 14. Redeploy del backend

Como `FRONTEND_URL` cambió (afecta el allowlist de CORS), volvé a desplegar el backend en Render para que tome el nuevo valor.

### 15. Configurar las URLs de Clerk

Ver la [checklist de Clerk](#clerk-checklist-de-urls-para-el-dominio-de-vercel) más abajo, ahora que ya tenés `<VERCEL_BETA_URL>` definitivo.

### 16. Prueba con dos usuarios en celulares/navegadores distintos

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

en producción/beta — este es el comando que corre automáticamente dentro del Build Command de Render (ver paso 4). **Nunca** `prisma:migrate` (= `migrate dev`) contra una base remota — es interactivo, pensado para desarrollo local, y puede intentar generar una shadow database que no vas a tener permisos para crear. Nunca `prisma db push`. Nunca resetear la base. Las migraciones existentes no se modifican — todo cambio de schema es una migración nueva.

Si por algún motivo necesitás aplicar migraciones a mano (fuera de un deploy de Render, por ejemplo para diagnosticar un problema), corré desde tu máquina con acceso a la `DATABASE_URL` de beta:

```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

### Seed

Separado en dos scripts:

```bash
pnpm --filter @rondo/backend seed:base   # catálogo: deportes, club, canchas, horarios, noticia — idempotente, no borra nada
pnpm --filter @rondo/backend seed:beta   # opcional, manual: perfiles deportivos demo para testers YA logueados
```

`seed:beta` busca cada username de `BETA_TESTER_USERNAMES` (editable en `apps/backend/src/infrastructure/database/seedBeta.ts`) y solo actúa sobre los que ya tienen una cuenta interna sincronizada (es decir, que ya iniciaron sesión al menos una vez). Nunca crea identidades Clerk falsas. No se ejecuta automáticamente en ningún deploy — es manual, una vez, después de que los testers ya se hayan logueado, y solo si el dueño del proyecto decide correrlo.

El seed completo de desarrollo (`pnpm prisma:seed`, con los usuarios demo `seed_juan_perez` y el resto de partidos/invitaciones/chat de prueba) sigue existiendo tal cual para uso **exclusivamente local** — no tiene sentido correrlo contra beta porque esas identidades nunca van a poder autenticarse con una instancia real de Clerk.

---

## Clerk: configuración manual obligatoria

El dashboard de Clerk no se puede reemplazar con código — esto hay que hacerlo a mano, una vez, en la instancia de beta:

- [ ] **Username**: habilitado para sign-up y sign-in.
- [ ] **Password**: habilitado.
- [ ] **Email address**: no obligatorio (podés deshabilitarlo directamente).
- [ ] **Phone number**: no obligatorio (deshabilitado).
- [ ] **OAuth / Social Connections**: todos deshabilitados para la beta.
- [ ] **MFA obligatorio**: deshabilitado (per-user opcional está bien, pero no lo fuerces para todos).
- [ ] **Registro público**: restringido u oculto si vas a repartir cuentas manualmente (podés dejar sign-up habilitado en Clerk pero con `VITE_BETA_SIGN_UP_ENABLED=false` en el frontend para que nadie vea el botón — igual revisá **Restrictions** en Clerk si querés bloquearlo también del lado del proveedor).
- [ ] **Client Trust / Attack Protection**: revisado para que testers conocidos no tropiecen con verificaciones de dispositivo nuevo en cada login.

### Cuentas de testers

Creálas manualmente desde **Clerk Dashboard → Users → Create user**, con username y contraseña individuales. Ejemplo conceptual (nombres, no credenciales):

```text
fede
juan
martin
lucas
nico
agustin
```

Cada cuenta necesita su propia contraseña, distinta de las demás — nunca generadas en el seed ni commiteadas en el repo. Compartíselas a cada tester por un canal privado (no por el repo, no por un issue público).

No implementamos "Entrar como usuario" ni ningún mecanismo para cambiar de identidad por query param o por un `userId` mandado desde el frontend — cada tester entra con su propia cuenta, siempre.

Después del primer login, cada tester completa su perfil deportivo desde la app (pantalla ya existente). Si querés darle un perfil de arranque para no partir de cero, corré `seed:beta` (ver arriba) una vez que ya se hayan logueado.

### Clerk: checklist de URLs para el dominio de Vercel

En **Clerk Dashboard → Domains / Paths** (según versión) de la instancia de beta:

- [ ] **Allowed origins**: agregar `<VERCEL_BETA_URL>` (sin barra final) y mantener `http://localhost:5173` para seguir desarrollando local.
- [ ] **Redirect URLs**: agregar `<VERCEL_BETA_URL>/*`.
- [ ] **Sign-in URL**: `<VERCEL_BETA_URL>` (la app es de una sola página, no hay ruta dedicada).
- [ ] **Sign-up URL**: igual, solo si `VITE_BETA_SIGN_UP_ENABLED=true`.
- [ ] **After sign-in / After sign-up**: `<VERCEL_BETA_URL>`.
- [ ] Mantener también los valores de `localhost:5173` para que el desarrollo local no se rompa.

No pongas dominios inventados como si fueran definitivos — completá esta sección recién cuando tengas la URL real de Vercel.

---

## Backend en Render

Fastify ya escucha en el host y puerto correctos (`apps/backend/src/main.ts`, `apps/backend/src/config/env.ts`):

```ts
await app.listen({ port: env.PORT, host: env.HOST });
```

`HOST` por defecto es `0.0.0.0` y `PORT` lee `process.env.PORT` (Render lo inyecta automáticamente en runtime; el valor en `.env.example` es solo el default local, y `render.yaml` deliberadamente no fija `PORT`). No hay un puerto de producción fijo hardcodeado.

`GET /health` y `GET /health/database` ya existen. `/health` no llama a Clerk ni a la base — es el único configurado como Health Check Path automático de Render. `/health/database` corre `SELECT 1` y devuelve `status`/`database`/`timestamp` sin el detalle del error (que sí se loguea server-side); es para verificación manual, no para el health check automático.

### Build y migraciones

Ver el paso 4 de la guía y `render.yaml` para el Build Command exacto. Resumen: `corepack enable` → `pnpm install --frozen-lockfile` → `pnpm --filter @rondo/backend predeploy` (Prisma Client + `migrate deploy`) → `pnpm build:backend` (compila `@rondo/contracts` y `@rondo/backend`). Todo en un solo comando para no depender del Pre-Deploy Command de Render, que no está garantizado en el plan Free.

### Variables del backend

Ver `apps/backend/.env.example`. En producción (`NODE_ENV=production`) son obligatorias `DATABASE_URL`, `CLERK_SECRET_KEY` y `FRONTEND_URL` — el arranque falla con un mensaje claro si falta alguna (`apps/backend/src/config/env.ts`).

### CORS

`apps/backend/src/app/cors.ts` arma una lista explícita de orígenes permitidos: siempre `http://localhost:5173`, más `FRONTEND_URL` si está configurado (normalizado sin barra final, aunque lo hayas cargado con una — ver `trimTrailingSlashes` en ese archivo). Nunca `origin: true` ni `*`. Un origen fuera de la lista recibe error de CORS; una request sin header `Origin` (server-to-server, `curl`, el propio health check) siempre pasa, porque ahí no aplica la same-origin policy del navegador.

---

## Frontend en Vercel

### Variables

Ver `apps/frontend/.env.example`:

```env
VITE_API_BASE_URL=
VITE_CLERK_PUBLISHABLE_KEY=
VITE_BETA_SIGN_UP_ENABLED=false
```

Ningún secreto de backend se agrega acá. `VITE_API_BASE_URL` no lleva barra final ni `/api/v1` — la URL de la API se lee desde un único lugar (`apps/frontend/src/runtimeConfig.ts`), que además normaliza y descarta cualquier barra final por las dudas. Todo el resto del frontend (`apiClient.ts`, `useSports.ts`, el health check de `App.tsx`) importa `apiBaseUrl` desde ahí en vez de recalcularlo. No quedan URLs `localhost` hardcodeadas fuera de ese único fallback de desarrollo.

### SPA routing

La app actual navega con estado interno de React (`currentView` en `App.tsx`), no con rutas de URL reales — no existen todavía rutas como `/matches/:matchId` en la barra de direcciones. De todas formas, `/vercel.json` (en la raíz del repo) agrega un rewrite catch-all a `index.html` como protección: si en el futuro se agrega ruteo real, o si alguien navega directo a una URL no-raíz, Vercel sirve la SPA en vez de un 404. Los rewrites de Vercel no interfieren con archivos estáticos existentes (tienen prioridad sobre el rewrite).

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

### Usuario organizador

- [ ] Login con username.
- [ ] Crear partido.
- [ ] Configurar día y franja.
- [ ] Buscar candidato.
- [ ] Enviar invitación.
- [ ] Ver la invitación como pendiente.

### Usuario invitado (otro navegador o ventana de incógnito)

- [ ] Login con su propia cuenta.
- [ ] Ver la tarjeta de invitación (puede tardar hasta 20s por el polling, o aparecer antes si refresca).
- [ ] Aceptar.
- [ ] Abrir el partido.
- [ ] Aparecer como confirmado.
- [ ] Enviar un mensaje en el chat.

### Organizador nuevamente

- [ ] Ver al participante confirmado (polling de MatchDetail, hasta 20s).
- [ ] Ver el mensaje en el chat (polling propio del chat, hasta 10s).
- [ ] Responder.
- [ ] Cancelar el partido de prueba.

### Verificaciones adicionales

- [ ] Persistencia después de logout/login: los datos siguen ahí.
- [ ] Rutas directas después de refrescar: la app no debe mostrar un 404 de Vercel (ver SPA routing arriba).
- [ ] CORS: el navegador no debe mostrar errores de CORS en la consola contra `<RENDER_BACKEND_URL>`.
- [ ] Expiración del token: si el token de Clerk expira mientras la app está abierta, la siguiente llamada debe fallar con un error comprensible, no con una pantalla en blanco.
- [ ] Backend despertando: si Render tardó en responder, la app mostró "Estamos iniciando el servidor de Rondo" en vez de un error técnico inmediato, con opción de reintentar.
- [ ] No hay datos de la base local (`rondo_dev`) visibles en la beta — todo lo que se ve viene de la base remota de beta.

---

## Seguridad

- [ ] `.env` y `.env.*` (salvo `.env.example`) están en `.gitignore` — ya lo están, verificado.
- [ ] `.env.example` (backend y frontend) no tiene secretos reales.
- [ ] `CLERK_SECRET_KEY` solo existe en variables de entorno del backend (Render), nunca en el frontend.
- [ ] `DATABASE_URL` solo en el backend.
- [ ] `BOOTSTRAP_ADMIN_CLERK_USER_ID` solo en el backend, nunca expuesto al frontend.
- [ ] Ningún log del backend imprime tokens ni contraseñas (revisado: `health.controller.ts` ya no devuelve el detalle crudo del error de conexión).
- [ ] Las credenciales de los testers no se commitean — se comparten por canal privado.
- [ ] CORS restrictivo (ver arriba).
- [ ] Los endpoints protegidos siguen validando el token de Clerk en cada request (`requireAuth`, sin cambios de este slice).

---

## Limitaciones del plan gratuito

- **Render free**: el servicio se "duerme" tras un período sin tráfico y tarda unos segundos en responder al primer request — de ahí la pantalla "Estamos iniciando el servidor de Rondo" con reintentos limitados en el frontend. Para una beta con testers activos, considerá el plan pago si la demora molesta.
- **Neon free** (si lo usás en vez de un plan pago): tiene límites de cómputo/almacenamiento y puede pausar el proyecto por inactividad — igual que con Render, para una beta que necesita persistir datos entre sesiones, un plan pago (o al menos uno sin auto-pausa agresiva) es más seguro.
- **Vercel**: sin límites relevantes para una beta cerrada de este tamaño en el plan Hobby.

---

## Fuera de alcance de este slice

No se implementó (a propósito): reservas, panel de administración, push notifications, WebSockets, dominios custom, CI/CD, Docker, observabilidad paga, backups propios, recuperación de contraseña custom (la maneja Clerk), alta automática masiva de cuentas Clerk, cuenta compartida, impersonación de usuarios.
