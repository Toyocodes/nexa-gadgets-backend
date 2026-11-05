# Nexa Gadgets API — integration guide for the new UI

This guide is for whoever builds the redesigned shopping UI in the frontend repo
(`nexa-gadgets-frontend`). It lists every backend endpoint that changed or was
added, the exact request and response shapes, and where each one is used in the new design.

- **Design to build:** https://claude.ai/artifact/29PJWeeWEZTVnsB8WRHVSb (13 screens: desktop
  Home, Listing, Product, Cart drawer, Checkout, Account/Orders, Sign in, Create account; mobile
  Home, Product, Checkout, Create account; and Admin › Delivery & pickup).
- **Business rules:** there is **no free delivery**. Customers choose **pickup (₦0)** or a **paid
  delivery zone** (Lagos Mainland ₦5,000 and Lagos Island ₦8,000 by default). Admins can change the
  fees at any time, so **never hard-code fees**; always read them from the API (§8). Payment is
  **bank transfer only**, through Paystack. Pickup orders are also paid online before collection.
- **Base URL:** `import.meta.env.VITE_API_URL` (e.g. `http://localhost:5000/api`). Use the existing
  axios instance in `src/lib/axios.js`; it already sends cookies (`withCredentials: true`).
- **Auth:** a JWT in an httpOnly `token` cookie. The frontend never reads or stores the token.
- **Error shape everywhere:** `{ success: false, message: "Human-readable reason" }`. The `message`
  is written for end users and can be shown directly in a toast or an inline field error.

---

## 0. Required change to every thunk: handle 4xx responses

Many endpoints now return `400`, `401`, `403` or `409` instead of `200 { success: false }`. Several
existing thunks (`registerUser`, `loginUser`, `forgotPassword`, `resetPassword`, the products, order
and review thunks) have no `try/catch`. On a 4xx, axios throws, `payload` is `undefined`, and the UI
shows an empty toast.

Use this pattern for every thunk:

```js
export const registerUser = createAsyncThunk(
  "/auth/register",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await axios.post("/auth/register", formData);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data ?? { success: false, message: "Network error" });
    }
  },
);
```

In components, read `data.payload?.message` for both success and failure (or use `.unwrap()` with
`try/catch`).

**Login is the exception:** `POST /auth/login` still returns `200 { success: false, message }` for an
unknown email or a wrong password. It now returns `400` only when the email or password is missing.

**Session errors:** a `401` from any shop endpoint means the session is missing or expired. Send the
user to `/auth/login`. A `403` means they tried to touch another user's data, or a non-admin hit an
admin route.

**Rate limits (`429`):** auth endpoints are rate-limited per IP address.
- Login, register, reset password, change password and sign-in-link verify: 20 requests per 15 minutes.
- Forgot password and "email me a sign-in link": 5 requests per 15 minutes.

A `429` comes back as `{ success: false, message: "Too many attempts…" }`. Show the message and
disable the submit button for a moment.

---

## 1. Auth: sign up and sign in screens

### `POST /auth/register` (changed)

Request:
```json
{ "userName": "tolu_a", "email": "tolu@example.com", "password": "gadgets2026", "marketingOptIn": true }
```

Changes:
- The server validates input. All three fields are required, the email must look like an email, and
  the **password must be at least 8 characters**. These return `400` with a message.
- Taken username → `200 { success: false, message: "That username is taken. Please choose another" }`.
  Taken email → `200 { success: false, message: "User Already exists with the same email! ..." }`.
- **New accounts are signed in immediately.** The response sets the cookie and includes the user:
  ```json
  { "success": true, "message": "Registration successful",
    "user": { "id": "…", "email": "tolu@example.com", "role": "user", "userName": "tolu_a" } }
  ```
- `marketingOptIn` (optional boolean) saves the "Email me about new arrivals and deals" checkbox.

In the new UI (**Create account**, desktop and mobile):
- In the reducer, treat `registerUser.fulfilled` with `success: true` like `loginUser.fulfilled`:
  set `isAuthenticated = true` and `user = payload.user`. Then navigate to `/shop/account`, or back
  to the page the user came from. Don't send them to the login page.
- The password meter in the design is client-side. Only "8+ characters" is enforced by the server.
  "A number" and "A symbol" are guidance for the meter only.
- Show the server `message` under the related field (email/username), as the design shows for the
  email error, not only as a toast.

### `POST /auth/login` (response unchanged)

Response on success: `{ success: true, message, user: { id, email, role, userName } }`, and the
cookie is set. Wrong credentials are still `200 { success: false, message }`.

### `PUT /auth/reset-password/:token` (changed)

The new password must be at least 8 characters, otherwise `400`. Show the same rule on the reset
form.

### Email sign-in link (new): "Email me a sign-in link" button on Sign in

**`POST /auth/magic-link`**
```json
{ "email": "tolu@example.com" }
```
→ always `200 { success: true, message: "If an account exists for that email, a sign-in link is on its way" }`
(the same response whether or not the account exists, by design). A malformed email → `400`.

The email links to **`${CLIENT_URL}/auth/magic-link/:token`**. The link expires after 10 minutes and
works once.

**`POST /auth/magic-link/verify`**
```json
{ "token": "<token from the URL>" }
```
→ `200 { success: true, message: "Logged in successfully", user: { id, email, role, userName } }`
and the cookie is set, or `400 { message: "This sign-in link is invalid or has expired" }`.

Frontend work:
1. Sign in screen: the button takes the email from the email field, calls `POST /auth/magic-link`,
   then shows the message ("Check your inbox…") in place of the form.
2. Add the route `/auth/magic-link/:token` under the `/auth` layout. It calls verify on mount, then
   behaves like a successful login (set auth state and redirect; admins go to `/admin/dashboard`).
   On failure, show the message with a link back to Sign in.
3. **Add `"/magic-link"` to the unauthenticated allowlist in `src/components/common/check-auth.jsx`**
   (next to `/login`, `/register`, `/forgot-password` and `/reset-password`). Otherwise logged-out
   users are redirected to the login page before the token can be verified.

---

## 2. Account details (new): "Account details" item in the Account sidebar

All three require login.

**`GET /auth/me`** → current profile from the database:
```json
{ "success": true, "data": { "_id": "…", "userName": "tolu_a", "email": "tolu@example.com",
  "role": "user", "marketingOptIn": true, "createdAt": "…" } }
```

**`PUT /auth/me`**: send only the fields being changed.
```json
{ "userName": "tolu_new", "email": "new@example.com", "currentPassword": "required only when email changes", "marketingOptIn": false }
```
- Changing `email` **requires `currentPassword`**, otherwise `401 "Current password is incorrect"`.
- Taken username or email → `409`. Empty username or invalid email → `400`.
- Success → `200 { success: true, message: "Account updated", user: { id, email, role, userName, marketingOptIn } }`.
  The server also sets a fresh cookie, because username and email are stored in the token.
  **Update `auth.user` in Redux from `payload.user`** so the header greeting changes immediately.

**`PUT /auth/change-password`**
```json
{ "currentPassword": "old", "newPassword": "at-least-8-chars" }
```
→ `200 { success: true, message: "Password changed" }`, `401` for a wrong current password, or
`400` if the new password is too short. The session stays valid.

UI: an "Account details" panel in the Account page, with a Profile form (username, email, and a
current-password field that appears only when the email is edited, plus the marketing toggle) and a
separate Change password form.

---

## 3. Product listing and home rails: `GET /shop/products/get` (changed)

All query parameters are optional:

| Param | Example | Meaning |
|---|---|---|
| `category` | `phones,laptop` | comma-separated category ids (from `src/config`) |
| `brand` | `apple,techno` | comma-separated brand ids (**note: the Tecno id is `techno`**) |
| `minPrice` / `maxPrice` | `0` / `20000` | filter on the **effective price** (`salePrice` if > 0, else `price`) |
| `inStock` | `true` | only `totalStock > 0` |
| `onSale` | `true` | only `salePrice > 0` |
| `sortBy` | see below | default `price-lowtohigh` |
| `page`, `limit` | `1`, `12` | pagination (`limit` capped at 100) |

`sortBy` values: `price-lowtohigh`, `price-hightolow` (both on effective price), `title-atoz`,
`title-ztoa`, **`newest`**, **`rating`** (highest `averageReview`, then most reviews).

**Response without `page`/`limit`** is the same as before (every product), so existing code keeps
working:
```json
{ "success": true, "data": [ /* products */ ] }
```

**Response with `page` or `limit`:**
```json
{ "success": true, "data": [ /* up to `limit` products */ ],
  "pagination": { "page": 1, "limit": 12, "total": 14, "totalPages": 2, "hasMore": true } }
```

Listing products now also include a computed `effectivePrice` field.

In the new UI:
- **Listing page:** request `page=1&limit=12`. "Load more" requests `page + 1` and **appends** to the
  list. "Showing X of Y" uses the number loaded and `pagination.total`. Hide "Load more" when
  `hasMore` is false. Store `pagination` in the products slice.
- **Sort dropdown:** Featured → `newest`, "Price: low to high" → `price-lowtohigh`,
  "Price: high to low" → `price-hightolow`, Newest → `newest`, "Top rated" → `rating`.
- **Filters sidebar:** the "In stock only" toggle sets `inStock=true`, the "On sale" toggle sets
  `onSale=true`, and the Min/Max inputs set `minPrice`/`maxPrice`. The quick chips map to
  "Under ₦20k" = `maxPrice=20000`, "₦20k–₦100k" = `minPrice=20000&maxPrice=100000`, and
  "₦100k+" = `minPrice=100000`.
- **Active filter chips** above the grid each remove one parameter. Reset to page 1 whenever any
  filter changes.
- **Home "Trending now":** `sortBy=rating&page=1&limit=4`.
- `GET /shop/products/get/:id` with an invalid id now returns `404` (it used to return `500`). Show
  the not-found state.

---

## 4. Product fields used by cards, product page and gallery (changed model)

Every product now has:

```json
{
  "_id": "…",
  "image": "https://res.cloudinary.com/…/main.jpg",
  "images": ["https://…/main.jpg", "https://…/side.jpg", "https://…/back.jpg"],
  "title": "Apple iPhone 13 Pro Max",
  "description": "…",
  "category": "phones",
  "brand": "apple",
  "price": 900,
  "salePrice": 0,
  "totalStock": 19,
  "specs": [ { "label": "Display", "value": "6.7″" }, { "label": "RAM", "value": "6GB" } ],
  "averageReview": 2,
  "numReviews": 1
}
```

- `image` is always `images[0]` (kept for older code). Use `images` for the gallery and fall back to
  `[image]` if it's empty.
- `numReviews` is new, and `averageReview` is now kept up to date automatically.

Product card rules from the design:
- **Stars:** show `★ {averageReview.toFixed(1)}` **only when `numReviews > 0`**. Never show "0.0".
- **Sale badge:** when `salePrice > 0`, show `−{Math.round((price - salePrice) / price * 100)}%`.
  The price line is `₦salePrice` with a struck-through `₦price`.
- **Stock:** `totalStock === 0` → "Out of stock" (disable the "+" button). `totalStock < 10` → amber
  "Only N left" under the price.
- Prices: `₦` + `toLocaleString()`, set in Geist Mono.

Product page:
- **Spec chips** under the price: the first 4 `specs` entries, showing `value` and the label when it
  adds meaning (e.g. "6GB RAM").
- **Specifications table:** every `specs` row. If `specs` is empty, show `description` instead.
- **Stock line:** one line only, "In stock · {totalStock} available" (green) or "Out of stock".
- Review summary: `averageReview` and `numReviews`. Work out the 1–5 star breakdown from
  `GET /shop/review/:productId`.

---

## 5. Admin product form (changed request)

`POST /admin/products/add` and `PUT /admin/products/edit/:id` now accept:
- `images: string[]`: the gallery in display order. On edit, sending `images` **replaces** the whole
  gallery. Sending only the old `image` field replaces the first photo and keeps the rest.
- `specs: { label: string, value: string }[]`: rows with an empty label or value are dropped. On
  edit, sending `specs` replaces the whole list.
- `averageReview` is **no longer accepted** (it's calculated from reviews). Remove it from the admin
  form.
- `totalStock: 0` now saves correctly. It used to be ignored.

Upload each gallery photo with the existing `POST /admin/products/upload-image` (multipart field
`my_file`), one request per file, and collect each `result.secure_url` into `images`. Add a
repeatable "Label / Value" row editor for specs.

---

## 6. Reviews (changed rules)

`POST /shop/review/add` (login required):
```json
{ "productId": "…", "reviewValue": 4, "reviewMessage": "Solid battery life" }
```
- The author's name comes from their account, so don't send `userName`. A `userId` in the body is
  ignored; the server uses the logged-in user.
- `reviewValue` must be a whole number from 1 to 5, otherwise `400 "Choose a rating from 1 to 5 stars"`.
- The user must have a **paid** order containing the product, otherwise
  `403 "You need to purchase product to review it."`. Unpaid (pending) orders no longer count.
- A second review of the same product → `400 "You already reviewed this product!"`.
- Success → `201 { success: true, data: review }`. **Refetch the product afterwards** to get the new
  `averageReview` and `numReviews`.

`GET /shop/review/:productId` now returns reviews **newest first**.

In the new UI, the "Write a review" button on **delivered** orders in Account opens the product's
review form. On the product page, keep the note "Only customers who bought this item can review it".

---

## 7. Addresses and checkout delivery step (changed validation)

`POST /shop/address/add` (login required):
```json
{ "address": "12 Allen Avenue", "city": "Lagos", "phone": "+2348012345678", "pincode": "", "notes": "" }
```
- **Required:** `address`, `city`, `phone`. **`pincode` and `notes` are optional** (they were
  required before).
- Missing fields → `400 "Please fill in: phone"`. The message names the missing fields, so show it
  inline.

`PUT /shop/address/update/:userId/:addressId` accepts only `address`, `city`, `pincode`, `phone` and
`notes`; any other field is ignored. Setting a required field to an empty string → `400`.

In the new UI:
- Label the fields "Postal code (optional)" and "Delivery notes (optional)".
- Phone has a fixed `+234` prefix in the design. Send the full number, e.g. `+2348012345678`.
- **"Use a new address" at checkout:** first `POST /shop/address/add`, then use the returned
  `data._id` as `addressInfo.addressId` when creating the order (see §8). The "Save this address for
  next time" checkbox can stay checked by default. A delivery order needs a saved address either way.
- Hide the whole address section when the chosen delivery option is **pickup**.

---

## 8. Checkout: delivery method, payment and orders

### `GET /shop/delivery-options` (new, public)

Returns the delivery options shoppers can choose right now, in display order:
```json
{ "success": true, "data": [
  { "_id": "…", "name": "Pickup", "type": "pickup", "fee": 0,
    "description": "Collect your order from our store after paying online.", "sortOrder": 0 },
  { "_id": "…", "name": "Lagos Mainland delivery", "type": "delivery", "fee": 5000,
    "description": "Delivered to your address on the Lagos Mainland.", "sortOrder": 1 },
  { "_id": "…", "name": "Lagos Island delivery", "type": "delivery", "fee": 8000,
    "description": "Delivered to your address on Lagos Island.", "sortOrder": 2 }
] }
```
- `type: "pickup"` → no address needed. `type: "delivery"` → a saved address is required.
- `fee` is a whole number of naira. Admins can change fees, rename options, add zones or hide them
  (§8b). **Render whatever this endpoint returns; don't hard-code options or fees.**

Checkout UI ("How do you want to get your order?" in the design, desktop and mobile):
1. Fetch the options when checkout opens. Show each as a radio card with the name, the `₦fee`
   (Geist Mono) and the description.
2. Show the **Delivery address** section only when the selected option has `type: "delivery"`.
3. The summary shows Subtotal, "Delivery · {option name}" with `₦fee`, and Total = subtotal + fee.
   The pay button reads "Pay ₦{total} by transfer".
4. Product page and cart copy: "Lagos delivery or store pickup", and in the cart, "Delivery: chosen
   at checkout". Fees shown on the product page should come from this endpoint too. Never say "free
   delivery".

### `POST /shop/order/create` (changed, login required)

The server builds the order from the **user's own cart**, the **chosen delivery option** and, for
delivery, their **saved address**. The body is:
```json
{ "deliveryOptionId": "<_id from /shop/delivery-options>",
  "addressInfo": { "addressId": "<saved address _id — required only for type: delivery>" } }
```
Other fields the current frontend sends (`cartItems`, `totalAmount`, `userId`, …) are ignored.
`deliveryOptionId` is **required** now.

Response:
```json
{ "success": true, "orderId": "…", "subtotal": 13483, "deliveryFee": 5000, "totalAmount": 18483 }
```
- **Use `totalAmount` from this response for the Paystack amount** (`amount: totalAmount * 100` in
  kobo, `currency: "NGN"`). Don't use the total calculated in the browser. Verification fails if the
  amount differs.
- Errors (show as a toast or inline):
  - `400 "Your cart is empty"`
  - `400 "Please choose pickup or a delivery option"` (missing or inactive option)
  - `400 "Please select a delivery address"`
  - `400 "Only N of <product> left in stock"`

### Paystack popup: bank transfer only

Restrict the popup to transfer:
```js
window.PaystackPop.setup({
  key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
  email: user.email,
  amount: totalAmount * 100,      // from the create-order response
  currency: "NGN",
  channels: ["bank_transfer"],    // REQUIRED: the server rejects any other channel
  ref: reference,
  callback, onClose,
});
```
The design's payment card explains it: "Paystack gives you a one-time account number. Transfer the
exact amount from any Nigerian bank app and your order confirms automatically." Remove the
Card / USSD chips.

### `PUT /shop/order/verify` (changed, login required)
```json
{ "reference": "<paystack reference>", "orderId": "<orderId>" }
```
- Success → `200 { success: true, message: "Order confirmed", data: order }`.
- Calling it again for an order that's already paid also returns `200 success` (safe to retry).
- `400 "Payment verification failed"` if Paystack doesn't confirm the exact amount in NGN.
- **New:** `400 "Only bank transfer payments are accepted. Please contact us for a refund."` if the
  payment came through any channel other than bank transfer. The order stays unpaid. Show the message
  and a contact link.
- `404` if the order doesn't belong to the logged-in user.

### Orders in the Account page

`GET /shop/order/list/:userId` (must be the logged-in user's id) and `GET /shop/order/details/:id`.
Orders now include:
```json
{ "subtotal": 13483, "deliveryFee": 5000, "totalAmount": 18483, "paymentChannel": "bank_transfer",
  "deliveryMethod": { "optionId": "…", "name": "Lagos Mainland delivery", "type": "delivery", "fee": 5000, "description": "…" } }
```
`deliveryMethod` is a snapshot from checkout time, so later fee changes don't affect it. Pickup
orders have no `addressInfo`. Older orders created before this change have no `deliveryMethod`;
treat them as delivery orders.

| Order field | Values | UI |
|---|---|---|
| `paymentStatus` | `pending`, `paid` | `pending` → amber "Awaiting payment" card with **Complete payment** |
| `orderStatus` (delivery) | `pending`, `confirmed`, `inShipping`, `delivered`, `rejected` | tracker: Placed → Confirmed → In shipping → Delivered |
| `orderStatus` (pickup) | `pending`, `confirmed`, `readyForPickup`, `delivered`, `rejected` | tracker: Placed → Confirmed → Ready for pickup → Collected (`delivered` means collected for pickup orders) |
| `rejected` | | red "Cancelled" pill instead of the tracker |
| `orderDate`, `orderUpdateDate` | ISO dates | "Placed {date}", "Delivered/Collected {date}" |

Show `deliveryMethod.name` next to the date and include the delivery fee in the order details
breakdown.

**Complete payment** (pending orders): fetch `GET /shop/order/details/:id`, then open the same
transfer-only Paystack popup with `order._id` and `order.totalAmount` (which already includes the
delivery fee). Store `currentOrderId` in sessionStorage as checkout does now, so
`/shop/paystack-return` verifies it. No new endpoint is needed.

### 8b. Admin › Delivery & pickup page (new admin screen)

All of these require an admin account. In the design it's the "Admin · Delivery & pickup" screen.
Add it to the admin sidebar.

| Method | Path | Body | Result |
|---|---|---|---|
| `GET` | `/admin/delivery-options` | n/a | every option, **including inactive** ones |
| `POST` | `/admin/delivery-options` | `{ name, type: "pickup" \| "delivery", fee, description?, active?, sortOrder? }` | `201 { data: option }` |
| `PUT` | `/admin/delivery-options/:id` | any subset of the fields above | `200 { data: option }` |
| `DELETE` | `/admin/delivery-options/:id` | n/a | `200` |

Validation (`400` with a readable message):
- `name` is required, up to 60 characters.
- `type` must be `pickup` or `delivery`.
- `fee` must be a whole number of naira, 0 or more.
- `description` can be up to 300 characters.

UI: one editable card per option, with Name, Type, Fee (with a ₦ prefix), a "Shown at checkout"
toggle (`active`), Description, and Save / Delete buttons, plus an "Add option" button. Put the
pickup address in the Pickup option's description. Suggest turning an option off rather than
deleting it. Changes take effect at checkout immediately; existing orders keep their fee.

**Admin order status:** `PUT /admin/orders/update/:id` now only accepts `pending`, `confirmed`,
`inShipping`, `readyForPickup`, `delivered` or `rejected` (anything else → `400`). In the admin order
dialog, offer "Ready for pickup" for pickup orders and "In shipping" for delivery orders.
`orderUpdateDate` is set automatically.

Each abandoned checkout leaves a pending order. In the list, show at most the most recent pending
order prominently, or group them under "Awaiting payment".

**Buy again:** call `POST /shop/cart/add` for each item in the order, then open the cart drawer.

---

## 9. Access rules (from the security pass)

- Every cart, address, order, wishlist and review-submission endpoint requires login.
- Any `:userId` in a URL must be the logged-in user's id (`auth.user.id`), otherwise `403`. The
  current code already does this.
- `/admin/*` and `POST /common/feature/add` require an admin account.
- Public (no login): product list and details, search, the review list, `GET /common/feature/get`,
  `GET /shop/delivery-options`, and the auth endpoints.

---

## 10. Not provided by the backend (frontend-only or placeholder)

- **Pickup address:** put it in the Pickup option's `description` from the admin page. The
  "[Pickup address]" placeholder in the design comes from there.
- **Password strength meter** beyond the 8-character rule: client-side only.
- **"You save ₦X"** in the cart: calculate it in the browser from `price − salePrice` per item.
- **Manufacturer warranty, 7-day returns:** static marketing copy. **There is no free delivery**;
  never show "free delivery" anywhere.
- **Dark mode:** not in the design yet. Build the light theme first using CSS variables so dark mode
  can be added later.
