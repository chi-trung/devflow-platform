import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
  Check,
  AlertCircle,
  X,
} from "lucide-react";
import { exportProjectBackup, importProjectBackup } from "../lib/api";
import { useToast } from "./ui/ToastProvider";
import { Button } from "./ui/Button";

interface ExportImportModalProps {
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  isAdmin?: boolean;
}

type Tab = "export" | "import";
type ExportFormat = "json" | "excel";
type ImportStatus = "idle" | "importing" | "success" | "error";

export function ExportImportModal({
  workspaceId,
  projectId,
  onClose,
  isAdmin = false,
}: ExportImportModalProps) {
  const { t } = useTranslation();
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("export");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importResult, setImportResult] = useState<{
    tasks: number;
    epics: number;
    sprints: number;
    comments: number;
    errors: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportProjectBackup(workspaceId, projectId, exportFormat);
      const ext = exportFormat === "excel" ? "xlsx" : "json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-backup.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      push(t("importExport.exportSuccess"), "success");
    } catch {
      push(t("importExport.exportFailed"), "error");
    }
  }, [workspaceId, projectId, exportFormat, push, t]);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".json")) {
        push(t("importExport.invalidFileFormat"), "error");
        return;
      }

      setImportStatus("importing");
      try {
        const result = await importProjectBackup(workspaceId, projectId, file);
        setImportResult({
          tasks: result.TasksImported,
          epics: result.EpicsImported,
          sprints: result.SprintsImported,
          comments: result.CommentsImported,
          errors: result.Errors,
        });
        setImportStatus("success");
        if (result.Errors.length === 0) {
          push(t("importExport.importSuccess"), "success");
        } else {
          push(t("importExport.importWithErrors"), "success");
        }
      } catch {
        setImportStatus("error");
        push(t("importExport.importFailed"), "error");
      }
    },
    [workspaceId, projectId, push, t],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {t("importExport.title")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
            aria-label={t("common.cancel")}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        {isAdmin ? (
          <div className="mb-5 flex gap-1 rounded-lg bg-card p-1">
            <button
              onClick={() => setTab("export")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === "export"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Download className="mr-1.5 inline size-4" />
              {t("importExport.export")}
            </button>
            <button
              onClick={() => setTab("import")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === "import"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="mr-1.5 inline size-4" />
              {t("importExport.import")}
            </button>
          </div>
        ) : (
          <div className="mb-5 rounded-lg border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
            {t("board.adminOnlyHint")}
          </div>
        )}

        {/* Export tab */}
        {tab === "export" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("importExport.exportDescription")}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExportFormat("json")}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  exportFormat === "json"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <FileJson className="size-8" />
                <div>
                  <p className="text-sm font-medium">JSON</p>
                  <p className="text-xs text-muted-foreground">
                    {t("importExport.jsonDesc")}
                  </p>
                </div>
              </button>

              <button
                onClick={() => setExportFormat("excel")}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  exportFormat === "excel"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <FileSpreadsheet className="size-8" />
                <div>
                  <p className="text-sm font-medium">Excel</p>
                  <p className="text-xs text-muted-foreground">
                    {t("importExport.excelDesc")}
                  </p>
                </div>
              </button>
            </div>

            <Button onClick={handleExport} className="w-full">
              <Download className="mr-2 size-4" />
              {t("importExport.download")}
            </Button>
          </div>
        )}

        {/* Import tab */}
        {tab === "import" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("importExport.importDescription")}
            </p>

            {importStatus === "idle" && (
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Upload className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {t("importExport.dropFile")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("importExport.dropFileHint")}
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}

            {importStatus === "importing" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  {t("importExport.importing")}
                </p>
              </div>
            )}

            {importStatus === "success" && importResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-500">
                  <Check className="size-5" />
                  <p className="text-sm font-medium">
                    {t("importExport.importSuccess")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-card p-2.5">
                    <p className="text-muted-foreground">
                      {t("importExport.tasks")}
                    </p>
                    <p className="text-lg font-semibold">
                      {importResult.tasks}
                    </p>
                  </div>
                  <div className="rounded-lg bg-card p-2.5">
                    <p className="text-muted-foreground">
                      {t("importExport.epics")}
                    </p>
                    <p className="text-lg font-semibold">
                      {importResult.epics}
                    </p>
                  </div>
                  <div className="rounded-lg bg-card p-2.5">
                    <p className="text-muted-foreground">
                      {t("importExport.sprints")}
                    </p>
                    <p className="text-lg font-semibold">
                      {importResult.sprints}
                    </p>
                  </div>
                  <div className="rounded-lg bg-card p-2.5">
                    <p className="text-muted-foreground">
                      {t("importExport.comments")}
                    </p>
                    <p className="text-lg font-semibold">
                      {importResult.comments}
                    </p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="rounded-lg bg-destructive/10 p-3">
                    <p className="mb-1 text-sm font-medium text-destructive">
                      {t("importExport.errors")}
                    </p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-destructive/80">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    setImportStatus("idle");
                    setImportResult(null);
                  }}
                  className="w-full"
                >
                  {t("importExport.importAnother")}
                </Button>
              </div>
            )}

            {importStatus === "error" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
                  <AlertCircle className="size-5" />
                  <p className="text-sm font-medium">
                    {t("importExport.importFailed")}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setImportStatus("idle")}
                  className="w-full"
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
