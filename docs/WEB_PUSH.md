# Web Push

Rondo puede enviar notificaciones push del navegador/sistema operativo a los dispositivos donde un usuario las activó: la infraestructura (activar/desactivar, guardar la suscripción, notificación de prueba), los eventos reales de negocio que efectivamente disparan una — invitaciones, aceptaciones/rechazos, un partido que se llena, se cancela o termina, mensajes de chat, valoraciones recibidas — y, desde el slice de navegación, **tocar una notificación abre el contenido correspondiente dentro de Rondo** (no solo la Home). Ver [Eventos de dominio](#eventos-de-dominio) y [Deep linking](#deep-linking) más abajo. Lo que queda explícitamente fuera todavía: [Fuera de alcance de este slice](#fuera-de-alcance-de-este-slice).

Este slice reutiliza el service worker de la PWA (ver [`docs/PWA.md`](./PWA.md)) — no hay un segundo service worker.

---

## Arquitectura

```text
Usuario toca "Activar"
  → Notification.requestPermission()
  → navigator.serviceWorker.ready
  → registration.pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
  → POST /api/v1/me/push-subscriptions { endpoint, keys: { p256dh, auth } }
      → se guarda en PostgreSQL (tabla push_subscriptions), asociada al usuario autenticado

Backend envía una notificación -- el botón "Enviar prueba" y los 8 eventos de dominio (invitaciones, cancelación, partido lleno/completado, chat) comparten el mismo camino final:
  → recordAndSendPushEvent(): registra el evento (idempotencia, ver más abajo) y resuelve destinatarios
  → sendPushToUser() por destinatario → busca sus PushSubscription
  → web-push.sendNotification(subscription, payload, { vapid keys })
  → si el push service responde 404/410 → esa suscripción quedó inválida → se borra

Service Worker (src/sw.ts)
  → evento "push" → self.registration.showNotification(...)
  → evento "notificationclick"
      → hay una pestaña de Rondo abierta → la enfoca y le posta un mensaje OPEN_PUSH_DESTINATION (nunca navigate(), ver Deep linking)
      → no hay ninguna → abre una nueva ventana directo en la URL del deep link (?open=...)
```

Piezas nuevas de la primera parte de este slice (infraestructura):

```text
apps/backend/prisma (schema.prisma + migración)  # tabla push_subscriptions
apps/backend/src/modules/push/push.service.ts     # guardar/listar/borrar/enviar, configuración VAPID
apps/backend/src/modules/push/push.controller.ts  # GET/POST/DELETE .../push-subscriptions, POST .../test
apps/backend/src/config/env.ts                    # VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
packages/contracts/src/index.ts                   # PushSubscriptionInputDto, PushSubscriptionStatusDto, TestPushResponseDto, PushNotificationPayloadDto

apps/frontend/src/sw.ts                       # service worker (injectManifest -- ver más abajo), push + notificationclick
apps/frontend/src/usePushNotifications.ts     # hook: supported, permission, enabled, reconciling, enable(), disable(), sendTest()
apps/frontend/src/PushNotificationsBanner.tsx # CTA contextual "Activá las notificaciones", descartable 7 días
apps/frontend/src/PushNotificationsSettings.tsx # sección "Notificaciones" en Editar perfil
apps/frontend/src/runtimeConfig.ts            # VITE_VAPID_PUBLIC_KEY
```

Piezas del slice de navegación/deep linking (ver [Deep linking](#deep-linking)):

```text
apps/frontend/src/pushNavigation.ts      # parseo de ?open=..., store a nivel de módulo, listener de mensajes del SW
apps/frontend/src/usePushNavigation.ts   # hook: destination, clear()
apps/frontend/src/PlayerRatingsSummary.tsx # estrellas/comentarios inline, compartido por Candidatos y Jugadores
```

Piezas de eventos de dominio (ver [Eventos de dominio](#eventos-de-dominio)):

```text
apps/backend/prisma (schema.prisma + migración)   # enum PushEventType, tabla push_events (idempotencia)
apps/backend/src/modules/push/pushCopy.ts          # copy en español de cada evento -- título, cuerpo, tag
apps/backend/src/modules/push/pushEvents.service.ts # recordAndSendPushEvent: idempotencia + fan-out + nunca lanza
```

---

## Service worker: generateSW → injectManifest

Antes de este slice, `vite-plugin-pwa` usaba la estrategia `generateSW`: Workbox generaba `sw.js` completo a partir de opciones declarativas, sin forma de agregar un listener propio de `push`/`notificationclick`.

Se migró a **`injectManifest`**: `apps/frontend/src/sw.ts` es ahora un service worker escrito a mano, que:

- llama a `precacheAndRoute(self.__WB_MANIFEST)` (mismo precache del app shell que antes, mismos `globPatterns`);
- registra el mismo fallback SPA (`NavigationRoute` a `/index.html`, con el mismo denylist de `/api/`);
- mantiene el mismo handshake `SKIP_WAITING` que `UpdatePrompt.tsx` ya usaba;
- agrega `self.addEventListener('push', ...)` y `self.addEventListener('notificationclick', ...)`.

```ts
// apps/frontend/vite.config.ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectRegister: false,
  registerType: 'prompt',
  manifest: pwaManifest,
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
  },
})
```

**Sigue habiendo un solo service worker.** `UpdatePrompt.tsx` sigue siendo el único punto de registro (vía `virtual:pwa-register/react` / `useRegisterSW`), sin cambios: no se agregó un segundo `navigator.serviceWorker.register(...)` en ningún lado. `tests/pwaSingleServiceWorker.test.ts` verifica esto de forma automática (un solo archivo `sw.ts`, una sola llamada a `VitePWA(...)`, un solo importador de `virtual:pwa-register`).

Todo lo demás de la PWA (precache, fallback offline, install prompt, update prompt, scope `/`) se comportó igual antes y después de la migración — confirmado con un build real (`vite build`): mismas 73 entradas precacheadas, mismo `dist/sw.js` generado (ahora con los listeners `push`/`notificationclick` incluidos), y el resto de `docs/PWA.md` sigue vigente sin cambios de comportamiento salvo la sección de arquitectura del worker.

`sw.ts` usa el lib `WebWorker` de TypeScript (incompatible con `DOM`, que usa el resto de la app), así que quedó excluido del `tsconfig.json` principal y tiene su propio `tsconfig.sw.json`; `pnpm build` (`apps/frontend/package.json`) lo typechequea aparte antes de compilar.

---

## Modelo `PushSubscription`

```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_subscriptions")
}
```

- **Un usuario puede tener varias suscripciones** (celular, tablet, desktop) — no hay `@unique` sobre `userId`, solo sobre `endpoint`.
- **`endpoint` es único globalmente, no por usuario.** El `endpoint` que entrega el navegador identifica *ese dispositivo/registro*, no a la persona. Esto habilita una decisión de diseño explícita:

  > **Reasignación de dispositivo compartido:** si el mismo `endpoint` (mismo navegador/dispositivo) se vuelve a suscribir bajo otro usuario autenticado, `saveSubscription` hace un `upsert` por `endpoint` y **reasigna la fila al usuario actual**. Es decir: si en un navegador compartido el Usuario A activó notificaciones y después el Usuario B inicia sesión ahí y también activa, la suscripción pasa a ser de B — A deja de recibir push en ese dispositivo. Se prefirió esto sobre rechazar la reasignación porque una misma suscripción de browser siempre representa "el dispositivo actual", nunca a dos personas a la vez.

- **Nunca se guardan tokens de Clerk** ni ningún dato de autenticación en esta tabla — solo lo que el propio `PushSubscriptionJSON` del navegador entrega (`endpoint`, `keys.p256dh`, `keys.auth`) más `userAgent` (informativo, para que el usuario reconozca "cuál dispositivo es cuál" si en el futuro se muestra una lista).
- **Migración:** `20260805111209_add_push_subscriptions` (nueva, no se modificó ninguna migración anterior). Aplicada con `prisma migrate dev` contra la base local; en producción se aplica con el `predeploy` existente (`prisma migrate deploy`), sin pasos manuales adicionales.
- **Logout:** cerrar sesión **no borra** la suscripción del dispositivo — sigue asociada al usuario hasta que la desactive manualmente o hasta que otro usuario la reasigne al volver a suscribirse en el mismo navegador (ver arriba). Es una decisión deliberada: si se borrara en cada logout, el usuario tendría que reactivar notificaciones cada vez que cierra sesión en su propio celular.

---

## Generar las claves VAPID

VAPID identifica al backend ante el push service del navegador (Chrome/Firefox/Safari push infra), sin depender de Firebase/OneSignal.

```bash
pnpm --filter @rondo/backend exec web-push generate-vapid-keys
```

Esto imprime un par `Public Key` / `Private Key` (base64 URL-safe). **Generar una sola vez y guardarlas** — no se regeneran en cada deploy (si se regeneran, todas las suscripciones existentes quedan inválidas y cada usuario tiene que volver a activar notificaciones).

- `VAPID_PUBLIC_KEY` → backend (`Render`) **y** frontend (`Vercel`, como `VITE_VAPID_PUBLIC_KEY`) — es seguro exponerla, es la mitad pública del par.
- `VAPID_PRIVATE_KEY` → **solo backend**, nunca en el frontend ni en un commit.
- `VAPID_SUBJECT` → un `mailto:` o `https:` de contacto (ej. `mailto:admin@rondo.app`), exigido por el protocolo Web Push mismo para que el push service pueda contactar al remitente ante abuso. No es una promesa de bandeja de entrada real — usar la dirección que el equipo quiera recibir esos reportes, no un dominio inventado en un deploy real.

## Variables de entorno

**Render (backend)** — agregar además de las ya documentadas en `docs/BETA_DEPLOYMENT.md`:

| Variable | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la clave pública generada arriba |
| `VAPID_PRIVATE_KEY` | la clave privada generada arriba |
| `VAPID_SUBJECT` | `mailto:...` o `https://...` |

Las tres son **obligatorias en producción** (`NODE_ENV=production`) — el arranque falla con un mensaje claro si falta alguna (`apps/backend/src/config/env.ts`, mismo patrón que `DATABASE_URL`/`CLERK_SECRET_KEY`/`FRONTEND_URL`).

**Vercel (frontend):**

| Variable | Valor |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | la misma clave pública de arriba (debe coincidir exactamente con `VAPID_PUBLIC_KEY` del backend) |

Después de agregar las variables: **redeploy backend y redeploy frontend** (Vite inyecta `VITE_*` en build time, no en runtime). Aplicar la migración nueva con `prisma migrate deploy` (ya corre solo, vía `predeploy`, igual que las anteriores). No se suben valores reales de estas claves a ningún commit — ver `apps/backend/.env.example` y `apps/frontend/.env.example`, que documentan las variables sin valores.

---

## Endpoints

Todos requieren autenticación (`preHandler: app.requireAuth`).

### `GET /api/v1/me/push-subscriptions`

```json
{ "data": { "enabled": true, "subscriptions": [{ "id": "...", "endpoint": "...", "createdAt": "...", "userAgent": "..." }] } }
```

Nunca devuelve `p256dh` ni `auth`.

### `POST /api/v1/me/push-subscriptions`

Body: `{ endpoint, keys: { p256dh, auth } }` (el resultado de `subscription.toJSON()` en el navegador). `userId` sale siempre del usuario autenticado, nunca del body. Hace `upsert` por `endpoint` (ver la sección de reasignación arriba).

### `DELETE /api/v1/me/push-subscriptions`

Body: `{ endpoint }`. Solo borra una suscripción que pertenezca al usuario autenticado — un `endpoint` ajeno responde `404` igual que uno inexistente (nunca revela si le pertenece a otra cuenta).

### `POST /api/v1/me/push-subscriptions/test`

Envía una notificación de prueba (`{ title: "Rondo", body: "Las notificaciones están activadas.", url: "/", tag: "rondo-push-test" }`) a **todas** las suscripciones activas del usuario autenticado. `404 NO_PUSH_SUBSCRIPTIONS` si no tiene ninguna. `500 PUSH_NOT_CONFIGURED` si el servidor no tiene las claves VAPID cargadas.

```json
{ "data": { "sent": 1, "removed": 0 } }
```

`sent`/`removed` reflejan cuántas suscripciones recibieron el push y cuántas se borraron por estar vencidas (ver abajo).

---

## Eventos de dominio

Nueve eventos disparan una push real. Todos comparten el mismo principio: **se envían recién después de que la operación de negocio ya se confirmó** — una invitación, una aceptación, una cancelación, una valoración o un mensaje de chat nunca se revierten porque el envío del push falle. `recordAndSendPushEvent` (`pushEvents.service.ts`) nunca lanza una excepción bajo ninguna circunstancia; cualquier fallo se loguea (sin el payload completo ni claves) y se traga.

| Evento | Se dispara | Destinatarios | Excluye | Destino (deep link) |
|---|---|---|---|---|
| `MATCH_INVITATION_RECEIVED` | Al crear una invitación | El invitado | El organizador | `HOME_INVITATIONS` |
| `MATCH_INVITATION_ACCEPTED` | Al aceptar | El organizador | El que aceptó | `MATCH_PLAYERS` |
| `MATCH_PARTICIPANT_JOINED` | Al aceptar (mismo momento que arriba, evento distinto) | Confirmados previos | El organizador (ya recibió `ACCEPTED`), el que aceptó | `MATCH_PLAYERS` |
| `MATCH_INVITATION_REJECTED` | Al rechazar | El organizador | Los demás participantes | `MATCH_PLAYERS` |
| `MATCH_CANCELLED` | Al cancelar el partido | Confirmados + invitados PENDING | Rechazados/cancelados previos, el organizador que canceló | `MATCH_SUMMARY` |
| `MATCH_FULL` | Transición real ORGANIZING → FULL | Todos los confirmados (organizador incluido) | — | `MATCH_SUMMARY` |
| `MATCH_COMPLETED_RATINGS_ENABLED` | Transición real → COMPLETED (lazy, ver abajo) | Todos los confirmados (organizador incluido) | — | `MATCH_RATINGS` |
| `MATCH_CHAT_MESSAGE` | Cada mensaje guardado | Confirmados | El autor, pendientes, removidos/quienes abandonaron | `MATCH_CHAT` |
| `RATING_RECEIVED` | Al guardar una `PlayerRating` | Solo el jugador valorado | Quien valoró; el organizador, salvo que sea el propio valorado | `MATCH_PLAYERS` |

Ver [Deep linking](#deep-linking) para cómo cada `Destino` se convierte en una pantalla real dentro de la app.

### `RATING_RECEIVED`: qué no incluye, y a dónde lleva

El título/cuerpo son fijos y genéricos ("Nueva valoración" / "Recibiste una nueva valoración en {deporte}.") -- deliberadamente **sin** cantidad de estrellas, puntuación, comentario, ni identidad de quien valoró. `dedupeKey` es `rating-received-{ratingId}`: como `rateParticipant` hace `upsert` (mismo `id` al crear o al editar una valoración ya dada), volver a valorar al mismo jugador en el mismo partido nunca reenvía el push -- solo la primera vez cuenta como "recibiste una valoración nueva".

Toca a `MATCH_PLAYERS` (la solapa Jugadores del partido), no a una pantalla de "mis valoraciones" separada: esa solapa ya muestra, para el organizador y cada participante confirmado, las mismas estrellas de juego/conducta y el mismo botón "Ver comentarios" que usa Candidatos (`PlayerRatingsSummary.tsx`, `PlayerProfileCardDialog.tsx`, `PlayerRatingCommentsDialog.tsx` -- ver [Ratings inline en Jugadores](#ratings-inline-en-jugadores)), así que el jugador valorado ve ahí mismo, dentro de Rondo, exactamente el detalle que la notificación del sistema operativo deliberadamente no muestra.

### Por qué `MATCH_INVITATION_ACCEPTED` y `MATCH_PARTICIPANT_JOINED` son eventos separados

Una misma aceptación genera **dos** notificaciones con copy distinto: el organizador recibe "**{jugador}** aceptó tu invitación", y cada participante *ya confirmado* recibe "**{jugador}** se sumó al partido" — nunca ambos mensajes a la misma persona (el organizador no recibe el segundo; el que acaba de aceptar no recibe ninguno de los dos, nunca se notifica a alguien sobre su propia acción).

### Idempotencia: tabla `push_events`

```prisma
enum PushEventType {
  MATCH_INVITATION_RECEIVED
  MATCH_INVITATION_ACCEPTED
  MATCH_INVITATION_REJECTED
  MATCH_PARTICIPANT_JOINED
  MATCH_FULL
  MATCH_CANCELLED
  MATCH_COMPLETED_RATINGS_ENABLED
  MATCH_CHAT_MESSAGE
  RATING_RECEIVED
}

model PushEvent {
  id          String        @id @default(uuid())
  type        PushEventType
  aggregateId String
  dedupeKey   String        @unique
  payload     Json
  createdAt   DateTime      @default(now())
  processedAt DateTime?
  failedAt    DateTime?
  attempts    Int           @default(0)
}
```

Una fila por **ocurrencia lógica** del evento (no una por destinatario -- una aceptación con 5 confirmados previos genera 1 fila `MATCH_PARTICIPANT_JOINED`, enviada a los 5). La guarda real de idempotencia es la restricción `@unique` de `dedupeKey`: `recordAndSendPushEvent` intenta `create`; si otra llamada (reintento, doble-click, dos resoluciones de lifecycle en paralelo) ya insertó la misma clave, el `create` falla con `P2002` y la función retorna en silencio -- exactamente una fila y una ronda de envíos por evento, garantizado por la base de datos, no por lógica de aplicación que pueda tener una condición de carrera.

`dedupeKey` por tipo de evento:

- Invitación recibida/aceptada/rechazada, jugador sumado: `invitation-{accion}-{invitationId}` -- cada invitación solo puede pasar por cada transición una vez (`status !== 'PENDING'` ya lo impide a nivel de negocio), así que esto es defensa en profundidad, no la única barrera.
- Partido cancelado: `match-cancelled-{matchId}` -- CANCELLED es terminal, no hay una segunda cancelación posible.
- Partido completado: `match-completed-{matchId}` -- COMPLETED también es terminal.
- Mensaje de chat: `chat-message-{messageId}` -- cada mensaje tiene su propio id.
- Valoración recibida: `rating-received-{ratingId}` -- mismo `id` al crear o editar (es un `upsert`), así que reeditar una valoración nunca reenvía el push.
- **`MATCH_FULL`: `match-full-{matchId}-{statusChangedAt.toISOString()}`.** A diferencia de los anteriores, FULL no es terminal -- un jugador puede abandonar (vuelve a ORGANIZING) y el partido puede completarse de nuevo más tarde. Se decidió que esa segunda vez **sí** debe notificar de nuevo (es una transición real distinta), así que la clave incluye el instante exacto de la transición (`now` en el momento en que `acceptInvitation` la detecta) en vez de depender solo de `matchId`. Una lectura repetida del mismo partido ya FULL nunca genera una clave nueva (no hay una transición nueva que detectar), así que no duplica.

### `MATCH_COMPLETED_RATINGS_ENABLED` es 100% lazy durante la beta

Todas las transiciones de lifecycle (incluida `IN_PROGRESS → COMPLETED`) se resuelven *lazy*: recién cuando algo pide el partido (`findMatchWithRelations`, llamado por cualquier request normal -- ver un partido, listar `/me/matches`, etc.). No existe ningún job programado ni cron corriendo en segundo plano: si nadie vuelve a pedir ese partido después de que terminó, la transición (y el push que la acompaña) simplemente espera hasta que alguien lo haga. Es una decisión deliberada para este slice, no un descuido -- agregar un disparador programado (Render Cron Job, un endpoint interno con scheduler externo, etc.) es explícitamente [fuera de alcance](#fuera-de-alcance-de-este-slice) por ahora.

`notifyIfJustCompleted` (`matches.service.ts`) sigue siendo el único lugar que dispara `MATCH_COMPLETED_RATINGS_ENABLED`, y sigue siendo idempotente vía `dedupeKey` (`match-completed-{matchId}`) incluso si dos requests concurrentes observan la misma transición.

### Contenido y privacidad

Ningún payload incluye email, username, biografía, comentarios ajenos, ni tokens -- solo nombres visibles (`displayName`) y datos mínimos del partido (deporte, día de la semana, hora si está confirmada, sede si existe). El cuerpo de cada notificación está en `pushCopy.ts`, con ejemplos reales:

- `MATCH_INVITATION_RECEIVED`: "Juan Pérez te invitó a jugar Fútbol el viernes a las 20:00 en La Canchita." (o, sin sede/hora confirmada: "...el viernes. Sede a definir.")
- `MATCH_CHAT_MESSAGE`: título `"{autor} · {deporte}"`, cuerpo truncado a 100 caracteres en una sola línea (sin interpretar HTML), con "…" si se cortó.

`data` en el payload lleva `{ type, matchId?, invitationId?, messageId?, ratingId?, destination }` -- contexto interno para el deep link (ver abajo), nunca contenido sensible.

---

## Deep linking

**El problema que resuelve:** antes de este slice, todo payload usaba `url: "/"` -- tocar cualquier notificación abría únicamente la Home, y el usuario tenía que buscar manualmente el partido, la invitación, el chat o las valoraciones. Los payloads ya traían `matchId`/`invitationId`/`messageId`/`ratingId`, pero nada los usaba para navegar.

**Por qué no React Router:** Rondo no tiene routing real por URL -- toda la navegación es estado interno de React (`currentView` en `App.tsx`, ver `docs/BETA_DEPLOYMENT.md#spa-routing`). Agregar React Router solo para resolver deep links de push habría sido un cambio de arquitectura mucho más grande que lo que el problema requiere, así que la solución reutiliza el mismo mecanismo: un único query param `?open=...` (más `matchId`/`invitationId` según el destino) que `App.tsx` interpreta al bootear y traduce a la misma navegación interna que ya existía (`setCurrentView`, `openMatchDetail(matchId, tab)`, etc.).

### Esquema de URL

`pushCopy.ts` serializa un `PushDestinationDto` tipado (`HOME_INVITATIONS | MATCH_SUMMARY | MATCH_PLAYERS | MATCH_CHAT | MATCH_RATINGS`) a una URL relativa, siempre bajo `/`:

| Destino | `url` |
|---|---|
| `HOME_INVITATIONS` | `/?open=invitations&invitationId=...` |
| `MATCH_SUMMARY` | `/?open=match-summary&matchId=...` |
| `MATCH_PLAYERS` | `/?open=match-players&matchId=...` |
| `MATCH_CHAT` | `/?open=match-chat&matchId=...` |
| `MATCH_RATINGS` | `/?open=match-ratings&matchId=...` |

`data.destination` lleva el mismo valor tipado (`PushDestinationDto`) por si algún consumidor lo necesita sin tener que parsear la URL -- `url` es la forma serializada, `destination` la forma tipada, ambas siempre en sincronía (mismo `basePayload()` en `pushCopy.ts` construye las dos a la vez).

### `pushNavigation.ts`: parseo, store y consumo

`apps/frontend/src/pushNavigation.ts` es el único lugar que entiende este esquema de query params:

- `parsePushDestination(search)`: convierte `?open=...` en un `PushDestination` tipado (`{ type: 'MATCH_CHAT'; matchId: string }`, etc.). Valida que `matchId`/`invitationId` tengan forma de UUID -- un id inválido o ausente hace que la función devuelva `null` (o, para invitaciones, un `invitationId` `undefined`) en vez de confiar ciegamente en el query param. Nunca confirma que el recurso *exista* ni que el usuario tenga acceso -- eso se resuelve después, contra datos reales (ver más abajo).
- Store a nivel de módulo (mismo patrón que `installPrompt.ts`): al importarse, lee `window.location.search` una vez (cubre el arranque en frío) y registra un listener de `navigator.serviceWorker` para mensajes `OPEN_PUSH_DESTINATION` (cubre la app ya abierta, ver abajo). `usePushNavigation()` expone ese estado vía `useSyncExternalStore`.
- `clearPendingPushDestination()`: limpia el destino en memoria y llama a `clearPushDestinationFromUrl()`, que saca `open`/`matchId`/`invitationId` de la URL con `history.replaceState` (sin recargar, sin tocar otros query params ni el hash). Se llama siempre que `App.tsx` terminó de intentar aplicar un destino, haya salido bien o mal -- así nunca se vuelve a aplicar el mismo deep link en un refresh posterior, y un link compartido/guardado en favoritos nunca arrastra un destino viejo.

### App cerrada vs. app abierta: una sola estrategia por caso, documentada

El flujo con la **app cerrada** es: `notificationclick` → `self.clients.openWindow(targetPath)` abre una pestaña nueva directo en `/?open=...` → el fallback SPA de Workbox sirve `index.html` → `App.tsx` bootea normalmente y, en su primer render, `pushNavigation.ts` ya tiene el destino (lo leyó de `window.location.search` al importarse).

Con la **app ya abierta**, `notificationclick` hace `client.focus()` y **no** `client.navigate()` -- `navigate()` fuerza una navegación real (aunque sea al mismo origen) y recargaría toda la SPA solo para cambiar un query string que la app puede perfectamente interpretar sin perder su estado en memoria. En su lugar, el service worker le manda un `postMessage({ type: 'OPEN_PUSH_DESTINATION', url: targetPath })` a esa pestaña; `pushNavigation.ts` lo escucha, lo parsea con la misma `parsePushDestination`, y actualiza el mismo store que consume `App.tsx` -- sin reload. Es una única estrategia consistente para "app abierta", no dos caminos que puedan divergir.

### Cuándo se aplica el destino: nunca antes de que la app esté lista

`App.tsx` solo intenta aplicar un destino pendiente cuando `bootPhase === 'ready'` -- es decir, después de que Clerk cargó, el usuario está autenticado, y `/me`, `/me/matches`, `/me/pending-tasks` y `/me/invitations` ya respondieron. Mientras tanto el destino sigue ahí, sin perderse ni reintentarse antes de tiempo.

**Sesión vencida:** si se toca una push con la sesión caída, la app arranca en Login con el `?open=...` todavía en la URL -- nada lo toca mientras `currentView === 'login'`, porque el efecto que consume el destino está condicionado a `bootPhase === 'ready'`, que nunca se alcanza sin sesión. Una vez que el usuario inicia sesión y el boot completa, el mismo efecto corre y aplica el destino que seguía esperando en la URL. No hace falta guardarlo aparte en `sessionStorage`: la URL nunca cambió durante todo el login (es una sola SPA, sin navegación real de por medio), así que "dejarlo en la URL hasta consumirlo" sale gratis con esta arquitectura.

### Resolución de un partido: 404 y 403 nunca dejan una pantalla en blanco

Para los cuatro destinos de partido (`MATCH_SUMMARY`/`MATCH_PLAYERS`/`MATCH_CHAT`/`MATCH_RATINGS`), `App.tsx` primero busca el `matchId` en el estado local `matches` (ya cargado desde `/me/matches` -- el caso normal, porque cualquier evento que dispara una push implica que el destinatario ya es organizador o participante). Si no está ahí, hace `GET /api/v1/matches/:matchId` como respaldo. Ese fetch nunca lanza sin manejar:

- `404` → `"El partido ya no está disponible."`
- `403` → `"No tenés acceso a este partido."` (este endpoint hoy no restringe acceso por usuario, así que en la práctica actual nunca devuelve 403 -- el manejo queda ahí como defensa en profundidad, no porque sea alcanzable hoy)
- cualquier otro error → `"No pudimos abrir el partido. Reintentá."`

En los tres casos, `App.tsx` muestra el mensaje en el `Snackbar` global (el mismo que ya usan otras acciones fallidas) y navega a Home -- nunca deja `currentView` en un estado sin pantalla.

### Limpieza de URL y anti-doble-ejecución

Después de aplicar un destino (con éxito o con error), `App.tsx` siempre llama a `clearPendingPushDestination()` dentro de un `finally`. Esto hace dos cosas a la vez: limpia la URL (`history.replaceState`, sin reload) y pone el store en `null`, así que:

- refrescar la página después de aplicar un deep link no lo vuelve a aplicar (la URL ya está limpia);
- el mismo destino no se procesa dos veces aunque el componente se vuelva a renderizar (el store ya no tiene nada pendiente).

### `HOME_INVITATIONS`: por qué no abre una pantalla nueva

Para este MVP, `HOME_INVITATIONS` no navega a una pantalla de invitaciones separada -- lleva a Home (donde la sección "Invitaciones" ya muestra cada invitación pendiente completa, con Aceptar/Rechazar) y, si el payload trae `invitationId`, hace scroll automático hasta esa tarjeta puntual y la resalta un par de segundos (`highlightInvitationId` en `HomePage.tsx`). Evita mandar al usuario a una pantalla secundaria cuando la información ya está completa en Home.

---

### Usuarios sin suscripción

No tener ninguna `PushSubscription` es el caso normal para la mayoría de los usuarios la mayor parte del tiempo, no un error: `recordAndSendPushEvent` lo trata como un no-op silencioso (sin logs por usuario, para no llenar la consola de warnings repetitivos) — solo loguea si el propio servidor no tiene VAPID configurado (una vez, no por destinatario) o si ocurre algo verdaderamente inesperado.

---

## Limpieza de suscripciones expiradas (404/410)

Cuando el push service del navegador responde `404` o `410` al intentar enviar (el usuario desinstaló, borró datos del sitio, o la suscripción simplemente venció), `push.service.ts` **borra esa fila automáticamente** — no queda como basura acumulándose. Un fallo de red genérico (no 404/410) **no** borra la suscripción: se reintenta la próxima vez que se envíe algo, y **nunca aborta el envío a las otras suscripciones del mismo usuario** (cada una se envía de forma independiente).

---

## Manejo de permisos

| Estado (`Notification.permission`) | Perfil muestra | Banner en Home | Comportamiento |
|---|---|---|---|
| `default` | "Desactivadas" | "Activá las notificaciones" | Botón "Activar notificaciones" |
| `granted` + suscripción activa en este dispositivo | "Activadas" | No se muestra | "Desactivar" y "Enviar prueba" disponibles en Perfil |
| `granted` sin suscripción en este dispositivo (ver abajo) | "Desactivadas" | "Ya diste permiso, pero falta completar la activación en este dispositivo." | Botón "Completar activación" (nunca vuelve a pedir permiso) |
| `denied` | "Bloqueadas" | No se muestra (nunca insiste en Home) | Perfil: "Las notificaciones están bloqueadas en el navegador. Podés habilitarlas desde la configuración del sitio." Ningún botón vuelve a llamar `requestPermission()` — los navegadores no vuelven a preguntar una vez bloqueado. |
| API no disponible (`Notification`/`PushManager`/`serviceWorker` ausentes) | "No compatibles" | No se muestra | Sin acciones |

`Notification.requestPermission()` **solo se llama al tocar un botón** ("Activar notificaciones" o "Completar activación") — nunca automáticamente al cargar la app.

**`granted` sin suscripción registrada en el backend:** si el navegador ya tiene permiso pero no hay una suscripción local (nunca se llegó a suscribir en este dispositivo, o el backend perdió esa fila), el hook lo detecta en el montaje (`reconcile()` en `usePushNotifications.ts`, expuesto como `reconciling` mientras el chequeo está en curso, para que el banner nunca parpadee mostrando el CTA a alguien que en realidad ya está activado). En ese caso el banner ofrece "Completar activación", que reutiliza el mismo `enable()` -- como el permiso ya está `granted`, `requestPermission()` resuelve al instante sin volver a preguntarle nada al usuario, y el flujo sigue directo a `subscribe()` + guardar en el backend.

### Ratings inline en Jugadores

La solapa **Jugadores** de un partido (`MatchPlayersPage.tsx`) muestra, para el organizador y cada participante confirmado, las mismas estrellas de juego/conducta y el mismo conteo de valoraciones/comentarios que ya se veían en **Candidatos** -- ahora vía un componente compartido, `PlayerRatingsSummary.tsx` (antes vivía duplicado dentro de `MatchCandidatesSection.tsx` como `CandidateRatingsSummary`). Tocar la fila de un jugador abre el mismo `PlayerProfileCardDialog` que Candidatos, con acceso a `PlayerRatingCommentsDialog` para ver los comentarios completos -- invitaciones pendientes/rechazadas no tienen estrellas ni son tocables (todavía no jugaron ese partido).

Esto es lo que hace que el destino `MATCH_PLAYERS` de `RATING_RECEIVED` (ver arriba) tenga sentido: tocar "Recibiste una nueva valoración" lleva directo a la lista donde esa valoración (agregada al promedio) ya es visible.

Backend: `GET /api/v1/matches/:matchId/participants` ahora agrega `ratings: RatingsSummaryDto` al organizador y a cada confirmado, usando la misma `getRatingsSummaries` (una consulta agrupada, nunca N+1) que ya usaba la lista de candidatos -- sin duplicar esa lógica de agregación.

---

## Instalación en iPhone (iOS)

Web Push en iOS **requiere que Rondo esté agregada a la pantalla de inicio** (Safari normal, sin instalar, no lo soporta — típicamente ni siquiera expone `Notification`/`PushManager`). Además:

- el permiso debe pedirse desde una interacción real del usuario (un tap en "Activar"), nunca automáticamente;
- requiere iOS/iPadOS 16.4+;
- debe abrirse **desde el ícono instalado**, no desde una pestaña de Safari.

Si el usuario está en iPhone y todavía no instaló la app, el banner de activación muestra en su lugar:

> Para recibir notificaciones en iPhone, primero agregá Rondo a tu pantalla de inicio.

y no ofrece "Activar" — pedir permiso antes de instalar no tendría efecto útil en iOS. Ver la guía de instalación ya existente en `docs/PWA.md#instalación-en-iphone-ios-safari`.

## Android / Chrome

Funciona tanto en el navegador normal como instalado como PWA — se recomienda instalar para una mejor experiencia, pero no es obligatorio como en iOS. Confirmar la recepción con la app cerrada/minimizada es parte de la validación manual (ver abajo): un push real debe llegar igual aunque Rondo no esté abierta, porque lo entrega el service worker en segundo plano.

---

## Prueba manual (obligatoria antes de dar por cerrado este slice)

**No se afirma que esto se haya ejecutado contra un dispositivo físico real como parte de la entrega de código** — es el checklist a correr antes de considerarlo validado en producción, igual que la sección equivalente de `docs/PWA.md`.

### Android Chrome

- [ ] Abrir Rondo, iniciar sesión.
- [ ] Activar notificaciones desde el banner o desde Perfil.
- [ ] Aceptar el permiso del navegador.
- [ ] "Enviar prueba" desde Perfil → confirmar que la notificación aparece.
- [ ] Minimizar/cerrar Rondo.
- [ ] "Enviar prueba" de nuevo (o repetir desde otra pestaña/dispositivo) → confirmar que llega igual con la app cerrada.
- [ ] Tocar la notificación → confirmar que abre/enfoca Rondo.
- [ ] Desactivar desde Perfil → confirmar que una prueba posterior ya no llega.

### iPhone

- [ ] Agregar Rondo a la pantalla de inicio (ver `docs/PWA.md`).
- [ ] Abrir **desde el ícono instalado** (no desde Safari).
- [ ] Iniciar sesión, activar notificaciones, aceptar el permiso.
- [ ] "Enviar prueba" → confirmar recepción.
- [ ] Minimizar → repetir prueba → confirmar recepción con la app en background.
- [ ] Tocar la notificación → confirmar que abre Rondo.

### Dos usuarios (eventos de dominio)

Con ambos dispositivos/navegadores logueados y notificaciones activadas:

- [ ] Usuario A crea un partido e invita a B → B recibe "Nueva invitación".
- [ ] B acepta → A recibe "Invitación aceptada"; cualquier otro participante ya confirmado recibe "Nuevo jugador confirmado" (B no recibe nada sobre su propia aceptación).
- [ ] Completar el último cupo → todos los confirmados reciben "Equipo completo"; refrescar la app no genera una segunda notificación.
- [ ] Enviar un mensaje de chat → todos menos el autor lo reciben.
- [ ] Cancelar el partido → confirmados y pendientes reciben "Partido cancelado"; no se duplica.
- [ ] Para "Valoraciones habilitadas": usar un partido con `endsAt` ya pasado y volver a abrirlo (Home, o su detalle) — la resolución es lazy (ver [`MATCH_COMPLETED_RATINGS_ENABLED` es 100% lazy](#match_completed_ratings_enabled-es-100-lazy-durante-la-beta)), así que la notificación sale recién en ese momento; confirmar que no se duplica al volver a abrirlo.
- [ ] A valora a B → B recibe "Nueva valoración" ("Recibiste una nueva valoración en {deporte}."), sin estrellas ni comentario visibles en la notificación; A no recibe nada. Editar la misma valoración no reenvía el push.
- [ ] Tocar cada notificación (app cerrada) → confirmar que abre Rondo directo en la pantalla/solapa correcta según la tabla de [Eventos de dominio](#eventos-de-dominio) (no solo Home), y que la URL vuelve a `/` sola.
- [ ] Con Rondo ya abierta en otra pestaña, tocar una notificación → confirmar que esa pestaña se enfoca y navega sin recargar (no un flash de recarga completa).
- [ ] Tocar "Recibiste una nueva valoración" → confirmar que abre la solapa Jugadores del partido y que las estrellas/comentarios de B ya reflejan la valoración de A ahí mismo.

---

## Troubleshooting

- **"No pudimos activar las notificaciones"**: revisar la consola del navegador; la causa más común es `VITE_VAPID_PUBLIC_KEY` mal configurada (o ausente) en el build del frontend — `pushManager.subscribe()` falla si `applicationServerKey` no es una VAPID key válida.
- **`PUSH_NOT_CONFIGURED` (500) al enviar la prueba**: el backend no tiene `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` cargadas (dev local sin `.env`, o Render sin las variables) — configurarlas y reiniciar el proceso.
- **Notificación nunca llega pero "Enviada" no dio error**: el push service (Chrome/Firefox/Apple) puede demorar segundos; si persiste, revisar que el `endpoint` no haya quedado huérfano — el próximo intento lo limpia solo si el push service responde 404/410.
- **Permiso bloqueado por error**: no hay forma de que la app "desbloquee" `denied` — el usuario tiene que habilitarlo manualmente desde la configuración del sitio en su navegador (el mensaje en Perfil se lo indica).
- **Un usuario ve las notificaciones de otro en un dispositivo compartido**: no debería pasar con este slice — ver la sección de reasignación por `endpoint` arriba; si ocurre, confirmar que ambos usuarios efectivamente tocaron "Activar" con sus propias sesiones (la reasignación solo ocurre al volver a suscribirse, no automáticamente).
- **Tocar la notificación solo abre Home, no la pantalla correcta**: revisar que `payload.url` realmente traiga `?open=...` (ver [Deep linking](#deep-linking)) -- si el usuario instaló la PWA hace tiempo con una versión anterior de `sw.ts`, puede tener el service worker viejo todavía activo; forzar una actualización (`UpdatePrompt`, o desinstalar/reinstalar) resuelve eso.
- **El deep link abre la pantalla equivocada o queda en blanco**: si el `matchId` no está en `/me/matches` del usuario, la app hace un fetch de respaldo (`GET /api/v1/matches/:matchId`); un 404 real ahí (partido borrado, id inventado) siempre cae a Home con un mensaje, nunca a una pantalla vacía -- ver [Resolución de un partido](#resolución-de-un-partido-404-y-403-nunca-dejan-una-pantalla-en-blanco).

---

## Limitaciones

- No hay lista de dispositivos en la UI (el backend ya soporta varias suscripciones por usuario, pero Perfil solo muestra un estado agregado para el dispositivo actual, no "tenés push activo en 3 dispositivos, ver cuáles").
- No hay preferencias por tipo de notificación, ni horarios de silencio, ni "silenciar este partido" — el chat en particular notifica *cada* mensaje sin excepción; el propio pedido original ya marca esto como una necesidad futura, no un descuido.
- No hay historial de notificaciones ni centro de notificaciones dentro de la app -- solo el deep link al tocar la notificación del sistema operativo (ver [Deep linking](#deep-linking)); no queda un registro navegable de push pasadas.
- No hay reintentos automáticos de envío más allá de lo que ya hace `web-push` internamente por request -- una falla no-404/410 simplemente no reintenta hasta el próximo evento real.
- `MATCH_COMPLETED_RATINGS_ENABLED` es puramente lazy durante la beta (sin job programado, ver [arriba](#match_completed_ratings_enabled-es-100-lazy-durante-la-beta)): si nadie vuelve a abrir un partido después de que terminó, la notificación de "ya podés valorar" no sale hasta que alguien lo haga. Deliberado para este slice, no un descuido.
- El 403 documentado en [Resolución de un partido](#resolución-de-un-partido-404-y-403-nunca-dejan-una-pantalla-en-blanco) es defensivo: `GET /api/v1/matches/:matchId` no tiene hoy una regla de negocio que lo devuelva.
- No se probó en un dispositivo físico real como parte de esta entrega (ver checklists de arriba).

## Fuera de alcance de este slice

Recordatorio antes del partido, notificaciones de reservas, confirmación al autor de que su valoración se envió correctamente (a diferencia de `RATING_RECEIVED`, que avisa al jugador *valorado*, y de "ya podés valorar", ambas ya implementadas), notificaciones administrativas de clubes, preferencias por evento/silenciamiento de chat, horarios silenciosos, agrupación avanzada, badges nativos, emails, SMS, Firebase, OneSignal, analytics de entrega, historial/centro de notificaciones, URLs públicas permanentes de partidos, React Router, cualquier mecanismo de cron/scheduler/proceso programado (ver arriba).

## Próximo slice

Con los nueve eventos de [Eventos de dominio](#eventos-de-dominio) ya conectados y el deep linking resuelto (ver [Deep linking](#deep-linking)), lo que sigue (no en este slice, ver [Fuera de alcance](#fuera-de-alcance-de-este-slice)) es: recordatorio antes del partido, preferencias por tipo de evento (empezando por poder silenciar el chat, el caso más ruidoso), un centro/historial de notificaciones dentro de la app, y -- si el volumen de partidos lo justifica más adelante -- algún mecanismo programado para que `MATCH_COMPLETED_RATINGS_ENABLED` no dependa de que alguien vuelva a abrir un partido ya terminado. `recordAndSendPushEvent`/`sendPushToUser` (`pushEvents.service.ts`/`push.service.ts`) ya son genéricos y reutilizables -- conectar un evento nuevo no debería requerir tocar la infraestructura, solo agregar el copy (incluido el destino) en `pushCopy.ts` y la llamada en el service correspondiente.
