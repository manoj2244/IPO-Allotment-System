# IPO Form Entry System (Internal)

Internal full-stack IPO form entry, allotment, refund, and reporting system for banks/capital companies in Nepal.

> This project is for internal operations only (not public IPO application like MeroShare).

## Tech

- Backend: NestJS + Prisma + MSSQL
- Frontend: React + TypeScript + Ant Design + React Hook Form
- Excel: `xlsx` (import) + `exceljs` (export)
- Email: Nodemailer
- Auth: JWT + Role-based access (Admin/Staff)

## Workspace Structure

- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) – complete system design doc
- [server](server) – API, Prisma models, auth, modules
- [client](client) – Ant Design internal operations UI

## Environment Setup

### Server env

Copy [server/.env.example](server/.env.example) to `.env` and update values.

Main DB target in this implementation:

- Host: `124.41.228.174`
- Port: `1433`
- Database: `IPO`
- User: `sa`

### Client env

Copy [client/.env.example](client/.env.example) to `.env`.

## Yarn-based Install

From [server](server):

- `yarn install`
- `yarn prisma:generate`
- `yarn prisma:migrate`
- `yarn prisma:seed`
- `yarn start:dev`

From [client](client):

- `yarn install`
- `yarn dev`

## Seed Login

- Admin: `admin@ipo.local` / `Pass@123`
- Staff: `staff@ipo.local` / `Pass@123`

## Implemented Modules

- Auth/Login (JWT)
- User management (Admin)
- IPO setup (Admin)
- Active IPO dashboard (Staff/Admin)
- Manual entry with validation
- Excel bulk entry upload with failed row reporting
- Entry listing + export to Excel
- BOID verification with cache + fallback behavior
- Allotment upload with BOID/name matching
- Refund report + Excel export
- Allotment email send workflow

## Notes

- `panNo` is currently used as email destination when sending emails (for operational convenience).
- BOID verification endpoint is configurable by `BOID_API_BASE_URL`.