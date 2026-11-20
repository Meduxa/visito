# 035 — Legal documents written for Visito

**Context.** Visito had placeholder legal pages marked "draft". Levan has no lawyer yet and asked for complete documents in Georgian and English, based on how Visito really works, using Visage's published documents only as a reference for structure (2026-11-14).

**Decision.**
- Four documents, version 2026-11-14: **Terms of Service**, **Privacy Policy**, **Data Processing Agreement** (the business is the controller, Visito the processor; accepted together with the Terms, no separate signature) and **Payments, Automatic Renewal and Refunds**.
- One source of truth: `docs/legal/visito-legal.{ka,en}.json`. It feeds the website (`messages/*.json → legal`, rendered at `/legal/{terms,privacy,dpa,payments}` with paragraphs and lists) and the PDFs (`node scripts/legal-pdf.mjs` → `docs/legal/pdf/`, FiraGO, no logo).
- The texts describe the real app: Georgian Law on Personal Data Protection, EU storage, the actual sub-processors (Supabase, Netlify, Resend, TNET, Flitt, Sentry when on, GitHub encrypted interim backups), hashed codes/phones/IPs, 14-day business deletion, 30-day backup overwrite, support access with owner consent, dental treatment notes, necessary cookies only.
- Provider named as "an individual entrepreneur registered in Georgia"; full details only on invoices and on request (Levan chose not to publish them). Contact: `info@visito.ge`.
- Russian pages show the English text with a note until a Russian version is written. The sign-up text now links all three: Terms, Privacy Policy, DPA. The "draft" banner is removed.

**Consequences.**
- `info@visito.ge` must receive mail before these pages are published (a mailbox or a forwarding address).
- A Georgian lawyer should review the documents when possible, especially liability, refunds, health data and the interim backups outside the EU.
- Acceptance is not yet recorded per version (who, when, which version); worth adding before real sign-ups.
- When providers or retention change, update both JSON files, run the PDF script and bump the version.
