# ADR: Shared UI Component Library

## Context
Multiple React Native apps duplicate Button, Input, Modal, List, and Card components with inconsistent styling and behavior.

## Decision
Centralize reusable UI components in `@rez/ui` with TypeScript support and consistent styling.

## Rationale
- Single source of truth for UI styling and behavior
- Reduces code duplication across consumer/merchant/admin apps
- Type-safe component props prevent integration errors
- Subsumes bugs: inconsistent button behavior, styling divergence, input validation duplication

## Implementation
Exports:
- Button (primary, secondary, danger variants)
- Input (email, phone, numeric, password variants)
- Modal (transparent overlay with animation)
- List (FlatList wrapper with pagination)
- Card (shadow/elevation for iOS/Android consistency)

## Related Issues
- UI inconsistency across consumer and merchant apps
- Button state handling bugs
- Input validation duplication
