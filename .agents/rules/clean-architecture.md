# Clean Architecture & Domain Boundaries

This rule governs the architectural separation, dependency flow, and state modeling for Quire.

## 1. Inward-Pointing Dependencies
- **Domain Core (`src/lib/domain/`)**:
  - Contains pure business entities, calculations, value objects, and Finite State Machines.
  - **Zero external imports**: No imports from SvelteKit, database drivers, Turso/libSQL, Stripe SDK, Resend SDK, S3/R2 client, or external network packages.
- **Application Services (`src/lib/server/services/`)**:
  - Coordinates domain workflows, implements ports/interfaces, and consumes infrastructure adapters.
- **Infrastructure Layer (`src/lib/server/db/`, `src/lib/server/storage/`, `src/lib/server/payments/`, `src/lib/server/email/`)**:
  - Implements persistence (Drizzle/Turso), cloud storage (Cloudflare R2), payments (Stripe Connect Express), and transactional email (Resend).
- **Presentation Layer (`src/routes/`, `src/lib/components/`)**:
  - SvelteKit routes, components, actions, and page loaders depend inward on domain types and services.
  - The domain core never imports or references UI/route state.

## 2. Plain, Typed Data Structures at Boundaries (Zod)
- Every system boundary where untrusted external data enters the system **must** validate and parse input using Zod schemas (`src/lib/schemas/`).
- Enforced at:
  - Route params (`params`) and search params (`url.searchParams`)
  - Form actions (`request.formData()`)
  - External webhooks (e.g. Stripe webhook payloads)
  - Client-side storage (`localStorage`, `sessionStorage`, cookies)
- Never pass raw `any` or unvalidated payloads into domain services. Fail fast with structured Zod errors.

## 3. Type-Driven Design
- **Make illegal states unrepresentable.** Avoid boolean soup (e.g. `isDraft`, `isPublished`, `isArchived`).
- Use **discriminated unions** for entity lifecycle states:
  ```typescript
  export type Issue =
    | DraftIssue
    | PublishedIssue
    | CancelledIssue
    | ArchivedIssue;
  ```
- Use **branded types** for domain IDs (`IssueId`, `ArtistId`, `FanUserId`, `ScanTokenHash`) to prevent argument transposition bugs.

## 4. Explicit Finite State Machines (FSMs)
Replace ad-hoc boolean flags with deterministic, pure-function state machines:
1. **Tip Checkout FSM**: `idle` -> `initiating` -> `awaiting_payment` -> `succeeded` | `failed` -> `reset` (no background retry).
2. **Wall Note Submission FSM**: `empty` -> `typing` -> `pending_auth` -> `submitting` -> `live` | `pending_review` | `rejected`.
3. **Issue Lifecycle FSM**: `draft` -> `published` -> `cancelled` | `archived`. (Archived or cancelled issues can never transition back to draft; issues are never deleted).
4. **Stamp Attendance Eligibility FSM**: `unverified` -> `scan_verified_in_window` -> `stamped` | `save_only`.
