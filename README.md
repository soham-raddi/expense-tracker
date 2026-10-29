# Expense Tracker

An offline expense tracker for India. It reads bank transaction SMS on Android, will import
monthly statements, and sorts spending into categories. **Your data never leaves your phone.**

> Status: Phase 1 (foundation and SMS parsing). Supported banks: ICICI Bank.

## The no-network guarantee

- The **release build has no `INTERNET` permission**. `android/app/src/release/AndroidManifest.xml`
  removes it (and `ACCESS_NETWORK_STATE`) even if a library asks for it. Debug builds get it only
  so the app can load JavaScript from the Metro bundler on your computer.
- No analytics, crash reporting, ads, remote config, over-the-air updates, AI or LLM services.
- All categorization runs on the phone with plain rules.
- The code is open source so anyone can check this. Before every release, check the merged
  manifest with:

  ```
  cd android && ./gradlew :app:processReleaseManifest
  ```

  and look at `app/build/intermediates/merged_manifest/release/.../AndroidManifest.xml`.

No app is perfectly secure: a rooted or malware-infected phone can expose any app's data.

## Permissions and why

| Permission | Why | Build |
| --- | --- | --- |
| `READ_SMS` | Import bank SMS from the last 6 months on first run | all |
| `RECEIVE_SMS` | Record each new bank SMS within seconds | all |
| `WAKE_LOCK` | Keep the phone awake for the second it takes to save a new SMS | all |
| `INTERNET` | Load JS from Metro during development | **debug only** |

SMS permission is optional. Without it, the app still works through statement import and manual
entry (later phases). iOS never allows apps to read SMS.

## Security on the device

- Database encrypted with SQLCipher (op-sqlite). The 256-bit key is generated on the device
  (`SecureRandom`) and kept in Android Keystore via react-native-keychain.
- App lock: biometrics or device PIN on every open and every return to the app.
- `FLAG_SECURE`: app content is hidden in recent apps and screenshots are blocked. This is skipped
  only in debuggable (debug) builds so the UI can be screenshotted on the emulator; release builds
  are never debuggable, so it is always on there.
- Cloud backup and device transfer are disabled (`allowBackup="false"`, `data_extraction_rules.xml`).
- Account numbers are stored masked (`XX123`). OTP SMS are ignored entirely.
- `console.*` calls are stripped from release bundles; native code never logs SMS bodies.

## Setup

Requirements: Node 22+, **JDK 17**, Android Studio with an Android SDK and an emulator.

```
npm ci
npm test
npm run android    # with an emulator running
```

Test only on an **emulator** with synthetic SMS. To send a test SMS to the emulator, use the
emulator's Extended controls → Phone → SMS, with sender e.g. `VM-ICICIT` and a body from
`fixtures/sms/icici.json`.

## Project layout

```
index.js          app entry (registers the app and the background SMS task)
src/
  App.tsx         tab navigation and the lock gate
  config/         categories, seed rules, bank sender codes, SMS filters (edit these, not code)
  lib/            plain helpers shared everywhere: money/date formatting, change events
  data/           types, SQLite schema, encrypted DB, totals, repos/ (database queries)
  ingest/         SMS routing, OTP/promo filters, bank parsers (banks/), statement matching
  categorize/     the group-sorting chain: payee memory, keyword rules, income
  ui/             theme, components/ (reusable pieces), screens/ (one per screen)
native/android/   Kotlin modules: SMS inbox reader, live SMS receiver, secure random
fixtures/sms/     SYNTHETIC test SMS per bank
android/, ios/    the React Native platform projects (generated, lightly edited)
```

Tests live next to the code in `__tests__/` folders. `src/lib`, `src/categorize` and the
parsers import nothing from React Native, so they run anywhere (including a future web viewer).

## How an SMS becomes a transaction

1. The native receiver (or inbox scan) keeps only SMS whose sender code is in
   `src/config/banks.json` (`VM-ICICIT` → `ICICIT`).
2. `routeSms` (`src/ingest/registry.ts`) drops OTPs and anything that doesn't look like a money
   movement (promos), then calls that bank's parser.
3. Parsed → saved as a transaction (deduplicated by UPI ref). Not parsed → saved to the
   Unparsed list with the raw text. Nothing is silently dropped.

## Groups and auto-sorting

Every payment can be in one **group** (the spec's "categories"): Food & Dining, Friends / Splits,
or any group you create. A payment is placed by the first confident step of this chain
(`src/categorize/`):

1. **Payee memory.** You put a payment in a group with "same group for all payments to this
   payee" on, so every past and future payment to that payee follows.
2. **Keyword rules.** Words in the payee name, UPI ID or UPI note (`dominos`, `swiggy`, `chai`)
   map to a group. Built-in rules come from `src/config/seedRules.json` and `seedRulesV2.json`;
   rules you add in Settings win over them. Keywords of 3 letters or fewer must match a whole word.
3. **Income.** Money received that nothing else claimed goes to Income.

Anything left stays "Add to a group" and is shown for you to sort. Groups marked "exclude from
totals" (Transfers (self)) do not count towards spending. Contacts and heuristics (spec steps 2
and 6) are not built yet. There is no AI or network step.

## Adding a bank parser

1. Write `fixtures/sms/<bank>.json` with **synthetic** SMS: the bank's exact wording, but fake
   names, amounts, account digits and reference numbers. Never commit real SMS. Include each
   format (UPI debit/credit, card, NEFT/IMPS, ATM, autopay), plus an OTP and a promo SMS with
   `"expect": { "kind": "ignored" }`.
2. Add the bank's sender codes to `src/config/banks.json`.
3. Create `src/ingest/banks/<bank>.ts` implementing `BankSmsParser` (copy `icici.ts`: one regex
   per format).
4. Add it to `PARSERS` in `src/ingest/registry.ts`.
5. Run `npm test`. The fixture test picks up the new file automatically.

## Dependencies and network use

Every dependency is pinned to an exact version. Checked for network code:

| Package | Network code? |
| --- | --- |
| `@op-engineering/op-sqlite` | No (its optional libsql remote mode is not enabled) |
| `react-native-keychain` | No |
| `react-native-biometrics` | No |
| `react-native-safe-area-context` | No |
| `babel-plugin-transform-remove-console` | Build-time only |
