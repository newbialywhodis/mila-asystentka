import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { IconButton } from "../../components/ui/Button";
import { LoadingIndicator } from "../../components/ui/LoadingIndicator";
import { ScrollArea } from "../../components/ui/ScrollArea";
import { Select } from "../../components/ui/Select";
import { loadBrowserPdf } from "./browser-pdf";
import type { AttachedDocument } from "./case-session";
import styles from "./AttachmentPreview.module.css";

export type OpenPdfPreview = (document: AttachedDocument, page?: number) => void;

const pdfZoomOptions = [50, 75, 100, 125, 150, 200].map((value) => ({
  value,
  label: `${value}%`,
}));

export function AttachmentPreview({
  documents,
  attachment,
  page,
  onPreview,
}: {
  documents: AttachedDocument[];
  attachment: AttachedDocument;
  page: number;
  onPreview: OpenPdfPreview;
}) {
  return (
    <div className={styles.preview} data-attachment-preview="">
      {documents.length > 1 ? (
        <select
          className={styles.document}
          aria-label="PDF do podglądu"
          title={attachment.file.name}
          value={attachment.preview}
          onChange={(event) => {
            const selected = documents.find(({ preview }) => preview === event.currentTarget.value);
            if (selected) onPreview(selected);
          }}
        >
          {documents.map(({ file, preview }) => (
            <option key={preview} value={preview}>
              {file.name}
            </option>
          ))}
        </select>
      ) : (
        <p className={styles.filename} title={attachment.file.name}>
          {attachment.file.name}
        </p>
      )}
      <PdfPages
        key={attachment.preview}
        attachment={attachment}
        page={page}
        onPage={(next) => onPreview(attachment, next)}
      />
    </div>
  );
}

function PdfPages({
  attachment,
  page,
  onPage,
}: {
  attachment: AttachedDocument;
  page: number;
  onPage: (page: number) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pageRatios, setPageRatios] = useState<number[]>();
  const [failed, setFailed] = useState(false);
  const visiblePage = pdf ? Math.min(page, pdf.numPages) : page;
  const { preview } = attachment;

  useEffect(() => {
    let loading: PDFDocumentLoadingTask | undefined;
    let disposed = false;
    async function load() {
      try {
        loading = await loadBrowserPdf(preview);
        if (disposed) {
          await loading.destroy();
          return;
        }
        const loaded = await loading.promise;
        if (disposed) return;
        const ratios = await Promise.all(
          Array.from({ length: loaded.numPages }, async (_, index) => {
            try {
              const source = await loaded.getPage(index + 1);
              const { width, height } = source.getViewport({ scale: 1 });
              return width / height;
            } catch {
              return 595 / 842;
            }
          }),
        );
        if (!disposed) {
          setPdf(loaded);
          setPageRatios(ratios);
        }
      } catch {
        if (!disposed) setFailed(true);
      }
    }
    void load();
    return () => {
      disposed = true;
      void loading?.destroy().catch(() => {});
    };
  }, [preview]);

  return (
    <>
      {pdf && pageRatios && !failed ? (
        <PdfViewer
          pdf={pdf}
          ratios={pageRatios}
          page={visiblePage}
          preview={preview}
          onPage={onPage}
        />
      ) : failed ? (
        <div className={styles.status}>
          <output>Nie udało się wyświetlić PDF-u.</output>
          <a href={preview} target="_blank" rel="noreferrer">
            Otwórz w nowej karcie
          </a>
        </div>
      ) : (
        <output className={styles.status}>
          <LoadingIndicator>Otwieranie PDF-u…</LoadingIndicator>
        </output>
      )}
    </>
  );
}

function PdfViewer({
  pdf,
  ratios,
  page,
  preview,
  onPage,
}: {
  pdf: PDFDocumentProxy;
  ratios: number[];
  page: number;
  preview: string;
  onPage: (page: number) => void;
}) {
  const viewport = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const activePage = useRef(0);
  const jumpPosition = useRef<number | null>(null);
  const zoomPosition = useRef<number | null>(null);
  const [visiblePages, setVisiblePages] = useState<ReadonlySet<number>>(() => new Set());
  const [zoom, setZoom] = useState(100);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const first = content.current?.firstElementChild;
    const target = content.current?.children[page - 1];
    if (
      (activePage.current === page && zoomPosition.current === null) ||
      !(first instanceof HTMLElement) ||
      !(target instanceof HTMLElement)
    )
      return;
    activePage.current = page;
    element.scrollTop =
      target.offsetTop - first.offsetTop + (zoomPosition.current ?? 0) * target.offsetHeight;
    zoomPosition.current = null;
    jumpPosition.current = element.scrollTop;
  }, [page, zoom]);

  useEffect(() => {
    const element = viewport.current;
    const pages = content.current?.children;
    if (!element || !pages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const number = Number(entry.target.getAttribute("data-page-number"));
            if (entry.isIntersecting) next.add(number);
            else next.delete(number);
          }
          return next;
        });
      },
      { root: element, rootMargin: "320px 0px" },
    );
    for (const child of pages) observer.observe(child);
    return () => observer.disconnect();
  }, []);

  function changeZoom(next: number) {
    if (next === zoom) return;
    const element = viewport.current;
    const first = content.current?.firstElementChild;
    const current = content.current?.children[page - 1];
    if (element && first instanceof HTMLElement && current instanceof HTMLElement) {
      const offset = element.scrollTop - current.offsetTop + first.offsetTop;
      zoomPosition.current = Math.min(1, Math.max(0, offset / Math.max(1, current.offsetHeight)));
    }
    setZoom(next);
  }

  function syncPage(element: HTMLElement) {
    // A jump can be clamped near the end of the document. Keep the selected page until the reader scrolls.
    if (element.scrollTop === jumpPosition.current) return;
    const pages = content.current?.children;
    if (!pages) return;
    jumpPosition.current = null;
    const readingLine =
      element.getBoundingClientRect().top + Math.min(32, element.clientHeight / 2);
    const atEnd =
      element.scrollTop > 0 && element.scrollHeight - element.clientHeight - element.scrollTop <= 1;
    const index = atEnd
      ? ratios.length - 1
      : Array.from(pages).findIndex((child) => child.getBoundingClientRect().bottom > readingLine);
    if (index < 0 || index + 1 === activePage.current) return;
    activePage.current = index + 1;
    onPage(index + 1);
  }

  return (
    <div className={styles.pages}>
      <ScrollArea
        renderViewport={<section ref={viewport} />}
        contentClassName={styles.content}
        contentRef={content}
        aria-label="Strony PDF-u"
        horizontal
        onScroll={(event) => syncPage(event.currentTarget)}
      >
        {ratios.map((ratio, index) => (
          <div
            key={index}
            className={styles.page}
            data-page-number={index + 1}
            // oxlint-disable-next-line react/forbid-dom-props -- Size the page before rendering.
            style={{ aspectRatio: ratio, inlineSize: `${zoom}%` }}
          >
            {visiblePages.has(index + 1) ? (
              <PdfPage pdf={pdf} page={index + 1} preview={preview} />
            ) : null}
          </div>
        ))}
      </ScrollArea>
      <div className={styles.controls}>
        {pdf.numPages > 1 ? (
          <>
            <IconButton
              icon="back"
              size="icon-sm"
              variant="ghost"
              rounded
              label="Poprzednia strona"
              aria-disabled={page === 1}
              onClick={() => {
                if (page > 1) onPage(page - 1);
              }}
            />
            <PageNumber page={page} total={pdf.numPages} onPage={onPage} />
            <IconButton
              icon="arrow"
              size="icon-sm"
              variant="ghost"
              rounded
              label="Następna strona"
              aria-disabled={page === pdf.numPages}
              onClick={() => {
                if (page < pdf.numPages) onPage(page + 1);
              }}
            />
          </>
        ) : null}
        <Select
          label="Powiększenie PDF-u"
          value={zoom}
          items={pdfZoomOptions}
          onValueChange={changeZoom}
          side="top"
          className={styles.zoom}
        />
      </div>
    </div>
  );
}

function PageNumber({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ page: number; value: string }>();
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.current?.valueAsNumber;
    if (value && Number.isInteger(value) && value >= 1 && value <= total) {
      onPage(value);
      setDraft(undefined);
    }
  }

  return (
    <form className={styles.pageNumber} onSubmit={submit}>
      <input
        ref={input}
        aria-label="Numer strony"
        type="number"
        min={1}
        max={total}
        value={draft?.page === page ? draft.value : page}
        onChange={(event) => setDraft({ page, value: event.currentTarget.value })}
        onBlur={() => setDraft(undefined)}
        required
      />
      <span>z {total}</span>
    </form>
  );
}

function PdfPage({ pdf, page, preview }: { pdf: PDFDocumentProxy; page: number; preview: string }) {
  const surface = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let disposed = false;
    let task: RenderTask | undefined;
    async function draw() {
      try {
        const source = await pdf.getPage(page);
        if (disposed) return;
        const natural = source.getViewport({ scale: 1 });
        const output = document.createElement("canvas");
        const scale = Math.min(
          (width * Math.min(window.devicePixelRatio || 1, 2)) / natural.width,
          2800 / Math.max(natural.width, natural.height),
        );
        const viewport = source.getViewport({ scale });
        output.width = Math.ceil(viewport.width);
        output.height = Math.ceil(viewport.height);
        task = source.render({ canvas: output, viewport });
        await task.promise;
        const target = canvas.current;
        if (disposed || !target) return;
        target.width = output.width;
        target.height = output.height;
        target.getContext("2d")?.drawImage(output, 0, 0);
        setFailed(false);
        setDone(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    }
    void draw();
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [page, pdf, width]);

  return (
    <div className={styles.surface} ref={surface}>
      <canvas
        hidden={!done || failed}
        ref={canvas}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- PDF.js renders to canvas.
        role="img"
        aria-label={`Strona ${page} PDF-u`}
      />
      {failed ? (
        <div className={styles.status}>
          <output>Nie udało się wyświetlić tej strony.</output>
          <a href={`${preview}#page=${page}`} target="_blank" rel="noreferrer">
            Otwórz w nowej karcie
          </a>
        </div>
      ) : null}
      {!done && !failed ? (
        <output className={styles.status}>
          <LoadingIndicator>Wczytywanie strony…</LoadingIndicator>
        </output>
      ) : null}
    </div>
  );
}
