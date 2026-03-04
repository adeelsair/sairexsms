# Security Notes

- `npm audit` reports 8 moderate vulnerabilities via Prisma dev tooling.
- Fix available only with `npm audit fix --force`, which would downgrade Prisma to `6.19.2` and is a breaking change.
- Revisit when ready to evaluate the downgrade or when Prisma updates upstream deps.
