// Frame data for the Saga walk-through (box-and-arrow player with icons).
// box.tone: ok | bad | warn | new | none.

const b = (id, title, lines = [], tone, badge) => ({ id, title, lines, tone, badge });
const d = (from, to, label, tone) => ({ from, to, label, tone });

export const SAGA_SCENES = [
  {
    id: 'happy',
    label: 'Orchestrated, success',
    title: 'Orchestrated saga: one coordinator runs the steps in order',
    frames: [
      {
        note: 'Alice books a trip: a flight, a hotel and the payment, each owned by a different service with its own database. No single database transaction can cover all three, so a saga runs them as three local transactions, led by an orchestrator.',
        boxes: [b('o', 'Booking orchestrator', ['saga TRIP-7', 'state: STARTED'], 'new', 'saga'), b('f', 'Flight service', ['own database'], 'none'), b('h', 'Hotel service', ['own database'], 'none'), b('p', 'Payment service', ['own database'], 'none')],
        deps: [],
      },
      {
        note: 'Step 1: the orchestrator tells the flight service to reserve a seat. The flight service commits its own local transaction and replies.',
        boxes: [b('o', 'Booking orchestrator', ['state: FLIGHT_RESERVED'], 'ok'), b('f', 'Flight service', ['seat 12A reserved (committed)'], 'ok', 'step 1 done')],
        deps: [d('Booking orchestrator', 'Flight service', 'ReserveFlight', 'ok'), d('Flight service', 'Booking orchestrator', 'FlightReserved', 'ok')],
      },
      {
        note: 'Step 2: the hotel service reserves a room, again in its own local transaction.',
        boxes: [b('o', 'Booking orchestrator', ['state: HOTEL_RESERVED'], 'ok'), b('h', 'Hotel service', ['room 305 reserved (committed)'], 'ok', 'step 2 done')],
        deps: [d('Booking orchestrator', 'Hotel service', 'ReserveHotel', 'ok'), d('Hotel service', 'Booking orchestrator', 'HotelReserved', 'ok')],
      },
      {
        note: 'Step 3: the payment service charges Alice. This is the last step: once it succeeds, the saga is complete and the reservations become final. The system is consistent again, although it was briefly in between.',
        boxes: [b('o', 'Booking orchestrator', ['state: COMPLETED'], 'ok', 'success'), b('p', 'Payment service', ['charged Alice (committed)'], 'ok', 'step 3 done')],
        deps: [d('Booking orchestrator', 'Payment service', 'ChargePayment', 'ok'), d('Payment service', 'Booking orchestrator', 'PaymentCharged', 'ok')],
      },
    ],
  },
  {
    id: 'compensate',
    label: 'Failure and compensation',
    title: 'When a step fails, earlier steps are undone with compensating transactions',
    frames: [
      {
        note: 'The flight and the hotel are already reserved and committed. The payment step now fails because Alice\'s card is declined.',
        boxes: [b('o', 'Booking orchestrator', ['state: HOTEL_RESERVED'], 'warn'), b('f', 'Flight service', ['seat 12A reserved'], 'ok'), b('h', 'Hotel service', ['room 305 reserved'], 'ok'), b('p', 'Payment service', ['card declined'], 'bad', 'failed')],
        deps: [d('Booking orchestrator', 'Payment service', 'ChargePayment', 'ok'), d('Payment service', 'Booking orchestrator', 'PaymentFailed', 'bad')],
      },
      {
        note: 'There is no rollback, because the earlier steps are already committed and visible. Instead the orchestrator runs compensating transactions in reverse order. First the hotel reservation is cancelled.',
        boxes: [b('o', 'Booking orchestrator', ['state: COMPENSATING'], 'warn', 'undo'), b('h', 'Hotel service', ['room 305 cancelled'], 'new', 'compensated')],
        deps: [d('Booking orchestrator', 'Hotel service', 'CancelHotel', 'bad'), d('Hotel service', 'Booking orchestrator', 'HotelCancelled', 'ok')],
      },
      {
        note: 'Then the flight reservation is cancelled. A compensation is a new business action (cancel the booking), not a deleted row, so it must itself be safe to retry: it is idempotent.',
        boxes: [b('o', 'Booking orchestrator', ['state: COMPENSATING'], 'warn'), b('f', 'Flight service', ['seat 12A cancelled'], 'new', 'compensated')],
        deps: [d('Booking orchestrator', 'Flight service', 'CancelFlight', 'bad'), d('Flight service', 'Booking orchestrator', 'FlightCancelled', 'ok')],
      },
      {
        note: 'The saga ends in the FAILED state with nothing left half-done. Alice sees a clear "booking failed" result. Compensations must not fail permanently, so they are retried until they succeed.',
        boxes: [b('o', 'Booking orchestrator', ['state: FAILED', 'all steps undone'], 'bad', 'rolled back'), b('f', 'Flight service', ['no reservation'], 'ok'), b('h', 'Hotel service', ['no reservation'], 'ok')],
        deps: [],
      },
    ],
  },
  {
    id: 'choreography',
    label: 'Choreography',
    title: 'Choreographed saga: services react to each other\'s events',
    frames: [
      {
        note: 'There is no coordinator. The booking service saves a pending booking and publishes BookingCreated to the message broker (using the outbox pattern so the event is reliable).',
        boxes: [b('b', 'Booking service', ['booking TRIP-7: PENDING'], 'new'), b('mb', 'Message broker', ['BookingCreated'], 'ok', 'event')],
        deps: [d('Booking service', 'Message broker', 'BookingCreated', 'ok')],
      },
      {
        note: 'The flight service subscribes to BookingCreated, reserves a seat and publishes FlightReserved. The hotel service listens for that and reserves a room, then publishes HotelReserved.',
        boxes: [b('f', 'Flight service', ['reserved seat 12A'], 'ok'), b('h', 'Hotel service', ['reserved room 305'], 'ok'), b('mb', 'Message broker', ['FlightReserved', 'HotelReserved'], 'ok')],
        deps: [d('Message broker', 'Flight service', 'BookingCreated', 'ok'), d('Flight service', 'Message broker', 'FlightReserved', 'ok'), d('Message broker', 'Hotel service', 'FlightReserved', 'ok'), d('Hotel service', 'Message broker', 'HotelReserved', 'ok')],
      },
      {
        note: 'The payment service reacts to HotelReserved. If the charge fails it publishes PaymentFailed. The hotel and flight services both subscribe to PaymentFailed and each undoes its own step.',
        boxes: [b('p', 'Payment service', ['charge failed'], 'bad', 'failed'), b('mb', 'Message broker', ['PaymentFailed'], 'bad'), b('h', 'Hotel service', ['cancels room 305'], 'new', 'compensates'), b('f', 'Flight service', ['cancels seat 12A'], 'new', 'compensates')],
        deps: [d('Payment service', 'Message broker', 'PaymentFailed', 'bad'), d('Message broker', 'Hotel service', 'PaymentFailed', 'ok'), d('Message broker', 'Flight service', 'PaymentFailed', 'ok')],
      },
      {
        note: 'Choreography has no single point of control and no extra service, which is simple for three or four steps. The cost is that the overall flow lives only in the subscriptions, so it is hard to see, change and debug as it grows, and cyclic dependencies between services can appear.',
        boxes: [b('b', 'Booking service', ['hears BookingFailed', 'marks booking FAILED'], 'ok'), b('mb', 'Message broker', ['flow exists only in subscriptions'], 'warn')],
        deps: [d('Message broker', 'Booking service', 'BookingFailed', 'ok')],
      },
    ],
  },
];
