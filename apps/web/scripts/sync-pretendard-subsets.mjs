import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const PRETENDARD_VERSION = "1.3.9";
const SLICE_COUNT = 92;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(
  webRoot,
  "public",
  "fonts",
  "pretendard",
);
const cdnRoot =
  `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v${PRETENDARD_VERSION}`;
const cssUrl =
  `${cdnRoot}/dist/web/variable/pretendardvariable-dynamic-subset.min.css`;
const sliceRoot =
  `${cdnRoot}/packages/pretendard/dist/web/variable/woff2-dynamic-subset`;
const execFileAsync = promisify(execFile);

async function download(url) {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--retry",
      "3",
      "--connect-timeout",
      "15",
      "--max-time",
      "60",
      url,
    ],
    {
      encoding: null,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return stdout;
}

async function mapWithConcurrency(items, concurrency, task) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        await task(item);
      }
    }),
  );
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const upstreamCss = (await download(cssUrl)).toString("utf8");
const localCss = upstreamCss.replaceAll(
  "../../../packages/pretendard/dist/web/variable/woff2-dynamic-subset/",
  "./",
);
if ((localCss.match(/@font-face/g) ?? []).length !== SLICE_COUNT) {
  throw new Error("Unexpected Pretendard subset rule count");
}
await writeFile(
  path.join(outputDirectory, "pretendardvariable-dynamic-subset.min.css"),
  localCss,
);

await mapWithConcurrency(
  Array.from({ length: SLICE_COUNT }, (_, index) => index),
  8,
  async (index) => {
    const fileName = `PretendardVariable.subset.${index}.woff2`;
    const body = await download(`${sliceRoot}/${fileName}`);
    if (body.byteLength < 1_000) {
      throw new Error(`Pretendard slice is unexpectedly small: ${fileName}`);
    }
    await writeFile(path.join(outputDirectory, fileName), body);
  },
);
