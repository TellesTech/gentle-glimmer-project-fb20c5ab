# Plan: Verify Workforce Function Correction

The user wants to verify if the previous correction regarding workforce function roles was successful. I will use Playwright to inspect the workforce database table in the live preview and verify that specific job titles (like "PINTOR ESCALADOR N1") are being displayed instead of generic base functions (like "PINTOR").

## Proposed Actions

1. **Verify via Browser Interaction**:
   - Navigate to the Workforce Database page (`/workforce`).
   - Check the displayed table for workers.
   - Verify that the "FUNÇÃO" column shows specific roles (e.g., qualifiers like "N1", "N2", "ESCALADOR").
   - Trigger an Excel export and (if possible via environment) verify the content of the generated file structure or at least the console logs/network requests during export.

2. **Data Consistency Check**:
   - Verify that the `resolveWorkerFunction` logic is correctly applied when syncing RDOs.

## Verification Steps

- [ ] Open `/workforce` in the preview.
- [ ] Inspect the "FUNÇÃO" column values.
- [ ] Check if "PINTOR ESCALADOR N1" or similar specific roles appear for relevant workers.
- [ ] Confirm that "MEIO OFICIAL" is not being incorrectly assigned where specific roles exist in profiles.
