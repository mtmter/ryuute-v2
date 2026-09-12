## 1. Provider Contract

- [ ] 1.1 Add provider-neutral request/result types and error categories, and verify focused backend unit tests cover their validation.
- [ ] 1.2 Refactor Mock and Ekispert providers to return common routes, and verify fixture-based tests make no network calls.

## 2. Transit and Google Providers

- [ ] 2.1 Implement the Transit `/api/v1/plan` client, service-day time conversion and response validation, and verify fixture tests cover arrival search, after-midnight values, missing routes, 429, timeout and invalid JSON.
- [ ] 2.2 Convert the existing Google Routes code into a registered provider supporting TRANSIT and WALK, and verify existing and new Google fixtures cover both modes.
- [ ] 2.3 Implement auto provider ordering, Japan coordinate classification, bounded Transit retry and fallback error rules, and verify orchestration tests cover domestic, overseas, missing-coordinate and all-provider-failure cases.

## 3. Application Contract

- [ ] 3.1 Extend FastAPI response validation with provider metadata while preserving `POST /api/route-search`, and verify endpoint tests cover success and mapped errors.
- [ ] 3.2 Display provider, route kind, fallback and notices in route results and saved travel plans, and verify frontend component tests cover Transit and Google WALK states.
- [ ] 3.3 Preserve provider metadata in Firestore travel plans with legacy defaults, and verify service tests cover new and old documents.

## 4. Operations and Verification

- [ ] 4.1 Update backend environment examples, README, architecture, provider and deployment docs, and verify every documented variable matches runtime lookup.
- [ ] 4.2 Add opt-in live smoke scripts excluded from default tests, and verify default backend tests pass with outbound network disabled.
- [ ] 4.3 Run backend unit tests plus frontend lint/build and verify the route search and registration flow has no regressions.
