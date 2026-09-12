import { MousePointerClick, Zap, Globe, Shield, Sparkles, HelpCircle } from 'lucide-react';

export interface WhatsNewFeature {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
  navigateTo?: 'library' | 'settings' | 'gamebanana' | 'achievements';
}

export interface WhatsNewRelease {
  version: string;
  date?: string;
  features: WhatsNewFeature[];
}

export const WHATS_NEW: WhatsNewRelease[] = [
  {
    version: '1.0.2',
    date: 'August 2026',
    features: [
      {
        id: 'language_hub',
        titleKey: 'whats_new_language_hub_title',
        descKey: 'whats_new_language_hub_desc',
        icon: Globe,
        navigateTo: 'settings',
      },
      {
        id: 'smart_sorting',
        titleKey: 'whats_new_smart_sort_title',
        descKey: 'whats_new_smart_sort_desc',
        icon: Sparkles,
        navigateTo: 'library',
      },
      {
        id: 'drag_drop',
        titleKey: 'whats_new_drag_drop_title',
        descKey: 'whats_new_drag_drop_desc',
        icon: MousePointerClick,
        navigateTo: 'library',
      },
      {
        id: 'hot_reload',
        titleKey: 'whats_new_hot_reload_title',
        descKey: 'whats_new_hot_reload_desc',
        icon: Zap,
        navigateTo: 'settings',
      },
      {
        id: 'scanner_fix',
        titleKey: 'whats_new_scanner_title',
        descKey: 'whats_new_scanner_desc',
        icon: Shield,
        navigateTo: 'library',
      },
      {
        id: 'feature_guide',
        titleKey: 'whats_new_release_notes_title',
        descKey: 'whats_new_release_notes_desc',
        icon: HelpCircle,
      },
    ],
  },
];
