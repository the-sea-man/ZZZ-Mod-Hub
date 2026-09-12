import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { ChevronRight } from 'lucide-react';

export interface GBCategory {
  id: number;
  name: string;
  iconUrl?: string;
  count: number;
  children: GBCategory[];
}

interface GBCategorySidebarProps {
  categories: GBCategory[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function GBCategorySidebar({ categories, selectedId, onSelect }: GBCategorySidebarProps) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  // Categories start collapsed by default
  const handleExpandAll = () => {
    const allParentIds: number[] = [];
    const collect = (list: GBCategory[]) => {
      list.forEach((c) => {
        if (c.children.length > 0) {
          allParentIds.push(c.id);
          collect(c.children);
        }
      });
    };
    collect(categories);
    setExpandedIds(allParentIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds([]);
  };

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const renderNode = (node: GBCategory, depth: number) => {
    const isSelected = selectedId === node.id;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.includes(node.id);

    return (
      <div key={node.id} className="flex flex-col">
        <button
          onClick={() => {
            onSelect(isSelected ? null : node.id);
            if (hasChildren && !isExpanded) {
              setExpandedIds((prev) => [...prev, node.id]);
            }
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors group ${
            isSelected
              ? 'bg-primary text-white font-bold shadow-md shadow-primary/20'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
          style={{ paddingLeft: `${depth * 1 + 0.75}rem` }}
        >
          {hasChildren ? (
            <div
              onClick={(e) => toggleExpand(node.id, e)}
              className="w-5 h-5 flex items-center justify-center shrink-0 hover:bg-white/10 rounded-md cursor-pointer transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              <ChevronRight size={16} />
            </div>
          ) : (
            <div className="w-5 h-5 shrink-0" /> // Spacer for alignment
          )}

          {node.iconUrl && (
            <img
              src={node.iconUrl}
              alt=""
              className="w-5 h-5 rounded-md object-contain opacity-80 shrink-0"
              loading="lazy"
              decoding="async"
            />
          )}

          <span className="truncate flex-1 text-sm leading-tight">{node.name}</span>

          {node.count > 0 && (
            <span className="text-[10px] opacity-50 bg-black/20 px-1.5 py-0.5 rounded-md shrink-0">
              {node.count}
            </span>
          )}
        </button>

        {hasChildren && isExpanded && (
          <div className="flex flex-col gap-0.5 mt-0.5 animate-in slide-in-from-top-1 fade-in duration-200">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 shrink-0 h-full overflow-y-auto glass-sidebar rounded-2xl border border-white/10 hidden md:flex flex-col p-4 space-y-4 custom-scrollbar">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-black tracking-tight text-white/90 uppercase">
          {t('categories') || 'Categories'}
        </h2>
        <div className="flex items-center gap-2">
          {expandedIds.length > 0 ? (
            <button
              onClick={handleCollapseAll}
              className="text-[10px] text-textMuted hover:text-textMain transition-colors uppercase font-bold"
              title="Collapse all categories"
            >
              {t('collapse_all', 'Collapse')}
            </button>
          ) : (
            <button
              onClick={handleExpandAll}
              className="text-[10px] text-textMuted hover:text-textMain transition-colors uppercase font-bold"
              title="Expand all categories"
            >
              {t('expand_all', 'Expand')}
            </button>
          )}
          {selectedId && (
            <button
              onClick={() => onSelect(null)}
              className="text-[10px] text-primary hover:text-white transition-colors uppercase font-bold"
            >
              {t('clear')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">{categories.map((cat) => renderNode(cat, 0))}</div>
    </div>
  );
}
