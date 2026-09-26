import { Download, ExternalLink, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BigButton, LoadingLabel, Notice, quietActionClass } from "./ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EntryRow } from "@/lib/ckd-db";
import type { Sheet } from "@/lib/decision-sheets";
import { useText, type Language } from "@/lib/language";
import { cn } from "@/lib/utils";

type PreviewState =
  | { status: "closed" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; blob: Blob; url: string };

// Kicked off the first time this module loads (when the button first renders),
// so pdfjs is in-flight before the user clicks anything.
let pdfjsPromise: Promise<{ getDocument: typeof import("pdfjs-dist")["getDocument"]; GlobalWorkerOptions: typeof import("pdfjs-dist")["GlobalWorkerOptions"] }> | null = null;

function getPdfjs() {
  pdfjsPromise ??= Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url").then((m) => m.default),
  ]).then(([pdfjs, workerUrl]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  });
  return pdfjsPromise;
}

/**
 * Renders a sheet to PDF and holds it for the preview dialog. The sheet is
 * built lazily so pdf-lib and the sheet builders stay out of the main bundle.
 */
export function usePdfPreview() {
  const [state, setState] = useState<PreviewState>({ status: "closed" });
  const runRef = useRef(0);
  const lastRef = useRef<(() => Promise<Sheet>) | null>(null);
  // Cached blob from a prefetch — consumed on the next open() call.
  const cachedBlobRef = useRef<Promise<Blob> | null>(null);

  const url = state.status === "ready" ? state.url : null;
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const open = useCallback(async (makeSheet: () => Promise<Sheet>) => {
    const run = ++runRef.current;
    lastRef.current = makeSheet;
    setState({ status: "loading" });
    try {
      const blobPromise = cachedBlobRef.current ?? (async () => {
        const { sheetPdfBlob } = await import("@/lib/summary-pdf");
        return sheetPdfBlob(await makeSheet());
      })();
      cachedBlobRef.current = null;
      const blob = await blobPromise;
      if (runRef.current !== run) return;
      setState({ status: "ready", blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      console.error("Could not prepare PDF", error);
      if (runRef.current === run) setState({ status: "error" });
    }
  }, []);

  const prefetchBlob = useCallback((makeSheet: () => Promise<Sheet>) => {
    lastRef.current = makeSheet;
    cachedBlobRef.current = (async () => {
      const [{ sheetPdfBlob }] = await Promise.all([
        import("@/lib/summary-pdf"),
        getPdfjs(),
      ]);
      return sheetPdfBlob(await makeSheet());
    })();
    // Discard on error so a stale rejected promise is never consumed.
    cachedBlobRef.current.catch(() => { cachedBlobRef.current = null; });
  }, []);

  const retry = useCallback(() => {
    if (lastRef.current) void open(lastRef.current);
  }, [open]);

  const close = useCallback(() => {
    runRef.current += 1;
    setState({ status: "closed" });
  }, []);

  return { state, open, prefetchBlob, retry, close, busy: state.status === "loading" };
}

function PdfCanvas({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRenderError(false);

    (async () => {
      try {
        const [{ getDocument }, arrayBuffer] = await Promise.all([
          getPdfjs(),
          blob.arrayBuffer(),
        ]);
        if (cancelled) return;

        const pdf = await getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;

          const viewport = page.getViewport({ scale: window.devicePixelRatio * 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, canvas, viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) {
          console.error("pdf.js render error", err);
          setRenderError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (renderError) return null;

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-auto bg-muted"
      aria-label="PDF preview"
    />
  );
}

export function ReportPreviewDialog({
  preview,
  language,
  title,
  filename,
  onDownloaded,
}: {
  preview: ReturnType<typeof usePdfPreview>;
  language: Language;
  title: string;
  filename: string;
  onDownloaded?: () => void;
}) {
  const t = useText(language);
  const { state } = preview;

  return (
    <Dialog open={state.status !== "closed"} onOpenChange={(open) => !open && preview.close()}>
      <DialogContent className="flex h-[92dvh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-4 rounded-2xl p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-base">
            {t("下载前请先检查一下。", "Have a look before you download it.")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted">
          {state.status === "ready" ? (
            <PdfCanvas blob={state.blob} />
          ) : state.status === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
              <Notice tone="warn">
                {t("无法生成 PDF，请重试。", "Could not prepare the PDF. Please try again.")}
              </Notice>
              <BigButton variant="ghost" className="w-auto" onClick={preview.retry}>
                {t("重试", "Try again")}
              </BigButton>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-lg text-muted-foreground">
              <LoadingLabel>{t("正在生成 PDF…", "Preparing PDF…")}</LoadingLabel>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <BigButton
            disabled={state.status !== "ready"}
            className="flex items-center justify-center gap-2 sm:flex-1"
            onClick={async () => {
              if (state.status !== "ready") return;
              const { downloadBlob } = await import("@/lib/summary-pdf");
              downloadBlob(state.blob, filename);
              onDownloaded?.();
            }}
          >
            <Download className="h-6 w-6 shrink-0" aria-hidden />
            {t("下载 PDF", "Download PDF")}
          </BigButton>
          <BigButton variant="ghost" className="sm:w-auto" onClick={preview.close}>
            {t("关闭", "Close")}
          </BigButton>
        </div>
        {state.status === "ready" ? (
          <button
            type="button"
            className={cn(quietActionClass, "min-h-0 justify-center text-sm sm:text-base")}
            onClick={() => {
              if (state.status !== "ready") return;
              window.open(state.url, "_blank");
            }}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            {t("看不到预览？在新分页打开", "Can't see the preview? Open it in a new tab")}
          </button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Builds the report from the answers so far, without the AI inference the
 * final report uses, so it's quick enough to check at any question.
 */
export function GenerateReportButton({
  kind,
  entries,
  language,
  disabled,
}: {
  kind: "patient" | "caregiver";
  entries: EntryRow[];
  language: Language;
  disabled?: boolean;
}) {
  const t = useText(language);
  const preview = usePdfPreview();

  const makeSheet = useCallback(async () => {
    const { buildCaregiverSheet, buildPatientSheet, formatPreparedOn, prioritiesFromEntries } =
      await import("@/lib/decision-sheets");
    const preparedOn = formatPreparedOn(new Date(), language);
    return kind === "patient"
      ? buildPatientSheet(
          language,
          entries,
          { patientPriorities: prioritiesFromEntries(entries, language), sharedConcerns: [] },
          preparedOn,
        )
      : buildCaregiverSheet(language, entries, preparedOn);
  }, [kind, entries, language]);

  // Start generating as soon as the button is enabled so the blob is ready by
  // the time the user clicks. Re-run whenever entries change.
  useEffect(() => {
    if (disabled) return;
    getPdfjs();
    import("@/lib/summary-pdf").then(({ prefetchPdfAssets }) => prefetchPdfAssets());
    preview.prefetchBlob(makeSheet);
  }, [disabled, makeSheet]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        type="button"
        className={cn(quietActionClass, "justify-center")}
        disabled={disabled || preview.busy}
        onClick={() => void preview.open(makeSheet)}
      >
        <FileText className="h-5 w-5" aria-hidden />
        {t("查看我的记录", "View my report")}
      </button>
      <ReportPreviewDialog
        preview={preview}
        language={language}
        title={
          kind === "patient"
            ? t("我的治疗优先事项", "My treatment priorities")
            : t("我作为照顾者的记录", "My notes as a caregiver")
        }
        filename={
          kind === "patient"
            ? `my-treatment-priorities-${language}.pdf`
            : `caregiver-notes-${language}.pdf`
        }
      />
    </>
  );
}
