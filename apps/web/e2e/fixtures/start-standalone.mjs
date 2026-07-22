import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(fixtureDirectory, "../..");
const standaloneRoot = path.join(webRoot, ".next", "standalone");

async function replaceDirectory(source, target) {
  await rm(target, { force: true, recursive: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
}

await Promise.all([
  replaceDirectory(
    path.join(webRoot, "public"),
    path.join(standaloneRoot, "public"),
  ),
  replaceDirectory(
    path.join(webRoot, ".next", "static"),
    path.join(standaloneRoot, ".next", "static"),
  ),
]);

process.env.HOSTNAME ??= "127.0.0.1";
process.env.PORT ??= "3103";

await import(pathToFileURL(path.join(standaloneRoot, "server.js")).href);
