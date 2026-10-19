# English-first localisation

All shared interface messages live in `packages/i18n/src/catalogue.ts`, an equivalent typed catalogue for en-NG namespaces: common, legal, nav, auth, status, category, priority, cad, citizen, responder, assurance, simulation and accessibility. i18next/react-i18next is initialised once for en-NG in each frontend, through LocaleProvider. Next.js interactive surfaces are client components; document metadata/lang are set in the root layout. Both PWA manifests identify en-NG.

Use `t('namespace.key',{name,count})` for labels, validation, aria text and plural parameters. Do not concatenate fragments or translate reference IDs, hashes, SQL enums, fixture identifiers or API fields. Fixture narratives and public landmark names are synthetic data, not interface copy. Dates and numbers use Intl with UTC persistence and Africa/Lagos display by default; labels distinguish server UTC from unverified client time.

Tests cover domain-state inventory, interpolation and singular/plural output. Browser tests verify document language and role message rendering. A missing key emits a safe diagnostic and a generic English error rather than leaking an internal key to citizens. Catalogue coverage checks must fail before release when a static key is absent.

To add a future locale, obtain professionally reviewed complete Yoruba (`yo-NG`) or explicitly identified Nigerian Pidgin messages, especially legal/emergency wording. Add an entire catalogue matching the English key inventory, validate interpolation placeholders/plural rules and run the long-string/responsive/keyboard/browser suite. Only then register it in i18next and offer a selector. No half-translated or machine-invented emergency/legal wording is shipped.
