# 022 — FiraGO as the one font

**Context.** Since the design foundation (decision 004) the app used Inter for Latin + Cyrillic and Noto Sans Georgian for Georgian, loaded from Google Fonts. Mixed text (a Georgian sentence with "Instagram" or a name in Latin) used two different designs side by side. Levan compared both on real screens (2026-11-08) and chose FiraGO.

**Decision.**
- FiraGO (bBoxType, SIL Open Font License 1.1, no reserved font name) for all text and headings: one family for Georgian (Mkhedruli + Mtavruli), Latin and Cyrillic, weights 400/500/600/700.
- Self-hosted with `next/font/local` from `src/app/fonts/` (license in `FiraGO-OFL.txt`), no request to Google. The files are trimmed to the alphabets we use (Latin incl. Latin-1/Extended-A, Cyrillic, Georgian, punctuation, currency incl. ₾, arrows): about 77 KB per weight instead of about 250 KB.
- Upstream: `github.com/bBoxType/FiraGO`, `Fonts/FiraGO_WEB_1001/Roman/`. To add a weight or alphabet, take the original file from there and trim it again with the same character list.

**Consequences.** FiraGO is a little narrower than Noto Sans Georgian, so text takes less width; nothing relied on fixed widths. A letter outside the trimmed set (e.g. Greek) falls back to the system font. Landing screenshots should be retaken (`npm.cmd run landing:shots`).
