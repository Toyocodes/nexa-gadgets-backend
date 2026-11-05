const { imageUploadUtil } = require("../../helpers/cloudinary");
const Product = require("../../models/Product");

const handleImageUpload = async (req, res) => {
  try {
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const url = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await imageUploadUtil(url);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "Error occured",
    });
  }
};

// Accepts an array of image URLs; drops empty or non-string entries.
const normalizeImages = (images) =>
  Array.isArray(images)
    ? images.filter((url) => typeof url === "string" && url.trim()).map((url) => url.trim())
    : undefined;

// Accepts [{ label, value }]; drops incomplete rows.
const normalizeSpecs = (specs) =>
  Array.isArray(specs)
    ? specs
        .filter((s) => s && typeof s.label === "string" && typeof s.value === "string")
        .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
        .filter((s) => s.label && s.value)
    : undefined;

//add a new product
const addProduct = async (req, res) => {
  try {
    const {
      image,
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
    } = req.body;

    const images = normalizeImages(req.body.images);
    const specs = normalizeSpecs(req.body.specs);

    // averageReview and numReviews are calculated from reviews, so they are
    // not accepted from the request.
    const newlyCreatedProduct = new Product({
      image,
      ...(images && { images }),
      ...(specs && { specs }),
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
    });

    await newlyCreatedProduct.save();
    res.status(201).json({
      success: true,
      data: newlyCreatedProduct,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};

//fetch all products

const fetchAllProducts = async (req, res) => {
  try {
    const listOfProducts = await Product.find({});
    res.status(200).json({
      success: true,
      data: listOfProducts,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};
;

//edit a product
const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    // IMPORTANT: Now we destructure "image" from req.body so the new image URL is available.
    const {
      image, 
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
    } = req.body;

    const images = normalizeImages(req.body.images);
    const specs = normalizeSpecs(req.body.specs);

    let findProduct = await Product.findById(id);
    if (!findProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // If a file is uploaded (multipart), process it; otherwise, use the JSON image field.
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const url = `data:${req.file.mimetype};base64,${b64}`;
      const result = await imageUploadUtil(url);
      findProduct.image = result.secure_url;
    } else if (images) {
      // A full gallery was sent; it replaces the old one (image = images[0]).
      findProduct.images = images;
      findProduct.image = images[0] || "";
    } else if (image) {
      findProduct.image = image;
      // Keep the gallery's first slot in sync with the primary image.
      findProduct.images = [image, ...(findProduct.images || []).slice(1)];
    }
    // Otherwise, the existing images remain.

    if (specs) {
      findProduct.specs = specs;
    }

    findProduct.title = title || findProduct.title;
    findProduct.description = description || findProduct.description;
    findProduct.category = category || findProduct.category;
    findProduct.brand = brand || findProduct.brand;
    findProduct.price = price === "" ? 0 : price || findProduct.price;
    findProduct.salePrice = salePrice === "" ? 0 : salePrice || findProduct.salePrice;
    findProduct.totalStock =
      totalStock === "" || totalStock === undefined ? findProduct.totalStock : Number(totalStock);

    await findProduct.save();
    res.status(200).json({
      success: true,
      data: findProduct,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occurred",
    });
  }
};


const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product)
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });

    res.status(200).json({
      success: true,
      message: "Product delete successfully",
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};

module.exports = {
  handleImageUpload,
  addProduct,
  fetchAllProducts,
  editProduct,
  deleteProduct,
};
