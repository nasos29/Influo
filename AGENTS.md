# Agent notes (Influo)

## Homepage sections registry

Homepage body sections are defined **once** in `lib/homepageSections.ts` (`HOMEPAGE_SECTION_REGISTRY`: stable `id`, el/en `title`, `description`, `defaultIndex`, optional flag).

- **Homepage** (`components/HomePage.tsx`) renders sections by merging `site_settings.homepage_section_order` with the registry. Each section wrapper must set `data-homepage-section="<id>"`.
- **Admin** (`/admin/settings` → panel «Σειρά sections αρχικής») lists the same registry (Greek titles), supports drag-and-drop + ↑↓, optional show/hide, reset-to-default, and saves JSON to `homepage_section_order` (bare string[] when nothing is hidden; `{ order, hidden }` otherwise). Save revalidates `/` and `/en`.
- **Merge rules**: unknown saved ids are dropped; new registry ids are inserted at their `defaultIndex`; additive only.
- **Test**: `scripts/homepage-sections.test.mts` asserts every rendered `data-homepage-section` id is in the registry (and every non-optional registry id appears in HomePage). Keep this green when adding/removing/renaming sections.
