BEGIN;
SELECT pg_advisory_xact_lock(740001);
CREATE SCHEMA IF NOT EXISTS hello_todo;
CREATE TABLE IF NOT EXISTS hello_todo.todos (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 200),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  completed boolean NOT NULL DEFAULT false,
  position bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS todos_owner_position ON hello_todo.todos (owner_id, position);
REVOKE ALL ON SCHEMA hello_todo FROM PUBLIC;
REVOKE ALL ON hello_todo.todos FROM PUBLIC;
GRANT USAGE ON SCHEMA hello_todo TO hello_todo_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON hello_todo.todos TO hello_todo_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hello_todo TO hello_todo_runtime;
COMMIT;
