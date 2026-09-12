import { useEffect, useState, useMemo, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useTranslation } from '../hooks/useTranslation';
import {
  GBModCard,
  GBCategorySidebar,
  type GBCategory,
  GBCarousel,
} from '../components/gamebanana';
import { useAppStore } from '../store/useAppStore';
import { isNsfwMod } from '../utils';

import { WifiOff, Shield, ShieldAlert, X, FolderDown, ExternalLink } from 'lucide-react';

export function GameBananaView() {
  const { t } = useTranslation();
  const {
    defaultDiscoverCharacter,
    simpleModeDiscover,
    showApiDebugUrl,
    nsfwFilterEnabled,
    setNsfwFilterEnabled,
    isOnline,
    categories,
    highlightTargetId,
  } = useAppStore();

  const [mods, setMods] = useState<any[]>([]);
  const [topSubs, setTopSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(defaultDiscoverCharacter);
  const [sort, setSort] = useState('default');
  const [trigger, setTrigger] = useState(0); // For triggering search manually
  const [feedMode, setFeedMode] = useState('all');
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const [gbCategoriesList, setGbCategoriesList] = useState<GBCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [debugUrl, setDebugUrl] = useState('');

  const { entitiesDB } = useAppStore();
  const activeRequestIdRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const communityFeed = useMemo(() => {
    const raw = (entitiesDB as any)?.['community_feed'];
    return raw?.['community_feed'] || raw || null;
  }, [entitiesDB]);

  // Build a map of gb_mod_id -> tags[] from all installed mods so GBModCard can show tags
  const gbModTagsMap = useMemo(() => {
    const map = new Map<number, string[]>();
    categories.forEach((cat) => {
      cat.mods.forEach((mod) => {
        if (mod.meta?.gb_mod_id && mod.meta?.tags && mod.meta.tags.length > 0) {
          map.set(mod.meta.gb_mod_id, mod.meta.tags);
        }
      });
    });
    return map;
  }, [categories]);

  // Build a map of installed GameBanana mods with their local metadata and preview
  const downloadedGbModsMap = useMemo(() => {
    const map = new Map<
      number,
      { localPreview?: string; modName: string; categoryName: string; fullPath: string }
    >();
    categories.forEach((cat) => {
      cat.mods.forEach((mod) => {
        if (mod.meta?.gb_mod_id) {
          const gbId = Number(mod.meta.gb_mod_id);
          if (!isNaN(gbId) && gbId > 0) {
            let localPreview: string | undefined = undefined;
            if (mod.preview_url) {
              localPreview =
                mod.preview_url.startsWith('http') || mod.preview_url.startsWith('asset://')
                  ? mod.preview_url
                  : convertFileSrc(mod.preview_url);
            }
            map.set(gbId, {
              localPreview,
              modName: mod.name,
              categoryName: cat.category_name,
              fullPath: mod.full_path,
            });
          }
        }
      });
    });
    return map;
  }, [categories]);

  // Compute global top tags across all installed mods for discovery hints
  const globalTopTags = useMemo(() => {
    const freq = new Map<string, number>();
    categories.forEach((cat) => {
      cat.mods.forEach((mod) => {
        mod.meta?.tags?.forEach((tag) => {
          freq.set(tag, (freq.get(tag) ?? 0) + 1);
        });
      });
    });
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [categories]);

  useEffect(() => {
    fetch('https://gamebanana.com/apiv13/Util/ModCategory/NestedStructure?_idGameRow=19567')
      .then((res) => res.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;

        // Build a lookup map of local character portraits for icon enrichment
        const localCharMap = new Map<string, string>();
        const characters = entitiesDB['playable_characters'] || [];
        characters.forEach((char: any) => {
          if (char.name) localCharMap.set(char.name.toLowerCase().trim(), char.image_url);
          if (char.aliases && Array.isArray(char.aliases)) {
            char.aliases.forEach((alias: string) => {
              localCharMap.set(alias.toLowerCase().trim(), char.image_url);
            });
          }
        });

        // Recursive function to parse GameBanana API nodes
        const parseGBNode = (node: any): GBCategory => {
          const nameLower = (node._sName || '').toLowerCase().trim();

          // Prefer GameBanana's native icons. Only fallback to our local portrait if GameBanana has no icon.
          let iconUrl = node._sIconUrl || localCharMap.get(nameLower) || undefined;

          if (iconUrl && !iconUrl.startsWith('http') && !iconUrl.startsWith('asset://')) {
            try {
              iconUrl = convertFileSrc(iconUrl);
            } catch (e) {
              console.error('Failed to convert icon url', e);
            }
          }

          const children = Array.isArray(node._aChildren) ? node._aChildren.map(parseGBNode) : [];

          return {
            id: node._idRow,
            name: node._sName || 'Unknown Category',
            iconUrl,
            count: node._nItemCount || 0,
            children,
          };
        };

        const finalCategories: GBCategory[] = data.map(parseGBNode);
        setGbCategoriesList(finalCategories);
      })
      .catch(console.error);
  }, [entitiesDB]);

  const fetchMods = async (
    p: number,
    s: string,
    sortMode: string,
    cId: number | null,
    fMode: string
  ) => {
    const reqId = ++activeRequestIdRef.current;
    setLoading(true);
    try {
      const filterNsfw = (arr: any[]) => {
        if (!nsfwFilterEnabled) return arr;
        return arr.filter((mod) => !isNsfwMod(mod));
      };

      if (fMode === 'recommended') {
        const rawFeed = (entitiesDB as any)?.['community_feed'];
        const feed = rawFeed?.['community_feed'] || rawFeed;
        const recommendedList: any[] = feed?.['recommended_mods'] || [];

        interface RecEntry {
          id: number;
          model: string;
          reason: string;
        }

        const entries: RecEntry[] = [];
        recommendedList.forEach((r: any) => {
          let modId: number | null = null;
          let model = r.type || 'Mod';

          if (typeof r.id === 'number') {
            modId = r.id;
          } else if (typeof r.id === 'string') {
            const m = r.id.match(/\/(mods|tools)\/(\d+)/i) || r.id.match(/^(\d+)$/);
            if (m) {
              if (m[1] && m[1].toLowerCase() === 'tools') model = 'Tool';
              modId = parseInt(m[2] || m[1], 10);
            }
          }

          if (!modId && typeof r.url === 'string') {
            const m = r.url.match(/\/(mods|tools)\/(\d+)/i);
            if (m) {
              if (m[1].toLowerCase() === 'tools') model = 'Tool';
              modId = parseInt(m[2], 10);
            }
          }

          if (modId) {
            entries.push({ id: modId, model, reason: r.reason || '' });
          }
        });

        if (entries.length > 0) {
          const modIds = entries.filter((e) => e.model === 'Mod').map((e) => e.id);
          const nonModEntries = entries.filter((e) => e.model !== 'Mod');

          // Fetch standard mods in bulk
          const bulkPromise =
            modIds.length > 0
              ? invoke('fetch_gb_mods_multi', { ids: modIds })
              : Promise.resolve([]);

          // Fetch any individual tools or special models in parallel
          const individualPromises = nonModEntries.map((entry) =>
            invoke('fetch_gb_mod_details', { modId: entry.id, modelName: entry.model })
              .then((res: any) => ({
                ...res,
                _sModelName: entry.model,
              }))
              .catch((err) => {
                console.error(`Failed to fetch ${entry.model} ${entry.id}:`, err);
                return null;
              })
          );

          const [bulkRes, ...indivRes] = await Promise.all([bulkPromise, ...individualPromises]);
          if (reqId !== activeRequestIdRef.current) return;

          const rawList = [...(Array.isArray(bulkRes) ? bulkRes : []), ...indivRes.filter(Boolean)];

          // Preserve exact configuration order and attach recommended reason
          const augmented = entries
            .map((entry) => {
              const found = rawList.find(
                (item: any) =>
                  item._idRow === entry.id &&
                  (item._sModelName || 'Mod').toLowerCase() === entry.model.toLowerCase()
              );
              return found ? { ...found, _recommendedReason: entry.reason } : null;
            })
            .filter(Boolean);

          setMods(filterNsfw(augmented));
        } else {
          if (reqId !== activeRequestIdRef.current) return;
          setMods([]);
        }
        setHasMore(false);
        setDebugUrl('');
        setLoading(false);
        return;
      }

      if (fMode === 'downloaded') {
        const ids = Array.from(downloadedGbModsMap.keys());
        if (ids.length > 0) {
          const response: any = await invoke('fetch_gb_mods_multi', { ids });
          if (reqId !== activeRequestIdRef.current) return;
          let downloadedMods = (Array.isArray(response) ? response : []).map((gbMod: any) => {
            const localInfo = downloadedGbModsMap.get(gbMod._idRow);
            return {
              ...gbMod,
              localPreview: localInfo?.localPreview,
              _sLocalCategoryName: localInfo?.categoryName,
            };
          });

          // In-memory text search filtering
          if (s.trim()) {
            const q = s.trim().toLowerCase();
            downloadedMods = downloadedMods.filter((mod: any) => {
              const name = (mod._sName || '').toLowerCase();
              const desc = (mod._sDescription || '').toLowerCase();
              return name.includes(q) || desc.includes(q);
            });
          }

          // In-memory category filtering
          if (cId !== null) {
            downloadedMods = downloadedMods.filter((mod: any) => {
              return (
                mod._aCategory?._idRow === cId ||
                mod._aRootCategory?._idRow === cId ||
                mod._aSubCategory?._idRow === cId
              );
            });
          }

          // In-memory sorting
          downloadedMods.sort((a: any, b: any) => {
            if (sortMode === 'likes') return (b._nLikeCount || 0) - (a._nLikeCount || 0);
            if (sortMode === 'downloads')
              return (b._nDownloadCount || 0) - (a._nDownloadCount || 0);
            if (sortMode === 'views') return (b._nViewCount || 0) - (a._nViewCount || 0);
            if (sortMode === 'new') return (b._tsDateAdded || 0) - (a._tsDateAdded || 0);
            return (
              (b._tsDateUpdated || b._tsDateAdded || 0) - (a._tsDateUpdated || a._tsDateAdded || 0)
            );
          });

          // Pagination for downloaded mods
          const perPage = 18;
          const startIndex = (p - 1) * perPage;
          const paginated = downloadedMods.slice(startIndex, startIndex + perPage);
          const hasNext = startIndex + perPage < downloadedMods.length;
          setHasMore(hasNext);
          setTotalPages(Math.max(1, Math.ceil(downloadedMods.length / perPage)));

          setMods(
            filterNsfw(
              paginated.length > 0 || p === 1 ? paginated : downloadedMods.slice(0, perPage)
            )
          );
        } else {
          if (reqId !== activeRequestIdRef.current) return;
          setMods([]);
          setHasMore(false);
          setTotalPages(1);
        }
        setDebugUrl('');
        setLoading(false);
        return;
      }

      const response: any = await invoke('fetch_gb_mods', {
        page: p,
        search: s,
        sort: sortMode,
        categoryId: cId,
        feedMode: fMode,
        nsfw: !nsfwFilterEnabled, // If filter is enabled, we DO NOT want nsfw. So nsfw = !nsfwFilterEnabled.
      });

      if (reqId !== activeRequestIdRef.current) return;

      let fetchedMods = [];
      if (response && response._aRecords) {
        fetchedMods = response._aRecords;
        if (response._debugUrl) setDebugUrl(response._debugUrl);
      } else if (response && response._aContent) {
        // Spotlight returns _aContent mixing Requests, Wips, and Mods
        fetchedMods = response._aContent;
        if (response._debugUrl) setDebugUrl(response._debugUrl);
      } else if (Array.isArray(response)) {
        // TopSubs returns an array directly
        fetchedMods = response;
        setDebugUrl(''); // Rust won't inject _debugUrl into arrays
      } else {
        if (response && response._debugUrl) setDebugUrl(response._debugUrl);
      }

      if (fMode === 'spotlight' || fMode === 'top') {
        setHasMore(false);
        setTotalPages(1);
      } else {
        const metadata = response?._aMetadata;
        let hasNext = false;

        if (fetchedMods.length === 0) {
          hasNext = false;
        } else if (metadata && typeof metadata._bIsComplete === 'boolean') {
          hasNext = !metadata._bIsComplete;
        } else {
          hasNext = fetchedMods.length >= 15;
        }

        const totalRecords = metadata?._nRecordCount;
        const perPage = metadata?._nPerpage || 15;
        if (typeof totalRecords === 'number' && totalRecords > 0) {
          const calcTotalPages = Math.max(1, Math.ceil(totalRecords / perPage));
          setTotalPages(calcTotalPages);
          if (p >= calcTotalPages) {
            hasNext = false;
          }
        } else {
          setTotalPages(null);
        }

        setHasMore(hasNext);
      }

      // Render mods immediately so tab switching has zero lag or freeze
      setMods(filterNsfw(fetchedMods));
      setLoading(false);

      // In the background, enrich content ratings if needed without blocking the UI
      if (fMode !== 'all' && fetchedMods.length > 0) {
        const ids = fetchedMods.map((mod: any) => mod._idRow).filter(Boolean);
        if (ids.length > 0) {
          invoke('fetch_gb_mods_multi', { ids })
            .then((multiRes: any) => {
              if (reqId !== activeRequestIdRef.current) return;
              if (Array.isArray(multiRes)) {
                setMods((prevMods) => {
                  const augmented = prevMods.map((mod: any) => {
                    const extra = multiRes.find((r: any) => r._idRow === mod._idRow);
                    return extra
                      ? {
                          ...mod,
                          _bHasContentRatings: extra._bHasContentRatings,
                          _bIsNsfw: extra._bIsNsfw,
                        }
                      : mod;
                  });
                  return filterNsfw(augmented);
                });
              }
            })
            .catch((e) => {
              console.error('Failed to augment mods with fetch_gb_mods_multi', e);
            });
        }
      }
    } catch (e) {
      if (reqId !== activeRequestIdRef.current) return;
      console.error('Failed to fetch GameBanana mods:', e);
      setMods([]);
      setHasMore(false);
      setTotalPages(null);
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const downloadedModsCount = downloadedGbModsMap.size;

  useEffect(() => {
    if (defaultDiscoverCharacter) {
      setSearch(defaultDiscoverCharacter);
      setPage(1);
      setTrigger((prev) => prev + 1);
    }
  }, [defaultDiscoverCharacter]);

  useEffect(() => {
    fetchMods(page, search, sort, selectedCategoryId, feedMode);
  }, [
    page,
    trigger,
    sort,
    selectedCategoryId,
    feedMode,
    nsfwFilterEnabled,
    feedMode === 'downloaded' ? downloadedModsCount : 0,
  ]);

  useEffect(() => {
    if (isOnline) {
      invoke('fetch_gb_mods', {
        page: 1,
        search: '',
        sort: 'default',
        categoryId: null,
        feedMode: 'top',
        nsfw: !nsfwFilterEnabled,
      })
        .then((res: any) => {
          if (Array.isArray(res)) {
            const filterNsfw = (arr: any[]) => {
              if (!nsfwFilterEnabled) return arr;
              return arr.filter((mod) => !isNsfwMod(mod));
            };
            setTopSubs(filterNsfw(res)); // show all top items in carousel
          }
        })
        .catch(console.error);
    }
  }, [isOnline, nsfwFilterEnabled]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setTrigger((t) => t + 1);
  };

  return (
    <div className="w-full h-full flex relative z-20">
      {!simpleModeDiscover && (
        <GBCategorySidebar
          categories={gbCategoriesList}
          selectedId={selectedCategoryId}
          onSelect={(id) => {
            setSelectedCategoryId(id);
            setSearch(''); // Clear text search when navigating by category tree
            setPage(1);
          }}
        />
      )}

      <div
        ref={scrollContainerRef}
        className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar relative"
      >
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-4xl font-black tracking-tight drop-shadow-md shrink-0">
            {t('discover')}
          </h1>
        </div>

        {!isOnline && (
          <div className="p-6 mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-4 shadow-lg">
            <WifiOff size={32} className="shrink-0" />
            <div>
              <h3 className="font-bold text-lg">
                {t('offline_title', 'You are currently offline')}
              </h3>
              <p className="text-sm opacity-80">
                {t(
                  'offline_desc',
                  'Discovering online mods requires an active internet connection. Please check your network connection.'
                )}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-1.5 bg-surface/40 p-1.5 rounded-2xl border border-white/5 shrink-0 flex-wrap">
            {['all', 'top', 'featured', 'spotlight', 'recommended', 'downloaded'].map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setFeedMode(mode);
                  setPage(1);
                  scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                }}
                className={`px-4 xl:px-5 py-2 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5 ${
                  feedMode === mode
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{mode === 'all' ? t('feed_all') : t(`feed_${mode}` as any)}</span>
                {mode === 'downloaded' && downloadedGbModsMap.size > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded-full font-black leading-none ${
                      feedMode === 'downloaded'
                        ? 'bg-black/30 text-white'
                        : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {downloadedGbModsMap.size}
                  </span>
                )}
              </button>
            ))}
          </div>

          <form
            data-highlight-id="gamebanana_search"
            onSubmit={handleSearch}
            className={`flex-1 max-w-xl flex gap-2 rounded-xl transition-all relative ${
              highlightTargetId === 'gamebanana_search' ? 'highlight-target p-1 bg-primary/10' : ''
            }`}
          >
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                placeholder={
                  selectedCategoryId !== null
                    ? t('search_in_category', 'Search in selected category...')
                    : t('search_mods_placeholder')
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={feedMode !== 'all'}
                className="w-full px-4 py-2 bg-surface/50 border border-white/10 rounded-xl focus:outline-none focus:border-primary transition-colors text-white placeholder-white/40 disabled:opacity-50 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                    setTrigger((t) => t + 1);
                  }}
                  className="absolute right-2.5 p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={feedMode !== 'all'}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 shrink-0"
            >
              {t('search')}
            </button>
          </form>

          {!simpleModeDiscover && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-xl p-2 pr-3.5 border border-white/10 select-none">
                <div
                  className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${
                    nsfwFilterEnabled ? 'bg-primary' : 'bg-white/20'
                  }`}
                  onClick={() => setNsfwFilterEnabled(!nsfwFilterEnabled)}
                  title={
                    nsfwFilterEnabled
                      ? t('nsfw_filter_on_desc', 'NSFW Filter is ON (Adult content is hidden)')
                      : t('nsfw_filter_off_desc', 'NSFW Filter is OFF (Adult content is visible)')
                  }
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      nsfwFilterEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span
                  className="text-xs font-bold text-white/80 flex items-center gap-1.5 cursor-pointer"
                  onClick={() => setNsfwFilterEnabled(!nsfwFilterEnabled)}
                >
                  {nsfwFilterEnabled ? (
                    <>
                      <Shield size={14} className="text-primary" />
                      <span>
                        {t('settings_nsfw_filter')}: {t('on', 'On')}
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={14} className="text-amber-400" />
                      <span>
                        {t('settings_nsfw_filter')}: {t('off', 'Off')}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {feedMode === 'all' && (
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                  className="bg-black/40 backdrop-blur-md text-white border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-primary/50"
                >
                  <option className="bg-surface text-textMain" value="default">
                    {t('sort_default')}
                  </option>
                  <option className="bg-surface text-textMain" value="new">
                    {t('sort_newest')}
                  </option>
                  <option className="bg-surface text-textMain" value="updated">
                    {t('sort_updated')}
                  </option>
                  <option className="bg-surface text-textMain" value="likes">
                    {t('sort_likes')}
                  </option>
                  <option className="bg-surface text-textMain" value="downloads">
                    {t('sort_downloads')}
                  </option>
                  <option className="bg-surface text-textMain" value="views">
                    {t('sort_views')}
                  </option>
                </select>
              )}
            </div>
          )}

          {(feedMode === 'all' || feedMode === 'downloaded' || feedMode === 'featured') && (
            <div className="flex gap-2 items-center shrink-0">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 bg-surface-light border border-white/10 rounded-xl hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-xs"
              >
                {t('previous')}
              </button>
              <span className="flex items-center px-3 font-bold text-xs text-white/90 select-none">
                {totalPages && totalPages > 1
                  ? t('page_count_of_total', {
                      page,
                      total: totalPages,
                      defaultValue: `Page ${page} of ${totalPages}`,
                    })
                  : t('page_count', { page })}
                {!hasMore && page > 1 && (
                  <span className="ml-1 text-[10px] text-textMuted/70 font-normal">
                    ({t('page_last', 'Last')})
                  </span>
                )}
              </span>
              <button
                disabled={!hasMore || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 bg-surface-light border border-white/10 rounded-xl hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-xs"
                title={!hasMore ? t('no_more_pages', 'No more pages available') : undefined}
              >
                {t('next')}
              </button>
            </div>
          )}
        </div>

        {showApiDebugUrl && debugUrl && (
          <div className="mb-6 p-4 bg-black/40 border border-yellow-500/30 rounded-xl">
            <h3 className="text-yellow-500 text-xs font-bold uppercase mb-1">
              {t('api_debug_url')}
            </h3>
            <div className="font-mono text-xs text-white/70 break-all select-all">{debugUrl}</div>
          </div>
        )}

        {feedMode === 'all' &&
          search === '' &&
          selectedCategoryId === null &&
          page === 1 &&
          topSubs.length > 0 && <GBCarousel mods={topSubs} />}

        {/* Community Messages Banner on Recommended Tab */}
        {feedMode === 'recommended' &&
          communityFeed?.messages &&
          communityFeed.messages.length > 0 && (
            <div className="w-full flex flex-col gap-3 mb-6">
              {communityFeed.messages.map((msg: any) => (
                <div
                  key={msg.id}
                  className="p-4 bg-surface/60 border border-primary/20 rounded-2xl backdrop-blur-md relative overflow-hidden shadow-lg flex flex-col gap-1"
                >
                  {/* Badge */}
                  {msg.type && msg.type !== 'info' && (
                    <div
                      className={`absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider ${
                        msg.type === 'poll'
                          ? 'bg-accent'
                          : msg.type === 'guide'
                            ? 'bg-emerald-600'
                            : msg.type === 'tip'
                              ? 'bg-amber-600'
                              : 'bg-primary'
                      }`}
                    >
                      {msg.type}
                    </div>
                  )}
                  <h2 className="text-base font-bold text-white pr-16">{msg.title}</h2>
                  <p className="text-white/70 text-sm leading-relaxed">{msg.content}</p>

                  {/* Multi-button support or single-link fallback */}
                  {Array.isArray(msg.buttons) && msg.buttons.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {msg.buttons.map((btn: { label: string; url: string }) => (
                        <button
                          key={btn.url}
                          type="button"
                          onClick={() => invoke('open_url', { url: btn.url })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/25 text-white font-medium rounded-xl transition-all text-xs cursor-pointer shadow-sm active:scale-95"
                        >
                          <span>{btn.label}</span>
                          <ExternalLink size={12} className="opacity-70" />
                        </button>
                      ))}
                    </div>
                  ) : msg.link ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => invoke('open_url', { url: msg.link })}
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 font-bold rounded-xl shadow-md transition-colors text-xs cursor-pointer ${
                          msg.type === 'poll'
                            ? 'bg-accent hover:bg-accent/80 text-white'
                            : 'bg-primary hover:bg-primary/80 text-white'
                        }`}
                      >
                        <span>
                          {msg.buttonText || (msg.type === 'poll' ? 'Vote Now' : 'Open Link')}
                        </span>
                        <ExternalLink size={12} className="opacity-70" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

        {/* Popular tags from your library — shown as discovery hints */}
        {globalTopTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
            <span className="text-[11px] font-bold text-textMuted/60 uppercase tracking-wider mr-1">
              {t('popular_library_tags', 'Popular tags in your library:')}
            </span>
            {globalTopTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary/80 border border-primary/20"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {loading && mods.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
          </div>
        ) : mods.length === 0 && feedMode === 'downloaded' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 max-w-md mx-auto space-y-4 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xl">
              <FolderDown size={32} />
            </div>
            <h3 className="text-xl font-black text-textMain">
              {t('no_downloaded_mods_title', 'No GameBanana Mods Found')}
            </h3>
            <p className="text-sm text-textMuted leading-relaxed">
              {t(
                'no_downloaded_mods_desc',
                'Mods installed directly from GameBanana or containing GameBanana metadata will appear here with live online info and update status.'
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setFeedMode('all');
                setPage(1);
              }}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer text-sm"
            >
              {t('browse_gamebanana_all', 'Browse All Mods')}
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 pb-20 transition-opacity duration-200 ${
              loading ? 'opacity-50 pointer-events-none' : 'opacity-100'
            }`}
          >
            {mods.map((mod) => (
              <GBModCard key={mod._idRow} mod={mod} installedTags={gbModTagsMap.get(mod._idRow)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
