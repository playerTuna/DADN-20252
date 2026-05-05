# Smart Farm Web

Pure React web client for the Smart Farm backend.

## Run

```bash
npm install
npm --workspace @yolo-farm/web run dev
```

The web app reads `VITE_API_URL` from `.env`; the default is:

```bash
VITE_API_URL=http://localhost:3001
```

## Backend CORS

The backend must allow the Vite dev origin `http://localhost:5173`. The current backend `src/main.ts` already includes `http://localhost:5173` and `http://127.0.0.1:5173` in its default CORS origins. If overriding `CORS_ORIGINS`, include:

```bash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```
