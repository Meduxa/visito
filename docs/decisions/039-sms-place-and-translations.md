# 039 — SMS name the salon; English/Russian branch and position names

**Context.** The test salon run (2026-11-25/26, `docs/test-plan.md` #16, #17, #24, #25) showed that automatic SMS came from "Visito" with only a date and time — a client of a three-branch salon could not tell who wrote or where to go — and that the booking page in English/Russian still showed branch names, addresses and staff positions in Georgian.

**Decision.**
- Automatic SMS start with a new variable `{place}`: the business name, plus `, <branch>` when the business has more than one active branch. Texts are kept to one SMS (70 Unicode characters) for a typical name; very long names can make them two parts. The review SMS has no name and a shorter link (16-byte token, 22 characters) so it is always one SMS.
- Branches (`locations.translations`) and staff (`staff.translations`) get an optional JSON object `{"en": {...}, "ru": {...}}` (branch: name, address; staff: position). Georgian stays in the normal columns and is the fallback. Business name, service names (already translated) and staff names are not touched.

**Consequence.** Existing review links (32 characters) keep working. The SMS texts can still be changed by the Visito team in /admin/sms-texts; `{place}` is available there.
