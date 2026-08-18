import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, Download, Eye, File as FileGeneric, FileImage, FileSpreadsheet, FileText,
  Loader2, Paperclip, RefreshCw, Trash2, Upload,
} from "lucide-react";
import { deleteEntityAttachment, getEntityAttachment, openEntityAttachment, uploadEntityAttachment } from "../../api/enquiries";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../hooks/useToast";
import { messageFrom } from "../../utils/apiError";
import { formatDateTime, formatFileSize } from "../../utils/format";
import { attachmentFile } from "../../utils/validators";
import { ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_SIZE_MB } from "../../constants";
import { btnGhostSm, btnSecondary, labelCls } from "../ui";

// One reusable "single internal reference document" section for Quotation/Order/
// Invoice — same upload/replace/remove/view/download behavior, only the copy differs.
const CONFIG = {
  quotation: {
    title: "Internal Quotation Document",
    description: "This application does not generate the quotation. The document below is only attached for internal tracking/reference.",
    chooseLabel: "Choose Quotation File",
    uploadPrompt: "Upload the quotation document",
    replaceConfirmTitle: "Replace the existing quotation document?",
  },
  order: {
    title: "Internal PO / Order Document",
    description: "Attach the Purchase Order / Order document for internal tracking and reference.",
    chooseLabel: "Choose PO File",
    uploadPrompt: "Upload the PO / order document",
    replaceConfirmTitle: "Replace the existing PO document?",
  },
  invoice: {
    title: "Internal Invoice Document",
    description: "Attach the invoice document for internal tracking and reference.",
    chooseLabel: "Choose Invoice File",
    uploadPrompt: "Upload the invoice document",
    replaceConfirmTitle: "Replace the existing invoice document?",
  },
};

function iconFor(fileType) {
  const t = (fileType || "").toLowerCase();
  if (t === "pdf" || t === "doc" || t === "docx") return FileText;
  if (t === "xls" || t === "xlsx") return FileSpreadsheet;
  if (t === "jpg" || t === "jpeg" || t === "png") return FileImage;
  return FileGeneric;
}

// PDFs and images render fine in a browser tab; Office formats don't without a
// dedicated viewer, so those only ever get a Download action.
function canView(fileType) {
  return ["pdf", "jpg", "jpeg", "png"].includes((fileType || "").toLowerCase());
}

export default function InternalDocumentAttachment({ entityType, enquiryId }) {
  const cfg = CONFIG[entityType];
  const { showToast } = useToast();
  const askConfirm = useConfirm();
  const fileInputRef = useRef(null);

  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false); // view/download/remove in flight

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEntityAttachment(entityType, enquiryId)
      .then((data) => { if (!cancelled) setAttachment(data); })
      .catch(() => { if (!cancelled) showToast("Could not load the document.", "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, enquiryId]);

  async function doUpload(file) {
    setUploadError("");
    setUploading(true);
    setProgress(0);
    try {
      const updated = await uploadEntityAttachment(entityType, enquiryId, file, setProgress);
      setAttachment(updated);
      showToast("Document uploaded.", "success");
    } catch (err) {
      setUploadError(messageFrom(err));
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const err = attachmentFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError("");

    if (attachment) {
      askConfirm({
        title: cfg.replaceConfirmTitle,
        message: `${attachment.original_filename} will be replaced with ${file.name}. This cannot be undone.`,
        confirmLabel: "Replace",
        onConfirm: () => doUpload(file),
      });
    } else {
      doUpload(file);
    }
  }

  async function handleView() {
    setBusy(true);
    try {
      await openEntityAttachment(entityType, enquiryId, attachment.original_filename, { inline: true });
    } catch (err) {
      showToast(messageFrom(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    setBusy(true);
    try {
      await openEntityAttachment(entityType, enquiryId, attachment.original_filename, { inline: false });
    } catch (err) {
      showToast(messageFrom(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove() {
    askConfirm({
      title: "Remove document?",
      message: `${attachment.original_filename} will be permanently removed. This cannot be undone.`,
      danger: true,
      confirmLabel: "Remove",
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteEntityAttachment(entityType, enquiryId);
          setAttachment(null);
          showToast("Document removed.", "success");
        } catch (err) {
          showToast(messageFrom(err), "error");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  const Icon = iconFor(attachment?.file_type);

  return (
    <div className="mt-5 pt-4 border-t border-slate-100">
      <p className={labelCls}>{cfg.title}</p>
      <p className="text-[11px] text-slate-400 -mt-1 mb-2">{cfg.description}</p>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
        accept={ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",")}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader2 size={13} className="animate-spin" /> Loading…</div>
      ) : uploading ? (
        <div className="max-w-xl">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : attachment ? (
        <div className="border border-slate-200 rounded-lg flex items-center gap-3 px-3 py-2.5 max-w-xl">
          <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
            <Icon size={14} className="text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 truncate" title={attachment.original_filename}>{attachment.original_filename}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {attachment.file_type} · {formatFileSize(attachment.file_size)}
              {attachment.uploaded_by_name && ` · Uploaded by ${attachment.uploaded_by_name}`}
              {" · "}{formatDateTime(attachment.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canView(attachment.file_type) && (
              <button title="View" onClick={handleView} disabled={busy} className={btnGhostSm}><Eye size={13} /></button>
            )}
            <button title="Download" onClick={handleDownload} disabled={busy} className={btnGhostSm}><Download size={13} /></button>
            <button title="Replace" onClick={() => fileInputRef.current?.click()} disabled={busy} className={btnGhostSm}><RefreshCw size={13} /></button>
            <button title="Remove" onClick={confirmRemove} disabled={busy} className={btnGhostSm + " hover:text-red-600 hover:bg-red-50"}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-slate-300 rounded-lg px-4 py-3 flex items-center gap-3 max-w-xl">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Paperclip size={15} className="text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">{cfg.uploadPrompt}</p>
            <p className="text-[11px] text-slate-400">
              {ATTACHMENT_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")} · Max {MAX_ATTACHMENT_SIZE_MB}MB
            </p>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={btnSecondary}>
            <Upload size={14} /> {cfg.chooseLabel}
          </button>
        </div>
      )}

      {uploadError && (
        <p className="max-w-xl mt-2 text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={11} className="flex-shrink-0" /> {uploadError}
        </p>
      )}
    </div>
  );
}
