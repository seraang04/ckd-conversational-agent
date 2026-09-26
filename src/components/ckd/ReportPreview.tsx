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

/**
 * Renders a sheet to PDF and holds it for the preview dialog. The sheet is
 * built lazily so pdf-lib and the sheet builders stay out of the main bundle.
 */
export function usePdfPreview() {
  const [state, setState] = useState<PreviewState>({ status: "closed" });
  const runRef = useRef(0);
  const lastRef = useRef<(() => Promise<Sheet>) | null>(null);

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
      const { sheetPdfBlob } = await import("@/lib/summary-pdf");
      const blob = await sheetPdfBlob(await makeSheet());
      if (runRef.current !== run) return;
      setState({ status: "ready", blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      console.error("Could not prepare PDF", error);
      if (runRef.current === run) setState({ status: "error" });
    }
  }, []);

  const retry = useCallback(() => {
    if (lastRef.current) void open(lastRef.current);
  }, [open]);

  const close = useCallback(() => {
    runRef.current += 1;
    setState({ status: "closed" });
  }, []);

  return { state, open, retry, close, busy: state.status === "loading" };
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
            <object data={state.url} type="application/pdf" title={title} className="h-full w-full">
              <p className="p-4 text-sm text-muted-foreground">
                {t("无法显示预览，请下载 PDF 查看。", "Preview unavailable — please download the PDF to view it.")}
              </p>
            </object>
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
              window.open(state.url, "_blank", "noopener");
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

  const makeSheet = async () => {
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
  };

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
