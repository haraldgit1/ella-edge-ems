"""
Converts hardcoded Tailwind dark-mode classes to dual-mode (light + dark:) variants.
Run from the ella_ems root directory.

Uses a SINGLE-PASS combined regex so replacement text is never re-scanned.
This prevents cascading issues (e.g. text-gray-300 → text-gray-600 → text-gray-500).

Lookbehind (?<![:\w/-]) prevents matching within prefixed variants:
  - hover:X  — preceded by ':'
  - dark:X   — preceded by ':'
  - group-hover:X — 'hover:' is preceded by '-' (now excluded)
  - print:X  — preceded by ':'
"""
import re, glob

# Complete mapping: old_token → new_full_replacement
# Sorted by length descending so longer/more-specific tokens are tried first.
ALL = [
    # ── group-hover: (longer than hover:, so listed first; sort ensures correct order) ──
    ('group-hover:text-gray-100',  'group-hover:text-gray-900 dark:group-hover:text-gray-100'),
    ('group-hover:text-green-400', 'group-hover:text-green-600 dark:group-hover:text-green-400'),
    ('group-hover:text-green-500', 'group-hover:text-green-600 dark:group-hover:text-green-500'),
    ('group-hover:bg-gray-800',    'group-hover:bg-gray-200 dark:group-hover:bg-gray-800'),
    # ── hover: bg opacity variants ────────────────────────────────────────────
    ('hover:bg-gray-900/70',       'hover:bg-gray-100 dark:hover:bg-gray-900/70'),
    ('hover:bg-gray-900/60',       'hover:bg-gray-100 dark:hover:bg-gray-900/60'),
    ('hover:bg-gray-900/30',       'hover:bg-gray-100/60 dark:hover:bg-gray-900/30'),
    ('hover:bg-green-900/60',      'hover:bg-green-100 dark:hover:bg-green-900/60'),
    ('hover:bg-green-900/40',      'hover:bg-green-100 dark:hover:bg-green-900/40'),
    # ── hover: bg ─────────────────────────────────────────────────────────────
    ('hover:bg-gray-800',          'hover:bg-gray-200 dark:hover:bg-gray-800'),
    ('hover:bg-gray-700',          'hover:bg-gray-200 dark:hover:bg-gray-700'),
    # ── hover: text ───────────────────────────────────────────────────────────
    ('hover:text-gray-100',        'hover:text-gray-900 dark:hover:text-gray-100'),
    ('hover:text-gray-200',        'hover:text-gray-800 dark:hover:text-gray-200'),
    ('hover:text-green-400',       'hover:text-green-600 dark:hover:text-green-400'),
    ('hover:text-green-300',       'hover:text-green-700 dark:hover:text-green-300'),
    # ── hover: border ─────────────────────────────────────────────────────────
    ('hover:border-gray-700',      'hover:border-gray-300 dark:hover:border-gray-700'),
    ('hover:border-gray-600',      'hover:border-gray-400 dark:hover:border-gray-600'),
    ('hover:border-gray-500',      'hover:border-gray-400 dark:hover:border-gray-500'),
    ('hover:border-green-800',     'hover:border-green-300 dark:hover:border-green-800'),
    ('hover:border-green-700',     'hover:border-green-300 dark:hover:border-green-700'),
    # ── focus: ────────────────────────────────────────────────────────────────
    ('focus:border-gray-700',      'focus:border-gray-300 dark:focus:border-gray-700'),
    ('focus:border-gray-600',      'focus:border-gray-400 dark:focus:border-gray-600'),
    ('focus:border-green-700',     'focus:border-green-400 dark:focus:border-green-700'),
    # ── divide: ───────────────────────────────────────────────────────────────
    ('divide-gray-800',            'divide-gray-200 dark:divide-gray-800'),
    ('divide-gray-700',            'divide-gray-200 dark:divide-gray-700'),
    # ── placeholder: ──────────────────────────────────────────────────────────
    ('placeholder:text-gray-600',  'placeholder:text-gray-400 dark:placeholder:text-gray-600'),
    ('placeholder:text-gray-500',  'placeholder:text-gray-400 dark:placeholder:text-gray-500'),
    # ── ring: ─────────────────────────────────────────────────────────────────
    ('ring-gray-700', 'ring-gray-300 dark:ring-gray-700'),
    ('ring-gray-600', 'ring-gray-400 dark:ring-gray-600'),
    # ── Base bg opacity variants (longer before shorter to handle /XX suffix) ─
    ('bg-gray-950',       'bg-gray-50 dark:bg-gray-950'),
    ('bg-gray-900/60',    'bg-gray-200/60 dark:bg-gray-900/60'),
    ('bg-gray-900/50',    'bg-gray-200/50 dark:bg-gray-900/50'),
    ('bg-gray-900/40',    'bg-gray-100 dark:bg-gray-900/40'),
    ('bg-gray-900/30',    'bg-gray-100/60 dark:bg-gray-900/30'),
    ('bg-gray-900/20',    'bg-gray-100/40 dark:bg-gray-900/20'),
    ('bg-gray-900/10',    'bg-gray-100/20 dark:bg-gray-900/10'),
    ('bg-gray-900',       'bg-white dark:bg-gray-900'),
    ('bg-gray-800/60',    'bg-gray-200/60 dark:bg-gray-800/60'),
    ('bg-gray-800/50',    'bg-gray-200/50 dark:bg-gray-800/50'),
    ('bg-gray-800/40',    'bg-gray-200/40 dark:bg-gray-800/40'),
    ('bg-gray-800/30',    'bg-gray-200/30 dark:bg-gray-800/30'),
    ('bg-gray-800',       'bg-gray-100 dark:bg-gray-800'),
    ('bg-gray-700',       'bg-gray-200 dark:bg-gray-700'),
    # Accent bg opacity
    ('bg-green-950/30',   'bg-green-50 dark:bg-green-950/30'),
    ('bg-green-900/60',   'bg-green-100 dark:bg-green-900/60'),
    ('bg-green-900/40',   'bg-green-100 dark:bg-green-900/40'),
    ('bg-green-900/30',   'bg-green-50 dark:bg-green-900/30'),
    ('bg-amber-950/20',   'bg-amber-50 dark:bg-amber-950/20'),
    ('bg-amber-900/40',   'bg-amber-50 dark:bg-amber-900/40'),
    ('bg-amber-900/30',   'bg-amber-50 dark:bg-amber-900/30'),
    ('bg-red-900/40',     'bg-red-50 dark:bg-red-900/40'),
    ('bg-red-900/30',     'bg-red-50 dark:bg-red-900/30'),
    ('bg-blue-950/30',    'bg-blue-50 dark:bg-blue-950/30'),
    ('bg-blue-950/20',    'bg-blue-50 dark:bg-blue-950/20'),
    ('bg-blue-900/40',    'bg-blue-50 dark:bg-blue-900/40'),
    ('bg-blue-900/30',    'bg-blue-50 dark:bg-blue-900/30'),
    ('bg-purple-950/20',  'bg-purple-50 dark:bg-purple-950/20'),
    ('bg-purple-900/40',  'bg-purple-50 dark:bg-purple-900/40'),
    ('bg-purple-900/30',  'bg-purple-50 dark:bg-purple-900/30'),
    ('bg-teal-900/40',    'bg-teal-50 dark:bg-teal-900/40'),
    ('bg-teal-900/30',    'bg-teal-50 dark:bg-teal-900/30'),
    ('bg-cyan-900/40',    'bg-cyan-50 dark:bg-cyan-900/40'),
    ('bg-indigo-900/40',  'bg-indigo-50 dark:bg-indigo-900/40'),
    ('bg-yellow-900/40',  'bg-yellow-50 dark:bg-yellow-900/40'),
    # ── Base borders ──────────────────────────────────────────────────────────
    ('border-gray-800',   'border-gray-200 dark:border-gray-800'),
    ('border-gray-700',   'border-gray-300 dark:border-gray-700'),
    ('border-gray-600',   'border-gray-400 dark:border-gray-600'),
    ('border-green-800',  'border-green-200 dark:border-green-800'),
    ('border-green-700',  'border-green-300 dark:border-green-700'),
    ('border-green-600',  'border-green-400 dark:border-green-600'),
    ('border-amber-800',  'border-amber-200 dark:border-amber-800'),
    ('border-amber-700',  'border-amber-300 dark:border-amber-700'),
    ('border-amber-600',  'border-amber-400 dark:border-amber-600'),
    ('border-red-800',    'border-red-200 dark:border-red-800'),
    ('border-red-700',    'border-red-300 dark:border-red-700'),
    ('border-blue-800',   'border-blue-200 dark:border-blue-800'),
    ('border-blue-700',   'border-blue-300 dark:border-blue-700'),
    ('border-blue-600',   'border-blue-400 dark:border-blue-600'),
    ('border-purple-700', 'border-purple-300 dark:border-purple-700'),
    ('border-teal-700',   'border-teal-300 dark:border-teal-700'),
    # ── Base text ─────────────────────────────────────────────────────────────
    ('text-white',        'text-gray-900 dark:text-white'),
    ('text-gray-100',     'text-gray-800 dark:text-gray-100'),
    ('text-gray-200',     'text-gray-700 dark:text-gray-200'),
    ('text-gray-300',     'text-gray-600 dark:text-gray-300'),
    ('text-gray-400',     'text-gray-500 dark:text-gray-400'),
    ('text-gray-600',     'text-gray-500 dark:text-gray-600'),
    ('text-gray-700',     'text-gray-400 dark:text-gray-700'),
    # Accent text
    ('text-green-400',    'text-green-600 dark:text-green-400'),
    ('text-green-300',    'text-green-700 dark:text-green-300'),
    ('text-green-500',    'text-green-600 dark:text-green-500'),
    ('text-amber-400',    'text-amber-600 dark:text-amber-400'),
    ('text-amber-300',    'text-amber-700 dark:text-amber-300'),
    ('text-amber-500',    'text-amber-600 dark:text-amber-500'),
    ('text-red-400',      'text-red-600 dark:text-red-400'),
    ('text-red-300',      'text-red-700 dark:text-red-300'),
    ('text-red-500',      'text-red-600 dark:text-red-500'),
    ('text-blue-400',     'text-blue-600 dark:text-blue-400'),
    ('text-blue-300',     'text-blue-700 dark:text-blue-300'),
    ('text-blue-500',     'text-blue-600 dark:text-blue-500'),
    ('text-purple-400',   'text-purple-600 dark:text-purple-400'),
    ('text-purple-300',   'text-purple-700 dark:text-purple-300'),
    ('text-purple-500',   'text-purple-600 dark:text-purple-500'),
    ('text-teal-400',     'text-teal-600 dark:text-teal-400'),
    ('text-teal-300',     'text-teal-700 dark:text-teal-300'),
    ('text-cyan-400',     'text-cyan-600 dark:text-cyan-400'),
    ('text-cyan-300',     'text-cyan-700 dark:text-cyan-300'),
    ('text-yellow-400',   'text-yellow-600 dark:text-yellow-400'),
]

# Sort by length DESCENDING so longer/more-specific tokens match first in alternation.
ALL.sort(key=lambda x: len(x[0]), reverse=True)

# Build combined regex — one pass, no cascading
# Lookbehind: not preceded by ':', word char, '/', '-' (prevents matching within hover:X, dark:X, group-hover:X)
# Lookahead:  not followed by ':', word char, '/', '-' (prevents matching partial tokens)
combined = re.compile(
    '|'.join(
        r'(?<![:\w/-])' + re.escape(old) + r'(?![:\w/-])'
        for old, _ in ALL
    )
)
mapping = {old: new for old, new in ALL}


def transform(content):
    return combined.sub(lambda m: mapping.get(m.group(0), m.group(0)), content)


files = glob.glob('frontend/src/**/*.tsx', recursive=True)
count = 0
for path in files:
    if 'ThemeContext' in path:
        continue
    with open(path, 'r', encoding='utf-8') as f:
        orig = f.read()
    updated = transform(orig)
    if updated != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(updated)
        count += 1
        print(f'  updated: {path}')
    else:
        print(f'  unchanged: {path}')
print(f'\nDone — {count} files modified.')
