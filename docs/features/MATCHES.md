# MATCHES

# Objetivo

Este documento define el dominio de partidos del MVP de Rondo.

Un partido permite que un usuario organice una actividad deportiva, defina sus cupos e invite a otros jugadores a participar.

El MVP debe permitir:

* crear un partido;
* indicar deporte y modalidad;
* definir fecha, hora y ubicación;
* establecer cantidad de jugadores;
* permitir que otros usuarios se unan;
* aprobar o rechazar solicitudes;
* consultar participantes;
* cancelar el partido;
* vincularlo opcionalmente con una reserva.

---

# Responsabilidades

El dominio `MATCHES` administra:

* datos del partido;
* organizador;
* deporte y modalidad;
* fecha y horario;
* ubicación;
* cupos;
* participantes;
* solicitudes de ingreso;
* estado del partido;
* nivel recomendado;
* categoría;
* relación opcional con una reserva.

No administra:

* disponibilidad de canchas;
* pagos;
* reservas;
* reputación;
* mensajes;
* catálogo de deportes.

---

# Entidad Match

```ts
interface Match {
  id: MatchId;

  organizerUserId: UserId;

  clubId?: ClubId;
  venueId?: ClubVenueId;
  courtId?: CourtId;
  bookingId?: BookingId;

  sportId: SportId;
  sportModalityId?: SportModalityId;

  title: string;
  description?: string;

  startsAt: Date;
  endsAt: Date;
  timeZone: string;

  locationName?: string;
  address?: string;

  maximumParticipants: number;
  minimumParticipants?: number;

  level?: SportLevel;
  genderCategory: MatchGenderCategory;

  joinPolicy: MatchJoinPolicy;
  visibility: MatchVisibility;
  status: MatchStatus;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# Organizador

Todo partido tendrá un organizador:

```ts
organizerUserId: UserId;
```

El organizador puede:

* editar el partido;
* aceptar o rechazar jugadores;
* remover participantes;
* cancelar el partido;
* marcarlo como completado.

El organizador se considera participante, salvo que se indique explícitamente lo contrario.

---

# Ubicación

Un partido puede realizarse dentro o fuera de un club.

## Partido en un club

Puede incluir:

```ts
clubId?: ClubId;
venueId?: ClubVenueId;
courtId?: CourtId;
bookingId?: BookingId;
```

## Partido externo

Puede incluir:

```ts
locationName?: string;
address?: string;
```

Ejemplo:

```text
Polideportivo Municipal
Av. Principal 1234
```

Para el MVP, las coordenadas son opcionales.

---

# Relación con reservas

Un partido puede tener:

```ts
bookingId?: BookingId;
```

Reglas:

* un partido puede existir sin reserva;
* una reserva puede existir sin partido;
* la reserva debe corresponder al mismo horario y cancha;
* cancelar el partido no cancela automáticamente la reserva;
* cancelar la reserva debe advertir al organizador.

La vinculación deberá validarse desde el backend.

---

# Estado del partido

```ts
enum MatchStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  FULL = 'FULL',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}
```

## DRAFT

El partido todavía no se publicó.

## OPEN

Está publicado y tiene cupos disponibles.

## FULL

Alcanzó el máximo de participantes.

## CONFIRMED

El organizador confirmó que el partido se realizará.

## CANCELLED

El partido fue cancelado.

## COMPLETED

El horario terminó y el partido se considera finalizado.

---

# Transiciones principales

```text
DRAFT
  ↓
OPEN
  ↓
FULL
  ↓
CONFIRMED
  ↓
COMPLETED
```

Desde `OPEN`, `FULL` o `CONFIRMED` podrá pasar a:

```text
CANCELLED
```

Si un participante abandona un partido `FULL`, deberá volver a:

```text
OPEN
```

salvo que ya esté confirmado y la regla del organizador indique lo contrario.

---

# Visibilidad

```ts
enum MatchVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}
```

## Público

Puede aparecer en búsquedas y recomendaciones.

## Privado

Solo puede accederse mediante invitación o enlace directo.

---

# Política de ingreso

```ts
enum MatchJoinPolicy {
  AUTOMATIC = 'AUTOMATIC',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
}
```

## Ingreso automático

El usuario se incorpora inmediatamente si existe cupo.

## Aprobación requerida

El usuario envía una solicitud y el organizador decide.

---

# Cupos

Campos:

```ts
minimumParticipants?: number;
maximumParticipants: number;
```

Reglas:

* el máximo es obligatorio;
* debe ser mayor que cero;
* el mínimo no puede superar el máximo;
* no se puede aceptar más jugadores que el máximo;
* el organizador cuenta como participante cuando corresponda.

El número recomendado podrá obtenerse de la modalidad deportiva.

---

# Participantes

La relación se modelará mediante:

```ts
interface MatchParticipant {
  id: MatchParticipantId;
  matchId: MatchId;
  userId: UserId;
  status: MatchParticipantStatus;
  joinedAt?: Date;
  createdAt: Date;
}
```

---

# Estado del participante

```ts
enum MatchParticipantStatus {
  INVITED = 'INVITED',
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  LEFT = 'LEFT',
  REMOVED = 'REMOVED',
}
```

## INVITED

El organizador invitó al usuario.

## REQUESTED

El usuario solicitó participar.

## CONFIRMED

Forma parte del partido.

## REJECTED

El organizador rechazó la solicitud.

## LEFT

El participante abandonó voluntariamente.

## REMOVED

El organizador lo eliminó.

Solo `CONFIRMED` ocupa un cupo.

---

# Reglas de participación

Un usuario no podrá:

* unirse dos veces al mismo partido;
* unirse a un partido cancelado;
* unirse cuando no hay cupos;
* unirse si está suspendido;
* participar en dos partidos incompatibles en el mismo horario, si se implementa esa validación en el MVP.

Un organizador no podrá removerse mientras siga siendo responsable del partido.

Antes de abandonar deberá transferir la organización o cancelar el partido.

---

# Nivel

Campo opcional:

```ts
level?: SportLevel;
```

Valores iniciales:

```text
BEGINNER
INTERMEDIATE
ADVANCED
```

El nivel es informativo en el MVP.

No bloqueará automáticamente la participación.

---

# Posiciones requeridas

Campo opcional:

```ts
requiredPositions?: string[];
```

Solo aplica a deportes cuyo catálogo en `SPORTS` define posiciones (por ejemplo fútbol).

El organizador podrá indicar qué posiciones necesita cubrir.

Este dato es informativo en el MVP y se utilizará para:

* resaltar candidatos compatibles;
* alimentar un futuro algoritmo de matching por posición.

No restringe automáticamente quién puede unirse al partido.

---

# Categoría

```ts
enum MatchGenderCategory {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  MIXED = 'MIXED',
  OPEN = 'OPEN',
}
```

Para el MVP:

* `OPEN` permite cualquier participante;
* las demás categorías se utilizan como información y filtro;
* el organizador es responsable de definir correctamente la categoría.

Las validaciones estrictas pueden incorporarse después.

---

# Equipos

En el MVP no se administrará una formación avanzada.

Opcionalmente, un participante podrá tener:

```ts
teamNumber?: 1 | 2;
```

Esto permite dividir jugadores en dos equipos sin desarrollar todavía:

* posiciones tácticas;
* suplentes complejos;
* capitanes;
* alineaciones;
* estadísticas.

La asignación puede hacerse manualmente por el organizador.

---

# Invitaciones

El organizador podrá invitar usuarios existentes.

Modelo conceptual:

```ts
interface MatchInvitation {
  id: MatchInvitationId;
  matchId: MatchId;
  invitedUserId: UserId;
  invitedByUserId: UserId;
  status: MatchInvitationStatus;
  expiresAt?: Date;
  createdAt: Date;
}
```

Estados:

```ts
enum MatchInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
```

Aceptar una invitación deberá confirmar al participante si todavía existe cupo.

---

# Solicitud de participación

Cuando el ingreso requiere aprobación:

1. el usuario solicita unirse;
2. se crea un participante en estado `REQUESTED`;
3. el organizador recibe una notificación;
4. el organizador acepta o rechaza;
5. al aceptar se vuelve a validar el cupo.

La aprobación debe ser transaccional para evitar superar el máximo.

---

# Creación del partido

Para crear un partido se requiere:

* organizador autenticado;
* título;
* deporte;
* zona horaria;
* máximo de participantes;
* categoría;
* política de ingreso;
* visibilidad;
* club.

Fecha, hora y cancha son opcionales al crear el partido.

Un usuario puede armar un partido sin saber todavía cuándo ni dónde va a jugarse, y completar esos datos más adelante, incluso mediante una reserva posterior.

Estado inicial recomendado:

```text
DRAFT
```

El usuario podrá publicarlo mediante una acción explícita.

---

# Publicación

Para pasar a `OPEN` deberá validarse:

* perfil del organizador completo;
* deporte activo;
* modalidad válida;
* horario futuro;
* cupos válidos;
* ubicación informada;
* partido no cancelado.

---

# Edición

El organizador podrá editar:

* título;
* descripción;
* ubicación;
* horario;
* cupos;
* nivel;
* categoría;
* visibilidad;
* política de ingreso.

Si ya existen participantes, los cambios importantes deberán notificarse.

Cambios importantes:

* fecha;
* horario;
* sede;
* cancha;
* deporte;
* modalidad;
* reducción de cupos.

---

# Reducción de cupos

No se podrá reducir:

```text
maximumParticipants
```

por debajo de la cantidad de participantes confirmados.

Primero deberán removerse participantes o mantener el cupo actual.

---

# Cancelación

El organizador podrá cancelar el partido.

Debe registrar:

```ts
interface MatchCancellation {
  matchId: MatchId;
  cancelledByUserId: UserId;
  reason?: string;
  cancelledAt: Date;
}
```

Al cancelar:

* se cambia el estado a `CANCELLED`;
* se impiden nuevas incorporaciones;
* se notifica a los participantes;
* la reserva vinculada no se cancela automáticamente.

---

# Finalización

El partido podrá pasar a `COMPLETED`:

* automáticamente después de su horario;
* manualmente por el organizador;
* mediante un proceso programado.

En el MVP no será obligatorio registrar resultados.

---

# Búsqueda de partidos

Los partidos públicos podrán buscarse por:

* deporte;
* modalidad;
* fecha;
* ubicación;
* nivel;
* categoría;
* cupos disponibles;
* club.

Solo deberán aparecer partidos:

```text
OPEN
```

o, según la interfaz:

```text
FULL
```

Los cancelados y completados no aparecerán en búsquedas activas.

---

# Mis partidos

El usuario podrá consultar:

* partidos que organiza;
* partidos en los que participa;
* solicitudes pendientes;
* invitaciones recibidas;
* partidos pasados;
* partidos cancelados.

---

# Casos de uso del MVP

```text
CreateMatch
UpdateMatch
PublishMatch
GetMatch
SearchMatches
ListMyMatches

RequestToJoinMatch
ApproveMatchParticipant
RejectMatchParticipant
LeaveMatch
RemoveMatchParticipant

InviteUserToMatch
AcceptMatchInvitation
RejectMatchInvitation

AssignParticipantTeam

ConfirmMatch
CancelMatch
CompleteMatch
```

---

# Endpoints iniciales

```http
POST /api/v1/matches
GET /api/v1/matches
GET /api/v1/matches/:matchId
PATCH /api/v1/matches/:matchId

POST /api/v1/matches/:matchId/publication
POST /api/v1/matches/:matchId/confirmation
POST /api/v1/matches/:matchId/cancellation
POST /api/v1/matches/:matchId/completion

GET /api/v1/users/me/matches

POST /api/v1/matches/:matchId/join-requests
POST /api/v1/matches/:matchId/participants/:participantId/approval
POST /api/v1/matches/:matchId/participants/:participantId/rejection
DELETE /api/v1/matches/:matchId/participants/me
DELETE /api/v1/matches/:matchId/participants/:participantId

POST /api/v1/matches/:matchId/invitations
POST /api/v1/matches/:matchId/invitations/:invitationId/accept
POST /api/v1/matches/:matchId/invitations/:invitationId/reject
```

---

# Eventos de dominio

```text
MatchCreated
MatchPublished
MatchUpdated
MatchConfirmed
MatchCancelled
MatchCompleted

MatchJoinRequested
MatchParticipantApproved
MatchParticipantRejected
MatchParticipantJoined
MatchParticipantLeft
MatchParticipantRemoved

MatchInvitationCreated
MatchInvitationAccepted
MatchInvitationRejected
```

---

# Persistencia

## Tabla matches

```text
matches
```

Campos principales:

```text
id
organizer_user_id
club_id
venue_id
court_id
booking_id
sport_id
sport_modality_id
title
description
starts_at
ends_at
time_zone
location_name
address
minimum_participants
maximum_participants
level
gender_category
join_policy
visibility
status
created_at
updated_at
```

---

## Tabla de participantes

```text
match_participants
```

Campos:

```text
id
match_id
user_id
status
team_number
joined_at
created_at
updated_at
```

Restricción:

```text
match_id + user_id
```

---

## Tabla de invitaciones

```text
match_invitations
```

Campos:

```text
id
match_id
invited_user_id
invited_by_user_id
status
expires_at
created_at
updated_at
```

---

# Índices sugeridos

```text
matches.organizer_user_id
matches.club_id
matches.sport_id
matches.starts_at
matches.status
matches.visibility

match_participants.match_id
match_participants.user_id
match_participants.status

match_invitations.invited_user_id
match_invitations.status
```

---

# Seguridad

El backend deberá validar:

* usuario autenticado;
* estado del usuario;
* propiedad del partido;
* cupos;
* estado;
* transiciones;
* relación con club y reserva;
* permisos administrativos cuando corresponda.

La interfaz no podrá decidir por sí sola si un usuario es organizador.

---

# Notificaciones mínimas

Se enviarán notificaciones por:

* invitación recibida;
* solicitud de ingreso;
* solicitud aceptada;
* solicitud rechazada;
* cambio importante;
* partido confirmado;
* partido cancelado;
* participante removido.

---

# Pruebas mínimas

Deberán probarse:

* creación;
* publicación;
* ingreso automático;
* solicitud con aprobación;
* cupo completo;
* invitaciones;
* abandono;
* remoción;
* cancelación;
* relación con reserva;
* edición de horario;
* reducción inválida de cupos;
* autorización del organizador;
* concurrencia al aceptar el último cupo.

---

# Reglas principales

1. Todo partido tiene un organizador.
2. Un partido puede existir sin club ni reserva.
3. Un partido vinculado a una reserva debe ser compatible con ella.
4. Solo participantes confirmados ocupan cupo.
5. No se puede superar el máximo de participantes.
6. La aprobación del último cupo debe ser transaccional.
7. Un usuario no puede participar dos veces.
8. Solo el organizador puede administrar participantes.
9. Los partidos cancelados no aceptan jugadores.
10. El nivel es informativo en el MVP.
11. Los equipos se representan únicamente con `teamNumber`.
12. Cancelar un partido no cancela automáticamente la reserva.
13. Los cambios importantes deben notificarse.
14. Los partidos privados no aparecen en búsquedas.
15. Toda transición debe ejecutarse mediante un caso de uso explícito.

---

# Principio final

MATCHES debe permitir organizar partidos y completar cupos con la menor complejidad posible.

El MVP se concentra en organizador, participantes, invitaciones, solicitudes, cupos y estado del partido, dejando resultados, estadísticas y formación avanzada para etapas posteriores.
