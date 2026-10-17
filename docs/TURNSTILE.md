# Turnstile

All captcha flows use Cloudflare Turnstile: signup, user reports, quote submissions,
and quote reports. Requests send the token in the `captcha` field.

## Configuration

Create separate managed widgets for staging and production in
[Cloudflare](https://developers.cloudflare.com/turnstile/get-started/widget-management/).
Allow the **frontend** hostname, then set:

- Backend private `TURNSTILE_SECRET_KEY`; `FRONTEND_URL` must match the frontend.
- Frontend build `TURNSTILE_SITE_KEY` (public).

Staging allows `localhost` and `oxytype-api-staging.voltcrash.workers.dev` for the
hosted frontend. Production should allow only its deployed frontend hostname.
Keys must belong to the same widget.
See [staging setup](STAGING_SETUP.md) for ignored files and deployment commands.

Local development uses the official [test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/):

```dotenv
# frontend/.dev.vars; MODE=dev only
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# frontend/.env.local; dev defaults to this if omitted
TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

Production-mode Workers reject all three official dummy secrets. Local validation
still calls Cloudflare; it accepts only the dummy token with a successful response.
The example keys always pass and provide no protection for deployed environments.

## Verification and lifecycle

Tokens must be nonempty and at most 2048 characters. The worker calls
[Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
with a 10-second deadline, requires boolean success, and matches `FRONTEND_URL`'s
hostname plus the expected action: `signup`, `user-report`, `quote-submit`, or
`quote-report`. Missing keys, unavailable verification, mismatched metadata and
expired/replayed tokens fail closed. Dummy response metadata is exempt only with
an official test secret in `MODE=dev`.

Cloudflare tokens expire after five minutes and can be redeemed once. Each Solid
component owns its widget, renders after the asynchronous script's `load` event
(or immediately when the API is already loaded), clears tokens on expiry,
timeout/error, and removes its widget when the modal closes. After each submitted
request, forms clear the spent token and reset the widget for retry. Signup retains
its onboarding session after verification failure.

Do not call `turnstile.ready()` with an asynchronous script: Cloudflare rejects
that combination before rendering. The shared script's load event provides
readiness for [explicit rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).

Allow `https://challenges.cloudflare.com` in `script-src` and `frame-src` when
adding a [CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).
Load the provider script directly, without proxying or caching it.
