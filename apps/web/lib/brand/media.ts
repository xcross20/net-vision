/**
 * Decorative brand media vs canonical NFT media.
 *
 * Brand images may illustrate the product. They must never replace
 * on-chain tokenURI / canonical metadata for a listed asset.
 *
 * `references` are the approved composition mockups (full UI screens).
 * `showroom` is UI-free cinematic photography used as environment plates.
 */
export const BRAND_MEDIA = {
  references: {
    checkoutSidebar: '/brand/references/checkout-sidebar.jpg',
    portfolio: '/brand/references/portfolio.jpg',
    profileListings: '/brand/references/profile-listings.jpg',
    paymentSelect: '/brand/references/payment-select.jpg',
    cart: '/brand/references/cart.jpg',
    activity: '/brand/references/activity.jpg',
    tokenDetail: '/brand/references/token-detail.jpg',
    categoryBrass: '/brand/references/category-brass.jpg',
    categoriesDirectory: '/brand/references/categories.jpg',
    homepage: '/brand/references/homepage.jpg',
  },
  showroom: {
    homepageHero: '/brand/showroom/hero-market.jpg',
    marketHero: '/brand/showroom/hero-market.jpg',
    categoriesHero: '/brand/showroom/hero-netgear-atmosphere.jpg',
    categoryHero: '/brand/showroom/hero-plaque-single.jpg',
    categoryHeroSteel: '/brand/showroom/hero-plaque-steel.jpg',
    categoryHeroAnodisedAluminium: '/brand/showroom/hero-plaque-anodised-aluminium.jpg',
    categoryHeroPrintedPhenolic: '/brand/showroom/hero-plaque-printed-phenolic.jpg',
    brandCrate: '/brand/showroom/brand-crate.jpg',
    cardStage: '/brand/showroom/card-stage.jpg',
    activityHero: '/brand/showroom/hero-plaques.jpg',
    portfolioHero: '/brand/showroom/hero-plaques.jpg',
  },
} as const;

export const SHOWROOM_MEDIA = BRAND_MEDIA.showroom;

/** Official Plate materials, in range order (Brass 1–999 … Phenolic 20000–62093). */
export const PLATE_MATERIAL_SLUGS = [
  'material-brass',
  'material-steel',
  'material-anodised-aluminium',
  'material-printed-phenolic',
] as const;

export type PlateMaterialSlug = (typeof PLATE_MATERIAL_SLUGS)[number];

const PLATE_MATERIAL_SHOWROOM: Record<PlateMaterialSlug, string> = {
  'material-brass': SHOWROOM_MEDIA.categoryHero,
  'material-steel': SHOWROOM_MEDIA.categoryHeroSteel,
  'material-anodised-aluminium': SHOWROOM_MEDIA.categoryHeroAnodisedAluminium,
  'material-printed-phenolic': SHOWROOM_MEDIA.categoryHeroPrintedPhenolic,
};

export function isPlateMaterialSlug(slug: string): slug is PlateMaterialSlug {
  return (PLATE_MATERIAL_SLUGS as readonly string[]).includes(slug);
}

/**
 * Category-detail atmosphere plate. Material slugs get a distinct still.
 * Other families keep the generic brass-stage fallback. Never use this
 * as a listed token's identity image.
 */
export function showroomHeroForCategory(slug: string): string {
  if (isPlateMaterialSlug(slug)) return PLATE_MATERIAL_SHOWROOM[slug];
  return SHOWROOM_MEDIA.categoryHero;
}

export function isShowroomPath(src: string): boolean {
  return src.startsWith('/brand/showroom/') || src.startsWith('/brand/references/');
}
