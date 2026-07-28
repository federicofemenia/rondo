# REVIEWS

# Objetivo

Este documento define el sistema de valoraciones posteriores a un partido en Rondo.

Las valoraciones permiten construir confianza entre jugadores y organizadores.

En el MVP, los usuarios podrán valorar a otros participantes únicamente después de que el partido haya finalizado.

---

# Alcance del MVP

El sistema permitirá:

* valorar a otros participantes;
* usar una puntuación de 1 a 5 estrellas;
* agregar un comentario opcional;
* consultar el promedio de valoraciones;
* consultar la cantidad de valoraciones recibidas;
* impedir valoraciones duplicadas;
* restringir valoraciones a participantes reales del partido.

No incluirá:

* valoración de clubes;
* valoración de canchas;
* valoración de árbitros;
* múltiples categorías;
* reputación automática;
* rankings complejos;
* denuncias;
* respuestas a valoraciones;
* edición posterior;
* eliminación por parte del usuario;
* anonimato.

---

# Responsabilidades

El dominio `REVIEWS` administra:

* creación de valoraciones;
* validación de elegibilidad;
* puntuación;
* comentarios;
* historial de valoraciones;
* cálculo de resumen de reputación.

No administra:

* participantes del partido;
* finalización del partido;
* perfiles de usuario;
* notificaciones;
* moderación avanzada.

La fuente de verdad sobre quién participó pertenece a `MATCHES`.

---

# Entidad Review

```ts
interface Review {
  id: ReviewId;
  matchId: MatchId;
  reviewerUserId: UserId;
  reviewedUserId: UserId;
  rating: number;
  comment?: string;
  createdAt: Date;
}
```

---

# Identificador

```ts
type ReviewId = string;
```

Reglas:

* UUID;
* único;
* generado por Rondo;
* inmutable.

---

# Puntuación

Campo:

```ts
rating: number;
```

Valores válidos:

```text
1, 2, 3, 4 o 5
```

Significado sugerido:

* 1: experiencia muy mala;
* 2: experiencia mala;
* 3: experiencia aceptable;
* 4: buena experiencia;
* 5: excelente experiencia.

El backend debe rechazar cualquier valor fuera de ese rango.

---

# Comentario

Campo:

```ts
comment?: string;
```

Reglas:

* opcional;
* texto plano;
* sin HTML;
* se eliminan espacios al inicio y al final;
* longitud máxima sugerida: 500 caracteres;
* no puede quedar vacío después de normalizarse.

Si el usuario no agrega comentario, se guarda como `null`.

---

# Quién puede valorar

Un usuario puede valorar únicamente si:

* está autenticado;
* su cuenta está activa;
* participó del partido;
* el partido está `COMPLETED`;
* el usuario valorado también participó;
* no intenta valorarse a sí mismo;
* todavía no realizó esa valoración.

---

# Participación válida

Para el MVP, se considera participante válido a quien tuvo estado confirmado al finalizar el partido.

Ejemplo:

```text
participant.status = CONFIRMED
```

Un usuario que:

* fue rechazado;
* abandonó antes del partido;
* fue removido;
* nunca confirmó;

no puede valorar ni ser valorado en ese partido.

---

# Organizador

El organizador también puede:

* valorar participantes;
* recibir valoraciones.

Si además figura como participante, no debe duplicarse.

---

# Momento de habilitación

Las valoraciones se habilitan cuando:

```text
match.status = COMPLETED
```

No se habilitan cuando el partido está:

* DRAFT;
* OPEN;
* FULL;
* CONFIRMED;
* CANCELLED.

---

# Ventana de valoración

Para el MVP se recomienda permitir valoraciones durante:

```text
7 días desde la finalización del partido
```

Después de ese plazo:

* las valoraciones existentes siguen visibles;
* no pueden crearse nuevas.

El valor debe ser configurable.

---

# Unicidad

Cada usuario puede valorar una sola vez a otro usuario por partido.

Restricción:

```text
match_id + reviewer_user_id + reviewed_user_id UNIQUE
```

Esto evita:

* valoraciones duplicadas;
* reintentos duplicados;
* múltiples puntuaciones sobre la misma persona.

---

# Inmutabilidad

En el MVP, una valoración no puede editarse.

Tampoco puede eliminarse desde la interfaz.

Esto simplifica:

* auditoría;
* consistencia del promedio;
* moderación futura.

Un `SUPER_ADMIN` podrá ocultarla administrativamente en una versión posterior.

---

# Flujo de valoración

```text
Partido finaliza
    ↓
MATCHES publica MatchCompleted
    ↓
REVIEWS habilita valoraciones
    ↓
Participante consulta usuarios valorables
    ↓
Envía puntuación y comentario
    ↓
Backend valida elegibilidad
    ↓
Guarda Review
    ↓
Actualiza resumen
    ↓
Publica ReviewCreated
```

---

# Usuarios pendientes de valorar

La interfaz puede consultar a quién todavía puede valorar el usuario.

Ejemplo:

```http
GET /api/v1/matches/:matchId/reviewable-users
```

Respuesta:

```json
{
  "data": [
    {
      "userId": "user_uuid",
      "displayName": "Martín",
      "photoUrl": "https://...",
      "alreadyReviewed": false
    }
  ]
}
```

No debe incluir al usuario autenticado.

---

# Crear valoración

Endpoint:

```http
POST /api/v1/matches/:matchId/reviews
```

Body:

```json
{
  "reviewedUserId": "user_uuid",
  "rating": 5,
  "comment": "Llegó puntual y tuvo muy buena actitud."
}
```

---

# Respuesta

```json
{
  "data": {
    "id": "review_uuid",
    "matchId": "match_uuid",
    "reviewerUserId": "reviewer_uuid",
    "reviewedUserId": "reviewed_uuid",
    "rating": 5,
    "comment": "Llegó puntual y tuvo muy buena actitud.",
    "createdAt": "2026-07-28T15:00:00Z"
  }
}
```

---

# Caso de uso CreateReview

Debe validar:

* autenticación;
* usuario activo;
* partido existente;
* partido completado;
* ventana de valoración vigente;
* participación del autor;
* participación del usuario valorado;
* autor y destinatario diferentes;
* rating válido;
* comentario válido;
* inexistencia de valoración previa.

Después debe:

* crear la valoración;
* persistirla;
* actualizar el resumen;
* emitir evento;
* devolver la valoración creada.

---

# Consultar valoraciones recibidas

Endpoint:

```http
GET /api/v1/users/:userId/reviews
```

Debe devolver valoraciones paginadas.

Parámetros sugeridos:

```text
cursor
limit
```

Respuesta:

```json
{
  "data": [
    {
      "id": "review_uuid",
      "rating": 5,
      "comment": "Muy buen compañero.",
      "reviewer": {
        "id": "user_uuid",
        "displayName": "Federico",
        "photoUrl": "https://..."
      },
      "match": {
        "id": "match_uuid",
        "title": "Fútbol 5 en Palermo"
      },
      "createdAt": "2026-07-28T15:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

# Resumen de reputación

Cada usuario tendrá un resumen:

```ts
interface UserRatingSummary {
  userId: UserId;
  averageRating: number;
  reviewsCount: number;
}
```

Ejemplo:

```json
{
  "averageRating": 4.7,
  "reviewsCount": 18
}
```

---

# Cálculo del promedio

El promedio se calcula con todas las valoraciones activas recibidas.

```text
sum(rating) / reviews_count
```

Se recomienda redondear a un decimal para mostrarlo.

Ejemplo:

```text
4.6666 → 4.7
```

El valor exacto puede mantenerse en base de datos.

---

# Estrategia de persistencia del resumen

Para el MVP existen dos opciones.

## Opción recomendada

Guardar en `users` o en una tabla de resumen:

```text
average_rating
reviews_count
```

Cada nueva valoración actualiza ambos valores dentro de una transacción.

Ventaja:

* lectura rápida del perfil.

## Alternativa

Calcular el promedio en cada consulta.

Es más simple, pero menos eficiente a medida que crece el volumen.

Para el MVP, ambas son válidas. Se recomienda el resumen persistido.

---

# Tabla reviews

```text
reviews
```

Campos:

```text
id
match_id
reviewer_user_id
reviewed_user_id
rating
comment
created_at
```

Restricciones:

```text
rating BETWEEN 1 AND 5
reviewer_user_id <> reviewed_user_id
```

Índice único:

```text
match_id + reviewer_user_id + reviewed_user_id
```

---

# Tabla user_rating_summaries

```text
user_rating_summaries
```

Campos:

```text
user_id
average_rating
reviews_count
updated_at
```

Clave primaria:

```text
user_id
```

Esta tabla es opcional, pero recomendada.

---

# Índices sugeridos

```text
reviews.reviewed_user_id
reviews.reviewer_user_id
reviews.match_id
reviews.created_at
```

Índice para perfil:

```text
reviewed_user_id + created_at
```

---

# Endpoints REST

```http
GET /api/v1/matches/:matchId/reviewable-users

POST /api/v1/matches/:matchId/reviews

GET /api/v1/users/:userId/reviews

GET /api/v1/users/:userId/rating-summary
```

---

# Eventos de dominio

```text
ReviewCreated
UserRatingSummaryUpdated
```

---

# Evento ReviewCreated

```ts
interface ReviewCreatedEvent {
  reviewId: ReviewId;
  matchId: MatchId;
  reviewerUserId: UserId;
  reviewedUserId: UserId;
  rating: number;
  createdAt: Date;
}
```

---

# Notificaciones

Cuando un usuario recibe una valoración:

* `REVIEWS` publica `ReviewCreated`;
* `NOTIFICATIONS` crea una notificación;
* el autor no recibe notificación;
* el destinatario sí.

Ejemplo:

```text
Recibiste una nueva valoración.
```

Para evitar conflictos, la notificación puede no mostrar el comentario completo.

---

# Arquitectura hexagonal

Estructura sugerida:

```text
reviews/
  domain/
    entities/
      review.ts

    value-objects/
      rating.ts
      review-comment.ts

    repositories/
      review-repository.ts
      rating-summary-repository.ts

    events/
      review-created.ts

  application/
    use-cases/
      create-review.ts
      list-user-reviews.ts
      get-rating-summary.ts
      list-reviewable-users.ts

    ports/
      match-review-eligibility.ts
      user-reader.ts

  infrastructure/
    persistence/

  presentation/
    http/
```

---

# Puertos principales

```ts
interface ReviewRepository {
  save(review: Review): Promise<void>;

  exists(params: {
    matchId: MatchId;
    reviewerUserId: UserId;
    reviewedUserId: UserId;
  }): Promise<boolean>;

  findByReviewedUser(
    userId: UserId,
    cursor?: string,
    limit?: number,
  ): Promise<Review[]>;
}
```

```ts
interface MatchReviewEligibility {
  canReview(params: {
    matchId: MatchId;
    reviewerUserId: UserId;
    reviewedUserId: UserId;
  }): Promise<boolean>;
}
```

```ts
interface RatingSummaryRepository {
  getByUserId(userId: UserId): Promise<UserRatingSummary | null>;
  updateAfterReview(userId: UserId, rating: number): Promise<void>;
}
```

---

# Dependencias

`REVIEWS` depende de contratos públicos de:

```text
MATCHES
USERS
NOTIFICATIONS
```

No debe acceder directamente a tablas internas de otros módulos.

`MATCHES` determina:

* estado del partido;
* participantes válidos;
* fecha de finalización.

`USERS` aporta:

* información pública del perfil;
* estado del usuario.

---

# Seguridad

Toda creación debe validarse en el backend.

No debe ser posible:

* valorar sin participar;
* valorar antes de finalizar;
* valorar un partido cancelado;
* valorarse a uno mismo;
* valorar dos veces;
* modificar el reviewer desde el cliente;
* enviar valores fuera del rango;
* insertar HTML ejecutable.

El `reviewerUserId` siempre se obtiene de la sesión autenticada.

---

# Moderación mínima

Para el MVP:

* comentarios en texto plano;
* límite de longitud;
* sanitización;
* sin edición;
* sin eliminación por usuarios;
* auditoría administrativa futura.

Se recomienda guardar el comentario original y no modificarlo silenciosamente.

---

# Privacidad

Las valoraciones serán visibles en el perfil público del usuario.

El MVP mostrará:

* puntuación;
* comentario;
* autor;
* fecha;
* partido asociado.

Si se desea reducir exposición, puede mostrarse únicamente el deporte y la fecha, sin ubicación exacta.

---

# Experiencia frontend

Después de completar un partido se muestra:

```text
¿Cómo fue jugar con los participantes?
```

Por cada participante:

* foto;
* nombre;
* selector de estrellas;
* comentario opcional;
* botón de enviar.

La interfaz debe mostrar:

* usuarios pendientes;
* usuarios ya valorados;
* fecha límite;
* confirmación de envío;
* error si la ventana expiró.

---

# Perfil de usuario

El perfil debe mostrar:

```text
⭐ 4.7
18 valoraciones
```

También puede mostrar las últimas valoraciones.

No debe mostrarse un promedio cuando no existen valoraciones.

En ese caso:

```text
Sin valoraciones todavía
```

---

# Pruebas mínimas

Deben probarse:

* valoración válida;
* rating menor a 1;
* rating mayor a 5;
* comentario demasiado largo;
* comentario con HTML;
* usuario no participante;
* destinatario no participante;
* autovaloración;
* partido no completado;
* partido cancelado;
* ventana vencida;
* valoración duplicada;
* actualización del promedio;
* actualización de cantidad;
* listado paginado;
* notificación al destinatario;
* concurrencia de dos valoraciones simultáneas.

---

# Reglas principales

1. Solo se puede valorar después de un partido completado.
2. Solo participantes válidos pueden valorar.
3. Solo se puede valorar a participantes válidos.
4. Un usuario no puede valorarse a sí mismo.
5. La puntuación debe estar entre 1 y 5.
6. El comentario es opcional.
7. Cada combinación de partido, autor y destinatario es única.
8. Las valoraciones son inmutables en el MVP.
9. Existe una ventana limitada para valorar.
10. El backend determina la identidad del autor.
11. REVIEWS no administra participantes.
12. MATCHES es la fuente de verdad de elegibilidad.
13. El promedio se calcula únicamente con valoraciones válidas.
14. El perfil muestra promedio y cantidad.
15. Una valoración genera una notificación.
16. Los comentarios se almacenan como texto plano.
17. Las valoraciones no son anónimas.
18. Un partido cancelado no permite valoraciones.
19. El resumen debe actualizarse de forma consistente.
20. La creación de la valoración y la actualización del promedio deben ser transaccionales.

---

# Principio final

REVIEWS debe generar confianza entre los usuarios sin convertirse todavía en un sistema complejo de reputación.

El MVP necesita valoraciones simples, verificables y vinculadas a partidos reales.
 