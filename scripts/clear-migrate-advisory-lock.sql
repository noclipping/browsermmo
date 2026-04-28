-- Kill other Postgres sessions that hold a granted advisory lock (Prisma Migrate uses one).
-- Use when `prisma migrate dev` fails with P1002 / pg_advisory_lock timeout.
-- Do not run while a migration you care about is actively applying.
SELECT pg_terminate_backend(l.pid)
FROM pg_locks l
WHERE l.locktype = 'advisory'
  AND l.granted = true
  AND l.pid <> pg_backend_pid();
