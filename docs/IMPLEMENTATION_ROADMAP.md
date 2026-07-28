# IMPLEMENTATION ROADMAP

## 1. Alcance definitivo del MVP

El MVP de Rondo debe centrarse en un flujo claro y verificable:

```text
Crear partido
    ↓
Buscar candidatos compatibles
    ↓
Invitar jugadores
    ↓
Aceptar o rechazar
    ↓
Completar equipo
    ↓
Chat
    ↓
Jugar
    ↓
Valorar
```

### Funcionalidades incluidas en el MVP

- Autenticación con Clerk.
- Usuario interno sincronizado en PostgreSQL.
- Perfil básico del usuario.
- Deportes practicados por el usuario.
- Disponibilidad semanal mínima.
- Creación de partidos en estado DRAFT.
- Cambio del partido a RECRUITING.
- Búsqueda determinística de candidatos compatibles.
- Invitaciones enviadas por el organizador.
- Aceptación y rechazo de invitaciones.
- Gestión básica de participantes confirmados.
- Chat grupal por partido.
- Confirmación y finalización del partido.
- Valoraciones posteriores al partido.
- Notificaciones internas in-app.

### Funcionalidades excluidas del MVP

- Pagos.
- Suscripciones.
- Rankings avanzados.
- Torneos y ligas.
- Recomendaciones con machine learning.
- Postulaciones públicas como eje central del producto.
- Push notifications.
- Chat privado o multimedia.
- Gestión administrativa completa de clubes, canchas y reservas.

### Principio central del producto

Rondo no debe operarse como una plataforma donde los usuarios “se postulan” pasivamente a partidos abiertos. Su propuesta principal es ayudar al organizador a armar un partido de forma activa:

```text
Creo un partido
    ↓
Rondo encuentra candidatos compatibles
    ↓
Elijo a quién invitar
    ↓
Completo el equipo
```

---

## 2. Dependencias entre módulos

El orden de dependencia debe respetar la arquitectura hexagonal y evitar acoplamiento directo entre módulos.

### 2.1 Mapa de dependencias

```text
AUTH
  └── USERS
        └── SPORTS
        └── AVAILABILITY

MATCHES
  ├── AUTH
  ├── USERS
  ├── SPORTS
  ├── AVAILABILITY
  └── NOTIFICATIONS

NOTIFICATIONS
  ├── MATCHES
  ├── CHAT
  └── REVIEWS

CHAT
  ├── MATCHES
  └── USERS

REVIEWS
  ├── MATCHES
  ├── USERS
  └── NOTIFICATIONS

CLUBS
  └── USERS

COURTS
  ├── CLUBS
  └── SPORTS

BOOKINGS
  ├── CLUBS
  ├── COURTS
  ├── SPORTS
  └── MATCHES
```

### 2.2 Bloqueos reales

- AUTH bloquea a USERS.
- USERS bloquea a MATCHES, CHAT y REVIEWS porque necesitan un usuario interno válido.
- SPORTS es un prerequisito de MATCHES y COURTS.
- AVAILABILITY bloquea el matching de candidatos, por lo que debe existir antes de Slice 5.
- MATCHES bloquea a NOTIFICATIONS, CHAT y REVIEWS porque ellas reaccionan a eventos del partido.
- CLUBS, COURTS y BOOKINGS no deben bloquear el Slice 0 al Slice 10.
- BOOKINGS depende de CLUBS y COURTS, y solo se habilita una vez que el flujo principal del partido está funcionando.

### 2.3 Recomendación de dependencia por módulo

- AUTH: base obligatoria.
- USERS: base obligatoria.
- SPORTS: base de catálogo.
- AVAILABILITY: base para matching.
- MATCHES: núcleo del MVP.
- NOTIFICATIONS: dependiente del partido y de las invitaciones.
- CHAT: dependiente de MATCHES y USERS.
- REVIEWS: dependiente de MATCHES y USERS.
- CLUBS: secundario para el MVP.
- COURTS: secundario para el MVP.
- BOOKINGS: posterior al flujo principal.

---

## 3. Vertical slices

Cada slice debe ser pequeño, verificable y demostrable por separado.

### Slice 0 — Fundación del repositorio

#### Objetivo

Crear la base técnica del monolito modular y dejar preparado el desarrollo de backend y frontend.

#### Flujo de usuario

No aplica directamente a un usuario final; es infraestructura inicial.

#### Módulos involucrados

- workspace monorepo
- shared packages
- apps/web
- apps/api

#### Entidades

- ninguna de negocio

#### Casos de uso

- inicializar monorepo
- configurar herramientas de calidad
- conectar base de datos de forma básica

#### Endpoints REST

- no aplica todavía

#### Tablas o cambios de base de datos

- esquema base inicial
- tablas de soporte para migraciones futuras

#### Pantallas React

- no aplica

#### Validaciones

- configuración válida de TypeScript
- lint y tests funcionando

#### Pruebas

- smoke test del monorepo
- test de conexión a PostgreSQL

#### Criterio de finalización

El proyecto puede arrancar localmente con web, api y conexión a PostgreSQL.

---

### Slice 1 — Autenticación y usuario interno

#### Objetivo

Permitir que un usuario se registre e inicie sesión con Clerk y que el backend cree un usuario interno de Rondo.

#### Flujo de usuario

1. El usuario entra en la app.
2. Se registra o inicia sesión con Clerk.
3. El backend sincroniza el usuario interno.
4. El usuario accede a su perfil.

#### Módulos involucrados

- AUTH
- USERS

#### Entidades

- User
- AuthSession

#### Casos de uso

- SignInWithClerk
- SyncRondoUser
- GetCurrentUser

#### Endpoints REST

- POST /api/v1/auth/sync
- GET /api/v1/users/me
- GET /api/v1/users/me/profile

#### Tablas o cambios de base de datos

- users
- user_auth_links o tabla equivalente de integración

#### Pantallas React

- login
- onboarding inicial
- perfil básico

#### Validaciones

- token válido de Clerk
- usuario interno creado una sola vez
- usuario sin perfil debe quedar en estado incompleto

#### Pruebas

- registro exitoso
- login exitoso
- usuario duplicado no duplica el registro interno

#### Criterio de finalización

Un usuario puede autenticarse con Clerk y obtener una identidad interna usable por la app.

---

### Slice 2 — Perfil deportivo

#### Objetivo

Que el usuario complete su perfil deportivo básico para participar en el matching.

#### Flujo de usuario

1. El usuario completa nombre, deporte y nivel.
2. Guarda el perfil.
3. El sistema lo marca como perfil completo.

#### Módulos involucrados

- USERS
- SPORTS

#### Entidades

- User
- UserSportProfile

#### Casos de uso

- UpdateUserProfile
- CompleteUserProfile
- ListSportsForUserSelection

#### Endpoints REST

- GET /api/v1/sports
- PATCH /api/v1/users/me/profile

#### Tablas o cambios de base de datos

- users
- user_sport_profiles

#### Pantallas React

- pantalla de perfil
- selector de deportes
- selector de nivel

#### Validaciones

- perfil completo requerido para crear partidos
- deporte debe existir en el catálogo
- nivel debe ser válido

#### Pruebas

- perfil incompleto no permite crear partido
- perfil completo sí lo permite

#### Criterio de finalización

El usuario puede completar su perfil deportivo y el sistema lo reconoce como elegible para participar del matching.

---

### Slice 3 — Disponibilidad

#### Objetivo

Permitir que un usuario defina franjas semanales de disponibilidad para el matching.

#### Flujo de usuario

1. El usuario agrega una franja semanal.
2. Puede editar o eliminar la franja.
3. El sistema valida que no haya superposición innecesaria.

#### Módulos involucrados

- USERS
- AVAILABILITY

#### Entidades

- PlayerAvailability

#### Casos de uso

- CreateAvailabilitySlot
- UpdateAvailabilitySlot
- DeleteAvailabilitySlot
- ListAvailabilitySlots

#### Endpoints REST

- GET /api/v1/users/me/availability
- POST /api/v1/users/me/availability
- PATCH /api/v1/users/me/availability/:availabilityId
- DELETE /api/v1/users/me/availability/:availabilityId

#### Tablas o cambios de base de datos

- user_availability_slots

#### Pantallas React

- pantalla de disponibilidad
- formulario de franja semanal

#### Validaciones

- hora de inicio anterior a hora fin
- no superposición inválida en el mismo día
- franjas válidas para el MVP

#### Pruebas

- alta de franja
- edición
- eliminación
- superposición inválida

#### Criterio de finalización

El usuario puede registrar su disponibilidad y esta queda disponible para el matching de candidatos.

---

### Slice 4 — Crear partido

#### Objetivo

Que un usuario pueda crear un partido inicial en estado DRAFT.

#### Flujo de usuario

1. El organizador completa los datos del partido.
2. El sistema crea el partido en DRAFT.
3. El organizador puede revisar los datos antes de avanzar.

#### Módulos involucrados

- MATCHES
- SPORTS
- USERS

#### Entidades

- Match

#### Casos de uso

- CreateMatch
- UpdateMatchDraft
- GetMatchDraft

#### Endpoints REST

- POST /api/v1/matches
- GET /api/v1/matches/:matchId
- PATCH /api/v1/matches/:matchId

#### Tablas o cambios de base de datos

- matches

#### Pantallas React

- formulario para crear partido
- detalle del partido en borrador

#### Validaciones

- usuario autenticado
- deporte válido
- fecha futura
- duración válida
- cupos válidos
- ubicación mínima informada

#### Pruebas

- creación válida
- deporte inválido
- cupos inválidos
- fecha pasada

#### Criterio de finalización

Un usuario puede crear un partido y dejarlo listo para pasar a RECRUITING.

---

### Slice 5 — Matching de candidatos

#### Objetivo

Permitir al organizador buscar candidatos compatibles para un partido.

#### Flujo de usuario

1. El organizador abre el partido.
2. El sistema consulta candidatos compatibles.
3. El organizador ve una lista de usuarios que coinciden por deporte y disponibilidad.

#### Módulos involucrados

- MATCHES
- USERS
- SPORTS
- AVAILABILITY

#### Entidades

- Match
- User
- PlayerAvailability

#### Casos de uso

- SearchMatchCandidates
- FilterCandidatesBySport
- FilterCandidatesByAvailability

#### Endpoints REST

- GET /api/v1/matches/:matchId/candidates

#### Tablas o cambios de base de datos

- matches
- user_availability_slots
- user_sport_profiles

#### Pantallas React

- lista de candidatos
- detalle de candidato
- estado de matching

#### Validaciones

- organizador autenticado
- partido en RECRUITING
- excluir al organizador
- excluir usuarios ya asociados
- excluir usuarios no disponibles
- excluir usuarios sin perfil completo

#### Pruebas

- un candidato válido aparece
- un usuario sin disponibilidad no aparece
- un organizador no aparece
- un participante ya asociado no aparece

#### Criterio de finalización

El organizador puede ver una lista real de candidatos compatibles.

---

### Slice 6 — Invitaciones

#### Objetivo

Permitir al organizador invitar a candidatos y manejar invitaciones aceptadas o rechazadas.

#### Flujo de usuario

1. El organizador selecciona candidatos.
2. Envía invitaciones.
3. El usuario invitado recibe una notificación.
4. El invitado acepta o rechaza.
5. El sistema actualiza cupos y participantes.

#### Módulos involucrados

- MATCHES
- NOTIFICATIONS
- USERS

#### Entidades

- MatchParticipant

#### Casos de uso

- CreateMatchInvitation
- AcceptMatchInvitation
- RejectMatchInvitation
- CancelPendingInvitation

#### Endpoints REST

- POST /api/v1/matches/:matchId/invitations
- POST /api/v1/matches/:matchId/invitations/:invitationId/accept
- POST /api/v1/matches/:matchId/invitations/:invitationId/reject
- GET /api/v1/users/me/invitations

#### Tablas o cambios de base de datos

- match_participants
- notifications

#### Pantallas React

- pantalla de candidatos
- pantalla de invitaciones recibidas
- detalle de invitación

#### Validaciones

- cupos válidos al aceptar
- no duplicar invitación
- invitación pendiente solo para usuarios elegibles
- rechazar debe marcar el estado correspondiente

#### Pruebas

- invitar un candidato
- aceptar una invitación
- rechazar una invitación
- aceptar cuando ya no hay cupos

#### Criterio de finalización

El organizador puede completar el equipo de forma activa y un invitado puede aceptar o rechazar.

---

### Slice 7 — Gestión del partido

#### Objetivo

Administrar participantes y estados del partido una vez que el equipo ya está armado.

#### Flujo de usuario

1. El organizador ve participantes.
2. Puede remover a un participante.
3. Puede reemplazarlo con otro candidato.
4. Puede confirmar o cancelar el partido.

#### Módulos involucrados

- MATCHES
- NOTIFICATIONS

#### Entidades

- Match
- MatchParticipant

#### Casos de uso

- RemoveParticipant
- ReplaceParticipant
- ConfirmMatch
- CancelMatch

#### Endpoints REST

- DELETE /api/v1/matches/:matchId/participants/:participantId
- POST /api/v1/matches/:matchId/confirmation
- POST /api/v1/matches/:matchId/cancellation

#### Tablas o cambios de base de datos

- matches
- match_participants

#### Pantallas React

- lista de participantes
- acciones de gestión del partido

#### Validaciones

- el organizador es quien administra
- no se puede superar el cupo
- cancelar debe bloquear nuevas invitaciones

#### Pruebas

- remover participante
- reemplazar participante
- confirmar partido
- cancelar partido

#### Criterio de finalización

El organizador puede gestionar el partido hasta dejarlo listo para la coordinación posterior.

---

### Slice 8 — Chat

#### Objetivo

Permitir la coordinación del partido entre participantes confirmados.

#### Flujo de usuario

1. El usuario entra al chat del partido.
2. Ve mensajes previos.
3. Envía mensajes de texto.
4. Recibe notificaciones básicas de nuevo mensaje.

#### Módulos involucrados

- CHAT
- MATCHES
- NOTIFICATIONS

#### Entidades

- MatchChat
- MatchChatMessage

#### Casos de uso

- OpenMatchConversation
- SendTextMessage
- ListMatchMessages

#### Endpoints REST

- GET /api/v1/matches/:matchId/chat/messages
- POST /api/v1/matches/:matchId/chat/messages

#### Tablas o cambios de base de datos

- match_chats
- match_chat_messages

#### Pantallas React

- vista de chat por partido
- listado de mensajes
- composer de mensaje

#### Validaciones

- solo participantes confirmados
- mensaje no vacío
- conversación activa

#### Pruebas

- enviar mensaje válido
- mensaje vacío rechazado
- usuario no autorizado no puede entrar

#### Criterio de finalización

El partido puede organizarse por chat dentro de la plataforma.

---

### Slice 9 — Finalización

#### Objetivo

Pasar el partido a estados de ejecución y cierre.

#### Flujo de usuario

1. El organizador marca el partido como en curso.
2. Luego lo marca como completado.
3. Se habilitan las valoraciones.

#### Módulos involucrados

- MATCHES
- REVIEWS

#### Entidades

- Match

#### Casos de uso

- StartMatch
- CompleteMatch

#### Endpoints REST

- POST /api/v1/matches/:matchId/start
- POST /api/v1/matches/:matchId/completion

#### Tablas o cambios de base de datos

- matches

#### Pantallas React

- acciones de estado del partido

#### Validaciones

- solo el organizador o autoridad válida
- transición permitida
- partido no cancelado

#### Pruebas

- inicio válido
- finalización válida
- transición inválida

#### Criterio de finalización

El partido pasa correctamente por los estados IN_PROGRESS y COMPLETED.

---

### Slice 10 — Valoraciones

#### Objetivo

Permitir valoraciones posteriores al partido.

#### Flujo de usuario

1. El usuario accede a quienes puede valorar.
2. Envía una puntuación y comentario opcional.
3. El sistema persiste la valoración y el resumen.

#### Módulos involucrados

- REVIEWS
- MATCHES
- NOTIFICATIONS
- USERS

#### Entidades

- Review
- UserRatingSummary

#### Casos de uso

- ListReviewableUsers
- CreateReview
- GetUserReviews

#### Endpoints REST

- GET /api/v1/matches/:matchId/reviewable-users
- POST /api/v1/matches/:matchId/reviews
- GET /api/v1/users/:userId/reviews
- GET /api/v1/users/:userId/rating-summary

#### Tablas o cambios de base de datos

- reviews
- user_rating_summaries

#### Pantallas React

- pantalla de valoraciones posteriores
- listado de usuarios valorables

#### Validaciones

- partido completado
- participante confirmado
- una valoración por destinatario por partido
- no autovaloración

#### Pruebas

- valoración válida
- autovaloración rechazada
- duplicada rechazada

#### Criterio de finalización

El usuario puede valorar a otros participantes y ver el resumen básico.

---

### Slice 11 — Clubes y canchas

#### Objetivo

Incorporar soporte básico para clubes y canchas sin bloquear el flujo principal.

#### Flujo de usuario

1. Un club se registra o se gestiona.
2. Se crean sedes y canchas.
3. El partido puede asociarse opcionalmente a una cancha o lugar del club.

#### Módulos involucrados

- CLUBS
- COURTS
- USERS

#### Entidades

- Club
- ClubVenue
- Court

#### Casos de uso

- CreateClub
- CreateVenue
- CreateCourt
- AssociateCourtToMatch

#### Endpoints REST

- GET /api/v1/clubs
- POST /api/v1/clubs
- POST /api/v1/clubs/:clubId/venues
- POST /api/v1/clubs/:clubId/courts

#### Tablas o cambios de base de datos

- clubs
- club_venues
- courts

#### Pantallas React

- listado de clubes
- detalle de club
- gestión básica de canchas

#### Validaciones

- pertenencia al club
- sede compatible con club
- cancha compatible con deporte

#### Pruebas

- creación de club
- creación de cancha
- asociación válida

#### Criterio de finalización

El producto soporta un contexto club/cancha sin desordenar el flujo principal.

---

### Slice 12 — Reservas

#### Objetivo

Permitir reservas básicas de cancha asociadas o no a un partido.

#### Flujo de usuario

1. El usuario o administrador crea una reserva.
2. El sistema valida disponibilidad.
3. Se evita solapamiento.
4. Puede asociarse a un partido.

#### Módulos involucrados

- BOOKINGS
- CLUBS
- COURTS
- MATCHES

#### Entidades

- Booking

#### Casos de uso

- CreateBooking
- CheckBookingConflict
- AssociateBookingToMatch

#### Endpoints REST

- POST /api/v1/bookings
- GET /api/v1/bookings
- GET /api/v1/bookings/:bookingId
- PATCH /api/v1/bookings/:bookingId

#### Tablas o cambios de base de datos

- bookings

#### Pantallas React

- formulario de reserva
- calendario simple
- detalle de reserva

#### Validaciones

- horario libre
- cancha compatible
- club válido
- no solapamiento

#### Pruebas

- reserva válida
- conflicto de horario
- asociación a partido

#### Criterio de finalización

El sistema permite reservar una cancha de forma básica y asociarla a un partido cuando corresponda.

---

## 4. Orden mínimo recomendado

### Slice 0 — Fundación del repositorio

- pnpm workspace
- configuración de TypeScript
- aplicaciones web y api
- paquetes compartidos
- lint
- format
- test
- variables de entorno
- conexión inicial con PostgreSQL

### Slice 1 — Autenticación y usuario interno

- Clerk
- sincronización con Rondo
- creación del usuario interno
- endpoint GET /users/me
- protección de rutas

### Slice 2 — Perfil deportivo

- perfil básico
- deportes practicados
- nivel
- perfil completo
- edición desde React

### Slice 3 — Disponibilidad

- franjas semanales
- alta
- edición
- eliminación
- validación de superposición
- pantalla de disponibilidad

### Slice 4 — Crear partido

- creación en estado DRAFT
- deporte
- modalidad
- fecha
- horario
- duración
- cupos
- ubicación externa inicialmente

### Slice 5 — Matching de candidatos

- cambio a RECRUITING
- consulta de candidatos
- filtro por deporte
- filtro por disponibilidad
- exclusión de organizador y usuarios ya asociados
- listado en React

### Slice 6 — Invitaciones

- invitar candidato
- invitaciones pendientes
- notificación in-app
- aceptar
- rechazar
- validar cupos
- estado FULL

### Slice 7 — Gestión del partido

- listar participantes
- remover participante
- reemplazar jugador
- confirmar partido
- cancelar partido

### Slice 8 — Chat

- conversación grupal
- participantes confirmados
- mensajes de texto
- historial
- estado de lectura básico
- tiempo real o polling inicial

### Slice 9 — Finalización

- IN_PROGRESS
- COMPLETED
- habilitación de valoraciones

### Slice 10 — Valoraciones

- usuarios valorables
- puntuación de 1 a 5
- comentario opcional
- promedio
- cantidad de valoraciones
- notificación

### Slice 11 — Clubes y canchas

- clubes básicos
- sedes
- canchas
- asociación opcional con un partido

### Slice 12 — Reservas

- disponibilidad de cancha
- reserva
- conflicto de horarios
- asociación con partido

---

## 5. Primer slice implementable

### 5.1 Slice 0 — Fundación del repositorio

#### Archivos a crear

- package.json en la raíz
- pnpm-workspace.yaml
- tsconfig.base.json
- apps/web/package.json
- apps/web/tsconfig.json
- apps/web/src/main.tsx
- apps/api/package.json
- apps/api/tsconfig.json
- apps/api/src/main.ts
- packages/shared/package.json
- packages/domain/package.json
- packages/application/package.json
- packages/infrastructure/package.json
- packages/contracts/package.json

#### Estructura del monorepo

```text
rondo/
  apps/
    web/
    api/
  packages/
    shared/
    domain/
    application/
    infrastructure/
    contracts/
  docs/
```

#### Dependencias necesarias

- pnpm
- TypeScript
- Vite
- React
- Express o Fastify
- Prisma
- PostgreSQL client
- ESLint
- Prettier
- Vitest o Jest
- dotenv

#### Variables de entorno

```env
DATABASE_URL=postgresql://...
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CLERK_WEBHOOK_SECRET=...
API_PORT=3000
NODE_ENV=development
```

#### Comandos de desarrollo

```bash
pnpm install
pnpm -r build
pnpm --filter api dev
pnpm --filter web dev
```

#### Contratos iniciales

- Health check del API
- Health check del frontend
- Contrato de usuario autenticado mínimo

#### Pruebas iniciales

- app boots
- DB connection test
- health endpoint works

#### Riesgos

- configuración de monorepo incompleta
- errores de compilación cruzada entre apps y packages
- conexión a PostgreSQL no validada tempranamente

---

### 5.2 Slice 1 — Autenticación y usuario interno

#### Archivos a crear

- apps/api/src/modules/auth/**
- apps/api/src/modules/users/**
- apps/web/src/features/auth/**
- apps/web/src/features/users/**

#### Dependencias necesarias

- @clerk/clerk-sdk-node
- @clerk/clerk-react
- prisma/client
- express middleware o equivalente

#### Variables de entorno

```env
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CLERK_WEBHOOK_SECRET=...
```

#### Contratos iniciales

- GET /api/v1/users/me
- POST /api/v1/auth/sync

#### Pruebas iniciales

- token de Clerk válido
- usuario interno creado
- acceso protegido correcto

#### Riesgos

- sincronización incompleta entre Clerk y el usuario interno
- confiar en el cliente para la identidad del usuario

---

## 6. Decisiones abiertas

Las decisiones que siguen abiertas y deben gestionarse durante la implementación son:

1. El modelo exacto de la tabla de disponibilidad semanal y su relación con usuarios.
2. El detalle de los campos mínimos del partido en estado DRAFT y RECRUITING.
3. La forma exacta de representar el matching determinista en la capa de aplicación.
4. La política de cupos y de invalidación de invitaciones pendientes al completarse el equipo.
5. La estrategia de notificaciones in-app: persistencia local, persistencia global o ambos.
6. La forma de representar el estado de chat y las reglas de acceso para confirmados.

No se consideran abiertas las decisiones de autenticación, ORM, base de datos, arquitectura general, matching como núcleo ni chat/valoraciones como parte del MVP.

---

## 7. Riesgos

### 7.1 Modelado de disponibilidad

El mayor riesgo del MVP está en definir correctamente cómo modelar franjas semanales, solapamientos y compatibilidad con un partido.

### 7.2 Zonas horarias

El sistema debe evitar errores al comparar fechas y horarios entre usuarios, partidos y disponibilidad.

### 7.3 Matching incorrecto

El matching determinista debe ser consistente: si el criterio es deporte y disponibilidad, el algoritmo debe ser simple y predecible.

### 7.4 Sobreinvitación

El sistema debe evitar invitar más personas de las que caben o dejar invitaciones pendientes que luego se vuelvan inconsistentes.

### 7.5 Concurrencia al aceptar invitaciones

Dos usuarios aceptando al mismo tiempo puede generar conflictos de cupos. Debe protegerse transaccionalmente.

### 7.6 Acoplamiento entre módulos

Especialmente entre MATCHES, NOTIFICATIONS y CHAT. Deben comunicarse mediante contratos y eventos, no por acceso directo a tablas.

### 7.7 Estados inconsistentes

El partido debe pasar por estados claros y válidos. Un estado inconsistente puede romper el matching, las invitaciones y el chat.

### 7.8 Complejidad del tiempo real

El chat puede empezar con polling simple. Evitar introducir real-time complejo en el primer slice.

---

## 8. Criterio para comenzar a programar

Sí, la documentación está suficientemente consolidada para comenzar el Slice 0.

El único bloqueo real que aún debe resolverse en la práctica es la implementación inicial del entorno y la definición técnica concreta de los contratos de los primeros endpoints, pero no existe un bloqueo funcional que impida empezar.

La recomendación es comenzar por el Slice 0 y el Slice 1, y mantener el alcance del MVP estrictamente alineado con el flujo principal:

```text
crear partido
    ↓
buscar candidatos
    ↓
invitar
    ↓
aceptar o rechazar
    ↓
completar equipo
```
