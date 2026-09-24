import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { getDates } from './api/families';
import './DatesPage.css';

const TYPE_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'birthdays', label: 'Birthdays' },
  { value: 'anniversaries', label: 'Anniversaries' },
];

const RANGE_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'All year' },
];

const UPCOMING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long' });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// "MM/DD[/YYYY]" -> { month (0-11), day, year | null }
function parseDate(value) {
  const match = value?.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
  if (!match) return null;
  return { month: Number(match[1]) - 1, day: Number(match[2]), year: match[3] ? Number(match[3]) : null };
}

// The date in a given year - Feb 29 falls on Feb 28 in non-leap years.
function inYear(parsed, year) {
  const lastDay = new Date(year, parsed.month + 1, 0).getDate();
  return new Date(year, parsed.month, Math.min(parsed.day, lastDay));
}

function ordinal(n) {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suffix}`;
}

// Admin-only extra detail (the year is never sent to non-admins - see
// GET /api/families/dates), based on the occurrence being listed.
function yearsLabel(entry) {
  if (!entry.parsed.year) return null;
  const years = entry.occurrence.getFullYear() - entry.parsed.year;
  if (years <= 0) return null;
  if (entry.type === 'anniversary') return `${ordinal(years)} anniversary`;
  return `${entry.daysUntil < 0 ? 'turned' : 'turns'} ${years}`;
}

// Filters and orders entries for the chosen range, then groups them under
// month headings. "Upcoming" is ordered by how soon each date comes around
// (so it can run across a month or year boundary); "this month" and "all
// year" list this calendar year's dates in order, including ones already past.
function buildGroups(dates, type, range, today) {
  const entries = [];
  for (const d of dates) {
    if (type === 'birthdays' && d.type !== 'birthday') continue;
    if (type === 'anniversaries' && d.type !== 'anniversary') continue;
    const parsed = parseDate(d.date);
    if (!parsed) continue;

    let occurrence = inYear(parsed, today.getFullYear());
    if (range === 'upcoming' && occurrence < today) occurrence = inYear(parsed, today.getFullYear() + 1);
    const daysUntil = Math.round((occurrence - today) / DAY_MS);

    if (range === 'upcoming' && daysUntil > UPCOMING_DAYS) continue;
    if (range === 'month' && occurrence.getMonth() !== today.getMonth()) continue;
    entries.push({ ...d, parsed, occurrence, daysUntil });
  }

  entries.sort((a, b) => a.occurrence - b.occurrence
    || a.type.localeCompare(b.type)
    || a.name.localeCompare(b.name));

  const groups = [];
  for (const entry of entries) {
    const key = `${entry.occurrence.getFullYear()}-${entry.occurrence.getMonth()}`;
    if (groups.at(-1)?.key !== key) {
      groups.push({ key, label: monthFormat.format(entry.occurrence), entries: [] });
    }
    groups.at(-1).entries.push(entry);
  }
  return groups;
}

function whenLabel(entry) {
  if (entry.daysUntil === 0) return 'Today';
  if (entry.daysUntil === 1) return 'Tomorrow';
  return dayFormat.format(entry.occurrence);
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="dates-segmented" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// /dates - birthdays and anniversaries, filterable by type and time range.
// The filters live in the URL (?type=...&range=..., omitted when default)
// so Back and bookmarks keep them.
export default function DatesPage() {
  const { isAdmin } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = TYPE_OPTIONS.some((o) => o.value === searchParams.get('type')) ? searchParams.get('type') : 'both';
  const range = RANGE_OPTIONS.some((o) => o.value === searchParams.get('range')) ? searchParams.get('range') : 'upcoming';

  const [dates, setDates] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDates().then(setDates).catch((err) => setError(err.message));
  }, []);

  const setParam = (name, defaultValue) => (value) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (value === defaultValue) next.delete(name);
      else next.set(name, value);
      return next;
    }, { replace: true });
  };

  const groups = useMemo(() => {
    if (!dates) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return buildGroups(dates, type, range, today);
  }, [dates, type, range]);

  const emptyWhat = { both: 'birthdays or anniversaries', birthdays: 'birthdays', anniversaries: 'anniversaries' }[type];
  const emptyWhen = { upcoming: `in the next ${UPCOMING_DAYS} days`, month: 'this month', year: 'on file' }[range];

  return (
    <div className="dates-page">
      <h2>Birthdays and Anniversaries</h2>

      <div className="dates-filters">
        <Segmented label="Show" options={TYPE_OPTIONS} value={type} onChange={setParam('type', 'both')} />
        <Segmented label="When" options={RANGE_OPTIONS} value={range} onChange={setParam('range', 'upcoming')} />
      </div>

      {error && <div className="form-error">{error}</div>}
      {!dates && !error && <p className="family-search-status">Loading...</p>}
      {dates && groups.length === 0 && (
        <p className="family-search-status">No {emptyWhat} {emptyWhen}.</p>
      )}

      {groups.map((group) => (
        <section key={group.key} className="dates-month">
          <h3>{group.label}</h3>
          <ul className="dates-list">
            {group.entries.map((entry) => {
              const years = isAdmin ? yearsLabel(entry) : null;
              return (
                <li
                  key={`${entry.type}-${entry.familyId}-${entry.name}`}
                  className={`dates-entry${entry.daysUntil === 0 ? ' today' : ''}${entry.daysUntil < 0 ? ' past' : ''}`}
                >
                  <span className="dates-when">{whenLabel(entry)}</span>
                  <span className={`dates-type dates-type-${entry.type}`}>
                    {entry.type === 'birthday' ? 'Birthday' : 'Anniversary'}
                  </span>
                  <Link to={`/families/${entry.familyId}`} className="dates-name">{entry.name}</Link>
                  {years && <span className="dates-years">{years}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
