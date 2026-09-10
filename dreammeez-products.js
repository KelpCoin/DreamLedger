// dreammeez-products.js
// Product entries for the DreamMeez avatar cosmetic line and Billboard Tile.
// Data addition only. Checkout and fulfillment remain separate concerns.

const dreamMeezProducts = [
  {
    sku: "DM_COSMETIC_STD",
    name: "Avatar Cosmetic",
    silo: "AVATAR",
    price_nzd: 5000,
    currency: "nzd",
    type: "cosmetic",
    fulfillment: "instant_digital",
    description: "Standard avatar cosmetic item."
  },
  {
    sku: "DM_COSMETIC_IMG",
    name: "Avatar Cosmetic (Custom Image)",
    silo: "AVATAR",
    price_nzd: 10000,
    currency: "nzd",
    type: "cosmetic_custom",
    fulfillment: "instant_digital_with_asset",
    description: "Avatar cosmetic including a custom generated/uploaded image."
  },
  {
    sku: "BILLBOARD_TILE",
    name: "Digital Billboard Tile",
    silo: "AVATAR",
    price_nzd: 5000,
    currency: "nzd",
    type: "billboard_tile",
    fulfillment: "instant_digital",
    description: "A single tile placement on the digital billboard."
  }
];

module.exports = { dreamMeezProducts };
