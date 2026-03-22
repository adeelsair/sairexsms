# Marketing vs app entry on `/`

| Host | `/` |
| --- | --- |
| `app.*` | App entry (login / signup focus, same brand as marketing) |
| Other | Full marketing landing |

**Env:** `APP_ENTRY_HOSTS` (comma-separated), optional `NEXT_PUBLIC_MARKETING_SITE_URL` for a “Website” link on the app navbar.

**Nginx:** Proxy both hostnames to Next.js with `Host $host` preserved.
