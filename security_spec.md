# Security Specification — Industrial IoT Monitoring Dashboard

## 1. Data Invariants
1. A `UserProfile` at `/users/{userId}` can only be read or created by the authenticated verified user matching `userId`, and cannot self-assign `role == 'admin'`.
2. An `IoTDevice` at `/devices/{deviceId}` belongs strictly to `ownerId == request.auth.uid`, and `ownerId` and `createdAt` are immutable.
3. A `SensorReading` at `/devices/{deviceId}/readings/{readingId}` must reference an existing parent device via `get()`, match `deviceId`, match the parent device's `ownerId`, and remain read-only from unprivileged dashboard clients (`allow write: if isAdmin()`).
4. An `AlertRule` at `/alertRules/{ruleId}` belongs strictly to `ownerId == request.auth.uid`; list queries are enforced at rule level via `resource.data.ownerId == request.auth.uid`.
5. No blanket `isSignedIn()` reads or list queries are permitted anywhere.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/devices/dev_1`
2. Unverified email user writing `/users/uid_1`
3. Self-escalation: creating `/users/uid_1` with `{ role: "admin" }`
4. Shadow field injection on `/devices/dev_1`: adding `{ isVerified: true }`
5. Oversized ID poisoning: document ID > 128 chars or containing invalid characters (`../`)
6. Cross-tenant list query on `/devices` without `where('ownerId', '==', auth.uid)`
7. Spoofed `ownerId` on `/devices/dev_2` creation (`ownerId != request.auth.uid`)
8. Mutating immutable `createdAt` or `ownerId` on `/devices/dev_1` update
9. Client timestamp spoofing (`updatedAt != request.time`)
10. Non-admin client attempting to write telemetry directly to `/devices/dev_1/readings/r1`
11. Reading another user's PII at `/users/other_uid`
12. Creating `/alertRules/rule_1` with invalid `severity: "super"` or oversized `fieldLabel` (>128 chars)
