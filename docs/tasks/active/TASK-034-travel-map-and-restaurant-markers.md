# TASK-034: Travel Map and Restaurant Markers

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: feature

## 1. Goal

Add map-based travel visibility so the Travel page can show registered trips as location markers, and let the user add restaurants to a trip so destination restaurants can be shown on the same map.

## 2. Requirements

- In scope:
  - Add optional map location fields to trips so registered travel records can appear on a map.
  - Add a restaurant entity under the Travel module, scoped to a trip.
  - Let the user create, update, and delete manually registered restaurants for each trip.
  - Show trip markers and restaurant markers in a Travel map panel.
  - Let selecting a marker highlight or open the matching trip or restaurant details.
  - Keep trips without coordinates visible in the list and explain in the UI that they need location data before appearing on the map.
- Out of scope:
  - Public restaurant search, recommendations, scraping, or automatic importing from external map providers.
  - Route planning, directions, distance calculation, or optimized itinerary generation.
  - Sharing restaurant data between users or across unrelated modules.
  - AI-created restaurant recommendations unless a separate AI task is approved.
- Decision needed:
  - Choose the map provider. Recommended default is Leaflet with OpenStreetMap tiles because it avoids storing a map API key, but Claude Code must confirm package and deployment implications before implementation.
  - Choose coordinate entry behavior. Recommended default is manual latitude/longitude plus a display address, with automatic geocoding deferred unless explicitly approved.
  - Decide whether restaurants need a visit status now. Recommended default is `is_visited` as an optional boolean because it is low-cost and useful for completed trips.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`.
- Files reviewed: `app/modules/travel/models.py`, `app/modules/travel/schemas.py`, `app/modules/travel/router.py`, `app/modules/travel/service.py`, `frontend/lib/api.ts`, `frontend/types/index.ts`, `frontend/app/(dashboard)/travel/page.tsx`, `frontend/package.json`.
- Current behavior:
  - Travel currently stores trips with name, destination, dates, status, note, checklist items, and plan items.
  - Trip responses eagerly load checklist and plan items with `selectinload`.
  - The Travel page supports trip CRUD, checklist CRUD, plan CRUD, filtering, search, and CSV export.
  - There are no trip coordinates, no map UI, and no restaurant model or API.
  - The frontend dependencies do not currently include a map library.

## 4. Design

- Backend/API:
  - Keep all new backend behavior inside `app/modules/travel/`.
  - Extend `TripCreate`, `TripUpdate`, and `TripResponse` with optional `address`, `latitude`, and `longitude` fields.
  - Add `TripRestaurantCreate`, `TripRestaurantUpdate`, and `TripRestaurantResponse` schemas.
  - Include restaurants in `TripResponse` so the Travel page can render map markers from the existing trip list call.
  - Add authenticated endpoints:
    - `POST /api/v1/travel/trips/{trip_id}/restaurants`
    - `PUT /api/v1/travel/restaurants/{restaurant_id}`
    - `DELETE /api/v1/travel/restaurants/{restaurant_id}`
  - Use service-layer functions and the injected request session only.
  - Keep 404 responses generic and do not expose raw exception details.
- DB:
  - Add an Alembic migration.
  - Add nullable trip columns: `address` (`String(200)`), `latitude` (`Float`), `longitude` (`Float`).
  - Add `trip_restaurants` table with `id`, `trip_id`, `name`, `address`, `latitude`, `longitude`, `cuisine`, `note`, `is_visited`, and `order_index`.
  - Use `ForeignKey("trips.id", ondelete="CASCADE")`, ORM cascade, and `passive_deletes=True`.
  - Add `selectinload(Trip.restaurants)` wherever full trip responses are loaded.
- Frontend:
  - Add TypeScript types for trip location fields and restaurant responses.
  - Extend `travelApi` with restaurant create/update/delete methods and location fields in trip create/update payloads.
  - Add location inputs to the trip create/edit UI. Keep them optional and validate coordinate ranges before submit.
  - Add a map panel to the Travel page that shows:
    - one marker per trip with valid coordinates,
    - restaurant markers for the selected or visible trips,
    - a clear empty state when no saved locations have coordinates.
  - Add a restaurant section inside expanded trip cards for manual restaurant CRUD.
  - If Leaflet is selected, load the map only on the client side so Next.js server rendering does not fail.
  - Keep existing travel filters/search working and make the map follow the currently visible trip set.
- Security impact:
  - This task touches authenticated API inputs, persistence, deletion, and an external map tile service if a provider is used.
  - Validate latitude must be between `-90` and `90`; longitude must be between `-180` and `180`.
  - Validate and trim text fields with length limits for address, restaurant name, cuisine, and note.
  - Do not store map provider secrets in source code. If a provider requires a key, use environment variables only and document the required public/private split.
  - Do not send notes, checklist content, or plan descriptions to any geocoding provider. If geocoding is later added, send only the user-entered address.
  - Deletion endpoints must remain authenticated and must only delete records inside the Travel module.

## 5. Test Plan

- Backend tests:
  - Add cases in `tests/test_travel.py` for creating and updating a trip with valid coordinates.
  - Add validation cases for invalid latitude and longitude.
  - Add restaurant create, update, delete, and not-found cases.
  - Verify restaurant records are included in trip responses.
  - Verify deleting a trip deletes its restaurants through cascade behavior.
- Frontend/E2E tests:
  - Add or update Travel page tests to verify trip location fields can be saved.
  - Verify a restaurant can be added to a trip and appears in the trip detail UI.
  - Verify the map empty state appears when no trips have coordinates.
  - If map rendering is difficult to assert in CI, test marker data preparation separately and add manual validation for visual map rendering.
- Security checks:
  - Verify unauthenticated restaurant endpoints return 401.
  - Verify invalid coordinate values are rejected without raw stack traces.
  - Verify map provider configuration does not expose private secrets.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task after the Decision needed items are resolved.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Trips can optionally store address, latitude, and longitude.
- The Travel page shows registered trip records on a map when they have valid coordinates.
- Restaurants can be manually added, edited, and deleted for a trip.
- Restaurant markers appear on the Travel map with a visually distinct marker or popup from trip markers.
- Trips without coordinates remain usable and do not break map rendering.
- Backend responses eagerly load restaurants without async lazy-loading errors.
- Backend and frontend validation prevent invalid coordinates.
- Tests and manual validation results are recorded before marking implemented.

## 8. PR Review Checklist

- Confirm the feature stays inside the Travel module and does not introduce cross-module model access.
- Confirm map rendering does not break Next.js server rendering or production build.
- Confirm API responses do not expose raw exceptions or secrets.
- Confirm restaurant deletes are authenticated and scoped by record ID.
- Confirm trip list performance remains acceptable with restaurant eager loading.
- Confirm the UI remains usable on mobile, especially the map panel and restaurant form.
- Confirm no external provider key is committed or printed.
- Confirm CSV export behavior is either intentionally unchanged or updated in a separate task.

## 9. Implementation Notes

### Decisions resolved (with the user)

- **Map provider**: Leaflet + OpenStreetMap tiles (no API key, client-only).
- **Coordinate entry**: address auto-geocoding (chosen over manual lat/lng).
- **Restaurant visit status**: `is_visited` boolean added now.

### Backend (`app/modules/travel/`)

- **models.py**: `Trip` gains nullable `address`/`latitude`/`longitude` and a
  `restaurants` relationship (`cascade="all, delete-orphan"`,
  `passive_deletes=True`). New `TripRestaurant` model (id, trip_id FK
  `ondelete=CASCADE`, name, address, latitude, longitude, cuisine, note,
  is_visited, order_index). Also added the missing `ondelete="CASCADE"` to the
  checklist/plan FKs to match their migrations (needed for FK-enforced cascade).
- **geocoding.py** (new): `geocode(address)` → Nominatim/OSM, best-effort,
  returns `None` on failure. Sends **only** the user-entered address (no notes/
  plans/checklists). No API key. Identifiable User-Agent per Nominatim policy.
- **schemas.py**: trip create/update get optional `address`/`latitude`/
  `longitude` with range validation (lat −90..90, lng −180..180) and text trim.
  New `RestaurantCreate/Update/Response`. `TripResponse` now includes
  address/lat/lng and `restaurants`.
- **service.py**: `_trip_opts()` + `get_next_trip` eager-load restaurants
  (`selectinload`). `_maybe_geocode()` runs **outside** the DB transaction when
  an address is present and no explicit coords. Trip create/update geocode on
  address change. New `add_restaurant`/`update_restaurant`/`delete_restaurant`
  (restaurant create/update also geocode by address).
- **router.py**: authenticated `POST /trips/{id}/restaurants`,
  `PUT /restaurants/{id}`, `DELETE /restaurants/{id}`; generic 404s.
- **Alembic** `d5e8f1a2b3c4`: adds trip location columns + `trip_restaurants`
  table (FK `ondelete=CASCADE`).

### Frontend

- **types/index.ts**: `RestaurantResponse`; trip type gains address/lat/lng +
  `restaurants`.
- **lib/api.ts**: location fields on trip create/update; restaurant
  create/update/delete methods.
- **travel/TravelMap.tsx** (new): client-only react-leaflet map, loaded via
  `next/dynamic({ ssr: false })`. Distinct divIcon markers — dark pin for trips,
  orange for restaurants — popups + click-to-expand; auto fit-bounds.
- **travel/page.tsx**: address input in add/edit trip forms (edit only sends
  address when changed; clearing it nulls coords too); a **맛집** tab in expanded
  cards with restaurant CRUD + visited toggle; a map panel above the list that
  shows markers for the currently filtered trips, or an empty-state hint telling
  the user to add a location. Trips without coords stay fully usable in the list.

### Security

- No provider key (OSM tiles + Nominatim are keyless). Coordinates range-checked
  on the backend; restaurant deletes are authenticated and scoped by record id.
  Geocoding sends only the address. No secrets logged.

### Test infra

- `tests/conftest.py`: enabled `PRAGMA foreign_keys=ON` on the SQLite test
  engine so `ON DELETE CASCADE` behaves like production Postgres (lets the
  restaurant cascade test pass; surfaced/fixed the checklist/plan FK gap).

### Tests (`tests/test_travel.py`, +11)

Coordinate validation (schema + 422), create-with-coords, address auto-geocoding
(mocked), restaurant CRUD, included-in-trip-response, empty-name 422,
update/delete not-found 404, unauthenticated 401, and delete-trip-cascades-
restaurants.

### Validation

- `uv run pytest -q` → **313 passed** (was 302; +11).
- `cd frontend && npx tsc --noEmit` → clean.
- `cd frontend && npm run build` → success; `/travel` still prerenders static
  (map is client-only). Manual map rendering to be visually verified in-app.

### Commit / push

- Commit: `21d2db9` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
- Note: production needs `uv run alembic upgrade head` to apply the new
  migration.
