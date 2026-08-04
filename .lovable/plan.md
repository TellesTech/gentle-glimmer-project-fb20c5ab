# Plan: Signature Logic Refinement and Data Cleanup

Refining the signature classification and pre-population logic to strictly separate WEES and Client members, following the rule that only members registered on the "Client Page" (Unit Members) should appear as client signers.

## Database Cleanup (Completed)
- [x] **Lucas Rosa**: Removed from internal `profiles` (WEES side) to ensure he is classified solely as a Client (`client_profiles`).
- [x] **Walace Rocha**: Removed from `company_contacts` and `client_profiles` to ensure he is classified solely as WEES internal staff.
- [x] **Alex Manhães**: Removed from any contact/profile lists.

## Frontend Adjustments

### 1. Refine `useReportSignaturesRealtime.ts`
- **Prioritize Client Classification**: Ensure that if someone is explicitly listed as a client contact for the report's company, they are NOT moved to the WEES side, even if a name-match exists in the internal directory (safety against common names).
- **Strict Ad-hoc Signatures**: Limit ad-hoc client signatures in the timeline to only those who are registered as active contacts for the company, unless they have already signed (historical record).
- **Exclude Alex Manhães**: Explicitly exclude "Alex Manhães" from the timeline pre-population to satisfy the specific removal request.

### 2. Update `SendForSignatureDialog.tsx`
- Ensure the selection list is strictly tied to active contacts for the specific site/company.

## Verification
- [ ] Verify that Lucas Rosa appears under the "Suzano" (Client) section.
- [ ] Verify that Walace Rocha appears under the "WEES" section with his correct role.
- [ ] Verify that Alex Manhães no longer appears as a pending or pre-populated signer.
