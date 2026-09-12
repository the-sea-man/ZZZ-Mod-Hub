import { useState, useMemo } from 'react';
import { Sparkles, Search, CheckCircle2, RotateCcw, FlaskConical, MapPin, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { safeGetJSON, safeSetJSON } from '../../utils/storage';
import {
  CATEGORIES,
  FEATURES,
  type FeatureCategory,
  type StatusFilter,
} from '../../constants/featuresData';

export function FeatureShowcase() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [testedFeatures, setTestedFeatures] = useState<Record<string, boolean>>(() =>
    safeGetJSON<Record<string, boolean>>('zmm_features_tested_status', {})
  );

  const toggleTested = (id: string) => {
    setTestedFeatures((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      safeSetJSON('zmm_features_tested_status', next);
      return next;
    });
  };

  const resetTestingProgress = () => {
    if (
      window.confirm(
        t(
          'features_reset_testing_confirm',
          'Are you sure you want to reset your feature testing progress?'
        )
      )
    ) {
      setTestedFeatures({});
      safeSetJSON('zmm_features_tested_status', {});
    }
  };

  const categories = CATEGORIES;
  const features = FEATURES;

  const testedCount = useMemo(() => {
    return features.filter((f) => !!testedFeatures[f.id]).length;
  }, [features, testedFeatures]);

  const testedPercentage = useMemo(() => {
    return Math.round((testedCount / features.length) * 100);
  }, [testedCount, features.length]);

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return features.filter((feat) => {
      // Category filter
      const matchCat = selectedCategory === 'all' || feat.category === selectedCategory;
      if (!matchCat) return false;

      // Status filter
      const isTested = !!testedFeatures[feat.id];
      if (statusFilter === 'tested' && !isTested) return false;
      if (statusFilter === 'untested' && isTested) return false;

      // Query filter
      if (!q) return true;

      const name = t(feat.nameKey, feat.nameDefault).toLowerCase();
      const desc = t(feat.descKey, feat.descDefault).toLowerCase();
      const loc = t(feat.locationKey, feat.locationDefault).toLowerCase();
      const numMatch = feat.num.includes(q);
      const keywordMatch = feat.keywords.some((k) => k.toLowerCase().includes(q));

      return name.includes(q) || desc.includes(q) || loc.includes(q) || numMatch || keywordMatch;
    });
  }, [features, searchQuery, selectedCategory, statusFilter, testedFeatures, t]);

  return (
    <div className="glass-panel-bg border border-white/5 rounded-2xl p-6 shadow-lg space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-textMain">
                {t('features_catalog_title', 'Features & Capabilities')}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono font-bold">
                {features.length}
              </span>
            </div>
            <p className="text-xs text-textMuted mt-0.5">
              {t(
                'features_catalog_subtitle',
                'Quick overview of all built-in tools, automation, and integrations.'
              )}
            </p>
          </div>
        </div>

        {/* Search & Debug Actions */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('features_search_placeholder', 'Search features...')}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-textMain placeholder:text-textMuted/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-textMuted hover:text-textMain px-1 flex items-center justify-center"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Debug Testing Tracker Panel */}
      <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <FlaskConical size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-textMain">
                {t('features_tested_progress', { tested: testedCount, total: features.length })}
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                ({testedPercentage}%)
              </span>
            </div>
            <div className="w-48 h-1.5 bg-black/50 rounded-full mt-1 overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${testedPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
              statusFilter === 'all'
                ? 'bg-white/15 text-textMain border-white/20 shadow-sm'
                : 'bg-transparent text-textMuted hover:text-textMain border-transparent hover:bg-white/5'
            }`}
          >
            {t('features_filter_all_status', 'All Status')}
          </button>
          <button
            onClick={() => setStatusFilter('tested')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              statusFilter === 'tested'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-transparent text-textMuted hover:text-emerald-400 border-transparent hover:bg-emerald-500/10'
            }`}
          >
            <CheckCircle2 size={12} />
            <span>{t('features_filter_tested_only', 'Tested')}</span>
            <span className="text-[10px] opacity-75 font-mono">({testedCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('untested')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              statusFilter === 'untested'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                : 'bg-transparent text-textMuted hover:text-amber-400 border-transparent hover:bg-amber-500/10'
            }`}
          >
            <FlaskConical size={12} />
            <span>{t('features_filter_untested_only', 'Untested')}</span>
            <span className="text-[10px] opacity-75 font-mono">
              ({features.length - testedCount})
            </span>
          </button>

          {testedCount > 0 && (
            <button
              onClick={resetTestingProgress}
              title={t('features_reset_testing', 'Reset Testing Progress')}
              className="p-1.5 text-textMuted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          const count =
            cat.id === 'all'
              ? features.length
              : features.filter((f) => f.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain border border-white/5'
              }`}
            >
              <span>{t(cat.labelKey, cat.labelDefault)}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-black/40 text-textMuted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Features Grid */}
      {filteredFeatures.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl bg-black/20">
          <Search size={32} className="mx-auto text-textMuted opacity-40 mb-3" />
          <p className="text-sm font-semibold text-textMain">
            {t('features_no_results', 'No features found')}
          </p>
          <p className="text-xs text-textMuted mt-1">
            {t(
              'features_no_results_desc',
              'Try adjusting your search query, status filter, or category filter.'
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFeatures.map((feat) => {
            const Icon = feat.icon;
            const isTested = !!testedFeatures[feat.id];

            return (
              <div
                key={feat.id}
                className={`bg-black/30 hover:bg-black/40 border rounded-xl p-4 transition-all flex flex-col justify-between group ${
                  isTested
                    ? 'border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.03)]'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform flex-shrink-0">
                        <Icon size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-textMuted font-bold opacity-60">
                            #{feat.num}
                          </span>
                          <h4 className="text-sm font-bold text-textMain group-hover:text-primary transition-colors">
                            {t(feat.nameKey, feat.nameDefault)}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* Manual Tested Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTested(feat.id);
                      }}
                      title={t(
                        'features_toggle_tested_tooltip',
                        'Click to toggle testing status for this feature'
                      )}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer select-none border flex-shrink-0 ${
                        isTested
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/30'
                          : 'bg-white/5 text-textMuted/70 border-white/10 hover:bg-white/10 hover:text-textMain'
                      }`}
                    >
                      {isTested ? (
                        <CheckCircle2 size={13} className="text-emerald-400" />
                      ) : (
                        <FlaskConical size={13} className="text-textMuted/70" />
                      )}
                      <span>
                        {isTested
                          ? t('features_tested_status', 'Tested')
                          : t('features_untested_status', 'Untested')}
                      </span>
                    </button>
                  </div>

                  <p className="text-xs text-textMuted leading-relaxed mb-3">
                    {t(feat.descKey, feat.descDefault)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5 text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${feat.badgeColor}`}
                  >
                    {t(feat.categoryKey, feat.categoryDefault)}
                  </span>
                  <span
                    className="text-textMuted text-[10px] font-mono truncate max-w-[180px] inline-flex items-center gap-1"
                    title={t(feat.locationKey, feat.locationDefault)}
                  >
                    <MapPin size={10} className="text-primary shrink-0" />
                    <span className="truncate">{t(feat.locationKey, feat.locationDefault)}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
