# Plan - Fix PDF Encoding and Layout Issues

The user reported that the generated PDF has encoding errors (weird characters instead of accents) and layout issues (excessive empty space). The investigation shows that while Roboto font is being set, it is never actually registered in the jsPDF instance via registerPdfFont from src/lib/pdfFonts.ts. This causes jsPDF to fallback to standard fonts that don't handle UTF-8 well, resulting in characters like Ø=Bá instead of status icons or accents.

## Proposed Changes

### PDF Generation Engine
#### [src/lib/generateReportPdf.ts](src/lib/generateReportPdf.ts)
- Import registerPdfFont and PdfFontHandle.
- Call registerPdfFont(doc) at the start of buildReportPdfDoc.
- Use the returned font handle to properly set fonts and styles throughout the document.
- Replace hardcoded doc.setFont('Roboto', ...) calls with the dynamic handle to ensure fallback safety.
- Review and refine vertical spacing (the y increments) to reduce "excessive empty space" between sections.
- Ensure that sections with no content don't leave large gaps.

## Verification Plan

### Automated Tests
- Run a playwright script to trigger a PDF download (or generation as blob) and verify that the resulting PDF contains correctly encoded text (e.g., "Concluído" instead of "ConcluÃdo").
- Verify that the specific character sequences mentioned in the user screenshot (like Ø=Bá) are correctly rendered as their intended symbols/characters.

### Manual Verification
- Generate a report PDF from the preview.
- Inspect the PDF for:
  - Correct rendering of Portuguese accents and special symbols.
  - Better vertical distribution of content (less empty space).
  - Alignment between the system UI and the PDF output.
