# Autenticación nativa (username + contraseña + sesión por cookie)

Rondo controla identidad, contraseñas, sesiones y avatares de punta a punta —
no depende de ningún proveedor externo (Clerk fue removido por completo, ver
[Migración desde Clerk](#migración-desde-clerk) al final).

## Arquitectura

```
Browser                          Backend (Fastify)                Postgres
--------                         ------------------                --------
POST /api/v1/auth/register  -->  argon2id.hash(password)      -->  users (password_hash)
                                  crypto.randomBytes(32) token -->  sessions (token_hash)
                             <--  Set-Cookie: rondo_session
                                  (httpOnly, secure*, sameSite=lax)

GET /api/v1/me (o cualquier  -->  cookie -> sha256(token)      -->  sessions lookup
ruta protegida)                   -> Session válida?           -->  request.currentUser
```

- **Passwords**: Argon2id vía [`@node-rs/argon2`](../apps/backend/src/infrastructure/auth/argon2PasswordHasher.ts) (bindings nativos napi-rs, sin compilación en el build de Render). Parámetros por defecto de la librería (alineados a OWASP) — deliberadamente no ajustados a mano.
- **Sesión**: token aleatorio de 256 bits (`crypto.randomBytes(32)`), enviado al browser como valor de la cookie. Nunca se guarda el token crudo — solo `sha256(token)` en la tabla `sessions` (columna `token_hash`, única). Ver [`sessionTokens.ts`](../apps/backend/src/infrastructure/auth/sessionTokens.ts).
  - **¿Por qué SHA-256 y no Argon2 para el token?** El token ya es aleatorio de alta entropía (256 bits) — no es un secreto "adivinable" como una contraseña. Un hash lento/salteado no agrega ninguna defensa real acá (forzar el hash por fuerza bruta es tan difícil como adivinar el token directamente, con o sin Argon2) y solo agregaría latencia a cada request autenticado. Un hash rápido y determinístico es lo correcto porque permite un lookup O(1) por índice único.
  - **¿Por qué no hay `SESSION_TOKEN_PEPPER`?** Un pepper defiende contra un atacante con acceso de solo-lectura a la base intentando forzar un secreto *adivinable* (contraseñas, PINs). Un token de sesión no es adivinable — poseer solo el `token_hash` no le da a un atacante ninguna ventaja para producir un valor de cookie válido (resistencia a preimagen de SHA-256), con o sin pepper. Un pepper viviría en el mismo radio de exposición que `DATABASE_URL` (si se compromete uno, muy probablemente se compromete el otro también), así que el beneficio marginal es prácticamente nulo acá — a diferencia de las contraseñas, donde salt+pepper sí sube el costo real de un ataque offline contra un hash filtrado.
- `lastUsedAt` se actualiza como máximo una vez cada 5 minutos por sesión activa (no en cada request), para no generar un write por request.

## Cookie

Nombre configurable vía `SESSION_COOKIE_NAME` (default `rondo_session`), duración vía `SESSION_TTL_DAYS` (default `30`).

| Atributo | Dev | Prod |
|---|---|---|
| httpOnly | true | true |
| secure | false (HTTP plano en localhost) | true |
| sameSite | lax | lax |
| path | / | / |
| domain | sin setear (host-only) | sin setear — mismo origen gracias al proxy |

La cookie **nunca** se expone en JSON ni en logs. El frontend nunca guarda un token en `localStorage` — ver `AuthProvider.tsx`, que solo mantiene `{user, authenticated}` en memoria/React state.

## Proxy same-origin

Una cookie emitida por el backend (Render) y usada por el frontend (Vercel) en dominios distintos se comporta como cookie cross-site, con soporte inconsistente en browsers móviles. Por eso el frontend accede a la API por **paths relativos**, resueltos same-origin:

- **Dev**: proxy de Vite (`server.proxy` en [`vite.config.ts`](../apps/frontend/vite.config.ts)) — `/api/*` y `/health` van a `http://127.0.0.1:3000`.
- **Beta/producción**: rewrite de Vercel (`vercel.json`, raíz del repo) — `/api/*` y `/health` van al backend de Render.

**Riesgo verificado, no asumido**: para proyectos creados en Vercel desde abril 2026, un rewrite externo cachea la respuesta por defecto si el backend manda cualquier header `Cache-Control`/`CDN-Cache-Control`. Cachear `/api/v1/auth/session` o `/api/v1/me` en el CDN compartido de Vercel sería una fuga de sesión entre usuarios. Mitigación aplicada en `vercel.json`: header `x-vercel-enable-rewrite-caching: 0` sobre `/api/:path*`, aunque Fastify hoy no mande `Cache-Control` (no depender de que eso siga siendo así).

**Antes de confiar en este proxy en un deploy real**: desplegar un endpoint de prueba que setee una cookie (`reply.setCookie(...)`) y confirmar en DevTools de un browser real que el `Set-Cookie` sobrevive el rewrite y la cookie queda seteada en el dominio de Vercel. Si no sobrevive, el fallback es una Vercel Function que proxyee método/headers/body/status a mano.

## CORS y CSRF

- **CORS** (`app/cors.ts`): allowlist explícita (`http://localhost:5173` + `FRONTEND_URL`), nunca `origin: true`/`*`. En este proyecto, `@fastify/cors` rechaza con un 500 cualquier origin no permitido para *cualquier* método (no solo mutaciones) — comportamiento existente, no introducido por este cambio.
- **CSRF** (`app/csrf.ts`, nuevo): dado que la auth es por cookie, CORS solo controla si JS de un sitio ajeno puede *leer* la respuesta — no evita que el browser *envíe* la mutación con la cookie adjunta. El guard de Origin (`createOriginGuard`) rechaza con 403 cualquier `POST/PUT/PATCH/DELETE` cuyo header `Origin` esté presente pero no en la allowlist. Se registra **antes** que `@fastify/cors` en `server.ts` — así una request mutativa de un origin no permitido recibe un 403 limpio en vez de un 500 incidental de CORS. Requests sin header `Origin` (server-to-server, health checks) siempre pasan, igual que en CORS.

## Endpoints

| Endpoint | Reglas |
|---|---|
| `POST /api/v1/auth/register` | `{displayName, username, password, confirmPassword}`; username normalizado (trim + lowercase); 409 si ya existe; crea `User` + perfiles deportivos default (todos los deportes, disponibilidad completa) + `Session`; **nunca** crea `ClubMembership` ni promueve a SUPERADMIN; setea cookie |
| `POST /api/v1/auth/login` | `{username, password}`; mensaje genérico **"Usuario o contraseña incorrectos"** tanto si el usuario no existe como si la contraseña es incorrecta (nunca revela cuál); crea `Session`; setea cookie |
| `POST /api/v1/auth/logout` | body opcional `{pushEndpoint?}`; revoca la sesión actual; si viene `pushEndpoint`, desasocia esa suscripción push (ver [Push en dispositivo compartido](#push-en-dispositivo-compartido)); limpia cookie; idempotente (200 aunque la sesión ya no exista) |
| `GET /api/v1/auth/session` | `{authenticated, user}` — nunca expone `passwordHash`/tokens; `user: null` si no autenticado |
| `POST /api/v1/auth/change-password` | `{currentPassword, newPassword, confirmNewPassword}`; revoca todas las **demás** sesiones del usuario, mantiene la actual |

Rate limiting (`@fastify/rate-limit`, opt-in por ruta): `/auth/register` y `/auth/login` limitados por IP+username normalizado combinados (10/min), sin bloqueo permanente.

## Roles y permisos

Sin cambios de modelo: `UserRole` (global, `USER`/`SUPERADMIN`) sigue separado de `ClubMembershipRole` (por club, `MEMBER`/`CLUB_ADMIN`). Los guards (`requireSuperadmin`, `requireClubAdmin`, `requireClubManagementAccess` en `modules/admin/adminAuth.ts`) no cambiaron — siguen operando sobre `request.currentUser.id`, indiferente a cómo se resolvió la sesión.

**Ningún registro promueve a SUPERADMIN automáticamente.** La única forma de crear un SUPERADMIN es el script `auth:create-superadmin` (ver abajo), ejecutado explícitamente y fuera de banda.

## Crear un SUPERADMIN

```bash
SUPERADMIN_USERNAME=federico \
SUPERADMIN_DISPLAY_NAME="Federico Femenia" \
SUPERADMIN_PASSWORD='una-contraseña-real-y-segura' \
  pnpm --filter @rondo/backend auth:create-superadmin
```

- Idempotente: correrlo de nuevo con el mismo username actualiza esa misma cuenta (password, displayName, role) en vez de duplicar.
- Otorga membership `CLUB_ADMIN` en Señor Pato además del rol global `SUPERADMIN`.
- Nunca loguea la contraseña ni el hash — solo confirma username + id afectado.
- Nunca se ejecuta automáticamente (no forma parte de `predeploy` ni de ningún build).
- Después de correrlo contra producción, se puede (y conviene) eliminar la variable `SUPERADMIN_PASSWORD` del entorno.

## Cambio y reset de contraseña

- **Cambio (self-service)**: `POST /api/v1/auth/change-password`, requiere la contraseña actual. Revoca todas las demás sesiones del usuario.
- **Reset (sin email en esta beta)**: no existe un endpoint público de "olvidé mi contraseña" — sería inseguro sin verificación por email/SMS. El reset es **administrativo**: pedirle a un superadmin que corra el script de creación de superadmin (si la cuenta a resetear va a ser superadmin) o, para un usuario común, correr un `prisma.user.update` puntual (por Prisma Studio o un script ad-hoc) para setear un nuevo `passwordHash` generado con `argon2PasswordHasher.hash(...)`. No se implementó un script dedicado de reset genérico en este slice — evaluar si hace falta uno según el volumen real de pedidos.

## Reset controlado de datos de la beta anterior

Antes de abrir la beta a testers reales, hay que limpiar los usuarios y datos de prueba de Clerk-era. Ver el script `beta:reset-user-data`:

```bash
# Dry-run (comportamiento por defecto, siempre seguro) -- solo imprime conteos
pnpm --filter @rondo/backend beta:reset-user-data

# Ejecución real -- borra de verdad
ALLOW_DESTRUCTIVE_BETA_RESET=true BETA_RESET_CONFIRMATION=DELETE_ALL_RONDO_USER_DATA \
  pnpm --filter @rondo/backend beta:reset-user-data --execute
```

- **Dry-run es el default.** Sin `--execute`, nunca borra nada.
- Con `--execute`, requiere **ambas** variables exactas (`ALLOW_DESTRUCTIVE_BETA_RESET=true` y `BETA_RESET_CONFIRMATION=DELETE_ALL_RONDO_USER_DATA`) — si falta cualquiera, aborta sin tocar nada.
- Borra, en orden FK-safe, dentro de una transacción: `Session` → `PushSubscription` → `PlayerAvailability` → `UserSportProfile` → `PlayerRating` → `MatchChatMessage` → `MatchInvitation` → `MatchParticipant` → `Match` → `ClubMembership` → `User`.
- **Conserva siempre**: `Sport`, `SportModality`, `Club` (Señor Pato), `Court`, `OpeningHour`, `ClubNews`, `PushEvent` (ledger de idempotencia global, no depende de usuarios).
- Después de un reset real: correr `seed:base` si hace falta reponer catálogo (idempotente), y después `auth:create-superadmin` para tener un admin de nuevo.
- Ver el código en [`resetUserData.ts`](../apps/backend/src/infrastructure/scripts/resetUserData.ts) para el detalle exacto.

## Push en dispositivo compartido

`PushSubscription.endpoint` es la clave única (no `userId+endpoint`): re-suscribirse desde el mismo browser/dispositivo siempre reasigna esa fila al usuario autenticado actual (`push.service.ts`'s `saveSubscription`), sea quien sea. Esto ya resolvía "usuario B inicia sesión en el dispositivo de A y A deja de recibir pushes ahí" — lo que faltaba era el caso de **logout sin login inmediato de otro usuario**: sin desasociar nada, el dispositivo seguía "perteneciendo" al usuario anterior hasta que alguien más se subscribiera ahí.

Con auth nativa: `POST /api/v1/auth/logout` acepta `{pushEndpoint}` (el `AuthProvider.tsx` del frontend lo obtiene de `navigator.serviceWorker.ready` antes de llamar logout) y desasocia esa suscripción específica del usuario que cierra sesión. La suscripción del *browser* puede seguir existiendo (no se fuerza un `unsubscribe()`), pero sin fila en `push_subscriptions` no recibe pushes de nadie hasta que alguien vuelva a habilitarlas.

Además, `App.tsx` monta `<PushNotificationsBanner key={user?.id}>` — la `key` cambia en cada cambio de identidad, forzando un remount (y por lo tanto una nueva reconciliación de `usePushNotifications()`) en cada login, sin depender de timing implícito de mount/unmount.

## Avatar (Cloudflare R2)

Clerk manejaba upload + hosting del avatar de punta a punta. Reemplazado por Cloudflare R2 (S3-compatible), vía `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (sin SDK propietario de Cloudflare).

Flujo: `POST /api/v1/me/avatar/upload-url {contentType}` → URL presignada de PUT (expira ~5 min) → el browser sube el archivo directo a R2 (nunca pasa por el backend) → `PUT /api/v1/me/profile {avatarUrl: publicUrl}` persiste la URL, validando server-side que efectivamente fue emitida para ese usuario (prefijo `avatars/{userId}/`) — evita que alguien setee la URL de otro usuario o una arbitraria.

**Configuración requerida** (env vars, ver `.env.example`): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. Sin estas variables, el endpoint de upload devuelve 503 con un mensaje claro y el resto de la app sigue funcionando normalmente (avatar sigue siendo nullable, con fallback a iniciales).

Setup manual en Cloudflare (fuera del alcance de este repo): crear cuenta, crear bucket R2, generar API token con permisos de ese bucket, configurar el bucket como público o con un custom domain para `R2_PUBLIC_URL`.

## Troubleshooting

- **"Usuario o contraseña incorrectos" pero estoy seguro de la contraseña**: el username se normaliza a minúsculas al registrar/loguear — probar en minúsculas explícitamente. Si la cuenta viene de la era Clerk (nunca migrada), su `passwordHash` es un sentinel no válido (`MIGRATED_NO_PASSWORD_...`) — no va a poder loguearse nunca; hay que recrearla (registro nuevo) después del reset de la beta.
- **La cookie no llega / sesión no persiste**: confirmar que el frontend está pegándole a rutas relativas (no a una URL absoluta cross-origin) y que el proxy same-origin (Vite dev o Vercel) está activo — ver [Proxy same-origin](#proxy-same-origin).
- **403 CSRF_ORIGIN_REJECTED en una request legítima**: el `Origin` del request no está en la allowlist (`FRONTEND_URL` + `localhost:5173` +, fuera de producción, cualquier `localhost`/`127.0.0.1`). Revisar `FRONTEND_URL` en el entorno del backend.
- **Avatar upload devuelve 503**: R2 no está configurado — ver env vars arriba.

## Migración desde Clerk

Clerk fue removido por completo: no participa del registro, login ni de ningún request. Los usuarios que existían con identidad Clerk (columna `clerk_user_id`, ahora eliminada) quedaron con un `passwordHash` sentinel no válido tras la migración — nunca podrán loguearse con la contraseña que tenían en Clerk (Clerk nunca compartió esa contraseña con Rondo, así que esto no pierde nada). Sus datos históricos (partidos, ratings, mensajes) permanecen intactos hasta que se corra `beta:reset-user-data --execute` explícitamente.

Pasos manuales pendientes, fuera de este repo (no automatizados, requieren aprobación explícita antes de ejecutarse):
1. Borrar los usuarios de la aplicación Clerk desde su Dashboard.
2. Desactivar o eliminar la aplicación Clerk una vez confirmada la estabilidad del sistema nuevo en producción.
