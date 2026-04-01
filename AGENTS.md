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

## Frontend Design Policies
Frontend work must prioritize reuse of the shared design system before introducing new markup or styles. New UI elements should be built from existing global components and Tailwind semantic classes, not from ad hoc local styling.

### Reuse Rules
- Reuse global components from `frontend/src/components` before creating view-local UI primitives.
- Do not create wrappers around global components unless there is a clear functional need; prefer direct imports.
- Do not duplicate visual patterns already solved in another view. If a pattern already exists and is valid, extract or reuse it.
- If a new pattern is truly needed, generalize it as a reusable component instead of solving it only inside one page.

### Approved Global Bases
- Buttons: use `AppButton.vue`.
- Tables: use `AppDataTable.vue`.
- Modals: use `AppModalShell.vue` and `AppFormModalLayout.vue`.
- Tags/status badges: use `AppTag.vue`.
- Navigation cards and menu options: use `AppNavCard.vue`.
- File upload and drag & drop: use `PdfDropField.vue` and, when applicable, shared upload modals such as `DossierDocumentUploadModal.vue`.
- Page intros, sections, shells, and shared layout surfaces must use the global classes defined in `frontend/src/styles/tailwind.css`.

### Styling Rules
- Global visual behavior must live in `frontend/src/styles/tailwind.css` through semantic class families such as `deasy-btn-*`, `deasy-tag-*`, `deasy-nav-*`, `deasy-table-*`, `deasy-page-intro-*`, and related shared shells.
- Avoid inline Tailwind utility piles in views when the pattern is reusable or already standardized.
- Do not hardcode colors, radii, spacing, shadows, or typography in a page if the same concern is already covered by a shared class or component.
- Preserve semantic color meaning across the app: success, danger, warning, info, neutral, muted, accent, contrast.

### Source-of-Truth Visual References
- Tables and section shells: `perfil`
- Buttons and navigation cards: `admin`
- Layout menus and drag & drop file interactions: `firmas`
- Text and password input styling: `login`
- Tags and helper badges: `register`

### Implementation Criteria For New UI
- Before adding a new element, check whether an equivalent component already exists in `frontend/src/components`.
- Before adding a new class set in a view, check whether the pattern belongs in the shared Tailwind layer.
- New views should compose existing global components first and only add local structure for business-specific content.
- If a page needs a variant of an existing component, extend the shared component or shared class API instead of cloning the markup.

### Validation
- For frontend changes, run `cd frontend && pnpm run lint` or a targeted `pnpm exec eslint ...` pass over the touched files.
- When migrating UI, verify both appearance and behavior; a component is not considered standardized if it uses the shared component but overrides its skin into a different visual language.

## Testing Guidelines
There is no unified automated test suite yet. Treat `frontend` linting as the minimum validation for UI work. For backend changes, verify affected endpoints locally and document manual checks in the PR. If you add tests, place them near the changed module and name them `*.test.js` or `*.spec.js`; `backend/test_multisigner.js` is the closest existing example.

## Commit & Pull Request Guidelines
Recent history mixes conventional commits (`feat:`, `fix:`) with short Spanish summaries. Prefer concise, imperative subjects with an obvious scope, for example `fix: stabilize RabbitMQ signer connection`. PRs should include the problem, approach, validation steps, linked issues, and screenshots for frontend changes. Call out any required `.env` or Docker updates explicitly.

## Configuration & Environment Tips
Copy `backend/.env_model` to `backend/.env` before running the API. Docker services read `docker/.env`. Frontend overrides should use Vite variables such as `VITE_API_BASE_URL` or `VITE_API_PORT`.
