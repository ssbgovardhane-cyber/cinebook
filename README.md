# CineBook — Full-stack movie ticket booking MVP

A mobile-first movie ticket booking prototype with an Express API and SQLite database. It is original demo branding inspired by common movie-ticket booking workflows; it does not copy BookMyShow branding.

## Included
- Movie listing, search, language filter, movie details
- Nagpur sample theatres and seeded showtimes
- Interactive seat selection (maximum 8 seats per booking)
- Server-side booking endpoint with SQLite uniqueness constraint to prevent the same seat being booked twice
- Booking confirmation screen with booking ID and illustrative QR-style placeholder
- Admin dashboard: add movies and shows; see recent demo bookings and totals
- Responsive layout

## Run locally
1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Set a secure admin key before running:
   - macOS/Linux: `ADMIN_KEY='a-long-random-secret' npm start`
   - Windows PowerShell: `$env:ADMIN_KEY='a-long-random-secret'; npm start`
4. Open `http://localhost:3000`.

The SQLite database is created as `cinebook.db` in the project folder. To use another path, set `DB_FILE`.

## Important before real business launch
This is an MVP starter, **not yet production-ready for real customer payments or real cinema inventory**.
- Payments are simulated; no money is collected. Integrate a payment provider such as Razorpay using server-side order creation, signature verification, webhook handling, refunds and reconciliation.
- Demo shows and theatres are seeded data. Obtain authorised cinema/showtime inventory integration or agreements before selling real tickets.
- The admin key is a simple MVP gate. Replace it with proper authentication, role-based access, rate limiting, audit logs, CSRF strategy where applicable, and secret management.
- Add verified email/phone flows, privacy policy, terms, cancellation/refund rules, customer support, tax/invoice handling and applicable Indian legal/compliance review.
- Configure persistent database storage and backups on hosting. SQLite may not suit a multi-instance production deployment; consider PostgreSQL.
- Use licensed movie posters and check image rights. Seed images use remote Unsplash URLs and can change.
- Add automated tests, monitoring, error tracking, accessibility checks, and a security review before launch.

## Main API
- `GET /api/movies?q=&language=`
- `GET /api/movies/:id`
- `GET /api/shows?movieId=&date=&city=Nagpur`
- `GET /api/shows/:id/seats`
- `POST /api/bookings`
- `GET /api/bookings/:id`
- `GET /api/admin/summary` (requires `x-admin-key`)
- `GET /api/admin/movies` (requires `x-admin-key`)
- `GET /api/admin/theatres` (requires `x-admin-key`)
- `POST /api/admin/movies` (requires `x-admin-key`)
- `POST /api/admin/shows` (requires `x-admin-key`)
