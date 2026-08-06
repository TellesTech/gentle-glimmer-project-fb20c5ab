# Plan - Verify Workforce Function Correction

The user wants to verify if the previous correction regarding workforce function roles was successful. I will use Playwright to inspect the workforce database table in the live preview and verify that specific job titles (like "PINTOR ESCALADOR N1") are being displayed instead of generic base functions (like "PINTOR").

## Proposed Actions

### 1. Browser Verification
- Use Playwright to navigate to the Workforce Database page (`/workforce-database`).
- Wait for the records to load.
- Extract the text content of the "FUNÇÃO" column for the first few rows.
- Verify that specific roles (e.g., "PINTOR ESCALADOR N1") are present if available in the data.

### 2. Final Confirmation
- Provide a screenshot of the Workforce table showing the corrected functions.

## Technical Details
- The Workforce Database is located at `/workforce-database`.
- The data is fetched from `report_attendance` (synced from RDOs) and `workforce_database` (manual entries).
- The `resolveWorkerFunction` utility handles the intelligent matching of names to specific profile roles.

## Verification Steps
- [ ] Run Playwright script to check `/workforce-database`.
- [ ] Take screenshots of the table.
- [ ] Log the detected functions to verify they are specific.
