# CLUBS

# Objetivo

Este documento define el dominio de clubes de Rondo.

Su propósito es establecer:

* qué representa un club;
* cómo se administra;
* cómo funciona el modelo multi-club;
* cómo se relacionan los usuarios con los clubes;
* qué roles y permisos existen;
* cómo se modelan sedes;
* cómo se aíslan los datos;
* qué configuraciones puede personalizar cada organización;
* cómo se gestionan activación, suspensión y baja.

Rondo debe ser multi-club desde el inicio.

Cada club deberá operar dentro de un contexto aislado sin acceder a información privada de otras organizaciones.

---

# Definición

Un club representa una organización deportiva que utiliza Rondo para administrar parte o la totalidad de su actividad.

Puede representar:

* club deportivo;
* complejo de canchas;
* centro recreativo;
* academia;
* predio deportivo;
* organización de torneos;
* cadena con múltiples sedes.

Un club puede ofrecer:

* uno o varios deportes;
* una o varias sedes;
* una o varias canchas;
* reservas;
* partidos;
* promociones;
* membresías;
* servicios deportivos.

---

# Primer club

El primer cliente de Rondo será:

```text
Club Señor Pato
```

La arquitectura no deberá asumir que existe un único club.

Toda implementación deberá permitir incorporar nuevos clubes sin modificar el dominio central.

---

# Responsabilidades

El dominio `CLUBS` administra:

* identidad del club;
* datos institucionales;
* estado;
* configuración;
* sedes;
* deportes ofrecidos;
* membresías;
* roles;
* permisos;
* administradores;
* invitaciones administrativas;
* aislamiento multi-club;
* reglas operativas propias del club.

No administra directamente:

* autenticación;
* usuarios;
* canchas;
* reservas;
* partidos;
* pagos;
* reputación;
* promociones;
* chats.

Estos dominios se relacionan mediante identificadores y contratos explícitos.

---

# Entidad Club

Modelo conceptual:

```ts
interface Club {
  id: ClubId;

  slug: string;
  name: string;
  legalName?: string;
  description?: string;

  logoUrl?: string;
  coverImageUrl?: string;

  email?: string;
  phone?: string;
  websiteUrl?: string;

  status: ClubStatus;
  visibility: ClubVisibility;

  defaultLocale: string;
  defaultTimeZone: string;
  defaultCurrency: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

---

# Identificador

```ts
type ClubId = string;
```

Reglas:

* UUID;
* único;
* inmutable;
* generado por Rondo;
* no reutilizable.

El identificador interno no deberá derivarse del nombre comercial.

---

# Nombre

Todo club tendrá:

```ts
name: string;
```

Ejemplo:

```text
Club Señor Pato
```

Reglas:

* obligatorio;
* visible para usuarios;
* editable;
* longitud limitada;
* no necesariamente único globalmente.

Podrán existir clubes con nombres similares.

---

# Razón social

Campo opcional:

```ts
legalName?: string;
```

Representa la denominación legal o fiscal.

No deberá mostrarse públicamente salvo que exista una necesidad específica.

Podrá utilizarse en:

* facturación;
* contratos;
* términos;
* documentación administrativa;
* integraciones de pagos.

---

# Slug

Cada club tendrá un slug único.

```ts
slug: string;
```

Ejemplo:

```text
club-senor-pato
```

Podrá utilizarse en rutas públicas:

```text
/clubs/club-senor-pato
```

Reglas:

* único;
* normalizado;
* en minúsculas;
* sin espacios;
* con caracteres seguros para URL;
* no deberá contener datos sensibles.

El cambio de slug deberá controlarse para evitar enlaces rotos.

---

# Descripción

Campo opcional:

```ts
description?: string;
```

Puede incluir:

* historia;
* propuesta deportiva;
* servicios;
* público objetivo;
* instalaciones;
* normas generales.

Para el MVP:

* texto plano;
* longitud limitada;
* sin HTML libre;
* sujeto a moderación.

---

# Imágenes

El club podrá tener:

```ts
logoUrl?: string;
coverImageUrl?: string;
```

Las imágenes se almacenarán en Object Storage.

PostgreSQL conservará únicamente las URLs.

La carga deberá validar:

* formato;
* tamaño;
* relación de aspecto;
* seguridad;
* ownership;
* reemplazo;
* eliminación.

---

# Datos de contacto

Campos posibles:

```ts
email?: string;
phone?: string;
websiteUrl?: string;
```

Estos datos podrán ser públicos según configuración.

El club podrá definir:

* email comercial;
* teléfono de atención;
* sitio web;
* futuras redes sociales.

Los datos administrativos internos deberán mantenerse separados.

---

# Estado del club

```ts
enum ClubStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
  DELETED = 'DELETED',
}
```

---

# Club en borrador

El estado `DRAFT` representa un club creado pero aún no habilitado.

Puede utilizarse mientras se configura:

* información institucional;
* sedes;
* deportes;
* canchas;
* administradores;
* horarios;
* políticas.

Un club en borrador:

* no aparece públicamente;
* no acepta reservas;
* no permite crear partidos públicos;
* solo es accesible para administradores autorizados.

---

# Club activo

El estado `ACTIVE` representa un club operativo.

Puede:

* mostrarse en búsquedas;
* aceptar reservas;
* publicar canchas;
* organizar partidos;
* ofrecer promociones;
* administrar miembros.

Las funcionalidades disponibles dependerán del plan y la configuración.

---

# Club suspendido

El estado `SUSPENDED` representa una restricción temporal impuesta por Rondo.

Motivos posibles:

* incumplimiento contractual;
* fraude;
* riesgo de seguridad;
* falta de pago;
* abuso;
* revisión administrativa;
* requerimiento legal.

Un club suspendido podrá:

* conservar acceso administrativo limitado;
* consultar el motivo;
* revisar información histórica;
* resolver obligaciones.

No podrá:

* aceptar nuevas reservas;
* crear promociones;
* publicar nuevas actividades;
* incorporar nuevos miembros;
* modificar datos críticos sin autorización.

Toda suspensión deberá auditarse.

---

# Club inactivo

El estado `INACTIVE` representa un club deshabilitado voluntariamente o temporalmente fuera de operación.

No aparecerá en búsquedas públicas.

Deberá conservar:

* historial;
* reservas pasadas;
* partidos;
* datos contables;
* auditoría;
* relaciones necesarias.

Podrá reactivarse si cumple las condiciones correspondientes.

---

# Club eliminado

El estado `DELETED` representa una baja procesada.

La eliminación deberá respetar:

* integridad histórica;
* obligaciones legales;
* facturación;
* disputas;
* auditoría;
* privacidad;
* prevención de fraude.

Los datos públicos podrán anonimizarse o dejar de mostrarse.

---

# Visibilidad

```ts
enum ClubVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  UNLISTED = 'UNLISTED',
}
```

---

# Club público

Un club `PUBLIC`:

* aparece en búsquedas;
* puede tener perfil visible;
* puede recibir reservas públicas;
* puede mostrar canchas y actividades.

---

# Club privado

Un club `PRIVATE`:

* no aparece en búsquedas generales;
* requiere invitación, membresía o vínculo previo;
* puede limitar reservas a miembros;
* puede ocultar información institucional.

---

# Club no listado

Un club `UNLISTED`:

* no aparece en búsquedas;
* puede accederse mediante enlace directo;
* puede utilizarse durante onboarding o pruebas;
* puede ofrecer funcionalidades limitadas.

---

# Multi-club

Rondo deberá soportar múltiples clubes desde la primera versión.

Cada club tendrá:

* configuración propia;
* administradores propios;
* sedes propias;
* canchas propias;
* reservas propias;
* miembros propios;
* promociones propias;
* permisos propios.

Ningún club deberá asumir propiedad global sobre un usuario.

---

# Contexto activo de club

La aplicación podrá mantener un club activo.

Modelo conceptual:

```ts
interface ActiveClubContext {
  clubId: ClubId;
  membershipId?: ClubMembershipId;
  roleIds: ClubRoleId[];
  permissions: ClubPermission[];
}
```

El contexto activo podrá utilizarse para:

* navegación;
* administración;
* reservas;
* creación de partidos;
* filtros;
* permisos;
* personalización visual.

---

# Cambio de contexto

Un usuario relacionado con varios clubes podrá cambiar de contexto.

Ejemplo:

```text
Club Señor Pato
Club Norte
Complejo Central
```

Al cambiar de contexto deberán actualizarse:

* permisos;
* navegación;
* datos visibles;
* configuración;
* sede predeterminada;
* branding;
* filtros.

El cambio de contexto no requiere cerrar sesión.

---

# Club opcional en actividades

Un usuario puede utilizar Rondo sin pertenecer a un club.

Por eso, algunas entidades podrán tener:

```ts
clubId?: ClubId;
```

Ejemplos:

* partido independiente;
* grupo privado;
* invitación entre jugadores;
* actividad sin reserva.

El dominio deberá distinguir entre:

* actividad asociada a un club;
* actividad independiente;
* actividad alojada físicamente en un club;
* actividad administrada por un club.

---

# Club anfitrión

En un partido podrá existir:

```ts
hostClubId?: ClubId;
```

Esto representa el club asociado al evento.

No implica necesariamente que:

* el club sea propietario del partido;
* todos los jugadores sean miembros;
* exista una reserva;
* el organizador sea administrador.

Las reglas definitivas pertenecerán a `MATCHES.md`.

---

# Sedes

Un club podrá tener una o varias sedes.

Ejemplos:

```text
Sede Centro
Sede Norte
Predio Principal
Complejo Anexo
```

La entidad será:

```ts
ClubVenue
```

---

# Entidad ClubVenue

Modelo conceptual:

```ts
interface ClubVenue {
  id: ClubVenueId;
  clubId: ClubId;

  name: string;
  description?: string;

  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  countryCode: string;

  latitude?: number;
  longitude?: number;

  phone?: string;
  email?: string;

  timeZone: string;
  status: ClubVenueStatus;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# Identificador de sede

```ts
type ClubVenueId = string;
```

Toda sede pertenece a un único club.

Una sede no puede compartirse directamente entre clubes en el MVP.

Si dos clubes operan en el mismo espacio físico, cada uno tendrá su propia referencia o se modelará una relación futura específica.

---

# Dirección

La dirección deberá ser estructurada.

No se recomienda almacenar únicamente un texto libre.

Campos sugeridos:

* calle y número;
* complemento;
* ciudad;
* provincia o estado;
* código postal;
* país;
* coordenadas.

Las coordenadas permitirán:

* mapas;
* navegación;
* búsquedas por cercanía;
* cálculo de distancia;
* geofencing futuro.

---

# Zona horaria de sede

Cada sede tendrá:

```ts
timeZone: string;
```

Esto es importante porque un club podría operar en varias zonas horarias.

Los horarios de reservas y partidos deberán interpretarse según la sede.

---

# Estado de la sede

```ts
enum ClubVenueStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
}
```

Una sede cerrada temporalmente:

* no acepta nuevas reservas;
* conserva reservas existentes;
* puede requerir cancelaciones;
* mantiene historial.

---

# Sede principal

Un club podrá marcar una sede como principal.

Se recomienda modelarlo mediante:

```ts
isPrimary: boolean;
```

Solo una sede activa deberá ser principal por club.

La sede principal podrá utilizarse para:

* datos de contacto;
* mapas;
* contexto predeterminado;
* reportes;
* onboarding.

---

# Deportes ofrecidos por el club

Un club podrá ofrecer uno o varios deportes del catálogo global.

La relación será:

```ts
ClubSport
```

---

# Entidad ClubSport

Modelo conceptual:

```ts
interface ClubSport {
  id: ClubSportId;
  clubId: ClubId;
  sportId: SportId;

  status: ClubSportStatus;
  isFeatured: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# Reglas de ClubSport

Un club:

* solo puede asociarse a deportes activos;
* no puede duplicar el mismo deporte;
* puede desactivar un deporte sin borrar historial;
* puede destacar deportes principales;
* puede ofrecer un subconjunto de modalidades.

Restricción única:

```text
club_id + sport_id
```

---

# Modalidades del club

Un club podrá habilitar modalidades concretas.

Ejemplo:

```text
Fútbol
- Fútbol 5
- Fútbol 7

Pádel
- Dobles
```

La relación podrá modelarse como:

```ts
ClubSportModality
```

Esto permitirá:

* limitar formularios;
* configurar canchas;
* personalizar reservas;
* aplicar reglas específicas.

---

# Configuración deportiva del club

El club podrá personalizar ciertos valores.

Ejemplos:

* duración predeterminada;
* cantidad máxima de suplentes;
* niveles permitidos;
* categorías;
* horarios;
* políticas de cancelación;
* visibilidad;
* reglas de reserva.

Las configuraciones no deberán modificar el catálogo global.

---

# Herencia de configuración

La configuración podrá resolverse así:

```text
Configuración global
        ↓
Deporte
        ↓
Modalidad
        ↓
Club
        ↓
Sede
        ↓
Cancha
        ↓
Reserva o partido
```

La configuración más específica podrá sobrescribir valores permitidos.

---

# Membresías

La relación entre usuarios y clubes se modelará mediante:

```ts
ClubMembership
```

No se almacenará un único `clubId` dentro de User.

Un usuario podrá pertenecer a varios clubes.

---

# Entidad ClubMembership

Modelo conceptual:

```ts
interface ClubMembership {
  id: ClubMembershipId;
  clubId: ClubId;
  userId: UserId;

  status: ClubMembershipStatus;
  membershipType?: ClubMembershipType;

  joinedAt?: Date;
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# Identificador de membresía

```ts
type ClubMembershipId = string;
```

Restricción recomendada:

```text
club_id + user_id
```

No deberá existir más de una membresía activa equivalente entre el mismo usuario y club.

---

# Estado de membresía

```ts
enum ClubMembershipStatus {
  INVITED = 'INVITED',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  LEFT = 'LEFT',
  REMOVED = 'REMOVED',
}
```

---

# Invitado

`INVITED` significa que el club invitó al usuario.

El usuario todavía no aceptó.

Puede:

* aceptar;
* rechazar;
* ignorar hasta el vencimiento.

---

# Pendiente

`PENDING` significa que el usuario solicitó ingresar y espera aprobación.

Aplica cuando el club:

* es privado;
* requiere verificación;
* administra socios;
* necesita validar pagos o documentación.

---

# Activo

`ACTIVE` representa una relación vigente.

El usuario puede acceder a funcionalidades según:

* rol;
* permisos;
* tipo de membresía;
* estado del club;
* configuración.

---

# Suspendido

`SUSPENDED` representa una restricción temporal dentro del club.

No equivale a una suspensión global de Rondo.

El usuario podrá seguir utilizando otros clubes.

Motivos:

* deuda;
* conducta;
* sanción;
* documentación vencida;
* decisión administrativa.

---

# Rechazado

`REJECTED` indica que una solicitud fue rechazada.

Deberá registrarse:

* fecha;
* responsable;
* motivo interno;
* mensaje opcional para el usuario.

---

# Vencido

`EXPIRED` aplica a membresías con fecha de finalización.

Puede utilizarse para:

* pases temporales;
* abonos;
* membresías estacionales;
* pruebas.

---

# Salida voluntaria

`LEFT` indica que el usuario abandonó el club.

No elimina el historial.

---

# Removido

`REMOVED` indica que el club eliminó la membresía.

Deberá auditarse.

---

# Tipo de membresía

Modelo inicial:

```ts
enum ClubMembershipType {
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
  STAFF = 'STAFF',
  COACH = 'COACH',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
}
```

Estos tipos describen la relación.

No reemplazan roles ni permisos.

---

# Miembro

`MEMBER` representa un socio o miembro regular.

---

# Invitado

`GUEST` representa acceso limitado o temporal.

---

# Personal

`STAFF` representa empleados o colaboradores.

---

# Entrenador

`COACH` representa un rol operativo deportivo.

---

# Administrativo

`ADMINISTRATIVE` representa personal de gestión sin implicar permisos específicos.

---

# Roles del club

Los roles deben ser contextuales.

Un usuario puede ser:

* jugador en Club A;
* administrador en Club B;
* entrenador en Club C.

No se almacenará un rol global dentro de User.

---

# Entidad ClubRole

Modelo conceptual:

```ts
interface ClubRole {
  id: ClubRoleId;
  clubId: ClubId;

  code: string;
  name: string;
  description?: string;

  isSystemRole: boolean;
  status: ClubRoleStatus;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# Roles iniciales

Se recomiendan:

```ts
enum DefaultClubRoleCode {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  RECEPTIONIST = 'RECEPTIONIST',
  COACH = 'COACH',
  MEMBER = 'MEMBER',
}
```

---

# Propietario

`OWNER` representa al responsable principal del espacio organizacional.

Permisos posibles:

* administrar club;
* administrar sedes;
* administrar usuarios;
* asignar roles;
* configurar facturación;
* transferir propiedad;
* solicitar baja;
* acceder a auditoría.

Debe existir al menos un propietario activo.

---

# Administrador

`ADMIN` puede administrar la operación general.

No necesariamente puede:

* transferir propiedad;
* eliminar el club;
* modificar facturación;
* cambiar permisos del propietario.

---

# Encargado

`MANAGER` puede administrar operaciones deportivas.

Ejemplos:

* canchas;
* reservas;
* horarios;
* partidos;
* promociones;
* reportes operativos.

---

# Recepción

`RECEPTIONIST` puede gestionar tareas de atención.

Ejemplos:

* consultar reservas;
* crear reservas;
* registrar llegadas;
* actualizar estados;
* consultar disponibilidad.

---

# Entrenador

`COACH` puede administrar actividades relacionadas con entrenamiento.

Sus permisos dependerán de funcionalidades futuras.

---

# Miembro

`MEMBER` representa el rol básico de acceso.

No otorga permisos administrativos.

---

# Permisos

Los permisos deberán modelarse de manera explícita.

Ejemplo:

```ts
enum ClubPermission {
  CLUB_VIEW = 'CLUB_VIEW',
  CLUB_EDIT = 'CLUB_EDIT',

  VENUE_VIEW = 'VENUE_VIEW',
  VENUE_CREATE = 'VENUE_CREATE',
  VENUE_EDIT = 'VENUE_EDIT',
  VENUE_DELETE = 'VENUE_DELETE',

  COURT_VIEW = 'COURT_VIEW',
  COURT_CREATE = 'COURT_CREATE',
  COURT_EDIT = 'COURT_EDIT',
  COURT_DELETE = 'COURT_DELETE',

  BOOKING_VIEW = 'BOOKING_VIEW',
  BOOKING_CREATE = 'BOOKING_CREATE',
  BOOKING_EDIT = 'BOOKING_EDIT',
  BOOKING_CANCEL = 'BOOKING_CANCEL',

  MATCH_VIEW = 'MATCH_VIEW',
  MATCH_CREATE = 'MATCH_CREATE',
  MATCH_MODERATE = 'MATCH_MODERATE',

  MEMBER_VIEW = 'MEMBER_VIEW',
  MEMBER_INVITE = 'MEMBER_INVITE',
  MEMBER_APPROVE = 'MEMBER_APPROVE',
  MEMBER_SUSPEND = 'MEMBER_SUSPEND',
  MEMBER_REMOVE = 'MEMBER_REMOVE',

  ROLE_VIEW = 'ROLE_VIEW',
  ROLE_ASSIGN = 'ROLE_ASSIGN',
  ROLE_MANAGE = 'ROLE_MANAGE',

  PROMOTION_VIEW = 'PROMOTION_VIEW',
  PROMOTION_MANAGE = 'PROMOTION_MANAGE',

  REPORT_VIEW = 'REPORT_VIEW',
  AUDIT_VIEW = 'AUDIT_VIEW',

  SETTINGS_VIEW = 'SETTINGS_VIEW',
  SETTINGS_EDIT = 'SETTINGS_EDIT',

  BILLING_VIEW = 'BILLING_VIEW',
  BILLING_MANAGE = 'BILLING_MANAGE',
}
```

---

# Roles y permisos

Un rol agrupa permisos.

Ejemplo:

```text
RECEPTIONIST
- BOOKING_VIEW
- BOOKING_CREATE
- BOOKING_EDIT
- MEMBER_VIEW
```

El backend deberá validar permisos.

La interfaz podrá ocultar acciones, pero eso no reemplaza la autorización del servidor.

---

# Roles del sistema

Los roles base podrán marcarse como:

```ts
isSystemRole: true;
```

Estos roles:

* se crean automáticamente;
* tienen códigos estables;
* pueden impedir eliminación;
* pueden permitir personalización limitada.

---

# Roles personalizados

En versiones futuras, un club podrá crear roles propios.

Ejemplos:

```text
Coordinador de fútbol
Encargado nocturno
Administrador de sede
```

Para el MVP podrán utilizarse roles predefinidos.

---

# Asignación de roles

La relación será:

```ts
ClubMembershipRole
```

Modelo conceptual:

```ts
interface ClubMembershipRole {
  membershipId: ClubMembershipId;
  roleId: ClubRoleId;
  assignedByUserId: UserId;
  assignedAt: Date;
}
```

Un usuario podrá tener varios roles dentro del mismo club.

---

# Permisos por sede

En versiones futuras podrá limitarse un rol a una sede específica.

Ejemplo:

```text
Recepcionista de Sede Norte
```

Modelo conceptual:

```ts
interface ClubRoleScope {
  roleAssignmentId: string;
  venueId?: ClubVenueId;
}
```

No es obligatorio para el MVP, pero la arquitectura no deberá impedirlo.

---

# Propiedad del club

Todo club deberá tener al menos una membresía con rol:

```text
OWNER
```

No podrá eliminarse ni desactivarse al último propietario sin transferir la propiedad.

---

# Transferencia de propiedad

La transferencia deberá:

1. validar propietario actual;
2. validar nuevo usuario;
3. validar membresía activa;
4. asignar rol OWNER;
5. actualizar permisos;
6. decidir si el propietario anterior conserva su rol;
7. registrar auditoría;
8. notificar a las partes.

Es una operación sensible.

Podrá requerir autenticación reforzada.

---

# Invitaciones al club

Un administrador autorizado podrá invitar usuarios.

La invitación podrá realizarse por:

* usuario existente;
* email;
* teléfono;
* enlace;
* código.

El dominio de invitaciones generales podrá reutilizarse, pero la invitación a membresía pertenece conceptualmente a CLUBS.

---

# Entidad ClubInvitation

Modelo conceptual:

```ts
interface ClubInvitation {
  id: ClubInvitationId;
  clubId: ClubId;

  invitedUserId?: UserId;
  email?: string;
  phone?: string;

  roleIds: ClubRoleId[];

  status: ClubInvitationStatus;
  invitedByUserId: UserId;

  expiresAt: Date;

  createdAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
}
```

---

# Estado de invitación

```ts
enum ClubInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}
```

---

# Reglas de invitación

Una invitación:

* pertenece a un club;
* debe tener vencimiento;
* puede revocarse;
* no puede aceptarse dos veces;
* debe ser idempotente;
* deberá validar que el usuario no tenga ya membresía activa;
* podrá incluir roles iniciales.

---

# Solicitud de ingreso

Un usuario podrá solicitar unirse a un club cuando este lo permita.

Modelo conceptual:

```ts
ClubMembershipRequest
```

Estados:

```ts
enum ClubMembershipRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}
```

---

# Políticas de ingreso

```ts
enum ClubJoinPolicy {
  OPEN = 'OPEN',
  REQUEST_APPROVAL = 'REQUEST_APPROVAL',
  INVITATION_ONLY = 'INVITATION_ONLY',
  CLOSED = 'CLOSED',
}
```

---

# Ingreso abierto

`OPEN` permite que un usuario se una directamente.

---

# Aprobación requerida

`REQUEST_APPROVAL` requiere revisión administrativa.

---

# Solo invitación

`INVITATION_ONLY` impide solicitudes espontáneas.

---

# Cerrado

`CLOSED` impide nuevas membresías.

---

# Configuración del club

Cada club tendrá una configuración propia.

Modelo conceptual:

```ts
interface ClubSettings {
  clubId: ClubId;

  joinPolicy: ClubJoinPolicy;

  allowPublicBookings: boolean;
  allowGuestBookings: boolean;
  allowPublicMatches: boolean;
  allowIndependentOrganizers: boolean;

  requirePhoneVerification: boolean;
  requireProfilePhoto: boolean;

  defaultBookingDurationMinutes?: number;
  bookingCancellationWindowHours?: number;

  showMemberDirectory: boolean;
  showPublicContactInfo: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# Reglas configurables

El club podrá configurar:

* política de ingreso;
* visibilidad;
* reservas públicas;
* reservas de invitados;
* creación de partidos;
* datos públicos;
* requisitos de perfil;
* políticas de cancelación;
* horarios;
* notificaciones;
* promociones;
* restricciones.

Las configuraciones deberán validarse.

---

# Branding

El club podrá personalizar:

* logo;
* imagen de portada;
* color destacado;
* nombre visible;
* descripción;
* mensajes informativos.

El branding deberá respetar accesibilidad y límites del sistema de diseño.

El club no podrá alterar completamente la navegación o romper la identidad de Rondo.

---

# Personalización visual

Modelo conceptual:

```ts
interface ClubBranding {
  clubId: ClubId;
  logoUrl?: string;
  coverImageUrl?: string;
  accentColor?: string;
  shortName?: string;
}
```

La personalización avanzada podrá depender del plan comercial.

---

# Configuración regional

Cada club tendrá:

```ts
defaultLocale: string;
defaultTimeZone: string;
defaultCurrency: string;
```

Para Argentina:

```text
defaultLocale: es-AR
defaultTimeZone: America/Argentina/Buenos_Aires
defaultCurrency: ARS
```

Las sedes podrán sobrescribir la zona horaria.

---

# Horarios del club

El club o cada sede podrá definir horarios operativos.

Modelo conceptual:

```ts
interface ClubOperatingHours {
  id: string;
  clubId: ClubId;
  venueId?: ClubVenueId;

  dayOfWeek: DayOfWeek;
  opensAt?: LocalTime;
  closesAt?: LocalTime;
  isClosed: boolean;
}
```

---

# Excepciones de horario

Deberán contemplarse:

* feriados;
* mantenimiento;
* eventos;
* cierres excepcionales;
* horarios especiales.

Modelo conceptual:

```ts
interface ClubScheduleException {
  id: string;
  clubId: ClubId;
  venueId?: ClubVenueId;

  date: DateOnly;
  opensAt?: LocalTime;
  closesAt?: LocalTime;
  isClosed: boolean;
  reason?: string;
}
```

---

# Términos y políticas

El club podrá definir políticas propias.

Ejemplos:

* cancelación;
* reprogramación;
* puntualidad;
* indumentaria;
* uso de instalaciones;
* conducta;
* pagos;
* acceso de invitados.

Las políticas deberán versionarse cuando afecten reservas o contratos.

---

# Política versionada

Modelo conceptual:

```ts
interface ClubPolicyVersion {
  id: string;
  clubId: ClubId;
  policyType: ClubPolicyType;
  version: string;
  content: string;
  effectiveFrom: Date;
  createdAt: Date;
}
```

---

# Tipos de política

```ts
enum ClubPolicyType {
  BOOKING = 'BOOKING',
  CANCELLATION = 'CANCELLATION',
  MEMBERSHIP = 'MEMBERSHIP',
  CONDUCT = 'CONDUCT',
  PRIVACY = 'PRIVACY',
  FACILITY_USE = 'FACILITY_USE',
}
```

---

# Aceptación de políticas

Cuando corresponda, deberá registrarse qué versión aceptó el usuario.

No se utilizará un simple booleano.

---

# Búsqueda de clubes

Los clubes podrán buscarse por:

* nombre;
* deporte;
* ciudad;
* cercanía;
* sede;
* disponibilidad;
* visibilidad;
* servicios;
* calificación futura.

La implementación detallada pertenecerá a `SEARCH.md`.

---

# Perfil público del club

Ruta conceptual:

```text
/clubs/:clubSlug
```

Podrá mostrar:

* nombre;
* logo;
* portada;
* descripción;
* deportes;
* sedes;
* canchas;
* ubicación;
* contacto público;
* horarios;
* promociones;
* partidos públicos;
* políticas;
* información de reservas.

---

# Panel administrativo

Ruta conceptual:

```text
/admin/clubs/:clubId
```

El panel podrá incluir:

* resumen;
* sedes;
* canchas;
* reservas;
* partidos;
* miembros;
* roles;
* promociones;
* configuración;
* reportes;
* auditoría.

El acceso dependerá de permisos.

---

# Aislamiento de datos

Toda entidad perteneciente a un club deberá incluir:

```ts
clubId: ClubId;
```

Ejemplos:

* sedes;
* canchas;
* reservas;
* promociones;
* configuraciones;
* membresías;
* roles.

---

# Regla de aislamiento

Toda consulta por una entidad multi-club deberá validar el contexto del club.

Ejemplo incorrecto:

```text
Buscar una reserva solo por bookingId
```

Ejemplo correcto:

```text
Buscar una reserva por bookingId y validar clubId
```

La existencia de un UUID no reemplaza la autorización.

---

# Tenant

A nivel técnico, un club funcionará como tenant lógico.

Sin embargo, el término de dominio seguirá siendo:

```text
Club
```

La infraestructura podrá utilizar conceptos como:

* tenant context;
* tenant isolation;
* tenant key.

No deberán filtrarse términos técnicos innecesarios a la interfaz.

---

# Estrategia multi-tenant

Para el MVP se recomienda:

```text
Base de datos compartida
Esquema compartido
Filas separadas por club_id
```

Ventajas:

* menor complejidad;
* menor costo;
* migraciones simples;
* reporting global;
* mantenimiento centralizado.

---

# Reglas de persistencia multi-tenant

Toda tabla dependiente de un club deberá:

* tener `club_id`;
* incluir índices por `club_id`;
* aplicar restricciones compuestas cuando corresponda;
* impedir consultas sin contexto;
* auditar acciones sensibles;
* validar ownership.

---

# Restricciones compuestas

Ejemplo:

```text
club_id + venue_id
club_id + court_id
club_id + membership_id
club_id + role_code
```

Estas restricciones ayudan a evitar referencias cruzadas incorrectas.

---

# Row-Level Security

PostgreSQL Row-Level Security podrá evaluarse como capa adicional.

No deberá reemplazar:

* validación de aplicación;
* autorización;
* tests;
* contextos explícitos.

Para el MVP puede implementarse primero aislamiento en repositorios y servicios.

La incorporación de RLS deberá registrarse en `TECH_DECISIONS.md`.

---

# Acceso global de Rondo

Los administradores globales de Rondo podrán requerir acceso transversal para:

* soporte;
* auditoría;
* moderación;
* fraude;
* cumplimiento;
* operaciones.

Este acceso deberá:

* ser limitado;
* ser explícito;
* auditarse;
* tener motivo;
* respetar mínimo privilegio.

---

# Impersonación

La impersonación de usuarios o administradores no forma parte inicial del MVP.

Si se incorpora, deberá:

* mostrar indicador visible;
* requerir permiso especial;
* registrar inicio y fin;
* impedir acciones críticas cuando corresponda;
* conservar identidad del operador real.

---

# Integración con USERS

USERS aporta:

* identidad;
* perfil;
* estado global.

CLUBS administra:

* membresía;
* rol;
* permisos;
* estado dentro del club.

Un usuario suspendido globalmente no podrá operar en ningún club.

Un usuario suspendido en un club sí podrá operar en otros.

---

# Integración con SPORTS

CLUBS utiliza SPORTS para definir:

* deportes ofrecidos;
* modalidades;
* configuraciones;
* posiciones;
* superficies compatibles.

Un club no puede modificar el catálogo global.

---

# Integración con COURTS

Cada cancha pertenece a:

* un club;
* una sede;
* un deporte;
* una modalidad compatible.

CLUBS define el contexto institucional.

COURTS administra la cancha concreta.

---

# Integración con BOOKINGS

Una reserva en un club deberá asociarse a:

* club;
* sede;
* cancha;
* usuario o responsable;
* política aplicable.

BOOKINGS deberá validar:

* estado del club;
* estado de la sede;
* permisos;
* membresía cuando corresponda.

---

# Integración con MATCHES

Un partido podrá:

* estar asociado a un club;
* estar alojado en una sede;
* usar una cancha;
* existir sin reserva;
* ser organizado por un usuario;
* ser organizado institucionalmente.

Las reglas definitivas pertenecerán a `MATCHES.md`.

---

# Integración con PROMOTIONS

Las promociones pertenecerán a un club.

Podrán limitarse por:

* sede;
* deporte;
* cancha;
* horario;
* membresía;
* código;
* segmento.

---

# Integración con NOTIFICATIONS

Eventos del club podrán generar notificaciones:

* invitación;
* aprobación;
* rechazo;
* suspensión;
* cambio de rol;
* cambio de horario;
* cierre de sede;
* modificación de reserva;
* promoción.

---

# Integración con SEARCH

SEARCH deberá respetar:

* visibilidad;
* estado;
* política de acceso;
* ubicación;
* deportes;
* sedes;
* permisos del usuario.

Un club privado no deberá aparecer en resultados públicos.

---

# Casos de uso

El dominio deberá contemplar al menos:

```text
CreateClub
CompleteClubSetup
GetClub
GetPublicClubProfile
UpdateClub
ActivateClub
SuspendClub
ReactivateClub
DeactivateClub
RequestClubDeletion

CreateClubVenue
UpdateClubVenue
SetPrimaryClubVenue
DeactivateClubVenue

AddClubSport
RemoveClubSport
ConfigureClubSport

InviteClubMember
AcceptClubInvitation
RejectClubInvitation
RevokeClubInvitation

RequestClubMembership
ApproveClubMembership
RejectClubMembership
SuspendClubMembership
RestoreClubMembership
LeaveClub
RemoveClubMember

CreateClubRole
UpdateClubRole
AssignClubRole
RemoveClubRole

GetCurrentClubContext
ListUserClubs
ChangeActiveClub
```

---

# CreateClub

Crea un club en estado:

```text
DRAFT
```

Requiere:

* nombre;
* propietario inicial;
* configuración regional;
* aceptación de términos comerciales cuando corresponda.

Debe crear en una única operación lógica:

* club;
* configuración;
* membresía del propietario;
* rol OWNER;
* asignación del rol;
* auditoría.

---

# CompleteClubSetup

Completa la configuración mínima.

Podrá requerir:

* información institucional;
* sede principal;
* deporte;
* contacto;
* configuración;
* propietario;
* políticas básicas.

Cuando se cumplen los requisitos, podrá activarse.

---

# ActivateClub

Solo puede ejecutarse cuando:

* existe propietario activo;
* existe configuración válida;
* el club no está suspendido;
* se cumplen requisitos comerciales;
* existe al menos una sede cuando sea obligatorio.

---

# UpdateClub

Permite editar información institucional.

No permite modificar directamente:

* id;
* estado administrativo;
* fechas de auditoría;
* propietario;
* plan comercial;
* datos sensibles fuera del flujo correspondiente.

---

# CreateClubVenue

Crea una sede.

Debe validar:

* club activo o en borrador;
* permisos;
* dirección;
* zona horaria;
* nombre;
* duplicados razonables.

---

# SetPrimaryClubVenue

Marca una sede como principal.

La operación deberá desmarcar la anterior de forma transaccional.

---

# InviteClubMember

Crea una invitación.

Debe validar:

* permiso;
* club;
* usuario o contacto;
* roles;
* membresía existente;
* invitaciones pendientes;
* vencimiento.

---

# AcceptClubInvitation

Debe:

* validar destinatario;
* validar vigencia;
* crear o actualizar membresía;
* asignar roles;
* marcar invitación aceptada;
* auditar;
* notificar.

Debe ser idempotente.

---

# RequestClubMembership

Permite solicitar ingreso cuando la política lo admite.

Debe impedir:

* solicitudes duplicadas;
* solicitudes a club cerrado;
* solicitudes de usuario suspendido;
* solicitudes si ya existe membresía activa.

---

# ApproveClubMembership

Crea o activa una membresía.

Puede asignar un rol inicial.

Normalmente:

```text
MEMBER
```

---

# SuspendClubMembership

Suspende una relación específica.

Debe registrar:

* motivo;
* responsable;
* fecha;
* duración;
* observaciones;
* apelación futura.

---

# LeaveClub

Permite abandonar voluntariamente.

No podrá ejecutarse si el usuario:

* es el último propietario;
* tiene responsabilidades pendientes;
* administra reservas críticas;
* debe transferir funciones.

---

# RemoveClubMember

Permite remover una membresía.

Debe validar jerarquía y permisos.

Un administrador no deberá poder remover al propietario sin autorización especial.

---

# GetCurrentClubContext

Devuelve:

* club;
* membresía;
* roles;
* permisos;
* sede activa;
* configuración relevante.

Ejemplo conceptual:

```json
{
  "club": {
    "id": "club_uuid",
    "name": "Club Señor Pato",
    "slug": "club-senor-pato",
    "logoUrl": "https://storage.example.com/clubs/logo.webp"
  },
  "membership": {
    "id": "membership_uuid",
    "status": "ACTIVE",
    "type": "MEMBER"
  },
  "roles": [
    "ADMIN"
  ],
  "permissions": [
    "CLUB_VIEW",
    "BOOKING_VIEW",
    "BOOKING_CREATE",
    "MEMBER_VIEW"
  ],
  "activeVenueId": "venue_uuid"
}
```

---

# Eventos de dominio

Eventos sugeridos:

```text
ClubCreated
ClubSetupCompleted
ClubActivated
ClubUpdated
ClubSuspended
ClubReactivated
ClubDeactivated
ClubDeletionRequested
ClubDeleted

ClubVenueCreated
ClubVenueUpdated
ClubVenueActivated
ClubVenueDeactivated
PrimaryClubVenueChanged

ClubSportAdded
ClubSportRemoved
ClubSportConfigured

ClubMemberInvited
ClubInvitationAccepted
ClubInvitationRejected
ClubInvitationRevoked

ClubMembershipRequested
ClubMembershipApproved
ClubMembershipRejected
ClubMembershipActivated
ClubMembershipSuspended
ClubMembershipRestored
ClubMembershipLeft
ClubMemberRemoved

ClubRoleCreated
ClubRoleUpdated
ClubRoleAssigned
ClubRoleRemoved

ClubOwnershipTransferred
```

---

# Endpoints iniciales

Ejemplos conceptuales:

```http
GET /api/v1/clubs
POST /api/v1/clubs
GET /api/v1/clubs/:clubId
PATCH /api/v1/clubs/:clubId
POST /api/v1/clubs/:clubId/activation
POST /api/v1/clubs/:clubId/deactivation

GET /api/v1/clubs/:clubId/venues
POST /api/v1/clubs/:clubId/venues
PATCH /api/v1/clubs/:clubId/venues/:venueId
POST /api/v1/clubs/:clubId/venues/:venueId/set-primary

GET /api/v1/clubs/:clubId/sports
POST /api/v1/clubs/:clubId/sports
DELETE /api/v1/clubs/:clubId/sports/:sportId

GET /api/v1/clubs/:clubId/members
POST /api/v1/clubs/:clubId/invitations
POST /api/v1/clubs/:clubId/invitations/:invitationId/accept
POST /api/v1/clubs/:clubId/invitations/:invitationId/reject

POST /api/v1/clubs/:clubId/membership-requests
POST /api/v1/clubs/:clubId/membership-requests/:requestId/approve
POST /api/v1/clubs/:clubId/membership-requests/:requestId/reject

PATCH /api/v1/clubs/:clubId/memberships/:membershipId
POST /api/v1/clubs/:clubId/memberships/:membershipId/suspension
POST /api/v1/clubs/:clubId/memberships/:membershipId/restoration
DELETE /api/v1/clubs/:clubId/memberships/:membershipId

GET /api/v1/clubs/:clubId/roles
POST /api/v1/clubs/:clubId/roles
PATCH /api/v1/clubs/:clubId/roles/:roleId
POST /api/v1/clubs/:clubId/memberships/:membershipId/roles
DELETE /api/v1/clubs/:clubId/memberships/:membershipId/roles/:roleId

GET /api/v1/users/me/clubs
GET /api/v1/clubs/:clubId/context
```

---

# Persistencia conceptual

Tabla:

```text
clubs
```

Campos:

```text
id
slug
name
legal_name
description
logo_url
cover_image_url
email
phone
website_url
status
visibility
default_locale
default_time_zone
default_currency
created_at
updated_at
deleted_at
```

Restricciones:

* `id` único;
* `slug` único;
* `status` válido;
* `visibility` válida.

---

# Tabla de sedes

```text
club_venues
```

Campos:

```text
id
club_id
name
description
address_line_1
address_line_2
city
state
postal_code
country_code
latitude
longitude
phone
email
time_zone
status
is_primary
created_at
updated_at
```

Índices:

```text
club_venues.club_id
club_venues.status
club_venues.city
club_venues.latitude + longitude
```

---

# Tabla de deportes del club

```text
club_sports
```

Campos:

```text
id
club_id
sport_id
status
is_featured
created_at
updated_at
```

Restricción única:

```text
club_id + sport_id
```

---

# Tabla de modalidades del club

```text
club_sport_modalities
```

Campos:

```text
id
club_sport_id
sport_modality_id
status
configuration_json
created_at
updated_at
```

La configuración deberá utilizar JSON solo para extensiones controladas.

No deberá reemplazar campos importantes y consultables.

---

# Tabla de membresías

```text
club_memberships
```

Campos:

```text
id
club_id
user_id
status
membership_type
joined_at
expires_at
created_at
updated_at
```

Restricción recomendada:

```text
club_id + user_id
```

---

# Tabla de roles

```text
club_roles
```

Campos:

```text
id
club_id
code
name
description
is_system_role
status
created_at
updated_at
```

Restricción:

```text
club_id + code
```

---

# Tabla de permisos por rol

```text
club_role_permissions
```

Campos:

```text
role_id
permission_code
created_at
```

Restricción:

```text
role_id + permission_code
```

---

# Tabla de roles por membresía

```text
club_membership_roles
```

Campos:

```text
membership_id
role_id
assigned_by_user_id
assigned_at
```

Restricción:

```text
membership_id + role_id
```

---

# Tabla de invitaciones

```text
club_invitations
```

Campos:

```text
id
club_id
invited_user_id
email
phone
status
invited_by_user_id
expires_at
created_at
accepted_at
rejected_at
revoked_at
```

---

# Tabla de roles de invitación

```text
club_invitation_roles
```

Campos:

```text
invitation_id
role_id
```

---

# Tabla de solicitudes

```text
club_membership_requests
```

Campos:

```text
id
club_id
user_id
status
message
reviewed_by_user_id
reviewed_at
created_at
updated_at
```

---

# Tabla de configuración

```text
club_settings
```

Campos:

```text
club_id
join_policy
allow_public_bookings
allow_guest_bookings
allow_public_matches
allow_independent_organizers
require_phone_verification
require_profile_photo
default_booking_duration_minutes
booking_cancellation_window_hours
show_member_directory
show_public_contact_info
created_at
updated_at
```

---

# Índices sugeridos

```text
clubs.slug
clubs.status
clubs.visibility

club_venues.club_id
club_venues.status

club_sports.club_id
club_sports.sport_id

club_memberships.club_id
club_memberships.user_id
club_memberships.status

club_roles.club_id
club_roles.code

club_invitations.club_id
club_invitations.invited_user_id
club_invitations.email
club_invitations.status
club_invitations.expires_at

club_membership_requests.club_id
club_membership_requests.user_id
club_membership_requests.status
```

---

# Seguridad

Toda operación administrativa deberá validar:

1. usuario autenticado;
2. usuario activo;
3. club existente;
4. membresía activa;
5. rol;
6. permiso;
7. alcance;
8. estado del club;
9. estado de la entidad afectada.

---

# Regla de no confianza

El backend nunca deberá confiar en:

* clubId recibido desde la interfaz;
* rol enviado por el cliente;
* permisos almacenados en frontend;
* club activo guardado localmente;
* identificadores sin validar relación.

El contexto deberá reconstruirse y validarse en el servidor.

---

# Caché de permisos

Los permisos podrán cachearse para mejorar rendimiento.

La caché deberá invalidarse cuando:

* cambia un rol;
* cambia un permiso;
* cambia una membresía;
* se suspende un usuario;
* se suspende un club;
* se transfiere propiedad.

---

# Auditoría

Deberán auditarse al menos:

* creación del club;
* activación;
* suspensión;
* desactivación;
* actualización de datos;
* creación y modificación de sedes;
* incorporación y eliminación de deportes;
* invitaciones;
* aprobación y rechazo de membresías;
* suspensión y remoción de miembros;
* creación y modificación de roles;
* asignación de permisos;
* transferencia de propiedad;
* cambios de configuración;
* acceso administrativo global.

---

# Notificaciones

Deberán notificarse eventos relevantes.

Ejemplos:

* invitación recibida;
* solicitud aprobada;
* solicitud rechazada;
* rol asignado;
* rol removido;
* membresía suspendida;
* membresía restaurada;
* club suspendido;
* sede cerrada;
* cambio operativo relevante.

---

# Métricas

El dominio podrá generar:

* clubes registrados;
* clubes activos;
* clubes suspendidos;
* sedes por club;
* miembros activos;
* solicitudes pendientes;
* invitaciones aceptadas;
* deportes ofrecidos;
* administradores activos;
* tiempo de onboarding;
* tasa de activación.

---

# Pruebas mínimas

Deberán existir pruebas para:

* creación de club;
* asignación de propietario;
* aislamiento entre clubes;
* permisos;
* cambio de contexto;
* invitaciones idempotentes;
* solicitudes de membresía;
* suspensión;
* transferencia de propiedad;
* imposibilidad de eliminar al último propietario;
* acceso denegado entre tenants;
* restricciones compuestas.

---

# Reglas principales

1. Rondo es multi-club desde el inicio.
2. Un usuario puede pertenecer a múltiples clubes.
3. Los roles y permisos dependen del club.
4. Un club debe tener al menos un propietario activo.
5. Ningún club puede acceder a información privada de otro.
6. Toda entidad dependiente debe incluir `clubId`.
7. El club puede tener múltiples sedes.
8. Las sedes tienen zona horaria propia.
9. Los deportes provienen del catálogo global.
10. Los clubes no modifican el catálogo maestro.
11. Las membresías conservan historial.
12. Las suspensiones de club y usuario son conceptos distintos.
13. El backend valida siempre permisos y contexto.
14. Los UUID no reemplazan autorización.
15. La propiedad debe transferirse antes de eliminar al último propietario.
16. Las configuraciones deben poder evolucionar sin romper el aislamiento.
17. Un partido puede existir sin club cuando las reglas lo permitan.
18. Toda operación administrativa sensible debe auditarse.

---

# Principio final

CLUBS debe permitir que cada organización opere como un entorno independiente dentro de Rondo sin fragmentar la plataforma.

El dominio debe garantizar aislamiento, permisos contextuales y configuración flexible, manteniendo al mismo tiempo una experiencia coherente para usuarios que participan en uno o varios clubes.
