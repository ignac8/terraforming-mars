// Boots the Terraforming Mars server inside the Android app.
//
// The app runs this with nodejs-mobile as `node main.js --port <port>`. The
// folder it lives in is the copy of the packaged nodejs-project: server.js (the
// esbuild bundle of the game server), build/ (the client bundle and styles)
// and assets/ (images, fonts, index.html). The server serves everything
// relative to its working directory, so this script changes into its own
// folder before starting it.
'use strict';

const fs = require('fs');
const path = require('path');

// nodejs-mobile ships Node 18, which predates the ES2023 change-array-by-copy
// methods the server uses. Their semantics on plain arrays are a copy plus
// the mutating method.
function polyfill(proto, name, impl) {
  if (typeof proto[name] !== 'function') {
    Object.defineProperty(proto, name, {value: impl, writable: true, configurable: true, enumerable: false});
  }
}
polyfill(Array.prototype, 'toSorted', function(compareFn) {
  return this.slice().sort(compareFn);
});
polyfill(Array.prototype, 'toReversed', function() {
  return this.slice().reverse();
});
polyfill(Array.prototype, 'toSpliced', function(...args) {
  const copy = this.slice();
  copy.splice(...args);
  return copy;
});
polyfill(Array.prototype, 'with', function(index, value) {
  const copy = this.slice();
  const i = index < 0 ? copy.length + index : index;
  if (i < 0 || i >= copy.length) {
    throw new RangeError('Invalid index : ' + index);
  }
  copy[i] = value;
  return copy;
});

function argument(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

process.chdir(__dirname);

// The local filesystem database keeps games in ./db/files. The app preserves
// ./db when it replaces the rest of this folder on an update.
fs.mkdirSync(path.join(__dirname, 'db', 'files'), {recursive: true});

process.env.NODE_ENV = 'production';
process.env.HOST = '127.0.0.1';
process.env.PORT = argument('--port', '8384');
process.env.LOCAL_FS_DB = '1';
// A fixed id so the app can open the admin panel (games overview, stats) at
// /admin?serverId=offline. The server only listens on this phone's loopback.
process.env.SERVER_ID = 'offline';

// Keep a copy of the server's output on disk, next to the database, so the
// app can share it for troubleshooting without adb. Rotates at 2 MB; the app
// preserves ./logs across updates like ./db.
const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, {recursive: true});
const logFile = path.join(logDir, 'server.log');
const LOG_LIMIT = 2 * 1024 * 1024;
let logSize = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
function appendToLog(chunk) {
  try {
    const text = typeof chunk === 'string' ? chunk : chunk.toString();
    if (logSize + text.length > LOG_LIMIT) {
      fs.renameSync(logFile, logFile + '.1');
      logSize = 0;
    }
    fs.appendFileSync(logFile, text);
    logSize += text.length;
  } catch (e) {
    // Logging must never take the server down.
  }
}
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream);
  stream.write = (chunk, encoding, callback) => {
    appendToLog(chunk);
    return write(chunk, encoding, callback);
  };
}
appendToLog(`\n===== ${new Date().toISOString()} start =====\n`);

console.log(`Terraforming Mars offline: node ${process.version}, port ${process.env.PORT}, cwd ${process.cwd()}`);

require('./server.js');
