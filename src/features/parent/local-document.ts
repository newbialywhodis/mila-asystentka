import type { RenderTask } from "pdfjs-dist";
import type { Worker as OcrWorker } from "tesseract.js";
import { normalizeGuideText } from "../guide/textInput";
import { loadBrowserPdf } from "./browser-pdf";
import { isBirthRecord, readScanPages } from "./scan-evidence";
import type { ScanPage } from "./scan-evidence";

export type ScanProgress = { done: number; total: number };
export type ScanRange = "all" | { from: number; through: number };

const assets = "/ocr";
const maxPages = 100;
const maxBytes = 30_000_000;

async function untilAborted<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  let stop: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    stop = () => reject(signal.reason);
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
  });
  try {
    return await Promise.race([operation, aborted]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

export async function scanLocalDocument(
  file: File,
  signal: AbortSignal,
  onProgress: (progress: ScanProgress) => void,
  range?: ScanRange,
) {
  signal.throwIfAborted();
  if (file.size > maxBytes)
    throw new Error("Odczyt lokalny obsługuje PDF-y do 30 MB. Podgląd pozostaje dostępny.");
  const data = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  const loading = await loadBrowserPdf(data);

  let worker: OcrWorker | undefined;
  let render: RenderTask | undefined;
  const canvas = document.createElement("canvas");
  try {
    const pdf = await untilAborted(loading.promise, signal);
    if (!range && pdf.numPages > 30)
      return { kind: "scope" as const, total: pdf.numPages, maxPages };
    const { from, through } =
      !range || range === "all" ? { from: 1, through: pdf.numPages } : range;
    const total = through - from + 1;
    if (from < 1 || through > pdf.numPages || total < 1 || total > maxPages)
      throw new Error("Odczyt lokalny obsługuje do 100 stron naraz. Wybierz krótszy zakres.");
    const pages: ScanPage[] = [];
    onProgress({ done: 0, total });
    for (let number = from; number <= through; number++) {
      signal.throwIfAborted();
      const page = await untilAborted(pdf.getPage(number), signal);
      const content = await untilAborted(page.getTextContent(), signal);
      let text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("");
      let sparse: string | undefined;
      if (text.trim().length < 80) {
        if (!worker) {
          const { createWorker, OEM, PSM } = await import("tesseract.js");
          const startupSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
          const startup = createWorker("pol", OEM.LSTM_ONLY, {
            workerPath: `${assets}/tesseract.worker.min.js`,
            corePath: assets,
            langPath: assets,
            workerBlobURL: false,
            errorHandler: () => {},
          }).then((activeWorker) => {
            if (startupSignal.aborted) void activeWorker.terminate();
            return activeWorker;
          });
          worker = await untilAborted(startup, startupSignal);
          await untilAborted(worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }), signal);
        }

        const raw = page.getViewport({ scale: 1 });
        const scale = Math.min(240 / 72, 3000 / Math.max(raw.width, raw.height));
        const viewport = page.getViewport({ scale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        render = page.render({ canvas, viewport });
        await untilAborted(render.promise, signal);
        render = undefined;
        const pageSignal = AbortSignal.any([signal, AbortSignal.timeout(25_000)]);
        // Encode before dispatching to Tesseract so cancellation cannot terminate its
        // worker while it is still converting an HTMLCanvasElement into bytes.
        const blob = await untilAborted(
          new Promise<Blob | null>((resolve) => canvas.toBlob(resolve)),
          pageSignal,
        );
        if (!blob) throw new Error("Nie udało się wyrenderować strony PDF-u.");
        // Tesseract's browser loader accepts typed arrays. Its declaration names the Node subtype.
        const image = new Uint8Array(await untilAborted(blob.arrayBuffer(), pageSignal)) as Buffer;
        await untilAborted(
          worker.setParameters({ user_defined_dpi: String(Math.round(scale * 72)) }),
          pageSignal,
        );
        const result = await untilAborted(worker.recognize(image), pageSignal);
        text = result.data.text;
        const normalized = text.split("\n").map(normalizeGuideText).join("\n");
        if (isBirthRecord(normalized) || /\b(?:zao|zur|zam)\b/.test(normalized.slice(0, 300))) {
          const { PSM } = await import("tesseract.js");
          await untilAborted(
            worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }),
            pageSignal,
          );
          sparse = (await untilAborted(worker.recognize(image), pageSignal)).data.text;
          await untilAborted(worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }), pageSignal);
        }
      }
      pages.push({ number, text, sparse });
      page.cleanup();
      onProgress({ done: number - from + 1, total });
    }
    return { kind: "ready" as const, ...readScanPages(pages) };
  } finally {
    render?.cancel();
    canvas.width = 0;
    canvas.height = 0;
    await Promise.allSettled([loading.destroy(), worker?.terminate()]);
  }
}
