import { ClipboardPaste, FolderOpen, Monitor } from "lucide-react";
import { useRef } from "react";
import { canCaptureScreen } from "../capture";

interface WelcomeProps {
  delay: number;
  onDelay: (seconds: number) => void;
  onCapture: () => void;
  onPaste: () => void;
  onFile: (file: File) => void;
}

export function Welcome({ delay, onDelay, onCapture, onPaste, onFile }: WelcomeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const screenOk = canCaptureScreen();

  return (
    <div className="welcome">
      <img className="welcome-logo" src="/logo.png" alt="" width={96} height={96} />
      <h1>Screenshot</h1>
      <p className="welcome-lead">Capture, annotate and share screenshots, right in your browser.</p>

      <div className="welcome-actions">
        <div className="action-card">
          <button className="action primary" onClick={onCapture} disabled={!screenOk}>
            <Monitor size={28} />
            <span className="action-title">Capture screen</span>
            <span className="action-sub">A screen, window or tab</span>
          </button>
          <label className="delay">
            Delay
            <select value={delay} onChange={(e) => onDelay(Number(e.target.value))}>
              <option value={0}>None</option>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </label>
        </div>
        <button className="action" onClick={onPaste}>
          <ClipboardPaste size={28} />
          <span className="action-title">Paste image</span>
          <span className="action-sub">
            <kbd>Ctrl</kbd>+<kbd>V</kbd> anywhere
          </span>
        </button>
        <button className="action" onClick={() => fileRef.current?.click()}>
          <FolderOpen size={28} />
          <span className="action-title">Open image</span>
          <span className="action-sub">Or drop a file here</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {!screenOk && <p className="welcome-note warn">This browser can't capture the screen. Use Chrome, Edge or Firefox on a desktop, or paste a screenshot instead.</p>}
      <p className="welcome-note">
        Tip: press <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> (Windows) or <kbd>Cmd</kbd>+<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd> (Mac), then paste here.
      </p>
      <p className="welcome-note">Your screenshots never leave your computer. Nothing is uploaded.</p>
    </div>
  );
}
