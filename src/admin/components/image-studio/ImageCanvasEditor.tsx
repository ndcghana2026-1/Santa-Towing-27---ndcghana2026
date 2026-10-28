import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Sliders,
  Type,
  Sparkles,
  Download,
  Save,
  Undo2,
  Redo2,
  Eye,
  Check,
  X,
  Lock,
  Unlock,
  AlertCircle,
  FileImage,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { StudioImage, ImageFormat, ImageCategory } from '@/lib/imageStudioStorage';
import { formatFileSize } from '@/admin/lib/imageCompressor';

export type AspectRatioType = 'original' | '1:1' | '3:2' | '2:3' | '16:9' | '9:16' | 'custom';

export interface OverlayConfig {
  enabled: boolean;
  type: 'text' | 'logo';
  text: string;
  textColor: string;
  fontSize: number;
  position: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  opacity: number;
  logoUrl?: string;
  logoSizePercent: number; // 5% to 50%
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditState {
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  cropRect: CropRect;
  quality: number; // 0.1 to 1.0
  format: ImageFormat;
  overlay: OverlayConfig;
}

export interface ImageEditorResult {
  dataUrl: string;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
  name: string;
  category?: ImageCategory;
}

export interface ImageCanvasEditorProps {
  sourceImage: {
    id?: string;
    name: string;
    dataUrl: string;
    width?: number;
    height?: number;
    format?: ImageFormat;
    size?: number;
    category?: ImageCategory;
    isEdited?: boolean;
    originalId?: string;
    originalName?: string;
  };
  onSaveAsNew?: (image: {
    name: string;
    dataUrl: string;
    width: number;
    height: number;
    format: ImageFormat;
    size: number;
    category: ImageCategory;
  }) => void;
  onOverwrite?: (image: {
    id: string;
    name: string;
    dataUrl: string;
    width: number;
    height: number;
    format: ImageFormat;
    size: number;
  }) => void;
  onAcceptAndSave?: (result: ImageEditorResult) => void;
  onUseOriginal?: (original: ImageEditorResult) => void;
  onClose: () => void;
  title?: string;
  isUploadWorkflow?: boolean;
}

const PRESET_LOGOS = [
  { label: 'Santa Towing Official Wordmark', url: 'https://i.ibb.co/KgkfFKV/Santa-Logo.png' },
  { label: 'Santa Badge Icon', url: 'https://i.ibb.co/KgkfFKV/Santa-Logo.png' },
];

function formatRatioLabel(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const r = width / height;
  if (Math.abs(r - 1) < 0.02) return '1:1';
  if (Math.abs(r - 16 / 9) < 0.03) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.03) return '9:16';
  if (Math.abs(r - 3 / 2) < 0.03) return '3:2';
  if (Math.abs(r - 2 / 3) < 0.03) return '2:3';
  if (Math.abs(r - 4 / 3) < 0.03) return '4:3';
  if (Math.abs(r - 5 / 4) < 0.03) return '5:4';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const w = Math.round(width);
  const h = Math.round(height);
  const d = gcd(w, h);
  if (d > 5 && w / d <= 30 && h / d <= 30) {
    return `${w / d}:${h / d}`;
  }
  return `${r.toFixed(2)}:1`;
}

export default function ImageCanvasEditor({
  sourceImage,
  onSaveAsNew,
  onOverwrite,
  onAcceptAndSave,
  onUseOriginal,
  onClose,
  title,
  isUploadWorkflow = false,
}: ImageCanvasEditorProps) {
  // By default, open to 'crop' tab for upload workflows so user can immediately adjust handles
  const [activeTab, setActiveTab] = useState<'crop' | 'transform' | 'overlay' | 'export'>(
    isUploadWorkflow ? 'crop' : 'crop'
  );

  // Loaded base HTML Image element
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [loadedLogo, setLoadedLogo] = useState<HTMLImageElement | null>(null);

  // Original image dimensions
  const [origDims, setOrigDims] = useState<{ width: number; height: number }>({
    width: sourceImage.width || 0,
    height: sourceImage.height || 0,
  });

  // Aspect ratio lock toggle (controls proportional scaling of crop width & height)
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioType>('original');
  const [customRatio, setCustomRatio] = useState<number | null>(null);

  // Working edit state
  const [currentState, setCurrentState] = useState<EditState>({
    width: sourceImage.width || 800,
    height: sourceImage.height || 600,
    rotation: 0,
    flipH: false,
    flipV: false,
    cropRect: {
      x: 0,
      y: 0,
      width: sourceImage.width || 800,
      height: sourceImage.height || 600,
    },
    quality: 0.9,
    format: sourceImage.format || 'image/jpeg',
    overlay: {
      enabled: false,
      type: 'text',
      text: 'Santa Towing & Garage Services Ltd. • 0244753849',
      textColor: '#ffffff',
      fontSize: 24,
      position: 'bottom-right',
      opacity: 0.85,
      logoUrl: PRESET_LOGOS[0].url,
      logoSizePercent: 20,
    },
  });

  // History stack for Undo / Redo
  const [history, setHistory] = useState<EditState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Before & After comparison toggle
  const [showOriginalComparison, setShowOriginalComparison] = useState(false);
  const [showCroppedOnlyInCropTab, setShowCroppedOnlyInCropTab] = useState(false);

  // Export name & category
  const [exportName, setExportName] = useState(
    sourceImage.name.endsWith('(Edited)') ? sourceImage.name : `${sourceImage.name} (Edited)`
  );
  const [exportCategory, setExportCategory] = useState<ImageCategory>(sourceImage.category || 'General');

  // Hidden offscreen canvas ref & preview DataURL
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [estimatedSize, setEstimatedSize] = useState<number>(sourceImage.size || 0);

  // Interactive crop viewport refs and bounds
  const containerRef = useRef<HTMLDivElement>(null);
  const displayImgRef = useRef<HTMLImageElement>(null);
  const [displayBounds, setDisplayBounds] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    scale: number;
  } | null>(null);

  // Dragging state for movable crop handles
  const dragState = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startRect: CropRect;
    origW: number;
    origH: number;
    scale: number;
    targetRatio: number | null;
  } | null>(null);

  // Compute oriented dimensions based on rotation
  const isSideways = currentState.rotation === 90 || currentState.rotation === 270;
  const orientedW = isSideways ? origDims.height : origDims.width;
  const orientedH = isSideways ? origDims.width : origDims.height;

  // Active aspect ratio for lock
  const activeRatio = useMemo(() => {
    if (selectedAspectRatio === '1:1') return 1;
    if (selectedAspectRatio === '3:2') return 3 / 2;
    if (selectedAspectRatio === '2:3') return 2 / 3;
    if (selectedAspectRatio === '16:9') return 16 / 9;
    if (selectedAspectRatio === '9:16') return 9 / 16;
    if (customRatio && customRatio > 0) return customRatio;
    if (currentState.cropRect.height > 0) {
      return currentState.cropRect.width / currentState.cropRect.height;
    }
    return 1;
  }, [selectedAspectRatio, customRatio, currentState.cropRect]);

  // Load image asset
  useEffect(() => {
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isCancelled) return;
      setLoadedImg(img);
      setOrigDims({ width: img.naturalWidth, height: img.naturalHeight });
      const initialCrop: CropRect = {
        x: 0,
        y: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      const initial: EditState = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        rotation: 0,
        flipH: false,
        flipV: false,
        cropRect: initialCrop,
        quality: 0.9,
        format: sourceImage.format || 'image/jpeg',
        overlay: {
          enabled: false,
          type: 'text',
          text: 'Santa Towing & Garage Services Ltd. • 0244753849',
          textColor: '#ffffff',
          fontSize: 24,
          position: 'bottom-right',
          opacity: 0.85,
          logoUrl: PRESET_LOGOS[0].url,
          logoSizePercent: 20,
        },
      };
      setCurrentState(initial);
      setHistory([initial]);
      setHistoryIndex(0);
      setCustomRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = sourceImage.dataUrl;

    return () => {
      isCancelled = true;
    };
  }, [sourceImage]);

  // Load logo when overlay logo changes
  useEffect(() => {
    if (currentState.overlay.logoUrl) {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.onload = () => setLoadedLogo(logoImg);
      logoImg.src = currentState.overlay.logoUrl;
    }
  }, [currentState.overlay.logoUrl]);

  // Push state to undo/redo history
  const pushState = useCallback(
    (newState: EditState) => {
      const newHist = history.slice(0, historyIndex + 1);
      newHist.push(newState);
      setHistory(newHist);
      setHistoryIndex(newHist.length - 1);
      setCurrentState(newState);
    },
    [history, historyIndex]
  );

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setCurrentState(history[nextIdx]);
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setCurrentState(history[nextIdx]);
    }
  };

  // Reset to original unmodified state
  const handleReset = () => {
    if (!loadedImg) return;
    const initialCrop: CropRect = {
      x: 0,
      y: 0,
      width: origDims.width,
      height: origDims.height,
    };
    const resetState: EditState = {
      width: origDims.width,
      height: origDims.height,
      rotation: 0,
      flipH: false,
      flipV: false,
      cropRect: initialCrop,
      quality: 0.9,
      format: sourceImage.format || 'image/jpeg',
      overlay: {
        ...currentState.overlay,
        enabled: false,
      },
    };
    setSelectedAspectRatio('original');
    setLockAspectRatio(true);
    setCustomRatio(origDims.width / origDims.height);
    pushState(resetState);
  };

  // Render oriented source canvas (applying rotation & flip deterministically)
  const getOrientedCanvas = useCallback(
    (img: HTMLImageElement, rotation: number, flipH: boolean, flipV: boolean) => {
      const sideways = rotation === 90 || rotation === 270;
      const w = sideways ? img.naturalHeight : img.naturalWidth;
      const h = sideways ? img.naturalWidth : img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();
      return canvas;
    },
    []
  );

  // Full-image oriented DataURL (for displaying the whole picture in Crop tab)
  const orientedDataUrl = useMemo(() => {
    if (!loadedImg) return '';
    try {
      const c = getOrientedCanvas(loadedImg, currentState.rotation, currentState.flipH, currentState.flipV);
      return c.toDataURL();
    } catch {
      return '';
    }
  }, [loadedImg, currentState.rotation, currentState.flipH, currentState.flipV, getOrientedCanvas]);

  // Update display bounds when the viewport or image element resizes
  const updateDisplayBounds = useCallback(() => {
    if (!displayImgRef.current || !containerRef.current || orientedW <= 0 || orientedH <= 0) return;
    const imgRect = displayImgRef.current.getBoundingClientRect();
    const contRect = containerRef.current.getBoundingClientRect();

    const scale = imgRect.width / orientedW;
    setDisplayBounds({
      left: imgRect.left - contRect.left,
      top: imgRect.top - contRect.top,
      width: imgRect.width,
      height: imgRect.height,
      scale,
    });
  }, [orientedW, orientedH]);

  useEffect(() => {
    window.addEventListener('resize', updateDisplayBounds);
    const timer = setTimeout(updateDisplayBounds, 50);
    return () => {
      window.removeEventListener('resize', updateDisplayBounds);
      clearTimeout(timer);
    };
  }, [updateDisplayBounds, orientedDataUrl]);

  // Render to canvas (Deterministic crop, watermark & resolution)
  // Ensures images are NEVER unintentionally stretched or squashed!
  const renderCanvas = useCallback(() => {
    if (!loadedImg || !previewCanvasRef.current || orientedW <= 0 || orientedH <= 0) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { cropRect, quality, format, overlay } = currentState;
    const oriented = getOrientedCanvas(loadedImg, currentState.rotation, currentState.flipH, currentState.flipV);

    // Source rect clamped to oriented dimensions
    const sx = Math.max(0, Math.min(orientedW - 1, cropRect.x));
    const sy = Math.max(0, Math.min(orientedH - 1, cropRect.y));
    const sw = Math.max(1, Math.min(orientedW - sx, cropRect.width));
    const sh = Math.max(1, Math.min(orientedH - sy, cropRect.height));

    // Target output dimensions strictly preserve crop aspect ratio (sw / sh)
    const targetW = Math.round(sw);
    const targetH = Math.round(sh);

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw extracted crop slice with 1:1 pixel accuracy without distortion
    ctx.drawImage(oriented, sx, sy, sw, sh, 0, 0, targetW, targetH);

    // Render watermark overlay if enabled
    if (overlay.enabled) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1, overlay.opacity));

      if (overlay.type === 'text' && overlay.text.trim()) {
        const padding = Math.max(16, Math.round(canvas.width * 0.025));
        const fontSize = Math.max(12, Math.round(overlay.fontSize * (canvas.width / 1000)));
        ctx.font = `bold ${fontSize}px sans-serif`;

        const textMetrics = ctx.measureText(overlay.text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;

        let tx = padding;
        let ty = padding + textHeight;

        if (overlay.position.includes('center')) {
          tx = (canvas.width - textWidth) / 2;
        } else if (overlay.position.includes('right')) {
          tx = canvas.width - textWidth - padding;
        }

        if (overlay.position === 'center') {
          ty = (canvas.height + textHeight) / 2;
        } else if (overlay.position.startsWith('bottom')) {
          ty = canvas.height - padding;
        }

        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = overlay.textColor;
        ctx.fillText(overlay.text, tx, ty);
      } else if (overlay.type === 'logo' && loadedLogo) {
        const padding = Math.max(16, Math.round(canvas.width * 0.025));
        const targetWidth = Math.round(canvas.width * (overlay.logoSizePercent / 100));
        const aspect = loadedLogo.naturalWidth / loadedLogo.naturalHeight;
        const targetHeight = Math.round(targetWidth / aspect);

        let lx = padding;
        let ly = padding;

        if (overlay.position.includes('center')) {
          lx = (canvas.width - targetWidth) / 2;
        } else if (overlay.position.includes('right')) {
          lx = canvas.width - targetWidth - padding;
        }

        if (overlay.position === 'center') {
          ly = (canvas.height - targetHeight) / 2;
        } else if (overlay.position.startsWith('bottom')) {
          ly = canvas.height - targetHeight - padding;
        }

        ctx.drawImage(loadedLogo, lx, ly, targetWidth, targetHeight);
      }

      ctx.restore();
    }

    try {
      const dataUrl = canvas.toDataURL(format, quality);
      setPreviewDataUrl(dataUrl);

      // Estimate byte size from base64
      const head = `data:${format};base64,`;
      const base64Length = dataUrl.length - head.length;
      const byteSize = Math.round((base64Length * 3) / 4);
      setEstimatedSize(byteSize);
    } catch (err) {
      console.warn('Canvas toDataURL failed', err);
    }
  }, [loadedImg, loadedLogo, currentState, orientedW, orientedH, getOrientedCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle Preset Ratio Selection
  const handleSelectAspectRatio = (ratio: AspectRatioType) => {
    setSelectedAspectRatio(ratio);
    if (!loadedImg || orientedW <= 0 || orientedH <= 0) return;

    if (ratio === 'original') {
      setLockAspectRatio(true);
      const fullCrop: CropRect = {
        x: 0,
        y: 0,
        width: orientedW,
        height: orientedH,
      };
      setCustomRatio(orientedW / orientedH);
      pushState({
        ...currentState,
        cropRect: fullCrop,
        width: orientedW,
        height: orientedH,
      });
      return;
    }

    if (ratio === 'custom') {
      // Keep current crop and unlock
      setLockAspectRatio(false);
      return;
    }

    let targetRatio = 1;
    switch (ratio) {
      case '1:1':
        targetRatio = 1;
        break;
      case '3:2':
        targetRatio = 3 / 2;
        break;
      case '2:3':
        targetRatio = 2 / 3;
        break;
      case '16:9':
        targetRatio = 16 / 9;
        break;
      case '9:16':
        targetRatio = 9 / 16;
        break;
    }

    setLockAspectRatio(true);
    setCustomRatio(targetRatio);

    const currentImgRatio = orientedW / orientedH;
    let cropW = orientedW;
    let cropH = orientedH;

    if (currentImgRatio > targetRatio) {
      cropW = Math.round(orientedH * targetRatio);
      cropH = orientedH;
    } else {
      cropW = orientedW;
      cropH = Math.round(orientedW / targetRatio);
    }

    const cropX = Math.round((orientedW - cropW) / 2);
    const cropY = Math.round((orientedH - cropH) / 2);

    pushState({
      ...currentState,
      cropRect: { x: cropX, y: cropY, width: cropW, height: cropH },
      width: cropW,
      height: cropH,
    });
  };

  // Toggle Padlock Icon (Lock / Unlock Aspect Ratio)
  const toggleLockAspectRatio = () => {
    const nextLocked = !lockAspectRatio;
    setLockAspectRatio(nextLocked);

    if (nextLocked) {
      // When lock is enabled, establish the current crop rectangle's proportion as the active ratio
      const establishedRatio = currentState.cropRect.width / currentState.cropRect.height;
      setCustomRatio(establishedRatio);
    } else {
      // When unlocked, user is free to create any rectangular crop shape
      if (selectedAspectRatio !== 'custom') {
        setSelectedAspectRatio('custom');
      }
    }
  };

  // Manual Width Entry
  const handleCropWidthInput = (val: number) => {
    if (orientedW <= 0 || orientedH <= 0) return;
    const newWidth = Math.max(20, Math.min(orientedW, val));
    const current = currentState.cropRect;

    if (lockAspectRatio) {
      const ratio = activeRatio > 0 ? activeRatio : current.width / current.height;
      let newHeight = Math.round(newWidth / ratio);

      if (newHeight > orientedH) {
        newHeight = orientedH;
        const adjustedWidth = Math.round(newHeight * ratio);
        let newX = current.x;
        let newY = current.y;
        if (newX + adjustedWidth > orientedW) newX = Math.max(0, orientedW - adjustedWidth);
        if (newY + newHeight > orientedH) newY = Math.max(0, orientedH - newHeight);
        pushState({
          ...currentState,
          cropRect: { x: newX, y: newY, width: adjustedWidth, height: newHeight },
          width: adjustedWidth,
          height: newHeight,
        });
        return;
      }

      let newX = current.x;
      let newY = current.y;
      if (newX + newWidth > orientedW) newX = Math.max(0, orientedW - newWidth);
      if (newY + newHeight > orientedH) newY = Math.max(0, orientedH - newHeight);

      pushState({
        ...currentState,
        cropRect: { x: newX, y: newY, width: newWidth, height: newHeight },
        width: newWidth,
        height: newHeight,
      });
    } else {
      // Unlocked mode: change width independently
      let newX = current.x;
      if (newX + newWidth > orientedW) newX = Math.max(0, orientedW - newWidth);
      pushState({
        ...currentState,
        cropRect: { ...current, x: newX, width: newWidth },
        width: newWidth,
      });
    }
  };

  // Manual Height Entry
  const handleCropHeightInput = (val: number) => {
    if (orientedW <= 0 || orientedH <= 0) return;
    const newHeight = Math.max(20, Math.min(orientedH, val));
    const current = currentState.cropRect;

    if (lockAspectRatio) {
      const ratio = activeRatio > 0 ? activeRatio : current.width / current.height;
      let newWidth = Math.round(newHeight * ratio);

      if (newWidth > orientedW) {
        newWidth = orientedW;
        const adjustedHeight = Math.round(newWidth / ratio);
        let newX = current.x;
        let newY = current.y;
        if (newX + newWidth > orientedW) newX = Math.max(0, orientedW - newWidth);
        if (newY + adjustedHeight > orientedH) newY = Math.max(0, orientedH - adjustedHeight);
        pushState({
          ...currentState,
          cropRect: { x: newX, y: newY, width: newWidth, height: adjustedHeight },
          width: newWidth,
          height: adjustedHeight,
        });
        return;
      }

      let newX = current.x;
      let newY = current.y;
      if (newX + newWidth > orientedW) newX = Math.max(0, orientedW - newWidth);
      if (newY + newHeight > orientedH) newY = Math.max(0, orientedH - newHeight);

      pushState({
        ...currentState,
        cropRect: { x: newX, y: newY, width: newWidth, height: newHeight },
        width: newWidth,
        height: newHeight,
      });
    } else {
      // Unlocked mode: change height independently
      let newY = current.y;
      if (newY + newHeight > orientedH) newY = Math.max(0, orientedH - newHeight);
      pushState({
        ...currentState,
        cropRect: { ...current, y: newY, height: newHeight },
        height: newHeight,
      });
    }
  };

  // Rotation CW / CCW
  const handleRotateCW = () => {
    const newRot = (currentState.rotation + 90) % 360;
    // Swap crop dimensions to match rotated coordinate system
    const oldCrop = currentState.cropRect;
    const newOrientedW = orientedH;
    const newOrientedH = orientedW;
    const newCrop: CropRect = {
      x: Math.max(0, Math.min(newOrientedW - oldCrop.height, oldCrop.y)),
      y: Math.max(0, Math.min(newOrientedH - oldCrop.width, oldCrop.x)),
      width: Math.min(newOrientedW, oldCrop.height),
      height: Math.min(newOrientedH, oldCrop.width),
    };
    pushState({
      ...currentState,
      rotation: newRot,
      cropRect: newCrop,
      width: newCrop.width,
      height: newCrop.height,
    });
  };

  const handleRotateCCW = () => {
    const newRot = (currentState.rotation - 90 + 360) % 360;
    const oldCrop = currentState.cropRect;
    const newOrientedW = orientedH;
    const newOrientedH = orientedW;
    const newCrop: CropRect = {
      x: Math.max(0, Math.min(newOrientedW - oldCrop.height, oldCrop.y)),
      y: Math.max(0, Math.min(newOrientedH - oldCrop.width, oldCrop.x)),
      width: Math.min(newOrientedW, oldCrop.height),
      height: Math.min(newOrientedH, oldCrop.width),
    };
    pushState({
      ...currentState,
      rotation: newRot,
      cropRect: newCrop,
      width: newCrop.width,
      height: newCrop.height,
    });
  };

  // Flip
  const handleFlipH = () => {
    pushState({ ...currentState, flipH: !currentState.flipH });
  };

  const handleFlipV = () => {
    pushState({ ...currentState, flipV: !currentState.flipV });
  };

  // Movable Crop Handles Interaction (Touch + Mouse Pointer Events)
  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!displayBounds) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragState.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...currentState.cropRect },
      origW: orientedW,
      origH: orientedH,
      scale: displayBounds.scale,
      targetRatio: lockAspectRatio ? activeRatio : null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    e.preventDefault();

    const { handle, startX, startY, startRect, origW, origH, scale, targetRatio } = dragState.current;
    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;

    if (handle === 'move') {
      // Reposition crop area freely within image boundaries without changing dimensions or ratio
      let newX = Math.round(startRect.x + dx);
      let newY = Math.round(startRect.y + dy);
      newX = Math.max(0, Math.min(origW - startRect.width, newX));
      newY = Math.max(0, Math.min(origH - startRect.height, newY));

      setCurrentState((prev) => ({
        ...prev,
        cropRect: {
          ...prev.cropRect,
          x: newX,
          y: newY,
        },
      }));
      return;
    }

    // Handle resizing: Locked vs Unlocked
    if (targetRatio && targetRatio > 0) {
      // Proportional resizing (Locked mode)
      const R = targetRatio;
      let newRect = { ...startRect };

      if (handle === 'se') {
        let w = Math.max(20, startRect.width + dx);
        let h = w / R;
        if (startRect.x + w > origW) {
          w = origW - startRect.x;
          h = w / R;
        }
        if (startRect.y + h > origH) {
          h = origH - startRect.y;
          w = h * R;
        }
        newRect = { x: startRect.x, y: startRect.y, width: Math.round(w), height: Math.round(h) };
      } else if (handle === 'sw') {
        let w = Math.max(20, startRect.width - dx);
        let h = w / R;
        if (w > startRect.x + startRect.width) {
          w = startRect.x + startRect.width;
          h = w / R;
        }
        if (startRect.y + h > origH) {
          h = origH - startRect.y;
          w = h * R;
        }
        const x = startRect.x + startRect.width - w;
        newRect = { x: Math.round(x), y: startRect.y, width: Math.round(w), height: Math.round(h) };
      } else if (handle === 'ne') {
        let w = Math.max(20, startRect.width + dx);
        let h = w / R;
        if (startRect.x + w > origW) {
          w = origW - startRect.x;
          h = w / R;
        }
        if (h > startRect.y + startRect.height) {
          h = startRect.y + startRect.height;
          w = h * R;
        }
        const y = startRect.y + startRect.height - h;
        newRect = { x: startRect.x, y: Math.round(y), width: Math.round(w), height: Math.round(h) };
      } else if (handle === 'nw') {
        let w = Math.max(20, startRect.width - dx);
        let h = w / R;
        if (w > startRect.x + startRect.width) {
          w = startRect.x + startRect.width;
          h = w / R;
        }
        if (h > startRect.y + startRect.height) {
          h = startRect.y + startRect.height;
          w = h * R;
        }
        const x = startRect.x + startRect.width - w;
        const y = startRect.y + startRect.height - h;
        newRect = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
      } else if (handle === 'e' || handle === 'w') {
        let w = handle === 'e' ? Math.max(20, startRect.width + dx) : Math.max(20, startRect.width - dx);
        if (handle === 'e' && startRect.x + w > origW) w = origW - startRect.x;
        if (handle === 'w' && w > startRect.x + startRect.width) w = startRect.x + startRect.width;
        let h = w / R;
        if (h > origH) {
          h = origH;
          w = h * R;
        }
        const centerY = startRect.y + startRect.height / 2;
        let y = Math.round(centerY - h / 2);
        if (y < 0) y = 0;
        if (y + h > origH) y = origH - Math.round(h);
        const x = handle === 'w' ? Math.round(startRect.x + startRect.width - w) : startRect.x;
        newRect = { x, y, width: Math.round(w), height: Math.round(h) };
      } else if (handle === 's' || handle === 'n') {
        let h = handle === 's' ? Math.max(20, startRect.height + dy) : Math.max(20, startRect.height - dy);
        if (handle === 's' && startRect.y + h > origH) h = origH - startRect.y;
        if (handle === 'n' && h > startRect.y + startRect.height) h = startRect.y + startRect.height;
        let w = h * R;
        if (w > origW) {
          w = origW;
          h = w / R;
        }
        const centerX = startRect.x + startRect.width / 2;
        let x = Math.round(centerX - w / 2);
        if (x < 0) x = 0;
        if (x + w > origW) x = origW - Math.round(w);
        const y = handle === 'n' ? Math.round(startRect.y + startRect.height - h) : startRect.y;
        newRect = { x, y, width: Math.round(w), height: Math.round(h) };
      }

      setCurrentState((prev) => ({
        ...prev,
        cropRect: newRect,
        width: newRect.width,
        height: newRect.height,
      }));
    } else {
      // Independent freeform adjustments (Unlocked mode)
      let { x, y, width, height } = startRect;

      if (handle.includes('e')) {
        width = Math.max(20, Math.min(origW - x, startRect.width + dx));
      }
      if (handle.includes('s')) {
        height = Math.max(20, Math.min(origH - y, startRect.height + dy));
      }
      if (handle.includes('w')) {
        const maxW = startRect.x + startRect.width;
        const newW = Math.max(20, Math.min(maxW, startRect.width - dx));
        x = maxW - newW;
        width = newW;
      }
      if (handle.includes('n')) {
        const maxH = startRect.y + startRect.height;
        const newH = Math.max(20, Math.min(maxH, startRect.height - dy));
        y = maxH - newH;
        height = newH;
      }

      setCurrentState((prev) => ({
        ...prev,
        cropRect: {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        },
        width: Math.round(width),
        height: Math.round(height),
      }));
    }
  };

  const handlePointerUp = () => {
    if (dragState.current) {
      dragState.current = null;
      // Push finalized state to history
      pushState(currentState);
    }
  };

  // Primary Action: Accept and Save
  const handleAcceptAndSave = () => {
    if (!previewDataUrl) return;

    const result: ImageEditorResult = {
      name: exportName.trim() || 'Santa_Edited_Image.jpg',
      dataUrl: previewDataUrl,
      width: currentState.cropRect.width,
      height: currentState.cropRect.height,
      format: currentState.format,
      size: estimatedSize,
      category: exportCategory,
    };

    if (onAcceptAndSave) {
      onAcceptAndSave(result);
    } else if (onSaveAsNew) {
      onSaveAsNew({
        name: result.name,
        dataUrl: result.dataUrl,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.size,
        category: exportCategory,
      });
    }
    onClose();
  };

  // Primary Action: Use Original Image
  const handleUseOriginal = () => {
    const originalResult: ImageEditorResult = {
      name: sourceImage.name,
      dataUrl: sourceImage.dataUrl,
      width: origDims.width,
      height: origDims.height,
      format: sourceImage.format || 'image/jpeg',
      size: sourceImage.size || 0,
      category: sourceImage.category || 'General',
    };

    if (onUseOriginal) {
      onUseOriginal(originalResult);
    } else if (onSaveAsNew) {
      onSaveAsNew({
        name: originalResult.name,
        dataUrl: originalResult.dataUrl,
        width: originalResult.width,
        height: originalResult.height,
        format: originalResult.format,
        size: originalResult.size,
        category: originalResult.category || 'General',
      });
    }
    onClose();
  };

  // Save As New Copy (for Image Studio library)
  const handleSaveAsNewCopy = () => {
    if (!previewDataUrl || !onSaveAsNew) return;
    onSaveAsNew({
      name: exportName.trim() || 'Santa_Edited_Image.jpg',
      dataUrl: previewDataUrl,
      width: currentState.cropRect.width,
      height: currentState.cropRect.height,
      format: currentState.format,
      size: estimatedSize,
      category: exportCategory,
    });
  };

  // Overwrite Original (for Image Studio library)
  const handleOverwriteOriginal = () => {
    if (!previewDataUrl || !onOverwrite || !sourceImage.id) return;
    onOverwrite({
      id: sourceImage.id,
      name: exportName.trim() || sourceImage.name,
      dataUrl: previewDataUrl,
      width: currentState.cropRect.width,
      height: currentState.cropRect.height,
      format: currentState.format,
      size: estimatedSize,
    });
  };

  // Download directly to local storage
  const handleDownload = () => {
    if (!previewDataUrl) return;
    const ext =
      currentState.format === 'image/png' ? 'png' : currentState.format === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${exportName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
    const a = document.createElement('a');
    a.href = previewDataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 200);
  };

  // Custom logo upload
  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        pushState({
          ...currentState,
          overlay: {
            ...currentState.overlay,
            enabled: true,
            type: 'logo',
            logoUrl: reader.result as string,
          },
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Screen coordinates for crop box overlay
  const cropBoxScreen = useMemo(() => {
    if (!displayBounds) return null;
    const { left, top, scale } = displayBounds;
    const { x, y, width, height } = currentState.cropRect;
    return {
      left: left + x * scale,
      top: top + y * scale,
      width: width * scale,
      height: height * scale,
    };
  }, [displayBounds, currentState.cropRect]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-editor-modal-title"
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200 select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Header Bar */}
      <div className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#015557] flex items-center justify-center text-white shrink-0">
            <Crop className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="image-editor-modal-title"
              className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2 truncate"
            >
              <span>{title || 'Image Preview & Editing Studio'}</span>
              <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded truncate max-w-[160px] sm:max-w-xs">
                {sourceImage.name}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              Accurate movable crop handles, predefined &amp; custom aspect ratios with padlock locking
            </p>
          </div>
        </div>

        {/* History, Compare & Close Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 text-slate-300 hover:text-white disabled:text-slate-600 hover:bg-slate-800 rounded-lg transition-colors"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 text-slate-300 hover:text-white disabled:text-slate-600 hover:bg-slate-800 rounded-lg transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors hidden sm:flex items-center gap-1.5"
            title="Reset to original dimensions and orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => setShowOriginalComparison(!showOriginalComparison)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              showOriginalComparison ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{showOriginalComparison ? 'Viewing Original' : 'Compare Original'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image editor"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center Canvas Preview Area */}
        <div className="flex-1 bg-slate-950 p-3 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Hidden rendering canvas */}
          <canvas ref={previewCanvasRef} className="hidden" />

          {/* Interactive Workspace Viewport */}
          <div
            ref={containerRef}
            className="relative max-w-full max-h-[62vh] sm:max-h-[68vh] flex items-center justify-center border border-slate-800 rounded-xl overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] shadow-2xl p-2 select-none"
          >
            {showOriginalComparison ? (
              <img
                src={sourceImage.dataUrl}
                alt="Original Unmodified"
                className="max-h-[58vh] sm:max-h-[64vh] max-w-full object-contain rounded select-none pointer-events-none"
              />
            ) : activeTab === 'crop' && !showCroppedOnlyInCropTab && orientedDataUrl ? (
              /* INTERACTIVE CROP VIEW WITH MOVABLE HANDLES */
              <div className="relative inline-block select-none">
                <img
                  ref={displayImgRef}
                  src={orientedDataUrl}
                  alt="Full oriented frame"
                  className="max-h-[58vh] sm:max-h-[64vh] max-w-full object-contain rounded select-none pointer-events-none"
                  onLoad={updateDisplayBounds}
                />

                {/* Crop Backdrop Mask Panels */}
                {displayBounds && cropBoxScreen && (
                  <>
                    {/* Top Mask */}
                    <div
                      className="absolute bg-slate-950/70 pointer-events-none"
                      style={{
                        top: displayBounds.top,
                        left: displayBounds.left,
                        width: displayBounds.width,
                        height: Math.max(0, cropBoxScreen.top - displayBounds.top),
                      }}
                    />
                    {/* Bottom Mask */}
                    <div
                      className="absolute bg-slate-950/70 pointer-events-none"
                      style={{
                        top: cropBoxScreen.top + cropBoxScreen.height,
                        left: displayBounds.left,
                        width: displayBounds.width,
                        height: Math.max(
                          0,
                          displayBounds.top + displayBounds.height - (cropBoxScreen.top + cropBoxScreen.height)
                        ),
                      }}
                    />
                    {/* Left Mask */}
                    <div
                      className="absolute bg-slate-950/70 pointer-events-none"
                      style={{
                        top: cropBoxScreen.top,
                        left: displayBounds.left,
                        width: Math.max(0, cropBoxScreen.left - displayBounds.left),
                        height: cropBoxScreen.height,
                      }}
                    />
                    {/* Right Mask */}
                    <div
                      className="absolute bg-slate-950/70 pointer-events-none"
                      style={{
                        top: cropBoxScreen.top,
                        left: cropBoxScreen.left + cropBoxScreen.width,
                        width: Math.max(
                          0,
                          displayBounds.left + displayBounds.width - (cropBoxScreen.left + cropBoxScreen.width)
                        ),
                        height: cropBoxScreen.height,
                      }}
                    />

                    {/* MOVABLE CROP BOX WITH HANDLES */}
                    <div
                      style={{
                        left: cropBoxScreen.left,
                        top: cropBoxScreen.top,
                        width: cropBoxScreen.width,
                        height: cropBoxScreen.height,
                      }}
                      className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] cursor-move touch-none z-20 select-none"
                      onPointerDown={(e) => handlePointerDown(e, 'move')}
                    >
                      {/* Rule of thirds grid lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                        <div className="border-r border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div className="border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div className="border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div className="border-r border-b border-white" />
                        <div />
                      </div>

                      {/* Dimension Badge on Top of Crop Box */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap border border-slate-700 flex items-center gap-1.5">
                        <span>
                          {Math.round(currentState.cropRect.width)} &times; {Math.round(currentState.cropRect.height)} px
                        </span>
                        <span className="text-emerald-400 font-semibold">
                          ({formatRatioLabel(currentState.cropRect.width, currentState.cropRect.height)})
                        </span>
                        {lockAspectRatio ? (
                          <Lock className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Unlock className="w-2.5 h-2.5 text-amber-400" />
                        )}
                      </div>

                      {/* 4 Corner Handles (NW, NE, SW, SE) */}
                      <div
                        aria-label="Crop handle top-left"
                        className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-[#015557] rounded-xs shadow cursor-nwse-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 'nw')}
                      />
                      <div
                        aria-label="Crop handle top-right"
                        className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-[#015557] rounded-xs shadow cursor-nesw-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 'ne')}
                      />
                      <div
                        aria-label="Crop handle bottom-left"
                        className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-[#015557] rounded-xs shadow cursor-nesw-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 'sw')}
                      />
                      <div
                        aria-label="Crop handle bottom-right"
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-[#015557] rounded-xs shadow cursor-nwse-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 'se')}
                      />

                      {/* 4 Edge Handles (N, S, W, E) */}
                      <div
                        aria-label="Crop handle top edge"
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-white border border-[#015557] rounded-xs shadow cursor-ns-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 'n')}
                      />
                      <div
                        aria-label="Crop handle bottom edge"
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-white border border-[#015557] rounded-xs shadow cursor-ns-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 's')}
                      />
                      <div
                        aria-label="Crop handle left edge"
                        className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2.5 h-6 bg-white border border-[#015557] rounded-xs shadow cursor-ew-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 'w')}
                      />
                      <div
                        aria-label="Crop handle right edge"
                        className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2.5 h-6 bg-white border border-[#015557] rounded-xs shadow cursor-ew-resize z-30 touch-none hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDown(e, 'e')}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : previewDataUrl ? (
              /* Trimmed result preview */
              <img
                src={previewDataUrl}
                alt="Edited Preview"
                className="max-h-[58vh] sm:max-h-[64vh] max-w-full object-contain rounded select-none"
              />
            ) : (
              <div className="p-12 text-slate-500 text-sm">Processing image canvas...</div>
            )}

            {/* Comparison banner */}
            {showOriginalComparison && (
              <div className="absolute top-4 left-4 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded shadow-lg uppercase tracking-wider">
                Original Unmodified Reference
              </div>
            )}
          </div>

          {/* Toggle View in Crop Tab + Status Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 w-full max-w-3xl px-2">
            {activeTab === 'crop' && (
              <button
                type="button"
                onClick={() => setShowCroppedOnlyInCropTab(!showCroppedOnlyInCropTab)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ${
                  showCroppedOnlyInCropTab
                    ? 'bg-[#015557] text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{showCroppedOnlyInCropTab ? 'Show Crop Handles' : 'Preview Cropped Result'}</span>
              </button>
            )}

            {/* Live Dimension, Aspect Ratio & File Size Status */}
            <div className="flex items-center gap-3 sm:gap-4 px-3.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-full text-xs font-mono text-slate-300 shadow-lg ml-auto">
              <span className="flex items-center gap-1">
                <span className="text-slate-500 hidden sm:inline">Crop Output:</span>
                <span className="font-bold text-emerald-400">
                  {Math.round(currentState.cropRect.width)} &times; {Math.round(currentState.cropRect.height)} px
                </span>
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500 hidden sm:inline">Ratio:</span>
                <span className="font-bold text-white">
                  {formatRatioLabel(currentState.cropRect.width, currentState.cropRect.height)}
                </span>
              </span>
              <span className="text-slate-600 hidden sm:inline">&bull;</span>
              <span className="flex items-center gap-1 hidden sm:flex">
                <span className="text-slate-500">Est. Size:</span>
                <span className="font-bold text-emerald-400">{formatFileSize(estimatedSize)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar Control Tabs */}
        <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0 max-h-[45vh] lg:max-h-none overflow-hidden">
          {/* Tool Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/80 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('crop')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'crop'
                  ? 'border-[#015557] text-white bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Aspect Crop</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transform')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'transform'
                  ? 'border-[#015557] text-white bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Resize &amp; Flip</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overlay')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'overlay'
                  ? 'border-[#015557] text-white bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Watermark</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'export'
                  ? 'border-[#015557] text-white bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Export</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-slate-200">
            {/* 1. ASPECT RATIO & CROP TAB */}
            {activeTab === 'crop' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Accurate Crop &amp; Aspect Ratio
                  </h3>
                  <p className="text-xs text-slate-400">
                    Drag movable handles on the image preview or enter dimensions below. Lock ratio to ensure exact
                    proportions without distortion.
                  </p>
                </div>

                {/* Aspect Ratio Lock Banner with Clickable Padlock */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    lockAspectRatio
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={toggleLockAspectRatio}
                      title={
                        lockAspectRatio
                          ? 'Aspect ratio locked: Width and height scale proportionally. Click to unlock.'
                          : 'Aspect ratio unlocked: Width and height scale independently. Click to lock.'
                      }
                      aria-label={
                        lockAspectRatio
                          ? 'Aspect ratio locked. Click to unlock.'
                          : 'Aspect ratio unlocked. Click to lock.'
                      }
                      className={`p-2 rounded-lg border transition-all ${
                        lockAspectRatio
                          ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600'
                          : 'bg-amber-500 text-white border-amber-400 hover:bg-amber-600'
                      }`}
                    >
                      {lockAspectRatio ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {lockAspectRatio ? 'Aspect Ratio Locked' : 'Freeform Rectangle (Unlocked)'}
                      </span>
                      <span className="text-[11px] opacity-80 block">
                        {lockAspectRatio
                          ? `Maintains ${formatRatioLabel(
                              currentState.cropRect.width,
                              currentState.cropRect.height
                            )} proportional scaling`
                          : 'Adjust width & height independently'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleLockAspectRatio}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
                  >
                    {lockAspectRatio ? 'Unlock' : 'Lock'}
                  </button>
                </div>

                {/* Crop Width & Height Inputs with Neat Padlock Between Them */}
                <div className="space-y-1.5 bg-slate-800/50 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Crop Dimensions &amp; Ratio Lock
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Width Field */}
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-semibold text-slate-300 block">Width (px)</label>
                      <input
                        type="number"
                        min="20"
                        max={orientedW}
                        value={Math.round(currentState.cropRect.width)}
                        onChange={(e) => handleCropWidthInput(parseInt(e.target.value) || 20)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-[#015557]"
                      />
                    </div>

                    {/* Padlock Icon Neatly Positioned Between Width and Height */}
                    <div className="pt-5 flex flex-col items-center">
                      <button
                        type="button"
                        onClick={toggleLockAspectRatio}
                        title={
                          lockAspectRatio
                            ? 'Aspect ratio locked: Width and height scale proportionally (Click to unlock)'
                            : 'Aspect ratio unlocked: Width and height scale independently (Click to lock)'
                        }
                        aria-label={
                          lockAspectRatio
                            ? 'Aspect ratio locked. Click to unlock.'
                            : 'Aspect ratio unlocked. Click to lock.'
                        }
                        className={`p-2 rounded-lg border transition-all ${
                          lockAspectRatio
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30'
                        }`}
                      >
                        {lockAspectRatio ? (
                          <Lock className="w-4 h-4 shrink-0" />
                        ) : (
                          <Unlock className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    </div>

                    {/* Height Field */}
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-semibold text-slate-300 block">Height (px)</label>
                      <input
                        type="number"
                        min="20"
                        max={orientedH}
                        value={Math.round(currentState.cropRect.height)}
                        onChange={(e) => handleCropHeightInput(parseInt(e.target.value) || 20)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-[#015557]"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
                    {lockAspectRatio
                      ? 'Proportional scaling is ON. Changing either dimension automatically calculates the other.'
                      : 'Freeform mode is ON. Changing width or height modifies that dimension independently.'}
                  </p>
                </div>

                {/* Predefined Aspect Ratios & Custom Selector */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Predefined &amp; Custom Aspect Ratios
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'original', label: 'Original', desc: 'Preserve bounds' },
                      { key: '1:1', label: '1:1 Square', desc: 'Avatars & parts' },
                      { key: '3:2', label: '3:2 Landscape', desc: 'Standard fleet' },
                      { key: '2:3', label: '2:3 Portrait', desc: 'Vertical posters' },
                      { key: '16:9', label: '16:9 Widescreen', desc: 'Banners & hero' },
                      { key: '9:16', label: '9:16 Vertical', desc: 'Mobile stories' },
                    ].map((preset) => {
                      const isSelected = selectedAspectRatio === preset.key;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => handleSelectAspectRatio(preset.key as AspectRatioType)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-start justify-between ${
                            isSelected
                              ? 'bg-[#015557] border-emerald-400 text-white shadow-md'
                              : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-xs block">{preset.label}</span>
                            <span
                              className={`text-[10px] block mt-0.5 ${
                                isSelected ? 'text-emerald-100' : 'text-slate-400'
                              }`}
                            >
                              {preset.desc}
                            </span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Aspect Ratio Option */}
                  <button
                    type="button"
                    onClick={() => handleSelectAspectRatio('custom')}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      selectedAspectRatio === 'custom'
                        ? 'bg-[#015557] border-emerald-400 text-white shadow-md'
                        : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-xs block">Custom Aspect Ratio</span>
                      <span
                        className={`text-[10px] block ${
                          selectedAspectRatio === 'custom' ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        Enter any width &amp; height above (e.g. 500 &times; 400 for 5:4) and toggle lock
                      </span>
                    </div>
                    {selectedAspectRatio === 'custom' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                  </button>
                </div>
              </div>
            )}

            {/* 2. RESIZE & FLIP (TRANSFORM) TAB */}
            {activeTab === 'transform' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Orientation &amp; Transformations
                  </h3>
                  <p className="text-xs text-slate-400">
                    Rotate clockwise, counter-clockwise, or flip horizontally/vertically without distorting geometry.
                  </p>
                </div>

                {/* Rotation & Flip Controls */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Rotation &amp; Orientation
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRotateCCW}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-emerald-400" />
                      <span>Rotate -90&deg;</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRotateCW}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors"
                    >
                      <RotateCw className="w-4 h-4 text-emerald-400" />
                      <span>Rotate +90&deg;</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleFlipH}
                      className={`p-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
                        currentState.flipH
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      <FlipHorizontal className="w-4 h-4" />
                      <span>Flip Horizontal</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleFlipV}
                      className={`p-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
                        currentState.flipV
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      <FlipVertical className="w-4 h-4" />
                      <span>Flip Vertical</span>
                    </button>
                  </div>
                </div>

                {/* Quick Aspect Presets */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Quick Standard Presets
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSelectAspectRatio('16:9')}
                      className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white text-left transition-colors font-mono"
                    >
                      16:9 Landscape <span className="text-slate-500 block text-[10px]">Widescreen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAspectRatio('1:1')}
                      className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white text-left transition-colors font-mono"
                    >
                      1:1 Square <span className="text-slate-500 block text-[10px]">Profile / Part</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAspectRatio('3:2')}
                      className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white text-left transition-colors font-mono"
                    >
                      3:2 Standard <span className="text-slate-500 block text-[10px]">Photography</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAspectRatio('9:16')}
                      className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white text-left transition-colors font-mono"
                    >
                      9:16 Vertical <span className="text-slate-500 block text-[10px]">Mobile Story</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TEXT & LOGO WATERMARK TAB */}
            {activeTab === 'overlay' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Text &amp; Logo Watermark
                  </h3>
                  <p className="text-xs text-slate-400">
                    Add branded text, emergency phone numbers, or corporate logo watermarks.
                  </p>
                </div>

                <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Enable Watermark Overlay</span>
                  <input
                    type="checkbox"
                    checked={currentState.overlay.enabled}
                    onChange={(e) =>
                      pushState({
                        ...currentState,
                        overlay: { ...currentState.overlay, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#015557] rounded cursor-pointer"
                  />
                </div>

                {currentState.overlay.enabled && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() =>
                          pushState({
                            ...currentState,
                            overlay: { ...currentState.overlay, type: 'text' },
                          })
                        }
                        className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          currentState.overlay.type === 'text'
                            ? 'bg-[#015557] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Text Overlay
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          pushState({
                            ...currentState,
                            overlay: { ...currentState.overlay, type: 'logo' },
                          })
                        }
                        className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          currentState.overlay.type === 'logo'
                            ? 'bg-[#015557] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Company Logo
                      </button>
                    </div>

                    {currentState.overlay.type === 'text' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-300">Watermark Text</label>
                          <textarea
                            rows={2}
                            value={currentState.overlay.text}
                            onChange={(e) =>
                              pushState({
                                ...currentState,
                                overlay: { ...currentState.overlay, text: e.target.value },
                              })
                            }
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#015557]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">
                              Font Size ({currentState.overlay.fontSize}px)
                            </label>
                            <input
                              type="range"
                              min="12"
                              max="72"
                              value={currentState.overlay.fontSize}
                              onChange={(e) =>
                                pushState({
                                  ...currentState,
                                  overlay: { ...currentState.overlay, fontSize: parseInt(e.target.value) },
                                })
                              }
                              className="w-full accent-[#015557]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">Text Color</label>
                            <input
                              type="color"
                              value={currentState.overlay.textColor}
                              onChange={(e) =>
                                pushState({
                                  ...currentState,
                                  overlay: { ...currentState.overlay, textColor: e.target.value },
                                })
                              }
                              className="w-full h-8 bg-transparent cursor-pointer rounded"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {currentState.overlay.type === 'logo' && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Select Preset Logo</label>
                          <select
                            value={currentState.overlay.logoUrl}
                            onChange={(e) =>
                              pushState({
                                ...currentState,
                                overlay: { ...currentState.overlay, logoUrl: e.target.value },
                              })
                            }
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#015557]"
                          >
                            {PRESET_LOGOS.map((pl) => (
                              <option key={pl.url} value={pl.url}>
                                {pl.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Or Upload Custom Logo PNG</label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleCustomLogoUpload}
                            className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-300">
                            Logo Scale ({currentState.overlay.logoSizePercent}%)
                          </label>
                          <input
                            type="range"
                            min="5"
                            max="50"
                            value={currentState.overlay.logoSizePercent}
                            onChange={(e) =>
                              pushState({
                                ...currentState,
                                overlay: {
                                  ...currentState.overlay,
                                  logoSizePercent: parseInt(e.target.value),
                                },
                              })
                            }
                            className="w-full accent-[#015557]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Position &amp; Alignment</label>
                        <select
                          value={currentState.overlay.position}
                          onChange={(e) =>
                            pushState({
                              ...currentState,
                              overlay: {
                                ...currentState.overlay,
                                position: e.target.value as OverlayConfig['position'],
                              },
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#015557]"
                        >
                          <option value="bottom-right">Bottom Right (Recommended)</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="bottom-center">Bottom Center</option>
                          <option value="top-right">Top Right</option>
                          <option value="top-left">Top Left</option>
                          <option value="top-center">Top Center</option>
                          <option value="center">Direct Center</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Watermark Opacity ({Math.round(currentState.overlay.opacity * 100)}%)
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={currentState.overlay.opacity}
                          onChange={(e) =>
                            pushState({
                              ...currentState,
                              overlay: {
                                ...currentState.overlay,
                                opacity: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="w-full accent-[#015557]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. SAVE & EXPORT TAB */}
            {activeTab === 'export' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Export &amp; Quality Settings
                  </h3>
                  <p className="text-xs text-slate-400">
                    Adjust compression quality, select format, and save directly or download.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Save Image Name</label>
                    <input
                      type="text"
                      value={exportName}
                      onChange={(e) => setExportName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#015557]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Category Tag</label>
                    <select
                      value={exportCategory}
                      onChange={(e) => setExportCategory(e.target.value as ImageCategory)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#015557]"
                    >
                      <option value="Fleet">Fleet Vehicles</option>
                      <option value="Towing">Towing &amp; Recovery</option>
                      <option value="Haulage">Heavy Haulage</option>
                      <option value="Garage">Garage &amp; Repairs</option>
                      <option value="Documents">Documents &amp; Branding</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Output Format</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['image/jpeg', 'image/png', 'image/webp'] as ImageFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => pushState({ ...currentState, format: fmt })}
                          className={`py-2 text-xs font-mono font-bold rounded-lg border transition-all ${
                            currentState.format === fmt
                              ? 'bg-[#015557] border-emerald-400 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {fmt === 'image/jpeg' ? 'JPEG' : fmt === 'image/png' ? 'PNG' : 'WebP'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {currentState.format !== 'image/png' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <label className="font-semibold text-slate-300">Compression Quality</label>
                        <span className="font-mono text-emerald-400 font-bold">
                          {Math.round(currentState.quality * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={currentState.quality}
                        onChange={(e) =>
                          pushState({ ...currentState, quality: parseFloat(e.target.value) })
                        }
                        className="w-full accent-[#015557]"
                      />
                    </div>
                  )}

                  <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Final Crop Dimensions:</span>
                      <span className="text-white font-bold">
                        {Math.round(currentState.cropRect.width)} &times; {Math.round(currentState.cropRect.height)} px
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Aspect Ratio:</span>
                      <span className="text-emerald-400 font-bold">
                        {formatRatioLabel(currentState.cropRect.width, currentState.cropRect.height)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimated File Size:</span>
                      <span className="text-emerald-400 font-bold">{formatFileSize(estimatedSize)}</span>
                    </div>
                  </div>

                  {/* Actions in Export Tab */}
                  <div className="space-y-2 pt-2">
                    {onSaveAsNew && (
                      <button
                        type="button"
                        onClick={handleSaveAsNewCopy}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4 text-emerald-400" />
                        <span>Save as New Copy (Preserve Original)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Download Image File</span>
                    </button>

                    {onOverwrite && sourceImage.id && (
                      <button
                        type="button"
                        onClick={handleOverwriteOriginal}
                        className="w-full py-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors text-center"
                      >
                        Overwrite original library asset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Action Footer: Accept & Save, Use Original Image, Cancel */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 space-y-2">
            <button
              type="button"
              onClick={handleAcceptAndSave}
              className="w-full py-2.5 px-4 bg-[#015557] hover:bg-[#014345] text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Check className="w-4 h-4" />
              <span>Accept and Save</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleUseOriginal}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                title="Accept unmodified original image without applying crop or edits"
              >
                <FileImage className="w-3.5 h-3.5 text-slate-400" />
                <span>Use Original</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3 bg-slate-800/80 hover:bg-red-950/40 text-slate-300 hover:text-red-400 text-xs font-semibold rounded-xl border border-slate-700 hover:border-red-800/60 transition-colors flex items-center justify-center gap-1.5"
                title="Discard pending changes and cancel operation"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
