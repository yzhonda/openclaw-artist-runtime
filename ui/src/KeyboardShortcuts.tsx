import { useEffect } from "react";
import { resolveProducerConsoleShortcut, type ProducerConsoleShortcutAction } from "../../src/services/keyboardShortcutMap";

export function useKeyboardShortcuts(handlers: Record<ProducerConsoleShortcutAction, () => void>) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const action = resolveProducerConsoleShortcut({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        isComposing: event.isComposing,
        targetTagName: target?.tagName,
        targetContentEditable: Boolean(target?.isContentEditable)
      });
      if (!action) {
        return;
      }
      event.preventDefault();
      handlers[action]();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}

export function ShortcutHelpOverlay(props: { open: boolean; onClose: () => void }) {
  if (!props.open) {
    return null;
  }

  return (
    <div className="shortcut-overlay" role="dialog" aria-label="Keyboard shortcuts">
      <div className="shortcut-card">
        <div className="inline-actions">
          <strong>Keyboard Shortcuts</strong>
          <button type="button" onClick={props.onClose}>Close</button>
        </div>
        <dl className="shortcut-list">
          <div><dt>r</dt><dd>Refresh Console status</dd></div>
          <div><dt>p</dt><dd>Rerun X probe</dd></div>
          <div><dt>esc</dt><dd>Clear event filters / close this overlay</dd></div>
          <div><dt>?</dt><dd>Toggle this help overlay</dd></div>
        </dl>
      </div>
    </div>
  );
}
