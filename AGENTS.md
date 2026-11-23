# Agent rules

- Site-wide shutdown is controlled by the `SYSTEM_DISABLED` flag in `src/main.tsx`; when true (only on the rdo.wees.com.br domain), every URL renders only `src/pages/SystemMoved.tsx` and the full app is never loaded. Why: lets the system be disabled and re-enabled with a single-line change without deleting any code.
