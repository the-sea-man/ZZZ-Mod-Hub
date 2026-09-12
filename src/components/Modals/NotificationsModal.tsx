import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { X, Bell, Calendar, CheckCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../../hooks/useTranslation';

interface NotificationsModalProps {
  onClose: () => void;
}

export function NotificationsModal({ onClose }: NotificationsModalProps) {
  const {
    notifications,
    readNotifications,
    lastReadNotificationTimestamp,
    markNotificationsRead,
    language,
  } = useAppStore();
  const { t } = useTranslation();

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isNotificationRead = (notif: any) => {
    const idStr = String(notif.id || '').trim();
    if (idStr && readNotifications.some((r) => String(r).trim() === idStr)) {
      return true;
    }
    if (notif.date && lastReadNotificationTimestamp > 0) {
      const notifTime = new Date(notif.date).getTime();
      if (!isNaN(notifTime) && notifTime <= lastReadNotificationTimestamp) {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    // Automatically mark notifications as read in store/localStorage upon opening
    markNotificationsRead();
  }, [markNotificationsRead]);

  const handleMarkAllRead = () => {
    markNotificationsRead();
  };

  // Sort all notifications by date descending
  const sortedNotifications = [...(notifications || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const unread = sortedNotifications.filter((n) => !isNotificationRead(n));
  const read = sortedNotifications.filter((n) => isNotificationRead(n));

  // Display all unread + top 5 read (or all if unread is 0)
  const displayNotifications =
    unread.length > 0 ? [...unread, ...read.slice(0, 5)] : sortedNotifications;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-surface/80 glass-panel rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <Bell className="text-primary" size={24} />
            <h2 className="text-2xl font-bold text-textMain tracking-tight">
              {t('notifications', 'Notifications')}
            </h2>
            {unread.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-sm font-bold border border-primary/30">
                {unread.length} {t('new', 'New')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              title={t('mark_all_read', 'Mark all as read')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-textMuted hover:text-textMain hover:bg-white/10 rounded-xl transition-colors"
            >
              <CheckCheck size={16} />
              <span>{t('mark_all_read', 'Mark all as read')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-textMuted hover:text-textMain hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          {displayNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-textMuted">
              <Bell size={48} className="opacity-20 mb-4" />
              <p className="text-lg">{t('no_notifications', 'No notifications yet!')}</p>
            </div>
          ) : (
            displayNotifications.map((notif: any) => {
              const isUnread = !isNotificationRead(notif);
              const displayTitle = notif[`title_${language}`] || notif.title;
              const displayMessage = notif[`message_${language}`] || notif.message;

              return (
                <div
                  key={notif.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isUnread
                      ? 'bg-primary/5 border-primary/30 shadow-[0_0_15px_rgba(var(--color-primary),0.1)]'
                      : 'bg-black/20 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                      {displayTitle}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-textMuted">
                      <Calendar size={14} />
                      {new Date(notif.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="text-textMuted leading-relaxed text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            className="text-primary hover:text-accent underline font-semibold transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          />
                        ),
                        img: ({ node, ...props }) => (
                          <img
                            className="max-w-full rounded-xl my-3 border border-white/10"
                            {...props}
                          />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc pl-5 my-2 space-y-1" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />
                        ),
                        p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                        h1: ({ node, ...props }) => (
                          <h1 className="text-xl font-bold text-textMain mt-4 mb-2" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2 className="text-lg font-bold text-textMain mt-4 mb-2" {...props} />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3 className="text-base font-bold text-textMain mt-3 mb-2" {...props} />
                        ),
                        blockquote: ({ node, ...props }) => (
                          <blockquote
                            className="border-l-4 border-primary/50 pl-4 py-1 my-3 bg-white/5 rounded-r-lg"
                            {...props}
                          />
                        ),
                        code: ({ node, ...props }) => (
                          <code
                            className="bg-black/30 px-1.5 py-0.5 rounded text-primary font-mono text-xs"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {displayMessage}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
