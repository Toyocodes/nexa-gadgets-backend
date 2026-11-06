const Cart = require("../../models/Cart");
const Product = require("../../models/Product");

const MAX_MERGE_ITEMS = 50;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please login to add product to cart!",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const findCurrentProductIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (findCurrentProductIndex === -1) {
      cart.items.push({ productId, quantity });
    } else {
      cart.items[findCurrentProductIndex].quantity += quantity;
    }

    await cart.save();
    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

const fetchCartItems = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User id is manadatory!",
      });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "image title price salePrice",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found!",
      });
    }

    const validItems = cart.items.filter(
      (productItem) => productItem.productId
    );

    if (validItems.length < cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    const populateCartItems = validItems.map((item) => ({
      productId: item.productId._id,
      image: item.productId.image,
      title: item.productId.title,
      price: item.productId.price,
      salePrice: item.productId.salePrice,
      quantity: item.quantity,
    }));

    res.status(200).json({
      success: true,
      data: {
        ...cart._doc,
        items: populateCartItems,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

const updateCartItemQty = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid data provided!",
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found!",
      });
    }

    const findCurrentProductIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (findCurrentProductIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Cart item not present !",
      });
    }

    cart.items[findCurrentProductIndex].quantity = quantity;
    await cart.save();

    await cart.populate({
      path: "items.productId",
      select: "image title price salePrice",
    });

    const populateCartItems = cart.items.map((item) => ({
      productId: item.productId ? item.productId._id : null,
      image: item.productId ? item.productId.image : null,
      title: item.productId ? item.productId.title : "Product not found",
      price: item.productId ? item.productId.price : null,
      salePrice: item.productId ? item.productId.salePrice : null,
      quantity: item.quantity,
    }));

    res.status(200).json({
      success: true,
      data: {
        ...cart._doc,
        items: populateCartItems,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

const deleteCartItem = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete cart item if not logged in!",
      });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "image title price salePrice",
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found!",
      });
    }

    cart.items = cart.items.filter(
      (item) => item.productId._id.toString() !== productId
    );

    await cart.save();

    await cart.populate({
      path: "items.productId",
      select: "image title price salePrice",
    });

    const populateCartItems = cart.items.map((item) => ({
      productId: item.productId ? item.productId._id : null,
      image: item.productId ? item.productId.image : null,
      title: item.productId ? item.productId.title : "Product not found",
      price: item.productId ? item.productId.price : null,
      salePrice: item.productId ? item.productId.salePrice : null,
      quantity: item.quantity,
    }));

    res.status(200).json({
      success: true,
      data: {
        ...cart._doc,
        items: populateCartItems,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

// Moves a guest's browser cart into their account after they sign in.
// Body: { items: [{ productId, quantity }] }
//
// Quantities add to what's already in the cart and are capped at current stock.
// Lines that are gone or had to be reduced are reported in `adjustments`, so one
// sold-out product doesn't fail the whole merge.
const mergeCart = async (req, res) => {
  try {
    const { userId, items } = req.body;

    if (!Array.isArray(items) || items.length > MAX_MERGE_ITEMS) {
      return res.status(400).json({
        success: false,
        message: `Send up to ${MAX_MERGE_ITEMS} cart items to merge`,
      });
    }

    // Combine duplicates and ignore anything malformed.
    const wanted = new Map();
    for (const item of items) {
      const productId = String(item?.productId);
      const quantity = Number(item?.quantity);
      if (OBJECT_ID_PATTERN.test(productId) && Number.isInteger(quantity) && quantity > 0) {
        wanted.set(productId, (wanted.get(productId) || 0) + quantity);
      }
    }

    const products = await Product.find({ _id: { $in: [...wanted.keys()] } }).select(
      "title totalStock"
    );
    const productById = new Map(products.map((p) => [p._id.toString(), p]));

    const cart = (await Cart.findOne({ userId })) || new Cart({ userId, items: [] });
    const adjustments = [];

    for (const [productId, quantity] of wanted) {
      const product = productById.get(productId);
      if (!product) {
        adjustments.push({ productId, title: null, quantity: 0 });
        continue;
      }

      const line = cart.items.find((item) => item.productId.toString() === productId);
      const current = line ? line.quantity : 0;
      const stock = Math.max(product.totalStock || 0, 0);
      // Never lower a quantity the customer already had in their account cart.
      const merged = Math.max(Math.min(current + quantity, stock), current);

      if (merged > current) {
        if (line) line.quantity = merged;
        else cart.items.push({ productId, quantity: merged });
      }
      if (merged < current + quantity) {
        adjustments.push({ productId, title: product.title, quantity: merged });
      }
    }

    await cart.save();
    await cart.populate({
      path: "items.productId",
      select: "image title price salePrice",
    });

    const validItems = cart.items.filter((item) => item.productId);

    res.status(200).json({
      success: true,
      data: {
        ...cart._doc,
        items: validItems.map((item) => ({
          productId: item.productId._id,
          image: item.productId.image,
          title: item.productId.title,
          price: item.productId.price,
          salePrice: item.productId.salePrice,
          quantity: item.quantity,
        })),
      },
      adjustments,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

module.exports = {
  addToCart,
  mergeCart,
  updateCartItemQty,
  deleteCartItem,
  fetchCartItems,
};
