# TASK-035: Travel Map Location Picker

status: working
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Improve the Travel map experience so the user can view the map while creating or editing travel and restaurant records, then pick the exact location by clicking the map instead of relying only on address geocoding.

## 2. Requirements

- In scope:
  - Add a map-based location picker to the trip create and edit flows.
  - Add a map-based location picker to the restaurant create and edit flows.
  - Let the user click the map to set latitude and longitude.
  - Show a temporary selected-location marker before saving.
  - Keep address input available as optional display/search context.
  - Preserve the existing Travel map panel that shows saved trip and restaurant markers.
  - Save clicked coordinates directly through the existing trip and restaurant API payloads.
  - Let users clear a selected/saved location when they do not want the record shown on the map.
- Out of scope:
  - New map provider selection.
  - Route planning, directions, distance calculation, or itinerary optimization.
  - Public restaurant search or third-party place lookup.
  - Reverse geocoding clicked coordinates into addresses.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`.
- Files reviewed: `docs/tasks/active/TASK-034-travel-map-and-restaurant-markers.md`, `frontend/app/(dashboard)/travel/TravelMap.tsx`, `frontend/app/(dashboard)/travel/page.tsx`, `frontend/lib/api.ts`, `frontend/types/index.ts`, `app/modules/travel/schemas.py`, `app/modules/travel/service.py`, `tests/test_travel.py`.
- Current behavior:
  - `TASK-034` is implemented and adds Leaflet/OpenStreetMap rendering, trip coordinates, restaurants, and address-based geocoding.
  - `TravelMap.tsx` renders saved trip and restaurant markers and selects a trip when a marker is clicked.
  - The trip form has an address field, but no map picker for coordinates.
  - The restaurant form has name, address, and cuisine fields, but no map picker for coordinates.
  - Existing backend schemas already support latitude and longitude validation.

## 4. Design

- Backend/API:
  - Reuse the existing trip and restaurant create/update endpoints.
  - Confirm `TripCreate`, `TripUpdate`, `RestaurantCreate`, and `RestaurantUpdate` accept explicit `latitude` and `longitude`.
  - When explicit coordinates are provided, do not overwrite them with address geocoding.
  - Support clearing a saved location by sending `address: null`, `latitude: null`, and `longitude: null` where update schemas allow nulls.
  - Keep error responses generic and preserve existing authentication.
- DB:
  - No schema change expected.
- Frontend:
  - Refactor `TravelMap.tsx` or add a sibling reusable map component so map display and map picking do not duplicate marker logic.
  - Add a compact picker mode with:
    - current saved coordinate marker when editing an existing trip or restaurant,
    - temporary marker for the clicked coordinate,
    - click handler that stores latitude and longitude in form state,
    - clear button to remove selected coordinates,
    - stable height and mobile-safe layout.
  - In trip create/edit forms, expose a "pick on map" control near the location/address field.
  - In restaurant create/edit forms, expose the same picker near the restaurant address field.
  - Keep typed address behavior: address may still trigger existing geocoding when coordinates are not chosen.
  - If the user chooses coordinates manually, submit both address and coordinates so the exact clicked point wins.
  - After save, refresh local trip state so the main Travel map immediately shows the new or changed marker.
- Security impact:
  - This task touches authenticated API inputs and persistence.
  - Continue backend coordinate range validation for latitude and longitude.
  - Do not add a new external provider or expose any provider key.
  - Do not send notes, plans, checklist items, or restaurant notes to external services.
  - Prevent raw exception messages from reaching users if coordinate update fails.

## 5. Test Plan

- Backend tests:
  - Add or verify tests that explicit trip coordinates are preserved even when an address is present.
  - Add or verify tests that explicit restaurant coordinates are preserved even when an address is present.
  - Add update tests for clearing trip and restaurant coordinates.
- Frontend/E2E tests:
  - Test that opening the trip location picker and clicking the map populates coordinate state.
  - Test that opening the restaurant location picker and clicking the map populates coordinate state.
  - Test that clearing location removes coordinates from the form.
  - Verify the main Travel map shows the saved marker after save.
  - If Leaflet click simulation is brittle in CI, isolate coordinate selection logic in a testable component and record manual validation.
- Security checks:
  - Verify unauthenticated update endpoints still return 401.
  - Verify invalid manual coordinates are rejected without raw backend details.
  - Verify no new secrets or map keys are added.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Users can view a map while choosing a trip location.
- Users can click the map to set a trip marker location before saving.
- Users can view a map while choosing a restaurant location.
- Users can click the map to set a restaurant marker location before saving.
- Users can clear a saved or selected location.
- The main Travel map updates after saving without requiring a full page reload.
- Address-based geocoding remains available when no manual coordinate is chosen.
- Validation and tests cover explicit coordinate save and clearing behavior.

## 8. PR Review Checklist

- Confirm the picker does not break the existing saved-marker Travel map.
- Confirm manual coordinates take precedence over address geocoding.
- Confirm map picker UI is usable on mobile and does not push form actions off-screen.
- Confirm coordinates are not silently saved before the user submits the form.
- Confirm clearing a location removes the marker from the main map after save.
- Confirm no new provider secrets, tokens, or private data are introduced.
- Confirm tests or manual validation cover both trip and restaurant picker flows.
