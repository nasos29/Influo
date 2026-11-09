"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import LocationTypeahead from "@/components/LocationTypeahead";
import { CATEGORIES, categoryTranslations } from "@/lib/categories";
import { formatEuro } from "@/lib/formatEuro";
import { DIRECTORY_BUDGET_CAPS } from "@/lib/publicInfluencer";
import { BADGE_FILTER_TYPES, getBadgeFilterLabel, type BadgeType } from "@/lib/badges";
import { SKILLS, skillLabel } from "@/lib/skills";
import type { FilterUiVariant } from "@/lib/siteSettings";

const LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" },
  { code: "sq", el: "Αλβανικά", en: "Albanian" },
  { code: "bg", el: "Βουλγαρικά", en: "Bulgarian" },
  { code: "tr", el: "Τουρκικά", en: "Turkish" },
];

export type DirectoryFilterCopy = {
  searchAria: string;
  locPlace: string;
  results: string;
  clear: string;
  clearAll: string;
  filters: string;
  platAll: string;
  catAll: string;
  fieldGender: string;
  fieldAvailability: string;
  fieldFollowers: string;
  fieldBudget: string;
  fieldEngagement: string;
  fieldLanguage: string;
  fieldSkills: string;
  skillsAll: string;
  fieldRating: string;
  fieldBadges: string;
  fieldAge: string;
  genAll: string;
  genFem: string;
  genMal: string;
  genAi: string;
  follAll: string;
  follNano: string;
  follMicro: string;
  follMacro: string;
  budAll: string;
  budUpTo: string;
  budUnlimited: string;
  engAll: string;
  engMin: string;
  engGood: string;
  engHigh: string;
  langAll: string;
  ratingAll: string;
  ratingMin: string;
  badgeAll: string;
  ageFrom: string;
  ageTo: string;
  availAll: string;
  availYes: string;
  availNo: string;
};

export type ActiveFilterChip = {
  id: string;
  label: string;
  clear: () => void;
};

const SearchIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const LocationIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);
const ChevronDown = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const pillSelect =
  "h-11 w-full appearance-none rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer";
const pillInput =
  "h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08)]";
const fieldLabel = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const chipBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/20";
const sidebarSelect =
  "h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15 cursor-pointer";
const dropdownSelect =
  "h-10 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 hover:bg-white focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/15 cursor-pointer";

function closedMultiLabel(selected: string[], labelFor: (value: string) => string, placeholder: string): string {
  if (!selected.length) return placeholder;
  const first = labelFor(selected[0]) || selected[0];
  if (selected.length === 1) return first;
  return `${first} +${selected.length - 1}`;
}

function MultiFilterDropdown({
  placeholder,
  options,
  selected,
  onChange,
  ariaLabel,
  triggerClassName = pillSelect.replace("appearance-none ", "") + " flex items-center text-left",
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
  triggerClassName?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const labels = new Map(options.map((option) => [option.value, option.label]));

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBox({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 220) });
    };
    place();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(options.map((option) => option.value).filter((value) => next.includes(value)));
  };

  const summary = closedMultiLabel(selected, (value) => labels.get(value) || value, placeholder);
  const panel =
    open && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            role="group"
            aria-label={ariaLabel}
            style={{ top: box.top, left: box.left, width: box.width }}
            className="fixed z-50 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
          >
            {options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-800 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="min-w-0">{option.label}</span>
                </label>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className={triggerClassName}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="ml-2 shrink-0 text-xs text-slate-400" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </>
  );
}

export type DirectoryFiltersProps = {
  variant: FilterUiVariant;
  lang: "el" | "en";
  txt: DirectoryFilterCopy;
  total: number;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchPlaceholder: string;
  onSearchEnter: () => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  platformFilter: string;
  setPlatformFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilterAndUrl: (v: string) => void;
  locationQuery: string;
  setLocationQuery: (v: string) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean | ((prev: boolean) => boolean)) => void;
  extraFilterCount: number;
  activeChips: ActiveFilterChip[];
  clearFilters: () => void;
  budgetMax: string;
  setBudgetMax: (v: string) => void;
  followerRange: string;
  setFollowerRange: (v: string) => void;
  minEngagement: string;
  setMinEngagement: (v: string) => void;
  skillFilter: string[];
  onSkillFilterChange: (next: string[]) => void;
  languageFilter: string[];
  onLanguageFilterChange: (next: string[]) => void;
  genderFilter: string;
  setGenderFilter: (v: string) => void;
  ageMin: string;
  setAgeMin: (v: string) => void;
  ageMax: string;
  setAgeMax: (v: string) => void;
  minRating: string;
  setMinRating: (v: string) => void;
  availabilityFilter: "All" | "available" | "unavailable";
  setAvailabilityFilter: (v: "All" | "available" | "unavailable") => void;
  badgeFilter: BadgeType | "All";
  setBadgeFilter: (v: BadgeType | "All") => void;
};

function ActiveChipsRow({
  chips,
  clearLabel,
  clearAllLabel,
  onClearAll,
}: {
  chips: ActiveFilterChip[];
  clearLabel: string;
  clearAllLabel: string;
  onClearAll: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.clear}
          className={chipBtn}
          aria-label={`${clearLabel}: ${chip.label}`}
        >
          <span className="max-w-[12rem] truncate">{chip.label}</span>
          <span aria-hidden className="text-slate-400">
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-slate-900 hover:underline focus:outline-none focus:ring-2 focus:ring-slate-900/20 rounded"
      >
        {clearAllLabel}
      </button>
    </div>
  );
}

function AdvancedFields({
  props,
  selectClass,
  multiTriggerClass,
  ageShellClass,
}: {
  props: DirectoryFiltersProps;
  selectClass: string;
  multiTriggerClass: string;
  ageShellClass: string;
}) {
  const { lang, txt } = props;
  return (
    <>
      <div>
        <label className={fieldLabel}>{txt.fieldBudget}</label>
        <select value={props.budgetMax} onChange={(e) => props.setBudgetMax(e.target.value)} className={selectClass}>
          <option value="All">{txt.budAll}</option>
          {DIRECTORY_BUDGET_CAPS.map((cap) => (
            <option key={cap} value={String(cap)}>
              {txt.budUpTo} {formatEuro(cap, lang)}
            </option>
          ))}
          <option value="Unlimited">{txt.budUnlimited}</option>
        </select>
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldFollowers}</label>
        <select
          value={props.followerRange}
          onChange={(e) => props.setFollowerRange(e.target.value)}
          className={selectClass}
        >
          <option value="All">{txt.follAll}</option>
          <option value="Nano">{txt.follNano}</option>
          <option value="Micro">{txt.follMicro}</option>
          <option value="Macro">{txt.follMacro}</option>
        </select>
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldEngagement}</label>
        <select
          value={props.minEngagement}
          onChange={(e) => props.setMinEngagement(e.target.value)}
          className={selectClass}
        >
          <option value="All">{txt.engAll}</option>
          <option value="1">
            {txt.engMin} 1%
          </option>
          <option value="3">
            {txt.engMin} 3% ({txt.engGood})
          </option>
          <option value="5">
            {txt.engMin} 5% ({txt.engHigh})
          </option>
        </select>
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldSkills}</label>
        <MultiFilterDropdown
          ariaLabel={txt.fieldSkills}
          placeholder={txt.skillsAll}
          selected={props.skillFilter}
          options={SKILLS.map((key) => ({ value: key, label: skillLabel(key, lang) || key }))}
          onChange={props.onSkillFilterChange}
          triggerClassName={multiTriggerClass}
        />
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldLanguage}</label>
        <MultiFilterDropdown
          ariaLabel={txt.fieldLanguage}
          placeholder={txt.langAll}
          selected={props.languageFilter}
          options={LANGUAGES.map((item) => ({ value: item.code, label: item[lang] }))}
          onChange={props.onLanguageFilterChange}
          triggerClassName={multiTriggerClass}
        />
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldGender}</label>
        <select
          value={props.genderFilter}
          onChange={(e) => props.setGenderFilter(e.target.value)}
          className={selectClass}
        >
          <option value="All">{txt.genAll}</option>
          <option value="Female">{txt.genFem}</option>
          <option value="Male">{txt.genMal}</option>
          <option value="AI">{txt.genAi}</option>
        </select>
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldAge}</label>
        <div className={ageShellClass}>
          <input
            type="number"
            min={18}
            max={99}
            placeholder={txt.ageFrom}
            value={props.ageMin}
            onChange={(e) => props.setAgeMin(e.target.value)}
            className="h-full w-full min-w-0 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            aria-label={txt.ageFrom}
          />
          <span className="shrink-0 text-slate-300" aria-hidden>
            –
          </span>
          <input
            type="number"
            min={18}
            max={99}
            placeholder={txt.ageTo}
            value={props.ageMax}
            onChange={(e) => props.setAgeMax(e.target.value)}
            className="h-full w-full min-w-0 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            aria-label={txt.ageTo}
          />
        </div>
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldRating}</label>
        <select value={props.minRating} onChange={(e) => props.setMinRating(e.target.value)} className={selectClass}>
          <option value="All">{txt.ratingAll}</option>
          <option value="3">
            {txt.ratingMin} 3★
          </option>
          <option value="4">
            {txt.ratingMin} 4★
          </option>
          <option value="4.5">
            {txt.ratingMin} 4.5★
          </option>
        </select>
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldAvailability}</label>
        <select
          value={props.availabilityFilter}
          onChange={(e) =>
            props.setAvailabilityFilter(e.target.value as "All" | "available" | "unavailable")
          }
          className={selectClass}
        >
          <option value="All">{txt.availAll}</option>
          <option value="available">{txt.availYes}</option>
          <option value="unavailable">{txt.availNo}</option>
        </select>
      </div>
      <div>
        <label className={fieldLabel}>{txt.fieldBadges}</label>
        <select
          value={props.badgeFilter}
          onChange={(e) => props.setBadgeFilter(e.target.value as BadgeType | "All")}
          className={selectClass}
        >
          <option value="All">{txt.badgeAll}</option>
          {BADGE_FILTER_TYPES.map((type) => (
            <option key={type} value={type}>
              {getBadgeFilterLabel(type, lang)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function CategorySelect({
  props,
  className,
}: {
  props: DirectoryFiltersProps;
  className: string;
}) {
  const { lang, txt, categoryFilter } = props;
  return (
    <select
      value={(CATEGORIES as readonly string[]).includes(categoryFilter) ? categoryFilter : categoryFilter === "All" ? "All" : categoryFilter}
      onChange={(e) => props.setCategoryFilterAndUrl(e.target.value)}
      className={className}
      aria-label={txt.catAll}
    >
      <option value="All">{txt.catAll}</option>
      {categoryFilter !== "All" && !(CATEGORIES as readonly string[]).includes(categoryFilter) ? (
        <option value={categoryFilter}>
          {categoryFilter.split(",").map((part) => categoryTranslations[part.trim()]?.[lang] || part.trim()).join(", ")}
        </option>
      ) : null}
      {CATEGORIES.map((cat) => (
        <option key={cat} value={cat}>
          {categoryTranslations[cat] ? categoryTranslations[cat][lang] : cat}
        </option>
      ))}
    </select>
  );
}

function SearchField({
  props,
  inputClass,
}: {
  props: DirectoryFiltersProps;
  inputClass: string;
}) {
  return (
    <div className="relative w-full min-w-0">
      <button
        type="button"
        className="absolute inset-y-0 left-0 flex items-center pl-3.5"
        aria-label={props.txt.searchAria}
        onClick={props.onSearchEnter}
      >
        <SearchIcon />
      </button>
      <input
        type="text"
        placeholder={props.searchPlaceholder}
        value={props.searchQuery}
        onChange={(e) => props.setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          props.onSearchEnter();
        }}
        onFocus={props.onSearchFocus}
        onBlur={props.onSearchBlur}
        className={inputClass}
        aria-label={props.txt.searchAria}
      />
    </div>
  );
}

function ChipsVariant(props: DirectoryFiltersProps) {
  const { txt } = props;
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-[200px] sm:flex-1">
          <SearchField props={props} inputClass={pillInput} />
        </div>
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="min-w-0 sm:min-w-[120px] sm:flex-none sm:w-40">
            <select
              value={props.platformFilter}
              onChange={(e) => props.setPlatformFilter(e.target.value)}
              className={pillSelect}
              aria-label={txt.platAll}
            >
              <option value="All">{txt.platAll}</option>
              <option value="Instagram">Instagram</option>
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
            </select>
          </div>
          <div className="min-w-0 sm:min-w-[120px] sm:flex-none sm:w-48">
            <CategorySelect props={props} className={pillSelect} />
          </div>
          <div className="relative min-w-0 sm:min-w-[140px] sm:flex-none sm:w-44">
            <div className="pointer-events-none absolute inset-y-0 z-10 left-0 flex items-center pl-3.5">
              <LocationIcon />
            </div>
            <LocationTypeahead
              lang={props.lang}
              value={props.locationQuery}
              onChange={props.setLocationQuery}
              placeholder={txt.locPlace}
              className={pillInput}
              ariaLabel={txt.locPlace}
            />
          </div>
          <button
            type="button"
            onClick={() => props.setShowAdvanced((v) => !v)}
            aria-expanded={props.showAdvanced}
            className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/20 sm:w-auto sm:justify-start ${
              props.showAdvanced
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <FilterIcon />
            <span>{txt.filters}</span>
            {props.extraFilterCount > 0 ? (
              <span
                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  props.showAdvanced ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                }`}
              >
                {props.extraFilterCount}
              </span>
            ) : null}
            <span className={`transition-transform ${props.showAdvanced ? "rotate-180" : ""}`}>
              <ChevronDown />
            </span>
          </button>
          <span className="col-span-2 ml-auto shrink-0 text-right text-xs font-medium text-slate-400 sm:col-span-1 sm:ml-0 sm:pl-1 sm:text-left">
            {props.total} {txt.results}
          </span>
        </div>
      </div>
      <ActiveChipsRow
        chips={props.activeChips}
        clearLabel={txt.clear}
        clearAllLabel={txt.clearAll}
        onClearAll={props.clearFilters}
      />
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          props.showAdvanced ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0" aria-hidden={!props.showAdvanced} inert={!props.showAdvanced || undefined}>
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
              <AdvancedFields
                props={props}
                selectClass={pillSelect}
                multiTriggerClass="flex h-11 w-full items-center rounded-full border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
                ageShellClass="flex h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 transition-colors hover:border-slate-300 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/20"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarVariant(props: DirectoryFiltersProps) {
  const { txt } = props;
  const [mobileOpen, setMobileOpen] = useState(false);
  const panel: ReactNode = (
    <div className="space-y-4">
      <SearchField
        props={props}
        inputClass="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15"
      />
      <div>
        <label className={fieldLabel}>{txt.platAll}</label>
        <select
          value={props.platformFilter}
          onChange={(e) => props.setPlatformFilter(e.target.value)}
          className={sidebarSelect}
        >
          <option value="All">{txt.platAll}</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="YouTube">YouTube</option>
        </select>
      </div>
      <div>
        <label className={fieldLabel}>{txt.catAll}</label>
        <CategorySelect props={props} className={sidebarSelect} />
      </div>
      <div>
        <label className={fieldLabel}>{txt.locPlace}</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 z-10 left-0 flex items-center pl-3">
            <LocationIcon />
          </div>
          <LocationTypeahead
            lang={props.lang}
            value={props.locationQuery}
            onChange={props.setLocationQuery}
            placeholder={txt.locPlace}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15"
            ariaLabel={txt.locPlace}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4">
        <AdvancedFields
          props={props}
          selectClass={sidebarSelect}
          multiTriggerClass="flex h-10 w-full items-center rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15"
          ageShellClass="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 transition-colors focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/15"
        />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-400">
          {props.total} {txt.results}
        </span>
        <button
          type="button"
          onClick={props.clearFilters}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline"
        >
          {txt.clearAll}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mb-6 lg:mb-0 lg:w-72 lg:shrink-0 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-2 lg:hidden mb-3">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm"
        >
          <FilterIcon />
          <span>{txt.filters}</span>
          {props.extraFilterCount > 0 ? (
            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {props.extraFilterCount}
            </span>
          ) : null}
        </button>
        <span className="shrink-0 text-xs font-medium text-slate-400">
          {props.total} {txt.results}
        </span>
      </div>
      <ActiveChipsRow
        chips={props.activeChips}
        clearLabel={txt.clear}
        clearAllLabel={txt.clearAll}
        onClearAll={props.clearFilters}
      />
      <div className={`mt-3 lg:mt-0 ${mobileOpen ? "block" : "hidden"} lg:block`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{panel}</div>
      </div>
    </div>
  );
}

function DropdownVariant(props: DirectoryFiltersProps) {
  const { txt } = props;
  return (
    <div className="mb-6 space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2">
          <SearchField
            props={props}
            inputClass="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-10 pr-3 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/15"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <select
              value={props.platformFilter}
              onChange={(e) => props.setPlatformFilter(e.target.value)}
              className={dropdownSelect}
              aria-label={txt.platAll}
            >
              <option value="All">{txt.platAll}</option>
              <option value="Instagram">Instagram</option>
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
            </select>
            <CategorySelect props={props} className={dropdownSelect} />
            <div className="relative col-span-2 sm:col-span-1">
              <div className="pointer-events-none absolute inset-y-0 z-10 left-0 flex items-center pl-3">
                <LocationIcon />
              </div>
              <LocationTypeahead
                lang={props.lang}
                value={props.locationQuery}
                onChange={props.setLocationQuery}
                placeholder={txt.locPlace}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-10 pr-3 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/15"
                ariaLabel={txt.locPlace}
              />
            </div>
            <button
              type="button"
              onClick={() => props.setShowAdvanced((v) => !v)}
              aria-expanded={props.showAdvanced}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                props.showAdvanced
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-white"
              }`}
            >
              <FilterIcon />
              <span className="hidden sm:inline">{txt.filters}</span>
              {props.extraFilterCount > 0 ? (
                <span
                  className={`inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    props.showAdvanced ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                  }`}
                >
                  {props.extraFilterCount}
                </span>
              ) : null}
            </button>
            <span className="col-span-2 flex items-center justify-end text-xs font-medium text-slate-400 sm:col-span-1 lg:justify-start">
              {props.total} {txt.results}
            </span>
          </div>
        </div>
        {props.showAdvanced ? (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3 lg:grid-cols-5">
            <AdvancedFields
              props={props}
              selectClass={dropdownSelect}
              multiTriggerClass="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-left text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 hover:bg-white focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/15"
              ageShellClass="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 transition-colors focus-within:border-slate-900 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/15"
            />
          </div>
        ) : null}
      </div>
      <ActiveChipsRow
        chips={props.activeChips}
        clearLabel={txt.clear}
        clearAllLabel={txt.clearAll}
        onClearAll={props.clearFilters}
      />
    </div>
  );
}

export default function DirectoryFilters(props: DirectoryFiltersProps) {
  if (props.variant === "sidebar") return <SidebarVariant {...props} />;
  if (props.variant === "dropdown") return <DropdownVariant {...props} />;
  return <ChipsVariant {...props} />;
}
