# Marketing vs app entry on `/`

| Host | `/` |
| --- | --- |
| `app.*` | App entry (login / signup focus, same brand as marketing) |
| Other | Full marketing landing |

**Env:** `APP_ENTRY_HOSTS` (comma-separated). Optional `NEXT_PUBLIC_MARKETING_SITE_URL` overrides where **SairexSMS brand logos** link (defaults to `https://sairex-sms.com` so `app.*` users return to marketing).

**Nginx:** Proxy both hostnames to Next.js with `Host $host` preserved.
