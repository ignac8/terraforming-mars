#!/usr/bin/env bash
# Boots the assembled nodejs-project with the `node` on PATH, then creates a
# game and reads it back through the HTTP API. Run it with Node 18 (nvm use 18)
# to exercise the same runtime major the app embeds.
#
# Usage: android/smoke-test.sh [project dir]   (default: android/build/nodejs-project)
set -euo pipefail

ANDROID_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
PROJECT="${1:-$ANDROID_DIR/build/nodejs-project}"
PORT="${PORT:-8391}"
BASE="http://127.0.0.1:$PORT"
WORK=$(mktemp -d)
LOG="$WORK/server.log"

die() { echo "smoke-test.sh: $*" >&2; [ -f "$LOG" ] && tail -30 "$LOG" >&2; exit 1; }

[ -f "$PROJECT/main.js" ] || die "no nodejs-project at $PROJECT"

# Run from a scratch copy so the checked-in project stays free of db/ files.
cp -R "$PROJECT" "$WORK/nodejs-project"
echo "node $(node --version), project $PROJECT"
node "$WORK/nodejs-project/main.js" --port "$PORT" > "$LOG" 2>&1 &
SERVER_PID=$!
cleanup() {
    # The server dies by SIGTERM, so its wait status is never zero; that must
    # not become the script's exit code.
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    rm -rf "$WORK"
}
trap cleanup EXIT

for _ in $(seq 1 120); do
    if curl -fsS -o /dev/null "$BASE/" 2>/dev/null; then
        break
    fi
    kill -0 $SERVER_PID 2>/dev/null || die "the server exited"
    sleep 0.25
done
curl -fsS -o /dev/null "$BASE/" || die "the server did not answer on $BASE"

# The client bundle the WebView asks for, in the encoding it asks for.
for asset in main.js vendors.js styles.css; do
    encoding=$(curl -fsS -H 'Accept-Encoding: br' -o /dev/null -w '%{http_code} %{size_download}' "$BASE/$asset") \
        || die "GET /$asset failed"
    echo "GET /$asset (br): $encoding"
done
curl -fsS -o /dev/null "$BASE/assets/index.html" || die "GET /assets/index.html failed"
curl -fsS -o /dev/null "$BASE/favicon.ico" || die "GET /favicon.ico failed"

# The app has no network: OfflineRequests serves the Google Fonts stylesheet
# for Ubuntu from its assets and answers anything else off the phone with a
# 404, so a new off-device link in the page would go missing in the app.
PAGE=$(curl -fsS "$BASE/") || die "GET / failed"
OFF_DEVICE=$(grep -oE '(src|href)="(https?:)?//[^"]*"' <<< "$PAGE" \
    | grep -vxF 'href="https://fonts.googleapis.com/css?family=Ubuntu&display=swap"' || true)
[ -z "$OFF_DEVICE" ] || die "the page links off the phone, which the app answers with a 404: $OFF_DEVICE"

CONFIG='{
  "players": [{"name": "Robot", "color": "blue", "beginner": false, "handicap": 0, "first": true}],
  "expansions": {"corpera": true, "promo": false, "venus": false, "colonies": false, "prelude": false,
    "prelude2": false, "turmoil": false, "community": false, "ares": false, "moon": false,
    "pathfinders": false, "ceo": false, "starwars": false, "underworld": false, "deltaProject": false},
  "board": "tharsis", "seed": 0.5, "randomFirstPlayer": false, "undoOption": false, "showTimers": false,
  "fastModeOption": false, "showOtherPlayersVP": false, "aresExtremeVariant": false,
  "politicalAgendasExtension": "Standard", "solarPhaseOption": false,
  "removeNegativeGlobalEventsOption": false, "modularMA": false, "draftVariant": false,
  "initialDraft": false, "preludeDraftVariant": false, "ceosDraftVariant": false,
  "startingCorporations": 2, "shuffleMapOption": false, "randomMA": "No randomization",
  "includeFanMA": false, "soloTR": false, "customCorporationsList": [], "bannedCards": [],
  "includedCards": [], "customColoniesList": [], "customPreludes": [],
  "requiresMoonTrackCompletion": false, "requiresVenusTrackCompletion": false,
  "moonStandardProjectVariant": false, "moonStandardProjectVariant1": false, "altVenusBoard": false,
  "twoCorpsVariant": false, "customCeos": [], "startingCeos": 0, "startingPreludes": 0
}'
GAME=$(curl -fsS -H 'Content-Type: application/json' -d "$CONFIG" "$BASE/api/creategame") \
    || die "POST /api/creategame failed"
GAME_ID=$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$GAME")
PLAYER_ID=$(node -e 'console.log(JSON.parse(process.argv[1]).players[0].id)' "$GAME")
echo "created game $GAME_ID, player $PLAYER_ID"

PLAYER=$(curl -fsS "$BASE/api/player?id=$PLAYER_ID") || die "GET /api/player failed"
node -e '
  const model = JSON.parse(process.argv[1]);
  if (model.id !== process.argv[2]) throw new Error("player model is for " + model.id);
  if (model.game.phase === undefined) throw new Error("no game phase in the player model");
  console.log("player model: phase " + model.game.phase + ", " + model.dealtCorporationCards.length + " corporations dealt");
' "$PLAYER" "$PLAYER_ID"

[ -f "$WORK/nodejs-project/db/files/$GAME_ID.json" ] || die "the game was not saved to db/files"
echo "saved: db/files/$GAME_ID.json ($(wc -c < "$WORK/nodejs-project/db/files/$GAME_ID.json") bytes)"

# The app's admin button relies on the fixed server id main.js sets.
curl -fsS -o /dev/null "$BASE/admin?serverId=offline" || die "GET /admin?serverId=offline failed"
GAMES=$(curl -fsS "$BASE/api/games?serverId=offline") || die "GET /api/games?serverId=offline failed"
node -e '
  const games = JSON.parse(process.argv[1]);
  if (!games.some((game) => game.gameId === process.argv[2])) throw new Error("games overview lacks " + process.argv[2] + ": " + process.argv[1]);
  console.log("admin panel lists the game (" + games.length + " game(s))");
' "$GAMES" "$GAME_ID"

# Play the first move: pick the first corporation and no project cards.
CORPORATION=$(node -e 'console.log(JSON.parse(process.argv[1]).dealtCorporationCards[0].name)' "$PLAYER")
INPUT=$(node -e 'console.log(JSON.stringify({type: "initialCards", responses: [
  {type: "card", cards: [process.argv[1]]}, {type: "card", cards: []}]}))' "$CORPORATION")
AFTER=$(curl -fsS -H 'Content-Type: application/json' -d "$INPUT" "$BASE/player/input?id=$PLAYER_ID") \
    || die "POST /player/input failed"
node -e '
  const model = JSON.parse(process.argv[1]);
  if (!model.thisPlayer.tableau.some((card) => card.name === process.argv[2])) throw new Error("corporation was not kept: " + JSON.stringify(model.thisPlayer.tableau));
  console.log("played: corporation " + process.argv[2] + ", now in phase " + model.game.phase);
' "$AFTER" "$CORPORATION"

# The database must survive a server restart: stop it, start it again and
# find the same game, with the move, behind the same player id.
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null || true
echo "server stopped; starting it again"
node "$WORK/nodejs-project/main.js" --port "$PORT" >> "$LOG" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 120); do
    if curl -fsS -o /dev/null "$BASE/" 2>/dev/null; then
        break
    fi
    kill -0 $SERVER_PID 2>/dev/null || die "the restarted server exited"
    sleep 0.25
done
RELOADED=$(curl -fsS "$BASE/api/player?id=$PLAYER_ID") || die "GET /api/player after the restart failed"
node -e '
  const model = JSON.parse(process.argv[1]);
  if (model.id !== process.argv[2]) throw new Error("reloaded player model is for " + model.id);
  if (!model.thisPlayer.tableau.some((card) => card.name === process.argv[3])) throw new Error("the move was lost");
  console.log("reloaded after restart: player " + model.id + ", corporation " + process.argv[3] + ", phase " + model.game.phase);
' "$RELOADED" "$PLAYER_ID" "$CORPORATION"
[ -f "$WORK/nodejs-project/db/files/$GAME_ID.json" ] || die "db/files/$GAME_ID.json is gone after the restart"

if grep -qiE "uncaught exception|TypeError|ReferenceError" "$LOG"; then
    die "the server log has errors"
fi
# main.js keeps the server's output in logs/server.log for the diagnostics bundle.
grep -q "Server is ready" "$WORK/nodejs-project/logs/server.log" || die "logs/server.log lacks the server's own output"
echo "logs/server.log: $(wc -l < "$WORK/nodejs-project/logs/server.log") lines"
echo "smoke test passed"
