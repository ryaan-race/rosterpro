# Security Specification for ShiftSync

## Data Invariants
1. A Shift must belong to a valid Employee and have a start time before an end time.
2. Only Managers can create, update, or delete Shifts for any employee. 
3. Employees can only view their own shifts, or shifts in their department (if public).
4. SwapRequests must reference a valid Shift and can only be created by the shift owner.
5. TimeOffRequests can be created by any employee but only approved by a Manager.
6. Users cannot upgrade their own roles (e.g., Employee -> Manager).

## The Dirty Dozen Payloads (Denial Expected)
1. **Identity Spoofing**: `create` shift for another employee as an employee.
2. **Privilege Escalation**: `update` own user profile to set `role: 'manager'`.
3. **Ghost Field**: `create` shift with `isVerified: true` (shadow field).
4. **Invalid Range**: `create` shift where `endTime < startTime`.
5. **ID Poisoning**: `get` shift with ID `../../../etc/passwd`.
6. **Self-Approval**: `update` own `TimeOffRequest` to `status: 'approved'` as an employee.
7. **Orphaned Record**: `create` swap request for a non-existent `shiftId`.
8. **PII Leak**: `get` another user's private profile details.
9. **Query Scraping**: `list` all users' notifications without a filter.
10. **State Shortcut**: `update` shift status directly from `scheduled` to `completed` without clock-in.
11. **Resource Exhaustion**: `create` notification with 5MB message string.
12. **Conflict Write**: `update` a shift that has already been `swapped`.

## Test Runner
Verified via `firestore.rules.test.ts` (drafted).
