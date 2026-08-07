# IMPLEMENTATION ASSESSMENT

> **Nota (auth nativa):** las menciones a Clerk en esta evaluación temprana están desactualizadas — Clerk fue removido por completo. Ver [`docs/AUTHENTICATION.md`](./AUTHENTICATION.md) para el estado real de autenticación. El resto de este documento se conserva como referencia histórica.

## 1. Resumen ejecutivo

La documentación de Rondo define un producto con una propuesta clara: un MVP para organizar partidos deportivos de forma sencilla, con foco en jugadores, clubes y experiencias compartidas. El núcleo del producto está bien identificado en los documentos de producto, negocio y arquitectura: registro, perfil, partidos, participantes, chat, valoraciones y notificaciones.

El proyecto está orientado a un monolito modular, con arquitectura hexagonal, DDD y organización por dominio. La documentación es suficientemente rica para empezar a construir una primera versión, pero todavía requiere una consolidación de decisiones antes de implementar.

La recomendación principal es no empezar por reservas, clubes administrativos o promociones. El primer eje de implementación debe ser el flujo diferencial de Rondo: crear un partido, buscar candidatos compatibles, invitar activamente a jugadores, completar el equipo, coordinar por chat, confirmar/finalizar y valorar.

---

## 2. Estado de la documentación

### Fortalezas

- El producto tiene una visión consistente y una propuesta de valor clara.
- La arquitectura está definida en términos de DDD, Clean Architecture y hexagonal architecture.
- Los dominios principales están bien documentados: USERS, MATCHES, CLUBS, BOOKINGS, COURTS, SPORTS, CHAT, REVIEWS y NOTIFICATIONS.
- El MVP incluye el chat por partido y las valoraciones posteriores al partido, que son explícitamente priorizadas.
- La documentación de negocio define reglas útiles para la implementación inicial.

### Gaps importantes

- Algunos documentos importantes están vacíos o incompletos: MATCH_CHAT.md, PLAYER_REPUTATION.md e INVITATIONS.md.
- Existen inconsistencias entre documentos de negocio, producto y arquitectura.
- La documentación técnica todavía deja decisiones abiertas, especialmente autenticación, ORM y notificaciones push.
- La documentación de APIs está bien orientada, pero no existe todavía una especificación completa por endpoint ni una lista consolidada de contratos.

### Conclusión

La documentación permite comenzar, pero no está aún lo suficientemente consolidada para implementar sin decisiones humanas previas.

---

## 3. Inconsistencias encontradas

### 3.1 Estados del partido

- BUSINESS_RULES define estados como Draft, Recruiting, Full, Scheduled, In Progress, Finished, Cancelled.
- MATCHES define estados como DRAFT, OPEN, FULL, CONFIRMED, CANCELLED, COMPLETED.

Conclusión: existe una discrepancia de nomenclatura y de modelo de estados. Se necesita un único catálogo canónico.

### 3.2 Chat y creación automática

- PRODUCT_DECISIONS PD-004 indica que cada Match crea automáticamente un MatchChat.
- CHAT describe varias opciones de creación (al publicar, al confirmar primer participante o al enviar el primer mensaje) y recomienda crearlo al publicar.

Conclusión: el comportamiento esperado es similar, pero el documento técnico no lo deja completamente unificado.

### 3.3 Reputación y valoraciones

- PRODUCT_DECISIONS PD-005 y PD-006 hablan de una reputación dividida entre Juego y Conducta y de valoraciones de todos los participantes.
- REVIEWS define un modelo simple de valoración de 1 a 5 estrellas y un resumen de reputación.

Conclusión: hay una divergencia entre la intención de producto y la especificación del MVP actual.

### 3.4 Autenticación y proveedor

- USERS asume Clerk como proveedor de autenticación.
- TECH_DECISIONS deja autenticación pendiente.

Conclusión: la decisión de usar Clerk está implícita, pero no está formalizada como decisión técnica aceptada.

### 3.5 ORM

- El stack declara Prisma, pero TECH_DECISIONS deja el ORM pendiente.

Conclusión: la implementación debería confirmar si Prisma será la opción oficial antes de avanzar.

### 3.6 Roles y permisos

- AUTHORIZATIONS define tres roles: USER, CLUB_ADMIN y SUPER_ADMIN.
- AUTH define solo Usuario y Administrador del Club.

Conclusión: la jerarquía de permisos no está completamente unificada.

### 3.7 Alcance de reservas y clubes

- La documentación de negocio y el producto incluyen clubes, canchas y reservas dentro del MVP.
- La documentación de implementación recomendada apunta a priorizar primero el flujo principal del partido.

Conclusión: los clubes y reservas son importantes, pero no deberían bloquear el primer slice funcional del MVP.

### 3.8 Documentación incompleta

- MATCH_CHAT.md, PLAYER_REPUTATION.md e INVITATIONS.md están vacíos.
- Esto reduce la claridad para implementar ciertos aspectos del flujo principal.

---

## 4. Decisiones resueltas para el MVP

Las decisiones pendientes quedan fijadas de la siguiente manera para la planificación técnica:

1. Autenticación
   - Clerk será el proveedor oficial de autenticación.
   - El backend validará el token de Clerk, obtendrá el identificador externo y sincronizará un usuario interno en PostgreSQL.

2. ORM y persistencia
   - Prisma será el ORM oficial.
   - La arquitectura seguirá usando repositorios en infraestructura, sin que el dominio dependa de Prisma.

3. Modelo canónico de estados del partido
   - Se adopta el siguiente catálogo:
     - DRAFT
     - RECRUITING
     - FULL
     - CONFIRMED
     - IN_PROGRESS
     - COMPLETED
     - CANCELLED

4. Modelo de valoraciones
   - El MVP utilizará una valoración simple de 1 a 5 estrellas con comentario opcional.

5. Alcance del MVP real
   - Clubes, canchas y reservas siguen formando parte del producto, pero no bloquearán el primer flujo funcional.
   - El flujo principal del MVP será crear partido, buscar candidatos compatibles y enviar invitaciones activas.

6. Chat y notificaciones
   - El chat será grupal por partido y se habilitará para participantes confirmados.
   - Las notificaciones del MVP serán internas in-app.

---

## 5. Alcance final del MVP

### Imprescindible para el MVP

- Registro e inicio de sesión con Clerk.
- Gestión de perfil básico.
- Deportes del jugador y disponibilidad semanal.
- Creación de partidos.
- Cambio del partido a RECRUITING.
- Búsqueda de candidatos compatibles y listado de usuarios que matchean por deporte y disponibilidad.
- Invitaciones activas a candidatos.
- Aceptación o rechazo de invitaciones.
- Gestión de participantes confirmados.
- Chat asociado al partido para participantes confirmados.
- Confirmación y finalización del partido.
- Valoraciones posteriores al partido.
- Notificaciones básicas in-app.
- Catálogo básico de deportes y modalidades.
- Integración con Clerk para identidad.

### Necesaria, pero puede implementarse después del flujo principal

- Reservas y gestión de canchas.
- Gestión administrativa de clubes.
- Roles complejos de club.
- Promociones y membresías avanzadas.
- Notificaciones push y emails.
- Búsqueda avanzada de jugadores y partidos.
- Integración con almacenamiento de imágenes más avanzada.

### Fuera del MVP

- Rankings deportivos.
- Estadísticas avanzadas.
- Torneos y ligas.
- Pagos integrados.
- Suscripciones premium.
- IA para completar equipos o recomendar jugadores.
- Integraciones con calendarios externos.
- Aplicación móvil nativa.

---

## 6. Mapa de módulos

### Usuarios

- Responsable de perfil, identidad interna, estado de cuenta y configuración básica.
- Depende de: AUTH/Clerk, AUTHORIZATIONS.
- Contratos públicos: lectura del perfil, actualización del perfil, estado del usuario.
- Eventos que produce: UserCreated, UserProfileUpdated, UserSuspended, UserDeleted.
- Eventos que consume: AuthUserSynced.

### Auth y autorizaciones

- Responsable de autenticación, identidad y validación de permisos.
- Depende de: USERS, Clerk.
- Contratos públicos: verificar sesión, obtener identidad, evaluar permisos.
- Eventos que produce: Authenticated, SessionRevoked.
- Eventos que consume: UserCreated.

### Clubs

- Responsable de clubes, membresías, roles y contexto multi-club.
- Depende de: USERS, AUTHORIZATIONS.
- Contratos públicos: crear/consultar club, listar membresías, asignar roles.
- Eventos que produce: ClubCreated, MembershipApproved, MembershipRejected.
- Eventos que consume: UserCreated.

### Sports

- Responsable del catálogo maestro de deportes y modalidades.
- Depende de: ninguno o de configuración base.
- Contratos públicos: listar deportes, obtener modalidades, obtener límites por deporte.
- Eventos que produce: SportCatalogUpdated.
- Eventos que consume: ninguno.

### Courts

- Responsable de canchas, sedes y reglas operativas.
- Depende de: CLUBS, SPORTS.
- Contratos públicos: listar canchas, consultar disponibilidad base, validar compatibilidad.
- Eventos que produce: CourtCreated, CourtStatusUpdated.
- Eventos que consume: ClubCreated, VenueCreated.

### Bookings

- Responsable de reservas y ocupación de canchas.
- Depende de: CLUBS, COURTS, SPORTS, AUTHORIZATIONS.
- Contratos públicos: crear reserva, consultar reserva, cancelar reserva, confirmar reserva.
- Eventos que produce: BookingCreated, BookingConfirmed, BookingCancelled.
- Eventos que consume: MatchAssociatedWithBooking, MatchCancelled.

### Matches

- Responsable del dominio principal del partido.
- Depende de: USERS, SPORTS, CLUBS, BOOKINGS (de forma opcional), AUTHORIZATIONS.
- Contratos públicos: crear partido, publicar, editar, consultar, aprobar o rechazar participante, confirmar, cancelar, completar.
- Eventos que produce: MatchCreated, MatchPublished, MatchParticipantApproved, MatchParticipantRejected, MatchConfirmed, MatchCompleted, MatchCancelled.
- Eventos que consume: BookingConfirmed, BookingCancelled, UserProfileUpdated.

### Invitations

- Responsable de invitaciones a partidos y posiblemente a clubes.
- Depende de: MATCHES, USERS, NOTIFICATIONS.
- Contratos públicos: crear invitación, aceptar, rechazar, cancelar.
- Eventos que produce: MatchInvitationCreated, MatchInvitationAccepted, MatchInvitationRejected.
- Eventos que consume: MatchCreated, MatchParticipantApproved.

### Chat

- Responsable del chat del partido.
- Depende de: MATCHES, USERS.
- Contratos públicos: abrir conversación, listar mensajes, enviar mensaje, cerrar conversación.
- Eventos que produce: MessageCreated, ConversationClosed.
- Eventos que consume: MatchPublished, MatchConfirmed, MatchCompleted, MatchCancelled, MatchParticipantRemoved.

### Reviews

- Responsable de valoraciones posteriores al partido.
- Depende de: MATCHES, USERS, NOTIFICATIONS.
- Contratos públicos: listar usuarios valorables, crear valoración, listar valoraciones del usuario, resumen de reputación.
- Eventos que produce: ReviewCreated, UserRatingSummaryUpdated.
- Eventos que consume: MatchCompleted.

### Notifications

- Responsable de notificaciones in-app.
- Depende de: USERS, MATCHES, REVIEWS, BOOKINGS.
- Contratos públicos: listar notificaciones, marcar como leída, marcar todas como leídas.
- Eventos que produce: NotificationCreated, NotificationRead.
- Eventos que consume: MatchInvitationCreated, MatchParticipantApproved, ReviewCreated, BookingConfirmed.

---

## 7. Dependencias

### Dependencias principales recomendadas

- USERS no debe acceder directamente a tablas de MATCHES o BOOKINGS; debe comunicar con contratos públicos.
- MATCHES debe depender de contratos de USERS y SPORTS, no de tablas internas de otros módulos.
- CHAT debe consumir información de MATCHES y USERS a través de puertos, no por acceso directo a tablas.
- REVIEWS debe validar elegibilidad con MATCHES mediante un puerto explícito.
- NOTIFICATIONS debe reaccionar a eventos publicados por otros módulos, no depender directamente de su persistencia interna.

### Contratos públicos mínimos

- USERS: obtener usuario por ID, validar estado, obtener perfil público.
- MATCHES: consultar match, validar participación, validar capacidad, validar estado del partido.
- SPORTS: obtener deporte y límites por modalidad.
- CLUBS: validar pertenencia a club y permisos.
- BOOKINGS: consultar reserva, validar compatibilidad, confirmar/cancelar.

### Eventos de integración recomendados

- MatchCreated
- MatchPublished
- MatchParticipantApproved
- MatchParticipantRejected
- MatchConfirmed
- MatchCompleted
- MatchCancelled
- ReviewCreated
- BookingConfirmed
- BookingCancelled
- NotificationCreated

---

## 8. Flujo principal

### 8.1 Registro e inicio de sesión

1. El usuario se registra en Clerk.
2. Clerk devuelve identidad autenticada.
3. El backend sincroniza o crea el usuario interno en USERS.
4. El usuario queda en estado PROFILE_INCOMPLETE si faltan datos obligatorios.
5. El usuario inicia sesión y accede a la aplicación.

Módulos involucrados: AUTH, USERS.

### 8.2 Creación y edición del perfil

1. El usuario completa datos obligatorios: nombre, apellido, email, teléfono, sexo.
2. El usuario puede agregar foto, deportes, biografía y disponibilidad.
3. El perfil queda activo para usar el producto.
4. El usuario puede editar sus datos en cualquier momento.

Módulos involucrados: USERS, AUTHORIZATIONS.

### 8.3 Creación de un partido

1. El usuario autenticado crea un match.
2. El backend valida datos básicos.
3. El match se crea con estado inicial DRAFT o equivalente.
4. Se genera el identificador del partido y se registra el organizador.

Módulos involucrados: MATCHES, USERS, SPORTS.

### 8.4 Búsqueda de jugadores compatibles

1. El organizador crea el partido y puede consultar una lista de usuarios compatibles.
2. El sistema filtra por deporte, disponibilidad, estado del usuario y compatibilidad básica del partido.
3. Se muestran candidatos potenciales para invitar o contactar.
4. El organizador puede iniciar una invitación o dejar que el usuario solicite unirse.

Módulos involucrados: MATCHES, USERS, SPORTS, INVITATIONS, NOTIFICATIONS.

### 8.5 Publicación del partido

1. El organizador publica el partido.
2. El backend valida perfil completo, deporte, horario, ubicación y cupos.
3. El partido cambia a OPEN o equivalente.
4. Se crea el chat asociado al partido.

Módulos involucrados: MATCHES, CHAT, NOTIFICATIONS.

### 8.5 Solicitud para unirse

1. Otro usuario solicita participar.
2. El backend valida cupos, estado del partido y restricciones.
3. Se crea la solicitud o la participación en estado REQUESTED.
4. El organizador recibe una notificación.

Módulos involucrados: MATCHES, NOTIFICATIONS, INVITATIONS.

### 8.6 Aceptación o rechazo

1. El organizador acepta o rechaza.
2. El backend valida cupos y transiciones.
3. En caso de aceptación, el participante pasa a CONFIRMED.
4. Si el partido estaba FULL, se actualiza el estado.

Módulos involucrados: MATCHES, NOTIFICATIONS.

### 8.7 Chat entre participantes confirmados

1. El chat queda disponible para organizador y participantes confirmados.
2. Se valida acceso al chat.
3. Los mensajes se guardan y se publican a los participantes.

Módulos involucrados: CHAT, MATCHES, NOTIFICATIONS.

### 8.8 Confirmación del partido

1. El organizador confirma que el partido se realizará.
2. El partido pasa a un estado confirmado.
3. Se notifica a los participantes.

Módulos involucrados: MATCHES, NOTIFICATIONS.

### 8.9 Finalización del partido

1. El partido finaliza según horario o acción manual.
2. El estado pasa a COMPLETED.
3. Se habilitan las valoraciones posteriores.

Módulos involucrados: MATCHES, REVIEWS.

### 8.10 Valoraciones posteriores

1. Los participantes confirmados pueden valorar a otros participantes.
2. El backend valida elegibilidad y unicidad.
3. Se crea la valoración y se actualiza el resumen del usuario.
4. Se genera una notificación al usuario valorado.

Módulos involucrados: REVIEWS, MATCHES, NOTIFICATIONS, USERS.

### 8.11 Notificaciones relacionadas

1. El sistema envía notificaciones in-app para invitaciones, solicitudes, aprobaciones, rechazos, cancelaciones, confirmaciones y valoraciones.
2. El usuario puede leerlas y marcarlas como leídas.

Módulos involucrados: NOTIFICATIONS.

---

## 9. Orden recomendado de implementación

### Fase 1 — Fundación de identidad y perfil

- Objetivo: permitir que un usuario entre, complete su perfil y quede listo para participar.
- Módulos: AUTH, USERS, AUTHORIZATIONS.
- Backend: integración con Clerk, sincronización de usuario interno, validaciones de perfil, estados PROFILE_INCOMPLETE y ACTIVE.
- Frontend: onboarding, registro, login, edición de perfil básico.
- Base de datos: users, auth references, estados de usuario.
- Endpoints: POST /api/v1/auth/sync, GET /api/v1/users/me, PATCH /api/v1/users/me.
- Pruebas mínimas: registro, login, perfil incompleto, edición de perfil.
- Criterio de finalización: un usuario puede registrarse, completar perfil y entrar a la app.

### Fase 2 — Core de partidos y participación

- Objetivo: crear partidos, buscar candidatos compatibles, invitar activamente y completar el equipo.
- Módulos: MATCHES, SPORTS, USERS, INVITATIONS, NOTIFICATIONS.
- Backend: creación de partido, cambio a RECRUITING, capacidad, búsqueda de usuarios compatibles por deporte y disponibilidad, invitaciones, aceptación/rechazo, restricciones de cupos.
- Frontend: formulario de partido, detalle, listado de candidatos compatibles, lista de participantes, acciones de invitar, aceptar y rechazar.
- Base de datos: matches, match_participants, match_invitations.
- Endpoints: POST /api/v1/matches, GET /api/v1/matches, GET /api/v1/matches/:matchId, PATCH /api/v1/matches/:matchId, GET /api/v1/matches/:matchId/candidates, POST /api/v1/matches/:matchId/invitations, POST /api/v1/matches/:matchId/invitations/:invitationId/accept, POST /api/v1/matches/:matchId/invitations/:invitationId/reject.
- Pruebas mínimas: creación, cambio a RECRUITING, matching de candidatos, invitación, aceptación, rechazo, cupo completo.
- Criterio de finalización: un organizador puede crear un partido y completar el equipo invitando candidatos compatibles.

### Fase 3 — Chat y ciclo de partido

- Objetivo: dar soporte a la coordinación del partido entre participantes confirmados.
- Módulos: CHAT, MATCHES, NOTIFICATIONS.
- Backend: creación de conversación, envío de mensajes, reglas de acceso, cierre por cancelación o finalización.
- Frontend: vista de chat por partido, listado de mensajes, estado activo/cerrado.
- Base de datos: match_chats, match_chat_messages.
- Endpoints: POST /api/v1/matches/:matchId/chat/messages, GET /api/v1/matches/:matchId/chat/messages, POST /api/v1/matches/:matchId/confirmation, POST /api/v1/matches/:matchId/completion.
- Pruebas mínimas: envío de mensaje, acceso del organizador, acceso de participantes confirmados, cierre por cancelación.
- Criterio de finalización: el partido puede organizarse completamente dentro de la plataforma hasta su finalización.

### Fase 4 — Valoraciones y reputación simple

- Objetivo: completar el ciclo del partido con valoraciones posteriores.
- Módulos: REVIEWS, MATCHES, NOTIFICATIONS, USERS.
- Backend: validación de elegibilidad, unicidad, persistencia y resumen simple.
- Frontend: pantalla de valoración posterior al partido.
- Base de datos: reviews, user_rating_summaries.
- Endpoints: GET /api/v1/matches/:matchId/reviewable-users, POST /api/v1/matches/:matchId/reviews, GET /api/v1/users/:userId/reviews, GET /api/v1/users/:userId/rating-summary.
- Pruebas mínimas: valoración válida, valoración duplicada, no participante, partido incompleto.
- Criterio de finalización: un usuario puede valorar a otros participantes tras la finalización del partido.

### Fase 5 — Clubes, reservas y canchas

- Objetivo: incorporar la gestión de clubes y reservas sin romper el negocio central.
- Módulos: CLUBS, COURTS, BOOKINGS, AUTHORIZATIONS.
- Backend: membresías, permisos por club, disponibilidad básica y reservas.
- Frontend: selección de club, listado de canchas, creación de reserva.
- Base de datos: clubs, club_memberships, courts, bookings.
- Endpoints: /clubs, /courts, /bookings.
- Pruebas mínimas: membresía activa, reserva válida, conflicto de horario.
- Criterio de finalización: un club puede operar reservas básicas y asociarlas a partidos.

### Fase 6 — Pulido, notificaciones avanzadas y observabilidad

- Objetivo: consolidar el producto para uso real.
- Módulos: NOTIFICATIONS, observabilidad, seguridad, UX.
- Backend: notificaciones push, auditoría, errores y métricas.
- Frontend: pantallas de notificaciones, estados vacíos y feedback visual.
- Base de datos: notifications, audit logs.
- Endpoints: GET /api/v1/users/me/notifications, POST /api/v1/notifications/:notificationId/read.
- Pruebas mínimas: lectura, marcación, estados vacíos.
- Criterio de finalización: el usuario recibe información útil y consistente durante todo el flujo.

---

## 10. Primer vertical slice

### Propuesta

El primer vertical slice debería ser: crear un partido, construir el matching de candidatos compatibles y mostrar una lista de usuarios que puedan ser invitados.

### Por qué este slice

- Valida la arquitectura completa: autenticación, dominio, aplicación, infraestructura y UI.
- Cubre el corazón del producto.
- Evita la complejidad inicial de reservas y administración de clubes.
- Permite demostrar un flujo completo de extremo a extremo con un alcance reducido.

### Componentes del slice

- Base de datos: users, sports, matches, match_participants, match_chats, match_chat_messages, reviews.
- Dominio: User, Match, MatchParticipant, Conversation, Message, Review.
- Caso de uso: CreateMatch, SearchMatchCandidates, CreateMatchInvitation, AcceptMatchInvitation.
- Endpoint REST: POST /api/v1/matches, PATCH /api/v1/matches/:matchId, GET /api/v1/matches/:matchId/candidates, POST /api/v1/matches/:matchId/invitations, POST /api/v1/matches/:matchId/invitations/:invitationId/accept.
- Integración con Clerk: registro, login y obtención de identidad autenticada.
- Interfaz React: onboarding, formulario de partido, detalle del partido, búsqueda de jugadores compatibles y listado de candidatos.
- Validaciones: perfil completo, disponibilidad compatible, cupo, estado del partido, elegibilidad del candidato.
- Pruebas: creación del partido, matching de candidatos, invitación, aceptación y actualización de cupos.

### Criterio de éxito del slice

Un usuario puede crear un partido y obtener una lista real de candidatos compatibles por deporte y disponibilidad.

---

## 11. Riesgos técnicos

- Inconsistencia de estados y transiciones entre módulos.
- Complejidad creciente si se intenta abordar clubes, reservas y partidos en la misma fase inicial.
- Acoplamiento riesgo si el frontend empieza a validar permisos y reglas de negocio sin el backend.
- Falta de decisiones claras sobre Clerk, Prisma y estrategia de notificaciones.
- Riesgo de sobre-especificar el MVP con funcionalidades que el producto no necesita todavía.

### Mitigación recomendada

- Mantener el primer slice simple y orientado al flujo de partido.
- Definir un único modelo de estados y un único contrato de eventos.
- Respetar estrictamente la arquitectura hexagonal y evitar acceso directo a tablas entre módulos.
- Desarrollar backend y frontend en paralelo solo con contratos claros y estables.

---

## 12. Próximos pasos

1. Consolidar el modelo de estados del partido y los eventos de dominio.
2. Definir el contrato inicial de autenticación con Clerk y el modelo de usuario interno.
3. Implementar la fase 1 y el primer slice de matching de candidatos como primer entregable verificable.
4. Mantener las reservas, clubes administrativos y promociones fuera del primer slice.
5. Revisar el documento de implementación en cada iteración para evitar que la documentación se desincronicen del código.

---

## Recomendación final

El proyecto ya tiene suficiente base documental para empezar, pero no debería comenzar con un alcance demasiado amplio. La mejor ruta es construir primero el flujo principal del producto: identidad, perfil, deportes y disponibilidad, creación de partido, matching de candidatos, invitaciones activas y completado del equipo. Ese eje permitirá validar la arquitectura, el dominio y la experiencia de usuario sin introducir demasiada complejidad desde el inicio.
