#!/usr/bin/env bash
# Deploys QuizClash to Cloudflare: creates the D1 database the first time, applies
# migrations, then deploys the Worker (API + game server + website).
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME="quizclash-db"

find_db_id() {
  npx wrangler d1 list --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try { const db = JSON.parse(s).find((d) => d.name === process.argv[1]); process.stdout.write(db ? (db.uuid || db.id) : ""); }
      catch { process.stdout.write(""); }
    });' "$DB_NAME"
}

DB_ID="$(find_db_id)"
if [ -z "$DB_ID" ]; then
  echo "Creating D1 database $DB_NAME…"
  npx wrangler d1 create "$DB_NAME" --location "${D1_LOCATION:-oc}" --no-update-config
  DB_ID="$(find_db_id)"
fi
if [ -z "$DB_ID" ]; then
  echo "Could not find or create the D1 database. Check the API token has D1 Edit permission." >&2
  exit 1
fi
echo "Using D1 database $DB_NAME ($DB_ID)"

# Point wrangler.toml at the real database (only in this checkout; never committed).
sed -i.bak -E "s/^database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml && rm -f wrangler.toml.bak

npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
