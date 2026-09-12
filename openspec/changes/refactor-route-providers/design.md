## Context

`search_route` currently obtains an Ekispert-shaped payload from a registry and always applies `convert_ekispert_route`. Google Routes request and conversion code exists in `routes_service.py` but is not registered. FastAPI and the frontend consume one common route object.

## Goals / Non-Goals

**Goals:**

- Make each external integration independently convertible and testable.
- Preserve the single `POST /api/route-search` application endpoint.
- Keep fallback policy separate from vendor request code.

**Non-Goals:**

- Returning multiple route alternatives or exposing vendor payloads.
- Depending on live external services in the normal test suite.

## Decisions

1. Introduce a provider-neutral request value carrying labels, addresses, coordinates and timezone-aware desired arrival. Each Provider exposes `search(request) -> common route`; conversion belongs beside its HTTP client. This replaces the current raw-payload registry while retaining small functions rather than adding a framework.
2. Keep orchestration in `routes_service.py`. `ROUTE_PROVIDER_MODE=auto` builds a candidate sequence from endpoint coordinates: both endpoints in the Japan bounding region use Transit then Google WALK; other coordinate pairs use Google TRANSIT then Google WALK. Missing coordinates use Google TRANSIT then WALK because Transit accepts station IDs or geo endpoints, not arbitrary addresses.
3. Classify errors as invalid input, unavailable/not configured, no route, transient upstream, and invalid upstream response. Auto mode advances only for unsupported/no-route/transient failures; explicit mode reports the selected provider failure.
4. Call Transit through the backend despite public CORS so timeout, conversion, fallback, attribution and future endpoint changes remain centralized. Convert service-date seconds, including values outside 0-86400, in the response timezone before serializing local app datetimes.
5. Adapt existing Google code to accept `TRANSIT` or `WALK`. For Japan fallback call WALK directly. Reuse the current segment synthesis for walking steps.
6. Make mock return a static common route. Retain the Ekispert fixture only for Ekispert converter tests.
7. Extend common and persisted routes with `provider`, `route_kind`, `is_fallback`, and `notices`. Old persisted routes are displayed with legacy defaults rather than migrated.
8. Use one short Transit retry only for timeout, 429 and 5xx within the endpoint time budget; do not retry validation, 404 or 422 responses.

## Risks / Trade-offs

- [Transit is unofficial and can change without notice] -> Validate every response, show attribution, isolate its converter, and fallback to Google walking.
- [Bounding-box classification can misclassify remote coordinates] -> Treat it only as ordering; provider errors still follow the fallback chain.
- [Fallback may increase latency and Google cost] -> Bound provider timeout/retry and make the attempted chain visible in logs without exposing credentials.
- [Old travel plans lack metadata] -> Apply non-destructive legacy display defaults.

## Migration Plan

1. Add common provider types and independent converter fixtures while preserving the current endpoint.
2. Register Transit and Google, then switch the default from `mock` to `auto` only after unit tests pass.
3. Deploy required Google server key and mode settings; rollback by setting `ROUTE_PROVIDER_MODE=mock`.
4. Remove no stored routes and retain explicit `ekispert` mode.
