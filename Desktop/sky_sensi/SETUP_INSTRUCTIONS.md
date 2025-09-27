# Sky Sensi — Local Development Setup

This guide walks you through configuring and running the Sky Sensi aviation weather application on macOS, Windows, or Linux. It covers tooling prerequisites, environment variables, dependency installation, and troubleshooting steps for both the backend (Express) and frontend (Vite/React) projects.

---

## 1. Prerequisites

- **Node.js 18 LTS or newer** (required for the Google Generative AI SDK)
- **npm 9+** (ships with Node.js 18 LTS)
- **Git** for cloning the repository
- **Google Gemini API key** from [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

> ⚠️ If you already installed Node.js prior to this project, verify the version with `node --version`. Upgrade if it is below 18.x.

---

## 2. Repository Layout

```
sky_sensi/
├── backend/      # Express server and weather fetchers
├── frontend/     # Vite + React single-page app
├── README.md     # High-level project overview
└── SETUP_INSTRUCTIONS.md  # This file
```

The backend listens on **port 3001**. The frontend dev server runs on **port 3000**.

---

## 3. Environment Configuration

### 3.1 Backend `.env`

1. Duplicate the template and rename it:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Edit the freshly copied `.env` and provide the required values:
   - `PORT=3001`
   - `GEMINI_API_KEY=<your_google_gemini_api_key>`
   - Optionally adjust cache TTL or Gemini model parameters.

### 3.2 Frontend `.env`

1. Duplicate the template and rename it:
   ```bash
   cd frontend
   cp .env.example .env
   ```
2. Verify the following defaults inside `.env`:
   - `VITE_API_BASE_URL=http://localhost:3001/api`
   - `VITE_ENV=development`

> ℹ️ All browser-exposed variables must be prefixed with `VITE_`.

---

## 4. Installing Dependencies

Run the installs inside each workspace once. The commands below assume you are in the repository root.

```bash
cd backend
npm install

cd ../frontend
npm install
```

Running `npm install` ensures the required packages (Express, Axios, Google Generative AI SDK, Vite, etc.) are available.

---

## 5. Running the Application

You can start the backend and frontend individually, or use the root helper script (added via `package.json`).

### 5.1 Start Backend Only
```bash
cd backend
npm run dev
```
This launches the Express API at `http://localhost:3001`.

### 5.2 Start Frontend Only
```bash
cd frontend
npm run dev
```
The Vite dev server hosts the UI at `http://localhost:3000`. It proxies API requests to `http://localhost:3001/api` via the configured base URL.

### 5.3 Start Both Projects Together
Once the root `package.json` is in place, you can run:
```bash
npm install
npm run dev
```
This uses `concurrently` to run `backend:nodemon` and `frontend:dev` scripts in parallel.

---

## 6. Verifying the Setup

1. Visit `http://localhost:3000` in your browser.
2. Enter a comma-separated list of ICAO identifiers (e.g., `KLAX,KSFO`).
3. Confirm that:
   - The backend logs requests in the terminal.
   - Weather briefings display without errors.
   - The interactive map and AI summary populate after the briefing loads.

---

## 7. Troubleshooting

| Symptom | Likely Cause | Suggested Fix |
|---------|--------------|---------------|
| `ECONNREFUSED` or `Failed to fetch weather data` in the UI | Backend not running or wrong port | Ensure the Express server is running on port 3001 and `VITE_API_BASE_URL` is `http://localhost:3001/api`. |
| `Google Generative AI` errors | Missing or invalid `GEMINI_API_KEY` | Insert a valid key in `backend/.env`. Restart the backend after changes. |
| Rate limit or timeout messages from AWC APIs | High request volume | The backend includes retries and caching. Wait 30 seconds and re-run the request. |
| Vite reports port 3000 in use | Port already occupied | Stop the other process or change the frontend port via `VITE_PORT`. |
| `node: command not found` | Node.js not installed / PATH issue | Install Node.js 18+ and restart your shell. |

---

## 8. Optional Production Build

- Backend: `npm run build` (optional if using TypeScript or bundlers).
- Frontend: `npm run build` (creates `frontend/dist`).
- Serve the built frontend using a static hosting provider or reverse proxy it through the Express server.

---

## 9. Keeping Dependencies Updated

Periodically run the following to stay current:
```bash
cd backend && npm update
cd ../frontend && npm update
```
Review changelogs before major upgrades and re-run the application after updates.

---

With these steps complete, Sky Sensi should be ready for local development, testing, and integration work. Happy flying! ✈️
