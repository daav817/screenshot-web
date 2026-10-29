# Screenshot (web)

Capture, annotate and share screenshots in the browser. A web version of the
[Screenshot Windows app](https://github.com/daav817/screenshot), for Energia Power LLC, served at
**https://screenshot.energiapower.llc**.

Everything happens in the browser: screenshots are never uploaded, so there's no server-side storage and no login.

## Features

- **Capture** a screen, window or browser tab (Screen Capture API), with an optional 3/5/10 s delay.
  A capture opens straight into crop mode so you can pick the region.
- **Paste** an image from the clipboard (Ctrl+V anywhere, e.g. after Win+Shift+S), **open** a file, or **drop** one on the page.
- **Annotate**: rectangle, ellipse, line, arrow, freehand, text, highlight, obfuscate (pixelate / blur), numbered steps.
  Colors, fill, line width, text size and drop shadow. Shift draws squares, circles and 45° lines.
- **Edit**: select, move and resize shapes, restyle them, delete, undo/redo, crop, zoom.
- **Export**: copy to the clipboard, save as PNG or JPG, print.

### Keyboard shortcuts

| Key | Action |
|---|---|
| V R E L A F T H O S C | Select, Rectangle, Ellipse, Line, Arrow, Freehand, Text, Highlight, Obfuscate, Step, Crop |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Delete | Delete the selected shape |
| Ctrl+C / Ctrl+S / Ctrl+P | Copy image / save PNG / print |
| Enter / Esc | Apply / cancel crop |
| + / - / 0 | Zoom in / out / fit |
| Ctrl+Enter or Esc | Finish typing text |

### What the browser can't do (compared to the Windows app)

- No global Print Screen hotkey or tray icon: the page has to be open.
- The browser always asks which screen/window/tab to share; it can't capture silently.
- Screen capture needs a desktop browser (Chrome, Edge or Firefox; Safari partly) and HTTPS (or `localhost`).

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check and build to dist/
```

Stack: React 18, TypeScript, Vite, [Konva](https://konvajs.org/) for the canvas.

```
src/
  App.tsx               app state, toolbar actions, keyboard shortcuts
  capture.ts            screen capture, clipboard and file input
  export.ts             download, clipboard and print
  editor/Editor.tsx     Konva canvas: drawing, selecting, moving, text editing
  components/           welcome screen, toolbox, properties bar
  model/                shapes, undo history, crop, obfuscation (plain TypeScript, unit tested)
```

## Deployment

The image is nginx serving the static build on port 8080 (non-root), with a `/healthz` endpoint.

```sh
docker build -t screenshot-web .
docker run --rm -p 8080:8080 screenshot-web   # http://localhost:8080
```

It deploys like `energia-website`:

1. **CI** (`.github/workflows/build-and-push.yml`): every push to `main` runs the tests, pushes
   `ghcr.io/daav817/screenshot-web:<version>.<run>` and `:latest`, and pins the new tag in `k8s/kustomization.yaml`.
2. **ArgoCD**: apply `k8s/argocd-application.yaml` once; it syncs `k8s/` (namespace `screenshot`, Deployment, ClusterIP
   Service, Traefik Ingress for `screenshot.energiapower.llc`).
3. **Image pull**: either make the GHCR package public (it only contains the static site), or copy the pull secret
   into the new namespace:
   ```sh
   kubectl get secret ghcr-pull-secret -n energia-web -o yaml \
     | sed 's/namespace: energia-web/namespace: screenshot/' | kubectl apply -f -
   ```
4. **Public access** (Cloudflare Tunnel `homelab`): add a public hostname `screenshot.energiapower.llc` →
   `http://192.168.1.243` (the Traefik LoadBalancer), with HTTP Host Header `screenshot.energiapower.llc`.
   Cloudflare provides the HTTPS that screen capture requires.
