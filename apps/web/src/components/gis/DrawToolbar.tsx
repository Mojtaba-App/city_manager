'use client';

export type DrawTool =
  | 'select'
  | 'point'
  | 'line'
  | 'polygon'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'coords';

const TOOLS: Array<{ id: DrawTool; label: string; hint: string }> = [
  { id: 'select', label: 'انتخاب', hint: 'انتخاب و ویرایش شکل' },
  { id: 'point', label: 'نقطه', hint: 'کلیک برای نقطه' },
  { id: 'line', label: 'خط', hint: 'کلیک‌های متوالی؛ دابل‌کلیک برای پایان' },
  { id: 'polygon', label: 'چندضلعی', hint: 'کلیک رأس‌ها؛ دابل‌کلیک برای بستن' },
  { id: 'rectangle', label: 'مستطیل', hint: 'دو کلیک: دو گوشه روبه‌رو' },
  { id: 'square', label: 'مربع', hint: 'دو کلیک: مبدأ و گوشه' },
  { id: 'circle', label: 'دایره', hint: 'دو کلیک: مرکز و شعاع' },
  { id: 'coords', label: 'مختصات', hint: 'ورود دستی طول/عرض یا UTM' },
];

function ToolGlyph({ id }: { id: DrawTool | 'trash' | 'save' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'select':
      return (
        <svg {...common}>
          <path d="M5 4l6 16 2.2-6.2L19.5 11z" />
        </svg>
      );
    case 'point':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
        </svg>
      );
    case 'line':
      return (
        <svg {...common}>
          <path d="M5 18L19 6" />
          <circle cx="5" cy="18" r="2" fill="currentColor" stroke="none" />
          <circle cx="19" cy="6" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'polygon':
      return (
        <svg {...common}>
          <path d="M7 5h8l4 6-4 8H7L4 11z" />
        </svg>
      );
    case 'rectangle':
      return (
        <svg {...common}>
          <rect x="4" y="7" width="16" height="10" rx="1" />
        </svg>
      );
    case 'square':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case 'coords':
      return (
        <svg {...common}>
          <path d="M4 8h16M4 16h16M8 4v16M16 4v16" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" />
        </svg>
      );
    case 'save':
      return (
        <svg {...common}>
          <path d="M5 5h11l3 3v11H5z" />
          <path d="M8 5v5h8V5M8 19v-6h8v6" />
        </svg>
      );
    default:
      return null;
  }
}

export function DrawToolbar({
  active,
  onSelect,
  onTrash,
  onSave,
  hint,
  enabled = true,
}: {
  active: DrawTool;
  onSelect: (tool: DrawTool) => void;
  onTrash: () => void;
  onSave: () => void;
  hint?: string;
  enabled?: boolean;
}) {
  if (!enabled) return null;

  return (
    <div className="gis-draw-toolbar" role="toolbar" aria-label="ابزارهای رسم">
      <div className="gis-draw-tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`gis-draw-btn icon ${active === t.id ? 'active' : ''}`}
            title={`${t.label} — ${t.hint}`}
            aria-label={t.label}
            aria-pressed={active === t.id}
            onClick={() => onSelect(t.id)}
          >
            <ToolGlyph id={t.id} />
            <span className="sr-only">{t.label}</span>
          </button>
        ))}
        <span className="gis-draw-sep" aria-hidden />
        <button type="button" className="gis-draw-btn icon danger" title="حذف شکل‌های رسم‌شده" aria-label="پاک‌کردن" onClick={onTrash}>
          <ToolGlyph id="trash" />
        </button>
        <button type="button" className="gis-draw-btn icon primary" title="ذخیره به‌عنوان بافت" aria-label="ذخیره" onClick={onSave}>
          <ToolGlyph id="save" />
        </button>
      </div>
      {hint && <p className="gis-draw-hint">{hint}</p>}
      <div className="gis-draw-legend" aria-hidden>
        <span><i className="idle" />رسم</span>
        <span><i className="active" />انتخاب‌شده</span>
      </div>
    </div>
  );
}

export function toolHint(tool: DrawTool, pendingCorner: boolean): string {
  switch (tool) {
    case 'select':
      return 'شکل را انتخاب کنید تا جابه‌جا یا ویرایش شود';
    case 'point':
      return 'روی نقشه کلیک کنید تا نقطه ثبت شود';
    case 'line':
      return 'نقاط خط را کلیک کنید؛ برای پایان دابل‌کلیک کنید';
    case 'polygon':
      return 'رأس‌های چندضلعی را کلیک کنید؛ برای بستن دابل‌کلیک کنید';
    case 'rectangle':
      return pendingCorner ? 'گوشه روبه‌رو را کلیک کنید' : 'اولین گوشه مستطیل را کلیک کنید';
    case 'square':
      return pendingCorner ? 'گوشه مقابل مربع را کلیک کنید' : 'نقطه شروع مربع را کلیک کنید';
    case 'circle':
      return pendingCorner ? 'نقطه روی محیط دایره را کلیک کنید' : 'مرکز دایره را کلیک کنید';
    case 'coords':
      return 'مختصات را به‌صورت طول/عرض یا UTM وارد کنید';
    default:
      return '';
  }
}
