# CHAT

# Objetivo

Este documento define el chat del MVP de Rondo.

El chat permite que los participantes de un partido se comuniquen para coordinar aspectos básicos de la actividad.

Ejemplos:

* confirmar asistencia;
* avisar una demora;
* coordinar camisetas;
* informar un cambio;
* compartir indicaciones del lugar.

En el MVP existirá únicamente un chat grupal asociado a cada partido.

---

# Alcance del MVP

El chat permitirá:

* enviar mensajes de texto;
* consultar el historial;
* mostrar mensajes en orden cronológico;
* identificar al autor;
* recibir nuevos mensajes;
* notificar a los participantes;
* restringir el acceso a participantes autorizados.

No incluirá:

* mensajes privados;
* imágenes;
* videos;
* audios;
* archivos;
* reacciones;
* respuestas a mensajes;
* edición;
* eliminación por el usuario;
* indicador de escritura;
* confirmación de lectura individual;
* llamadas;
* mensajes temporales.

---

# Responsabilidades

El dominio `CHAT` administra:

* conversación asociada a un partido;
* participantes autorizados;
* mensajes;
* historial;
* control de acceso;
* publicación de eventos de nuevos mensajes.

No administra:

* participantes del partido;
* invitaciones;
* notificaciones;
* moderación avanzada;
* archivos multimedia.

La lista de participantes sigue perteneciendo a `MATCHES`.

---

# Relación con partidos

Cada partido tendrá como máximo una conversación.

```text
Match
  └── Conversation
```

La conversación puede crearse:

* al publicar el partido;
* al confirmar el primer participante;
* de forma diferida al enviar el primer mensaje.

Para el MVP se recomienda crearla automáticamente al publicar el partido.

---

# Entidad Conversation

```ts
interface Conversation {
  id: ConversationId;
  matchId: MatchId;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

---

# Identificador

```ts
type ConversationId = string;
```

Reglas:

* UUID;
* único;
* generado por Rondo;
* inmutable.

---

# Estado de la conversación

```ts
enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}
```

## ACTIVE

Permite leer y enviar mensajes.

## CLOSED

Permite consultar el historial, pero no enviar mensajes.

---

# Cierre del chat

La conversación podrá cerrarse cuando:

* el partido sea cancelado;
* haya transcurrido un plazo después de completarse;
* un administrador la cierre por seguridad.

Para simplificar el MVP:

* un partido `OPEN`, `FULL` o `CONFIRMED` mantiene el chat activo;
* un partido `CANCELLED` cierra el chat;
* un partido `COMPLETED` puede mantenerlo activo durante 24 horas;
* después pasa a `CLOSED`.

El plazo debe ser configurable.

---

# Participantes autorizados

Pueden acceder al chat:

* el organizador;
* los participantes con estado `CONFIRMED`;
* un administrador autorizado del club;
* un `SUPER_ADMIN` por soporte o moderación.

No pueden acceder:

* usuarios invitados que todavía no aceptaron;
* solicitudes pendientes;
* participantes rechazados;
* participantes removidos;
* usuarios que abandonaron;
* usuarios externos al partido.

---

# Usuario que abandona el partido

Cuando un usuario abandona o es removido:

* deja de poder enviar mensajes;
* deja de recibir nuevos mensajes;
* se recomienda que deje de acceder al historial.

Para el MVP, la regla más segura es revocar todo acceso al chat.

---

# Entidad Message

```ts
interface Message {
  id: MessageId;
  conversationId: ConversationId;
  authorUserId: UserId;
  content: string;
  createdAt: Date;
}
```

---

# Identificador del mensaje

```ts
type MessageId = string;
```

Reglas:

* UUID;
* único;
* inmutable.

---

# Contenido

Campo:

```ts
content: string;
```

Reglas:

* obligatorio;
* no puede estar vacío;
* debe eliminar espacios al inicio y final;
* debe tener longitud máxima;
* debe almacenarse como texto plano;
* no debe interpretarse como HTML.

Longitud sugerida para el MVP:

```text
1 a 1000 caracteres
```

---

# Seguridad del contenido

El backend deberá:

* validar longitud;
* sanitizar entradas;
* evitar HTML ejecutable;
* evitar scripts;
* limitar frecuencia de mensajes;
* rechazar contenido vacío.

El frontend debe mostrar el contenido como texto, no como HTML.

---

# Orden de mensajes

Los mensajes se ordenan por:

```text
createdAt ASC
```

Cuando existan mensajes con el mismo timestamp, se utiliza:

```text
id ASC
```

como criterio secundario.

---

# Envío de mensaje

Flujo:

```text
Usuario escribe
    ↓
Frontend envía mensaje
    ↓
Backend autentica
    ↓
Valida participación
    ↓
Valida conversación activa
    ↓
Guarda mensaje
    ↓
Publica evento
    ↓
Actualiza chat
```

---

# Caso de uso SendMessage

Debe validar:

* usuario autenticado;
* usuario activo;
* conversación existente;
* partido existente;
* participante autorizado;
* conversación activa;
* contenido válido;
* límite de frecuencia.

Después debe:

* crear el mensaje;
* persistirlo;
* emitir evento;
* devolver el mensaje creado.

---

# Idempotencia

El frontend deberá enviar un identificador temporal:

```ts
clientMessageId: string;
```

Ejemplo:

```ts
interface SendMessageInput {
  conversationId: ConversationId;
  clientMessageId: string;
  content: string;
}
```

Esto evita duplicar mensajes cuando:

* se reintenta una solicitud;
* hay mala conexión;
* el usuario toca dos veces;
* la respuesta tarda.

La combinación deberá ser única:

```text
author_user_id + client_message_id
```

---

# Tiempo real

Para el MVP se recomienda usar WebSocket o Socket.IO.

Flujo:

```text
Mensaje persistido
    ↓
MessageSent
    ↓
Servidor publica en el canal del partido
    ↓
Clientes conectados reciben el mensaje
```

La persistencia debe ocurrir antes de publicar el mensaje.

---

# Canal de tiempo real

Ejemplo conceptual:

```text
match:{matchId}:chat
```

Solo los usuarios autorizados pueden suscribirse.

El servidor debe validar la autorización al conectar y al unirse al canal.

No debe confiar en el `matchId` enviado por el cliente.

---

# Alternativa inicial

Si se desea reducir infraestructura en la primera entrega, puede utilizarse polling.

Ejemplo:

```text
GET mensajes cada 5 segundos
```

Sin embargo, dado que el chat es parte explícita del MVP, se recomienda WebSocket desde el inicio.

---

# Historial

Endpoint:

```http
GET /api/v1/matches/:matchId/chat/messages
```

Debe devolver mensajes paginados.

Para chats se recomienda paginación por cursor.

Ejemplo:

```http
GET /api/v1/matches/:matchId/chat/messages?before=messageId&limit=30
```

---

# Respuesta de historial

```json
{
  "data": [
    {
      "id": "message_uuid",
      "content": "Lleven una camiseta clara y otra oscura.",
      "author": {
        "id": "user_uuid",
        "displayName": "Federico",
        "photoUrl": "https://..."
      },
      "createdAt": "2026-07-28T14:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "previous_message_uuid",
    "hasMore": true
  }
}
```

---

# Cantidad de mensajes

Valor recomendado:

```text
30 mensajes por consulta
```

Máximo sugerido:

```text
100 mensajes
```

---

# Información del autor

La respuesta puede incluir un snapshot mínimo:

```ts
interface MessageAuthorSummary {
  id: UserId;
  displayName: string;
  photoUrl?: string;
}
```

La fuente de verdad sigue perteneciendo a `USERS`.

---

# Mensajes del sistema

Para el MVP se pueden incorporar mensajes automáticos simples.

Ejemplos:

```text
Federico se unió al partido.
El horario del partido cambió.
El partido fue confirmado.
```

Modelo:

```ts
enum MessageType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}
```

Entidad ajustada:

```ts
interface Message {
  id: MessageId;
  conversationId: ConversationId;
  authorUserId?: UserId;
  type: MessageType;
  content: string;
  createdAt: Date;
}
```

Los mensajes de sistema no tienen autor humano.

---

# Eventos que pueden crear mensajes del sistema

* participante confirmado;
* participante abandonó;
* participante removido;
* cambio de horario;
* cambio de ubicación;
* partido confirmado;
* partido cancelado.

Para evitar duplicar lógica, `CHAT` escucha eventos de `MATCHES`.

---

# Notificaciones

Cuando se envía un mensaje:

* se genera el evento `ChatMessageSent`;
* `NOTIFICATIONS` decide a quién notificar;
* no se notifica al autor;
* no se notifica a usuarios sin acceso;
* puede omitirse la notificación si el usuario está viendo el chat.

En el MVP se puede crear una notificación agrupada:

```text
Nuevo mensaje en Partido de fútbol 5
```

No es necesario crear una notificación por cada mensaje si hay muchos seguidos.

---

# Mensajes no leídos

Para el MVP se recomienda almacenar el último momento en que cada participante abrió el chat.

Modelo:

```ts
interface ConversationReadState {
  conversationId: ConversationId;
  userId: UserId;
  lastReadAt: Date;
}
```

El conteo de no leídos puede calcularse con:

```text
mensajes creados después de lastReadAt
```

No se necesita confirmación de lectura por mensaje.

---

# Marcar chat como leído

Endpoint:

```http
POST /api/v1/matches/:matchId/chat/read
```

Actualiza:

```ts
lastReadAt: Date;
```

Debe validar que el usuario tenga acceso al chat.

---

# Casos de uso del MVP

```text
CreateMatchConversation
GetMatchConversation
ListConversationMessages
SendMessage
MarkConversationAsRead
CloseConversation
```

---

# CreateMatchConversation

Debe:

* validar que el partido exista;
* validar que no exista otra conversación;
* crearla como `ACTIVE`;
* ser idempotente.

---

# GetMatchConversation

Debe:

* autenticar;
* validar acceso;
* devolver información básica;
* incluir cantidad de mensajes no leídos.

---

# ListConversationMessages

Debe:

* autenticar;
* validar participación;
* aplicar cursor;
* ordenar correctamente;
* limitar cantidad de mensajes.

---

# SendMessage

Debe ejecutar las validaciones definidas anteriormente.

---

# MarkConversationAsRead

Debe actualizar el estado de lectura del usuario.

---

# CloseConversation

Solo puede ejecutarse por:

* proceso del sistema;
* administrador autorizado;
* evento de cancelación del partido.

---

# Endpoints REST

```http
GET /api/v1/matches/:matchId/chat

GET /api/v1/matches/:matchId/chat/messages

POST /api/v1/matches/:matchId/chat/messages

POST /api/v1/matches/:matchId/chat/read
```

No es necesario exponer un endpoint para crear el chat manualmente.

La conversación se crea desde el flujo de MATCHES.

---

# Eventos de dominio

```text
MatchConversationCreated
ChatMessageSent
ChatReadStateUpdated
MatchConversationClosed
```

---

# Evento ChatMessageSent

Ejemplo conceptual:

```ts
interface ChatMessageSentEvent {
  messageId: MessageId;
  conversationId: ConversationId;
  matchId: MatchId;
  authorUserId: UserId;
  createdAt: Date;
}
```

No es necesario incluir todo el contenido del mensaje en eventos externos.

---

# Persistencia

## Tabla conversations

```text
conversations
```

Campos:

```text
id
match_id
status
created_at
updated_at
closed_at
```

Restricción:

```text
match_id UNIQUE
```

---

## Tabla messages

```text
messages
```

Campos:

```text
id
conversation_id
author_user_id
client_message_id
type
content
created_at
```

Restricciones:

```text
conversation_id obligatorio
content obligatorio
author_user_id obligatorio para USER
author_user_id nulo para SYSTEM
```

Índice único:

```text
author_user_id + client_message_id
```

---

## Tabla conversation_read_states

```text
conversation_read_states
```

Campos:

```text
conversation_id
user_id
last_read_at
created_at
updated_at
```

Clave única:

```text
conversation_id + user_id
```

---

# Índices sugeridos

```text
conversations.match_id
conversations.status

messages.conversation_id
messages.created_at
messages.author_user_id

conversation_read_states.user_id
```

Índice principal del historial:

```text
conversation_id + created_at + id
```

---

# Arquitectura hexagonal

Estructura sugerida:

```text
chat/
  domain/
    entities/
      conversation.ts
      message.ts

    value-objects/
      message-content.ts

    repositories/
      conversation-repository.ts
      message-repository.ts

    events/
      chat-message-sent.ts

  application/
    use-cases/
      get-match-conversation.ts
      list-conversation-messages.ts
      send-message.ts
      mark-conversation-as-read.ts

    ports/
      chat-realtime-publisher.ts
      match-access-checker.ts

  infrastructure/
    persistence/
    realtime/

  presentation/
    http/
    websocket/
```

---

# Puertos principales

```ts
interface ConversationRepository {
  findByMatchId(matchId: MatchId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
```

```ts
interface MessageRepository {
  save(message: Message): Promise<void>;

  findByConversation(
    conversationId: ConversationId,
    cursor?: string,
    limit?: number,
  ): Promise<Message[]>;
}
```

```ts
interface ChatRealtimePublisher {
  publishMessage(
    conversationId: ConversationId,
    message: Message,
  ): Promise<void>;
}
```

```ts
interface MatchAccessChecker {
  canAccessChat(matchId: MatchId, userId: UserId): Promise<boolean>;
}
```

---

# Dependencias

CHAT depende de contratos públicos de:

```text
USERS
MATCHES
NOTIFICATIONS
```

No debe acceder directamente a tablas internas de MATCHES.

Debe utilizar:

* casos de uso;
* puertos;
* eventos;
* contratos públicos.

---

# Seguridad

Toda lectura y escritura debe validar acceso.

No debe ser posible:

* adivinar un `matchId` y leer mensajes;
* conectarse a un canal sin autorización;
* enviar mensajes en nombre de otro usuario;
* escribir en un partido cancelado;
* enviar HTML ejecutable;
* duplicar mensajes por reintentos.

---

# Rate limiting

Se recomienda un límite simple.

Ejemplo:

```text
10 mensajes cada 10 segundos por usuario
```

El objetivo es evitar:

* spam;
* abuso;
* errores de interfaz;
* automatizaciones maliciosas.

El valor deberá ser configurable.

---

# Moderación mínima

En el MVP no habrá moderación avanzada.

Sí debe existir:

* límite de longitud;
* sanitización;
* rate limiting;
* posibilidad administrativa de cerrar el chat;
* auditoría de mensajes reportados en una etapa posterior.

Los mensajes no se eliminarán físicamente desde la interfaz.

---

# Auditoría

Debe registrarse:

* cierre administrativo;
* intentos de acceso prohibido;
* rate limits excedidos;
* errores relevantes de publicación.

No es necesario registrar una auditoría adicional por cada mensaje porque ya queda persistido.

---

# Experiencia frontend

La pantalla debe mostrar:

* encabezado del partido;
* lista de mensajes;
* autor;
* fotografía;
* horario;
* campo de texto;
* botón de enviar;
* estado de conexión;
* carga de mensajes anteriores.

Comportamientos:

* mantener scroll al recibir mensajes;
* bajar automáticamente si el usuario está al final;
* no forzar scroll si está leyendo mensajes anteriores;
* deshabilitar envío mientras se procesa;
* mostrar estado temporal del mensaje;
* reintentar ante errores controlados.

---

# Mensaje optimista

El frontend puede mostrar el mensaje antes de recibir la respuesta definitiva.

Estado local:

```ts
enum ClientMessageStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}
```

Estos estados pertenecen al frontend y no necesitan persistirse.

---

# Pruebas mínimas

Deben probarse:

* creación automática de conversación;
* una conversación por partido;
* envío válido;
* contenido vacío;
* contenido demasiado largo;
* acceso de participante confirmado;
* rechazo de usuario externo;
* rechazo de participante removido;
* conversación cerrada;
* partido cancelado;
* idempotencia;
* orden de mensajes;
* paginación por cursor;
* marcado como leído;
* conteo de no leídos;
* publicación por WebSocket;
* reconexión;
* rate limiting;
* sanitización.

---

# Reglas principales

1. Existe como máximo un chat por partido.
2. El chat es grupal.
3. Solo el organizador y participantes confirmados pueden acceder.
4. Los usuarios removidos o retirados pierden acceso.
5. El MVP solo admite mensajes de texto.
6. Los mensajes son inmutables.
7. El contenido se almacena como texto plano.
8. El backend valida todas las autorizaciones.
9. El mensaje debe persistirse antes de publicarse en tiempo real.
10. El envío debe ser idempotente.
11. Los mensajes se ordenan por fecha e identificador.
12. Los chats cancelados o cerrados no aceptan mensajes.
13. El estado de lectura se guarda por conversación y usuario.
14. CHAT no administra participantes del partido.
15. NOTIFICATIONS consume eventos de CHAT.
16. El acceso por WebSocket debe autorizarse.
17. Los mensajes no se eliminan físicamente desde la interfaz.
18. Debe existir rate limiting.
19. Un mensaje de sistema no tiene autor humano.
20. El chat no reemplaza al dominio MATCHES.

---

# Principio final

CHAT debe resolver únicamente la coordinación entre participantes de un partido.

El MVP necesita una conversación grupal segura, persistente y en tiempo real, sin incorporar funciones propias de una plataforma de mensajería completa.
