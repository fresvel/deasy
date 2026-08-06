# Handoff — `saveTemplateArtifactDraft`: the safety net first, the cut second

> Paste the "PROMPT" block as the first message of a new session. Everything you need is either here
> or in `docs/auditoria-god-objects-2026-07.md` (§3.1 covers cuts #1–#9 and cut #10, §3.1.b the two
> production defects).
>
> State: `develop @039ecfb`, clean tree. God Object #1 CLOSED. Cut #10 CLOSED.

> **Note on language.** This handoff is in English, but the repository is not: code comments, commit
> messages and the docs under `docs/` are all written in Spanish. Keep writing them in Spanish.

---

## PROMPT (paste this as your first message)

```
I'm continuing to bring down complexity in the Deasy backend. Ten cuts closed God Object #1
(SqlAdminService.js: 5924 -> 897 L), and cut #10 turned `validateTableRules` from a CC 99 switch
into a registry: its S3776 closed as FIXED.

One big target is left, and it is the worst in the backend by a factor of two:
`saveTemplateArtifactDraft` (backend/services/admin/SqlAdminService.templateLifecycle.js:966),
541 lines, CC 158. Cut #8 moved it LITERALLY and said so in the commit; Sonar measures exactly that.

Read docs/auditoria-god-objects-2026-07.md first (§1.b and cut #10), then this handoff.

THE HARD PART IS NOT SPLITTING IT, IT IS THE SAFETY NET. Its route is multipart with file uploads,
it writes to five places (MinIO included), and it has no golden. On top of that the characterization
harness cannot send multipart: `lib/http.mjs` forces Content-Type: application/json on every request.

So the work splits in two phases, and PHASE 1 is the real deliverable:
  PHASE 1  multipart support in the harness + a self-cleaning `zz_artifact_draft` flow pinning both
           branches (POST create / PUT edit) and their error contracts. WITHOUT touching the service.
  PHASE 2  decompose the function, with phase 1 green and the goldens IDENTICAL.

Start with PHASE 1. Before writing any code, MEASURE the real state and propose the plan to me.

Note: the repo is in Spanish. Write code comments and commit messages in Spanish.
```

---

## Why this function and not another

After cut #10, the backend complexity leaderboard (Sonar at `@9e91711`):

| CC | Where |
|---:|---|
| **158** | `SqlAdminService.templateLifecycle.js:966` → `saveTemplateArtifactDraft` |
| 75 | `controllers/users/user_controler.js:1868` → `createGeneralTask` (God #2) |
| 59 / 49 | `backend/config/postgres.js:111` / `:47` — SQL dialect rewrites |
| 36 | `SqlAdminService.js:261` → `list()` |

It carries **twice** the complexity of the next one. And its own file holds two smaller members of the
same cluster (`:508` CC 18, `:643` CC 23) that will likely fall out as a side effect.

---

## Anatomy: 541 lines in eight phases

It reads top to bottom and the boundaries are clean — this is a textbook *Compose Method*, not a
tangle.

| # | Lines | What it does |
|---|---|---|
| 1 | 969–1050 | **Input validation.** displayName, national ID, `isEdit`, immutability guard (only drafts are editable), mandatory process, default seed, mandatory reference document, mandatory fill workflow unless `routed` |
| 2 | 1052–1078 | **Owner resolution** (`ownerRef` / `ownerPersonId`) |
| 3 | 1079–1102 | **Identity and paths**: `templateCode`, `storageVersion`, `baseObjectPrefix`, temporary `draftDir` |
| 4 | 1105–1163 | **Seed materialization** into `draftDir` (MinIO download, LaTeX branch, preservation of existing formats) |
| 5 | 1170–1203 | **Writing the uploaded files** and computing `availableFormats` |
| 6 | 1209–1240 | **Parsing** `schema_fields`, meta and both workflows (JSON that may arrive as a string) |
| 7 | 1249–1310 | **Custom workflow validation**: cargos, process scope, `workflowErrors`, authoring warnings |
| 8 | 1311–1505 | **Writing**: meta.yaml + manifest, MinIO upload, INSERT/UPDATE, process link, workflow sync, and the `catch` compensation |

---

## What it WRITES (this defines the round-trip cleanup)

Create branch, in order:

1. `deliverables` — INSERT, **or reuses** the existing row with the same `code`
2. `template_artifacts` — INSERT (`lifecycle_state = 'draft'`)
3. `process_definition_templates` — INSERT of the link (or UPDATE of `item_mode` if it already existed)
4. fill/signature flow templates and steps, via `_syncArtifactWorkflowsForTemplateArtifactId`
5. **MinIO objects** under `baseObjectPrefix`, plus a temporary directory under `BACKEND_STORAGE_ROOT`
   (this one is always removed, in the `finally`)

### Three things to know before designing the test

**`templateCode` is deterministic**: `draft_<slugify(display_name)>`. Two runs with the same
`display_name` reuse the SAME `deliverables` row (lookup is by `code`), but
`_getNextStorageVersionForTemplateCode` **bumps the version** on every run — so `baseObjectPrefix`
changes (`.../draft_x/1.0.0/`, `1.1.0/`…). Without full cleanup, every run leaves one more artifact
and one more prefix in MinIO, and any golden capturing the version will drift.

**There is no database transaction.** The phase 8 block uses `this.pool.query` directly, not
`runInTransaction`. The `try/catch` is manual compensation, not atomicity.

**The compensation looks incomplete — verify this before touching anything.** The create-branch
`catch` deletes the `template_artifacts` row and the MinIO prefix, but **not** the `deliverables` row
it just inserted, nor the link, nor the synced workflows. If it fails after the deliverable INSERT —
say, on "El proceso destino seleccionado no existe." — an orphan `deliverables` row survives and the
next run will reuse it by `code`. **I am not claiming this as a confirmed defect: test it.** If it is
one, the §3.1.b pattern applies — pin the broken behavior with a golden first, then fix it, so that
the golden diff **is** the proof of the fix.

---

## Phase 1 — the safety net (this session's deliverable)

### 1.a Multipart in the harness

`backend/tests/characterization/lib/http.mjs` sets `Content-Type: application/json` as soon as there
is a `body`. It needs a new path that sends `FormData`. Node 18+ ships native `FormData`, `Blob` and
`File`, and `fetch` serializes them on its own.

> **The trap**: do NOT set `Content-Type` by hand when the body is `FormData`. If you do, the
> `boundary` is missing and multer rejects the request. Let `fetch` set it.

You'll add an option (`form`) that coexists with the current one without changing the behavior of the
148 tests that already pass — `request()` must keep doing exactly what it does today when given a
`body`.

### 1.b The `zz_artifact_draft` flow

**The `zz_` prefix is mandatory.** Flows run in alphabetical order with `--test-concurrency=1`
(`npm run test:char`) and this one MUTATES the database. `zz_template_lifecycle` exists for the same
reason; order them among themselves carefully (`artifact` < `task` < `template`, so
`zz_artifact_draft` would run BEFORE the other two — decide whether that suits you or whether you
need a different name).

Routes and permissions:

```
POST /admin/sql/template_artifacts/draft        templates:create
PUT  /admin/sql/template_artifacts/draft/:id    templates:update
```

Both wrapped in `draftArtifactUpload.fields([pdf_file, docx_file, xlsx_file, pptx_file])`, `maxCount 1`
each (`backend/routes/sql_admin_router.js:98-119`).

What to pin, at minimum:

- **Happy POST** with a reference PDF and a one-step `fill_workflow` → 200, plus the response contract
  (`id`, `template_code`, `storage_version`, `available_formats`, `content_hash`, `__notice`). Mask
  ids and hashes: `content_hash` changes when the content changes, and `storage_version` depends on
  how many times it has been run.
- **Happy PUT** (`isEdit`) against that draft → 200.
- The **error contracts** of phase 1, which are cheap and cover half of its branches: no name, no
  process, no reference document, no workflow step (and that `routed` does **not** require one), and
  the immutability guard on a published template.
- **Cleanup at the end**: delete workflows → link → artifact → deliverable → MinIO prefix. The
  function's own `catch` (L1491-1502) is the reference recipe, but **it is missing the deliverable**.
  The signal that it went well is the usual one: the golden diff is **purely additive**, 0 deletions,
  and the `list_*` counts in `admin_crud` don't move.

> The generic CRUD `DELETE` removes the `template_artifacts` row but **does not touch MinIO**
> (`template_artifacts` has no `beforeRemove` in `tableHooks.js`). Prefix cleanup has to go through
> some other path; decide which one and say so in the commit.

Both branches already have verified smoke coverage (POST with a PDF → 200 with the artifact in MinIO;
PUT with `isEdit` → 200), so **the function works**: if your first attempt errors out, suspect the
test before the service.

---

## Phase 2 — the cut (only with phase 1 green)

The eight phases above are the natural *Extract Method* candidates. Two warnings:

- **This is not a registry.** Cut #10 made it clear that *Replace Conditional with Registry*
  simplifies while *Extract* merely moves. There is no key-based dispatch to register here: it's a
  sequence. Expect complexity to drop **proportionally less** than in cut #10, and don't fool yourself
  with the analogy.
- What does genuinely drop is nesting: a good share of those 158 are `if`s two and three levels deep
  inside the giant `try`. As standalone functions they start from zero.

Phases 1–3 are pure or nearly so (validation, owner resolution, path computation): extract them first,
they are testable without a pool and never touch MinIO. Phase 8 is the one to leave for last.

---

## NON-NEGOTIABLE rules (accumulated lessons from ten cuts)

1. **Extract BY SCRIPT** (python), not by hand, and **verify `count == 1`** before deleting each
   block. If the script chops code up, give it a **reconstruction invariant** (the pieces must
   reproduce the original line by line): in cut #10 that caught a chopper that counted braces but not
   parentheses and split a multi-line `if` down the middle.
2. **`node --check` validates SYNTAX, not imports. And checking that it BOOTS isn't enough either.** A
   symbol moved without its `import` is valid syntax, the module **loads**, and it blows up at CALL
   time. That's how four `ReferenceError`s from cuts #2/#3/#6 stayed broken for three weeks. Hence
   **`npm run check:imports`** — **always run it after moving code**.
3. **char green BEFORE and AFTER, with IDENTICAL goldens.** If a golden changes during a pure
   refactor, either you broke something or the test was wrong. In a *fix* they do change — and then
   the golden diff **is** the proof of the fix.
4. **Self-cleaning round-trips**, so the `list_*` counts don't move.
5. **Preserve the ORDER of the guards**: the characterized error contracts pin it.
6. **The unit net sees what char cannot.** In cut #10 two date validations went silent because a
   helper hadn't been generalized; char passed anyway, because no characterized route sends inverted
   validity dates. If you extract a pure function, give it a unit test.
7. **Don't inject special cases into the generic path.**
8. **Small commits**, on `develop`, stating what was verified and **what was NOT done**.
9. The user has **their own commits interleaved on `develop`** (docs/skills) — normal.

---

## Commands (everything inside the containers)

```bash
bash scripts/docker-env.sh dev exec -T backend npm run check:imports     # after moving code
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run     # 148 (compare)
bash scripts/docker-env.sh dev exec -T backend npm run test:char:capture # updates the golden
bash scripts/docker-env.sh dev exec -T backend npm run test:unit         # 209

# boot check (mandatory, rule 2)
bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev logs --tail 15 backend | grep -E "Servidor iniciado|SyntaxError|does not provide"
```

`test:char:run` **RESETS the dev database** (reset+bootstrap+seed): normal for char, and it leaves the
fixture seeded.

### Sonar — READ THIS BEFORE TRYING

```bash
docker compose -f scripts/sonar/compose.yml up -d          # :9002, ~30 s to come up
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh             # ~1.5 min
```

- **`admin:admin` does NOT work over basic auth**: SonarQube 26 removed it from the API. The password
  was reset through the database on 2026-08-06 and **today it is `admin`** again.
- **Tokens are obtained through a session**, not basic auth:
  ```bash
  curl -s -c cj.txt -X POST "http://localhost:9002/api/authentication/login" -d "login=admin&password=admin"
  XSRF=$(grep XSRF-TOKEN cj.txt | awk '{print $7}')
  curl -s -b cj.txt -H "X-XSRF-TOKEN: $XSRF" -X POST "http://localhost:9002/api/user_tokens/generate" -d "name=x"
  ```
  Once you have the token, `-u "$TOKEN:"` works for every other call.
- If the password ever needs resetting again: **the canonical snippet floating around the internet
  does NOT work on this version**. The hash is PBKDF2-HMAC-SHA512, 100,000 iterations, 64 bytes, with
  the salt **base64-DECODED to bytes** (not the string), and `crypted_password = "100000$<base64>"`.
- **Per-FILE history is purged** (Sonar only keeps project-level history). To compare, use the values
  documented in the audit.
- **Manual *won't fix* marks do NOT survive code moving between files.** Review the BLOCKERs after
  every refactor before reading the ratings. Today's baseline: **0 BLOCKER**, 46 vulnerabilities,
  reliability C / security D, project cognitive complexity **8,781**.

---

## References

- `docs/auditoria-god-objects-2026-07.md` — §1.b the re-scan, §3.1 the ten cuts, §3.1.b the two
  production defects. **Update it when you close this.**
- `backend/tests/characterization/flows/zz_template_lifecycle.test.mjs` — the closest precedent: a
  `zz_` flow that mutates, with state shared across steps. This is the model to follow.
- char harness: `backend/tests/characterization/` (`lib/http.mjs` ← the one to modify,
  `lib/snapshot.mjs`, `normalize.mjs`, `auth.mjs`; `config.mjs` with `FIXTURE` and users).
- `backend/services/admin/SqlAdminService.tableHooks.js` — the CRUD hook contract.
- `backend/services/admin/SqlAdminService.validation.js` — the cut #10 registry, in case it helps as a
  model for "conditional into data".
- **Different track, don't mix them in**: `SIGUIENTE-SESION-fase5-y-X.md` is the FRONTEND refactor.
