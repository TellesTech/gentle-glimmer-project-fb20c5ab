# Plan - Fix Signature Clipping

The user reported that signatures are being cut off ("assinatura esta cortando"). This is likely happening during the generation of typed signatures in the `SignatureInput` component where a fixed font size and canvas width are used.

## Proposed Changes

### 1. `src/components/client/SignatureInput.tsx`
- Increase the generation canvas width from 400px to 600px for better resolution and space.
- Implement a dynamic font size calculation in `generateTypedSignature` that reduces the font size if the text exceeds the available width.
- Add horizontal padding (e.g., 20px) to the canvas drawing logic to ensure the first and last letters aren't clipped by the edges.
- Update the preview UI in the component to match these improvements.

### 2. `src/components/signatures/SignatureImage.tsx`
- Ensure the image rendering uses `object-contain` and allows for wider aspect ratios if needed. (Already seems to be doing this, but will verify).

### 3. Verification
- Test with long names (e.g., "Christiano Serra da Silva", "Karine Correa Deolindo") to ensure they fit within the signature box without clipping.
