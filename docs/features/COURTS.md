# COURTS

# Objetivo

Este documento define el dominio de canchas de Rondo.

Su propósito es establecer:

* qué representa una cancha;
* cómo se relaciona con un club y una sede;
* qué deportes y modalidades admite;
* cómo se administra su disponibilidad;
* cómo se modelan superficies, capacidades y características;
* cómo se gestionan horarios, cierres y mantenimientos;
* qué reglas deben validarse antes de crear una reserva;
* cómo se garantiza el aislamiento multi-club.

El dominio `COURTS` administra los espacios deportivos concretos.

No administra reservas ni partidos, aunque aporta la información necesaria para que esos dominios puedan operar.

---

# Definición

Una cancha representa un espacio físico reservable dentro de una sede.

Ejemplos:

* cancha de fútbol 5;
* cancha de fútbol 7;
* cancha de pádel;
* cancha de tenis;
* cancha de básquet;
* cancha de vóley;
* espacio multipropósito.

Toda cancha pertenece a:

```text
Club
  ↓
Sede
  ↓
Cancha
```

---

# Responsabilidades

El dominio `COURTS` administra:

* identidad de la cancha;
* club propietario;
* sede;
* nombre;
* descripción;
* deporte;
* modalidades compatibles;
* superficie;
* capacidad;
* estado operativo;
* características;
* imágenes;
* reglas de disponibilidad;
* horarios;
* cierres;
* bloqueos;
* mantenimiento;
* visibilidad;
* configuración base de reserva.

No administra directamente:

* reservas concretas;
* pagos;
* partidos;
* usuarios;
* promociones;
* reputación;
* chats.

---

# Entidad Court

Modelo conceptual:

```ts
interface Court {
  id: CourtId;

  clubId: ClubId;
  venueId: ClubVenueId;

  name: string;
  code?: string;
  description?: string;

  sportId: SportId;
  primaryModalityId?: SportModalityId;
  surfaceTypeId?: SurfaceTypeId;

  status: CourtStatus;
  visibility: CourtVisibility;

  minimumParticipants?: number;
  recommendedParticipants?: number;
  maximumParticipants?: number;

  defaultBookingDurationMinutes?: number;
  minimumBookingDurationMinutes?: number;
  maximumBookingDurationMinutes?: number;
  bookingDurationStepMinutes?: number;

  isIndoor: boolean;
  hasLighting: boolean;
  hasRoof: boolean;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

---

# Identificador

```ts
type CourtId = string;
```

Reglas:

* UUID;
* único;
* inmutable;
* generado por Rondo;
* no reutilizable.

---

# Pertenencia

Toda cancha deberá incluir:

```ts
clubId: ClubId;
venueId: ClubVenueId;
```

Reglas:

* la sede debe pertenecer al mismo club;
* la cancha no puede cambiar de club directamente;
* el cambio de sede solo será posible dentro del mismo club;
* toda consulta deberá validar `clubId`;
* el identificador de cancha no reemplaza la autorización.

---

# Nombre

Toda cancha tendrá:

```ts
name: string;
```

Ejemplos:

```text
Cancha 1
Pádel Central
Fútbol 5 Norte
Estadio Cubierto
```

Reglas:

* obligatorio;
* visible para usuarios;
* editable;
* único dentro de una sede cuando el club lo requiera;
* longitud limitada;
* sin espacios innecesarios.

Restricción recomendada:

```text
venue_id + normalized_name
```

---

# Código interno

Campo opcional:

```ts
code?: string;
```

Ejemplos:

```text
F5-01
PAD-A
TENIS-CENTRAL
```

Puede utilizarse para:

* operación interna;
* recepción;
* cartelería;
* integraciones;
* reportes;
* importaciones.

El código podrá ser único por club o sede.

---

# Descripción

Campo opcional:

```ts
description?: string;
```

Puede incluir:

* ubicación dentro de la sede;
* características;
* tipo de césped;
* recomendaciones;
* restricciones;
* información de acceso.

En el MVP será texto plano.

---

# Deporte principal

Toda cancha deberá estar asociada a:

```ts
sportId: SportId;
```

El deporte deberá:

* existir;
* estar activo;
* estar habilitado por el club;
* ser compatible con la sede y configuración.

Una cancha no podrá referenciar un deporte que el club no ofrece.

---

# Modalidad principal

Campo recomendado:

```ts
primaryModalityId?: SportModalityId;
```

Ejemplos:

```text
Cancha de fútbol 5 → FOOTBALL_5
Cancha de pádel → PADEL_DOUBLES
Cancha de tenis → TENNIS_SINGLES
```

La modalidad deberá pertenecer al deporte de la cancha.

---

# Modalidades compatibles

Una cancha podrá admitir varias modalidades.

Ejemplo:

```text
Cancha de tenis
- Singles
- Dobles
```

Ejemplo:

```text
Cancha multipropósito
- Básquet 5x5
- Vóley 6
- Futsal
```

La relación podrá modelarse mediante:

```ts
interface CourtModality {
  courtId: CourtId;
  sportModalityId: SportModalityId;
  isPrimary: boolean;
  status: CourtModalityStatus;
}
```

---

# Regla de compatibilidad

Antes de crear una reserva deberá validarse:

* deporte de la reserva;
* modalidad solicitada;
* modalidad habilitada en la cancha;
* estado de la modalidad;
* capacidad;
* duración;
* configuración del club.

---

# Canchas multipropósito

Una cancha multipropósito podrá admitir más de un deporte.

En el MVP se recomienda evitar mezclar varios deportes directamente en la entidad principal.

Modelo recomendado:

```text
Court
  ↓
CourtSportConfiguration
```

---

# CourtSportConfiguration

Modelo conceptual:

```ts
interface CourtSportConfiguration {
  id: string;
  courtId: CourtId;
  sportId: SportId;
  primaryModalityId?: SportModalityId;
  status: CourtSportConfigurationStatus;
  isPrimary: boolean;
}
```

Esto permitirá que una misma cancha física sea utilizada para:

* futsal;
* básquet;
* vóley.

---

# Estrategia MVP

Para reducir complejidad inicial, el MVP podrá asumir:

* un deporte principal por cancha;
* varias modalidades del mismo deporte;
* soporte multipropósito preparado para una versión posterior.

La estructura no deberá impedir incorporar múltiples deportes.

---

# Superficie

Campo:

```ts
surfaceTypeId?: SurfaceTypeId;
```

Ejemplos:

* césped sintético;
* césped natural;
* polvo de ladrillo;
* cemento;
* parquet;
* carpeta;
* sintético de pádel.

La superficie deberá ser compatible con el deporte.

---

# Superficie personalizada

El club no debería crear superficies libres en el MVP.

Deberá utilizar el catálogo definido en `SPORTS.md`.

En versiones futuras podrá solicitar nuevas superficies o agregar una descripción comercial.

Ejemplo:

```text
Césped sintético de última generación
```

internamente asociado a:

```text
SYNTHETIC_GRASS
```

---

# Estado de la cancha

```ts
enum CourtStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
  MAINTENANCE = 'MAINTENANCE',
  DELETED = 'DELETED',
}
```

---

# Cancha en borrador

`DRAFT` representa una cancha creada pero no disponible.

Puede utilizarse mientras se configura:

* deporte;
* modalidad;
* superficie;
* horarios;
* precio;
* imágenes;
* reglas;
* capacidad.

No podrá recibir reservas.

---

# Cancha activa

`ACTIVE` representa una cancha operativa.

Puede:

* aparecer en búsquedas;
* recibir reservas;
* asociarse a partidos;
* utilizar promociones;
* mostrar disponibilidad.

---

# Cancha inactiva

`INACTIVE` representa una cancha fuera de operación sin una causa temporal específica.

No recibe reservas nuevas.

Conserva:

* historial;
* reservas anteriores;
* configuración;
* reportes.

Podrá reactivarse.

---

# Cierre temporal

`TEMPORARILY_CLOSED` representa un cierre por un período limitado.

Ejemplos:

* evento especial;
* clima;
* reforma;
* cierre parcial;
* decisión operativa.

Deberá asociarse preferentemente con un bloqueo de calendario.

---

# Mantenimiento

`MAINTENANCE` indica que la cancha no está disponible por tareas técnicas.

Ejemplos:

* reparación de iluminación;
* cambio de césped;
* pintura;
* red nueva;
* mantenimiento de piso.

No deberá aceptar reservas durante el período afectado.

---

# Cancha eliminada

`DELETED` representa una baja lógica.

No deberá borrarse físicamente cuando existan:

* reservas históricas;
* partidos;
* facturación;
* auditoría;
* reportes.

---

# Visibilidad

```ts
enum CourtVisibility {
  PUBLIC = 'PUBLIC',
  MEMBERS_ONLY = 'MEMBERS_ONLY',
  PRIVATE = 'PRIVATE',
  UNLISTED = 'UNLISTED',
}
```

---

# Pública

`PUBLIC`:

* aparece en búsquedas;
* puede reservarse según políticas;
* puede mostrarse en el perfil del club.

---

# Solo miembros

`MEMBERS_ONLY`:

* solo puede reservarse por miembros autorizados;
* podrá mostrarse públicamente o no, según configuración;
* requerirá membresía activa.

---

# Privada

`PRIVATE`:

* no se ofrece al público;
* se utiliza para actividades internas;
* solo puede gestionarse por administradores autorizados.

---

# No listada

`UNLISTED`:

* no aparece en búsquedas;
* puede accederse mediante enlace directo;
* puede utilizarse para pruebas o reservas privadas.

---

# Capacidad

La cancha podrá definir:

```ts
minimumParticipants?: number;
recommendedParticipants?: number;
maximumParticipants?: number;
```

Ejemplo:

```text
Fútbol 5
Mínimo: 2
Recomendado: 10
Máximo: 14
```

La capacidad deberá ser coherente con la modalidad.

---

# Capacidad y reservas

La reserva no deberá depender obligatoriamente de conocer todos los participantes.

Sin embargo, podrá validarse:

* cantidad estimada;
* capacidad máxima;
* modalidad;
* tipo de actividad.

Un club podrá permitir reservas sin informar cantidad de jugadores.

---

# Dimensiones

Campos opcionales:

```ts
lengthMeters?: number;
widthMeters?: number;
heightMeters?: number;
```

Podrán utilizarse para:

* información técnica;
* torneos;
* homologación;
* filtros;
* operación.

No son obligatorios para el MVP.

---

# Interior o exterior

Campo:

```ts
isIndoor: boolean;
```

Permite distinguir:

* cubierta;
* descubierta.

En el futuro podrá utilizarse en búsquedas y decisiones climáticas.

---

# Techo

Campo:

```ts
hasRoof: boolean;
```

No siempre equivale a `isIndoor`.

Ejemplo:

Una cancha puede tener techo abierto lateralmente.

---

# Iluminación

Campo:

```ts
hasLighting: boolean;
```

Permite informar si la cancha puede operar de noche.

La disponibilidad nocturna dependerá también de:

* horarios;
* políticas;
* funcionamiento real;
* mantenimiento.

---

# Características

Las canchas podrán tener atributos adicionales.

Ejemplos:

* vestuarios;
* duchas;
* estacionamiento;
* tribunas;
* redes;
* aire acondicionado;
* calefacción;
* accesibilidad;
* alquiler de equipamiento;
* marcador electrónico.

Modelo conceptual:

```ts
interface CourtFeature {
  id: CourtFeatureId;
  code: string;
  name: string;
  category: CourtFeatureCategory;
  status: CourtFeatureStatus;
}
```

---

# Relación CourtFeature

```ts
interface CourtFeatureAssignment {
  courtId: CourtId;
  featureId: CourtFeatureId;
  value?: string;
}
```

Ejemplos:

```text
HAS_LOCKER_ROOM
HAS_SHOWERS
HAS_PARKING
WHEELCHAIR_ACCESSIBLE
HAS_SCOREBOARD
EQUIPMENT_RENTAL
```

---

# Características estructuradas

No deberá utilizarse una lista de texto libre cuando el dato sea filtrable.

Ejemplo incorrecto:

```text
"Cancha con luces, estacionamiento y duchas"
```

Ejemplo correcto:

```text
HAS_LIGHTING
HAS_PARKING
HAS_SHOWERS
```

La descripción podrá complementar la información.

---

# Imágenes

Una cancha podrá tener varias imágenes.

Modelo conceptual:

```ts
interface CourtImage {
  id: CourtImageId;
  courtId: CourtId;
  url: string;
  altText?: string;
  displayOrder: number;
  isPrimary: boolean;
  createdAt: Date;
}
```

Las imágenes se almacenarán en Object Storage.

---

# Imagen principal

Solo una imagen deberá estar marcada como:

```ts
isPrimary: true;
```

La operación de cambio deberá ser transaccional.

---

# Validación de imágenes

Se deberá validar:

* formato;
* tamaño;
* cantidad máxima;
* ownership;
* contenido;
* dimensiones mínimas;
* orden;
* accesibilidad mediante texto alternativo.

---

# Duración de reserva

La cancha podrá definir:

```ts
defaultBookingDurationMinutes?: number;
minimumBookingDurationMinutes?: number;
maximumBookingDurationMinutes?: number;
bookingDurationStepMinutes?: number;
```

Ejemplo:

```text
Predeterminada: 60 minutos
Mínima: 60 minutos
Máxima: 120 minutos
Incremento: 30 minutos
```

---

# Regla de duración

Una duración válida deberá cumplir:

```text
duration >= minimum
duration <= maximum
duration compatible con step
```

Ejemplo:

```text
Mínimo: 60
Incremento: 30

Duraciones válidas:
60
90
120
```

---

# Herencia de duración

La duración se resolverá desde:

```text
SportModality
  ↓
Club
  ↓
Venue
  ↓
Court
```

La configuración más específica tendrá prioridad.

---

# Disponibilidad

La disponibilidad representa los intervalos en los que una cancha puede ser reservada.

Debe calcularse considerando:

* horario de sede;
* horario específico de cancha;
* excepciones;
* mantenimiento;
* bloqueos;
* reservas existentes;
* anticipación mínima;
* anticipación máxima;
* duración;
* buffers;
* estado;
* permisos;
* visibilidad.

---

# Regla principal

La disponibilidad no deberá almacenarse como una lista permanente de horarios libres.

Deberá calcularse a partir de reglas y ocupaciones.

---

# Horario semanal de cancha

Modelo conceptual:

```ts
interface CourtOperatingHours {
  id: string;
  courtId: CourtId;
  dayOfWeek: DayOfWeek;
  opensAt?: LocalTime;
  closesAt?: LocalTime;
  isClosed: boolean;
}
```

---

# Herencia de horarios

Una cancha podrá:

* heredar horarios de la sede;
* definir horarios propios;
* cerrar en determinados días;
* ampliar o reducir horarios si el club lo permite.

Modelo conceptual:

```ts
enum CourtScheduleMode {
  INHERIT_VENUE = 'INHERIT_VENUE',
  CUSTOM = 'CUSTOM',
}
```

---

# Ejemplo de horario

```text
Lunes a viernes
08:00 a 23:00

Sábado
09:00 a 01:00

Domingo
09:00 a 22:00
```

Los horarios que atraviesan medianoche deberán manejarse correctamente.

---

# Horarios que cruzan el día

Ejemplo:

```text
Sábado 20:00 a domingo 01:00
```

No deberá interpretarse como una hora de cierre anterior a la apertura.

La implementación podrá dividir el intervalo internamente.

---

# Zona horaria

Toda disponibilidad deberá interpretarse usando la zona horaria de la sede.

Las fechas persistidas deberán guardarse en UTC.

La interfaz deberá mostrar horarios en la zona local correspondiente.

---

# Excepciones de calendario

Una cancha podrá tener excepciones.

Modelo conceptual:

```ts
interface CourtScheduleException {
  id: string;
  courtId: CourtId;

  startsAt: Date;
  endsAt: Date;

  type: CourtScheduleExceptionType;
  isAvailable: boolean;
  reason?: string;

  createdByUserId: UserId;
  createdAt: Date;
}
```

---

# Tipos de excepción

```ts
enum CourtScheduleExceptionType {
  SPECIAL_OPENING = 'SPECIAL_OPENING',
  SPECIAL_CLOSURE = 'SPECIAL_CLOSURE',
  MAINTENANCE = 'MAINTENANCE',
  PRIVATE_EVENT = 'PRIVATE_EVENT',
  WEATHER = 'WEATHER',
  OTHER = 'OTHER',
}
```

---

# Apertura especial

`SPECIAL_OPENING` habilita un horario que normalmente estaría cerrado.

Ejemplo:

```text
Feriado abierto de 10:00 a 18:00
```

---

# Cierre especial

`SPECIAL_CLOSURE` bloquea un horario operativo.

Ejemplo:

```text
Cierre por evento institucional
```

---

# Mantenimiento

`MAINTENANCE` bloquea la cancha.

Puede incluir:

* motivo;
* responsable;
* fecha prevista;
* notas internas;
* estado.

---

# Evento privado

`PRIVATE_EVENT` reserva el espacio sin exponer una reserva pública convencional.

Ejemplos:

* torneo;
* evento corporativo;
* entrenamiento del club;
* clínica deportiva.

---

# Clima

`WEATHER` podrá utilizarse para cierres manuales por condiciones climáticas.

La automatización climática podrá incorporarse en el futuro.

---

# Bloqueos

Un bloqueo representa una ocupación administrativa.

Modelo conceptual:

```ts
interface CourtBlock {
  id: CourtBlockId;
  clubId: ClubId;
  venueId: ClubVenueId;
  courtId: CourtId;

  startsAt: Date;
  endsAt: Date;

  type: CourtBlockType;
  reason?: string;

  createdByUserId: UserId;
  status: CourtBlockStatus;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# Tipos de bloqueo

```ts
enum CourtBlockType {
  MAINTENANCE = 'MAINTENANCE',
  INTERNAL_USE = 'INTERNAL_USE',
  TOURNAMENT = 'TOURNAMENT',
  PRIVATE_EVENT = 'PRIVATE_EVENT',
  WEATHER = 'WEATHER',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  OTHER = 'OTHER',
}
```

---

# Estado de bloqueo

```ts
enum CourtBlockStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}
```

---

# Reglas de bloqueos

Un bloqueo:

* debe tener inicio y fin;
* no puede tener duración negativa;
* debe pertenecer al mismo club y sede;
* impide nuevas reservas;
* puede afectar reservas existentes;
* debe auditarse;
* puede cancelarse;
* no debe eliminarse físicamente.

---

# Bloqueos recurrentes

En versiones futuras podrá haber bloqueos recurrentes.

Ejemplo:

```text
Todos los martes de 18:00 a 20:00
Entrenamiento interno
```

Modelo conceptual:

```ts
interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: DayOfWeek[];
  endsAt?: Date;
  occurrenceCount?: number;
}
```

No es obligatorio para el MVP.

---

# Conflictos con reservas

Cuando se crea un bloqueo que se superpone con reservas existentes, el sistema deberá:

1. detectar conflictos;
2. impedir la creación automática o requerir confirmación administrativa;
3. listar reservas afectadas;
4. definir cancelación o reubicación;
5. notificar usuarios;
6. registrar auditoría.

No deberá cancelar reservas silenciosamente.

---

# Buffer entre reservas

La cancha podrá requerir tiempo entre turnos.

Campos:

```ts
bufferBeforeMinutes?: number;
bufferAfterMinutes?: number;
```

Ejemplos:

* limpieza;
* mantenimiento;
* cambio de jugadores;
* preparación;
* ingreso y salida.

---

# Ejemplo de buffer

Reserva:

```text
18:00 a 19:00
```

Buffer posterior:

```text
15 minutos
```

Próximo horario disponible:

```text
19:15
```

---

# Anticipación mínima

Campo:

```ts
minimumAdvanceMinutes?: number;
```

Ejemplo:

```text
La cancha debe reservarse al menos 60 minutos antes.
```

---

# Anticipación máxima

Campo:

```ts
maximumAdvanceDays?: number;
```

Ejemplo:

```text
La cancha puede reservarse con hasta 30 días de anticipación.
```

---

# Ventana de reservas

La disponibilidad deberá validar:

```text
now + minimumAdvance
bookingStart
now + maximumAdvance
```

El club podrá definir reglas diferentes por:

* miembros;
* invitados;
* administradores;
* promociones;
* cancha.

---

# Slot

Un slot es una representación calculada de un intervalo potencialmente reservable.

Modelo conceptual:

```ts
interface CourtAvailabilitySlot {
  courtId: CourtId;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  status: CourtAvailabilityStatus;
  reason?: CourtUnavailabilityReason;
}
```

---

# Estado de disponibilidad

```ts
enum CourtAvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  PARTIALLY_AVAILABLE = 'PARTIALLY_AVAILABLE',
}
```

Para el MVP podrá exponerse principalmente:

```text
AVAILABLE
UNAVAILABLE
```

---

# Motivos de indisponibilidad

```ts
enum CourtUnavailabilityReason {
  OUTSIDE_OPERATING_HOURS = 'OUTSIDE_OPERATING_HOURS',
  COURT_INACTIVE = 'COURT_INACTIVE',
  VENUE_INACTIVE = 'VENUE_INACTIVE',
  CLUB_INACTIVE = 'CLUB_INACTIVE',
  ALREADY_BOOKED = 'ALREADY_BOOKED',
  BLOCKED = 'BLOCKED',
  MAINTENANCE = 'MAINTENANCE',
  MINIMUM_ADVANCE_NOT_MET = 'MINIMUM_ADVANCE_NOT_MET',
  MAXIMUM_ADVANCE_EXCEEDED = 'MAXIMUM_ADVANCE_EXCEEDED',
  INVALID_DURATION = 'INVALID_DURATION',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',
}
```

---

# Consulta de disponibilidad

Ejemplo conceptual:

```http
GET /api/v1/clubs/:clubId/courts/:courtId/availability
  ?date=2026-07-28
  &durationMinutes=60
```

La respuesta deberá calcularse en tiempo real o mediante una estrategia de caché segura.

---

# Consulta por rango

También podrá consultarse:

```http
GET /api/v1/clubs/:clubId/courts/:courtId/availability
  ?from=2026-07-28T08:00:00
  &to=2026-07-28T23:00:00
  &durationMinutes=60
```

Los límites máximos del rango deberán evitar consultas excesivas.

---

# Concurrencia

Dos usuarios pueden intentar reservar el mismo horario.

La disponibilidad mostrada no garantiza por sí sola la reserva.

La creación definitiva deberá usar:

* transacción;
* bloqueo;
* restricción;
* validación final de superposición.

---

# Regla crítica

Antes de confirmar una reserva, `BOOKINGS` deberá volver a validar la disponibilidad.

Nunca deberá confiarse únicamente en una consulta previa.

---

# Detección de superposición

Dos intervalos se superponen cuando:

```text
newStart < existingEnd
AND
newEnd > existingStart
```

Los intervalos contiguos no se superponen.

Ejemplo:

```text
Reserva A: 18:00 a 19:00
Reserva B: 19:00 a 20:00
```

Son compatibles salvo que exista buffer.

---

# Exclusión de superposición

PostgreSQL podrá utilizar:

* rangos temporales;
* exclusion constraints;
* transacciones serializables;
* locks de aplicación.

La decisión técnica deberá registrarse en `TECH_DECISIONS.md`.

---

# Precio base

Aunque los precios se definan principalmente en `BOOKINGS`, la cancha podrá tener una referencia base.

Modelo conceptual:

```ts
interface CourtPricingReference {
  courtId: CourtId;
  currency: string;
  baseAmount?: number;
}
```

No se recomienda almacenar un único precio fijo si existen:

* franjas horarias;
* promociones;
* tipos de usuario;
* fines de semana;
* temporadas;
* duración variable.

La estrategia completa deberá documentarse en `BOOKINGS.md`.

---

# Disponibilidad pública

Una cancha activa no necesariamente está disponible públicamente.

La disponibilidad final depende de:

* visibilidad;
* membresía;
* permisos;
* configuración;
* estado;
* horario;
* ocupaciones;
* políticas.

---

# Canchas sin reserva online

Un club podrá publicar una cancha sin permitir reserva directa.

Campo posible:

```ts
onlineBookingEnabled: boolean;
```

Cuando sea `false`:

* podrá mostrarse información;
* no aparecerán slots reservables;
* podrá incluir contacto;
* recepción podrá crear reservas internas.

---

# Aprobación manual

Una cancha podrá requerir confirmación administrativa.

Campo:

```ts
bookingApprovalMode: CourtBookingApprovalMode;
```

Enum:

```ts
enum CourtBookingApprovalMode {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
  DISABLED = 'DISABLED',
}
```

---

# Reserva automática

`AUTOMATIC`:

* confirma si existe disponibilidad;
* aplica reglas;
* puede requerir pago;
* no necesita aprobación humana.

---

# Reserva manual

`MANUAL`:

* genera solicitud;
* bloquea o no bloquea temporalmente el horario según política;
* requiere revisión;
* puede aprobarse o rechazarse.

---

# Reserva deshabilitada

`DISABLED`:

* impide nuevas reservas;
* mantiene información pública;
* permite gestión interna cuando corresponda.

---

# Tiempo de retención

Durante un proceso de pago podrá existir una retención temporal.

Ejemplo:

```text
Horario retenido durante 10 minutos
```

La retención pertenecerá principalmente a `BOOKINGS`, pero COURTS deberá considerarla al calcular disponibilidad.

---

# Integración con CLUBS

CLUBS define:

* club;
* sede;
* deportes habilitados;
* configuración;
* permisos;
* horarios generales.

COURTS define:

* espacio concreto;
* características;
* reglas particulares;
* disponibilidad base.

---

# Integración con SPORTS

SPORTS define:

* deporte;
* modalidades;
* superficies;
* participantes;
* duraciones sugeridas.

COURTS utiliza ese catálogo.

No puede crear modalidades o superficies globales.

---

# Integración con BOOKINGS

BOOKINGS utiliza COURTS para:

* validar cancha;
* comprobar disponibilidad;
* calcular duración;
* aplicar buffers;
* validar visibilidad;
* consultar configuración;
* impedir superposición;
* asociar precio;
* confirmar horario.

---

# Integración con MATCHES

MATCHES podrá asociarse a una cancha mediante:

* reserva;
* relación directa administrativa;
* ubicación futura.

La cancha no deberá considerarse ocupada por un partido si no existe una reserva o bloqueo válido, salvo un flujo administrativo explícito.

---

# Integración con PROMOTIONS

PROMOTIONS podrá limitar beneficios por:

* club;
* sede;
* cancha;
* deporte;
* modalidad;
* horario;
* duración.

---

# Integración con SEARCH

SEARCH podrá filtrar por:

* deporte;
* modalidad;
* sede;
* distancia;
* superficie;
* cubierta;
* iluminación;
* capacidad;
* características;
* disponibilidad;
* visibilidad.

---

# Integración con NOTIFICATIONS

Eventos de cancha podrán generar notificaciones:

* cierre;
* mantenimiento;
* cambio de horario;
* reserva afectada;
* reactivación;
* reubicación.

---

# Casos de uso

El dominio deberá contemplar al menos:

```text
CreateCourt
UpdateCourt
GetCourt
GetPublicCourt
ListClubCourts
ListVenueCourts
ActivateCourt
DeactivateCourt
TemporarilyCloseCourt
ReopenCourt
DeleteCourt

AddCourtModality
RemoveCourtModality
SetPrimaryCourtModality

AddCourtFeature
RemoveCourtFeature

AddCourtImage
RemoveCourtImage
SetPrimaryCourtImage
ReorderCourtImages

ConfigureCourtSchedule
AddCourtScheduleException
RemoveCourtScheduleException

CreateCourtBlock
CancelCourtBlock
ListCourtBlocks

GetCourtAvailability
ValidateCourtAvailability
```

---

# CreateCourt

Debe validar:

* usuario autorizado;
* club existente;
* sede del mismo club;
* deporte habilitado;
* modalidad válida;
* superficie válida;
* nombre;
* capacidad;
* duración;
* configuración regional.

Estado inicial recomendado:

```text
DRAFT
```

---

# ActivateCourt

Solo podrá activarse cuando:

* club activo;
* sede activa;
* deporte habilitado;
* configuración mínima completa;
* modalidad válida;
* horarios disponibles o heredados;
* reglas de reserva válidas.

---

# UpdateCourt

Permite modificar:

* nombre;
* descripción;
* código;
* características;
* modalidad;
* superficie;
* capacidad;
* imágenes;
* configuración de reserva.

Los cambios que afecten reservas existentes deberán validarse.

---

# Cambio de deporte

Cambiar el deporte principal de una cancha activa es una operación sensible.

Solo debería permitirse cuando:

* no existan reservas futuras incompatibles;
* no existan bloqueos relacionados;
* se revaliden modalidades;
* se revaliden superficies;
* se actualicen configuraciones;
* se audite.

En muchos casos será preferible crear una nueva configuración.

---

# DeactivateCourt

Impide reservas nuevas.

Debe detectar:

* reservas futuras;
* partidos asociados;
* bloqueos;
* promociones.

No deberá cancelar automáticamente reservas existentes.

---

# TemporarilyCloseCourt

Debe requerir:

* inicio;
* fin;
* motivo;
* responsable.

Deberá analizar reservas afectadas.

---

# ReopenCourt

Finaliza un cierre temporal cuando sea válido.

No deberá ignorar bloqueos o mantenimientos todavía activos.

---

# CreateCourtBlock

Debe validar:

* permisos;
* intervalo;
* sede;
* cancha;
* conflictos;
* motivo;
* estado.

Puede requerir una estrategia especial si existen reservas.

---

# CancelCourtBlock

Cancela el bloqueo.

Debe:

* registrar responsable;
* conservar historial;
* recalcular disponibilidad;
* notificar cuando corresponda.

---

# GetCourtAvailability

Recibe:

* cancha;
* rango;
* duración;
* usuario opcional;
* modalidad;
* contexto de club.

Devuelve slots válidos.

Debe respetar permisos y políticas.

---

# ValidateCourtAvailability

Valida un intervalo concreto.

Ejemplo conceptual:

```ts
interface ValidateCourtAvailabilityInput {
  clubId: ClubId;
  courtId: CourtId;
  startsAt: Date;
  endsAt: Date;
  sportModalityId?: SportModalityId;
  requesterUserId?: UserId;
}
```

Respuesta:

```ts
interface ValidateCourtAvailabilityResult {
  available: boolean;
  reason?: CourtUnavailabilityReason;
}
```

---

# Eventos de dominio

Eventos sugeridos:

```text
CourtCreated
CourtUpdated
CourtActivated
CourtDeactivated
CourtTemporarilyClosed
CourtReopened
CourtDeleted

CourtModalityAdded
CourtModalityRemoved
CourtPrimaryModalityChanged

CourtFeatureAdded
CourtFeatureRemoved

CourtImageAdded
CourtImageRemoved
CourtPrimaryImageChanged

CourtScheduleUpdated
CourtScheduleExceptionCreated
CourtScheduleExceptionRemoved

CourtBlockCreated
CourtBlockCancelled
CourtMaintenanceScheduled
CourtMaintenanceCompleted
```

---

# Endpoints iniciales

Ejemplos conceptuales:

```http
GET /api/v1/clubs/:clubId/courts
POST /api/v1/clubs/:clubId/courts

GET /api/v1/clubs/:clubId/courts/:courtId
PATCH /api/v1/clubs/:clubId/courts/:courtId
DELETE /api/v1/clubs/:clubId/courts/:courtId

POST /api/v1/clubs/:clubId/courts/:courtId/activation
POST /api/v1/clubs/:clubId/courts/:courtId/deactivation
POST /api/v1/clubs/:clubId/courts/:courtId/temporary-closure
POST /api/v1/clubs/:clubId/courts/:courtId/reopening

GET /api/v1/clubs/:clubId/courts/:courtId/modalities
POST /api/v1/clubs/:clubId/courts/:courtId/modalities
DELETE /api/v1/clubs/:clubId/courts/:courtId/modalities/:modalityId

GET /api/v1/clubs/:clubId/courts/:courtId/features
POST /api/v1/clubs/:clubId/courts/:courtId/features
DELETE /api/v1/clubs/:clubId/courts/:courtId/features/:featureId

GET /api/v1/clubs/:clubId/courts/:courtId/images
POST /api/v1/clubs/:clubId/courts/:courtId/images
DELETE /api/v1/clubs/:clubId/courts/:courtId/images/:imageId
POST /api/v1/clubs/:clubId/courts/:courtId/images/:imageId/set-primary

GET /api/v1/clubs/:clubId/courts/:courtId/schedule
PUT /api/v1/clubs/:clubId/courts/:courtId/schedule

GET /api/v1/clubs/:clubId/courts/:courtId/blocks
POST /api/v1/clubs/:clubId/courts/:courtId/blocks
POST /api/v1/clubs/:clubId/courts/:courtId/blocks/:blockId/cancellation

GET /api/v1/clubs/:clubId/courts/:courtId/availability
POST /api/v1/clubs/:clubId/courts/:courtId/availability-validation
```

---

# Perfil público de cancha

Ruta conceptual:

```text
/clubs/:clubSlug/courts/:courtId
```

Podrá mostrar:

* nombre;
* imágenes;
* deporte;
* modalidades;
* superficie;
* capacidad;
* características;
* sede;
* horarios;
* disponibilidad;
* precio orientativo;
* políticas;
* promociones.

---

# Respuesta pública

Ejemplo conceptual:

```json
{
  "id": "court_uuid",
  "name": "Cancha 1",
  "description": "Cancha de fútbol 5 con césped sintético",
  "sport": {
    "id": "sport_uuid",
    "code": "FOOTBALL",
    "name": "Fútbol"
  },
  "modalities": [
    {
      "id": "modality_uuid",
      "code": "FOOTBALL_5",
      "name": "Fútbol 5",
      "isPrimary": true
    }
  ],
  "surface": {
    "id": "surface_uuid",
    "code": "SYNTHETIC_GRASS",
    "name": "Césped sintético"
  },
  "capacity": {
    "minimum": 2,
    "recommended": 10,
    "maximum": 14
  },
  "features": [
    "HAS_LIGHTING",
    "HAS_SHOWERS",
    "HAS_PARKING"
  ],
  "isIndoor": false,
  "hasRoof": false,
  "hasLighting": true,
  "visibility": "PUBLIC",
  "onlineBookingEnabled": true
}
```

---

# Persistencia conceptual

Tabla principal:

```text
courts
```

Campos sugeridos:

```text
id
club_id
venue_id
name
normalized_name
code
description
sport_id
primary_modality_id
surface_type_id
status
visibility
minimum_participants
recommended_participants
maximum_participants
default_booking_duration_minutes
minimum_booking_duration_minutes
maximum_booking_duration_minutes
booking_duration_step_minutes
buffer_before_minutes
buffer_after_minutes
minimum_advance_minutes
maximum_advance_days
is_indoor
has_roof
has_lighting
online_booking_enabled
booking_approval_mode
schedule_mode
created_at
updated_at
deleted_at
```

---

# Restricciones de courts

Restricciones recomendadas:

```text
id único
club_id obligatorio
venue_id obligatorio
sport_id obligatorio
venue perteneciente al club
duraciones positivas
minimum <= recommended <= maximum
buffer >= 0
advance >= 0
```

Restricción única opcional:

```text
venue_id + normalized_name
```

---

# Tabla de modalidades de cancha

```text
court_modalities
```

Campos:

```text
court_id
sport_modality_id
is_primary
status
created_at
updated_at
```

Restricción:

```text
court_id + sport_modality_id
```

Solo una modalidad principal por cancha.

---

# Tabla de deportes de cancha

Para soporte multipropósito futuro:

```text
court_sport_configurations
```

Campos:

```text
id
court_id
sport_id
primary_modality_id
status
is_primary
created_at
updated_at
```

---

# Tabla de características

```text
court_features
```

Campos:

```text
id
code
name
category
status
created_at
updated_at
```

---

# Tabla de asignaciones

```text
court_feature_assignments
```

Campos:

```text
court_id
feature_id
value
created_at
```

Restricción:

```text
court_id + feature_id
```

---

# Tabla de imágenes

```text
court_images
```

Campos:

```text
id
court_id
url
alt_text
display_order
is_primary
created_at
```

Índice:

```text
court_images.court_id
```

---

# Tabla de horarios

```text
court_operating_hours
```

Campos:

```text
id
court_id
day_of_week
opens_at
closes_at
is_closed
created_at
updated_at
```

Restricción:

```text
court_id + day_of_week
```

Si se permiten múltiples franjas por día, la restricción deberá incluir un identificador de tramo.

---

# Tabla de excepciones

```text
court_schedule_exceptions
```

Campos:

```text
id
court_id
starts_at
ends_at
type
is_available
reason
created_by_user_id
created_at
updated_at
```

---

# Tabla de bloqueos

```text
court_blocks
```

Campos:

```text
id
club_id
venue_id
court_id
starts_at
ends_at
type
reason
status
created_by_user_id
cancelled_by_user_id
cancelled_at
created_at
updated_at
```

---

# Índices sugeridos

```text
courts.club_id
courts.venue_id
courts.sport_id
courts.status
courts.visibility

court_modalities.court_id
court_modalities.sport_modality_id

court_feature_assignments.court_id

court_schedule_exceptions.court_id
court_schedule_exceptions.starts_at
court_schedule_exceptions.ends_at

court_blocks.club_id
court_blocks.venue_id
court_blocks.court_id
court_blocks.starts_at
court_blocks.ends_at
court_blocks.status
```

---

# Índices temporales

Las consultas de disponibilidad deberán optimizar búsquedas por:

* cancha;
* rango de inicio;
* rango de fin;
* estado.

Podrán utilizarse índices sobre rangos temporales según la estrategia elegida.

---

# Seguridad

Toda operación administrativa deberá validar:

1. usuario autenticado;
2. usuario activo;
3. club;
4. sede;
5. membresía;
6. permiso;
7. ownership;
8. estado del club;
9. estado de la sede;
10. estado de la cancha.

---

# Permisos sugeridos

```text
COURT_VIEW
COURT_CREATE
COURT_EDIT
COURT_DELETE
COURT_SCHEDULE_MANAGE
COURT_BLOCK_MANAGE
COURT_MAINTENANCE_MANAGE
```

Podrán incorporarse a `ClubPermission`.

---

# Auditoría

Deberán auditarse:

* creación;
* activación;
* desactivación;
* eliminación;
* cambio de deporte;
* cambio de modalidad;
* cambio de superficie;
* cambio de capacidad;
* cambio de horarios;
* creación y cancelación de bloqueos;
* mantenimiento;
* cambios de visibilidad;
* cambios de reserva online;
* cambios en buffers y anticipación.

---

# Notificaciones

Deberán notificarse los cambios que afecten a usuarios.

Ejemplos:

* cierre inesperado;
* mantenimiento;
* cambio de cancha;
* horario cancelado;
* reapertura;
* reserva afectada.

Las notificaciones operativas internas podrán dirigirse a administradores.

---

# Métricas

El dominio podrá generar:

* cantidad de canchas;
* canchas activas;
* canchas por deporte;
* canchas por sede;
* horas disponibles;
* horas bloqueadas;
* tiempo de mantenimiento;
* ocupación;
* cancelaciones por cierre;
* utilización por franja horaria.

Las métricas de reservas pertenecerán principalmente a `BOOKINGS`.

---

# Pruebas mínimas

Deberán existir pruebas para:

* creación de cancha;
* validación de sede y club;
* modalidad incompatible;
* superficie incompatible;
* activación;
* desactivación;
* cálculo de duración;
* horarios heredados;
* horarios personalizados;
* excepciones;
* bloqueos;
* buffers;
* anticipación mínima;
* anticipación máxima;
* superposición;
* aislamiento entre clubes;
* concurrencia;
* reapertura;
* reservas afectadas por mantenimiento.

---

# Reglas principales

1. Toda cancha pertenece a un club y una sede.
2. La sede debe pertenecer al mismo club.
3. La cancha utiliza deportes y modalidades del catálogo global.
4. Una cancha activa no siempre es reservable.
5. La disponibilidad se calcula; no se almacena como lista fija.
6. Toda reserva debe revalidar disponibilidad al confirmarse.
7. Los bloqueos no pueden eliminar reservas silenciosamente.
8. Las reservas existentes deben analizarse antes de cerrar una cancha.
9. Los horarios se interpretan en la zona horaria de la sede.
10. Las fechas se persisten en UTC.
11. Los buffers afectan la disponibilidad.
12. Los intervalos contiguos no se superponen salvo que exista buffer.
13. La visibilidad y la autorización son conceptos diferentes.
14. Una cancha pública puede requerir membresía o aprobación.
15. Las imágenes se almacenan fuera de PostgreSQL.
16. Toda acción administrativa sensible debe auditarse.
17. El UUID de la cancha no reemplaza la validación de club.
18. La arquitectura debe permitir canchas multipropósito en el futuro.
19. Los cierres temporales deben tener motivo y período.
20. La concurrencia debe resolverse en el backend y la base de datos.

---

# Principio final

COURTS debe representar espacios deportivos reales con reglas claras, disponibilidad confiable y aislamiento multi-club.

La cancha no debe convertirse en una reserva ni en un partido.

Su responsabilidad es describir el recurso físico y exponer una base consistente para que BOOKING pueda decidir si un intervalo puede reservarse.
