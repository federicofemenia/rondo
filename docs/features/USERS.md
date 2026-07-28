# USERS

# Objetivo

Este documento define el dominio de usuarios de Rondo.

Su propósito es establecer:

* qué representa un usuario;
* qué información almacena;
* qué datos son públicos o privados;
* cómo se administra el perfil;
* cómo se relaciona con autenticación, clubes, partidos y reputación;
* qué reglas deben respetarse durante todo su ciclo de vida.

La autenticación identifica al usuario mediante Clerk.

Rondo mantiene su propio modelo de usuario para almacenar la información del negocio.

---

# Definición

Un usuario representa a una persona registrada en Rondo.

El usuario puede actuar como:

* jugador;
* organizador de partidos;
* miembro de un club;
* administrador de un club;
* participante de una reserva;
* receptor de invitaciones;
* autor de valoraciones.

Un mismo usuario puede cumplir varios roles simultáneamente según el contexto.

---

# Responsabilidades del dominio

El dominio de usuarios administra:

* perfil personal;
* datos de contacto;
* sexo;
* foto;
* deportes;
* nivel deportivo;
* preferencias;
* privacidad;
* disponibilidad para invitaciones;
* estado de la cuenta;
* configuración regional;
* relación con el proveedor de autenticación.

No administra directamente:

* credenciales;
* contraseñas;
* sesiones;
* reservas;
* partidos;
* mensajes;
* valoraciones;
* membresías de clubes.

Esas responsabilidades pertenecen a otros dominios.

---

# Identidad

Todo usuario tendrá un identificador interno generado por Rondo.

```ts
type UserId = string;
```

El identificador será:

* UUID;
* único;
* inmutable;
* independiente de Clerk.

Rondo no utilizará el identificador de Clerk como clave primaria del dominio.

---

# Relación con Clerk

Clerk será responsable de:

* registro;
* inicio de sesión;
* recuperación de contraseña;
* sesiones;
* proveedores sociales;
* verificación de email cuando corresponda;
* seguridad de credenciales.

Rondo almacenará una referencia externa:

```ts
authProviderId: string;
```

Inicialmente, el proveedor será Clerk.

El nombre del campo no deberá acoplarse necesariamente al proveedor.

Ejemplo recomendado:

```ts
externalAuthId: string;
```

En infraestructura podrá documentarse que el valor corresponde a `clerk_user_id`.

---

# Modelo conceptual

```ts
interface User {
  id: UserId;
  externalAuthId: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string;

  sex: UserSex;
  birthDate?: Date;

  photoUrl?: string;
  bio?: string;

  invitationAvailability: InvitationAvailability;

  locale: string;
  timeZone: string;

  status: UserStatus;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

Este modelo es conceptual.

La implementación definitiva deberá respetar `DATABASE.md`.

---

# Datos requeridos

Durante el registro se solicitarán:

* nombre;
* apellido;
* email;
* teléfono;
* contraseña;
* sexo.

La contraseña será administrada únicamente por Clerk.

Rondo no almacenará:

* contraseña;
* hash de contraseña;
* token de recuperación;
* credenciales OAuth.

---

# Datos opcionales

El usuario podrá completar posteriormente:

* foto de perfil;
* fecha de nacimiento;
* biografía;
* deportes favoritos;
* nivel por deporte;
* posición preferida;
* disponibilidad para invitaciones;
* configuración regional.

Los campos opcionales no deberán bloquear el uso básico de la aplicación, salvo que una funcionalidad requiera explícitamente alguno de ellos.

---

# Nombre

El usuario tendrá:

```ts
firstName: string;
lastName: string;
```

Reglas:

* no pueden estar vacíos;
* deben eliminar espacios innecesarios;
* deben aceptar caracteres internacionales;
* no deben limitarse únicamente al alfabeto ASCII;
* tendrán una longitud máxima definida por contrato.

Nombre completo:

```ts
fullName = firstName + ' ' + lastName;
```

El nombre completo será un valor derivado.

No deberá almacenarse como fuente principal de verdad.

---

# Email

El email será utilizado para:

* autenticación;
* recuperación de cuenta;
* comunicaciones importantes;
* notificaciones opcionales.

Reglas:

* deberá estar normalizado;
* deberá validarse su formato;
* deberá ser único cuando el proveedor de autenticación así lo garantice;
* no se mostrará públicamente;
* los cambios deberán sincronizarse con Clerk.

Rondo conservará una copia del email para necesidades del dominio y comunicación.

Clerk continuará siendo la fuente de verdad para autenticación.

---

# Teléfono

El teléfono podrá utilizarse para:

* contacto entre participantes cuando una regla futura lo permita;
* recuperación adicional;
* validaciones;
* notificaciones;
* coordinación de reservas.

Reglas:

* deberá almacenarse en formato internacional;
* no se mostrará públicamente por defecto;
* no será compartido automáticamente con otros jugadores;
* podrá requerir verificación en versiones futuras.

Formato recomendado:

```text
E.164
```

Ejemplo:

```text
+5491112345678
```

---

# Sexo

El usuario deberá seleccionar uno de los siguientes valores:

```ts
enum UserSex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNSPECIFIED = 'UNSPECIFIED',
}
```

Presentación en interfaz:

* Hombre;
* Mujer;
* Prefiero no informarlo.

Este dato podrá utilizarse para:

* búsquedas de jugadores;
* sugerencias;
* estadísticas;
* categorías deportivas;
* compatibilidad con partidos.

El sexo del usuario no determinará por sí solo si puede participar en un partido.

La autorización final dependerá de las reglas del partido.

---

# Fecha de nacimiento

La fecha de nacimiento será opcional durante el registro inicial.

Podrá requerirse más adelante para:

* categorías por edad;
* torneos;
* restricciones de menores;
* seguros;
* estadísticas.

Se almacenará como fecha, sin hora.

```ts
birthDate?: DateOnly;
```

La edad será un valor calculado.

Nunca deberá almacenarse como un número fijo.

---

# Menores de edad

La primera versión de Rondo estará orientada a usuarios adultos.

El soporte formal para menores requerirá definir:

* edad mínima;
* consentimiento de adulto responsable;
* privacidad especial;
* reglas de comunicación;
* tratamiento de datos;
* responsabilidad del club.

Hasta que estas reglas estén implementadas, el registro podrá restringirse a mayores de edad.

La edad mínima deberá configurarse por país y registrarse como decisión de producto.

---

# Foto de perfil

La foto se almacenará en Object Storage.

La entidad User conservará únicamente:

```ts
photoUrl?: string;
```

La carga de imagen deberá:

* validar formato;
* validar tamaño;
* comprimir cuando corresponda;
* generar una URL segura;
* permitir reemplazo;
* permitir eliminación.

Formatos iniciales recomendados:

* JPEG;
* PNG;
* WebP.

No se almacenarán imágenes binarias en PostgreSQL.

---

# Avatar alternativo

Cuando el usuario no tenga foto, se mostrará un avatar generado con sus iniciales.

Ejemplo:

```text
Federico Femenia → FF
```

Reglas:

* máximo dos iniciales;
* formato circular;
* color asignado de manera consistente;
* texto legible;
* cumplimiento del sistema de diseño.

---

# Biografía

El usuario podrá agregar una descripción breve.

```ts
bio?: string;
```

Ejemplos:

* posición en la que juega;
* frecuencia deportiva;
* estilo de juego;
* disponibilidad general.

Reglas:

* longitud limitada;
* texto plano en el MVP;
* no se permitirá HTML;
* deberá pasar controles de contenido;
* podrá reportarse si viola normas de comunidad.

---

# Deportes del usuario

Un usuario podrá asociarse con uno o varios deportes.

La relación incluirá información específica por deporte.

Ejemplo conceptual:

```ts
interface UserSportProfile {
  userId: UserId;
  sportId: SportId;
  level: SportLevel;
  preferredPositions: string[];
  isFavorite: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Ejemplos:

* fútbol;
* pádel;
* tenis;
* básquet;
* vóley.

La lista oficial de deportes será administrada por el dominio `SPORTS`.

---

# Nivel deportivo

El nivel deberá definirse por deporte.

Un usuario puede tener niveles diferentes.

Ejemplo:

```text
Fútbol: intermedio
Pádel: principiante
Tenis: avanzado
```

Enum inicial:

```ts
enum SportLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}
```

Podrá evaluarse una escala más detallada por deporte en futuras versiones.

El nivel declarado por el usuario no equivale a reputación ni rendimiento verificado.

---

# Posiciones preferidas

Algunos deportes permiten posiciones.

Ejemplos en fútbol:

* arquero;
* defensor;
* mediocampista;
* delantero.

Las posiciones no deberán almacenarse como texto libre cuando exista un catálogo definido por deporte.

El dominio `SPORTS` determinará:

* si el deporte utiliza posiciones;
* qué posiciones admite;
* cuántas puede seleccionar el usuario.

---

# Deporte favorito

El usuario podrá marcar uno o varios deportes como favoritos.

Los deportes favoritos podrán utilizarse para:

* personalizar el inicio;
* ordenar resultados;
* recomendar partidos;
* priorizar notificaciones;
* mejorar búsquedas.

No limitarán el acceso a otros deportes.

---

# Disponibilidad para invitaciones

El usuario podrá controlar si desea aparecer en búsquedas e invitaciones.

```ts
enum InvitationAvailability {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}
```

Cuando esté disponible:

* podrá aparecer en búsquedas;
* podrá recibir invitaciones;
* podrá recibir sugerencias de partidos.

Cuando esté no disponible:

* no aparecerá en resultados de búsqueda de jugadores disponibles;
* no recibirá invitaciones nuevas;
* conservará invitaciones existentes;
* podrá seguir uniéndose voluntariamente a partidos.

La disponibilidad no afecta:

* membresías;
* reservas;
* partidos ya confirmados;
* participación actual.

---

# Preferencias futuras de disponibilidad

En versiones posteriores podrá ampliarse con:

* días disponibles;
* franjas horarias;
* zonas;
* distancia máxima;
* deportes;
* nivel buscado;
* modalidad competitiva o recreativa.

Ejemplo conceptual:

```ts
interface PlayerAvailabilityPreferences {
  daysOfWeek: DayOfWeek[];
  timeRanges: TimeRange[];
  maximumDistanceKm?: number;
  sportIds: SportId[];
}
```

No forma parte obligatoria del MVP.

---

# Privacidad

Los datos del usuario deberán dividirse en:

* públicos;
* visibles para participantes;
* privados;
* administrativos.

---

# Datos públicos

Podrán mostrarse públicamente dentro de Rondo:

* nombre;
* apellido;
* foto;
* deportes;
* nivel declarado;
* reputación agregada;
* cantidad de partidos;
* biografía;
* clubes visibles;
* insignias futuras.

La visibilidad exacta podrá depender de la configuración de privacidad.

---

# Datos visibles para participantes

Podrán mostrarse únicamente a usuarios que compartan un partido o reserva:

* nombre completo;
* foto;
* estado de participación;
* reputación;
* posición deportiva;
* mensajes del chat.

El teléfono no se mostrará automáticamente.

---

# Datos privados

No deberán mostrarse públicamente:

* email;
* teléfono;
* identificador de Clerk;
* fecha completa de nacimiento;
* configuración interna;
* datos de auditoría;
* información de seguridad.

---

# Datos administrativos

Los administradores autorizados podrán acceder únicamente a información necesaria para operar el club.

Esto podrá incluir:

* nombre;
* contacto;
* membresía;
* reservas;
* sanciones;
* historial relevante.

El administrador de un club no obtiene acceso general a todos los datos privados del usuario.

---

# Perfil público

Rondo podrá ofrecer una vista de perfil público dentro de la plataforma.

Ruta conceptual:

```text
/users/:userId
```

El perfil podrá mostrar:

* avatar;
* nombre;
* deportes;
* nivel;
* reputación;
* cantidad de partidos;
* clubes;
* biografía;
* insignias;
* disponibilidad.

No deberá mostrar datos de contacto privados.

---

# Perfil propio

El usuario podrá acceder a una vista privada de su perfil.

Podrá:

* editar datos;
* cambiar foto;
* seleccionar deportes;
* modificar niveles;
* configurar disponibilidad;
* gestionar privacidad;
* revisar estadísticas;
* revisar valoraciones;
* solicitar eliminación de cuenta.

---

# Edición del perfil

El usuario podrá modificar:

* nombre;
* apellido;
* teléfono;
* sexo;
* foto;
* biografía;
* deportes;
* nivel;
* posiciones;
* disponibilidad;
* preferencias.

Los cambios en email deberán coordinarse con Clerk.

Algunos cambios podrán requerir verificación.

---

# Sincronización con Clerk

Cuando se crea una cuenta en Clerk, Rondo deberá crear su usuario interno.

Flujo recomendado:

```text
Usuario se registra
        ↓
Clerk crea identidad
        ↓
Webhook o caso de uso de sincronización
        ↓
Rondo crea User
        ↓
Se completa el perfil
```

La operación deberá ser idempotente.

Recibir el mismo evento varias veces no deberá duplicar usuarios.

---

# Creación incompleta

Puede existir una identidad autenticada sin perfil completo por causas como:

* interrupción del registro;
* error de red;
* webhook demorado;
* cierre de la aplicación.

Rondo deberá contemplar el estado:

```ts
PROFILE_INCOMPLETE
```

En ese estado, el usuario podrá autenticarse, pero deberá completar los datos obligatorios antes de utilizar funcionalidades principales.

---

# Estados del usuario

Enum recomendado:

```ts
enum UserStatus {
  PROFILE_INCOMPLETE = 'PROFILE_INCOMPLETE',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
  DELETED = 'DELETED',
}
```

---

# Perfil incompleto

El estado `PROFILE_INCOMPLETE` indica que existe una identidad válida, pero faltan datos obligatorios.

El usuario deberá ser dirigido al onboarding.

No podrá:

* crear partidos;
* reservar canchas;
* enviar invitaciones;
* enviar mensajes.

Podrá:

* cerrar sesión;
* completar su perfil;
* consultar documentos legales.

---

# Usuario activo

El estado `ACTIVE` permite utilizar la plataforma según permisos y contexto.

Es el estado normal de operación.

---

# Usuario suspendido

El estado `SUSPENDED` se utilizará cuando exista una restricción temporal.

Motivos posibles:

* incumplimiento de normas;
* fraude;
* conducta reportada;
* abuso;
* revisión administrativa.

Un usuario suspendido no podrá:

* crear partidos;
* unirse a partidos;
* reservar;
* enviar mensajes;
* enviar invitaciones.

Podrá, según la política:

* iniciar sesión;
* consultar el motivo;
* apelar;
* cerrar sesión;
* acceder a información legal.

Toda suspensión deberá incluir:

* motivo;
* fecha;
* responsable;
* duración;
* evidencia administrativa;
* estado de apelación.

---

# Usuario desactivado

El estado `DEACTIVATED` representa una cuenta desactivada voluntariamente.

El usuario no aparecerá en búsquedas.

Sus relaciones históricas deberán conservarse cuando sean necesarias.

La cuenta podrá reactivarse si la política lo permite.

---

# Usuario eliminado

El estado `DELETED` representa una solicitud de eliminación procesada.

La eliminación deberá respetar:

* obligaciones legales;
* auditoría;
* integridad histórica;
* prevención de fraude;
* privacidad.

Podrán anonimizarse datos personales manteniendo referencias históricas.

Ejemplo:

```text
Usuario eliminado
```

en partidos o valoraciones antiguas.

---

# Eliminación de cuenta

El usuario podrá solicitar eliminar su cuenta.

El proceso deberá:

1. confirmar identidad;
2. informar consecuencias;
3. comprobar obligaciones pendientes;
4. cancelar o transferir responsabilidades;
5. revocar sesiones;
6. desactivar acceso;
7. anonimizar o eliminar datos;
8. conservar únicamente lo legalmente requerido.

No deberá eliminarse inmediatamente información que afecte:

* reservas futuras;
* pagos;
* disputas;
* auditoría;
* seguridad;
* cumplimiento legal.

---

# Restricciones para eliminar la cuenta

Podrá impedirse temporalmente la eliminación definitiva cuando el usuario:

* tenga reservas futuras activas;
* sea organizador de partidos pendientes;
* tenga pagos o reembolsos pendientes;
* esté involucrado en una disputa;
* tenga obligaciones administrativas de un club.

En esos casos se deberá explicar qué acción debe completar.

---

# Transferencia de responsabilidades

Antes de eliminar o desactivar una cuenta, Rondo deberá resolver:

* partidos organizados;
* reservas;
* administración de clubes;
* promociones;
* torneos futuros.

Ejemplo:

Un administrador único de un club deberá asignar otro administrador antes de eliminar su cuenta.

---

# Reputación

El usuario tendrá reputación asociada.

La fuente de verdad pertenece a `PLAYER_REPUTATION`.

El perfil podrá mostrar valores agregados como:

```ts
interface UserReputationSummary {
  gameRating?: number;
  behaviorRating?: number;
  receivedRatingsCount: number;
}
```

El usuario no podrá editar su propia reputación.

---

# Ausencia de reputación

Los usuarios nuevos no deberán mostrarse con puntaje cero.

Deberá mostrarse un estado como:

```text
Sin valoraciones todavía
```

El cero podría interpretarse incorrectamente como mala reputación.

---

# Estadísticas

El perfil podrá mostrar estadísticas derivadas:

* partidos jugados;
* partidos organizados;
* asistencias;
* cancelaciones;
* ausencias;
* valoraciones recibidas;
* deportes practicados;
* clubes asociados.

Estas estadísticas no deberán almacenarse todas directamente en User.

Podrán calcularse o mantenerse en modelos especializados.

---

# Historial deportivo

El usuario podrá consultar:

* próximos partidos;
* partidos anteriores;
* reservas;
* clubes;
* invitaciones;
* valoraciones.

Cada dominio será responsable de su información.

USERS solo compone la vista.

---

# Membresías de clubes

La relación entre usuario y club no formará parte directa de User.

Se modelará mediante una entidad específica:

```ts
ClubMembership
```

Permitirá representar:

* club;
* usuario;
* rol;
* estado;
* fecha de ingreso;
* permisos;
* vigencia.

Un usuario podrá pertenecer a múltiples clubes.

---

# Roles

Los roles no deberán almacenarse como una única propiedad global en User.

Ejemplo incorrecto:

```ts
user.role = 'CLUB_ADMIN'
```

Ejemplo correcto:

```text
User
  ├── miembro de Club A
  ├── administrador de Club B
  └── jugador independiente
```

Los permisos dependen del contexto.

---

# Configuración regional

Todo usuario tendrá preferencias regionales.

```ts
interface UserRegionalSettings {
  locale: string;
  timeZone: string;
}
```

Valores iniciales sugeridos para Argentina:

```text
locale: es-AR
timeZone: America/Argentina/Buenos_Aires
```

La arquitectura deberá soportar múltiples países.

---

# Idioma

El idioma se utilizará para:

* interfaz;
* emails;
* notificaciones;
* fechas;
* textos automáticos;
* formatos.

El usuario podrá cambiarlo en futuras versiones.

---

# Zona horaria

La zona horaria será necesaria para:

* horarios de partidos;
* recordatorios;
* reservas;
* vencimientos;
* chat;
* notificaciones.

Las fechas deberán almacenarse en UTC.

La zona horaria se utilizará únicamente para presentación e interpretación.

---

# Configuración de notificaciones

Las preferencias detalladas pertenecerán a `NOTIFICATIONS`.

USERS podrá exponer un acceso a dicha configuración.

Ejemplos:

* invitaciones;
* recordatorios;
* mensajes;
* promociones;
* valoraciones;
* cambios de reserva.

---

# Bloqueos entre usuarios

En una futura versión, un usuario podrá bloquear a otro.

El bloqueo podrá impedir:

* mensajes directos futuros;
* invitaciones;
* aparición en sugerencias;
* interacción social.

No deberá alterar automáticamente partidos ya confirmados sin aplicar reglas específicas.

Esta funcionalidad no forma parte obligatoria del MVP.

---

# Reportes

El usuario podrá ser reportado desde contextos válidos.

Ejemplos:

* partido;
* chat;
* perfil;
* valoración.

Un reporte deberá incluir:

* autor;
* usuario reportado;
* motivo;
* contexto;
* fecha;
* evidencia disponible;
* estado de moderación.

Los reportes no formarán parte directa de la entidad User.

---

# Validaciones

Antes de activar un usuario deberá validarse:

* identidad externa existente;
* nombre válido;
* apellido válido;
* email válido;
* teléfono válido;
* sexo seleccionado;
* aceptación de términos;
* edad mínima cuando corresponda.

---

# Aceptación legal

El registro deberá registrar:

* versión de términos aceptada;
* versión de política de privacidad;
* fecha;
* dirección IP cuando legalmente corresponda;
* origen de aceptación.

La aceptación legal deberá modelarse como registro histórico.

No como un simple booleano en User.

---

# Casos de uso

El dominio deberá contemplar al menos:

```text
CreateUserFromAuthIdentity
CompleteUserProfile
GetCurrentUser
GetPublicUserProfile
UpdateUserProfile
UpdateUserPhoto
RemoveUserPhoto
AddUserSport
UpdateUserSport
RemoveUserSport
ChangeInvitationAvailability
DeactivateUser
ReactivateUser
RequestAccountDeletion
SuspendUser
RestoreSuspendedUser
```

---

# CreateUserFromAuthIdentity

Crea el usuario interno a partir de una identidad válida de Clerk.

Debe ser idempotente.

Datos mínimos:

* externalAuthId;
* email;
* fecha de creación.

Estado inicial:

```text
PROFILE_INCOMPLETE
```

---

# CompleteUserProfile

Completa los datos obligatorios.

Requiere:

* nombre;
* apellido;
* teléfono;
* sexo;
* aceptación legal.

Cuando todos los datos son válidos:

```text
PROFILE_INCOMPLETE → ACTIVE
```

---

# GetCurrentUser

Devuelve el perfil privado del usuario autenticado.

Incluye:

* datos personales;
* deportes;
* preferencias;
* estado;
* configuración;
* resumen de reputación.

No incluye credenciales ni información interna sensible.

---

# GetPublicUserProfile

Devuelve únicamente información visible para terceros.

Debe aplicar:

* configuración de privacidad;
* bloqueos;
* permisos;
* estado del usuario;
* contexto de relación.

---

# UpdateUserProfile

Permite editar campos autorizados.

No permite modificar:

* id;
* externalAuthId;
* estado administrativo;
* reputación;
* fechas de auditoría.

---

# UpdateUserPhoto

Carga una nueva imagen mediante Object Storage.

Debe:

* validar archivo;
* reemplazar la referencia;
* eliminar o archivar la imagen anterior;
* actualizar `photoUrl`.

---

# ChangeInvitationAvailability

Permite cambiar entre:

```text
AVAILABLE
UNAVAILABLE
```

El cambio deberá aplicarse inmediatamente a nuevas búsquedas e invitaciones.

---

# Eventos de dominio

Eventos sugeridos:

```text
UserCreated
UserProfileCompleted
UserProfileUpdated
UserPhotoUpdated
UserInvitationAvailabilityChanged
UserActivated
UserSuspended
UserRestored
UserDeactivated
UserReactivated
UserDeletionRequested
UserDeleted
```

Estos eventos podrán generar:

* auditoría;
* notificaciones;
* indexación;
* sincronización;
* limpieza de sesiones;
* actualización de búsquedas.

---

# Endpoints iniciales

Ejemplos conceptuales:

```http
GET /api/v1/users/me
PATCH /api/v1/users/me
POST /api/v1/users/me/photo
DELETE /api/v1/users/me/photo
GET /api/v1/users/:userId
GET /api/v1/users/:userId/sports
POST /api/v1/users/me/sports
PATCH /api/v1/users/me/sports/:sportId
DELETE /api/v1/users/me/sports/:sportId
PATCH /api/v1/users/me/invitation-availability
POST /api/v1/users/me/deactivation
POST /api/v1/users/me/reactivation
POST /api/v1/users/me/deletion-request
```

Los contratos definitivos deberán documentarse en la implementación y respetar `API_GUIDELINES.md`.

---

# Respuesta pública de usuario

Ejemplo conceptual:

```json
{
  "id": "user_uuid",
  "firstName": "Federico",
  "lastName": "Femenia",
  "photoUrl": "https://storage.example.com/users/photo.webp",
  "bio": "Juego al fútbol los fines de semana",
  "sports": [
    {
      "sportId": "football_uuid",
      "name": "Fútbol",
      "level": "INTERMEDIATE",
      "preferredPositions": ["MIDFIELDER"]
    }
  ],
  "reputation": {
    "gameRating": 4.4,
    "behaviorRating": 4.8,
    "receivedRatingsCount": 18
  },
  "invitationAvailability": "AVAILABLE"
}
```

---

# Respuesta privada del usuario actual

Ejemplo conceptual:

```json
{
  "id": "user_uuid",
  "firstName": "Federico",
  "lastName": "Femenia",
  "email": "usuario@example.com",
  "phone": "+5491112345678",
  "sex": "MALE",
  "birthDate": null,
  "photoUrl": "https://storage.example.com/users/photo.webp",
  "bio": "Juego al fútbol los fines de semana",
  "status": "ACTIVE",
  "invitationAvailability": "AVAILABLE",
  "locale": "es-AR",
  "timeZone": "America/Argentina/Buenos_Aires",
  "sports": [],
  "createdAt": "2026-07-28T14:00:00Z",
  "updatedAt": "2026-07-28T14:00:00Z"
}
```

---

# Persistencia conceptual

Tabla principal:

```text
users
```

Campos sugeridos:

```text
id
external_auth_id
first_name
last_name
email
phone
sex
birth_date
photo_url
bio
invitation_availability
locale
time_zone
status
created_at
updated_at
deleted_at
```

Restricciones:

* `id` único;
* `external_auth_id` único;
* `email` indexado;
* `status` validado;
* `sex` validado;
* `invitation_availability` validado.

---

# Tabla de deportes del usuario

```text
user_sports
```

Campos sugeridos:

```text
id
user_id
sport_id
level
is_favorite
is_active
created_at
updated_at
```

Restricción única:

```text
user_id + sport_id
```

---

# Tabla de posiciones preferidas

Podrá utilizarse:

```text
user_sport_positions
```

Campos:

```text
user_sport_id
sport_position_id
created_at
```

Esto evita almacenar arrays sin integridad referencial.

---

# Índices sugeridos

```text
users.external_auth_id
users.email
users.status
users.invitation_availability
user_sports.user_id
user_sports.sport_id
user_sports.level
```

Los índices finales deberán responder a consultas reales.

---

# Búsqueda de jugadores

El dominio USERS aportará datos para búsquedas por:

* nombre;
* sexo;
* deporte;
* nivel;
* posición;
* disponibilidad;
* reputación;
* club;
* distancia futura.

La composición final de filtros pertenecerá a `SEARCH.md`.

USERS será responsable de exponer datos consistentes e indexables.

---

# Seguridad

Toda consulta privada deberá verificar identidad.

Toda modificación deberá verificar que:

* el usuario modifica su propio perfil;
* o existe un permiso administrativo explícito.

Nunca deberá confiarse únicamente en un `userId` enviado por el frontend.

El usuario autenticado se obtendrá del contexto de seguridad.

---

# Auditoría

Registrar al menos:

* creación;
* activación;
* modificación de datos sensibles;
* cambio de email;
* cambio de teléfono;
* suspensión;
* reactivación;
* desactivación;
* solicitud de eliminación;
* eliminación;
* cambio de disponibilidad.

Los registros de auditoría no deberán poder editarse desde el cliente.

---

# Rendimiento

Las consultas frecuentes deberán evitar cargar toda la información relacionada.

Ejemplo:

Una MatchCard necesita:

* id;
* nombre;
* avatar;
* reputación breve.

No necesita:

* email;
* teléfono;
* configuración;
* historial completo.

Se utilizarán DTOs específicos según el contexto.

---

# Consistencia

Los cambios que afecten múltiples sistemas deberán ejecutarse de forma segura.

Ejemplo:

```text
Cambiar email
    ↓
Actualizar Clerk
    ↓
Actualizar Rondo
    ↓
Registrar auditoría
```

Si una operación externa falla, deberá existir un mecanismo de reconciliación.

---

# Moderación

Un usuario suspendido o eliminado deberá dejar de aparecer en:

* búsquedas;
* recomendaciones;
* invitaciones nuevas;
* listados públicos.

El historial podrá mantener una representación anonimizada.

---

# Onboarding

El onboarding inicial deberá ser breve.

Flujo recomendado:

```text
Crear cuenta
    ↓
Nombre y apellido
    ↓
Teléfono
    ↓
Sexo
    ↓
Seleccionar deportes
    ↓
Foto opcional
    ↓
Disponibilidad para invitaciones
    ↓
Inicio
```

Los deportes podrán seleccionarse durante el onboarding, aunque el usuario podrá modificarlos luego.

---

# Progreso del perfil

Rondo podrá mostrar un porcentaje de perfil completo.

Ejemplo:

```text
Perfil completo al 80 %
```

Este porcentaje será informativo.

No deberá bloquear funcionalidades salvo que falten datos obligatorios.

---

# Datos que no deben almacenarse en User

Evitar agregar directamente:

* club actual;
* rol global;
* promedio de reputación editable;
* cantidad fija de partidos;
* contraseña;
* token;
* lista de reservas;
* lista de partidos;
* mensajes;
* promociones;
* saldo;
* métodos de pago.

Cada dato deberá pertenecer a su dominio correspondiente.

---

# Futuras mejoras

* perfil verificado;
* verificación de teléfono;
* verificación de identidad;
* bloqueo de usuarios;
* perfiles privados;
* disponibilidad por calendario;
* importación de contactos;
* seguidores;
* amistades;
* estadísticas avanzadas;
* insignias;
* nivel verificado;
* recomendaciones personalizadas;
* perfiles familiares;
* cuentas para menores con adulto responsable.

---

# Métricas

El dominio podrá generar métricas como:

* usuarios registrados;
* perfiles completados;
* usuarios activos;
* deportes seleccionados;
* disponibilidad activada;
* tasa de abandono del onboarding;
* cuentas desactivadas;
* cuentas suspendidas.

Las métricas deberán ser agregadas y respetar privacidad.

---

# Reglas principales

1. Clerk administra la identidad; Rondo administra el usuario.
2. El identificador interno de Rondo es independiente del proveedor.
3. El email y teléfono son privados.
4. El sexo se almacena mediante enum.
5. Los roles dependen del contexto y no son globales.
6. La reputación pertenece a otro dominio.
7. Las membresías pertenecen al dominio de clubes.
8. Un usuario puede practicar múltiples deportes.
9. La disponibilidad controla búsquedas e invitaciones nuevas.
10. La eliminación debe preservar integridad, auditoría y obligaciones legales.
11. Los datos públicos y privados deben estar claramente separados.
12. Toda modificación sensible debe auditarse.

---

# Principio final

El usuario es el centro de Rondo, pero no debe convertirse en una entidad que concentre toda la aplicación.

Su modelo debe contener únicamente identidad de negocio, perfil y preferencias.

Los partidos, clubes, reservas, mensajes, invitaciones y valoraciones deben evolucionar en dominios independientes y relacionarse con User mediante identificadores y contratos explícitos.
