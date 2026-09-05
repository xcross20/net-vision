/**
 * Unified facet types and official metadata extraction.
 *
 * Derived / curated classification stays in classifyNumber(). This file
 * must not import the classifier — Plate membership is metadata-only.
 */

export const FACET_FAMILIES = [
  'number',
  'material',
  'pattern',
  'culture',
  'game',
  'rarity',
  'equipment',
  'season',
  'character',
] as const;

export type FacetFamily = (typeof FACET_FAMILIES)[number];

export const SHIPPED_FACET_FAMILIES = ['number', 'material', 'pattern', 'culture'] as const;
export type ShippedFacetFamily = (typeof SHIPPED_FACET_FAMILIES)[number];

export const FACET_SOURCES = ['metadata', 'derived', 'curated', 'game'] as const;
export type FacetSource = (typeof FACET_SOURCES)[number];

export type TokenFacet = {
  tokenId: string;
  family: FacetFamily;
  slug: string;
  label: string;
  source: FacetSource;
  sourceVersion: string;
  metadata?: Record<string, unknown>;
};

export type MetadataTrait = {
  trait_type?: string;
  value?: string | number;
};

export type NftMetadataInput = {
  traits?: MetadataTrait[] | null;
  name?: string | null;
};

export const PLATE_TRAIT_TYPE = 'plate';

export const MATERIAL_PLATE_CATALOG = [
  {
    slug: 'material-brass',
    name: 'Brass',
    officialLabel: 'Brass',
    officialCount: 999,
  },
  {
    slug: 'material-steel',
    name: 'Steel',
    officialLabel: 'Steel',
    officialCount: 4000,
  },
  {
    slug: 'material-anodised-aluminium',
    name: 'Anodised Aluminium',
    officialLabel: 'Anodised aluminium',
    officialCount: 15000,
  },
  {
    slug: 'material-printed-phenolic',
    name: 'Printed Phenolic',
    officialLabel: 'Printed phenolic',
    officialCount: 42094,
  },
] as const;

export type MaterialPlateSlug = (typeof MATERIAL_PLATE_CATALOG)[number]['slug'];

export const OFFICIAL_PLATE_SUPPLY = MATERIAL_PLATE_CATALOG.reduce(
  (sum, row) => sum + row.officialCount,
  0,
);

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizePlateValue(value: string): (typeof MATERIAL_PLATE_CATALOG)[number] | null {
  const n = normalizeLabel(value)
    .replace(/anodized/g, 'anodised')
    .replace(/aluminum/g, 'aluminium');
  if (n === 'brass') return MATERIAL_PLATE_CATALOG[0];
  if (n === 'steel') return MATERIAL_PLATE_CATALOG[1];
  if (n === 'anodised aluminium' || n === 'anodised') return MATERIAL_PLATE_CATALOG[2];
  if (n === 'printed phenolic' || n === 'phenolic' || n === 'printed') {
    return MATERIAL_PLATE_CATALOG[3];
  }
  return null;
}

/**
 * Official metadata facets. Plate is the only shipped metadata family.
 * Does not consult token id or classifyNumber.
 */
export function extractMetadataFacets(
  tokenId: string,
  metadata: NftMetadataInput | null | undefined,
): TokenFacet[] {
  const traits = metadata?.traits ?? [];
  const out: TokenFacet[] = [];
  const seen = new Set<string>();
  for (const trait of traits) {
    if (!trait.trait_type || trait.value === undefined || trait.value === null) continue;
    if (normalizeLabel(trait.trait_type) !== PLATE_TRAIT_TYPE) continue;
    const raw = String(trait.value);
    const known = normalizePlateValue(raw);
    const slug = known?.slug ?? 'material-unmapped';
    if (seen.has(slug) && known) continue;
    seen.add(slug);
    out.push({
      tokenId,
      family: 'material',
      slug,
      label: known?.name ?? raw,
      source: 'metadata',
      sourceVersion: 'opensea-plate-v1',
      metadata: {
        traitType: trait.trait_type,
        originalLabel: raw,
        mapped: Boolean(known),
      },
    });
  }
  return out;
}

export function mergeTokenFacets(groups: TokenFacet[][]): TokenFacet[] {
  const seen = new Set<string>();
  const out: TokenFacet[] = [];
  for (const group of groups) {
    for (const facet of group) {
      const key = `${facet.family}:${facet.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(facet);
    }
  }
  return out;
}

export function slugsForFacets(facets: TokenFacet[]): string[] {
  return [...new Set(facets.map((facet) => facet.slug))];
}

/**
 * QA-only hint from the published Plate supply splits. Never used for
 * membership. A live mismatch is an anomaly to record, not to "fix".
 */
export function qaPlateRangeHint(tokenId: string): MaterialPlateSlug | null {
  if (!/^\d+$/.test(tokenId)) return null;
  const n = Number(tokenId);
  if (!Number.isInteger(n) || n < 1) return null;
  if (n <= 999) return 'material-brass';
  if (n <= 4999) return 'material-steel';
  if (n <= 19999) return 'material-anodised-aluminium';
  if (n <= 62093) return 'material-printed-phenolic';
  return null;
}

export function isShippedFacetFamily(family: string): family is ShippedFacetFamily {
  return (SHIPPED_FACET_FAMILIES as readonly string[]).includes(family);
}

export function productFamilyForTraitFamily(family: string): FacetFamily {
  if (family === 'digits' || family === 'number') return 'number';
  if (family === 'cultural' || family === 'culture') return 'culture';
  if (family === 'material') return 'material';
  if (
    family === 'structure' ||
    family === 'sequence' ||
    family === 'math' ||
    family === 'pattern'
  ) {
    return 'pattern';
  }
  if (
    family === 'game' ||
    family === 'rarity' ||
    family === 'equipment' ||
    family === 'season' ||
    family === 'character'
  ) {
    return family;
  }
  return 'pattern';
}
