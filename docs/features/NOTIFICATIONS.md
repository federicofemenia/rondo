# NOTIFICATIONS

# Objetivo

Este documento define el sistema de notificaciones del MVP de Rondo.

Su objetivo es informar a los usuarios sobre eventos importantes sin convertirse en un sistema de mensajería.

En el MVP las notificaciones serán **dentro de la aplicación** (in-app). Las notificaciones push y los emails podrán incorporarse más adelante.

---

# Responsabilidades

El dominio `NOTIFICATIONS` administra:

* creación de notificaciones;
* estado de lectura;
* listado del usuario;
* eliminación lógica.

No administra:

* chat;
* emails;
* push notifications;
* SMS.

---

# Entidad Notification

```ts
interface Notification {
  id: NotificationId;

  userId: UserId;

  type: NotificationType;

  title: string;
  message: string;

  entityType?: NotificationEntityType;
  entityId?: string;

  isRead: boolean;

  createdAt: Date;
  readAt?: Date;
}
```

---

# Tipos de notificación

```ts
enum NotificationType {
  MATCH_INVITATION = 'MATCH_INVITATION',
  MATCH_JOIN_REQUEST = 'MATCH_JOIN_REQUEST',
  MATCH_JOIN_ACCEPTED = 'MATCH_JOIN_ACCEPTED',
  MATCH_JOIN_REJECTED = 'MATCH_JOIN_REJECTED',
  MATCH_CANCELLED = 'MATCH_CANCELLED',

  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED',
}
```

---

# Entidad relacionada

Una notificación puede apuntar a una entidad.

```ts
enum NotificationEntityType {
  MATCH = 'MATCH',
  BOOKING = 'BOOKING',
}
```

Ejemplo:

```text
MATCH
id = match_uuid
```

Esto permite abrir directamente el detalle desde la notificación.

---

# Estado

Una notificación puede estar:

* no leída;
* leída.

```ts
isRead: boolean
```

No se necesita un estado más complejo para el MVP.

---

# Casos que generan notificaciones

## Partidos

* recibiste una invitación;
* alguien solicitó unirse a tu partido;
* aceptaron tu solicitud;
* rechazaron tu solicitud;
* el partido fue cancelado.

## Reservas

* reserva confirmada;
* reserva cancelada;
* reserva reprogramada.

---

# Casos de uso

```text
CreateNotification
ListMyNotifications
MarkNotificationAsRead
MarkAllNotificationsAsRead
```

---

# Endpoints

```http
GET /api/v1/users/me/notifications

POST /api/v1/notifications/:notificationId/read

POST /api/v1/users/me/notifications/read-all
```

---

# Persistencia

## Tabla notifications

Campos:

```text
id
user_id
type
title
message
entity_type
entity_id
is_read
created_at
read_at
```

Índices sugeridos:

```text
user_id
is_read
created_at
```

---

# Seguridad

Cada usuario solo puede acceder a sus propias notificaciones.

No debe ser posible consultar una notificación por ID sin validar el propietario.

---

# Reglas principales

1. Toda notificación pertenece a un único usuario.
2. Una notificación nunca se modifica, salvo su estado de lectura.
3. Las notificaciones se ordenan por fecha descendente.
4. Solo el propietario puede marcarlas como leídas.
5. El sistema de notificaciones no reemplaza al chat.

---

# Principio final

En el MVP, NOTIFICATIONS debe mantener informado al usuario sobre cambios importantes en reservas y partidos mediante un sistema simple, rápido y desacoplado del resto de los dominios.
