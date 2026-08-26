import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(extensionRoot, "dist");
const manifest = JSON.parse(await readFile(path.join(distRoot, "manifest.json"), "utf8"));
const requiredFiles = [
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
].filter(Boolean);

await Promise.all(
  requiredFiles.map(async (file) => {
    try {
      await access(path.join(distRoot, file));
    } catch {
      throw new Error(`Extension build is missing ${file}`);
    }
  }),
);

if (manifest.manifest_version !== 3) {
  throw new Error("Extension manifest must use Manifest V3");
}

console.log(`Validated extension build ${manifest.name} ${manifest.version}`);
