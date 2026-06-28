# TASK-036: Travel Persistent Map and Map-First Restaurant Add

status: working
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Make the Travel map a persistent workspace, not a temporary picker. Users should always be able to see the map, jump the map to a selected trip destination, and add a restaurant directly by clicking a point on the map.

## 2. Requirements

- In scope:
  - Keep the main Travel map visible as a stable top-level panel while the user browses trips.
  - Add a clear action on each trip, such as "show on map", that moves/zooms the map to that trip's saved coordinates.
  - When a trip has no saved coordinates, guide the user to set the trip location before trying to jump to it.
  - Add a restaurant-add mode from the map for a selected trip.
  - In restaurant-add mode, clicking the map should open an inline form or compact modal prefilled with the clicked latitude and longitude.
  - The user must confirm the restaurant name/details before the restaurant is saved.
  - After saving, the new restaurant marker should appear immediately on the persistent map.
  - Preserve the existing trip and restaurant location picker flows from `TASK-035`.
- Out of scope:
  - Public restaurant search, third-party place lookup, scraping, or recommendations.
  - Reverse geocoding clicked coordinates into an address.
  - Route planning, directions, travel time, or distance calculation.
  - New map provider selection.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`.
- Files reviewed: `docs/tasks/active/TASK-034-travel-map-and-restaurant-markers.md`, `docs/tasks/active/TASK-035-travel-map-location-picker.md`, `frontend/app/(dashboard)/travel/TravelMap.tsx`, `frontend/app/(dashboard)/travel/page.tsx`, `frontend/lib/api.ts`, `frontend/types/index.ts`, `app/modules/travel/schemas.py`, `app/modules/travel/service.py`, `tests/test_travel.py`.
- Current behavior:
  - `TASK-034` implemented the main Leaflet/OpenStreetMap Travel map with saved trip and restaurant markers.
  - `TASK-035` implemented map-based location picking for trip and restaurant create/edit flows.
  - The map can show saved markers, but the desired flow is now more map-first: select a trip, move the map to that trip, click the map, then add a restaurant at that clicked coordinate.
  - Existing backend APIs already support explicit latitude and longitude for restaurants.

## 4. Design

- Backend/API:
  - Reuse existing restaurant create/update endpoints.
  - No new endpoint is expected.
  - Confirm restaurant creation accepts explicit `latitude` and `longitude` without requiring an address.
  - If clicked coordinates are provided, do not trigger address geocoding or overwrite the clicked point.
  - Keep authenticated access and generic error responses.
- DB:
  - No schema change expected.
- Frontend:
  - Treat the main Travel map as persistent page state, not only a rendered summary.
  - Add selected-trip state for map actions.
  - Add a trip-level "show on map" action that:
    - expands/selects the trip,
    - pans or flies the main map to the trip coordinates,
    - visually highlights the matching trip marker.
  - Add a map toolbar or trip action for "add restaurant on map".
  - Require a selected trip before entering restaurant-add mode.
  - In restaurant-add mode:
    - change map click behavior so one click captures the restaurant coordinates,
    - show a temporary marker at the clicked point,
    - open a compact restaurant form with name, cuisine, address, note, and visited status fields as supported by existing APIs,
    - save only when the user confirms,
    - cancel should remove the temporary marker and leave saved data unchanged.
  - After save, update local trip state so the restaurant marker appears immediately without a full page reload.
  - Avoid layout jumps: the persistent map should keep a stable height across empty, loading, marker, and add modes.
  - Keep map interactions usable on mobile, including form placement and cancel/save actions.
- Security impact:
  - This task touches authenticated API inputs and persistence.
  - Do not save a restaurant on map click alone; require explicit user confirmation.
  - Continue backend coordinate range validation.
  - Do not add provider keys or new external services.
  - Do not send trip notes, restaurant notes, checklist items, or plan items to external services.
  - Ensure errors shown in the UI remain user-safe and do not expose raw backend details.

## 5. Test Plan

- Backend tests:
  - Add or verify restaurant creation with explicit coordinates and no address.
  - Add or verify invalid coordinates are rejected.
  - Add or verify unauthenticated restaurant creation returns 401.
- Frontend/E2E tests:
  - Verify the main Travel map remains visible while trips are listed.
  - Verify "show on map" moves focus to the selected trip marker when coordinates exist.
  - Verify a trip without coordinates shows a helpful state instead of failing.
  - Verify selecting "add restaurant on map", clicking the map, and confirming creates a restaurant with the clicked coordinates.
  - Verify canceling after a map click does not create a restaurant.
  - Verify the new restaurant marker appears immediately after save.
  - If Leaflet click simulation is brittle in CI, isolate the restaurant-add map state machine for component testing and record manual visual validation.
- Security checks:
  - Verify map click alone does not persist data.
  - Verify no new secret or provider key is introduced.
  - Verify API errors are displayed through safe existing toast/error handling.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- The Travel map remains visible as a persistent panel.
- A trip can be selected and the map can move to that trip's saved location.
- Trips without coordinates are handled with a clear prompt to set a location.
- A user can choose a trip, enter restaurant-add mode, click the map, fill details, and save.
- Clicking the map does not save data until the user confirms.
- Canceling restaurant-add mode leaves saved data unchanged.
- The newly saved restaurant marker appears on the map immediately.
- Existing trip/restaurant location picker behavior remains intact.

## 8. PR Review Checklist

- Confirm the persistent map does not disappear during normal travel browsing.
- Confirm "show on map" uses saved trip coordinates and handles missing coordinates gracefully.
- Confirm restaurant creation from map click is scoped to the selected trip.
- Confirm no duplicate restaurant is created from repeated clicks or cancel/save retries.
- Confirm the clicked coordinate wins over address geocoding.
- Confirm mobile layout keeps the map and restaurant form usable.
- Confirm no new external provider, secret, or unreviewed data sharing is introduced.
