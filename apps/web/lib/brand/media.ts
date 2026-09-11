/**
 * Decorative brand media vs canonical NFT media.
 *
 * Brand images may illustrate the product. They must never replace
 * on-chain tokenURI / canonical metadata for a listed asset.
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
} as const;
