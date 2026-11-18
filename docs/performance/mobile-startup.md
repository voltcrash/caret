# Cold mobile startup to the first correct letter

Fresh guests on the production Worker build reached their first correct letter in a median 2,245 ms over HTTP/2, down from 2,375 ms on `54102fc32`. Over HTTP/1.1 the median fell from 3,184 ms to 2,629 ms.

| Transport | Before, ms (navigation order) | After, ms (navigation order) |
| --- | --- | --- |
| HTTP/2 | 2869, 2375, 2462, 2571, 2352, 2336, 2346, 2367, 2728 | 2421, 2243, 2228, 2396, 2285, 2238, 2204, 2245, 3612 |
| HTTP/1.1 | 3210, 3131, 3196, 3158, 3181, 3164, 3184, 3184, 3619 | 2695, 2629, 2640, 2620, 2633, 2583, 2623, 2574, 2982 |

Each of the 36 runs tapped the first live letter, checked textarea focus, inserted the character shown in the server preview once, and verified exactly one correct letter at the start of the active word. A DOM observer recorded acceptance relative to navigation start. The slowest HTTP/2 run increased from 2,869 to 3,612 ms. This sample supports a median improvement only.

## Profile

Playwright Pixel 5 emulation on Apple silicon, Chromium 158.0.8127.18, 393 × 727 CSS pixels, DPR 2.75, touch, 4× CPU slowdown, 100 ms network latency, 4 Mbit/s down and 1 Mbit/s up. Each run used a fresh guest context with default preferences, disabled HTTP cache and blocked service workers. The benchmark uses browser text insertion after a touch gesture. Physical keyboard presentation time is outside the measurement.

Both revisions used the local production Start Worker fixture. HTTP/1.1 connected directly. HTTP/2 used a local TLS reverse proxy forwarding the Worker's compressed responses. Resource Timing confirmed the negotiated protocol. Nine pairs ran per protocol on the same host, alternating which revision went first.

## Blocking work

- On the baseline HTTP/1.1 trace, the page module started around 1.3 s and its dependency requests continued past 2.7 s. Grouping the static entry graph and platform dependencies cut the median number of completed JS requests before acceptance from 110 to 53 on HTTP/1.1 and from 112 to 55 on HTTP/2.
- Baseline hydration fetched a second copy of the inlined global CSS (24,629 encoded bytes). The changed build made zero application stylesheet requests before acceptance.
- The server preview previously emitted hydration identifiers for 60 words and 256 letters in the default paragraph. Solid now keeps that read-only subtree until the live typing component replaces it. The CPU profile also showed locale week-start initialization during module evaluation. The account calendar now performs that work when used.

## Reproduce on the local HTTP/1.1 fixture

This command measures one revision over HTTP/1.1. For the paired comparison, separate local ports served the two builds. A single Playwright worker alternated baseline-first and candidate-first pairs. Each HTTP/2 port forwarded to its corresponding Worker through a Node TLS HTTP/2 reverse proxy. The JSON reporter retains each acceptance timestamp and request waterfall.

```sh
vp run build
vp -C frontend exec playwright test --config playwright.migration.config.ts mobile-startup.migration.ts --repeat-each=9 --workers=1 --reporter=json > /tmp/mobile-startup.json
```
