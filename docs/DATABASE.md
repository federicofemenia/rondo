# DATABASE

# Objetivo

Este documento define el modelo de datos oficial de Rondo.

Su objetivo es describir las entidades del dominio, sus relaciones y las reglas generales de persistencia.

No representa el esquema SQL definitivo, sino el modelo funcional que servirá como base para el diseño físico de la base de datos.

---

# Base de datos

Motor seleccionado:

PostgreSQL

Proveedor inicial:

Neon

La base de datos deberá diseñarse pensando en:

- escalabilidad
- integridad
- auditoría
- futuras integraciones
- consultas eficientes

---

# Convenciones

Todas las tablas deberán utilizar:

- UUID como clave primaria
- created_at
- updated_at

Cuando corresponda:

- deleted_at
- created_by
- updated_by

Las claves foráneas deberán mantener integridad referencial.

---

# Dominios principales

El dominio de Rondo se compone de las siguientes entidades.

## Usuarios

Representan personas registradas en la plataforma.

Entidad:

User

Responsabilidades:

- autenticación
- perfil
- deportes
- reputación
- disponibilidad

---

## Clubes

Entidad:

Club

Representa un club deportivo.

Un club administra:

- canchas
- promociones
- reservas
- miembros

---

## Membresías

Entidad:

ClubMembership

Relaciona usuarios con clubes.

Un usuario puede pertenecer a varios clubes.

Un club posee múltiples miembros.

---

## Deportes

Entidad:

Sport

Representa un deporte soportado por la plataforma.

Ejemplos:

- fútbol
- pádel
- tenis
- básquet

Cada deporte define reglas propias como:

- cantidad máxima de jugadores
- cantidad mínima
- duración sugerida

---

## Canchas

Entidad:

Court

Representa un espacio físico perteneciente a un club.

Ejemplos:

- Cancha 1
- Cancha 2
- Paddle A
- Paddle B

Cada cancha pertenece únicamente a un club.

---

## Reservas

Entidad:

Booking

Representa la ocupación de una cancha.

Una reserva puede existir:

- con Match
- sin Match

booking.matchId es opcional.

---

## Partidos

Entidad:

Match

Representa un encuentro deportivo.

Es la entidad principal del sistema.

Puede existir:

- con club
- sin club
- con reserva
- sin reserva

---

## Participantes

Entidad:

MatchParticipant

Representa la participación de un usuario dentro de un Match.

Permite almacenar:

- estado
- fecha de ingreso
- rol

---

## Chat

Entidad:

MatchChat

Existe exactamente un chat por Match.

Su ciclo de vida depende del partido.

---

## Mensajes

Entidad:

MatchChatMessage

Representa cada mensaje enviado dentro del chat.

Puede ser:

- USER
- SYSTEM

---

## Valoraciones

Entidad:

PlayerReview

Representa la valoración de un jugador hacia otro.

Cada combinación:

Reviewer

+

Reviewed User

+

Match

Debe ser única.

---

## Configuración de notificaciones

Entidad:

NotificationSettings

Define las preferencias de cada usuario.

---

## Suscripciones Push

Entidad:

PushSubscription

Representa cada dispositivo habilitado para recibir notificaciones.

Un usuario puede poseer múltiples dispositivos.

---

## Promociones

Entidad:

Promotion

Representa promociones creadas por un club.

---

## Auditoría

Entidad:

AuditLog

Registra acciones relevantes del sistema.

---

# Relaciones

User

↓

ClubMembership

↓

Club

---

Club

↓

Court

↓

Booking

---

Match

↓

MatchParticipant

↓

User

---

Match

↓

MatchChat

↓

MatchChatMessage

---

Match

↓

PlayerReview

↓

User

---

Club

↓

Promotion

---

User

↓

NotificationSettings

↓

PushSubscription

---

# Relaciones importantes

## Match

Puede relacionarse con:

- Club
- Booking
- Sport

Todas esas relaciones son opcionales excepto Sport.

---

## Booking

Siempre pertenece a:

- un Club
- una Court

Puede o no estar asociada a un Match.

---

## Club

Nunca depende de un Match.

---

## Chat

Siempre depende de un Match.

Nunca podrá existir sin él.

---

## PlayerReview

Siempre depende de:

- Match
- Reviewer
- Reviewed User

---

# Eliminación

Las entidades no deberán eliminarse físicamente salvo casos específicos.

Se privilegiará Soft Delete.

Excepciones:

- mensajes expirados
- push subscriptions inválidas
- datos temporales

---

# Índices

La estrategia definitiva de índices será definida durante la implementación.

Como mínimo deberán optimizarse:

- búsqueda de jugadores
- reservas
- disponibilidad
- invitaciones
- partidos activos

---

# Auditoría

Las entidades críticas deberán registrar:

- fecha de creación
- fecha de modificación
- usuario responsable

Cuando corresponda:

- motivo del cambio

---

# Escalabilidad

El modelo deberá permitir incorporar futuras funcionalidades sin modificar las entidades principales.

Ejemplos:

- torneos
- ligas
- pagos
- ranking
- estadísticas
- IA
- múltiples organizaciones

---

# Principio de diseño

Las entidades representan conceptos reales del dominio.

La base de datos nunca deberá diseñarse únicamente pensando en la implementación técnica.

El dominio siempre tendrá prioridad sobre la persistencia.