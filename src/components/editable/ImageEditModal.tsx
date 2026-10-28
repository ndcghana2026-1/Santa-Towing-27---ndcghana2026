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
} from 'lucide-react';
import { SITE_IMAGES, SiteImageDefinition } from '@/data/siteImagesData';
import { compressImageFile, formatFileSize } from '@/admin/lib/imageCompressor';
import ImageCanvasEditor, { ImageEditorResult } from '@/admin/components/image-studio/ImageCanvasEditor';
import { ImageFormat } from '@/lib/imageStudioStorage';

export interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  storageKey: string;
  altStorageKey?: string;
  currentUrl: string;
  currentAlt?: string;
  onApply: (newUrl: string, newAlt: string) => void;
}

export function ImageEditModal({
  isOpen,
  onClose,
  title = 'Change Image Asset',
  storageKey,
  altStorageKey,
  currentUrl,
  currentAlt = '',
  onApply,
}: ImageEditModalProps) {
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
  const [isDragOver, setIsDragOver] = useState(false);

  // Dedicated editor modal target
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
      setSelectedLibraryId(null);
      setEditorTarget(null);
      setPendingFilesQueue([]);
    }
  }, [isOpen, currentUrl, currentAlt]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !editorTarget) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editorTarget]);

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
    processNextFile(Array.from(files));
  };

  // Editor Callbacks
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

    if (pendingFilesQueue.length > 0) {
      processNextFile(pendingFilesQueue);
    }
  };

  const handleEditorUseOriginal = (original: ImageEditorResult) => {
    setWorkingUrl(original.dataUrl);
    setCompressionStats(null);
    if (!workingAlt.trim()) {
      setWorkingAlt(`Photo of ${original.name.replace(/[-_]/g, ' ')}`);
    }
    setEditorTarget(null);

    if (pendingFilesQueue.length > 0) {
      processNextFile(pendingFilesQueue);
    }
  };

  const handleEditorCancel = () => {
    setEditorTarget(null);
    if (pendingFilesQueue.length > 0) {
      processNextFile(pendingFilesQueue);
    }
  };

  const handleOpenEditorOnCurrent = () => {
    if (!workingUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setEditorTarget({
        name: 'Page Image',
        dataUrl: workingUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: 'image/jpeg',
        size: workingUrl.length,
      });
    };
    img.src = workingUrl;
  };

  const handleApply = () => {
    if (!workingUrl.trim()) {
      setUrlInputError('Please select or upload an image first.');
      return;
    }
    const finalAlt = workingAlt.trim() || 'Santa Towing image asset';
    onApply(workingUrl.trim(), finalAlt);
    onClose();
  };

  const filteredLibrary = SITE_IMAGES.filter(
    (img) =>
      img.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      img.section.toLowerCase().includes(librarySearch.toLowerCase()) ||
      img.page.toLowerCase().includes(librarySearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        data-edit-ui="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{storageKey}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-6 pt-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-[#015557] text-[#015557]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload &amp; Crop</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'url'
                  ? 'border-[#015557] text-[#015557]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Image URL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'library'
                  ? 'border-[#015557] text-[#015557]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Site Media Library</span>
            </button>
          </div>

          {/* Body content */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* TAB 1: UPLOAD */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files) {
                      handleFileUpload(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-[#015557] bg-teal-50/50'
                      : 'border-slate-300 hover:border-[#015557] hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      handleFileUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />

                  <div className="w-12 h-12 rounded-full bg-teal-50 text-[#015557] flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    Click or drag image file here to upload
                  </p>
                  <p className="text-xs text-slate-500">
                    Automatically opens dedicated crop editor with aspect ratio lock before applying (JPG, PNG, WebP)
                  </p>

                  {isCompressing && (
                    <div className="mt-3 text-xs font-semibold text-[#015557] flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Optimizing image...</span>
                    </div>
                  )}
                </div>

                {compressionStats && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Optimized successfully
                    </span>
                    <span className="font-mono text-[11px]">
                      {formatFileSize(compressionStats.originalSize)} &rarr;{' '}
                      <strong>{formatFileSize(compressionStats.compressedSize)}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: URL */}
            {activeTab === 'url' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800">Direct Image Web Address (URL)</label>
                <input
                  type="url"
                  value={workingUrl.startsWith('data:') ? '' : workingUrl}
                  onChange={(e) => {
                    setWorkingUrl(e.target.value);
                    setUrlInputError(null);
                  }}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557]"
                />
                <p className="text-[11px] text-slate-500">
                  Paste any valid HTTPS image link. Changes will preview live below.
                </p>
              </div>
            )}

            {/* TAB 3: MEDIA LIBRARY */}
            {activeTab === 'library' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Search existing site photography..."
                    className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557]"
                  />
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {filteredLibrary.map((img) => {
                    const isSelected = selectedLibraryId === img.id;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => {
                          setSelectedLibraryId(img.id);
                          setWorkingUrl(img.defaultUrl);
                          setWorkingAlt(img.defaultAlt);
                        }}
                        className={`relative group rounded-lg overflow-hidden border-2 text-left transition-all ${
                          isSelected ? 'border-[#015557] ring-2 ring-[#015557]/30' : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="aspect-video bg-slate-100 overflow-hidden">
                          <img
                            src={img.defaultUrl}
                            alt={img.defaultAlt}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                        <div className="p-1.5 bg-white text-[10px] font-semibold text-slate-800 truncate">
                          {img.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {urlInputError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{urlInputError}</span>
              </div>
            )}

            {/* Alt Text Input */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  Alternative Text (Alt Text)
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Required for SEO &amp; Accessibility</span>
              </div>
              <input
                type="text"
                value={workingAlt}
                onChange={(e) => setWorkingAlt(e.target.value)}
                placeholder="Descriptive explanation of what is in this image..."
                className="w-full px-3.5 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#015557]"
              />
            </div>

            {/* Live Preview Box with Crop & Edit Button */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#015557]" />
                  <span>Instant Image Preview</span>
                </label>
                {workingUrl && (
                  <button
                    type="button"
                    onClick={handleOpenEditorOnCurrent}
                    className="px-2.5 py-1 text-xs font-semibold text-[#015557] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Crop &amp; Edit</span>
                  </button>
                )}
              </div>
              <div className="aspect-video w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative">
                {workingUrl ? (
                  <img
                    src={workingUrl}
                    alt={workingAlt || 'Preview'}
                    className="w-full h-full object-contain"
                    onError={() => setUrlInputError('Failed to load image from provided URL. Please verify the link.')}
                  />
                ) : (
                  <div className="text-center p-4 text-slate-400 text-xs">
                    <FileImage className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                    No image selected yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold text-white bg-[#015557] hover:bg-[#192e2e] rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply to Page</span>
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

export default ImageEditModal;
