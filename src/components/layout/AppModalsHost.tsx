import { lazy, Suspense, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

const FeatureGuideModal = lazy(() =>
  import('../Modals/FeatureGuideModal').then((m) => ({ default: m.FeatureGuideModal }))
);
const TroubleshootingModal = lazy(() =>
  import('../Modals/TroubleshootingModal').then((m) => ({
    default: m.TroubleshootingModal,
  }))
);
const NotificationsModal = lazy(() =>
  import('../Modals/NotificationsModal').then((m) => ({
    default: m.NotificationsModal,
  }))
);
const GameBananaModModal = lazy(() =>
  import('../Modals/GameBananaModModal').then((m) => ({
    default: m.GameBananaModModal,
  }))
);
const ImageDownloadPromptModal = lazy(() => import('../Modals/ImageDownloadPromptModal'));

export interface AppModalsHostProps {
  showNotifications: boolean;
  onCloseNotifications: () => void;
  showFeatureGuide: boolean;
  onCloseFeatureGuide: () => void;
  showTroubleshootModal: boolean;
  onCloseTroubleshootModal: () => void;
  showImagePrompt: boolean;
  onCloseImagePrompt: () => void;
  onProceedImagePrompt: () => void;
}

export const AppModalsHost = memo(function AppModalsHost({
  showNotifications,
  onCloseNotifications,
  showFeatureGuide,
  onCloseFeatureGuide,
  showTroubleshootModal,
  onCloseTroubleshootModal,
  showImagePrompt,
  onCloseImagePrompt,
  onProceedImagePrompt,
}: AppModalsHostProps) {
  const activeModPreview = useAppStore((s) => s.activeModPreview);
  const setActiveModPreview = useAppStore((s) => s.setActiveModPreview);

  return (
    <Suspense fallback={null}>
      {activeModPreview && (
        <GameBananaModModal mod={activeModPreview} onClose={() => setActiveModPreview(null)} />
      )}

      <AnimatePresence>
        {showNotifications && <NotificationsModal onClose={onCloseNotifications} />}
      </AnimatePresence>

      <FeatureGuideModal isOpen={showFeatureGuide} onClose={onCloseFeatureGuide} />
      <TroubleshootingModal isOpen={showTroubleshootModal} onClose={onCloseTroubleshootModal} />
      {showImagePrompt && (
        <ImageDownloadPromptModal onClose={onCloseImagePrompt} onProceed={onProceedImagePrompt} />
      )}
    </Suspense>
  );
});
