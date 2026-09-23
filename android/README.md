# Android app (offline)

A standalone Android APK of Terraforming Mars: the game server, its database,
the web client and a Node.js runtime, all inside one app. Nothing talks to
the network, so it plays on a plane. Games are MarsBot games only: one human
seat on this phone against the bot.

## How it works

```
APK
├── lib/<abi>/libnode.so          nodejs-mobile v18.20.4 (a Node.js built for Android)
├── lib/<abi>/libnative-lib.so    JNI glue: NodeRuntime.startNode() → node::Start()
├── assets/fonts/                 the Ubuntu font the page links from Google Fonts (see below)
└── assets/nodejs-project.zip     unzipped into the app's files dir on first launch:
    ├── main.js                   launcher: polyfills, env, chdir, require('./server.js')
    ├── server.js                 the game server, esbuild-bundled into one file
    ├── build/                    client bundle (main.js, vendors.js, chunks/) + styles.css
    ├── assets/                   images, fonts, index.html
    └── db/files/                 the LocalFilesystem database (created at runtime, kept across updates)
```

- `MainActivity` picks a free port, unpacks the project out of the APK (only
  when the app version changed; `db/` is left alone), starts Node on its own
  thread and shows a full-screen `WebView` on `http://127.0.0.1:<port>/` once
  the server answers. The last page is remembered, so reopening the app lands
  back in the game. Back navigates the WebView; links off the server open in
  the system browser. A game page has no links out of it, so the round
  button in the bottom-right corner opens a menu: the main menu (`/`), the
  saved games (`/games-overview?serverId=offline`, one join link per seat),
  the admin panel (`/admin?serverId=offline`, with the stats and metrics
  pages for debugging) and the diagnostics bundle.
- The WebView never goes to the network. A page draws nothing until its
  stylesheets load, and the game's `index.html` links the Ubuntu font from
  Google Fonts, so on a connection that does not answer every page change
  hung until the network timed out. `OfflineRequests` answers every request
  that is not for the local server: the Google Fonts stylesheet and font
  files come from `assets/fonts/` (what Google Fonts serves a current
  Chrome, under the Ubuntu Font Licence in `UFL.txt`), anything else gets an
  empty 404 at once and a line in the app log. `smoke-test.sh` fails when
  the page links anything else off the phone.
- The server runs the code of the game checkout, configured through the
  environment the launcher sets: `HOST=127.0.0.1`, `LOCAL_FS_DB` (the
  JSON-files database), `NODE_ENV=production`, `SERVER_ID=offline` (fixed,
  so the admin button works; the server only listens on the phone's own
  loopback). The one game-code change on this branch is a build-time
  switch: `webpack.config.js` defines `process.env.TM_MARSBOT_ONLY`, off by
  default. When it is `1`, `CreateGameForm.vue` fixes one human seat with
  MarsBot on and hides, rather than greys out, everything that cannot be
  changed in such a game: the player count, the MarsBot toggle, the board
  (Tharsis), the first player, the options and fan expansions MarsBot
  disables, the Discord invite. `build-apk.sh` always rebuilds the client
  with the switch on, so a normal `npm run build` of this branch behaves like
  `automa`.
- nodejs-mobile only ships Node 18, so `main.js` polyfills the ES2023
  array methods (`toSorted` and friends) the server uses, and `build-apk.sh`
  bundles the server with esbuild because Node 18 cannot `require()` the
  ESM-only packages (`uuid`, `html-escaper`, `ansi-escape-sequences`) the
  server depends on. The native database drivers (`pg`, `better-sqlite3`)
  are replaced by empty stubs; the app never uses them.

## Building

Prerequisites:

- Node from the game checkout's `.nvmrc` (`nvm use`), `curl`, `unzip`.
- JDK 17 or newer (`keytool` comes with it).
- An Android SDK at `ANDROID_HOME` with `cmdline-tools/latest`; the script
  installs `platforms;android-35`, `build-tools;35.0.0`, `ndk;27.2.12479018`
  and `cmake;3.22.1` through `sdkmanager` when they are missing (about 3 GB).
- The build uses this checkout; `MAIN_CHECKOUT=/path/to/checkout` builds
  another one.

```bash
export ANDROID_HOME=~/android-sdk
android/build-apk.sh                  # npm ci + npm run build in the checkout, then the APK
SKIP_GAME_BUILD=1 android/build-apk.sh   # reuse node_modules and the server build; styles and the client are rebuilt
ANDROID_ABIS=arm64-v8a,x86_64 android/build-apk.sh   # add an emulator ABI (about 65 MB more)
```

The APK lands in `android/out/` as `terraforming-mars-<date>-<game sha>-<abis>.apk`
(and a copy named `terraforming-mars.apk`). The first build downloads
Gradle, the Android Gradle plugin and the nodejs-mobile zip (57 MB, cached
in `android/.cache/`).

`android/smoke-test.sh` boots the assembled project (`android/build/nodejs-project`)
with the `node` on PATH, fetches the client bundle, creates a game, checks
that the admin panel lists it, plays its first move, restarts the server and
finds the game again behind the same player id. Run it under Node 18 (`nvm use 18`) to exercise the runtime
major the app embeds; CI does the same after every build.

### GitHub Actions

`.github/workflows/android-apk.yml` builds the same thing on GitHub. Run it
from the Actions tab on the branch to build (this branch, `automa-android`,
carries the app; the branch picker is the game version); it uploads the APK
as a workflow artifact and, for manual runs, publishes it on the rolling
`android-latest` release, so the phone can download `terraforming-mars.apk`
from that release page directly. It also runs on pushes to `automa-android`
that touch `android/`.

### Signing

Android installs an update only over an app signed with the same key. The
build signs with `android/keystore/release.jks` (gitignored) and generates
that keystore on the first run; keep it, or pass your own through
`ANDROID_KEYSTORE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD`. For CI, store the same keystore in the repository
secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 release.jks`),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`;
without them every CI build signs with a fresh throwaway key and the phone
needs an uninstall before it takes the next one (saved games go with it).

## Installing and playing

1. Copy the APK to the phone (or open the release link in its browser) and
   open it; allow installs from that source when Android asks.
2. Start the app; the first launch takes a few seconds longer while it
   unpacks the project. Create a game as usual; the form only shows what a
   MarsBot game lets you change.
3. The round button in the corner is the way out of a game page: "Main
   menu" for the start screen, "Saved games" to get back into a game.
4. The client is laid out for a 1260px desktop viewport and is scaled to the
   screen; pinch to zoom. A tablet, or a phone in landscape, is the
   comfortable size.

Saved games live in the app's private storage
(`/data/data/it.zerko.terraformingmars/files/nodejs-project/db/files/`) and
survive app updates; uninstalling the app deletes them.

## Getting logs

Tap the round corner button and choose "Share diagnostics" (the screen
shown when the server fails to start has the same button), then pick where
to send the zip: mail, Drive, a chat. It holds everything needed to
troubleshoot:

- `logs/server.log` (and `.1`): the game server's own output, which
  `main.js` keeps on disk next to the database, rotated at 2 MB.
- `logs/app.log`: the Android side (project install, server start, WebView
  console messages such as client-side JavaScript errors).
- `logcat.txt`: this process's logcat lines, including native crash
  information when the runtime itself died.
- `info.txt`: app version, Android version, device, ABIs, memory page size.
- `games/*.json`: the saved games, so a state can be reproduced.

Both log folders survive app updates. With a computer, `adb logcat -s
TerraformingMars` shows the same output live.

## Known limits

- **Node 18.** nodejs-mobile's newest release is v18.20.4 (October 2024).
  Anything in the server that needs a newer runtime shows up as a crash in
  logcat at start; add the missing shim to `nodejs-project/main.js`.
- **4 KB page size only.** The prebuilt `libnode.so` is aligned for 4 KB
  memory pages. Devices whose kernel runs with 16 KB pages (a setting some
  Android 15+ devices ship with) refuse to load it; there the fix is a
  nodejs-mobile rebuild with 16 KB alignment, which this repo does not do.
- **One runtime per process.** Node cannot be restarted inside a process,
  so the app keeps one server for its lifetime. Android may kill the app in
  the background; the next launch starts a fresh server and reopens the
  last page. Every action is saved to disk before it is acknowledged, so
  nothing is lost.
- **Desktop-sized UI.** The app does not restyle the client for phones.
