# ARCHITECTURE

# Objetivo

Este documento define la arquitectura oficial de Rondo.

Toda nueva funcionalidad deberá respetar los principios aquí establecidos.

La arquitectura fue diseñada para priorizar:

- mantenibilidad
- escalabilidad
- testabilidad
- desacoplamiento
- reutilización
- evolución del producto

---

# Filosofía

La arquitectura debe representar el dominio del negocio y no las tecnologías utilizadas.

El código debe organizarse alrededor de los conceptos del negocio.

No alrededor de React, Express o PostgreSQL.

---

# Principios

## Dominio primero

Las reglas del negocio viven en el dominio.

Nunca deberán depender de:

- React
- Material UI
- PostgreSQL
- APIs externas
- librerías

---

## Separación de responsabilidades

Cada capa tiene una única responsabilidad.

La UI no contiene lógica de negocio.

Los servicios externos no conocen el dominio.

La infraestructura únicamente implementa contratos.

---

## Dependencia hacia el centro

Las dependencias siempre apuntan hacia el dominio.

Nunca al revés.

```text
UI
↓

Application
↓

Domain

↑

Infrastructure
```

---

# Arquitectura elegida

Rondo utiliza una arquitectura basada en:

- Domain Driven Design
- Clean Architecture
- Hexagonal Architecture
- Feature Based Organization

---

# Capas

## Domain

Representa el negocio.

Contiene:

- entidades
- value objects
- reglas
- contratos
- eventos
- errores

No conoce ninguna tecnología.

---

## Application

Coordina casos de uso.

Ejemplos:

- crear partido
- reservar cancha
- unirse a un club
- enviar invitación

No contiene reglas propias.

Orquesta el dominio.

---

## Infrastructure

Implementa adaptadores.

Ejemplos:

- PostgreSQL
- Push Notifications
- Object Storage
- Email
- APIs externas

---

## Presentation

Representa la interfaz.

Incluye:

- React
- páginas
- componentes
- hooks
- navegación

No contiene reglas del negocio.

---

# Organización del proyecto

```text
apps/

web/
api/

packages/

domain/
application/
shared/
config/

docs/
```

---

# Organización interna

Cada dominio mantiene su propia estructura.

Ejemplo:

```text
matches/

domain/
application/
infrastructure/
presentation/
```

Cada dominio es independiente.

---

# Comunicación

Los dominios se comunican mediante interfaces.

Nunca mediante dependencias directas.

---

# Casos de uso

Cada acción importante del usuario representa un caso de uso.

Ejemplos:

CreateMatch

JoinMatch

CreateBooking

CreateReview

JoinClub

---

# Entidades

Las entidades representan conceptos del negocio.

Ejemplos:

User

Match

Booking

Club

Court

PlayerReview

---

# Value Objects

Se utilizarán siempre que representen conceptos con reglas propias.

Ejemplos:

Email

PhoneNumber

MatchStatus

BookingStatus

Rating

---

# Eventos de dominio

Las acciones importantes podrán generar eventos.

Ejemplos:

MatchCreated

PlayerJoinedMatch

BookingCreated

MatchFinished

ChatClosed

ReviewCreated

---

# Servicios de dominio

La lógica compartida entre entidades se implementará mediante servicios de dominio.

Ejemplos:

MatchInvitationService

PlayerRankingService

BookingValidationService

---

# Adaptadores

Todo acceso externo deberá realizarse mediante adaptadores.

Ejemplos:

UserRepository

BookingRepository

PushNotificationProvider

ImageStorageProvider

MapsProvider

---

# Dependencias externas

Las dependencias deberán ocultarse detrás de interfaces.

Ejemplo:

```text
ImageStorage

↓

ImageStorageProvider

↓

Cloudflare R2

Amazon S3

Supabase Storage
```

El dominio nunca conocerá el proveedor real.

---

# Mobile First

Toda decisión arquitectónica deberá permitir una futura aplicación móvil.

Por este motivo se abstraerán servicios como:

LocationProvider

CameraProvider

NotificationProvider

ShareProvider

StorageProvider

DeepLinkProvider

---

# Estado de la aplicación

El estado del servidor y el estado local deberán mantenerse separados.

Servidor:

TanStack Query

Cliente:

Context API o Zustand cuando corresponda.

---

# Navegación

La navegación pertenece exclusivamente a la capa Presentation.

Nunca al dominio.

---

# Validaciones

Las validaciones críticas siempre pertenecen al dominio.

Las validaciones visuales pertenecen a la UI.

---

# Persistencia

Toda persistencia se realiza mediante repositorios.

Nunca mediante acceso directo desde los casos de uso.

---

# Testing

La arquitectura deberá facilitar:

- unit testing
- integration testing
- end-to-end testing

Las pruebas unitarias no deberán depender de infraestructura.

---

# Escalabilidad

La arquitectura deberá permitir incorporar:

- nuevos deportes
- múltiples países
- múltiples idiomas
- pagos
- torneos
- IA
- aplicación móvil

sin modificar el núcleo del dominio.

---

# Regla principal

Toda nueva funcionalidad deberá responder una pregunta:

¿Pertenece al dominio, a la aplicación, a la infraestructura o a la presentación?

Si una responsabilidad no está claramente definida, la implementación deberá revisarse antes de escribirse.