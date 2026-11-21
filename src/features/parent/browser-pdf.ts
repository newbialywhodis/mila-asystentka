export async function loadBrowserPdf(source: Uint8Array | string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
  const loading = pdfjs.getDocument({
    ...(typeof source === "string" ? { url: source } : { data: source }),
    wasmUrl: "/ocr/pdf-wasm/",
    standardFontDataUrl: "/ocr/pdf-fonts/",
    enableXfa: false,
  });
  loading.onPassword = () => void loading.destroy().catch(() => {});
  return loading;
}
