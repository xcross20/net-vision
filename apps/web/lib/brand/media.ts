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
    homepageHero: '/brand/showroom/hero-plaques.jpg',
    categoriesHero: '/brand/showroom/hero-netgear-atmosphere.jpg',
    categoryHero: '/brand/showroom/hero-plaque-single.jpg',
    brandCrate: '/brand/showroom/brand-crate.jpg',
  },
} as const;

export const SHOWROOM_MEDIA = BRAND_MEDIA.showroom;

export function isShowroomPath(src: string): boolean {
  return src.startsWith('/brand/showroom/') || src.startsWith('/brand/references/');
}
