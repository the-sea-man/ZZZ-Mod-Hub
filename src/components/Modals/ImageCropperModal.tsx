import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Crop, ZoomIn, ZoomOut, RotateCw, Check, Upload, Clipboard } from 'lucide-react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ModInfo } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

interface ImageCropperModalProps {
  mod: ModInfo | null;
  initialImageSrc: string | null;
  onClose: () => void;
  onSaved: () => void;
  /** When true, suppresses the fixed inset-0 overlay so the cropper fills a parent container */
  embedded?: boolean;
}

type AspectRatio = '4:5' | '16:9' | '1:1' | '3:4' | 'free';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

export function ImageCropperModal({
  mod,
  initialImageSrc,
  onClose,
  onSaved,
  embedded = false,
}: ImageCropperModalProps) {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:5');
  const [freeWidth, setFreeWidth] = useState(360);
  const [freeHeight, setFreeHeight] = useState(450);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);
  const [resizeStart, setResizeStart] = useState({
    mouseX: 0,
    mouseY: 0,
    startW: 360,
    startH: 450,
  });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Clipboard paste listener (Ctrl+V)
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
              setImageSrc(event.target.result);
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Sync prop changes
  useEffect(() => {
    if (initialImageSrc) {
      setImageSrc(initialImageSrc);
    }
  }, [initialImageSrc]);

  // Load image when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      drawCanvas();
    };

    if (
      imageSrc.startsWith('data:') ||
      imageSrc.startsWith('http') ||
      imageSrc.startsWith('blob:')
    ) {
      img.src = imageSrc;
    } else {
      img.src = `${convertFileSrc(imageSrc)}?t=${Date.now()}`;
    }
  }, [imageSrc]);

  const getAspectDimensions = useCallback(() => {
    switch (aspectRatio) {
      case '4:5':
        return { width: 360, height: 450 };
      case '1:1':
        return { width: 400, height: 400 };
      case '16:9':
        return { width: 480, height: 270 };
      case '3:4':
        return { width: 330, height: 440 };
      case 'free':
        return { width: freeWidth, height: freeHeight };
      default:
        return { width: 360, height: 450 };
    }
  }, [aspectRatio, freeWidth, freeHeight]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = getAspectDimensions();
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Calculate aspect fit
    const imgAspect = img.width / img.height;
    const canvasAspect = width / height;
    let drawW = width;
    let drawH = height;

    if (imgAspect > canvasAspect) {
      drawH = height;
      drawW = height * imgAspect;
    } else {
      drawW = width;
      drawH = width / imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [getAspectDimensions, pan, rotation, zoom]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleResizeMouseDown = (handle: ResizeHandle, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);
    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: freeWidth,
      startH: freeHeight,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Global mouse move & mouse up listeners for smooth resizing and dragging
  useEffect(() => {
    if (!activeHandle && !isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (activeHandle) {
        const deltaX = e.clientX - resizeStart.mouseX;
        const deltaY = e.clientY - resizeStart.mouseY;
        let newW = resizeStart.startW;
        let newH = resizeStart.startH;

        if (activeHandle === 'se') {
          newW = resizeStart.startW + deltaX;
          newH = resizeStart.startH + deltaY;
        } else if (activeHandle === 'sw') {
          newW = resizeStart.startW - deltaX;
          newH = resizeStart.startH + deltaY;
        } else if (activeHandle === 'ne') {
          newW = resizeStart.startW + deltaX;
          newH = resizeStart.startH - deltaY;
        } else if (activeHandle === 'nw') {
          newW = resizeStart.startW - deltaX;
          newH = resizeStart.startH - deltaY;
        } else if (activeHandle === 'e') {
          newW = resizeStart.startW + deltaX;
        } else if (activeHandle === 'w') {
          newW = resizeStart.startW - deltaX;
        } else if (activeHandle === 's') {
          newH = resizeStart.startH + deltaY;
        } else if (activeHandle === 'n') {
          newH = resizeStart.startH - deltaY;
        }

        setFreeWidth(Math.min(Math.max(160, Math.round(newW)), 560));
        setFreeHeight(Math.min(Math.max(160, Math.round(newH)), 480));
      } else if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setActiveHandle(null);
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [activeHandle, isDragging, resizeStart, dragStart]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setZoom((prev) => Math.min(Math.max(0.4, prev + delta), 4));
  };

  const handlePickNewFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (selected && typeof selected === 'string') {
        setImageSrc(selected);
      }
    } catch (err) {
      console.error('Failed to pick image file:', err);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((type) => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result && typeof event.target.result === 'string') {
                setImageSrc(event.target.result);
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Direct clipboard read failed or not supported, use Ctrl+V:', err);
    }
  };

  const handleSave = async () => {
    if (!mod || !canvasRef.current) return;
    setIsSaving(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png', 0.95);
      await invoke('save_mod_preview_base64', {
        modPath: mod.full_path,
        base64Data: dataUrl,
      });
      useAppStore.getState().incrementStat('imagesCropped');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save cropped preview:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!mod) return null;

  const { width, height } = getAspectDimensions();

  const inner = (
    <div className="bg-surface border border-textMain/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Crop size={22} className="text-primary" />
          <h2 className="text-xl font-bold text-textMain">
            {t('crop_preview_title', 'Edit Preview Image')}
          </h2>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            className="text-textMuted hover:text-textMain text-2xl leading-none"
            aria-label={t('common.cancel', 'Cancel')}
          >
            &times;
          </button>
        )}
      </div>

      <p className="text-xs text-textMuted font-mono truncate">{mod.name}</p>

      {/* Viewport Canvas Container */}
      <div
        className="relative bg-black/70 rounded-2xl overflow-hidden border border-textMain/10 flex items-center justify-center min-h-[480px] cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: `${width}px`, height: `${height}px` }}
            className="rounded-xl shadow-2xl border border-primary/40 pointer-events-none"
          />

          {/* Draggable Corner & Edge Handles in Free Mode */}
          {aspectRatio === 'free' && (
            <>
              {/* Corner Handles */}
              <div
                onMouseDown={(e) => handleResizeMouseDown('nw', e)}
                className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform z-20"
                title="Resize Top-Left"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown('ne', e)}
                className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform z-20"
                title="Resize Top-Right"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown('sw', e)}
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform z-20"
                title="Resize Bottom-Left"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown('se', e)}
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform z-20"
                title="Resize Bottom-Right"
              />

              {/* Edge Handles */}
              <div
                onMouseDown={(e) => handleResizeMouseDown('n', e)}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-white/90 border border-primary rounded-full cursor-ns-resize hover:bg-white shadow z-20"
                title="Resize Height"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown('s', e)}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-white/90 border border-primary rounded-full cursor-ns-resize hover:bg-white shadow z-20"
                title="Resize Height"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown('w', e)}
                className="absolute top-1/2 -left-1.5 -translate-y-1/2 h-8 w-2.5 bg-white/90 border border-primary rounded-full cursor-ew-resize hover:bg-white shadow z-20"
                title="Resize Width"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown('e', e)}
                className="absolute top-1/2 -right-1.5 -translate-y-1/2 h-8 w-2.5 bg-white/90 border border-primary rounded-full cursor-ew-resize hover:bg-white shadow z-20"
                title="Resize Width"
              />

              {/* Dimension Badge */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 border border-white/20 text-[10px] font-mono text-white/90 shadow pointer-events-none z-10">
                {width} × {height}
              </div>
            </>
          )}
        </div>

        <div className="absolute bottom-3 left-3 text-[11px] text-white/50 bg-black/60 px-3 py-1 rounded-lg pointer-events-none">
          {aspectRatio === 'free'
            ? t(
                'drag_to_pan_zoom_free',
                'Drag handles to resize box • Drag to pan • Scroll to zoom • Ctrl+V to paste'
              )
            : t('drag_to_pan_zoom', 'Drag to pan • Scroll to zoom • Ctrl+V to paste')}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Aspect Presets */}
        <div className="flex items-center gap-1.5 bg-background/50 p-1 rounded-xl border border-textMain/5">
          {(['4:5', '16:9', '1:1', '3:4', 'free'] as AspectRatio[]).map((aspect) => (
            <button
              key={aspect}
              onClick={() => {
                if (aspect === 'free' && aspectRatio !== 'free') {
                  const current = getAspectDimensions();
                  setFreeWidth(current.width);
                  setFreeHeight(current.height);
                }
                setAspectRatio(aspect);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                aspectRatio === aspect
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              {aspect === 'free' ? t('aspect_free', 'Free') : aspect}
            </button>
          ))}
        </div>

        {/* Zoom & Rotate Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            className="p-2 rounded-xl bg-background/50 hover:bg-background border border-textMain/10 text-textMuted hover:text-textMain transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <input
            type="range"
            min="0.4"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-24 accent-primary cursor-pointer"
          />
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            className="p-2 rounded-xl bg-background/50 hover:bg-background border border-textMain/10 text-textMuted hover:text-textMain transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl bg-background/50 hover:bg-background border border-textMain/10 text-textMuted hover:text-textMain transition-colors"
            title="Rotate 90°"
          >
            <RotateCw size={16} />
          </button>
        </div>

        {/* Action Buttons: Paste Image & Pick File */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePasteFromClipboard}
            className="px-3 py-2 bg-surface hover:bg-background border border-textMain/10 rounded-xl text-xs font-bold text-textMuted hover:text-textMain transition-colors flex items-center gap-1.5"
            title={t('paste_image_tooltip', 'Paste image from clipboard (Ctrl+V)')}
          >
            <Clipboard size={14} /> {t('paste_image', 'Paste Image')}
          </button>
          <button
            onClick={handlePickNewFile}
            className="px-3 py-2 bg-surface hover:bg-background border border-textMain/10 rounded-xl text-xs font-bold text-textMuted hover:text-textMain transition-colors flex items-center gap-1.5"
          >
            <Upload size={14} /> {t('choose_another_file', 'Choose File')}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-textMain/10">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-surface hover:bg-background border border-textMain/10 rounded-xl text-sm font-bold text-textMuted hover:text-textMain transition-all"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            t('saving', 'Saving...')
          ) : (
            <>
              <Check size={16} /> {t('apply_preview', 'Apply Preview')}
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 overflow-y-auto">{inner}</div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/75 app-blur z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </motion.div>
    </div>,
    document.body
  );
}
