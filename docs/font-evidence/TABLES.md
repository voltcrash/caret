# Font byte measurements

Exact WOFF2 file bytes. The rendering-preserving candidate retains full faces; the original strict acceptance gate remains blocked. Core/extended columns are the **rejected**, pixel-changing split, not shipped downloads.

| Font | Original | Trial core | Trial extended | Trial total | Candidate full | Saved |
|---|---:|---:|---:|---:|---:|---:|
| 0xProto-Regular.woff2 | 56732 | 19228 | 42456 | 61684 | 55196 | 1536 |
| AdwaitaMono-Regular.woff2 | 361248 | 14864 | 353912 | 368776 | 357832 | 3416 |
| AtkinsonHyperlegible-Regular.woff2 | 23196 | 11508 | 17168 | 28676 | 23020 | 176 |
| Boon-Regular.woff2 | 52228 | 10900 | 40832 | 51732 | 46328 | 5900 |
| CascadiaMono-Regular.woff2 | 211268 | 20768 | 181188 | 201956 | 186908 | 24360 |
| Comfortaa-Regular.woff2 | 51212 | 9952 | 42028 | 51980 | 51212 | 0 |
| ComingSoon-Regular.woff2 | 21432 | 13616 | 11048 | 24664 | 21384 | 48 |
| CommitMono-Regular.woff2 | 39992 | 9824 | 25500 | 35324 | 39992 | 0 |
| FiraCode-Regular.woff2 | 103240 | 32852 | 80092 | 112944 | 101184 | 2056 |
| GallaudetRegular.woff2 | 30648 | — | — | — | 30648 | 0 |
| Geist-Medium.woff2 | 42132 | 15264 | 35292 | 50556 | 41272 | 860 |
| GeistMono-Medium.woff2 | 44108 | 19788 | 32016 | 51804 | 43212 | 896 |
| Hack-Regular.woff2 | 106236 | 15608 | 96892 | 112500 | 104140 | 2096 |
| IBMPlexMono-Regular.woff2 | 45640 | 12232 | 40032 | 52264 | 44528 | 1112 |
| IBMPlexSans-SemiBold.woff2 | 67060 | 15620 | 57472 | 73092 | 65608 | 1452 |
| Inconsolata-Regular.woff2 | 38772 | 12256 | 33940 | 46196 | 38028 | 744 |
| InterTight-Regular.woff2 | 99132 | 16760 | 90316 | 107076 | 98140 | 992 |
| Iosevka-Regular.woff2 | 1494892 | 42644 | 503436 | 546080 | 530748 | 964144 |
| Itim-Regular.woff2 | 100780 | 32624 | 79100 | 111724 | 100780 | 0 |
| JetBrainsMono-Regular.woff2 | 92164 | 26392 | 65520 | 91912 | 83772 | 8392 |
| Kanit-Regular.woff2 | 53656 | 15808 | 46420 | 62228 | 51728 | 1928 |
| Lalezar-Regular.woff2 | 85748 | 11360 | 72352 | 83712 | 76336 | 9412 |
| Lato-Regular.woff2 | 182708 | 22616 | 136780 | 159396 | 166064 | 16644 |
| LexendDeca-Regular.woff2 | 25888 | 8456 | 21108 | 29564 | 25888 | 0 |
| Mononoki-Regular.woff2 | 28860 | 6936 | 24404 | 31340 | 27056 | 1804 |
| Montserrat-Regular.woff2 | 86900 | 22996 | 71052 | 94048 | 81964 | 4936 |
| NotoNaskhArabic-Regular.woff2 | 71592 | 7228 | 65268 | 72496 | 71484 | 108 |
| NotoSansLao-Regular.woff2 | 23008 | 6792 | 18888 | 25680 | 22604 | 404 |
| Nunito-Bold.woff2 | 41676 | 9416 | 37424 | 46840 | 41676 | 0 |
| OpenDyslexic-Regular.woff2 | 117196 | 24084 | 100360 | 124444 | 112604 | 4592 |
| OverpassMono-Regular.woff2 | 97068 | 17764 | 91804 | 109568 | 96500 | 568 |
| Oxygen-Regular.woff2 | 19804 | 10632 | 15536 | 26168 | 19764 | 40 |
| Parkinsans-Regular.woff2 | 17740 | 8208 | 12780 | 20988 | 17648 | 92 |
| Roboto-Regular.woff2 | 50476 | 10476 | 43760 | 54236 | 50272 | 204 |
| RobotoMono-Regular.woff2 | 37632 | 7476 | 34484 | 41960 | 37632 | 0 |
| Sarabun-Bold.woff2 | 59236 | 13696 | 41328 | 55024 | 46708 | 12528 |
| SourceCodePro-Regular.woff2 | 76348 | 14140 | 64248 | 78388 | 70288 | 6060 |
| SpaceGrotesk-Regular.woff2 | 28560 | 10652 | 20532 | 31184 | 28436 | 124 |
| TitilliumWeb-Regular.woff2 | 18136 | 7380 | 11244 | 18624 | 18128 | 8 |
| Ubuntu-Regular.woff2 | 111604 | 24552 | 103960 | 128512 | 111328 | 276 |
| UbuntuMono-Regular.woff2 | 79680 | 20488 | 74972 | 95460 | 79624 | 56 |
| Vazirharf-NL-Regular.woff2 | 22196 | 1512 | 21632 | 23144 | 22116 | 80 |
| **Text total** | **4417824** | | | | **3339780** | **1078044 (24.40%)** |

Font Awesome: solid 119488, regular 19512, brands 115420 bytes: unchanged. Dependency-only v4compatibility appears in the source inventory but is not emitted by the build. System fonts are unshipped.

## Retained costs

Alternative file bytes below are measurements, not approved replacements. Compression is not additive across tables. The alternative deltas include its changed naming/compression, and do not pretend to isolate an individual SFNT table's compressed cost.

| Font | Candidate | Hint-off alternative | Layout-off alternative | 400-only axis alternative |
|---|---:|---:|---:|---:|
| 0xProto-Regular.woff2 | 55196 | 26984 | 45024 | — |
| AdwaitaMono-Regular.woff2 | 357832 | 238312 | 317804 | — |
| AtkinsonHyperlegible-Regular.woff2 | 23020 | 16080 | 18708 | — |
| Boon-Regular.woff2 | 46328 | 36416 | 40208 | — |
| CascadiaMono-Regular.woff2 | 186908 | 169652 | 133540 | 114064 |
| Comfortaa-Regular.woff2 | 51212 | 37288 | 31596 | — |
| ComingSoon-Regular.woff2 | 21384 | 21144 | 20328 | — |
| CommitMono-Regular.woff2 | 39992 | 38132 | 26476 | — |
| FiraCode-Regular.woff2 | 101184 | 74376 | 76676 | — |
| GallaudetRegular.woff2 | 30648 | 30648 | 30648 | — |
| Geist-Medium.woff2 | 41272 | 29000 | 31016 | — |
| GeistMono-Medium.woff2 | 43212 | 29248 | 30864 | — |
| Hack-Regular.woff2 | 104140 | 64728 | 103092 | — |
| IBMPlexMono-Regular.woff2 | 44528 | 30908 | 38716 | — |
| IBMPlexSans-SemiBold.woff2 | 65608 | 51612 | 40588 | — |
| Inconsolata-Regular.woff2 | 38028 | 26820 | 34056 | — |
| InterTight-Regular.woff2 | 98140 | 97940 | 71828 | — |
| Iosevka-Regular.woff2 | 530748 | 377472 | 310476 | — |
| Itim-Regular.woff2 | 100780 | 64068 | 81388 | — |
| JetBrainsMono-Regular.woff2 | 83772 | 58908 | 64492 | — |
| Kanit-Regular.woff2 | 51728 | 31304 | 46756 | — |
| Lalezar-Regular.woff2 | 76336 | 47660 | 53596 | — |
| Lato-Regular.woff2 | 166064 | 164868 | 87560 | — |
| LexendDeca-Regular.woff2 | 25888 | 25936 | 18824 | — |
| Mononoki-Regular.woff2 | 27056 | 27164 | 26500 | — |
| Montserrat-Regular.woff2 | 81964 | 64020 | 39340 | — |
| NotoNaskhArabic-Regular.woff2 | 71484 | 71568 | 55264 | — |
| NotoSansLao-Regular.woff2 | 22604 | 22612 | 17100 | — |
| Nunito-Bold.woff2 | 41676 | 41796 | 32320 | — |
| OpenDyslexic-Regular.woff2 | 112604 | 87160 | 91516 | — |
| OverpassMono-Regular.woff2 | 96500 | 69092 | 86316 | — |
| Oxygen-Regular.woff2 | 19764 | 12996 | 18516 | — |
| Parkinsans-Regular.woff2 | 17648 | 17672 | 13000 | — |
| Roboto-Regular.woff2 | 50272 | 36872 | 39624 | — |
| RobotoMono-Regular.woff2 | 37632 | 37588 | 37588 | — |
| Sarabun-Bold.woff2 | 46708 | 31496 | 38620 | — |
| SourceCodePro-Regular.woff2 | 70288 | 55732 | 62964 | — |
| SpaceGrotesk-Regular.woff2 | 28436 | 28432 | 16440 | — |
| TitilliumWeb-Regular.woff2 | 18128 | 18224 | 11336 | — |
| Ubuntu-Regular.woff2 | 111328 | 46656 | 99092 | — |
| UbuntuMono-Regular.woff2 | 79624 | 38664 | 78916 | — |
| Vazirharf-NL-Regular.woff2 | 22116 | 22116 | 13668 | — |

## Cold-cache font responses

Decoded body bytes below equal downloaded WOFF2 body bytes, not every font referenced in CSS. Full transfer and encoded-body values, per-file URLs, preload lists and rendered faces are in measurements.json and the route capture JSONs.

| Route/state | Before body | Candidate body | Saved | Rejected split body | Before transfer | After transfer |
|---|---:|---:|---:|---:|---:|---:|
| accents | 340136 | 340056 | 80 | 304836 | 341338 | 341258 |
| arabic-naskh | 389532 | 389424 | 108 | — | 390734 | 390626 |
| arabic | 340136 | 340056 | 80 | 291984 | 341338 | 341258 |
| cjk | 340136 | 340056 | 80 | 270352 | 341338 | 341258 |
| code | 421180 | 419124 | 2056 | 303204 | 422383 | 420327 |
| commands | 4619400 | 3541436 | 1077964 | 947996 | 4627383 | 3549418 |
| core-only | 37632 | 37632 | 0 | 7476 | 37815 | 37815 |
| default | 317940 | 317940 | 0 | 270352 | 318959 | 318959 |
| extended-only | 37632 | 37632 | 0 | 34484 | 37815 | 37815 |
| lao-noto | 340948 | 340544 | 404 | — | 342150 | 341746 |
| lao | 340948 | 340544 | 404 | 289240 | 342150 | 341746 |
| loader | 317940 | 317940 | 0 | 270352 | 318959 | 318959 |
| not-found | 317940 | 317940 | 0 | 270352 | 318959 | 318959 |
| privacy | 63520 | 63520 | 0 | 15932 | 63886 | 63886 |
| public | 317940 | 317940 | 0 | 270352 | 318959 | 318959 |
| result | 317940 | 317940 | 0 | 270352 | 318959 | 318959 |
| settings | 4619400 | 3541436 | 1077964 | 922760 | 4627383 | 3549418 |
| thai-boon | 370168 | 364268 | 5900 | — | 371370 | 365470 |
| thai | 340136 | 340056 | 80 | 270352 | 341338 | 341258 |

Preloads stay `/webfonts/RobotoMono-Regular.woff2` and `/webfonts/LexendDeca-Regular.woff2`, with original attributes. Preview URLs/fallback precedence and complete Font Awesome faces stay unchanged. The core-only/extended-only isolated cases intentionally still request the full Roboto Mono file: lazy split delivery was rejected.

## Exact pixel comparisons

Experiment-only comparisons run specimens, not every production route; not-run cases are explicit. The candidate before/after and repeated baseline comparisons cover every case.

| Comparison | Captured | Not run | Nonzero | Changed pixels | Max channel delta |
|---|---:|---:|---:|---:|---:|
| before-vs-after | 62 | 0 | 0 | 0 | 0 |
| before-vs-rejected-feature-trim | 1 | 61 | 1 | 232167 | 221 |
| before-vs-rejected-split | 57 | 5 | 43 | 5071571 | 221 |
| before-vs-repeat | 62 | 0 | 0 | 0 | 0 |
| before-vs-trial-axis | 1 | 61 | 0 | 0 | 0 |
| before-vs-trial-commit-keep | 1 | 61 | 1 | 232167 | 221 |
| before-vs-trial-no-layout | 45 | 17 | 40 | 13024211 | 221 |
| before-vs-trial-nohint | 45 | 17 | 44 | 7453558 | 221 |
