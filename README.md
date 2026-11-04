# Hello Todo

An independently owned application that runs inside the Atlas shell. This repository owns the todo frontend, BFF, PostgreSQL schema, read API, tests and deployment package. Atlas owns the platform, shared libraries, shell and approved environment bindings.

## Status

Extracted from [Atlas draft PR #115](https://git.onebrief.tools/Onebrief/atlas/pull/115). Published-dependency installation, typecheck, frontend build and real PostgreSQL/API tests pass. This is a local POC, not a production deployment. The earlier Atlas-hosted demo remains available during migration.

The Atlas packages are pinned to the compatible `0.1.0` release set because the published federation configuration requires SDK/UI `0.1.0` shared singletons. Upgrade the shell, SDK, UI and federation configuration together.

## Install and run

Use Node 26.12.1 and pnpm 11.23.0. Configure approved Nexus read credentials outside this repository, using the same setup as `@onebrief/ux-kit`.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm contracts
pnpm build
pnpm poc:setup
pnpm poc:start
```

The app runs at http://localhost:4711. The app builds and serves without an Atlas source checkout. To display it in the shell, use a separately installed Atlas checkout with its shell frontend built:

```sh
ATLAS_CHECKOUT=/absolute/path/to/atlas pnpm poc:shell
```

Open http://localhost:4710 and sign in as Priya. `poc:shell` launches the existing Atlas shell with `ATLAS_ENABLED_APPS=hello-todo` and public/internal URLs pointing to port 4711. It neither copies nor modifies Atlas source. The shell reads this app's generated `atlas-app.json` and loads its federation remote.

## Existing demo data

The extracted app uses the same `atlas-hello-todo-poc` Compose project, database names and named volume as the earlier POC. Before first setup on a machine with that POC, copy its private `.local/hello-todo/config.json` into this repository's `.local/hello-todo/config.json`, retaining mode 600 and a private parent directory. Do not generate new credentials against the existing volume. Do not delete the volume to switch repositories.

## BC integration

`GET http://localhost:4711/api/v1/todos` requires the backend-only read token. It returns the one configured Atlas demo owner's list. It rejects owner selection and cannot mutate todos. The versioned OpenAPI definition is `api/openapi.json`; `examples/bc-client.mjs` is a backend client. The schema/client are not yet published as a separate contract package.

In the BC checkout, run:

```sh
HELLO_TODO_CHECKOUT=/absolute/path/to/hello-todo node scripts/atlas-todos-local.mjs
```

The BC launcher reads the ignored private config and points BC at port 4711. BC's development-only Atlas Todos admin page is below Feature flags. It does not map BC users or tenants to Atlas identities. Its full browser walkthrough also requires a healthy BC database.

## Validation

```sh
pnpm typecheck
pnpm build
pnpm contracts --check
pnpm poc:test
pnpm poc:fetch
```

Database tests use a separate `_test` database and prove CRUD, owner isolation, read-only service access, response shape, runtime database privileges, concurrent list limits and persistence across backend restart. Add and complete a todo in Atlas, refresh it in BC, restart this backend, and refresh again; IDs and completion states must persist. A passing local test does not establish production identity, deployed networking, backup/recovery or container-image execution.

`pnpm poc:fetch` prints the configured demo list, never its token. `node scripts/local.mjs stop-db` stops Postgres without deleting data.

## Storage and trust

The app owns `hello_todo.todos`. Owner-scoped reads use an `(owner_id, position)` index. Each owner has at most 100 todos; titles are limited to 200 characters. Owner count is not globally capped. Rows remain until explicitly deleted; there is no automatic retention, audit history or backup policy in this POC.

Schema-owner credentials run migrations. The service role has only schema usage, table CRUD and sequence access. The migration is safe to repeat. Local setup provisions the demo infrastructure; shared deployment must instead consume Atlas-provisioned database/roles/secrets and approved network paths.

The shell uses name-only demo sign-in. A fixed bearer credential is a POC service binding, not production service identity or tenant authorization.

## Packaging boundary

The Dockerfile builds from this repository root using Nexus credentials and CA trust as BuildKit secrets. It consumes the committed lockfile. It no longer depends on an Atlas workspace Docker context.

The app chart consumes the published `atlas-app` Helm library. Fetch an approved publication with `scripts/prepare-chart.mjs`, using `ATLAS_CHART_REF`, `ATLAS_CHART_VERSION` and `ATLAS_CHART_SHA256` from its build record. The downloaded dependency is ignored, not copied from Atlas source. Supply the library archive before rendering or packaging the chart.

The runtime Secret `hello-todo-runtime` must contain `TODO_DATABASE_URL`, `TODO_BC_READ_TOKEN` and `TODO_BC_OWNER_ID`. Owner credentials belong only in a migration job. Shared deployment still needs migration execution, namespace approval, database/BC network admission, production identity and backup/retention decisions. The current shell-only chart network rules are insufficient for a database-backed deployment. No artifacts are published automatically by this repository yet.

Atlas PR #115 is the superseded in-repository implementation; do not merge it as the permanent home of this app. Any necessary Atlas platform changes should be reviewed separately from this application's code.
