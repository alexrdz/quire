# 5. Inward-Pointing Dependencies, Boundary Zod Validation, and Type-Driven FSMs

We enforce strict architectural boundaries across the codebase: dependencies point exclusively inward toward a pure domain core; all system boundaries validate incoming data with Zod into typed data structures; types use discriminated unions to make illegal states unrepresentable; and complex multi-step workflows are governed by explicit Finite State Machines (FSMs) rather than ad-hoc boolean flags.

## Context & Trade-offs
- **Inward Dependencies:** Eliminates framework coupling. The domain logic (attendance rules, fee calculations, time-zone stamp windows, note moderation) can be tested in sub-millisecond Vitest unit tests without mocking SvelteKit request objects or database drivers.
- **Boundary Validation:** Prevents malformed inputs or unescaped payloads from reaching services, ensuring runtime data matches compile-time types.
- **Type-Driven Design:** Replaces error-prone `isDraft`, `isPublished`, `isArchived` booleans with discriminated unions where invalid entity states fail at compile time.
- **Explicit FSMs:** Critical for payment safety (immediate reset on failure, zero background retries) and issue lifecycle integrity (issues are archived, never deleted).
