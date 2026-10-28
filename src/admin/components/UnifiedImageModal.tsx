import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Link as LinkIcon,
  Grid,
  X,
  Check,
  AlertCircle,
  Eye,
  Sparkles,
  Search,
  CheckCircle2,
  FileImage,
  Crop,
  Sliders,
} from 'lucide-react';
import { SITE_IMAGES, SiteImageDefinition } from '@/data/siteImagesData';
import { compressImageFile, formatFileSize } from '../lib/imageCompressor';
import ImageCanvasEditor, { ImageEditorResult } from './image-studio/ImageCanvasEditor';
import { ImageFormat } from '@/lib/imageStudioStorage';

export interface UnifiedImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  currentUrl: string;
  currentAlt?: string;
  onApply: (newUrl: string, newAlt: string) => void;
  usedInHint?: string;
  requireAlt?: boolean;
}

export default function UnifiedImageModal({
  isOpen,
  onClose,
  title = 'Replace Image Asset',
  currentUrl,
  currentAlt = '',
  onApply,
  usedInHint,
  requireAlt = true,
}: UnifiedImageModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'library'>('upload');
  const [workingUrl, setWorkingUrl] = useState(currentUrl);
  const [workingAlt, setWorkingAlt] = useState(currentAlt);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
  } | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const [altError, setAltError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Dedicated Image Editor state
  const [editorTarget, setEditorTarget] = useState<{
    name: string;
    dataUrl: string;
    width: number;
    height: number;
    format: ImageFormat;
    size: number;
  } | null>(null);

  // Upload queue for multiple files
  const [pendingFilesQueue, setPendingFilesQueue] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or currentUrl changes
  useEffect(() => {
    if (isOpen) {
      setWorkingUrl(currentUrl);
      setWorkingAlt(currentAlt || '');
      setCompressionStats(null);
      setUrlInputError(null);
      setAltError(null);
      setSelectedLibraryId(null);
      setEditorTarget(null);
      setPendingFilesQueue([]);
    }
  }, [isOpen, currentUrl, currentAlt]);

  // Handle next file in upload queue
  const processNextFile = (files: File[]) => {
    if (!files || files.length === 0) return;
    const [firstFile, ...rest] = files;
    setPendingFilesQueue(rest);

    if (!firstFile.type.startsWith('image/')) {
      setUrlInputError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setEditorTarget({
          name: firstFile.name.replace(/\.[^/.]+$/, ''),
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: (firstFile.type as ImageFormat) || 'image/jpeg',
          size: firstFile.size,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(firstFile);
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const filesArray = Array.from(files);
    processNextFile(filesArray);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Editor Callbacks: Accept and Save
  const handleEditorAcceptAndSave = (result: ImageEditorResult) => {
    setWorkingUrl(result.dataUrl);
    setCompressionStats({
      originalSize: editorTarget?.size || result.size,
      compressedSize: result.size,
    });
    if (!workingAlt.trim()) {
      setWorkingAlt(`Photo of ${result.name.replace(/[-_]/g, ' ')}`);
    }
    setEditorTarget(null);

    // If more files queued, process next
    if (pendingFilesQueue.length > 0) {
      processNextFile(pendingFilesQueue);
    }
  };

  // Editor Callbacks: Use Original Image
  const handleEditorUseOriginal = (original: ImageEditorResult) => {
    setWorkingUrl(original.dataUrl);
    setCompressionStats(null);
    if (!workingAlt.trim()) {
      setWorkingAlt(`Photo of ${original.name.replace(/[-_]/g, ' ')}`);
    }
    setEditorTarget(null);

    // If more files queued, process next
    if (pendingFilesQueue.length > 0) {
      processNextFile(pendingFilesQueue);
    }
  };

  // Editor Callbacks: Cancel
  const handleEditorCancel = () => {
    setEditorTarget(null);
    // If more files queued, process next
    if (pendingFilesQueue.length > 0) {
      processNextFile(pendingFilesQueue);
    }
  };

  // Launch editor on the currently selected image
  const handleOpenEditorOnCurrent = () => {
    if (!workingUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setEditorTarget({
        name: 'Selected Image',
        dataUrl: workingUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: 'image/jpeg',
        size: workingUrl.length,
      });
    };
    img.src = workingUrl;
  };

  const handleSelectFromLibrary = (item: SiteImageDefinition) => {
    setSelectedLibraryId(item.id);
    setWorkingUrl(item.defaultUrl);
    if (!workingAlt.trim() || workingAlt === currentAlt) {
      setWorkingAlt(item.defaultAlt);
    }
  };

  const handleApply = () => {
    // Validate alt text
    if (requireAlt && !workingAlt.trim()) {
      setAltError('Alt text is required for accessibility and screen readers.');
      return;
    }

    if (!workingUrl.trim()) {
      setUrlInputError('Please upload an image, enter an image URL, or pick from the library.');
      return;
    }

    onApply(workingUrl.trim(), workingAlt.trim());
    onClose();
  };

  const filteredLibrary = SITE_IMAGES.filter((img) => {
    const q = librarySearch.toLowerCase();
    return (
      img.name.toLowerCase().includes(q) ||
      img.page.toLowerCase().includes(q) ||
      img.usedIn.toLowerCase().includes(q) ||
      img.defaultAlt.toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 id="image-modal-title" className="text-base font-bold text-slate-900 tracking-tight">
                {title}
              </h3>
              {usedInHint && (
                <p className="text-xs text-[#015557] font-medium mt-0.5">
                  {usedInHint}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close image picker"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
                activeTab === 'upload'
                  ? 'bg-[#015557] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload &amp; Crop</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
                activeTab === 'url'
                  ? 'bg-[#015557] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>Image Web URL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
                activeTab === 'library'
                  ? 'bg-[#015557] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Site Media Library</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 max-h-[62vh] overflow-y-auto">
            {/* TAB 1: Upload & Crop */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-[#015557] bg-emerald-50/50 scale-[1.01]'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleFileUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />

                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#015557] flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      Click to choose photo or drag &amp; drop here
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      JPEG, PNG, or WebP. Automatically opens the dedicated crop and editing modal with aspect ratio locking.
                    </p>
                  </div>
                </div>

                {isCompressing && (
                  <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#015557] animate-ping" />
                    <span>Processing image...</span>
                  </div>
                )}

                {compressionStats && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Optimized: <strong>{formatFileSize(compressionStats.originalSize)}</strong> &rarr;{' '}
                        <strong>{formatFileSize(compressionStats.compressedSize)}</strong>
                      </span>
                    </div>
                    <span className="font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded shadow-2xs">
                      {Math.max(
                        0,
                        Math.round((1 - compressionStats.compressedSize / compressionStats.originalSize) * 100)
                      )}
                      % smaller
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Image Web URL */}
            {activeTab === 'url' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Direct Image Link (HTTPS)
                </label>
                <input
                  type="url"
                  value={workingUrl}
                  onChange={(e) => {
                    setWorkingUrl(e.target.value);
                    setUrlInputError(null);
                  }}
                  placeholder="https://example.com/images/tow-truck.jpg"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557]"
                />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Paste a secure public image URL from ImgBB, Cloudinary, AWS S3, or your hosting server.
                </p>
              </div>
            )}

            {/* TAB 3: Site Media Library */}
            {activeTab === 'library' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Search site photography by name, page or vehicle..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557]"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto p-1">
                  {filteredLibrary.map((item) => {
                    const isSelected = selectedLibraryId === item.id || workingUrl === item.defaultUrl;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectFromLibrary(item)}
                        className={`group relative rounded-xl border p-2 text-left transition-all ${
                          isSelected
                            ? 'border-[#015557] ring-2 ring-[#015557] bg-emerald-50/40'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="aspect-video w-full rounded-lg bg-slate-100 overflow-hidden mb-1.5 relative">
                          <img
                            src={item.defaultUrl}
                            alt={item.defaultAlt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-[#015557] text-white p-0.5 rounded-full shadow-xs">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-800 truncate">
                          {item.name}
                        </p>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {item.page} &middot; {item.section}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected Image Preview with Crop & Edit Button */}
            {workingUrl && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Selected Image Preview:
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenEditorOnCurrent}
                    className="px-2.5 py-1 text-xs font-semibold text-[#015557] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Crop &amp; Edit Image</span>
                  </button>
                </div>
                <div className="h-44 w-full rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center">
                  <img
                    src={workingUrl}
                    alt={workingAlt || 'Preview'}
                    onError={() => setUrlInputError('Could not render image from the provided source.')}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            )}

            {urlInputError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[#d80000] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{urlInputError}</span>
              </div>
            )}

            {/* REQUIRED Alt Text Field */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-800">
                  Accessible Alt Text {requireAlt && <span className="text-[#d80000]">* (Required)</span>}
                </label>
                <span className={`text-[11px] font-mono ${workingAlt.length > 120 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {workingAlt.length} chars
                </span>
              </div>

              <input
                type="text"
                value={workingAlt}
                onChange={(e) => {
                  setWorkingAlt(e.target.value);
                  setAltError(null);
                }}
                placeholder="e.g. Modern flatbed recovery truck towing car on highway"
                className={`w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border rounded-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557] ${
                  altError ? 'border-[#d80000]' : 'border-slate-300'
                }`}
              />

              {altError ? (
                <p className="text-xs font-semibold text-[#d80000] mt-1">
                  {altError}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Plain-English description for visually impaired road users using screen readers and Google image search indexers.
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-[#015557] hover:bg-[#014345] rounded-lg transition-colors shadow-xs flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557]"
            >
              <Check className="w-4 h-4" />
              <span>Apply image</span>
            </button>
          </div>
        </div>
      </div>

      {/* DEDICATED EDITING MODAL FOR UPLOADED IMAGE */}
      {editorTarget && (
        <ImageCanvasEditor
          sourceImage={editorTarget}
          title={`Edit & Crop: ${editorTarget.name}`}
          isUploadWorkflow={true}
          onAcceptAndSave={handleEditorAcceptAndSave}
          onUseOriginal={handleEditorUseOriginal}
          onClose={handleEditorCancel}
        />
      )}
    </>
  );
}
