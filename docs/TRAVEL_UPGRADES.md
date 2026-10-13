# Travel workflow update — 2026-10-13

## Map

Routes now have dark colours, white outlines and larger directional arrows over a quieter basemap. Selecting a marker or segment highlights the route and shows the next stop. Start/finish labels and a fit-route button keep the sequence readable. Unlocated stops show an explicit status; partial routes label their first/last confirmed locations. Estimated paths remain dashed.

## Dates and cities

Travel Settings provides departure, date and city-day edits with a preview. Existing day IDs, A/B stops, photos and check-ins follow day order. New days start empty. Shortening cannot discard a populated day. Confirmed bookings and actual expenses retain their original dates; pending reminders shift with the plan. City changes and confirmed bookings needing review are shown before applying. Booking cards flag dates outside the trip.

Templates ask for a new start date and derive the finish from the actual day count. The Great Ocean Road template spans two days. The built-in template migrates to its corrected dates; existing user copies remain editable. Ground-only trips with unknown airport destinations do not show a flight search card.

## Saved details and bookings

Saved items and comparison columns have an edit action. Manual hotel facts include breakfast, parking, cancellation and room information. Currency and total-stay/per-room-per-night price units are explicit. Nightly prices are multiplied by the selected nights for one room. Pending orders follow saved estimates; manually edited or confirmed order amounts are preserved. An undated comparison reminder is reused when scheduling the stay. Confirmed checkout dates are edited explicitly in Bookings.

## Settlement and gifts

Recording a completed off-app transfer creates a settlement entry rather than hiding the expense. Balances include these entries and continue to calculate new expenses. Undo restores the outstanding amount. Cent allocation keeps small split bills exactly balanced. Settlement history survives full backups and backend sync and is excluded from itinerary exports. Gift forms collect recipient, item and purchase city and support editing/removal and purchase/packing status.

## Shared planning

Shared planning uses the existing Node backend. Owners generate per-member access codes. Editors can change the trip; viewers can browse and vote as themselves. Member management belongs to the owner, and the backend validates these permissions on every request. Tokens are hashed on disk and remain in browser memory for the page session. Member codes expire after seven days; owner codes last one year. Regenerating a member code revokes the previous one. Share codes only with the named member.

Clients send a debounced update and check for companion updates every ten seconds while a shared trip is open. Entity-ID-based three-way merging preserves independent edits, including saves racing for the same revision. Conflicting changes to the same field pause sync. Resolving retains a separate local copy before loading the shared version. Connection failures retain the local draft. Photos remain on each device; shared data includes itinerary, saved items, orders, expenses, notes and settlement records. Recent update history shows member, time and revision.

### Run and connect

1. Configure `BOOMVOY_SYNC_TOKEN` (at least 32 characters) in the backend's ignored `.env.server`, then run `npm run server` using Node 22 or newer. Generate the token locally, for example with `openssl rand -hex 32`. The creation token stays with the owner/backend administrator.
2. Open a trip → More → Companions → Shared planning. Enter the backend base URL and creation token, then start. Keep the owner's access code for reconnecting.
3. Select a member and generate their access code. The member opens Me → Join shared planning, enters the **same backend URL** and their own code.
4. For different physical devices, host the Node process behind HTTPS with a durable writable data volume. Set `BOOMVOY_ALLOWED_ORIGINS` to the exact frontend origin (for Pages, `https://baix827.github.io`) and `BOOMVOY_ALLOWED_HOSTS` to the backend hostname. Publish through a reverse proxy; the Node listener remains on loopback. Serve one backend process per shared storage directory.

GitHub Pages serves the frontend. Cross-device collaboration also requires this reachable backend; a localhost URL reaches only the device opening it. The API uses `/api/v1/rooms` and persists rooms under the ignored `server/data/rooms` directory. API keys and creation/access tokens are excluded from Git, exports and room responses to other members.

## Validation

`npm test` covers date preservation, protected shortening, pending versus confirmed pricing, manual price overrides, settlement/undo/new expenses, cent rounding, backup compatibility, independent/conflicting merges, server permissions, self-only votes, invitation expiry/revocation, persistence and HTTP revision conflicts. `npm run build` checks TypeScript and production output.

Browser checks used isolated test data and two separate localhost origins: different-day edits synced both ways; shared expenses and gifts arrived on the other client; changing an editor to a viewer disabled editing; a nightly hotel estimate produced the correct two-night order amount; date changes retained A/B plans and check-ins. No real purchases or transfers were made.
