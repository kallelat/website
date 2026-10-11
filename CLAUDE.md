# TAF Games website

Static site for tfagames.tech: the studio logo and a privacy policy, in every language the games support.
The games live in `../games`; the logo comes from `../games/packages/brand/assets`.

## Layout

```
build.mjs                 # generates dist/ from src/ (no dependencies)
src/site.json             # studio, company, address, email, policy date (YYYY-MM-DD) shared by all languages
src/locales/<lang>.json   # texts per language; the file name is the URL path (/de/, /es-419/, …)
src/site.css, src/assets/ # styles and logos (light and dark)
nginx/dev.conf            # HTTP only, for local testing
nginx/prod.conf           # HTTPS for tfagames.tech, www and HTTP redirect to it
nginx/snippets/           # shared http settings, security headers, site locations, language map
fetch-certs.sh            # Let's Encrypt cert via acme.sh + Hetzner Cloud DNS, into ./certs
```

Pages: `/<lang>/` (logo) and `/<lang>/privacy/` (policy). `/` redirects (302) to the visitor's language using the
first entry of `Accept-Language` (`nginx/snippets/language.conf`); unknown languages get `en`.

## Rules

- Every locale must have the same keys and the same number of policy sections as `en.json`; the build fails otherwise.
- Adding a language: add `src/locales/<lang>.json` and a mapping in `nginx/snippets/language.conf`. The build
  fails if the two are out of sync.
- Keep the policy true to what the games and this server do. The nginx log format leaves out IP addresses
  and user agents because the policy says so.
- Keep the page free of scripts and inline styles; the Content-Security-Policy blocks them.
- Pin the Docker base images to exact versions.

## Commands

```bash
node build.mjs                                          # build dist/ (warns while site.json has placeholders)
docker compose -f docker-compose.dev.yml up -d --build  # dev: http://localhost:8080
docker compose up -d --build                            # prod: needs ./certs first
./fetch-certs.sh                                        # issue/renew cert (set HETZNER_TOKEN in the script)
```

Certificates: install acme.sh once (`curl https://get.acme.sh | sh`), set `HETZNER_TOKEN` in `fetch-certs.sh`
(Hetzner Cloud Console → project → Security → API Tokens) and run it. `./certs` is mounted into the container, so
after a renewal reload nginx: `docker compose exec tafgames-website nginx -s reload`.
