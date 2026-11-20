import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sources } from "../src/data/sources";

const root = "legal-sources";
const snapshotDir = join(root, "snapshots");
const manifestPath = join(root, "manifest.json");
type Entry = { url: string; file: string; sha256: string };
type Manifest = Record<string, Entry>;
const ids = Object.keys(sources);
const selected = process.argv.slice(3);
const targets = selected.length ? selected : ids;
const command = process.argv[2];
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

function snapshot(id: string) {
  const source = sources[id];
  const url = source.snapshotUrl ?? source.url;
  const file = id + (/\.pdf(?:[/?]|$)/i.test(url) ? ".pdf" : ".html");
  return { url, file };
}

async function forTargets(work: (id: string) => Promise<void>) {
  const queue = targets.slice();
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: Math.min(6, queue.length) }, async () => {
      let id;
      while ((id = queue.shift()) !== undefined) {
        try {
          await work(id);
        } catch (error) {
          failures.push(id + ": " + (error instanceof Error ? error.message : String(error)));
        }
      }
    }),
  );
  if (failures.length) throw new Error(failures.join("\n"));
}

async function main() {
  for (const id of targets) {
    if (!Object.hasOwn(sources, id)) throw new Error("Nieznane źródło " + id);
  }
  switch (command) {
    case "fetch":
      await mkdir(snapshotDir, { recursive: true });
      await forTargets(async (id) => {
        const { url, file } = snapshot(id);
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20_000),
          headers: { "User-Agent": "Mila/0.1 (official source verification)" },
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = Buffer.from(await response.arrayBuffer());
        if (
          !data.length ||
          (file.endsWith(".pdf") && !data.subarray(0, 5).equals(Buffer.from("%PDF-")))
        ) {
          throw new Error("Nieoczekiwany format pliku");
        }
        await writeFile(join(snapshotDir, file), data);
        console.log(id, file, hash(data));
      });
      break;
    case "hash": {
      const manifest: Manifest = selected.length
        ? JSON.parse(await readFile(manifestPath, "utf8"))
        : {};
      await forTargets(async (id) => {
        const { url, file } = snapshot(id);
        manifest[id] = { url, file, sha256: hash(await readFile(join(snapshotDir, file))) };
      });
      const ordered = Object.fromEntries(
        Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
      );
      await writeFile(manifestPath, JSON.stringify(ordered, null, 2) + "\n");
      console.log("Zapisano hashe ręcznie zweryfikowanych kopii.");
      break;
    }
    case "diff": {
      const manifest: Manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      await forTargets(async (id) => {
        const expected = manifest[id];
        const { url, file } = snapshot(id);
        if (!expected) throw new Error("Brak porównawczej sumy kontrolnej. Wymaga sprawdzenia.");
        if (
          expected.url !== url ||
          expected.sha256 !== hash(await readFile(join(snapshotDir, file)))
        ) {
          const { procedures } = await import("../src/data/procedures");
          const affected = procedures
            .filter((item) => item.sources.includes(id))
            .map((item) => item.id);
          throw new Error(
            "Źródło się zmieniło. Wymaga sprawdzenia. Powiązane procedury: " + affected.join(", "),
          );
        }
      });
      console.log("Sumy kontrolne kopii zgodne z manifestem.");
      break;
    }
    default:
      throw new Error("Użycie: bun run sources fetch|hash|diff [identyfikatory źródeł]");
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
