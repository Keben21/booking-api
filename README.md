# Booking and Inventory API

A backend API for reserving a limited number of spots at an event, built around one core problem: making sure two people can never both successfully grab the last spot at the same time. This is my first project using PostgreSQL instead of MongoDB, and my first time working with real database transactions.

**Live API:** https://booking-api-qzok.onrender.com/

## The Core Problem

If you check "are there spots available" and then separately reduce the spot count, there's a gap between those two steps where two requests could both see availability and both succeed, even if only one spot was actually left. This is a race condition, and it's the main thing this project is built to prevent.

The fix is a single atomic SQL update that checks and reduces availability in one indivisible operation, not two separate steps. I tested this directly by firing two near-simultaneous hold requests at an event with only enough spots for one of them to succeed, and confirmed only one request ever goes through.

## Features

- User signup and login with JWT authentication
- Role-based access (admin vs customer), admins can create events, customers can book them
- Event creation and listing
- Atomic spot reservation that prevents overselling, even under concurrent requests
- Booking lifecycle: held, confirmed, cancelled, expired
- Confirm or cancel a held booking
- Expired holds release their spots back to the event
- Database transactions used anywhere multiple tables need to change together, so a booking can never be marked cancelled without its spots actually being released
- Foreign keys linking bookings to their user and event

## Built With

- Node.js
- Express.js
- PostgreSQL
- node-postgres (pg)
- JWT
- bcryptjs

## Getting Started

Clone the repository:

    git clone https://github.com/Keben21/booking-api

Install dependencies:

    npm install

Create a PostgreSQL database and run the table creation statements in `schema.sql` (included in this repo).

Create a `.env` file in the root directory:

    PORT=5000
    DATABASE_URL=your_postgresql_connection_string
    JWT_SECRET=your_jwt_secret

Start the server:

    npm run dev

The API will run on:

    http://localhost:5000

You can use Postman or another API testing tool to test the endpoints.

## API Endpoints

### Authentication

| Method | Endpoint           | Description              |
| ------ | ------------------ | ------------------------ |
| POST   | `/api/auth/signup` | Create a new account     |
| POST   | `/api/auth/login`  | Log in and receive a JWT |

### Events

| Method | Endpoint      | Description                     |
| ------ | ------------- | ------------------------------- |
| POST   | `/api/events` | Create a new event (admin only) |
| GET    | `/api/events` | List all published events       |

### Bookings

| Method | Endpoint                           | Description                                                |
| ------ | ---------------------------------- | ---------------------------------------------------------- |
| POST   | `/api/bookings/:eventId/hold`      | Place a temporary hold on spots for an event               |
| PUT    | `/api/bookings/:bookingId/confirm` | Confirm a held booking                                     |
| PUT    | `/api/bookings/:bookingId/cancel`  | Cancel a held booking and release its spots                |
| POST   | `/api/bookings/expire-holds`       | Manually trigger expiry of any holds past their time limit |

For protected routes, include the token in the request header:

    Authorization: Bearer YOUR_TOKEN

## What I Practiced

- Writing raw SQL with PostgreSQL instead of an ODM, including parameterized queries to prevent SQL injection
- Designing relational tables with foreign keys instead of document references
- Preventing race conditions with a single atomic UPDATE, rather than checking and updating in separate steps
- Database transactions (BEGIN, COMMIT, ROLLBACK) to keep multi-table changes consistent, so a partial failure can never leave the database in a broken state
- Deliberately testing concurrent requests against the same resource to confirm the protection actually holds, not just assuming it does
- Role-based access control for admin-only routes
- Thinking through booking lifecycles and what should and shouldn't be allowed at each state

## Future Improvements

- Automatic background expiry using Redis and a job queue, instead of the current manual trigger
- Idempotency keys so a retried request can't create a duplicate booking
- Automated tests, including repeatable concurrency tests
- An outbox pattern so expiry jobs can recover safely if the queue is temporarily unavailable
