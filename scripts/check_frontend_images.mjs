import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEGACY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif"]);
const RASTER_EXTENSIONS = new Set([...LEGACY_EXTENSIONS, ".webp"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const PORTRAIT_MARKERS = ["portrait", "avatar", "character-roster", "heroes"];
const PORTRAIT_LIMIT = 150 * 1024;
const BACKGROUND_LIMIT = 600 * 1024;
const TOTAL_LIMIT = 12 * 1024 * 1024;

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function displayPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export async function checkFrontendImages(root = process.cwd()) {
  const errors = [];
  const publicRoot = path.join(root, "frontend", "public");
  const publicFiles = await walk(publicRoot);
  let totalRasterBytes = 0;

  for (const filePath of publicFiles) {
    const extension = path.extname(filePath).toLowerCase();
    if (!RASTER_EXTENSIONS.has(extension)) continue;

    const relativePath = displayPath(root, filePath);
    const bytes = (await stat(filePath)).size;
    totalRasterBytes += bytes;

    if (LEGACY_EXTENSIONS.has(extension)) {
      errors.push(`${relativePath}: legacy raster format ${extension}`);
    }

    const normalizedPath = relativePath.toLowerCase();
    const isPortrait = PORTRAIT_MARKERS.some((marker) =>
      normalizedPath.includes(marker),
    );
    const limit = isPortrait ? PORTRAIT_LIMIT : BACKGROUND_LIMIT;
    if (bytes > limit) {
      errors.push(
        `${relativePath}: exceeds ${isPortrait ? "150 KiB" : "600 KiB"} limit (${bytes} bytes)`,
      );
    }
  }

  if (totalRasterBytes > TOTAL_LIMIT) {
    errors.push(
      `frontend/public raster assets exceed 12 MiB limit (${totalRasterBytes} bytes)`,
    );
  }

  const sourceRoot = path.join(root, "frontend", "src");
  const sourceFiles = (await walk(sourceRoot)).filter((filePath) =>
    SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
  );
  const referencePattern = /(["'])(\/(?:assets|heroes|shangshufang)\/[^"']+)\1/g;

  for (const sourcePath of sourceFiles) {
    const source = await readFile(sourcePath, "utf8");
    for (const match of source.matchAll(referencePattern)) {
      const reference = match[2].split(/[?#]/, 1)[0];
      const targetPath = path.join(publicRoot, ...reference.slice(1).split("/"));
      let targetIsFile = false;
      try {
        targetIsFile = (await stat(targetPath)).isFile();
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (!targetIsFile) {
        errors.push(
          `${displayPath(root, sourcePath)}: missing image reference ${reference}`,
        );
      }
    }
  }

  return errors;
}

const isCommand =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCommand) {
  const errors = await checkFrontendImages();
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("Frontend image audit passed.");
  }
}
