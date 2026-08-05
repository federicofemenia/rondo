# PWA

Rondo es instalable como Progressive Web App: se puede agregar a la pantalla de inicio en Android e iPhone, abre en modo standalone (sin barra del navegador), tiene un service worker con actualización controlada por el usuario, y un fallback básico cuando no hay conexión. Este documento describe esa capa. La suscripción del dispositivo y el envío de notificaciones (Web Push) están documentados aparte en [`docs/WEB_PUSH.md`](./WEB_PUSH.md) — ahí también está el detalle de por qué el service worker pasó de `generateSW` a `injectManifest`.

---

## Arquitectura

```text
vite-plugin-pwa (workbox-build, estrategia injectManifest)
  → manifest.webmanifest (generado desde src/pwaManifest.ts)
  → src/sw.ts (service worker escrito a mano, precache + push + notificationclick)
  → sw.js + workbox-<hash>.js (generados en el build, en apps/frontend/dist)
```

El plugin corre solo durante `vite build` (nunca en `vite dev` ni en los tests: `devOptions.enabled` queda sin configurar, que es `false` por defecto). En desarrollo local no hay service worker registrado — evita el problema clásico de "por qué sigo viendo la versión vieja" mientras se itera.

Archivos relevantes:

```text
apps/frontend/vite.config.ts       # configuración de VitePWA
apps/frontend/src/pwaManifest.ts   # el manifest en sí, importado por vite.config.ts y testeado directo
apps/frontend/index.html           # meta tags (theme-color, apple-*, favicon, viewport)
apps/frontend/public/              # iconos (pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png, apple-touch-icon.png, favicon.ico)
apps/frontend/src/useOnlineStatus.ts       # hook: navigator.onLine + eventos online/offline
apps/frontend/src/pwaDisplayMode.ts        # detección: standalone, iOS, iOS Safari
apps/frontend/src/useInstallPrompt.ts      # hook: wrapea beforeinstallprompt
apps/frontend/src/installDismissal.ts      # helper: descarte con expiración de 7 días en localStorage
apps/frontend/src/InstallRondoBanner.tsx   # banner de instalación (Android/Chrome/Edge)
apps/frontend/src/IosInstallGuide.tsx      # guía de instalación manual (iOS Safari)
apps/frontend/src/UpdatePrompt.tsx         # aviso de nueva versión (virtual:pwa-register/react)
apps/frontend/src/OfflineBanner.tsx        # franja discreta "Sin conexión" (no bloquea la app)
apps/frontend/src/OfflineScreen.tsx        # pantalla completa "Sin conexión" (solo si todavía no cargó nada)
apps/frontend/src/PwaChrome.tsx            # agrupa los cuatro anteriores, montado una vez en main.tsx
```

`PwaChrome` se monta en `main.tsx`, como hermano de `<App />` (no adentro) — así funciona incluso en la pantalla de login, antes de que `isSignedIn` sea `true`.

---

## Manifest

Fuente única de verdad: `apps/frontend/src/pwaManifest.ts` (testeado en `tests/pwaManifest.test.ts`, sin necesitar un build real). Se lo pasa tal cual a `VitePWA({ manifest: pwaManifest })`.

```json
{
  "name": "Rondo",
  "short_name": "Rondo",
  "description": "Organizá partidos, invitá jugadores y coordiná con tu equipo.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0B0D0F",
  "theme_color": "#0B0D0F",
  "lang": "es-AR"
}
```

`background_color`/`theme_color` son el `background.default` real del tema (`apps/frontend/src/theme.ts`), no un color inventado — es el mismo fondo casi negro que ya usa toda la app.

### Iconos

Generados a partir del logo existente (`src/assets/logo-icon.png`, el isotipo "R"), compuestos sobre el mismo `#0B0D0F` para que no aparezcan con halos blancos en launchers claros:

| Archivo | Tamaño | Uso |
|---|---|---|
| `public/pwa-192x192.png` | 192×192 | icono estándar (`purpose: any`) |
| `public/pwa-512x512.png` | 512×512 | icono estándar (`purpose: any`) |
| `public/maskable-icon-512x512.png` | 512×512 | icono maskable (`purpose: maskable`) — el logo ocupa ~50% del lienzo para sobrevivir cualquier recorte (círculo, squircle) que le aplique el SO |
| `public/apple-touch-icon.png` | 180×180 | `<link rel="apple-touch-icon">`, sin transparencia (iOS renderiza un fondo negro si la tiene) |
| `public/favicon.ico` | 16/32/48 multi-res | pestaña del navegador |

No se usaron logos de terceros ni se rediseñó la marca — son recortes/composiciones del isotipo ya existente.

### Meta tags manuales (`index.html`)

`vite-plugin-pwa` solo inyecta automáticamente `<link rel="manifest">` durante el build. Todo lo demás está agregado a mano en `index.html`, porque el plugin no lo cubre:

```html
<meta name="theme-color" content="#0B0D0F" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<meta name="apple-mobile-web-app-title" content="Rondo" />
```

`apple-mobile-web-app-status-bar-style` es `black` (barra de estado opaca) y no `black-translucent`: la app no maneja `env(safe-area-inset-top)` en todas las pantallas todavía, así que `black-translucent` (contenido debajo de la barra de estado) podría tapar contenido. Es un ajuste seguro por ahora, no una limitación de la librería.

`viewport-fit=cover` está en el `<meta name="viewport">` porque los banners (`InstallRondoBanner`, `IosInstallGuide`, `UpdatePrompt`) usan `env(safe-area-inset-bottom)` para no quedar debajo del home indicator de iPhone.

---

## Service Worker

Estrategia: `injectManifest` (`apps/frontend/src/sw.ts`, escrito a mano) con `registerType: 'prompt'`. Antes de la fase de Web Push era `generateSW` (Workbox generaba el service worker completo, sin `sw.ts`); se migró porque `generateSW` no tiene forma de agregar los listeners `push`/`notificationclick` que Web Push necesita — ver [`docs/WEB_PUSH.md`](./WEB_PUSH.md#service-worker-generatesw--injectmanifest) para el detalle completo de esa migración. Sigue habiendo un único service worker, registrado exactamente igual que antes.

```ts
// apps/frontend/vite.config.ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectRegister: false,      // el registro lo maneja UpdatePrompt.tsx a mano, vía el hook
  registerType: 'prompt',
  manifest: pwaManifest,
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
  },
})
```

```ts
// apps/frontend/src/sw.ts (resumen -- ver el archivo real para push/notificationclick)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
```

### Qué se precachea

Solo el app shell — todo lo que sale del propio build de Vite: `index.html`, el JS y CSS con hash, los iconos de `public/`, y las fuentes de `@fontsource/inter` (bundleadas localmente, no vienen de un CDN externo). 73 entradas, ~2.1 MB en el build actual.

### Qué NO se cachea, y por qué no hace falta ninguna regla especial

No hay ningún `runtimeCaching` configurado. Eso es intencional:

- **`/api/v1/*`**: en todo despliegue real, el backend vive en un dominio distinto al frontend (Vercel vs. Render — ver `docs/BETA_DEPLOYMENT.md`), así que ni siquiera es el mismo origin que el service worker controla por defecto. No hay ninguna entrada de `runtimeCaching` que lo capture, así que esas requests pasan derecho a la red, sin pasar por ningún cache.
- **Clerk**: mismo caso — dominio propio de Clerk, ningún patrón lo referencia.
- **Tokens, headers `Authorization`, datos personales, mensajes de chat, invitaciones, perfiles**: nunca tocan Cache Storage porque viajan dentro de esas mismas respuestas de `/api/v1/*` sin cachear.

`navigateFallbackDenylist: [/^\/api\//]` es una segunda barrera, aunque en la práctica `navigateFallback` solo aplica a *navegaciones* (`mode: 'navigate'`, o sea cargar una URL en la barra de direcciones), nunca a los `fetch()` que hace `apiClient.ts` — así que esta regla es defensiva, no la que hace el trabajo principal.

### Fallback SPA (`navigateFallback`)

`navigateFallback: '/index.html'` con el denylist de `/api/` de arriba: si el usuario navega a una URL que no es un archivo precacheado (hoy la app no tiene rutas reales en la URL, todo es estado interno de React — ver `docs/BETA_DEPLOYMENT.md#spa-routing`), el service worker sirve `index.html` desde el cache en vez de fallar. Esto es aparte del rewrite catch-all de `/vercel.json` — ese rewrite solo ayuda cuando hay conexión a Vercel; el `navigateFallback` del service worker es lo que permite que la app abra *sin conexión* después de haber sido cargada al menos una vez.

### Actualización (`SKIP_WAITING`)

Con `generateSW` este listener lo agregaba automáticamente vite-plugin-pwa; con `injectManifest` está escrito a mano en `sw.ts` (mismo comportamiento, ver arriba). `UpdatePrompt.tsx` es lo único que dispara ese mensaje, y solo cuando el usuario toca "Actualizar" — ver la sección de abajo.

---

## Instalación en Android / Chrome / Edge

`InstallRondoBanner.tsx` escucha el evento real `beforeinstallprompt` (nunca asume que la app es instalable — si el navegador no lo dispara, el banner no aparece). Reglas:

- Solo se muestra si `beforeinstallprompt` disparó (`useInstallPrompt`) **y** la app no está corriendo en modo standalone (`isStandaloneDisplayMode()`).
- "Instalar" llama a `event.prompt()` y espera `event.userChoice`; si el resultado es `dismissed`, se guarda el descarte igual que "Ahora no".
- "Ahora no" guarda `Date.now()` en `localStorage` (`rondo-install-banner-dismissed-at`) y el banner no vuelve a aparecer hasta que pasen 7 días (`installDismissal.ts`).
- El evento `appinstalled` limpia el estado interno apenas se instala, sin esperar a la próxima carga.

---

## Instalación en iPhone (iOS Safari)

iOS Safari nunca dispara `beforeinstallprompt` — no hay API nativa para engancharse. `IosInstallGuide.tsx` en cambio hace *feature detection* (no parseo frágil de user-agent más allá de lo necesario) vía `pwaDisplayMode.ts`:

- `isIosDevice()`: user-agent de iPhone/iPad, o `navigator.platform === 'MacIntel'` con `maxTouchPoints > 1` (así reporta iPadOS 13+).
- `isIosSafariBrowser()`: Safari real, no Chrome/Firefox/Edge sobre iOS (esos tampoco pueden instalar así, así que no tiene sentido mostrarles la guía).
- Se oculta con `isStandaloneDisplayMode()` igual que el banner de Android — ahí, además del `matchMedia('(display-mode: standalone)')` estándar, entra `navigator.standalone`, que es la única señal que expone iOS.

La guía muestra los 3 pasos (Compartir → Agregar a pantalla de inicio → Abrir desde el icono), se puede cerrar, y reutiliza el mismo mecanismo de descarte de 7 días (`rondo-ios-install-guide-dismissed-at`) que el banner de Android, por consistencia.

---

## Actualización de la PWA

`UpdatePrompt.tsx` usa el hook `useRegisterSW` de `virtual:pwa-register/react` (el módulo virtual que expone vite-plugin-pwa para React):

```tsx
const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
```

Cuando hay una versión nueva esperando, `needRefresh` pasa a `true` y se muestra:

> Nueva versión disponible
> Hay una nueva versión de Rondo disponible.
> [Actualizar]

Tocar "Actualizar" llama a `updateServiceWorker(true)`, que le manda `SKIP_WAITING` al nuevo service worker y recarga la página **una sola vez** (lo maneja la librería internamente — no hay lógica de reload propia acá, así que no hay riesgo de loop). El botón de cerrar (ícono ✕) solo oculta el aviso localmente (`setNeedRefresh(false)`); si se recarga la página más tarde, el nuevo service worker de todas formas toma control en algún momento natural del ciclo de vida.

No hay actualización silenciosa/automática — `registerType: 'prompt'` (no `autoUpdate`) es deliberado: evita que queden mezclados JS/CSS de un build viejo con un `index.html` de un build nuevo mientras el usuario tiene la pestaña abierta.

---

## Offline básico

Dos piezas separadas, para dos situaciones distintas:

- **`OfflineBanner.tsx`**: franja discreta y fija arriba de todo ("Sin conexión"), montada siempre (vía `PwaChrome`), en cualquier pantalla. No bloquea ni reemplaza el contenido que ya esté en pantalla — si Home ya cargó los partidos, se quedan visibles, solo aparece la franja arriba.
- **`OfflineScreen.tsx`**: pantalla completa, mostrada solo desde `App.tsx` cuando el usuario está autenticado pero **todavía no cargó nada** (`bootPhase !== 'ready'`) y el dispositivo está offline. Mensaje:

  > Sin conexión
  > Rondo necesita conexión para actualizar partidos, invitaciones y mensajes.
  > [Reintentar]

  "Reintentar" dispara el mismo `bootRetryToken` que ya usa el flujo de backend-dormido (`apiRetry.ts`) — no es un mecanismo nuevo, reutiliza el existente.

Ninguna de las dos simula datos ni muestra contenido viejo como si fuera actual: si no hay red, no hay actualización de partidos/invitaciones/mensajes, y la UI lo dice explícitamente en vez de quedarse con lo último que se vio como si siguiera vigente.

**No hay edición offline ni cola de mutaciones** — si el usuario intenta una acción que pega al backend mientras está offline, esa request simplemente falla (el manejo de errores normal de `apiClient.ts` se hace cargo), no queda nada guardado para reintentar después.

### `useOnlineStatus`

```ts
export function useOnlineStatus(): boolean
```

Escucha `navigator.onLine` + los eventos `online`/`offline` del `window`. Deliberadamente separado de `bootPhase` (el estado que ya existía en `App.tsx` para el backend de Render dormido): un dispositivo puede estar online con el backend todavía despertándose, o estar offline con un backend que de otra forma respondería bien. Mezclar ambas señales mostraría el mensaje equivocado en cualquiera de los dos casos — por eso `App.tsx` chequea `!isOnline` *antes* de mirar `bootPhase === 'failed'`.

---

## Limitaciones

- No hay background sync. Web Push sí existe (infraestructura de activación/desactivación/prueba, ver [`docs/WEB_PUSH.md`](./WEB_PUSH.md)), pero todavía no dispara ante eventos reales de negocio (invitaciones, cancelaciones, chat) — ver las limitaciones de ese documento.
- No hay cache de datos de negocio (partidos, invitaciones, chat) — solo el app shell.
- No hay funcionamiento offline completo: sin conexión, la app *abre* (si ya se cargó antes) pero no puede leer ni escribir datos reales.
- No hay edición offline ni cola de mutaciones pendientes.
- El banner de instalación de Android depende pura y exclusivamente de que el navegador dispare `beforeinstallprompt` — algunos navegadores Chromium tienen su propia heurística de "engagement" antes de disparar el evento, fuera del control de la app.
- `apple-mobile-web-app-status-bar-style: black` (no `black-translucent`) hasta que se audite `env(safe-area-inset-top)` en todas las pantallas.

---

## Cómo verificar Lighthouse

```bash
pnpm build:frontend
pnpm --filter @rondo/frontend preview
```

Abrir la URL que imprime `vite preview` (por defecto `http://localhost:4173`) en Chrome, DevTools → Lighthouse → categoría "Progressive Web App" (o el checklist de instalabilidad en versiones más nuevas de Chrome que separaron esa categoría) → Analyze page load.

**Importante:** `vite dev` no sirve para esto — el service worker no se registra en modo desarrollo a propósito (ver [Arquitectura](#arquitectura)). Tiene que ser un build real servido por `vite preview` (o el propio deploy de Vercel).

Objetivos razonables (ver Criterios de aceptación): instalable, manifest válido, service worker registrado, iconos correctos, HTTPS (en Vercel, automático). No se persiguió 100/100 si eso implicaba cambios fuera de este slice (por ejemplo, code-splitting del bundle de ~700 KB — el warning de Vite sobre el tamaño del chunk ya existía antes de este slice y no es parte de él).

---

## Cómo limpiar el service worker y cachés durante desarrollo

Como el service worker solo se registra en un build real (`vite preview` o un deploy), normalmente no hay nada que limpiar mientras se corre `vite dev`. Si se probó un build con `vite preview` y hace falta empezar de cero:

**Chrome/Edge DevTools:**

1. `Application` → `Service Workers` → botón `Unregister` en el service worker de Rondo.
2. `Application` → `Storage` → botón `Clear site data` (esto también borra `localStorage`, incluyendo los descartes de `InstallRondoBanner`/`IosInstallGuide`).

**Consola** (alternativa rápida):

```js
navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister()));
caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
```

**Safari (iOS/macOS):** Ajustes → Safari → Avanzado → Datos de sitios web → buscar el dominio de Rondo → Eliminar. En macOS Safari, el panel equivalente está en Preferencias → Privacidad → Gestionar datos de sitios web.

---

## Validación manual

Documentado acá; ejecutarlo antes de dar por cerrado este slice contra un build real (`vite preview` o el deploy de Vercel), no contra `vite dev`.

### Android Chrome

- [ ] Abrir Rondo (HTTPS real o `vite preview` en la misma red).
- [ ] Esperar el banner de instalación.
- [ ] Instalar.
- [ ] Abrir desde el ícono en la pantalla de inicio.
- [ ] Confirmar que abre en modo standalone (sin barra de direcciones del navegador).
- [ ] Cerrar y volver a abrir la app instalada.
- [ ] Activar modo avión después de haber cargado la app al menos una vez; confirmar que el shell abre y se ve el mensaje de sin conexión (no una pantalla en blanco ni datos falsos).
- [ ] Volver a activar la red; confirmar que se puede reintentar y los datos reales cargan.
- [ ] Publicar un build nuevo y confirmar que aparece el aviso de actualización, y que "Actualizar" recarga una sola vez.

### iPhone Safari

- [ ] Abrir Rondo.
- [ ] Ver la guía de instalación (3 pasos).
- [ ] Compartir → Agregar a pantalla de inicio.
- [ ] Abrir desde el ícono nuevo.
- [ ] Confirmar modo standalone (`navigator.standalone === true`, sin chrome de Safari).
- [ ] Cerrar y volver a abrir.
- [ ] Probar el estado sin conexión básico (modo avión) después de una carga previa.

**No se afirma que esto se haya probado en un dispositivo físico real como parte de este slice** — es la validación pendiente antes de considerarlo completamente cerrado en producción.

---

## Web Push

Implementado en un slice posterior a este documento — ver [`docs/WEB_PUSH.md`](./WEB_PUSH.md) para arquitectura, el modelo `PushSubscription`, las claves VAPID, los endpoints, la migración `generateSW` → `injectManifest`, y el checklist de validación manual (Android/iPhone).
