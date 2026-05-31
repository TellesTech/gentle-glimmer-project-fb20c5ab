export type TriggerDownloadOptions = {
  /**
   * Optional window opened synchronously from a user gesture (e.g. click).
   * If provided, we will trigger the download from that window to avoid blockers.
   */
  preOpenedWindow?: Window | null;
};

export function triggerDownloadFromBlob(
  blob: Blob,
  filename: string,
  options: TriggerDownloadOptions = {}
) {
  const url = URL.createObjectURL(blob);

  // Debug info to help diagnose why downloads are not starting on some browsers.
  // (These logs will show up in Lovable console logs once reproduced.)
  console.info('[download] triggerDownloadFromBlob:start', {
    filename,
    blobType: blob.type,
    blobSize: blob.size,
    hasPreOpenedWindow: !!options.preOpenedWindow,
  });

  const tryTrigger = (doc: Document) => {
    try {
      const body = doc.body;
      if (!body) {
        console.warn('[download] tryTrigger:document has no body yet');
        return false;
      }

      const a = doc.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';

      // Some browsers behave better when target is _self for blob URLs.
      a.target = '_self';

      body.appendChild(a);
      a.click();
      a.remove();
      console.info('[download] tryTrigger:clicked');
      return true;
    } catch (err) {
      console.error('[download] Failed to trigger download link:', err);
      return false;
    }
  };

  const ensureWindowBody = (w: Window) => {
    try {
      const d = w.document;
      if (d?.body) return d;

      // Some browsers need a fully written document before body exists.
      d.open();
      d.write(
        '<!doctype html><html><head><meta charset="utf-8" /></head><body>' +
          '<p style="font-family: system-ui; padding: 12px;">Preparando download…</p>' +
          '</body></html>'
      );
      d.close();
      return d;
    } catch (err) {
      console.error('[download] Failed to prepare pre-opened window:', err);
      return null;
    }
  };

  const lastResortNavigate = () => {
    // Last resort: navigate current page to the blob URL.
    // This is disruptive, but better than a silent no-op.
    try {
      console.warn('[download] lastResortNavigate: navigating to blob URL');
      window.location.href = url;
    } catch (err) {
      console.error('[download] lastResortNavigate failed:', err);

      // Very last fallback: open in a new tab.
      try {
        console.warn('[download] lastResortNavigate: trying window.open(url)');
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err2) {
        console.error('[download] window.open blob url failed:', err2);
      }
    }
  };

  try {
    const w = options.preOpenedWindow;
    if (w && !w.closed) {
      console.info('[download] using preOpenedWindow');
      const d = ensureWindowBody(w);

      // If the window is still loading, wait a tick and try again.
      const attempt = () => {
        const ok = d ? tryTrigger(d) : false;
        if (!ok) {
          console.warn('[download] preOpenedWindow tryTrigger failed; falling back to main document');
          const okMain = tryTrigger(document);
          if (!okMain) {
            console.warn('[download] main document tryTrigger failed; falling back to navigate');
            lastResortNavigate();
          }
        }
      };

      if (w.document?.readyState === 'loading') {
        w.addEventListener('load', () => setTimeout(attempt, 50), { once: true });
      } else {
        setTimeout(attempt, 50);
      }

      // Give slower devices/browsers more time before attempting to close.
      setTimeout(() => {
        try {
          w.close();
        } catch {
          // ignore
        }
      }, 3000);

      return;
    }

    if (w && w.closed) {
      console.warn('[download] preOpenedWindow was provided but is already closed');
    }

    // No pre-opened window: best-effort in the current document.
    const ok = tryTrigger(document);
    if (!ok) {
      console.warn('[download] main document tryTrigger failed; falling back to navigate');
      lastResortNavigate();
    }
  } finally {
    // Revoke later to avoid revoking before the download starts.
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
        console.info('[download] blob URL revoked');
      } catch {
        // ignore
      }
    }, 10000);
  }
}
