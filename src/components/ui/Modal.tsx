import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  maxHeight?: string;
  className?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  zIndex?: string;
}

const MAX_WIDTH_MAP: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-[95vw]',
};

/**
 * Universal Modal Dialog primitive.
 * Always renders into document.body via createPortal to prevent stacking context
 * and CSS transform/filter clipping bugs from parent cards or containers.
 */
export function Modal({
  isOpen = true,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  maxWidth = '2xl',
  maxHeight = 'max-h-[85vh]',
  className = '',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  zIndex = 'z-[100]',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in`}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel w-full ${MAX_WIDTH_MAP[maxWidth] || 'max-w-2xl'} ${maxHeight} rounded-3xl border border-white/10 shadow-2xl bg-surface/95 backdrop-blur-xl flex flex-col overflow-hidden relative ${className}`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 shrink-0">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
                  {icon}
                </div>
              )}
              <div>
                {typeof title === 'string' ? (
                  <h2 className="text-xl font-bold text-textMain tracking-tight">{title}</h2>
                ) : (
                  title
                )}
                {description && <p className="text-xs text-textMuted mt-0.5">{description}</p>}
              </div>
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-textMuted hover:text-textMain hover:bg-white/10 rounded-xl transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col">{children}</div>

        {footer && (
          <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

/**
 * Headless Modal Portal wrapper for dialogs with custom layout/structure.
 * Mounts directly into document.body with built-in Escape key and backdrop dismissal.
 */
export function ModalPortal({
  isOpen = true,
  onClose,
  children,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  zIndex = 'z-[100]',
  backdropClassName = 'bg-black/75 backdrop-blur-sm',
}: {
  isOpen?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  zIndex?: string;
  backdropClassName?: string;
}) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 ${backdropClassName}`}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>,
    document.body
  );
}
