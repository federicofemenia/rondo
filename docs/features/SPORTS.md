# SPORTS

# Objetivo

Este documento define el dominio de deportes de Rondo.

Su propósito es centralizar:

* deportes disponibles;
* modalidades;
* posiciones;
* niveles;
* cantidad de jugadores;
* categorías;
* reglas configurables;
* compatibilidad con partidos, canchas, usuarios y búsquedas.

El dominio `SPORTS` funciona como catálogo maestro.

No organiza partidos ni administra reservas.

---

# Definición

Un deporte representa una disciplina disponible dentro de Rondo.

Ejemplos:

* fútbol;
* pádel;
* tenis;
* básquet;
* vóley;
* hockey;
* handball.

Cada deporte puede tener:

* modalidades;
* posiciones;
* niveles;
* configuraciones;
* reglas específicas;
* tipos de cancha;
* formatos de partido.

---

# Responsabilidades

El dominio `SPORTS` administra:

* catálogo de deportes;
* nombres y descripciones;
* iconos;
* estado;
* modalidades;
* posiciones;
* niveles;
* cantidad recomendada de participantes;
* compatibilidad con tipos de cancha;
* configuración base de partidos.

No administra:

* jugadores;
* clubes;
* canchas reales;
* reservas;
* partidos concretos;
* reputación;
* invitaciones.

---

# Entidad Sport

Modelo conceptual:

```ts
interface Sport {
  id: SportId;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  status: SportStatus;
  supportsPositions: boolean;
  supportsTeams: boolean;
  supportsSingles: boolean;
  supportsDoubles: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

# Identificador

```ts
type SportId = string;
```

Reglas:

* UUID;
* único;
* inmutable;
* generado por Rondo.

---

# Código

Cada deporte tendrá un código técnico estable.

Ejemplos:

```text
FOOTBALL
PADEL
TENNIS
BASKETBALL
VOLLEYBALL
HOCKEY
HANDBALL
```

El código:

* no se mostrará directamente al usuario;
* deberá ser único;
* no cambiará aunque cambie el nombre visible;
* podrá utilizarse en integraciones, filtros y seeds.

---

# Nombre

Ejemplos:

```text
Fútbol
Pádel
Tenis
Básquet
Vóley
```

El nombre visible podrá variar según idioma.

El código será la referencia estable.

---

# Estado del deporte

```ts
enum SportStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
```

Un deporte activo:

* puede seleccionarse;
* puede utilizarse en clubes;
* puede asociarse a canchas;
* puede utilizarse en partidos;
* aparece en búsquedas.

Un deporte inactivo:

* no puede utilizarse en nuevas operaciones;
* conserva relaciones históricas;
* no debe eliminarse si ya fue utilizado.

---

# Modalidades

Un deporte puede tener diferentes modalidades.

Ejemplos:

## Fútbol

* fútbol 5;
* fútbol 7;
* fútbol 8;
* fútbol 11;
* futsal.

## Pádel

* dobles;
* singles.

## Tenis

* singles;
* dobles.

## Básquet

* 3x3;
* 5x5.

## Vóley

* vóley 6;
* vóley playa.

---

# Entidad SportModality

```ts
interface SportModality {
  id: SportModalityId;
  sportId: SportId;
  code: string;
  name: string;
  teamSize?: number;
  totalParticipants?: number;
  minParticipants?: number;
  maxParticipants?: number;
  status: SportModalityStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

---

# Ejemplos de modalidades

```text
FOOTBALL_5
FOOTBALL_7
FOOTBALL_8
FOOTBALL_11
FUTSAL
PADEL_DOUBLES
PADEL_SINGLES
TENNIS_SINGLES
TENNIS_DOUBLES
BASKETBALL_3X3
BASKETBALL_5X5
VOLLEYBALL_6
BEACH_VOLLEY
```

---

# Cantidad de participantes

Cada modalidad deberá definir cuando corresponda:

```ts
teamSize?: number;
totalParticipants?: number;
minParticipants?: number;
maxParticipants?: number;
```

Ejemplo:

```text
Fútbol 5
teamSize: 5
totalParticipants: 10
minParticipants: 2
maxParticipants: 14
```

El máximo puede superar la cantidad ideal para contemplar suplentes.

---

# Cantidad ideal y límites

Deben diferenciarse:

* cantidad ideal;
* mínimo operativo;
* máximo permitido;
* suplentes.

Ejemplo:

```ts
interface ParticipantLimits {
  minimum: number;
  recommended: number;
  maximum: number;
}
```

Estas reglas podrán ser sobrescritas por un partido cuando el deporte lo permita.

---

# Equipos

Algunos deportes se organizan por equipos.

```ts
supportsTeams: boolean;
```

Ejemplos con equipos:

* fútbol;
* básquet;
* vóley;
* hockey;
* handball.

Ejemplos sin equipos obligatorios:

* tenis singles;
* pádel singles;
* running;
* natación.

---

# Individual o dobles

Campos conceptuales:

```ts
supportsSingles: boolean;
supportsDoubles: boolean;
```

Esto permite modelar:

* tenis;
* pádel;
* bádminton;
* tenis de mesa.

---

# Posiciones

Algunos deportes utilizan posiciones.

Ejemplos:

## Fútbol

* arquero;
* defensor;
* mediocampista;
* delantero.

## Básquet

* base;
* escolta;
* alero;
* ala-pívot;
* pívot.

## Vóley

* armador;
* opuesto;
* central;
* punta;
* líbero.

---

# Entidad SportPosition

```ts
interface SportPosition {
  id: SportPositionId;
  sportId: SportId;
  code: string;
  name: string;
  description?: string;
  order: number;
  status: SportPositionStatus;
}
```

---

# Reglas de posiciones

Las posiciones:

* pertenecen a un deporte;
* no pueden reutilizarse entre deportes salvo que exista una definición independiente;
* deberán utilizar códigos estables;
* podrán ordenarse para presentación;
* podrán desactivarse sin borrar historial.

Ejemplo:

```text
GOALKEEPER
DEFENDER
MIDFIELDER
FORWARD
```

---

# Deportes sin posiciones

Cuando:

```ts
supportsPositions = false
```

el sistema no deberá solicitar posiciones al usuario ni al partido.

Ejemplos:

* pádel;
* tenis;
* running.

---

# Múltiples posiciones

Un usuario podrá tener una o varias posiciones por deporte.

Ejemplo:

```text
Fútbol
- defensor
- mediocampista
```

Podrá marcar una posición como principal.

Modelo conceptual:

```ts
interface UserSportPosition {
  userSportId: string;
  sportPositionId: SportPositionId;
  isPrimary: boolean;
}
```

---

# Niveles deportivos

Rondo debe permitir clasificar nivel de juego.

Enum general inicial:

```ts
enum SportLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}
```

Presentación:

* Principiante;
* Intermedio;
* Avanzado.

---

# Nivel general y nivel específico

El nivel puede variar según el deporte.

Ejemplo:

```text
Fútbol: avanzado
Pádel: intermedio
Tenis: principiante
```

Nunca deberá almacenarse un único nivel global en User.

---

# Escalas específicas

Algunos deportes utilizan escalas propias.

Ejemplo en pádel:

```text
8.ª
7.ª
6.ª
5.ª
4.ª
3.ª
2.ª
1.ª
```

Ejemplo en tenis:

* principiante;
* intermedio;
* avanzado;
* competitivo;
* ranking federado.

RONDO deberá permitir en el futuro niveles específicos por deporte.

---

# Entidad SportLevelDefinition

Modelo conceptual:

```ts
interface SportLevelDefinition {
  id: string;
  sportId: SportId;
  code: string;
  name: string;
  numericValue?: number;
  order: number;
  isDefault: boolean;
  status: SportLevelStatus;
}
```

---

# Estrategia MVP de niveles

Para el MVP:

* utilizar nivel general de tres valores;
* permitir que el catálogo evolucione;
* no acoplar el dominio a una única escala rígida.

Los contratos deberán estar preparados para reemplazar o ampliar la escala.

---

# Nivel declarado y nivel calculado

Debe distinguirse:

## Nivel declarado

Elegido por el usuario.

## Nivel calculado

Derivado de:

* reputación;
* resultados;
* valoraciones;
* rendimiento;
* historial.

El MVP utilizará principalmente nivel declarado.

El nivel calculado podrá incorporarse en el futuro.

---

# Categorías de partido

Los partidos podrán clasificarse por categoría de participación.

```ts
enum MatchGenderCategory {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  MIXED = 'MIXED',
  OPEN = 'OPEN',
}
```

Presentación:

* Masculino;
* Femenino;
* Mixto;
* Abierto.

---

# Categoría y sexo del usuario

El campo `sex` del usuario y la categoría del partido son conceptos diferentes.

El deporte define qué categorías pueden utilizarse.

El partido define cuál aplica.

El dominio MATCHES valida compatibilidad.

---

# Reglas iniciales de compatibilidad

## OPEN

Puede participar cualquier usuario.

## MALE

Puede requerir usuarios con:

```text
MALE
```

## FEMALE

Puede requerir usuarios con:

```text
FEMALE
```

## MIXED

Permite usuarios de más de una categoría y puede tener reglas adicionales.

---

# Usuarios con sexo no informado

Un usuario con:

```text
UNSPECIFIED
```

no deberá rechazarse automáticamente de todos los partidos.

La participación dependerá de:

* categoría;
* configuración del partido;
* reglas del club;
* consentimiento del organizador cuando corresponda.

Esta regla deberá definirse con precisión en `MATCHES.md`.

---

# Partidos mixtos

Un partido mixto podrá configurarse de varias formas.

Ejemplos futuros:

* sin proporción obligatoria;
* mínimo de jugadores por categoría;
* distribución exacta;
* equipos balanceados;
* regla definida por el club.

Para el MVP se recomienda:

```text
MIXED sin proporción obligatoria
```

salvo que el organizador establezca restricciones explícitas.

---

# Edad

Los deportes podrán admitir categorías por edad.

Ejemplos:

* menores;
* juveniles;
* adultos;
* +35;
* +40;
* +50.

Modelo conceptual:

```ts
interface AgeCategory {
  id: string;
  sportId?: SportId;
  code: string;
  name: string;
  minAge?: number;
  maxAge?: number;
}
```

No forma parte obligatoria del MVP.

---

# Tipo de cancha

Cada deporte puede asociarse con uno o varios tipos de superficie o cancha.

Ejemplos:

## Fútbol

* césped natural;
* césped sintético;
* parquet;
* cemento.

## Tenis

* polvo de ladrillo;
* cemento;
* césped;
* carpeta.

## Pádel

* sintético;
* cemento;
* panorámica.

---

# Entidad SurfaceType

```ts
interface SurfaceType {
  id: string;
  sportId: SportId;
  code: string;
  name: string;
  status: SurfaceTypeStatus;
}
```

---

# Compatibilidad con canchas

Una cancha deberá declarar:

* deporte;
* modalidad;
* superficie;
* capacidad;
* dimensiones cuando corresponda.

El dominio `COURTS` utilizará el catálogo definido aquí.

---

# Duración predeterminada

Cada deporte o modalidad podrá sugerir una duración.

Ejemplos:

```text
Fútbol 5: 60 minutos
Pádel: 90 minutos
Tenis: 60 o 90 minutos
Básquet 3x3: 30 minutos
```

Modelo conceptual:

```ts
defaultDurationMinutes?: number;
```

La duración del partido o reserva podrá sobrescribirse si la regla lo permite.

---

# Duraciones permitidas

Una modalidad podrá definir:

```ts
allowedDurationMinutes: number[];
```

Ejemplo:

```text
[60, 90, 120]
```

Esto facilita la reserva de canchas.

---

# Configuración de resultados

Algunos deportes admiten resultados.

Ejemplos:

* goles;
* sets;
* puntos;
* games;
* tiempos.

La primera versión de Rondo no necesita un sistema completo de resultados.

Sin embargo, el dominio deberá estar preparado para indicar:

```ts
supportsScore: boolean;
scoreType?: SportScoreType;
```

---

# Tipos de resultado

```ts
enum SportScoreType {
  GOALS = 'GOALS',
  POINTS = 'POINTS',
  SETS = 'SETS',
  TIME = 'TIME',
  NONE = 'NONE',
}
```

Ejemplos:

```text
Fútbol → GOALS
Básquet → POINTS
Tenis → SETS
Running → TIME
```

---

# Competitivo o recreativo

Los partidos podrán tener un estilo.

```ts
enum MatchStyle {
  RECREATIONAL = 'RECREATIONAL',
  COMPETITIVE = 'COMPETITIVE',
}
```

Presentación:

* Recreativo;
* Competitivo.

El deporte puede soportar ambos.

El partido define cuál utiliza.

---

# Intensidad

En futuras versiones podrá incorporarse:

```ts
enum MatchIntensity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
```

Esto puede mejorar recomendaciones y búsquedas.

No forma parte obligatoria del MVP.

---

# Reglas configurables

Cada modalidad podrá definir una configuración base.

Ejemplo conceptual:

```ts
interface SportModalityConfiguration {
  supportsTeams: boolean;
  teamCount?: number;
  playersPerTeam?: number;
  allowSubstitutes: boolean;
  maximumSubstitutes?: number;
  supportsPositions: boolean;
  supportsGenderCategory: boolean;
  supportsAgeCategory: boolean;
  supportsScore: boolean;
  defaultDurationMinutes?: number;
}
```

---

# Configuración heredada

La configuración podrá resolverse por niveles:

```text
Sport
  ↓
SportModality
  ↓
Club configuration
  ↓
Court configuration
  ↓
Match configuration
```

La configuración más específica podrá sobrescribir valores anteriores cuando esté permitido.

---

# Ejemplo de herencia

```text
Fútbol
Duración general: 60 min

Fútbol 11
Duración predeterminada: 90 min

Club Señor Pato
Fútbol 11: 80 min

Partido específico
Duración: 90 min
```

La regla de precedencia deberá estar claramente definida.

---

# Catálogo inicial recomendado

Para el MVP se recomienda comenzar con:

* fútbol;
* pádel;
* tenis;
* básquet;
* vóley.

No es necesario implementar toda la profundidad de reglas desde el primer día.

---

# Fútbol

Modalidades iniciales:

```text
Fútbol 5
Fútbol 7
Fútbol 8
Fútbol 11
Futsal
```

Posiciones:

```text
Arquero
Defensor
Mediocampista
Delantero
```

Resultado:

```text
GOALS
```

Equipos:

```text
2
```

---

# Pádel

Modalidades:

```text
Singles
Dobles
```

Posiciones:

```text
No aplica
```

Resultado:

```text
SETS
```

Duración sugerida:

```text
90 minutos
```

---

# Tenis

Modalidades:

```text
Singles
Dobles
```

Resultado:

```text
SETS
```

Superficies:

```text
Polvo de ladrillo
Cemento
Césped
Carpeta
```

---

# Básquet

Modalidades:

```text
3x3
5x5
```

Posiciones:

```text
Base
Escolta
Alero
Ala-pívot
Pívot
```

Resultado:

```text
POINTS
```

---

# Vóley

Modalidades:

```text
Vóley 6
Vóley playa
```

Posiciones:

```text
Armador
Opuesto
Central
Punta
Líbero
```

Resultado:

```text
POINTS
```

---

# Administración del catálogo

En el MVP, los deportes podrán cargarse mediante seeds.

No será necesario crear una interfaz administrativa completa.

Los cambios deberán realizarse mediante:

* migraciones;
* seeds versionados;
* panel interno futuro;
* procesos controlados.

---

# Deportes personalizados

Los clubes no podrán crear deportes completamente libres en el MVP.

Esto evita:

* duplicados;
* errores ortográficos;
* reglas inconsistentes;
* dificultad en búsquedas.

En el futuro podrá existir una solicitud de nuevo deporte.

---

# Nombres personalizados

Un club podrá mostrar un nombre comercial o alias.

Ejemplo:

```text
Fútbol reducido
```

internamente asociado a:

```text
FOOTBALL_5
```

El código oficial no cambia.

---

# Localización

Los nombres visibles deberán soportar traducción.

Ejemplo conceptual:

```ts
interface SportTranslation {
  sportId: SportId;
  locale: string;
  name: string;
  description?: string;
}
```

Para el MVP podrá utilizarse español como idioma principal.

---

# Iconos

Cada deporte podrá tener:

* icono;
* emoji;
* ilustración;
* color identificador.

Los iconos deberán respetar `DESIGN_SYSTEM.md`.

Ejemplos:

```text
⚽ Fútbol
🎾 Tenis
🏀 Básquet
🏐 Vóley
```

No se deberá depender únicamente del color para distinguirlos.

---

# Casos de uso

El dominio deberá contemplar:

```text
ListActiveSports
GetSport
ListSportModalities
GetSportModality
ListSportPositions
ListSportLevels
ListSurfaceTypes
ValidateSportConfiguration
ActivateSport
DeactivateSport
CreateSport
UpdateSport
```

Los últimos casos de uso podrán reservarse para administración interna.

---

# ListActiveSports

Devuelve deportes disponibles.

Puede incluir:

* nombre;
* icono;
* modalidades;
* estado;
* capacidades principales.

No deberá cargar todas las reglas avanzadas si no son necesarias.

---

# GetSport

Devuelve la configuración completa de un deporte.

Puede utilizarse en:

* formulario de perfil;
* creación de partido;
* configuración de cancha;
* filtros de búsqueda.

---

# ListSportModalities

Devuelve las modalidades activas de un deporte.

Ejemplo:

```http
GET /api/v1/sports/:sportId/modalities
```

---

# ListSportPositions

Devuelve posiciones activas.

Solo aplica cuando:

```text
supportsPositions = true
```

---

# Validación de configuración

Antes de crear un partido o cancha deberá validarse:

* deporte activo;
* modalidad activa;
* modalidad perteneciente al deporte;
* posición válida;
* capacidad compatible;
* duración permitida;
* superficie válida.

---

# Eventos de dominio

Eventos sugeridos:

```text
SportCreated
SportUpdated
SportActivated
SportDeactivated
SportModalityCreated
SportModalityUpdated
SportPositionCreated
SportPositionUpdated
```

El uso de estos eventos será principalmente administrativo.

---

# Endpoints iniciales

```http
GET /api/v1/sports
GET /api/v1/sports/:sportId
GET /api/v1/sports/:sportId/modalities
GET /api/v1/sports/:sportId/positions
GET /api/v1/sports/:sportId/levels
GET /api/v1/sports/:sportId/surfaces
```

Los endpoints administrativos podrán agregarse después.

---

# Respuesta de deporte

Ejemplo conceptual:

```json
{
  "id": "sport_uuid",
  "code": "FOOTBALL",
  "name": "Fútbol",
  "icon": "football",
  "supportsPositions": true,
  "supportsTeams": true,
  "modalities": [
    {
      "id": "modality_uuid",
      "code": "FOOTBALL_5",
      "name": "Fútbol 5",
      "teamSize": 5,
      "totalParticipants": 10,
      "minimumParticipants": 2,
      "maximumParticipants": 14,
      "defaultDurationMinutes": 60
    }
  ]
}
```

---

# Persistencia conceptual

Tabla:

```text
sports
```

Campos:

```text
id
code
name
description
icon
status
supports_positions
supports_teams
supports_singles
supports_doubles
created_at
updated_at
```

---

# Tabla de modalidades

```text
sport_modalities
```

Campos:

```text
id
sport_id
code
name
team_size
total_participants
min_participants
max_participants
default_duration_minutes
status
created_at
updated_at
```

Restricción única:

```text
sport_id + code
```

---

# Tabla de posiciones

```text
sport_positions
```

Campos:

```text
id
sport_id
code
name
description
display_order
status
created_at
updated_at
```

Restricción única:

```text
sport_id + code
```

---

# Tabla de superficies

```text
surface_types
```

Campos:

```text
id
sport_id
code
name
status
created_at
updated_at
```

---

# Tabla de niveles

```text
sport_level_definitions
```

Campos:

```text
id
sport_id
code
name
numeric_value
display_order
is_default
status
created_at
updated_at
```

---

# Índices sugeridos

```text
sports.code
sports.status
sport_modalities.sport_id
sport_modalities.status
sport_positions.sport_id
surface_types.sport_id
sport_level_definitions.sport_id
```

---

# Integración con USERS

USERS utiliza SPORTS para validar:

* deportes elegidos;
* niveles;
* posiciones;
* deporte favorito.

Un usuario no podrá asociarse a un deporte inactivo.

Las relaciones históricas podrán conservarse.

---

# Integración con CLUBS

CLUBS utiliza SPORTS para definir:

* deportes ofrecidos;
* modalidades disponibles;
* configuración;
* reglas específicas.

Un club podrá ofrecer solo un subconjunto del catálogo.

---

# Integración con COURTS

COURTS utiliza SPORTS para definir:

* deporte;
* modalidad;
* superficie;
* capacidad;
* compatibilidad.

---

# Integración con BOOKINGS

BOOKINGS utiliza SPORTS para validar:

* duración;
* modalidad;
* cancha compatible;
* cantidad de participantes.

---

# Integración con MATCHES

MATCHES utiliza SPORTS para definir:

* modalidad;
* participantes;
* equipos;
* categoría;
* posiciones;
* nivel;
* estilo;
* duración;
* resultado futuro.

---

# Integración con SEARCH

SEARCH podrá filtrar por:

* deporte;
* modalidad;
* nivel;
* posición;
* categoría;
* superficie;
* estilo.

Los códigos del catálogo deberán ser estables e indexables.

---

# Seguridad

La consulta del catálogo será pública para usuarios autenticados.

La modificación estará restringida a:

* administradores globales;
* procesos internos;
* migraciones;
* seeds autorizados.

Un administrador de club no podrá modificar el catálogo global.

---

# Auditoría

Registrar:

* creación;
* modificación;
* activación;
* desactivación;
* cambios de reglas;
* cambios de modalidades;
* cambios de niveles.

---

# Reglas principales

1. El deporte es un catálogo maestro.
2. Cada deporte puede tener múltiples modalidades.
3. El nivel pertenece a la relación usuario-deporte.
4. Las posiciones pertenecen a un deporte.
5. Los clubes no crean deportes libres en el MVP.
6. Los códigos son estables y únicos.
7. Los nombres visibles pueden traducirse.
8. Un deporte inactivo conserva historial.
9. MATCHES y COURTS deben validar contra este catálogo.
10. La categoría del partido es independiente del sexo del usuario.
11. Las reglas específicas deben poder evolucionar sin romper el modelo.
12. La configuración más específica puede sobrescribir valores generales cuando esté permitido.

---

# Principio final

SPORTS debe centralizar la definición deportiva sin convertirse en un motor rígido.

El catálogo debe ser suficientemente estructurado para garantizar consistencia y suficientemente flexible para incorporar nuevas disciplinas, modalidades y reglas sin rediseñar toda la plataforma.
