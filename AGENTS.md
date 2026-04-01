# Repository Guidelines

## Project Structure & Module Organization
`backend/` contains the Express API, business logic, workers, storage adapters, and templates; focus on `routes/`, `controllers/`, `services/`, `models/`, and `workers/`. `frontend/` is the Vue 3 + Vite app with source in `src/`, assets in `public/`, and output in `dist/`. `docs/` holds the Astro/Starlight docs site. `docker/` defines the local stack for MariaDB, MongoDB, RabbitMQ, EMQX, MinIO, and app containers. `signer/` provides PDF signing, and `tools/templates/` stores template seeds and publishing assets.

## Build, Test, and Development Commands
Install dependencies per package, not from the repo root.

- `cd backend && npm install && npm run start`: start the API on port `3030` by default.
- `cd frontend && pnpm install && pnpm run dev`: run the UI locally on `http://localhost:8080`.
- `cd frontend && pnpm run build`: create the production bundle.
- `cd frontend && pnpm run lint`: run ESLint for `.js` and `.vue` files.
- `cd docs && pnpm install && pnpm run dev`: start the documentation site on port `4321`.
- `cd docker && docker compose up -d`: bring up the local infrastructure services.

## Coding Style & Naming Conventions
Follow the existing file style instead of reformatting broadly. Frontend config uses 2-space indentation; backend JS commonly uses double quotes and ESM imports. Use `camelCase` for variables/functions, `PascalCase` for Vue components, and descriptive file names such as `sign_controller.js` or `DashboardHome.vue`. Run `frontend` linting before submitting UI changes.

## Testing Guidelines
There is no unified automated test suite yet. Treat `frontend` linting as the minimum validation for UI work. For backend changes, verify affected endpoints locally and document manual checks in the PR. If you add tests, place them near the changed module and name them `*.test.js` or `*.spec.js`; `backend/test_multisigner.js` is the closest existing example.

## Commit & Pull Request Guidelines
Recent history mixes conventional commits (`feat:`, `fix:`) with short Spanish summaries. Prefer concise, imperative subjects with an obvious scope, for example `fix: stabilize RabbitMQ signer connection`. PRs should include the problem, approach, validation steps, linked issues, and screenshots for frontend changes. Call out any required `.env` or Docker updates explicitly.

## Configuration & Environment Tips
Copy `backend/.env_model` to `backend/.env` before running the API. Docker services read `docker/.env`. Frontend overrides should use Vite variables such as `VITE_API_BASE_URL` or `VITE_API_PORT`.
