import { existsSync, statSync } from "node:fs";
import path from "node:path";

export function resolvePythonExecutable({
  env = process.env,
  isWindows = process.platform === "win32",
  backendDir,
  pathExists = existsSync,
  pathIsFile = (candidate) => statSync(candidate).isFile(),
  log = () => {},
}) {
  if (!backendDir) {
    throw new Error("backendDir is required to resolve the integration Python");
  }
  const pathApi = isWindows ? path.win32 : path.posix;
  const pinName = "CHAOTANG_INTEGRATION_PYTHON";
  if (Object.prototype.hasOwnProperty.call(env, pinName)) {
    const configuredPython = String(env[pinName] ?? "").trim();
    if (
      !configuredPython ||
      !pathApi.isAbsolute(configuredPython) ||
      !pathExists(configuredPython) ||
      !pathIsFile(configuredPython)
    ) {
      throw new Error(
        "CHAOTANG_INTEGRATION_PYTHON must name an existing absolute file path",
      );
    }
    return configuredPython;
  }

  const venvPython = isWindows
    ? pathApi.join(backendDir, ".venv", "Scripts", "python.exe")
    : pathApi.join(backendDir, ".venv", "bin", "python");
  if (pathExists(venvPython)) {
    return venvPython;
  }
  const fallback = isWindows ? "python" : "python3";
  log(
    `警告：未找到 ${venvPython}，回退使用 PATH 中的系统 ${fallback}` +
      "（需已安装 backend 依赖，否则后端进程会启动失败）。",
  );
  return fallback;
}
