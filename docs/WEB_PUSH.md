# Web Push

Rondo puede enviar notificaciones push del navegador/sistema operativo a los dispositivos donde un usuario las activó. Este documento cubre **solo la infraestructura**: activar/desactivar, guardar la suscripción, y una notificación de prueba. Todavía no dispara push automáticamente ante eventos reales (invitaciones, cancelaciones, chat, etc.) — ver [Fuera de alcance de este slice](#fuera-de-alcance-de-este-slice) y [Próximo slice](#próximo-slice-eventos-reales) al final.

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

Backend envía una notificación (hoy: solo el botón "Enviar prueba")
  → busca las PushSubscription del usuario
  → web-push.sendNotification(subscription, payload, { vapid keys })
  → si el push service responde 404/410 → esa suscripción quedó inválida → se borra

Service Worker (src/sw.ts)
  → evento "push" → self.registration.showNotification(...)
  → evento "notificationclick" → enfoca una pestaña de Rondo existente, o abre una nueva
```

Piezas nuevas de este slice:

```text
apps/backend/prisma (schema.prisma + migración)  # tabla push_subscriptions
apps/backend/src/modules/push/push.service.ts     # guardar/listar/borrar/enviar, configuración VAPID
apps/backend/src/modules/push/push.controller.ts  # GET/POST/DELETE .../push-subscriptions, POST .../test
apps/backend/src/config/env.ts                    # VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
packages/contracts/src/index.ts                   # PushSubscriptionInputDto, PushSubscriptionStatusDto, TestPushResponseDto, PushNotificationPayloadDto

apps/frontend/src/sw.ts                       # service worker (injectManifest -- ver más abajo), push + notificationclick
apps/frontend/src/usePushNotifications.ts     # hook: supported, permission, enabled, enable(), disable(), sendTest()
apps/frontend/src/PushNotificationsBanner.tsx # CTA contextual "Activá las notificaciones", descartable 7 días
apps/frontend/src/PushNotificationsSettings.tsx # sección "Notificaciones" en Editar perfil
apps/frontend/src/runtimeConfig.ts            # VITE_VAPID_PUBLIC_KEY
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

## Limpieza de suscripciones expiradas (404/410)

Cuando el push service del navegador responde `404` o `410` al intentar enviar (el usuario desinstaló, borró datos del sitio, o la suscripción simplemente venció), `push.service.ts` **borra esa fila automáticamente** — no queda como basura acumulándose. Un fallo de red genérico (no 404/410) **no** borra la suscripción: se reintenta la próxima vez que se envíe algo, y **nunca aborta el envío a las otras suscripciones del mismo usuario** (cada una se envía de forma independiente).

---

## Manejo de permisos

| Estado (`Notification.permission`) | Perfil muestra | Comportamiento |
|---|---|---|
| `default` | "Desactivadas" | Banner y botón "Activar" disponibles |
| `granted` + suscripción activa en este dispositivo | "Activadas" | "Desactivar" y "Enviar prueba" disponibles |
| `denied` | "Bloqueadas" | "Las notificaciones están bloqueadas en el navegador. Podés habilitarlas desde la configuración del sitio." Ningún botón vuelve a llamar `requestPermission()` — los navegadores no vuelven a preguntar una vez bloqueado, y la app no simula lo contrario. |
| API no disponible (`Notification`/`PushManager`/`serviceWorker` ausentes) | "No compatibles" | Sin acciones |

`Notification.requestPermission()` **solo se llama al tocar "Activar"** — nunca automáticamente al cargar la app (`usePushNotifications`'s mount effect solo reconcilia una suscripción *ya* `granted` y existente, jamás pide permiso).

**`granted` sin suscripción registrada en el backend:** si el navegador ya tiene permiso y una suscripción local (de una sesión anterior, o porque el backend perdió esa fila), el hook la vuelve a mandar automáticamente al backend en el montaje (`reconcile()` en `usePushNotifications.ts`) — sin volver a pedir permiso ni crear una suscripción nueva.

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

---

## Troubleshooting

- **"No pudimos activar las notificaciones"**: revisar la consola del navegador; la causa más común es `VITE_VAPID_PUBLIC_KEY` mal configurada (o ausente) en el build del frontend — `pushManager.subscribe()` falla si `applicationServerKey` no es una VAPID key válida.
- **`PUSH_NOT_CONFIGURED` (500) al enviar la prueba**: el backend no tiene `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` cargadas (dev local sin `.env`, o Render sin las variables) — configurarlas y reiniciar el proceso.
- **Notificación nunca llega pero "Enviada" no dio error**: el push service (Chrome/Firefox/Apple) puede demorar segundos; si persiste, revisar que el `endpoint` no haya quedado huérfano — el próximo intento lo limpia solo si el push service responde 404/410.
- **Permiso bloqueado por error**: no hay forma de que la app "desbloquee" `denied` — el usuario tiene que habilitarlo manualmente desde la configuración del sitio en su navegador (el mensaje en Perfil se lo indica).
- **Un usuario ve las notificaciones de otro en un dispositivo compartido**: no debería pasar con este slice — ver la sección de reasignación por `endpoint` arriba; si ocurre, confirmar que ambos usuarios efectivamente tocaron "Activar" con sus propias sesiones (la reasignación solo ocurre al volver a suscribirse, no automáticamente).

---

## Limitaciones

- No hay lista de dispositivos en la UI (el backend ya soporta varias suscripciones por usuario, pero Perfil solo muestra un estado agregado para el dispositivo actual, no "tenés push activo en 3 dispositivos, ver cuáles").
- No hay preferencias por tipo de notificación, ni horarios de silencio, ni "silenciar este partido" — todo eso queda para cuando exista más de un tipo de push real.
- No hay deep links reales: el único payload que este slice envía usa `url: "/"`. Conectar eventos reales (próximo slice) requiere decidir primero cómo Rondo navega a una pantalla específica (hoy usa estado interno de React, no rutas de URL) antes de poder abrir "directo a la invitación X".
- No hay reintentos automáticos de envío más allá de lo que ya hace `web-push` internamente por request.
- No se probó en un dispositivo físico real como parte de esta entrega (ver checklist de arriba).

## Fuera de alcance de este slice

Firebase, OneSignal, WebSockets, badge count nativo, agrupación avanzada de notificaciones, analytics de entrega — y, más importante, **ningún evento de negocio dispara push todavía** (invitaciones, cancelaciones, chat, ratings, reservas). Ver la sección siguiente.

## Próximo slice: eventos reales

`sendPushToUser(userId, payload)` (`push.service.ts`) ya es genérico y reutilizable — no tiene nada específico de "prueba"; `sendTestNotification` es solo un caller más. El próximo slice conecta, en este orden sugerido:

1. Invitación recibida.
2. Partido cancelado.
3. Invitación aceptada/rechazada.

Notificaciones de chat quedan para una fase posterior: necesitan preferencias y algún control de volumen (no todos los mensajes deberían generar un push), que no existen todavía.
