# BETA DEPLOYMENT

Guía para desplegar Rondo como beta cerrada:

```text
Frontend React/Vite → Vercel
Backend Fastify      → Render
PostgreSQL remoto    → Neon (o Render Postgres pago)
Autenticación        → Clerk (username + password)
```

Reemplazá los placeholders `<VERCEL_BETA_URL>` y `<RENDER_BACKEND_URL>` por las URLs reales una vez creados los servicios. No son URLs reales todavía.

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

No uses un plan gratuito que se borre solo — la beta necesita persistencia entre sesiones de los testers.

### 2. Obtener `DATABASE_URL`

Copiá el connection string con SSL (`?sslmode=require` en Neon). Guardalo para el paso 9 — no lo pegues en ningún archivo del repo.

### 3. Crear/configurar la instancia Clerk de beta

Creá una instancia de Clerk **separada** de la de desarrollo local (o un entorno "Beta" dentro del mismo proyecto Clerk, si tu plan lo permite). Ver la checklist completa en [Clerk: configuración manual](#clerk-configuración-manual-obligatoria) más abajo.

### 4. Habilitar username/password

En **Clerk Dashboard → User & Authentication → Email, Phone, Username**:

- **Username**: habilitado, requerido para sign-up.
- **Password**: habilitado.
- **Email address**: no requerido (podés dejarlo deshabilitado directamente para la beta).
- **Phone number**: deshabilitado.

En **User & Authentication → Social Connections**: deshabilitá todos los proveedores OAuth para la beta.

### 5. Revisar Client Trust

En **Clerk Dashboard → User & Authentication → Attack Protection** (o la sección de MFA/Device verification según la versión del dashboard): con testers conocidos y de confianza, podés desactivar el paso de verificación por dispositivo nuevo para que el login sea directo. Si lo dejás activo, el flujo de "Confirmá que sos vos" del Login ya está implementado en el frontend y funciona igual.

### 6. Crear cuentas de testers

Ver [Cuentas de testers](#cuentas-de-testers) más abajo. Hacelo manualmente desde el Clerk Dashboard (o el registro de la app si `VITE_BETA_SIGN_UP_ENABLED=true`) — nunca generes contraseñas en el seed ni las commitees.

### 7. Obtener el Clerk User ID del administrador

En **Clerk Dashboard → Users**, abrí el usuario que va a administrar Señor Pato y copiá su **User ID** (`user_xxx...`). Ese valor va en `BOOTSTRAP_ADMIN_CLERK_USER_ID` (paso 9).

### 8. Crear el backend en Render

**New → Web Service** → conectá el repo de GitHub. Si usás `render.yaml` (recomendado, ver raíz del repo), Render detecta el Blueprint automáticamente con:

```text
Root Directory:   (vacío / raíz del repo — el Blueprint usa pnpm --filter)
Runtime:          Node
Build Command:    corepack enable && pnpm install --frozen-lockfile && pnpm --filter @rondo/backend... build
Start Command:    pnpm --filter @rondo/backend start
Health Check Path: /health
```

Si preferís configurarlo a mano en vez de usar `render.yaml`, copiá exactamente esos comandos. El monorepo usa pnpm workspaces: `@rondo/backend` depende de `@rondo/contracts`, por eso el build usa `--filter @rondo/backend...` (el `...` incluye sus dependencias del workspace).

Después del primer deploy, configurá manualmente el **Pre-Deploy Command** en la configuración del servicio (no todos los planes/versiones de Render exponen este campo en `render.yaml` de la misma forma):

```bash
pnpm --filter @rondo/backend predeploy
```

Ese comando corre `prisma generate` y `prisma migrate deploy` — nunca `prisma migrate dev`, y nunca un reset.

### 9. Configurar variables de entorno en Render

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | el connection string del paso 2 |
| `CLERK_SECRET_KEY` | Secret Key de la instancia de beta de Clerk |
| `FRONTEND_URL` | `<VERCEL_BETA_URL>` (podés completarlo después del paso 14 y volver a desplegar) |
| `BOOTSTRAP_ADMIN_CLERK_USER_ID` | el User ID del paso 7 |
| `BOOTSTRAP_ADMIN_USERNAME` | opcional, no usar en beta (ver más abajo) |

`DATABASE_URL`, `CLERK_SECRET_KEY` y `FRONTEND_URL` son **obligatorias**: el backend falla al arrancar en `NODE_ENV=production` si falta alguna (validación en `apps/backend/src/config/env.ts`).

### 10. Desplegar

Dispará el deploy desde Render (o hacé push a la rama conectada). El **Pre-Deploy Command** del paso 8 corre las migraciones antes de que el nuevo build sirva tráfico.

### 11. Comprobar los health checks

```bash
curl https://<RENDER_BACKEND_URL>/health
curl https://<RENDER_BACKEND_URL>/health/database
```

`/health` no depende de Clerk ni de la base — si falla, el problema es el arranque del proceso. `/health/database` confirma la conexión a Postgres sin exponer credenciales en la respuesta (el detalle del error queda solo en los logs del servicio).

### 12. Aplicar migraciones (si no corrió el Pre-Deploy Command)

Si todavía no configuraste el paso 8, corré manualmente una vez desde un shell con acceso a `DATABASE_URL`:

```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

**Nunca** `pnpm prisma:migrate` (eso es `migrate dev`, interactivo y pensado solo para desarrollo local) contra la base de beta.

### 13. Ejecutar el seed base

Una sola vez (es idempotente, podés repetirlo sin miedo):

```bash
cd apps/backend
DATABASE_URL=<connection string de beta> pnpm seed:base
```

Esto crea los deportes, modalidades, Club Señor Pato, sus 4 canchas, horarios y la noticia de bienvenida. No borra nada existente.

No corras `pnpm prisma:seed` (el seed completo con partidos/usuarios demo de `seed_juan_perez` y compañía) contra beta — esas identidades no son cuentas Clerk reales y nunca van a poder loguearse.

### 14. Crear el frontend en Vercel

**New Project** → importá el repo. Configuración del proyecto (ver [Frontend en Vercel](#frontend-en-vercel) para el detalle):

```text
Root Directory:    apps/frontend
Install Command:   pnpm install (desde la raíz del monorepo — Vercel lo detecta solo)
Build Command:     pnpm build
Output Directory:  dist
```

### 15. Configurar variables en Vercel

| Variable | Valor |
|---|---|
| `VITE_API_BASE_URL` | `https://<RENDER_BACKEND_URL>` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable Key de la instancia de beta de Clerk |
| `VITE_BETA_SIGN_UP_ENABLED` | `false` (o `true` solo si de verdad querés registro público en la beta) |

Ningún secreto de backend (`CLERK_SECRET_KEY`, `DATABASE_URL`, `BOOTSTRAP_ADMIN_CLERK_USER_ID`) va en Vercel.

### 16. Configurar las URLs de Clerk

Ver la [checklist de Clerk](#clerk-checklist-de-urls-para-el-dominio-de-vercel) más abajo. Hacelo después de tener `<VERCEL_BETA_URL>` definitivo.

### 17. Prueba E2E con dos cuentas

Ver [Checklist E2E](#checklist-e2e) completa más abajo.

### 18. Rollback básico

- **Backend**: en Render, pestaña **Events** o **Deploys** del servicio → **Rollback** al deploy anterior. Las migraciones de Prisma son aditivas en este proyecto (nunca se edita una migración vieja), así que un rollback de código no debería dejar el schema desalineado; si una migración nueva rompió algo, corregí hacia adelante con una migración nueva en vez de revertir la aplicada.
- **Frontend**: en Vercel, pestaña **Deployments** → elegí un deploy anterior → **Promote to Production**.

### 19. Consultar logs

- **Render**: pestaña **Logs** del servicio (tiempo real y búsqueda). Los errores de `/health/database` loguean el detalle ahí, nunca en la respuesta HTTP.
- **Vercel**: pestaña **Logs** del proyecto para errores de build; para errores de runtime del cliente, la consola del navegador (no hay funciones serverless propias en este proyecto).

### 20. Cómo volver a desplegar

- **Backend**: push a la rama conectada en Render, o **Manual Deploy** desde el dashboard. El Pre-Deploy Command vuelve a correr `migrate deploy` automáticamente.
- **Frontend**: push a la rama conectada en Vercel, o **Redeploy** desde el dashboard.

---

## Base de datos remota

El backend usa `DATABASE_URL` sin asumir el proveedor — cualquier Postgres compatible con Prisma funciona (Neon, Render Postgres, Supabase, RDS, etc.). No hay nada en el código que codifique un dominio o proveedor específico.

### Migraciones

```bash
pnpm --filter @rondo/backend prisma:migrate:deploy
```

en producción/beta. **Nunca** `prisma:migrate` (= `migrate dev`) contra una base remota — es interactivo, pensado para desarrollo local, y puede intentar generar una shadow database que no vas a tener permisos para crear.

### Seed

Separado en dos scripts:

```bash
pnpm --filter @rondo/backend seed:base   # catálogo: deportes, club, canchas, horarios, noticia — idempotente, no borra nada
pnpm --filter @rondo/backend seed:beta   # opcional, manual: perfiles deportivos demo para testers YA logueados
```

`seed:beta` busca cada username de `BETA_TESTER_USERNAMES` (editable en `apps/backend/src/infrastructure/database/seedBeta.ts`) y solo actúa sobre los que ya tienen una cuenta interna sincronizada (es decir, que ya iniciaron sesión al menos una vez). Nunca crea identidades Clerk falsas. No se ejecuta automáticamente en ningún deploy — es manual, una vez, después de que los testers ya se hayan logueado.

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

- [ ] **Allowed origins**: agregar `<VERCEL_BETA_URL>` (y mantener `http://localhost:5173` para seguir desarrollando local).
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

`HOST` por defecto es `0.0.0.0` y `PORT` lee `process.env.PORT` (Render lo inyecta automáticamente; el valor en `.env.example`/`render.yaml` es solo el default local). No hay un puerto de producción fijo hardcodeado.

`GET /health` y `GET /health/database` ya existen. `/health` no llama a Clerk. `/health/database` corre `SELECT 1` y devuelve `status`/`database`/`timestamp` sin el detalle del error (que sí se loguea server-side).

### Variables del backend

Ver `apps/backend/.env.example`. En producción (`NODE_ENV=production`) son obligatorias `DATABASE_URL`, `CLERK_SECRET_KEY` y `FRONTEND_URL` — el arranque falla con un mensaje claro si falta alguna (`apps/backend/src/config/env.ts`).

### CORS

`apps/backend/src/app/cors.ts` arma una lista explícita de orígenes permitidos: siempre `http://localhost:5173`, más `FRONTEND_URL` si está configurado. Nunca `origin: true` ni `*`. Un origen fuera de la lista recibe error de CORS; una request sin header `Origin` (server-to-server, `curl`, el propio health check) siempre pasa, porque ahí no aplica la same-origin policy del navegador.

---

## Frontend en Vercel

### Variables

Ver `apps/frontend/.env.example`:

```env
VITE_API_BASE_URL=
VITE_CLERK_PUBLISHABLE_KEY=
VITE_BETA_SIGN_UP_ENABLED=false
```

Ningún secreto de backend se agrega acá. La URL de la API se lee desde un único lugar (`apps/frontend/src/runtimeConfig.ts`) — todo el resto del frontend (`apiClient.ts`, `useSports.ts`, el health check de `App.tsx`) importa `apiBaseUrl` desde ahí en vez de recalcularlo. No quedan URLs `localhost` hardcodeadas fuera de ese único fallback de desarrollo.

### SPA routing

La app actual navega con estado interno de React (`currentView` en `App.tsx`), no con rutas de URL reales — no existen todavía rutas como `/matches/:matchId` en la barra de direcciones. De todas formas, `apps/frontend/vercel.json` agrega un rewrite catch-all a `index.html` como protección: si en el futuro se agrega ruteo real, o si alguien navega directo a una URL no-raíz, Vercel sirve la SPA en vez de un 404. Los rewrites de Vercel no interfieren con archivos estáticos existentes (tienen prioridad sobre el rewrite).

### Monorepo (configuración exacta a copiar en Vercel)

```text
Root Directory:    apps/frontend
Install Command:   pnpm install (default; Vercel detecta el workspace de pnpm en la raíz)
Build Command:     pnpm build
Output Directory:  dist
```

`apps/frontend/package.json`'s `build` script ya corre `tsc --noEmit && vite build` — falla el deploy si hay errores de tipos.

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
