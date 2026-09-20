import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, type AppStore } from '../../store/useAppStore';
import { EyeOff, Eye, Heart, Coins } from 'lucide-react';
import { isNsfwMod } from '../../utils';
import { useTranslation } from '../../hooks/useTranslation';

interface GBModCardProps {
  mod: any;
  /** Tags from the locally installed version of this mod (matched by gb_mod_id) */
  installedTags?: string[];
}

const selectSetActiveModPreview = (s: AppStore) => s.setActiveModPreview;
const selectBlurNsfw = (s: AppStore) => s.blurNsfw;

export const GBModCard = memo(function GBModCard({ mod, installedTags }: GBModCardProps) {
  const { t } = useTranslation();
  const setActiveModPreview = useAppStore(selectSetActiveModPreview);
  const blurNsfw = useAppStore(selectBlurNsfw);
  const [unblurredByUser, setUnblurredByUser] = useState(false);

  // GameBanana v13 preview images can be in:
  // 1. _aPreviewContent.screenshots array (Mod/Multi, ProfilePage)
  // 2. _aPreviewContent.screenshot (Subfeed)
  // 3. _aPreviewMedia._aImages (legacy)
  // 4. localPreview
  const screenshotObj =
    mod?._aPreviewContent?.screenshots?.[0] || mod?._aPreviewContent?.screenshot;
  const previewImage = mod?._aPreviewMedia?._aImages?.[0];

  const onlineImageUrl = screenshotObj
    ? `${screenshotObj._sBaseUrl}/${screenshotObj._sFile800 || screenshotObj._sFile530 || screenshotObj._sFile || screenshotObj._sFile220}`
    : previewImage
      ? `${previewImage._sBaseUrl}/${previewImage._sFile800 || previewImage._sFile530 || previewImage._sFile || previewImage._sFile220}`
      : mod?._sImageUrl || mod?._sThumbnailUrl || null;

  const defaultPlaceholder = 'https://via.placeholder.com/220x220?text=No+Image';
  const initialImg = onlineImageUrl || mod?.localPreview || defaultPlaceholder;
  const [imgSrc, setImgSrc] = useState(initialImg);

  useEffect(() => {
    setImgSrc(onlineImageUrl || mod?.localPreview || defaultPlaceholder);
  }, [onlineImageUrl, mod?.localPreview]);

  if (!mod) return null;

  const isNsfw = isNsfwMod(mod);
  const isBlurred = blurNsfw && isNsfw && !unblurredByUser;
  const visibleTags = installedTags?.slice(0, 4);

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={(e) => {
          if (isBlurred) {
            e.stopPropagation();
            setUnblurredByUser(true);
          } else {
            setActiveModPreview(mod);
          }
        }}
        className="glass-panel border border-white/5 rounded-2xl overflow-hidden cursor-pointer flex flex-col group relative mod-card-containment"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none" />

        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/50">
          <img
            src={imgSrc}
            alt={mod._sName}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (imgSrc !== mod.localPreview && mod.localPreview) {
                setImgSrc(mod.localPreview);
              } else if (imgSrc !== defaultPlaceholder) {
                setImgSrc(defaultPlaceholder);
              }
            }}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isBlurred ? 'blur-2xl scale-125' : ''}`}
          />

          {isBlurred && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
              <EyeOff size={32} className="text-white/50 mb-2" />
              <span className="text-white/70 font-bold text-sm bg-black/50 px-3 py-1 rounded-full border border-white/10">
                NSFW
              </span>
              <span className="text-white/50 text-xs mt-2">{t('click_to_unblur')}</span>
            </div>
          )}

          <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
            {mod._sModelName && mod._sModelName !== 'Mod' && (
              <span className="px-2 py-1 bg-primary/80 backdrop-blur-md rounded-lg text-xs font-bold text-white uppercase tracking-wider">
                {mod._sModelName}
              </span>
            )}
            {mod._sPayType === 'freemium' && (
              <span className="px-2 py-0.5 bg-yellow-500/80 backdrop-blur-md rounded-lg text-xs font-bold text-white uppercase tracking-wider">
                Freemium
              </span>
            )}
          </div>
          <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
            {mod._nViewCount !== undefined && (
              <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-sm">
                <Eye size={12} className="text-white/80" />
                <span>{mod._nViewCount}</span>
              </span>
            )}
            {mod._nLikeCount !== undefined && (
              <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-sm">
                <Heart size={12} className="text-rose-400 fill-rose-400/30" />
                <span>{mod._nLikeCount}</span>
              </span>
            )}
            {mod._aMetadata?._nBounty !== undefined && (
              <span className="px-2 py-1 bg-yellow-500/80 backdrop-blur-md rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-sm">
                <Coins size={12} className="text-white" />
                <span>{mod._aMetadata._nBounty} pts</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-4 relative z-20 flex-1 flex flex-col justify-end">
          <h3 className="font-bold text-lg text-white truncate mb-1 group-hover:text-primary transition-colors">
            {mod._sName}
          </h3>
          <div className="flex items-center gap-2">
            <img
              src={mod._aSubmitter?._sAvatarUrl || 'https://via.placeholder.com/20'}
              alt={mod._aSubmitter?._sName}
              className="w-5 h-5 rounded-full"
            />
            <p className="text-sm text-textMuted truncate">{mod._aSubmitter?._sName}</p>
          </div>
          {mod._recommendedReason && (
            <div className="mt-3 p-2 bg-primary/20 border border-primary/50 rounded-xl">
              <p className="text-xs text-primary-light font-medium italic">
                "{mod._recommendedReason}"
              </p>
            </div>
          )}
          {/* Installed tags — show tags from user's local copy of this mod */}
          {visibleTags && visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/20 text-primary border border-primary/30"
                >
                  #{tag}
                </span>
              ))}
              {installedTags && installedTags.length > 4 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-textMuted border border-white/10">
                  +{installedTags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
});

GBModCard.displayName = 'GBModCard';
