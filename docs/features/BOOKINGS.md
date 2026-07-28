# BOOKINGS

# Objetivo

Este documento define el dominio de reservas de Rondo.

Su propósito es establecer:

* qué representa una reserva;
* cómo se relaciona con clubes, sedes, canchas y usuarios;
* cómo se valida la disponibilidad;
* cómo se evita una doble reserva;
* qué estados puede atravesar;
* cómo se administran solicitudes, confirmaciones y retenciones;
* cómo se calculan precios;
* cómo se gestionan pagos futuros;
* cómo funcionan cancelaciones y reprogramaciones;
* cómo se resuelven conflictos operativos.

El dominio `BOOKINGS` es responsable de la ocupación reservada de una cancha durante un intervalo determinado.

---

# Definición

Una reserva representa el derecho confirmado o solicitado de utilizar una cancha durante un período específico.

Ejemplo:

```text
Club Señor Pato
Sede Principal
Cancha 1
28 de julio de 2026
18:00 a 19:00
```

Una reserva puede ser creada por:

* un usuario;
* un administrador;
* recepción;
* un organizador de partido;
* una integración futura;
* un proceso interno.

---

# Responsabilidades

El dominio `BOOKINGS` administra:

* creación de reservas;
* solicitudes de reserva;
* retenciones temporales;
* confirmación;
* ocupación de cancha;
* precio;
* moneda;
* descuentos;
* promociones aplicadas;
* cancelaciones;
* reprogramaciones;
* vencimientos;
* no presentación;
* check-in futuro;
* conflictos;
* idempotencia;
* concurrencia;
* historial de cambios.

No administra directamente:

* identidad del usuario;
* definición de canchas;
* catálogo deportivo;
* partidos;
* reputación;
* pagos externos;
* promociones globales;
* mensajes.

---

# Entidad Booking

Modelo conceptual:

```ts
interface Booking {
  id: BookingId;

  clubId: ClubId;
  venueId: ClubVenueId;
  courtId: CourtId;

  createdByUserId: UserId;
  customerUserId?: UserId;

  sportId: SportId;
  sportModalityId?: SportModalityId;

  startsAt: Date;
  endsAt: Date;
  timeZone: string;

  status: BookingStatus;
  source: BookingSource;
  approvalMode: BookingApprovalMode;

  participantCount?: number;
  notes?: string;

  currency: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;

  paymentStatus: BookingPaymentStatus;

  expiresAt?: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

---

# Identificador

```ts
type BookingId = string;
```

Reglas:

* UUID;
* único;
* inmutable;
* generado por Rondo;
* no reutilizable.

---

# Relaciones obligatorias

Toda reserva deberá asociarse a:

```ts
clubId: ClubId;
venueId: ClubVenueId;
courtId: CourtId;
```

Reglas:

* la sede debe pertenecer al club;
* la cancha debe pertenecer al club y la sede;
* toda consulta debe validar el contexto multi-club;
* el identificador de reserva no reemplaza autorización.

---

# Usuario creador

Campo:

```ts
createdByUserId: UserId;
```

Representa quién ejecutó la acción.

Puede ser:

* el cliente;
* un administrador;
* un recepcionista;
* un sistema interno.

Este campo es obligatorio para auditoría cuando la acción proviene de una persona.

---

# Usuario cliente

Campo:

```ts
customerUserId?: UserId;
```

Representa a la persona para la cual se crea la reserva.

Ejemplo:

Un recepcionista crea una reserva para otro usuario.

En ese caso:

```text
createdByUserId = recepcionista
customerUserId = cliente
```

---

# Reserva sin usuario registrado

En futuras versiones podrán existir reservas para clientes no registrados.

Modelo conceptual:

```ts
interface BookingGuest {
  bookingId: BookingId;
  fullName: string;
  email?: string;
  phone?: string;
}
```

Para el MVP se recomienda priorizar usuarios registrados, salvo que la operación del primer club requiera reservas desde recepción.

---

# Origen de la reserva

```ts
enum BookingSource {
  USER_APP = 'USER_APP',
  CLUB_ADMIN = 'CLUB_ADMIN',
  RECEPTION = 'RECEPTION',
  MATCH = 'MATCH',
  IMPORT = 'IMPORT',
  API = 'API',
  SYSTEM = 'SYSTEM',
}
```

---

# Aplicación de usuario

`USER_APP` representa una reserva creada por un usuario desde Rondo.

---

# Administración del club

`CLUB_ADMIN` representa una reserva creada desde el panel administrativo.

---

# Recepción

`RECEPTION` representa una reserva creada presencialmente o por atención telefónica.

---

# Partido

`MATCH` representa una reserva originada desde la organización de un partido.

La relación definitiva con partidos se documentará en `MATCHES.md`.

---

# Importación

`IMPORT` representa datos cargados desde otro sistema.

Toda importación deberá:

* conservar referencia externa;
* validar duplicados;
* registrar auditoría;
* respetar disponibilidad.

---

# API

`API` representa una integración externa autorizada.

---

# Sistema

`SYSTEM` representa una reserva o ajuste generado por un proceso interno controlado.

---

# Intervalo de reserva

Campos:

```ts
startsAt: Date;
endsAt: Date;
```

Reglas:

* `startsAt` debe ser anterior a `endsAt`;
* las fechas deben persistirse en UTC;
* la interpretación local usa la zona horaria de la sede;
* la duración debe cumplir reglas de la cancha;
* no debe existir superposición con otra ocupación válida.

---

# Zona horaria

Campo:

```ts
timeZone: string;
```

Se recomienda conservar la zona horaria aplicada al momento de la reserva.

Esto permite interpretar correctamente el horario histórico aunque la configuración de la sede cambie posteriormente.

---

# Duración

La duración se calcula:

```text
endsAt - startsAt
```

No debe almacenarse como fuente principal de verdad.

Podrá incluirse como valor derivado en DTOs:

```ts
durationMinutes: number;
```

---

# Deporte y modalidad

Campos:

```ts
sportId: SportId;
sportModalityId?: SportModalityId;
```

Deben ser compatibles con la cancha.

Se recomienda conservarlos en la reserva aunque puedan derivarse de la cancha.

Esto permite preservar contexto histórico si la configuración de la cancha cambia.

---

# Estado de la reserva

```ts
enum BookingStatus {
  DRAFT = 'DRAFT',
  HOLD = 'HOLD',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
  NO_SHOW = 'NO_SHOW',
}
```

---

# Borrador

`DRAFT` representa una reserva todavía no enviada.

Puede utilizarse en:

* formularios administrativos;
* flujos complejos;
* cargas parciales.

No ocupa la cancha.

Para reservas simples del MVP puede omitirse.

---

# Retención

`HOLD` representa una ocupación temporal.

Se utiliza durante:

* pago;
* confirmación;
* revisión;
* creación desde partido;
* flujo de checkout.

Una retención:

* bloquea temporalmente el horario;
* tiene vencimiento;
* no equivale a reserva confirmada;
* debe liberarse automáticamente.

---

# Pendiente de aprobación

`PENDING_APPROVAL` representa una solicitud que necesita revisión administrativa.

Puede o no bloquear temporalmente la cancha según política.

La estrategia debe estar definida por club o cancha.

---

# Pendiente de pago

`PENDING_PAYMENT` representa una reserva válida pendiente de completar pago.

Puede ocupar el horario durante un plazo limitado.

Debe incluir:

```ts
expiresAt: Date;
```

---

# Confirmada

`CONFIRMED` representa una reserva válida y vigente.

Ocupa la cancha.

Puede estar:

* pagada;
* parcialmente pagada;
* pendiente de pago presencial;
* bonificada.

---

# En curso

`IN_PROGRESS` representa una reserva cuyo horario ya comenzó.

Puede utilizarse para:

* check-in;
* control de acceso;
* operación de recepción;
* estado de partido.

---

# Completada

`COMPLETED` representa una reserva finalizada.

Se utiliza para:

* historial;
* reputación;
* estadísticas;
* conciliación;
* valoración futura.

---

# Cancelada

`CANCELLED` representa una reserva anulada.

Debe conservar:

* responsable;
* motivo;
* fecha;
* política aplicada;
* importe retenido;
* reembolso futuro.

No deberá eliminarse físicamente.

---

# Expirada

`EXPIRED` representa una reserva o retención que perdió vigencia.

Ejemplos:

* pago no completado;
* aprobación no resuelta;
* hold vencido;
* enlace de confirmación vencido.

---

# Rechazada

`REJECTED` representa una solicitud de reserva que el club decidió no aprobar.

Debe registrar:

* responsable;
* motivo;
* fecha;
* mensaje opcional al usuario.

---

# No presentado

`NO_SHOW` representa una reserva confirmada cuyo responsable no se presentó.

Puede afectar:

* reputación;
* penalizaciones;
* política del club;
* acceso a promociones.

La marcación deberá estar restringida a personal autorizado.

---

# Transiciones de estado

Flujo automático típico:

```text
HOLD
  ↓
PENDING_PAYMENT
  ↓
CONFIRMED
  ↓
IN_PROGRESS
  ↓
COMPLETED
```

Flujo con aprobación:

```text
PENDING_APPROVAL
  ↓
APPROVED
  ↓
PENDING_PAYMENT
  ↓
CONFIRMED
```

`APPROVED` puede ser un evento y no necesariamente un estado persistido.

---

# Transiciones terminales

Estados terminales:

```text
COMPLETED
CANCELLED
EXPIRED
REJECTED
NO_SHOW
```

Una reserva terminal no debe volver a `CONFIRMED` directamente.

Una reactivación deberá modelarse como una nueva operación o reprogramación controlada.

---

# Máquina de estados

Las transiciones deberán centralizarse.

Ejemplo conceptual:

```ts
const bookingTransitions = {
  HOLD: [
    'PENDING_PAYMENT',
    'CONFIRMED',
    'EXPIRED',
    'CANCELLED',
  ],
  PENDING_APPROVAL: [
    'PENDING_PAYMENT',
    'CONFIRMED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
  ],
  PENDING_PAYMENT: [
    'CONFIRMED',
    'EXPIRED',
    'CANCELLED',
  ],
  CONFIRMED: [
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
  ],
  IN_PROGRESS: [
    'COMPLETED',
    'NO_SHOW',
  ],
};
```

No deberá permitirse cambiar estado mediante un `PATCH` genérico sin reglas.

---

# Aprobación

La reserva deberá respetar la configuración de la cancha:

```ts
enum BookingApprovalMode {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}
```

---

# Confirmación automática

Cuando el modo es `AUTOMATIC`:

* se valida disponibilidad;
* se calcula precio;
* se crea hold o reserva;
* se procesa pago cuando corresponda;
* se confirma automáticamente.

---

# Confirmación manual

Cuando el modo es `MANUAL`:

* se crea solicitud;
* se notifica al club;
* un usuario autorizado aprueba o rechaza;
* puede existir un vencimiento;
* puede retenerse el horario.

---

# Política de bloqueo durante aprobación

```ts
enum PendingApprovalAvailabilityPolicy {
  BLOCK_SLOT = 'BLOCK_SLOT',
  DO_NOT_BLOCK_SLOT = 'DO_NOT_BLOCK_SLOT',
}
```

---

# Bloquear horario

`BLOCK_SLOT` evita que otra persona reserve mientras se revisa la solicitud.

Debe tener vencimiento para evitar bloqueos indefinidos.

---

# No bloquear horario

`DO_NOT_BLOCK_SLOT` permite múltiples solicitudes.

Cuando una se aprueba, las demás deberán:

* rechazarse;
* notificarse;
* ofrecer alternativas.

---

# Retenciones

Entidad conceptual:

```ts
interface BookingHold {
  id: BookingHoldId;
  clubId: ClubId;
  courtId: CourtId;

  userId?: UserId;
  startsAt: Date;
  endsAt: Date;

  status: BookingHoldStatus;
  expiresAt: Date;

  bookingId?: BookingId;
  createdAt: Date;
  releasedAt?: Date;
}
```

---

# Estado de retención

```ts
enum BookingHoldStatus {
  ACTIVE = 'ACTIVE',
  CONVERTED = 'CONVERTED',
  EXPIRED = 'EXPIRED',
  RELEASED = 'RELEASED',
}
```

---

# Duración de la retención

Ejemplo:

```text
10 minutos
```

Debe ser configurable por club.

No se recomienda una retención demasiado larga porque reduce disponibilidad artificialmente.

---

# Conversión de retención

Una retención puede convertirse en reserva.

La operación deberá:

* validar que sigue activa;
* validar usuario;
* conservar intervalo;
* confirmar precio;
* asociar pago;
* marcar hold como convertido;
* crear o actualizar Booking.

Debe ser transaccional.

---

# Liberación automática

Un proceso deberá detectar retenciones vencidas.

Flujo:

```text
HOLD activo
    ↓
expiresAt alcanzado
    ↓
HOLD expirado
    ↓
Horario liberado
```

La liberación deberá ser idempotente.

---

# Disponibilidad final

BOOKINGS deberá consultar reglas de `COURTS`.

Debe considerar:

* estado del club;
* estado de la sede;
* estado de la cancha;
* horario operativo;
* bloqueos;
* excepciones;
* reservas existentes;
* retenciones activas;
* buffers;
* duración;
* anticipación;
* visibilidad;
* permisos;
* modalidad.

---

# Revalidación obligatoria

La disponibilidad se deberá validar al menos en:

1. consulta inicial;
2. creación de retención;
3. creación de reserva;
4. aprobación;
5. confirmación de pago;
6. reprogramación.

La última validación es la que determina el resultado.

---

# Prevención de doble reserva

Dos reservas no pueden ocupar la misma cancha en intervalos incompatibles.

Estados que ocupan cancha:

```text
HOLD activo
PENDING_APPROVAL cuando bloquea
PENDING_PAYMENT vigente
CONFIRMED
IN_PROGRESS
```

Los estados terminales no ocupan cancha.

---

# Detección de superposición

Regla:

```text
newStart < existingEnd
AND
newEnd > existingStart
```

Debe incluir buffers.

---

# Intervalo efectivo

Ejemplo:

```ts
effectiveStart = startsAt - bufferBefore
effectiveEnd = endsAt + bufferAfter
```

Las comparaciones deberán realizarse sobre el intervalo efectivo.

---

# Restricción en base de datos

La aplicación deberá validar conflictos.

Además, la base de datos deberá aportar una garantía adicional.

Opciones:

* exclusion constraint con rangos temporales;
* bloqueo pesimista;
* transacción serializable;
* advisory lock;
* tabla unificada de ocupaciones.

La decisión debe documentarse en `TECH_DECISIONS.md`.

---

# Modelo unificado de ocupación

Se recomienda evaluar una tabla:

```text
court_occupancies
```

Puede representar:

* reserva;
* retención;
* bloqueo;
* mantenimiento;
* evento interno.

Modelo conceptual:

```ts
interface CourtOccupancy {
  id: string;
  clubId: ClubId;
  courtId: CourtId;

  occupancyType: CourtOccupancyType;
  referenceId: string;

  startsAt: Date;
  endsAt: Date;

  status: CourtOccupancyStatus;
}
```

---

# Ventajas del modelo unificado

Permite:

* validar conflictos en una sola tabla;
* aplicar una restricción de exclusión;
* simplificar consultas;
* unificar bloqueos y reservas;
* mejorar concurrencia.

---

# Desventajas

Puede:

* duplicar información;
* requerir sincronización;
* aumentar complejidad;
* exigir transacciones cuidadosas.

La decisión deberá compararse con mantener consultas separadas.

---

# Idempotencia

La creación de reservas debe soportar una clave de idempotencia.

Ejemplo:

```http
Idempotency-Key: booking-checkout-uuid
```

Esto evita duplicados por:

* doble clic;
* reintentos;
* mala conexión;
* respuesta tardía;
* webhook repetido.

---

# Registro de idempotencia

Modelo conceptual:

```ts
interface IdempotencyRecord {
  key: string;
  userId?: UserId;
  operation: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  expiresAt: Date;
}
```

La misma clave con parámetros diferentes deberá rechazarse.

---

# Código de reserva

Además del UUID, podrá existir un código visible:

```ts
bookingCode: string;
```

Ejemplo:

```text
RND-7F4K2P
```

Reglas:

* único;
* legible;
* no secuencial predecible;
* utilizable en recepción;
* no reemplaza autorización.

---

# Precio

Una reserva deberá conservar un snapshot del precio aplicado.

Campos:

```ts
currency: string;
baseAmount: number;
discountAmount: number;
finalAmount: number;
```

Regla:

```text
finalAmount = baseAmount - discountAmount + fees + taxes
```

Si existen cargos e impuestos, deberán modelarse explícitamente.

---

# Modelo monetario

No se deberán utilizar números de punto flotante para importes.

Opciones:

```ts
amountInMinorUnits: number;
```

o un tipo decimal seguro.

Ejemplo:

```text
1500,50 €
```

puede persistirse como:

```text
150050 céntimos
```

La estrategia deberá ser consistente en toda la aplicación.

---

# Moneda

Campo:

```ts
currency: string;
```

Formato recomendado:

```text
ISO 4217
```

Ejemplos:

```text
EUR
ARS
USD
```

El club define una moneda predeterminada.

La reserva conserva la moneda aplicada.

---

# Fuente de precio

El precio puede depender de:

* cancha;
* duración;
* día;
* horario;
* deporte;
* modalidad;
* membresía;
* anticipación;
* temporada;
* promoción;
* código;
* tipo de cliente.

---

# PriceQuote

Antes de confirmar podrá generarse una cotización.

Modelo conceptual:

```ts
interface BookingPriceQuote {
  id: BookingPriceQuoteId;
  clubId: ClubId;
  courtId: CourtId;
  userId?: UserId;

  startsAt: Date;
  endsAt: Date;

  currency: string;
  baseAmount: number;
  discountAmount: number;
  feeAmount: number;
  taxAmount: number;
  finalAmount: number;

  appliedRuleIds: string[];
  promotionIds: PromotionId[];

  expiresAt: Date;
  createdAt: Date;
}
```

---

# Vencimiento de cotización

La cotización deberá tener una vigencia limitada.

Esto evita confirmar:

* precios antiguos;
* promociones vencidas;
* reglas desactualizadas.

Al confirmar una reserva deberá verificarse que la cotización siga vigente.

---

# Snapshot de precio

Una vez confirmada la reserva, el precio no debe recalcularse automáticamente por cambios posteriores.

La reserva deberá conservar:

* precio base;
* descuentos;
* cargos;
* impuestos;
* promociones;
* regla aplicada;
* moneda.

---

# Desglose de precio

Modelo conceptual:

```ts
interface BookingPriceBreakdownItem {
  id: string;
  bookingId: BookingId;
  type: BookingPriceItemType;
  description: string;
  amount: number;
  referenceId?: string;
}
```

---

# Tipos de ítem

```ts
enum BookingPriceItemType {
  BASE = 'BASE',
  DISCOUNT = 'DISCOUNT',
  PROMOTION = 'PROMOTION',
  FEE = 'FEE',
  TAX = 'TAX',
  ADJUSTMENT = 'ADJUSTMENT',
}
```

---

# Descuentos

Los descuentos podrán provenir de:

* membresía;
* promoción;
* cupón;
* convenio;
* ajuste administrativo;
* beneficio comercial.

No se deberá permitir un descuento mayor al importe total salvo que exista saldo a favor explícito.

---

# Ajustes administrativos

Un administrador autorizado podrá ajustar el precio.

Debe registrar:

* importe anterior;
* importe nuevo;
* motivo;
* responsable;
* permiso;
* fecha.

No deberá sobrescribirse el historial.

---

# Estado de pago

```ts
enum BookingPaymentStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUND_PENDING = 'REFUND_PENDING',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}
```

---

# Pago no requerido

`NOT_REQUIRED` aplica cuando:

* reserva gratuita;
* beneficio total;
* pago presencial posterior;
* uso interno;
* membresía incluida.

---

# Pendiente

`PENDING` indica que todavía no se registró el pago necesario.

---

# Pago parcial

`PARTIALLY_PAID` permite:

* señas;
* pagos divididos;
* saldo pendiente.

---

# Pagada

`PAID` indica que el importe requerido fue cubierto.

---

# Pago fallido

`FAILED` representa un intento de pago rechazado o fallido.

No necesariamente cancela la reserva inmediatamente.

Debe aplicarse la política correspondiente.

---

# Reembolsos

Los estados de reembolso se utilizarán cuando exista integración de pagos.

El procesamiento detallado pertenecerá a `PAYMENTS.md`.

---

# Separación entre reserva y pago

Una reserva no debe depender directamente de una única transacción de pago.

Modelo recomendado:

```text
Booking
  ↓
PaymentIntent
  ↓
PaymentTransaction
  ↓
Refund
```

Esto permite:

* múltiples intentos;
* pagos parciales;
* distintos medios;
* reembolsos;
* conciliación.

---

# Reservas gratuitas

Una reserva con:

```text
finalAmount = 0
```

debe establecer:

```text
paymentStatus = NOT_REQUIRED
```

No deberá crear un intento de pago innecesario.

---

# Pago presencial

Puede modelarse como:

```ts
paymentMethod: CASH_AT_VENUE
```

La reserva podrá confirmarse con pago pendiente si la política del club lo permite.

---

# Política de confirmación por pago

```ts
enum BookingPaymentConfirmationPolicy {
  CONFIRM_BEFORE_PAYMENT = 'CONFIRM_BEFORE_PAYMENT',
  CONFIRM_AFTER_PAYMENT = 'CONFIRM_AFTER_PAYMENT',
  PARTIAL_PAYMENT_REQUIRED = 'PARTIAL_PAYMENT_REQUIRED',
}
```

---

# Confirmar antes del pago

Permite reservar y pagar después.

Riesgo:

* ausencias;
* impago;
* bloqueo de horarios.

---

# Confirmar después del pago

La reserva se confirma únicamente cuando el pago se aprueba.

Mientras tanto puede existir hold.

---

# Seña obligatoria

`PARTIAL_PAYMENT_REQUIRED` exige un importe mínimo.

Modelo conceptual:

```ts
requiredDepositAmount: number;
```

---

# Cancelación

Una reserva podrá cancelarse por:

* usuario;
* club;
* sistema;
* vencimiento;
* mantenimiento;
* clima;
* fraude;
* falta de pago;
* partido cancelado.

---

# Entidad de cancelación

Modelo conceptual:

```ts
interface BookingCancellation {
  id: BookingCancellationId;
  bookingId: BookingId;

  cancelledByUserId?: UserId;
  source: BookingCancellationSource;
  reasonCode: BookingCancellationReason;
  reasonText?: string;

  policyVersionId?: string;

  refundableAmount: number;
  penaltyAmount: number;

  createdAt: Date;
}
```

---

# Origen de cancelación

```ts
enum BookingCancellationSource {
  CUSTOMER = 'CUSTOMER',
  CLUB = 'CLUB',
  SYSTEM = 'SYSTEM',
  PAYMENT = 'PAYMENT',
  MATCH = 'MATCH',
}
```

---

# Motivos de cancelación

```ts
enum BookingCancellationReason {
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  CLUB_REQUEST = 'CLUB_REQUEST',
  WEATHER = 'WEATHER',
  MAINTENANCE = 'MAINTENANCE',
  VENUE_CLOSED = 'VENUE_CLOSED',
  COURT_UNAVAILABLE = 'COURT_UNAVAILABLE',
  PAYMENT_NOT_COMPLETED = 'PAYMENT_NOT_COMPLETED',
  FRAUD_RISK = 'FRAUD_RISK',
  MATCH_CANCELLED = 'MATCH_CANCELLED',
  DUPLICATE = 'DUPLICATE',
  OTHER = 'OTHER',
}
```

---

# Política de cancelación

La política puede depender de:

* club;
* sede;
* cancha;
* deporte;
* modalidad;
* anticipación;
* membresía;
* promoción;
* tarifa.

---

# Ejemplo de política

```text
Más de 24 horas antes:
reembolso del 100 %

Entre 12 y 24 horas:
reembolso del 50 %

Menos de 12 horas:
sin reembolso
```

La política definitiva debe versionarse.

---

# Regla de snapshot

La reserva deberá conservar la política aplicable o su referencia versionada.

Un cambio posterior no debe alterar retroactivamente las condiciones aceptadas.

---

# Cancelación por el club

Cuando el club cancela por una causa propia, normalmente debería:

* devolver el importe;
* ofrecer reprogramación;
* notificar;
* explicar el motivo;
* evitar penalizar al usuario.

La política puede variar por causa.

---

# Cancelación parcial

Una reserva simple no admite cancelación parcial del intervalo.

Si se necesita reducir duración, deberá utilizarse reprogramación o ajuste específico.

---

# Reprogramación

Reprogramar significa cambiar:

* fecha;
* hora;
* cancha;
* sede;
* duración;
* modalidad.

Debe conservar trazabilidad.

---

# Modelo recomendado

No sobrescribir silenciosamente el intervalo original.

Crear un registro:

```ts
interface BookingReschedule {
  id: BookingRescheduleId;
  bookingId: BookingId;

  previousCourtId: CourtId;
  newCourtId: CourtId;

  previousStartsAt: Date;
  previousEndsAt: Date;

  newStartsAt: Date;
  newEndsAt: Date;

  requestedByUserId: UserId;
  approvedByUserId?: UserId;

  reason?: string;
  priceDifference: number;

  createdAt: Date;
}
```

---

# Reprogramación transaccional

La operación deberá:

1. validar la reserva original;
2. validar permisos;
3. validar nueva disponibilidad;
4. calcular nuevo precio;
5. calcular diferencia;
6. reservar el nuevo intervalo;
7. liberar el anterior;
8. registrar cambio;
9. ajustar pago;
10. notificar.

Debe evitar dejar ambos horarios ocupados ante un fallo.

---

# Diferencia de precio

Puede resultar:

```text
priceDifference > 0
```

El usuario debe pagar la diferencia.

```text
priceDifference < 0
```

Puede generarse:

* reembolso;
* saldo a favor;
* ajuste.

---

# Política de reprogramación

Puede depender de:

* anticipación;
* cantidad de cambios;
* tarifa;
* membresía;
* disponibilidad;
* club.

Ejemplo:

```text
Una reprogramación gratuita hasta 12 horas antes.
```

---

# Historial

Toda reserva deberá mantener historial de eventos.

Modelo conceptual:

```ts
interface BookingHistoryEntry {
  id: string;
  bookingId: BookingId;
  type: BookingHistoryType;
  actorUserId?: UserId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
```

---

# Tipos de historial

```ts
enum BookingHistoryType {
  CREATED = 'CREATED',
  HELD = 'HELD',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  CONFIRMED = 'CONFIRMED',
  RESCHEDULED = 'RESCHEDULED',
  PRICE_ADJUSTED = 'PRICE_ADJUSTED',
  CANCELLED = 'CANCELLED',
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  NO_SHOW_MARKED = 'NO_SHOW_MARKED',
  EXPIRED = 'EXPIRED',
}
```

---

# Notas

Campo opcional:

```ts
notes?: string;
```

Deben diferenciarse:

* notas del usuario;
* notas internas;
* instrucciones públicas.

No debe exponerse una nota administrativa al cliente.

---

# Modelo de notas

```ts
interface BookingNote {
  id: string;
  bookingId: BookingId;
  authorUserId: UserId;
  visibility: BookingNoteVisibility;
  content: string;
  createdAt: Date;
}
```

---

# Visibilidad de nota

```ts
enum BookingNoteVisibility {
  CUSTOMER = 'CUSTOMER',
  CLUB_INTERNAL = 'CLUB_INTERNAL',
  SYSTEM = 'SYSTEM',
}
```

---

# Participantes

Una reserva puede conocer o no a todos los participantes.

Campos posibles:

```ts
participantCount?: number;
```

La lista detallada deberá pertenecer a:

* partido;
* invitaciones;
* grupo de reserva futuro.

BOOKINGS no debe duplicar la lógica de participantes de MATCHES.

---

# Reserva vinculada a partido

Campo conceptual:

```ts
matchId?: MatchId;
```

Reglas:

* una reserva puede existir sin partido;
* un partido puede existir sin reserva;
* la relación debe ser explícita;
* cancelar uno no debe cancelar el otro sin aplicar reglas.

---

# Cancelación de partido

Si se cancela un partido asociado, MATCHES deberá solicitar una acción a BOOKINGS.

Opciones:

* conservar la reserva;
* cancelar la reserva;
* transferir al organizador;
* reprogramar.

No debe asumirse automáticamente.

---

# Check-in

En futuras versiones podrá registrarse llegada.

Modelo conceptual:

```ts
interface BookingCheckIn {
  bookingId: BookingId;
  checkedInAt: Date;
  checkedInByUserId: UserId;
}
```

Puede utilizarse para:

* operación;
* no-show;
* control de acceso;
* estadísticas.

---

# Check-out

También podrá registrarse finalización real.

```ts
checkedOutAt?: Date;
```

No es obligatorio para el MVP.

---

# No-show

Un administrador podrá marcar una reserva como `NO_SHOW`.

Debe validar:

* horario iniciado o finalizado;
* reserva confirmada;
* permiso;
* ausencia real;
* período de tolerancia.

Debe registrarse evidencia o nota.

---

# Período de tolerancia

Ejemplo:

```text
15 minutos
```

La reserva no debería marcarse automáticamente como no-show antes de que transcurra.

---

# Reserva administrativa forzada

Un administrador con permiso especial podrá crear una reserva aunque exista una regla no crítica.

Ejemplos:

* fuera de anticipación;
* duración especial;
* uso interno.

No podrá ignorar una doble ocupación sin un flujo explícito de override.

---

# Override administrativo

Modelo conceptual:

```ts
interface BookingOverride {
  bookingId: BookingId;
  ruleCode: string;
  reason: string;
  authorizedByUserId: UserId;
  createdAt: Date;
}
```

Todo override deberá auditarse.

---

# Conflictos

Un conflicto puede ocurrir por:

* doble reserva;
* bloqueo posterior;
* cierre de sede;
* mantenimiento;
* cambio de cancha;
* error de importación;
* sincronización externa.

---

# Entidad BookingConflict

```ts
interface BookingConflict {
  id: BookingConflictId;
  bookingId: BookingId;
  type: BookingConflictType;
  status: BookingConflictStatus;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedByUserId?: UserId;
  resolution?: string;
}
```

---

# Tipos de conflicto

```ts
enum BookingConflictType {
  OVERLAPPING_BOOKING = 'OVERLAPPING_BOOKING',
  COURT_BLOCKED = 'COURT_BLOCKED',
  COURT_INACTIVE = 'COURT_INACTIVE',
  VENUE_CLOSED = 'VENUE_CLOSED',
  PAYMENT_INCONSISTENCY = 'PAYMENT_INCONSISTENCY',
  EXTERNAL_SYNC = 'EXTERNAL_SYNC',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
}
```

---

# Resolución de conflictos

Un conflicto podrá resolverse mediante:

* reprogramación;
* cancelación;
* cambio de cancha;
* ajuste administrativo;
* reembolso;
* confirmación manual.

No deberá ocultarse automáticamente.

---

# Reserva recurrente

En futuras versiones podrán existir reservas recurrentes.

Ejemplo:

```text
Todos los miércoles de 20:00 a 21:00
durante 8 semanas
```

Modelo conceptual:

```ts
interface BookingSeries {
  id: BookingSeriesId;
  clubId: ClubId;
  customerUserId: UserId;
  recurrenceRule: RecurrenceRule;
  status: BookingSeriesStatus;
}
```

Cada ocurrencia debería ser una Booking independiente.

---

# Ventajas de ocurrencias independientes

Permite:

* cancelar una fecha;
* reprogramar una fecha;
* cambiar precio;
* registrar pago;
* gestionar conflictos;
* mantener historial.

---

# Estado de serie

```ts
enum BookingSeriesStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
```

No forma parte obligatoria del MVP.

---

# Reserva múltiple

Una operación puede reservar varias canchas o franjas.

Ejemplo:

* torneo;
* evento;
* entrenamiento;
* paquete.

Se recomienda modelar:

```text
BookingGroup
  ├── Booking A
  ├── Booking B
  └── Booking C
```

Cada reserva mantiene su integridad individual.

---

# Casos de uso

El dominio deberá contemplar al menos:

```text
GetBooking
ListUserBookings
ListClubBookings
ListCourtBookings

CreateBookingHold
ReleaseBookingHold
ExpireBookingHolds

CreateBooking
CreateAdministrativeBooking
RequestBookingApproval
ApproveBooking
RejectBooking

ConfirmBooking
CancelBooking
RescheduleBooking

StartBooking
CompleteBooking
MarkBookingNoShow

GetBookingPriceQuote
AdjustBookingPrice

ValidateBookingAvailability
DetectBookingConflicts
ResolveBookingConflict
```

---

# CreateBookingHold

Debe:

* validar usuario;
* validar cancha;
* validar intervalo;
* validar disponibilidad;
* calcular vencimiento;
* crear ocupación;
* devolver cotización;
* ser idempotente.

---

# CreateBooking

Debe validar:

* identidad;
* club;
* sede;
* cancha;
* deporte;
* modalidad;
* intervalo;
* duración;
* disponibilidad;
* precio;
* política;
* pago;
* aprobación;
* idempotencia.

---

# CreateAdministrativeBooking

Permite crear una reserva desde el panel.

Puede incluir:

* cliente registrado;
* invitado;
* notas internas;
* pago presencial;
* override autorizado.

---

# RequestBookingApproval

Crea una solicitud pendiente.

Debe:

* validar política;
* definir vencimiento;
* decidir si bloquea el horario;
* notificar administradores.

---

# ApproveBooking

Debe:

* validar permiso;
* validar vigencia;
* revalidar disponibilidad;
* calcular o validar precio;
* cambiar estado;
* iniciar pago o confirmar;
* notificar.

---

# RejectBooking

Debe:

* registrar motivo;
* liberar ocupación;
* cambiar estado;
* notificar;
* conservar historial.

---

# ConfirmBooking

Debe:

* validar transición;
* validar pago o excepción;
* revalidar ocupación;
* establecer `confirmedAt`;
* emitir evento;
* enviar confirmación.

---

# CancelBooking

Debe:

* validar permiso;
* validar política;
* calcular penalización;
* calcular reembolso;
* liberar ocupación;
* registrar cancelación;
* actualizar estado;
* iniciar reembolso cuando corresponda;
* notificar.

---

# RescheduleBooking

Debe ejecutar la operación transaccional definida anteriormente.

---

# StartBooking

Puede ejecutarse:

* automáticamente al llegar la hora;
* mediante check-in;
* por recepción.

Debe evitar iniciar una reserva cancelada o expirada.

---

# CompleteBooking

Puede ejecutarse:

* automáticamente al finalizar;
* por recepción;
* por proceso programado.

Debe habilitar:

* historial;
* valoración;
* estadísticas;
* reputación.

---

# MarkBookingNoShow

Debe requerir permiso y validaciones temporales.

---

# GetBookingPriceQuote

Debe recibir:

```ts
interface GetBookingPriceQuoteInput {
  clubId: ClubId;
  courtId: CourtId;
  userId?: UserId;
  startsAt: Date;
  endsAt: Date;
  promotionCode?: string;
}
```

Debe devolver un snapshot temporal.

---

# Eventos de dominio

Eventos sugeridos:

```text
BookingHoldCreated
BookingHoldReleased
BookingHoldExpired
BookingCreated
BookingApprovalRequested
BookingApproved
BookingRejected
BookingPaymentRequired
BookingConfirmed
BookingStarted
BookingCompleted
BookingCancelled
BookingExpired
BookingRescheduled
BookingPriceQuoted
BookingPriceAdjusted
BookingNoShowMarked
BookingConflictDetected
BookingConflictResolved
```

---

# Endpoints iniciales

Ejemplos conceptuales:

```http
GET /api/v1/bookings/:bookingId

GET /api/v1/users/me/bookings
GET /api/v1/clubs/:clubId/bookings
GET /api/v1/clubs/:clubId/courts/:courtId/bookings

POST /api/v1/clubs/:clubId/courts/:courtId/booking-holds
DELETE /api/v1/booking-holds/:holdId

POST /api/v1/clubs/:clubId/bookings
POST /api/v1/clubs/:clubId/bookings/admin

POST /api/v1/clubs/:clubId/bookings/:bookingId/approval
POST /api/v1/clubs/:clubId/bookings/:bookingId/rejection
POST /api/v1/clubs/:clubId/bookings/:bookingId/confirmation

POST /api/v1/clubs/:clubId/bookings/:bookingId/cancellation
POST /api/v1/clubs/:clubId/bookings/:bookingId/reschedule

POST /api/v1/clubs/:clubId/bookings/:bookingId/start
POST /api/v1/clubs/:clubId/bookings/:bookingId/completion
POST /api/v1/clubs/:clubId/bookings/:bookingId/no-show

POST /api/v1/clubs/:clubId/courts/:courtId/price-quotes
POST /api/v1/clubs/:clubId/bookings/:bookingId/price-adjustments
```

---

# Respuesta de reserva

Ejemplo conceptual:

```json
{
  "id": "booking_uuid",
  "bookingCode": "RND-7F4K2P",
  "club": {
    "id": "club_uuid",
    "name": "Club Señor Pato"
  },
  "venue": {
    "id": "venue_uuid",
    "name": "Sede Principal"
  },
  "court": {
    "id": "court_uuid",
    "name": "Cancha 1"
  },
  "sport": {
    "id": "sport_uuid",
    "name": "Fútbol"
  },
  "modality": {
    "id": "modality_uuid",
    "name": "Fútbol 5"
  },
  "startsAt": "2026-07-28T21:00:00Z",
  "endsAt": "2026-07-28T22:00:00Z",
  "timeZone": "America/Argentina/Buenos_Aires",
  "status": "CONFIRMED",
  "source": "USER_APP",
  "participantCount": 10,
  "price": {
    "currency": "ARS",
    "baseAmount": 3000000,
    "discountAmount": 500000,
    "finalAmount": 2500000
  },
  "paymentStatus": "PAID",
  "confirmedAt": "2026-07-20T14:00:00Z",
  "createdAt": "2026-07-20T13:55:00Z"
}
```

Los importes del ejemplo están expresados en unidades menores.

---

# Persistencia conceptual

Tabla principal:

```text
bookings
```

Campos sugeridos:

```text
id
booking_code
club_id
venue_id
court_id
created_by_user_id
customer_user_id
sport_id
sport_modality_id
starts_at
ends_at
time_zone
status
source
approval_mode
participant_count
currency
base_amount
discount_amount
fee_amount
tax_amount
final_amount
payment_status
expires_at
confirmed_at
cancelled_at
completed_at
created_at
updated_at
deleted_at
```

---

# Restricciones de bookings

```text
id único
booking_code único
club_id obligatorio
venue_id obligatorio
court_id obligatorio
starts_at < ends_at
importes >= 0
final_amount >= 0
currency obligatoria
status válido
```

---

# Tabla de retenciones

```text
booking_holds
```

Campos:

```text
id
club_id
venue_id
court_id
user_id
starts_at
ends_at
status
expires_at
booking_id
created_at
released_at
```

---

# Tabla de cotizaciones

```text
booking_price_quotes
```

Campos:

```text
id
club_id
court_id
user_id
starts_at
ends_at
currency
base_amount
discount_amount
fee_amount
tax_amount
final_amount
expires_at
created_at
```

---

# Tabla de desglose

```text
booking_price_items
```

Campos:

```text
id
booking_id
type
description
amount
reference_id
created_at
```

---

# Tabla de cancelaciones

```text
booking_cancellations
```

Campos:

```text
id
booking_id
cancelled_by_user_id
source
reason_code
reason_text
policy_version_id
refundable_amount
penalty_amount
created_at
```

---

# Tabla de reprogramaciones

```text
booking_reschedules
```

Campos:

```text
id
booking_id
previous_court_id
new_court_id
previous_starts_at
previous_ends_at
new_starts_at
new_ends_at
requested_by_user_id
approved_by_user_id
reason
price_difference
created_at
```

---

# Tabla de historial

```text
booking_history
```

Campos:

```text
id
booking_id
type
actor_user_id
metadata_json
created_at
```

`metadata_json` deberá utilizarse solo para información complementaria.

---

# Tabla de conflictos

```text
booking_conflicts
```

Campos:

```text
id
booking_id
type
status
detected_at
resolved_at
resolved_by_user_id
resolution
created_at
updated_at
```

---

# Índices sugeridos

```text
bookings.club_id
bookings.venue_id
bookings.court_id
bookings.customer_user_id
bookings.status
bookings.starts_at
bookings.ends_at
bookings.payment_status
bookings.booking_code

booking_holds.court_id
booking_holds.status
booking_holds.expires_at

booking_history.booking_id
booking_conflicts.booking_id
booking_conflicts.status
```

---

# Índice temporal crítico

Las búsquedas más importantes serán por:

```text
court_id
starts_at
ends_at
status
```

La estrategia de índice deberá optimizar validación de superposición.

---

# Aislamiento multi-club

Toda operación deberá validar:

```text
booking.clubId === activeClubId
court.clubId === activeClubId
venue.clubId === activeClubId
```

No se deberá recuperar una reserva únicamente por ID y confiar en el resultado.

---

# Seguridad

Toda operación deberá validar:

1. usuario autenticado;
2. usuario activo;
3. club;
4. sede;
5. cancha;
6. estado de entidades;
7. membresía cuando corresponda;
8. permiso;
9. ownership;
10. política;
11. disponibilidad;
12. idempotencia.

---

# Permisos sugeridos

```text
BOOKING_VIEW
BOOKING_CREATE
BOOKING_EDIT
BOOKING_APPROVE
BOOKING_REJECT
BOOKING_CANCEL
BOOKING_RESCHEDULE
BOOKING_PRICE_ADJUST
BOOKING_MARK_NO_SHOW
BOOKING_OVERRIDE
```

---

# Acceso del cliente

Un usuario puede:

* ver sus reservas;
* cancelar según política;
* reprogramar según política;
* pagar;
* consultar comprobantes;
* ver historial básico.

No puede:

* ajustar precio;
* cambiar estado arbitrariamente;
* ver notas internas;
* cancelar reservas ajenas;
* aplicar overrides.

---

# Acceso administrativo

Un administrador autorizado puede:

* crear;
* aprobar;
* rechazar;
* cancelar;
* reprogramar;
* ajustar precio;
* marcar no-show;
* resolver conflictos.

Cada acción depende de permisos explícitos.

---

# Auditoría

Deberán auditarse:

* creación;
* aprobación;
* rechazo;
* confirmación;
* cancelación;
* reprogramación;
* ajuste de precio;
* cambio de usuario;
* cambio de cancha;
* override;
* no-show;
* conflicto;
* reembolso;
* modificación administrativa;
* acceso sensible.

---

# Notificaciones

El dominio deberá generar notificaciones por:

* reserva creada;
* aprobación pendiente;
* reserva aprobada;
* reserva rechazada;
* pago pendiente;
* reserva confirmada;
* recordatorio;
* cambio de cancha;
* reprogramación;
* cancelación;
* reembolso;
* cierre de cancha;
* conflicto;
* reserva próxima.

---

# Recordatorios

Ejemplo de recordatorios:

```text
24 horas antes
2 horas antes
```

La configuración deberá pertenecer a `NOTIFICATIONS`.

BOOKINGS emite la información necesaria.

---

# Procesos programados

Se necesitarán procesos para:

* expirar holds;
* expirar pagos pendientes;
* expirar solicitudes;
* iniciar reservas;
* completar reservas;
* detectar no-show potencial;
* enviar recordatorios;
* detectar inconsistencias;
* reconciliar pagos.

Todos deberán ser idempotentes.

---

# Métricas

El dominio podrá generar:

* reservas creadas;
* reservas confirmadas;
* reservas canceladas;
* reservas expiradas;
* ocupación por cancha;
* ingresos;
* descuentos;
* no-shows;
* tiempo medio de confirmación;
* solicitudes aprobadas;
* conversión de hold;
* conflictos;
* reprogramaciones;
* reservas por canal.

---

# Pruebas mínimas

Deberán existir pruebas para:

* creación válida;
* intervalo inválido;
* cancha inactiva;
* sede cerrada;
* modalidad incompatible;
* duración inválida;
* doble reserva;
* buffers;
* hold;
* expiración;
* idempotencia;
* aprobación manual;
* rechazo;
* confirmación;
* pago pendiente;
* reserva gratuita;
* cancelación;
* reprogramación;
* cambio de precio;
* no-show;
* aislamiento entre clubes;
* concurrencia real;
* transición de estados;
* reintentos;
* webhook duplicado futuro.

---

# Reglas principales

1. Una reserva ocupa una cancha durante un intervalo.
2. Toda reserva pertenece a un club, sede y cancha.
3. La disponibilidad debe revalidarse al confirmar.
4. La interfaz nunca garantiza disponibilidad definitiva.
5. Las retenciones tienen vencimiento.
6. Los estados deben cambiar mediante casos de uso explícitos.
7. No se permite doble reserva.
8. La base de datos debe reforzar la prevención de superposición.
9. Las fechas se almacenan en UTC.
10. La zona horaria aplicada debe conservarse.
11. El precio confirmado debe conservarse como snapshot.
12. Los importes no usan punto flotante.
13. La moneda debe almacenarse en formato ISO.
14. La cancelación conserva historial.
15. La reprogramación debe ser transaccional.
16. Una reserva y un pago son dominios relacionados pero independientes.
17. Una reserva puede existir sin partido.
18. Un partido puede existir sin reserva.
19. Toda operación sensible debe ser idempotente.
20. Toda acción administrativa debe auditarse.
21. Los estados terminales no se reactivan mediante un cambio directo.
22. Los bloqueos administrativos no deben cancelar reservas silenciosamente.
23. Los UUID no reemplazan autorización.
24. La política aplicable debe versionarse.
25. Toda reserva confirmada debe poder reconstruirse históricamente.

---

# Principio final

BOOKINGS debe garantizar que una cancha no pueda ser prometida a dos personas al mismo tiempo.

El dominio debe coordinar disponibilidad, precio, confirmación y cancelación sin convertirse en el sistema de pagos ni en el dominio de partidos.

Su responsabilidad principal es representar una ocupación reservada, consistente, auditable y segura.
