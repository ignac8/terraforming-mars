package it.zerko.terraformingmars;

import java.io.File;

/**
 * The embedded Node.js runtime that runs the game server.
 *
 * nodejs-mobile can start Node only once per process, so the runtime is a
 * process-wide singleton: the first Activity starts it on its own thread and
 * later Activities (after a configuration change) only reconnect to it.
 */
final class NodeRuntime {
  static {
    System.loadLibrary("node");
    System.loadLibrary("native-lib");
  }

  private static boolean started = false;

  private NodeRuntime() {
  }

  /** Runs Node with the given command line and extra KEY=VALUE environment entries. Blocks until Node exits. */
  private static native int startNode(String[] argv, String[] env);

  /** Starts the game server in {@code projectDir} on {@code port} unless it is already running in this process. */
  static synchronized void start(File projectDir, int port, File cacheDir) {
    if (started) {
      return;
    }
    started = true;
    String[] argv = {
      "node",
      new File(projectDir, "main.js").getAbsolutePath(),
      "--port", String.valueOf(port),
    };
    String[] env = {
      "TMPDIR=" + cacheDir.getAbsolutePath(),
      "HOME=" + projectDir.getParentFile().getAbsolutePath(),
    };
    Thread thread = new Thread(() -> {
      int code = startNode(argv, env);
      AppLog.e("Node exited with code " + code, null);
    }, "node-main");
    thread.start();
  }
}
