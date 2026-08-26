import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const inputPath = path.join(packageDir, "styles.generated.css");
const outputPath = path.join(packageDir, "styles.generated.ts");

const css = readFileSync(inputPath, "utf8");
const source = `export const MESURER_STYLES = ${JSON.stringify(css)};\n`;

if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== source) {
  writeFileSync(outputPath, source, "utf8");
}
rmSync(inputPath, { force: true });
