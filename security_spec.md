# Security Specification - Crisis Response System

This document outlines the data invariants and security testing strategy for the Firestore database.

## 1. Data Invariants

1.  **Organization Isolation**: No user (except global admins) shall read or write data belonging to an organization other than their own.
2.  **Incident Integrity**: Incidents cannot be created without a valid reporter ID, organization ID, and status 'reported'.
3.  **Immutable Identity**: Once an incident is reported, the `reporterId` and `organizationId` cannot be changed.
4.  **Action-Based Updates**: Only specific roles can transition incident states (e.g., only responders can mark as 'responding', only admins/receptionists can 'escalate').
5.  **Relational Message Auth**: Access to an incident's chat messages is strictly derived from having read access to the parent incident.
6.  **Verified Authorship**: Every write (incident or message) must have an author/sender field that matches the `request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Test Cases)

These payloads must be REJECTED by the security rules.

| ID | Case | Collection | Payload | Reason |
|----|------|------------|---------|--------|
| T1 | Shadow Admin | users | `{"role": "admin", "displayName": "Attacker"}` | Self-assigning admin role. |
| T2 | ID Poisoning | incidents | `{"id": "long-junk-string...", "type": "fire", ...}` | Document ID exceeds size limits. |
| T3 | Orphaned Incident | incidents | `{"organizationId": "non-existent-org", ...}` | Referencing a non-existent parent. |
| T4 | Role Escalation | incidents | `{"status": "resolved"}` (by guest) | Unauthorized state transition. |
| T5 | Update Gap | incidents | `{"severity": "critical", "description": "Hacked"}` (add field) | Modifying unassigned fields. |
| T6 | Identity Spoofing | incidents | `{"reporterId": "someone-else-uid", ...}` | Impersonating another reporter. |
| T7 | Crossed Org Read | incidents | `GET doc (orgB_id)` as `user(orgA)` | Accessing private org data. |
| T8 | Shadow Field | messages | `{"text": "hi", "isVerified": true, ...}` | Injecting unauthorized fields. |
| T9 | PII Leak | users | `GET private/sensitive` as `anonymous` | Unauthorized PII access. |
| T10 | Orphaned Message | incidents/X/messages | `{"incidentId": "Y", ...}` | Message incident mismatch. |
| T11 | State Shortcutting | incidents | `{"status": "closed"}` (from 'reported') | Skipping lifecycle steps. |
| T12 | Large Payload | messages | `{"text": "A" * 1000000}` | Denial of Wallet attack via large doc. |

## 3. Test Runner (Draft)

```typescript
// firestore.rules.test.ts
// This will be implemented after drafting the rules.
```
