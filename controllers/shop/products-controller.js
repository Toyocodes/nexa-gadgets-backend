const mongoose = require("mongoose");
const Product = require("../../models/Product");

const MAX_PAGE_SIZE = 100;

// The price a customer actually pays: the sale price when one is set.
const EFFECTIVE_PRICE = {
  $cond: [{ $gt: [{ $ifNull: ["$salePrice", 0] }, 0] }, "$salePrice", "$price"],
};

const SORTS = {
  "price-lowtohigh": { effectivePrice: 1, _id: 1 },
  "price-hightolow": { effectivePrice: -1, _id: 1 },
  "title-atoz": { title: 1, _id: 1 },
  "title-ztoa": { title: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  rating: { averageReview: -1, numReviews: -1, _id: 1 },
};

const toList = (value) =>
  typeof value === "string" && value.length
    ? value.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

const toNumber = (value) => {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * GET /api/shop/products/get
 *
 * Query params (all optional):
 *   category=phones,laptop      comma-separated category ids
 *   brand=apple,samsung         comma-separated brand ids
 *   minPrice=0&maxPrice=20000   on the effective price (sale price if set)
 *   inStock=true                only products with totalStock > 0
 *   onSale=true                 only products with salePrice > 0
 *   sortBy=price-lowtohigh | price-hightolow | title-atoz | title-ztoa | newest | rating
 *   page=1&limit=12             pagination; omit both to get every product
 */
const getFilteredProducts = async (req, res) => {
  try {
    const { sortBy = "price-lowtohigh", inStock, onSale } = req.query;

    const match = {};
    const categories = toList(req.query.category);
    const brands = toList(req.query.brand);
    if (categories.length) match.category = { $in: categories };
    if (brands.length) match.brand = { $in: brands };
    if (inStock === "true") match.totalStock = { $gt: 0 };
    if (onSale === "true") match.salePrice = { $gt: 0 };

    const minPrice = toNumber(req.query.minPrice);
    const maxPrice = toNumber(req.query.maxPrice);
    const priceMatch = {};
    if (minPrice !== undefined) priceMatch.$gte = minPrice;
    if (maxPrice !== undefined) priceMatch.$lte = maxPrice;

    const pipeline = [
      { $match: match },
      { $addFields: { effectivePrice: EFFECTIVE_PRICE } },
    ];
    if (Object.keys(priceMatch).length) {
      pipeline.push({ $match: { effectivePrice: priceMatch } });
    }
    pipeline.push({ $sort: SORTS[sortBy] || SORTS["price-lowtohigh"] });

    const paginate = req.query.page !== undefined || req.query.limit !== undefined;

    if (!paginate) {
      const products = await Product.aggregate(pipeline);
      return res.status(200).json({ success: true, data: products });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), MAX_PAGE_SIZE);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    pipeline.push({
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    });

    const [result] = await Product.aggregate(pipeline);
    const total = result.total[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occured" });
  }
};

const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Product not found!" });
    }

    const product = await Product.findById(id);

    if (!product)
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured",
    });
  }
};

module.exports = { getFilteredProducts, getProductDetails };
