import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pdf = dirname(require.resolve("pdfjs-dist/package.json"));
const tesseract = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(createRequire(join(tesseract, "package.json")).resolve("tesseract.js-core"));
const polish = dirname(require.resolve("@tesseract.js-data/pol"));
const publicDir = "public/ocr";

await mkdir(publicDir, { recursive: true });
await Promise.all([
  cp(join(pdf, "LICENSE"), join(publicDir, "pdfjs-LICENSE.txt")),
  cp(join(pdf, "legacy/build/pdf.worker.min.mjs"), join(publicDir, "pdf.worker.min.mjs")),
  cp(join(pdf, "wasm"), join(publicDir, "pdf-wasm"), { recursive: true }),
  cp(join(pdf, "standard_fonts"), join(publicDir, "pdf-fonts"), { recursive: true }),
  cp(join(tesseract, "dist/worker.min.js"), join(publicDir, "tesseract.worker.min.js")),
  cp(join(tesseract, "LICENSE.md"), join(publicDir, "tesseract-LICENSE.txt")),
  cp(join(core, "LICENSE"), join(publicDir, "tesseract-core-LICENSE.txt")),
  cp(join(polish, "4.0.0/pol.traineddata.gz"), join(publicDir, "pol.traineddata.gz")),
  ...["", "-simd", "-relaxedsimd"].map((suffix) => {
    const file = `tesseract-core${suffix}-lstm.wasm.js`;
    return cp(join(core, file), join(publicDir, file));
  }),
]);
