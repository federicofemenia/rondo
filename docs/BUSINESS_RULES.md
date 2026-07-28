# BUSINESS RULES

# Objetivo

Este documento define las reglas funcionales y de negocio oficiales de Rondo.

Todas las funcionalidades implementadas en el sistema deberán respetar estas reglas.

En caso de conflicto entre la implementación y este documento, prevalecerán las reglas aquí definidas.

---

# Principios generales

## El deporte es el centro del producto

Rondo existe para facilitar la organización de actividades deportivas.

Todas las funcionalidades deberán aportar valor antes, durante o después del partido.

---

## El partido es la entidad principal

El Match representa un encuentro deportivo.

Todo gira alrededor del partido:

- jugadores
- reservas
- chat
- invitaciones
- valoraciones
- notificaciones

---

## Club y partido son conceptos distintos

Un partido puede existir:

- sin club
- con club

Un club puede existir sin partidos.

No existe dependencia obligatoria entre ambos.

---

## Reserva y partido son entidades independientes

Un Match puede existir sin una reserva.

Una Booking puede existir sin un Match.

Cuando corresponda podrán asociarse mediante bookingId.

---

# Usuarios

Todo usuario registrado podrá:

- crear partidos abiertos
- participar en partidos
- recibir invitaciones
- valorar jugadores
- recibir valoraciones

No es obligatorio pertenecer a un club para utilizar Rondo.

---

# Membresías

Las membresías representan la relación entre un usuario y un club.

Estados posibles:

- Pending
- Active
- Rejected
- Suspended

---

# Registro

El registro nunca solicitará seleccionar un club.

Datos mínimos:

- nombre
- apellido
- email
- teléfono
- contraseña

Opcionales:

- foto
- deportes favoritos

---

# Asociación a un club

La asociación a un club se solicitará únicamente cuando el usuario intente utilizar funcionalidades propias del club.

Por ejemplo:

- reservar una cancha
- crear un partido dentro del club

Nunca durante el registro.

---

# Reservas

Para reservar una cancha se requiere:

- membresía activa
- cancha disponible
- horario disponible

---

# Partidos

## Creación

Todo usuario podrá crear un Match.

Al crearlo se genera inmediatamente un identificador único.

No es necesario tener jugadores confirmados.

No es necesario tener una reserva.

No es necesario pertenecer a un club.

---

## Estados

Los estados posibles son:

- Draft
- Recruiting
- Full
- Scheduled
- In Progress
- Finished
- Cancelled

---

## Participantes

Cada participante tendrá un estado independiente.

Estados posibles:

- Pending
- Confirmed
- Declined
- Removed

---

## Capacidad

Cada deporte define su cantidad máxima de participantes.

Cuando se alcanza el máximo el Match pasa automáticamente a estado Full.

---

# Reserva asociada

Un partido podrá asociarse posteriormente a una reserva.

La asociación nunca genera un nuevo Match.

Siempre se mantiene el mismo identificador.

---

# Flujo permitido

Rondo soporta ambos escenarios.

Escenario A

Crear partido

↓

Invitar jugadores

↓

Completar equipo

↓

Reservar cancha

Escenario B

Reservar cancha

↓

Crear partido

↓

Completar equipo

---

# Chat

Cada Match crea automáticamente un chat.

No requiere ninguna acción adicional.

---

## Acceso

Podrán acceder:

- organizador
- participantes confirmados

Los usuarios removidos perderán el acceso.

---

## Duración

El chat permanecerá activo:

desde la creación del Match

hasta 24 horas posteriores a su finalización.

Luego será cerrado automáticamente.

---

## Eliminación

Una vez cerrado:

- deja de ser visible
- no admite nuevos mensajes

La estrategia de eliminación física será definida por la arquitectura técnica.

---

# Invitaciones

Las invitaciones podrán enviarse únicamente a usuarios compatibles.

Compatibilidad:

- mismo deporte
- disponible
- sin conflicto horario

---

# Valoraciones

Las valoraciones estarán disponibles únicamente cuando el partido haya finalizado.

---

## Quién puede valorar

Todo participante confirmado podrá valorar a cualquier otro participante.

Restricciones:

- no puede valorarse a sí mismo
- una valoración por usuario y partido

---

## Aspectos evaluados

Cada valoración tendrá:

Nivel de juego

1 a 5 estrellas

Conducta

1 a 5 estrellas

Comentario opcional.

---

# Reputación

La reputación será calculada automáticamente.

Indicadores:

- promedio de juego
- promedio de conducta
- cantidad de valoraciones

---

# Jugador de la cancha

Una vez cerrado el período de valoraciones:

Rondo calculará automáticamente:

Jugador de la Cancha

utilizando únicamente el promedio de Game Rating.

También calculará:

Mejor Compañero

utilizando Behavior Rating.

---

# Notificaciones

El sistema podrá enviar notificaciones por:

- invitaciones
- nuevos participantes
- mensajes del chat
- cambios de horario
- cancelaciones
- promociones
- recordatorios

---

# Promociones

Las promociones de un club únicamente podrán enviarse a sus miembros.

Nunca a usuarios externos.

---

# Disponibilidad

Cada usuario podrá activar o desactivar:

Disponible para invitaciones.

Cuando esté desactivado:

- no aparecerá en búsquedas
- no recibirá invitaciones

---

# Auditoría

Todas las acciones relevantes deberán registrarse.

Ejemplos:

- creación de partido
- cancelaciones
- reservas
- membresías
- valoraciones

---

# Eliminaciones

Las entidades funcionales nunca deberán eliminarse sin respetar las reglas del negocio.

La estrategia de eliminación será definida por cada dominio.

---

# Reglas futuras

Las nuevas funcionalidades deberán mantener los principios definidos en este documento.

Ninguna implementación podrá romper las reglas existentes sin actualizar previamente este documento.