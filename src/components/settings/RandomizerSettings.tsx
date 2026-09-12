import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Dices, ChevronsRight, ChevronsLeft, User, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

const getImageUrl = (url?: string) => {
  if (!url) return undefined;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('asset://')
  )
    return url;
  if (!url.includes(':') && !url.startsWith('/') && !url.startsWith('\\')) {
    return undefined;
  }
  return convertFileSrc(url);
};

export function RandomizerSettings() {
  const { t } = useTranslation();
  const {
    entitiesDB,
    randomizerWhitelist,
    addToRandomizer,
    removeFromRandomizer,
    addAllToRandomizer,
    removeAllFromRandomizer,
    favoriteRandomizerWeight,
    setFavoriteRandomizerWeight,
    highlightTargetId,
  } = useAppStore();

  const playableCharacters = entitiesDB['playable_characters'] || [];
  const allIds = playableCharacters.map((c: any) => c.id);
  const unselectedCharacters = useMemo(
    () => playableCharacters.filter((c: any) => !randomizerWhitelist.includes(c.id)),
    [playableCharacters, randomizerWhitelist]
  );
  const selectedCharacters = useMemo(
    () => playableCharacters.filter((c: any) => randomizerWhitelist.includes(c.id)),
    [playableCharacters, randomizerWhitelist]
  );

  return (
    <div
      data-highlight-id="randomizer_settings"
      className={`glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl space-y-6 transition-all ${
        highlightTargetId === 'randomizer_settings' ? 'highlight-target' : ''
      }`}
    >
      <div className="flex items-center gap-3 border-b border-textMain/5 pb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
          <Dices size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-textMain">{t('settings_randomizer_rules')}</h2>
          <p className="text-sm text-textMuted">{t('settings_randomizer_desc')}</p>
        </div>
      </div>

      <div className="bg-surface/30 p-4 rounded-xl border border-white/5 space-y-2">
        <label className="text-sm font-bold text-textMain flex justify-between">
          {t('settings_favorite_bias')}
          <span className="text-primary">{favoriteRandomizerWeight}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={favoriteRandomizerWeight}
          onChange={(e) => setFavoriteRandomizerWeight(parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <p
          className="text-xs text-textMuted leading-relaxed"
          dangerouslySetInnerHTML={{ __html: t('settings_favorite_bias_desc1') }}
        />
        <span className="text-primary font-bold mt-1 inline-block text-xs">
          {t('settings_favorite_bias_desc2', { weight: favoriteRandomizerWeight }).replace(
            '{{weight}}',
            favoriteRandomizerWeight.toString()
          )}
        </span>
      </div>

      <div className="flex gap-4 h-[400px]">
        {/* Left Box: Do Not Randomize */}
        <div className="flex-1 flex flex-col bg-background/50 rounded-xl border border-textMain/10 overflow-hidden">
          <div className="p-3 bg-surface border-b border-textMain/10 text-center font-bold text-textMain">
            {t('settings_do_not_randomize')} ({unselectedCharacters.length})
          </div>
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 custom-scrollbar content-start">
            {playableCharacters.length === 0 ? (
              <div className="col-span-3 py-16 flex flex-col items-center justify-center gap-2 text-textMuted">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-xs">{t('loading')}</span>
              </div>
            ) : unselectedCharacters.length === 0 ? (
              <div className="col-span-3 py-16 text-center text-xs text-textMuted/60 italic">
                {t('settings_randomizer_all_selected')}
              </div>
            ) : (
              unselectedCharacters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => addToRandomizer(char.id)}
                  className="flex flex-col items-center p-2 rounded-lg hover:bg-primary/20 hover:border-primary/50 border border-transparent transition-all group"
                >
                  <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center overflow-hidden shadow-inner mb-1">
                    {char.icon_url || char.image_url ? (
                      <img
                        src={getImageUrl(char.icon_url || char.image_url)}
                        alt={char.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <User size={20} className="text-textMuted" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-textMain truncate w-full text-center">
                    {t(`db.${char.id}`, char.name).split(' ')[0]}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center Arrows */}
        <div className="flex flex-col items-center justify-center gap-4">
          <button
            onClick={() => addAllToRandomizer(allIds)}
            disabled={playableCharacters.length === 0 || unselectedCharacters.length === 0}
            className="w-10 h-10 rounded-full bg-surface hover:bg-primary hover:text-white disabled:opacity-30 disabled:pointer-events-none border border-textMain/10 flex items-center justify-center transition-all shadow-md cursor-pointer"
            title={t('settings_move_all_randomize')}
          >
            <ChevronsRight size={20} />
          </button>
          <button
            onClick={() => removeAllFromRandomizer()}
            disabled={playableCharacters.length === 0 || selectedCharacters.length === 0}
            className="w-10 h-10 rounded-full bg-surface hover:bg-primary hover:text-white disabled:opacity-30 disabled:pointer-events-none border border-textMain/10 flex items-center justify-center transition-all shadow-md cursor-pointer"
            title={t('settings_move_all_do_not_randomize')}
          >
            <ChevronsLeft size={20} />
          </button>
        </div>

        {/* Right Box: Randomize */}
        <div className="flex-1 flex flex-col bg-background/50 rounded-xl border border-textMain/10 overflow-hidden">
          <div className="p-3 bg-primary/10 border-b border-primary/20 text-center font-bold text-primary">
            {t('settings_randomize')} ({selectedCharacters.length})
          </div>
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 custom-scrollbar content-start">
            {playableCharacters.length === 0 ? (
              <div className="col-span-3 py-16 flex flex-col items-center justify-center gap-2 text-textMuted">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-xs">{t('loading')}</span>
              </div>
            ) : selectedCharacters.length === 0 ? (
              <div className="col-span-3 py-16 text-center text-xs text-textMuted/60 italic">
                {t('settings_randomizer_none_selected')}
              </div>
            ) : (
              selectedCharacters.map((char: any) => (
                <button
                  key={char.id}
                  onClick={() => removeFromRandomizer(char.id)}
                  className="flex flex-col items-center p-2 rounded-lg bg-primary/10 border border-primary/20 hover:bg-red-500/20 hover:border-red-500/50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center overflow-hidden shadow-inner mb-1">
                    {char.icon_url || char.image_url ? (
                      <img
                        src={getImageUrl(char.icon_url || char.image_url)}
                        alt={char.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <User size={20} className="text-textMuted" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-textMain truncate w-full text-center">
                    {t(`db.${char.id}`, char.name).split(' ')[0]}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
