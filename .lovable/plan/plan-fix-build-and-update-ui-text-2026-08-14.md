# Plan - Fix Build and Update UI Text

## Problem
1.  **Build Failure**: The build is failing with an error indicating malformed JSX, specifically around a line that should be `name="text-xl font-bold text-foreground">`. Based on the context, this is likely a broken class name or a syntax error in `src/components/reports/ProjectSelector.tsx`.
2.  **UI Update**: The user wants to change the text "body" to "não econtro a atividade desmi OM 24030". The screenshot shows a search bar and a grid of activity cards (Step 3 of the report creation). The user is likely referring to the empty state when a search yields no results.

## Proposed Changes

### 1. Fix Build Error in `ProjectSelector.tsx`
- Locate the malformed line in `src/components/reports/ProjectSelector.tsx` (likely around the progress bar or status badge section in Step 3).
- Fix the syntax error (missing opening bracket or quotes).

### 2. Update Empty State Text
- In Step 3 (Activities) of `ProjectSelector.tsx`, update the search empty state.
- Change the "Nenhuma atividade encontrada" text (when searching) to the user's requested text: "não econtro a atividade desmi OM 24030".

## Technical Details
- The build error seems to be a syntax regression in `ProjectSelector.tsx`.
- The text change will be applied to the conditional rendering block that handles `monthScopedProjects.length === 0` within Step 3.

## Verification
- Run `bun run build` to ensure the build passes.
- Verify the UI text change in the preview.
