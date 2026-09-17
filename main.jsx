import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { supabase } from "./supabase";

function App() {
  const [page, setPage] = useState("home");
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [cart, setCart] = useState([]);
  const [logged, setLogged] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sizeFilter, setSizeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");

  const [adminTab, setAdminTab] = useState("products");
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [form, setForm] = useState({
    name: "",
    article: "",
    description: "",
    size: "40",
    color: "",
    price: "",
    stock: "1",
    category: "",
    imageFile: null,
  });

  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [paymentMethod, setPaymentMethod] = useState("COD");
  const COD_FEE = 50;
  const RAZORPAY_KEY_ID =
    import.meta.env.VITE_RAZORPAY_KEY_ID || "";

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const imageInputRef = useRef(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  const [packingForm, setPackingForm] = useState({
    courier_name: "",
    tracking_number: "",
    package_weight: "",
    package_length: "",
    package_width: "",
    package_height: "",
    packing_note: "",
  });

  // -----------------------------
  // CUSTOMER TRACKING
  // -----------------------------
  const [trackingForm, setTrackingForm] = useState({
    order_number: "",
    phone: "",
  });

  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const trackingStatuses = [
    "NEW",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
  ];

  // -----------------------------
  // LOAD PRODUCTS + AUTH
  // -----------------------------
  useEffect(() => {
    loadProducts();

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setLogged(true);
        setUserEmail(data.session.user.email || "");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setLogged(true);
        setUserEmail(session.user.email || "");
      } else {
        setLogged(false);
        setUserEmail("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setProducts(data || []);
  }

  // -----------------------------
  // CUSTOMER TRACK ORDER
  // -----------------------------
  async function trackOrder(e) {
    e.preventDefault();

    const orderNo = trackingForm.order_number
      .trim()
      .toUpperCase();

    const phone = trackingForm.phone.trim();

    if (!orderNo || !phone) {
      alert("Please enter Order Number and Mobile Number.");
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setTrackingLoading(true);
    setTrackedOrder(null);

    const { data, error } = await supabase.rpc(
      "track_customer_order",
      {
        p_order_number: orderNo,
        p_phone: phone,
      }
    );

    setTrackingLoading(false);

    if (error) {
      alert("Tracking error: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert(
        "Order not found. Please check your Order Number and Mobile Number."
      );
      return;
    }

    setTrackedOrder(data[0]);
  }

  function getTrackingStatusIndex(status) {
    const index = trackingStatuses.indexOf(status);

    if (index >= 0) {
      return index;
    }

    return -1;
  }

  // -----------------------------
  // LOAD ORDERS
  // -----------------------------
  async function loadOrders() {
    setOrdersLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    setOrdersLoading(false);

    if (error) {
      alert("Orders load error: " + error.message);
      return;
    }

    setOrders(data || []);
  }

  async function openOrder(order) {
    setSelectedOrder(order);

    setPackingForm({
      courier_name: order.courier_name || "",
      tracking_number: order.tracking_number || "",
      package_weight: order.package_weight || "",
      package_length: order.package_length || "",
      package_width: order.package_width || "",
      package_height: order.package_height || "",
      packing_note: order.packing_note || "",
    });

    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("id", { ascending: true });

    if (error) {
      alert("Order items error: " + error.message);
      return;
    }

    setOrderItems(data || []);
  }

  // -----------------------------
  // UPDATE ORDER / PACKING
  // -----------------------------
  async function saveOrderDetails() {
    if (!selectedOrder) return;

    setLoading(true);

    const newStatus = selectedOrder.order_status || "NEW";

    const updateData = {
      courier_name: packingForm.courier_name.trim(),
      tracking_number: packingForm.tracking_number.trim(),
      package_weight: Number(packingForm.package_weight) || 0,
      package_length: Number(packingForm.package_length) || 0,
      package_width: Number(packingForm.package_width) || 0,
      package_height: Number(packingForm.package_height) || 0,
      packing_note: packingForm.packing_note.trim(),
    };

    if (newStatus === "SHIPPED") {
      updateData.shipped_at =
        selectedOrder.shipped_at ||
        new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", selectedOrder.id)
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert("Packing details save error: " + error.message);
      return;
    }

    setSelectedOrder(data);

    setOrders((prev) =>
      prev.map((order) =>
        order.id === data.id ? data : order
      )
    );

    alert("Packing details saved successfully!");
  }

  async function updateOrderStatus(status) {
    if (!selectedOrder) return;

    setLoading(true);

    const updateData = {
      order_status: status,
    };

    if (status === "SHIPPED") {
      updateData.shipped_at =
        selectedOrder.shipped_at ||
        new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", selectedOrder.id)
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert("Status update error: " + error.message);
      return;
    }

    setSelectedOrder(data);

    setOrders((prev) =>
      prev.map((order) =>
        order.id === data.id ? data : order
      )
    );

    alert("Order status updated.");
  }

  // -----------------------------
  // CART
  // -----------------------------
  function addToCart(product) {
    if (!product) return;

    if (Number(product.stock) <= 0) {
      alert("This product is out of stock.");
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.id === product.id
      );

      if (existing) {
        if (
          existing.quantity >= Number(product.stock)
        ) {
          alert("Maximum available stock reached.");
          return prev;
        }

        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    alert("Added to cart!");
  }

  function buyNow(product) {
    if (!product) return;

    if (Number(product.stock) <= 0) {
      alert("This product is out of stock.");
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.id === product.id
      );

      if (existing) return prev;

      return [
        ...prev,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    setPage("cart");
  }

  function increaseQuantity(productId) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== productId) return item;

        if (
          item.quantity >= Number(item.stock)
        ) {
          alert("Maximum available stock reached.");
          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(productId) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId) {
    setCart((prev) =>
      prev.filter((item) => item.id !== productId)
    );
  }

  function clearCart() {
    setCart([]);
    setCoupon("");
    setDiscount(0);
  }

  const cartItemCount = cart.reduce(
    (total, item) =>
      total + Number(item.quantity),
    0
  );

  const subtotal = cart.reduce(
    (total, item) =>
      total +
      Number(item.price) *
        Number(item.quantity),
    0
  );

  // Temporary test coupon
  function applyCoupon() {
    const code = coupon.trim().toUpperCase();

    if (code === "SK20") {
      const calculatedDiscount = Math.min(
        subtotal * 0.2,
        300
      );

      setDiscount(calculatedDiscount);

      alert("Coupon applied!");
    } else {
      setDiscount(0);
      alert("Invalid coupon.");
    }
  }

  const discountedTotal = Math.max(
    subtotal - discount,
    0
  );

  const codFee = paymentMethod === "COD" ? COD_FEE : 0;

  const finalTotal = discountedTotal + codFee;

  // -----------------------------
  // LOGIN
  // -----------------------------
  async function handleLogin(e) {
    e.preventDefault();

    if (
      !loginForm.email ||
      !loginForm.password
    ) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setLogged(true);
    setUserEmail(data.user?.email || "");

    setLoginForm({
      email: "",
      password: "",
    });

    alert("Login successful!");
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setLogged(false);
    setUserEmail("");
    setPage("home");
  }

  // -----------------------------
  // ADD PRODUCT
  // -----------------------------
  async function handleAddProduct(e) {
    e.preventDefault();

    if (
      !form.name ||
      !form.article ||
      !form.price ||
      !form.stock ||
      !form.category
    ) {
      alert("Please fill all required product fields.");
      return;
    }

    setLoading(true);

    let imageUrl = "";

    try {
      if (form.imageFile) {
        const file = form.imageFile;

        // FIXED: file extension is now properly defined
        const fileExt = file.name
          .split(".")
          .pop();

        const fileName =
          Date.now() +
          "-" +
          Math.random().toString(36).substring(2) +
          "." +
          fileExt;

        const { error: uploadError } =
          await supabase.storage
            .from("product-images")
            .upload(fileName, file);

        if (uploadError) {
          throw new Error(
            "Photo upload error: " +
              uploadError.message
          );
        }

        const { data: publicUrlData } =
          supabase.storage
            .from("product-images")
            .getPublicUrl(fileName);

        imageUrl =
          publicUrlData.publicUrl;
      }

      const { error } =
        await supabase.from("products").insert([
          {
            article_code: form.article,
            name: form.name,
            description: form.description,
            size: form.size,
            color: form.color,
            price: Number(form.price),
            stock: 1,
            category: form.category,
            image_url: imageUrl,
            is_active: true,
          },
        ]);

      if (error) {
        throw new Error(
          "Product save error: " +
            error.message
        );
      }

      alert("Product added successfully!");

      setForm({
        name: "",
        article: "",
        description: "",
        size: "40",
        color: "",
        price: "",
        stock: "1",
        category: "",
        imageFile: null,
      });
      setSelectedImageName("");
      setImagePreview("");
      if (imageInputRef.current) imageInputRef.current.value = "";

      await loadProducts();
    } catch (error) {
      alert(error.message);
    }

    setLoading(false);
  }

  async function loadRazorpayScript() {
    if (window.Razorpay) return true;

    return new Promise((resolve) => {
      const existing = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => resolve(false));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function startRazorpayPayment(orderData) {
    if (!RAZORPAY_KEY_ID) {
      throw new Error(
        "Razorpay Key ID missing. Add VITE_RAZORPAY_KEY_ID to your .env file."
      );
    }

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      throw new Error("Unable to load Razorpay Checkout.");
    }

    return new Promise((resolve, reject) => {
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: Number(orderData.razorpay_amount),
        currency: "INR",
        name: "SK STORE",
        description:
          orderData.payment_method === "COD"
            ? "COD booking advance"
            : "SK STORE prepaid order",
        order_id: orderData.razorpay_order_id,
        prefill: {
          name: checkoutForm.name.trim(),
          contact: checkoutForm.phone.trim(),
        },
        notes: {
          sk_order_id: orderData.order_id,
          order_number: orderData.order_number,
          payment_method: orderData.payment_method,
        },
        theme: {
          color: "#111111",
        },
        handler: async function (response) {
          try {
            const { data, error } = await supabase.functions.invoke(
              "verify-razorpay-payment",
              {
                body: {
                  order_id: orderData.order_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              }
            );

            if (error) throw error;
            if (!data?.success) {
              throw new Error(
                data?.message || "Payment verification failed."
              );
            }

            resolve(data);
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () =>
            reject(new Error("Payment was cancelled.")),
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", (response) => {
        reject(
          new Error(
            response?.error?.description ||
              "Payment failed. Please try again."
          )
        );
      });

      razorpay.open();
    });
  }

  // -----------------------------
  // CHECKOUT
  // -----------------------------
  function openCheckout() {
    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    setOrderPlaced(false);
    setPage("checkout");
  }

  function handleCheckoutChange(e) {
    const { name, value } = e.target;

    setCheckoutForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function placeOrder(e) {
    e.preventDefault();

    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    const {
      name,
      phone,
      address,
      city,
      state,
      pincode,
    } = checkoutForm;

    if (
      !name.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !city.trim() ||
      !state.trim() ||
      !pincode.trim()
    ) {
      alert("Please fill all delivery details.");
      return;
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
      alert(
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    if (!/^[0-9]{6}$/.test(pincode.trim())) {
      alert(
        "Please enter a valid 6-digit pincode."
      );
      return;
    }

    setLoading(true);
    let reservedProducts = [];
    let createdOrderId = null;

    try {
      // Reserve every single-piece article atomically against its current stock.
      reservedProducts = [];

      for (const item of cart) {
        const currentStock = Number(item.stock);
        const requestedQty = Number(item.quantity);

        if (requestedQty !== 1) {
          throw new Error(
            `${item.article_code || item.name} is a single-piece article. Quantity must be 1.`
          );
        }

        if (currentStock <= 0) {
          throw new Error(
            `${item.article_code || item.name} is already sold out.`
          );
        }

        const { data: reservedRows, error: reserveError } =
          await supabase
            .from("products")
            .update({ stock: currentStock - requestedQty })
            .eq("id", item.id)
            .eq("stock", currentStock)
            .gte("stock", requestedQty)
            .select("id, stock");

        if (reserveError) {
          throw new Error(
            "Stock reservation error: " + reserveError.message
          );
        }

        if (!reservedRows || reservedRows.length === 0) {
          throw new Error(
            `${item.article_code || item.name} was just booked by another customer. Please remove it from your cart and try again.`
          );
        }

        reservedProducts.push({
          id: item.id,
          previousStock: currentStock,
          quantity: requestedQty,
        });
      }

      const generatedOrderNumber =
        "SK" + Date.now().toString().slice(-8);

      const amountDueOnDelivery =
        paymentMethod === "COD"
          ? Math.max(finalTotal - COD_FEE, 0)
          : 0;

      const amountToPayNow =
        paymentMethod === "COD" ? COD_FEE : finalTotal;

      const { data: orderData, error: orderError } =
        await supabase
          .from("orders")
          .insert([
            {
              order_number: generatedOrderNumber,
              customer_name: name.trim(),
              phone: phone.trim(),
              address: address.trim(),
              city: city.trim(),
              state: state.trim(),
              pincode: pincode.trim(),
              subtotal: subtotal,
              discount: discount,
              total: finalTotal,
              payment_method: paymentMethod,
              payment_status: "PENDING",
              order_status: "PAYMENT_PENDING",
              amount_paid: 0,
              amount_due: amountDueOnDelivery,
            },
          ])
          .select()
          .single();

      if (orderError) {
        throw new Error(
          "Order save error: " + orderError.message
        );
      }

      createdOrderId = orderData.id;

      const orderItemRows = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        article_code: item.article_code || "",
        product_name: item.name,
        size: item.size || "",
        color: item.color || "",
        price: Number(item.price),
        quantity: Number(item.quantity),
      }));

      const { error: itemError } =
        await supabase
          .from("order_items")
          .insert(orderItemRows);

      if (itemError) {
        throw new Error(
          "Order items save error: " + itemError.message
        );
      }

      const { data: razorpayOrder, error: razorpayOrderError } =
        await supabase.functions.invoke("create-razorpay-order", {
          body: { order_id: orderData.id },
        });

      if (razorpayOrderError) {
        throw razorpayOrderError;
      }

      if (!razorpayOrder?.razorpay_order_id) {
        throw new Error(
          "Could not create Razorpay payment order."
        );
      }

      await startRazorpayPayment({
        order_id: orderData.id,
        order_number: generatedOrderNumber,
        payment_method: paymentMethod,
        razorpay_order_id: razorpayOrder.razorpay_order_id,
        razorpay_amount: amountToPayNow * 100,
      });

      setOrderNumber(generatedOrderNumber);
      setOrderPlaced(true);

      setCart([]);
      setCoupon("");
      setDiscount(0);
      setPaymentMethod("COD");

      await loadProducts();
    } catch (error) {
      // Remove a payment-pending order if checkout/payment setup failed.
      if (createdOrderId) {
        await supabase
          .from("order_items")
          .delete()
          .eq("order_id", createdOrderId);

        await supabase
          .from("orders")
          .delete()
          .eq("id", createdOrderId);
      }

      // If order creation fails after reserving stock, restore the reserved
      // single-piece articles. Only restore rows whose stock is still the
      // value created by our reservation.
      for (const reserved of reservedProducts) {
        await supabase
          .from("products")
          .update({ stock: reserved.previousStock })
          .eq("id", reserved.id)
          .eq(
            "stock",
            reserved.previousStock - reserved.quantity
          );
      }

      alert(error.message);
    }

    setLoading(false);
  }

  // -----------------------------
  // FILTER PRODUCTS
  // -----------------------------
  const categories = [
    "ALL",
    ...new Set(
      products
        .map(
          (product) => product.category
        )
        .filter(Boolean)
    ),
  ];

  const sizes = [
    "ALL",
    ...new Set(
      products
        .map(
          (product) => product.size
        )
        .filter(Boolean)
    ),
  ];

  let filteredProducts = [...products];

  if (search.trim()) {
    const searchText =
      search.toLowerCase();

    filteredProducts =
      filteredProducts.filter(
        (product) =>
          `${product.name} ${product.article_code} ${product.category} ${product.color}`
            .toLowerCase()
            .includes(searchText)
      );
  }

  if (categoryFilter !== "ALL") {
    filteredProducts =
      filteredProducts.filter(
        (product) =>
          product.category ===
          categoryFilter
      );
  }

  if (sizeFilter !== "ALL") {
    filteredProducts =
      filteredProducts.filter(
        (product) =>
          product.size === sizeFilter
      );
  }

  if (sortBy === "LOW") {
    filteredProducts.sort(
      (a, b) =>
        Number(a.price) -
        Number(b.price)
    );
  }

  if (sortBy === "HIGH") {
    filteredProducts.sort(
      (a, b) =>
        Number(b.price) -
        Number(a.price)
    );
  }

  // -----------------------------
  // PRODUCT CARD
  // -----------------------------
  function ProductCard({ product }) {
    return (
      <div className="product-card">
        <div
          className="product-image-box"
          onClick={() => {
            setSelectedProduct(product);
            setPage("product");
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="product-image"
              style={{
                width: "100%",
                height: "190px",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <div className="no-image">
              SK STORE
            </div>
          )}
        </div>

        <div className="product-info">
          <div className="product-category">
            {product.category}
          </div>

          <h3>{product.name}</h3>

          <p className="article">
            Article:{" "}
            {product.article_code}
          </p>

          <p className="product-price">
            ₹
            {Number(
              product.price
            ).toLocaleString("en-IN")}
          </p>

          <p className="product-size">
            Size: {product.size}
          </p>

          {Number(product.stock) > 0 ? (
            <p className="stock-text">
              In Stock
            </p>
          ) : (
            <p className="out-stock">
              Out of Stock
            </p>
          )}

          <button
            className="view-product-btn"
            onClick={() => {
              setSelectedProduct(product);
              setPage("product");
            }}
          >
            VIEW PRODUCT
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------
  // HEADER
  // -----------------------------
  function Header() {
    return (
      <header className="header">
        <div
          className="logo"
          onClick={() =>
            setPage("home")
          }
        >
          SK STORE
        </div>

        <nav className="nav">
          <button
            onClick={() =>
              setPage("home")
            }
          >
            HOME
          </button>

          <button
            onClick={() =>
              setPage("shop")
            }
          >
            SHOP
          </button>

          <button
            onClick={() =>
              setPage("creator")
            }
          >
            CREATOR CLUB
          </button>

          <button
            onClick={() =>
              setPage("track")
            }
          >
            TRACK ORDER
          </button>

          <button
            className="cart-nav"
            onClick={() =>
              setPage("cart")
            }
          >
            CART
            {cartItemCount > 0 && (
              <span className="cart-count">
                {cartItemCount}
              </span>
            )}
          </button>

          <button
            onClick={() =>
              setPage("account")
            }
          >
            ACCOUNT
          </button>
        </nav>
      </header>
    );
  }

  // -----------------------------
  // HOME
  // -----------------------------
  function HomePage() {
    const latestProducts =
      products.slice(0, 8);

    return (
      <div>
        <section className="hero">
          <div className="hero-content">
            <p>WELCOME TO</p>

            <h1>SK STORE</h1>

            <h2>
              FASHION THAT FITS
              <br />
              YOUR STYLE.
            </h2>

            <button
              className="hero-btn"
              onClick={() =>
                setPage("shop")
              }
            >
              SHOP NOW
            </button>
          </div>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <p>SHOP THE LATEST</p>
            <h2>NEW ARRIVALS</h2>
          </div>

          <div className="product-grid">
            {latestProducts.map(
              (product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              )
            )}
          </div>

          {products.length > 8 && (
            <div className="center-btn">
              <button
                className="dark-btn"
                onClick={() =>
                  setPage("shop")
                }
              >
                VIEW ALL PRODUCTS
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  // -----------------------------
  // SHOP
  // -----------------------------
  function ShopPage() {
    const sizeColumns = sizes
      .filter((size) => size !== "ALL")
      .filter(
        (size) =>
          sizeFilter === "ALL" ||
          size === sizeFilter
      )
      .sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
          return na - nb;
        }
        return String(a).localeCompare(String(b));
      });

    return (
      <section className="shop-page">
        <div className="page-title">
          <p>SK STORE</p>
          <h1>SHOP</h1>
        </div>

        <div className="shop-controls">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value)
            }
          >
            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>

          <select
            value={sizeFilter}
            onChange={(e) =>
              setSizeFilter(e.target.value)
            }
          >
            {sizes.map((size) => (
              <option
                key={size}
                value={size}
              >
                {size === "ALL" ? "All Sizes" : `Size ${size}`}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value)
            }
          >
            <option value="NEWEST">Newest</option>
            <option value="LOW">Price: Low to High</option>
            <option value="HIGH">Price: High to Low</option>
          </select>
        </div>

        <div
          style={{
            marginTop: "28px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "18px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                letterSpacing: "1px",
              }}
            >
              SHOP BY SIZE
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "#666",
                fontSize: "14px",
              }}
            >
              Select your size and find available articles directly.
            </p>
          </div>

          {sizeColumns.length === 0 ? (
            <div className="empty-result">
              No sizes available.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "14px",
                alignItems: "start",
              }}
            >
              {sizeColumns.map((size) => {
                const sizeProducts = filteredProducts.filter(
                  (product) => product.size === size
                );

                return (
                  <div
                    key={size}
                    style={{
                      border: "1px solid #e5e5e5",
                      borderRadius: "12px",
                      background: "#fff",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 12px",
                        textAlign: "center",
                        background: "#f7f7f7",
                        borderBottom: "1px solid #e5e5e5",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "18px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        SIZE {size}
                      </strong>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#777",
                          marginTop: "3px",
                        }}
                      >
                        {sizeProducts.length} article
                        {sizeProducts.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "8px",
                        display: "grid",
                        gap: "8px",
                      }}
                    >
                      {sizeProducts.length === 0 ? (
                        <div
                          style={{
                            padding: "14px 8px",
                            textAlign: "center",
                            color: "#999",
                            fontSize: "13px",
                          }}
                        >
                          No article available
                        </div>
                      ) : (
                        sizeProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(product);
                              setPage("product");
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: "1px solid #ededed",
                              borderRadius: "9px",
                              background: "#fff",
                              padding: "9px",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "9px",
                              }}
                            >
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  style={{
                                    width: "52px",
                                    height: "62px",
                                    objectFit: "contain",
                                    borderRadius: "6px",
                                    background: "#f8f8f8",
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "52px",
                                    height: "62px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "#f8f8f8",
                                    borderRadius: "6px",
                                    fontSize: "9px",
                                    flexShrink: 0,
                                  }}
                                >
                                  SK
                                </div>
                              )}

                              <div
                                style={{
                                  minWidth: 0,
                                  flex: 1,
                                }}
                              >
                                <strong
                                  style={{
                                    display: "block",
                                    fontSize: "14px",
                                    color: "#111",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {product.article_code}
                                </strong>
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: "3px",
                                    fontSize: "12px",
                                    color: "#666",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {product.name}
                                </span>
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: "4px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "#111",
                                  }}
                                >
                                  ₹{Number(product.price).toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="result-count">
          {filteredProducts.length} products available
        </p>

        {filteredProducts.length === 0 && (
          <div className="empty-result">
            No products found.
          </div>
        )}
      </section>
    );
  }

  // -----------------------------
  // PRODUCT DETAIL
  // -----------------------------
  function ProductPage() {
    if (!selectedProduct) {
      return (
        <div className="empty-result">
          Product not found.
        </div>
      );
    }

    const product = selectedProduct;

    return (
      <section className="product-detail">
        <div className="detail-image-box">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="detail-image"
            />
          ) : (
            <div className="no-image">
              SK STORE
            </div>
          )}
        </div>

        <div className="detail-info">
          <p className="product-category">
            {product.category}
          </p>

          <h1>{product.name}</h1>

          <p className="article">
            Article: {product.article_code}
          </p>

          <h2 className="detail-price">
            ₹
            {Number(
              product.price
            ).toLocaleString("en-IN")}
          </h2>

          <div className="detail-line">
            <strong>Size:</strong>{" "}
            {product.size}
          </div>

          <div className="detail-line">
            <strong>Colour:</strong>{" "}
            {product.color || "—"}
          </div>

          <div className="detail-line">
            <strong>Stock:</strong>{" "}
            {Number(product.stock) > 0
              ? `${product.stock} available`
              : "Out of stock"}
          </div>

          <p className="detail-description">
            {product.description ||
              "Premium fashion from SK STORE."}
          </p>

          <div className="detail-buttons">
            <button
              className="dark-btn"
              disabled={
                Number(product.stock) <= 0
              }
              onClick={() =>
                addToCart(product)
              }
            >
              ADD TO CART
            </button>

            <button
              className="outline-btn"
              disabled={
                Number(product.stock) <= 0
              }
              onClick={() =>
                buyNow(product)
              }
            >
              BUY NOW
            </button>
          </div>

          <button
            className="back-btn"
            onClick={() =>
              setPage("shop")
            }
          >
            ← BACK TO SHOP
          </button>
        </div>
      </section>
    );
  }

  // -----------------------------
  // CART
  // -----------------------------
  function CartPage() {
    return (
      <section className="cart-page">
        <div className="page-title">
          <p>SK STORE</p>
          <h1>YOUR CART</h1>
        </div>

        {cart.length === 0 ? (
          <div className="empty-cart">
            <h2>Your cart is empty.</h2>

            <p>
              Add some beautiful
              styles to your cart.
            </p>

            <button
              className="dark-btn"
              onClick={() =>
                setPage("shop")
              }
            >
              CONTINUE SHOPPING
            </button>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              {cart.map((item) => (
                <div
                  className="cart-item"
                  key={item.id}
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                    />
                  ) : (
                    <div className="cart-no-image">
                      SK STORE
                    </div>
                  )}

                  <div className="cart-item-info">
                    <h3>{item.name}</h3>

                    <p>
                      Article:{" "}
                      {item.article_code}
                    </p>

                    <p>
                      Size: {item.size}
                    </p>

                    <p>
                      Colour:{" "}
                      {item.color || "—"}
                    </p>

                    <p>
                      ₹
                      {Number(
                        item.price
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </p>

                    <div className="quantity-box">
                      <button
                        onClick={() =>
                          decreaseQuantity(
                            item.id
                          )
                        }
                      >
                        −
                      </button>

                      <span>
                        {item.quantity}
                      </span>

                      <button
                        onClick={() =>
                          increaseQuantity(
                            item.id
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="item-total">
                    ₹
                    {(
                      Number(
                        item.price
                      ) *
                      Number(
                        item.quantity
                      )
                    ).toLocaleString(
                      "en-IN"
                    )}

                    <button
                      className="remove-cart-btn"
                      onClick={() =>
                        removeFromCart(
                          item.id
                        )
                      }
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <h2>ORDER SUMMARY</h2>

              <div className="summary-line">
                <span>
                  Items ({cartItemCount})
                </span>

                <strong>
                  ₹
                  {subtotal.toLocaleString(
                    "en-IN"
                  )}
                </strong>
              </div>

              {discount > 0 && (
                <div className="summary-line discount-line">
                  <span>Discount</span>

                  <strong>
                    -₹
                    {discount.toLocaleString(
                      "en-IN"
                    )}
                  </strong>
                </div>
              )}

              <div className="coupon-box">
                <input
                  type="text"
                  placeholder="Coupon code"
                  value={coupon}
                  onChange={(e) =>
                    setCoupon(
                      e.target.value
                    )
                  }
                />

                <button
                  onClick={
                    applyCoupon
                  }
                >
                  APPLY
                </button>
              </div>

              <div className="summary-total">
                <span>Total</span>

                <strong>
                  ₹
                  {finalTotal.toLocaleString(
                    "en-IN"
                  )}
                </strong>
              </div>

              <button
                className="checkout-btn"
                onClick={
                  openCheckout
                }
              >
                PROCEED TO CHECKOUT
              </button>

              <button
                className="continue-shopping-btn"
                onClick={() =>
                  setPage("shop")
                }
              >
                CONTINUE SHOPPING
              </button>

              <button
                className="clear-cart-btn"
                onClick={clearCart}
              >
                CLEAR CART
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  // -----------------------------
  // CHECKOUT
  // -----------------------------
  function CheckoutPage() {
    if (orderPlaced) {
      return (
        <section className="checkout-page">
          <div className="order-success">
            <div className="success-icon">
              ✓
            </div>

            <h1>ORDER PLACED!</h1>

            <p>
              Thank you for shopping
              with
              <strong>
                {" "}
                SK STORE
              </strong>
              .
            </p>

            <div className="order-number-box">
              <span>Order Number</span>

              <strong>
                {orderNumber}
              </strong>
            </div>

            <p className="success-note">
              Your order has been
              received successfully.
            </p>

            <div className="success-buttons">
              <button
                className="dark-btn"
                onClick={() => {
                  setTrackingForm({
                    order_number:
                      orderNumber,
                    phone:
                      checkoutForm.phone,
                  });

                  setTrackedOrder(null);
                  setOrderPlaced(false);
                  setPage("track");
                }}
              >
                TRACK MY ORDER
              </button>

              <button
                className="outline-btn"
                onClick={() => {
                  setPage("shop");
                  setOrderPlaced(false);
                }}
              >
                CONTINUE SHOPPING
              </button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="checkout-page">
        <div className="page-title">
          <p>SK STORE</p>
          <h1>CHECKOUT</h1>
        </div>

        <div className="checkout-layout">
          <form
            className="checkout-form"
            onSubmit={placeOrder}
          >
            <h2>DELIVERY DETAILS</h2>

            <label>Full Name *</label>

            <input
              name="name"
              type="text"
              placeholder="Enter your full name"
              value={checkoutForm.name}
              onChange={
                handleCheckoutChange
              }
            />

            <label>
              Mobile / WhatsApp Number *
            </label>

            <input
              name="phone"
              type="tel"
              maxLength="10"
              placeholder="10-digit mobile number"
              value={checkoutForm.phone}
              onChange={
                handleCheckoutChange
              }
            />

            <label>Full Address *</label>

            <textarea
              name="address"
              rows="4"
              placeholder="House / Flat / Street / Area"
              value={checkoutForm.address}
              onChange={
                handleCheckoutChange
              }
            />

            <div className="checkout-two-column">
              <div>
                <label>City *</label>

                <input
                  name="city"
                  type="text"
                  placeholder="City"
                  value={checkoutForm.city}
                  onChange={
                    handleCheckoutChange
                  }
                />
              </div>

              <div>
                <label>State *</label>

                <input
                  name="state"
                  type="text"
                  placeholder="State"
                  value={checkoutForm.state}
                  onChange={
                    handleCheckoutChange
                  }
                />
              </div>
            </div>

            <label>Pincode *</label>

            <input
              name="pincode"
              type="text"
              maxLength="6"
              placeholder="6-digit pincode"
              value={checkoutForm.pincode}
              onChange={
                handleCheckoutChange
              }
            />

            <div className="payment-method">
              <h3>PAYMENT METHOD</h3>

              <label className={`payment-option ${paymentMethod === "PREPAID" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="PREPAID"
                  checked={paymentMethod === "PREPAID"}
                  onChange={() => setPaymentMethod("PREPAID")}
                />

                <div>
                  <strong>Prepaid — Pay Online</strong>
                  <p>Pay the full order amount online.</p>
                </div>
              </label>

              <label className={`payment-option ${paymentMethod === "COD" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                />

                <div>
                  <strong>COD — ₹50 advance</strong>
                  <p>Pay ₹50 now. Remaining amount at delivery.</p>
                </div>
              </label>
            </div>

            <button
              className="place-order-btn"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "PROCESSING..."
                : paymentMethod === "COD"
                  ? "PAY ₹50 & PLACE COD ORDER"
                  : "PAY & PLACE ORDER"}
            </button>

            <button
              type="button"
              className="back-btn"
              onClick={() =>
                setPage("cart")
              }
            >
              ← BACK TO CART
            </button>
          </form>

          <div className="checkout-summary">
            <h2>YOUR ORDER</h2>

            {cart.map((item) => (
              <div
                className="checkout-item"
                key={item.id}
              >
                <div>
                  <strong>
                    {item.name}
                  </strong>

                  <p>
                    Size: {item.size} ×{" "}
                    {item.quantity}
                  </p>
                </div>

                <strong>
                  ₹
                  {(
                    Number(
                      item.price
                    ) *
                    Number(
                      item.quantity
                    )
                  ).toLocaleString(
                    "en-IN"
                  )}
                </strong>
              </div>
            ))}

            <div className="summary-line">
              <span>Subtotal</span>

              <strong>
                ₹
                {subtotal.toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            {discount > 0 && (
              <div className="summary-line discount-line">
                <span>Discount</span>

                <strong>
                  -₹
                  {discount.toLocaleString(
                    "en-IN"
                  )}
                </strong>
              </div>
            )}

            {codFee > 0 && (
              <div className="summary-line">
                <span>COD Fee</span>
                <strong>₹{codFee.toLocaleString("en-IN")}</strong>
              </div>
            )}

            <div className="summary-total">
              <span>Total</span>

              <strong>
                ₹
                {finalTotal.toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            <div className="cod-summary">
              <strong>
                {paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid — Pay Online"}
              </strong>

              <span>
                {paymentMethod === "COD"
                  ? `Pay ₹${COD_FEE.toLocaleString("en-IN")} now. Remaining ₹${Math.max(finalTotal - COD_FEE, 0).toLocaleString("en-IN")} at delivery.`
                  : "Pay the full order amount securely online."}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // -----------------------------
  // TRACK ORDER PAGE
  // -----------------------------
  function TrackOrderPage() {
    const currentStatus =
      trackedOrder?.order_status || "NEW";

    const currentIndex =
      getTrackingStatusIndex(currentStatus);

    const items = Array.isArray(
      trackedOrder?.items
    )
      ? trackedOrder.items
      : [];

    return (
      <section className="track-page">
        <div className="page-title">
          <p>SK STORE</p>
          <h1>TRACK ORDER</h1>
        </div>

        <div className="track-layout">
          <form
            className="track-form"
            onSubmit={trackOrder}
          >
            <h2>FIND YOUR ORDER</h2>

            <p>
              Enter your Order Number and
              the mobile number used while
              placing the order.
            </p>

            <label>Order Number *</label>

            <input
              type="text"
              placeholder="Example: SK12345678"
              value={
                trackingForm.order_number
              }
              onChange={(e) =>
                setTrackingForm({
                  ...trackingForm,
                  order_number:
                    e.target.value.toUpperCase(),
                })
              }
            />

            <label>
              Mobile Number *
            </label>

            <input
              type="tel"
              maxLength="10"
              placeholder="10-digit mobile number"
              value={
                trackingForm.phone
              }
              onChange={(e) =>
                setTrackingForm({
                  ...trackingForm,
                  phone: e.target.value,
                })
              }
            />

            <button
              className="dark-btn"
              type="submit"
              disabled={trackingLoading}
            >
              {trackingLoading
                ? "CHECKING..."
                : "TRACK ORDER"}
            </button>
          </form>

          {trackedOrder && (
            <div className="tracking-result">
              <div className="tracking-result-header">
                <div>
                  <p>ORDER NUMBER</p>

                  <h2>
                    {
                      trackedOrder.order_number
                    }
                  </h2>
                </div>

                <span
                  className={`order-status status-${currentStatus.toLowerCase()}`}
                >
                  {currentStatus}
                </span>
              </div>

              {currentStatus ===
                "CANCELLED" ? (
                <div className="cancelled-order">
                  <h3>
                    ORDER CANCELLED
                  </h3>

                  <p>
                    This order has been
                    cancelled.
                  </p>
                </div>
              ) : (
                <div className="tracking-timeline">
                  {trackingStatuses.map(
                    (status, index) => {
                      const completed =
                        currentIndex >=
                        index;

                      const active =
                        currentIndex ===
                        index;

                      return (
                        <div
                          className={`tracking-step ${
                            completed
                              ? "completed"
                              : ""
                          } ${
                            active
                              ? "active"
                              : ""
                          }`}
                          key={status}
                        >
                          <div className="tracking-dot">
                            {completed
                              ? "✓"
                              : index + 1}
                          </div>

                          <div>
                            <strong>
                              {status}
                            </strong>

                            {status ===
                              "NEW" && (
                              <p>
                                Order
                                received
                              </p>
                            )}

                            {status ===
                              "CONFIRMED" && (
                              <p>
                                Order
                                confirmed
                              </p>
                            )}

                            {status ===
                              "PACKED" && (
                              <p>
                                Order
                                packed
                              </p>
                            )}

                            {status ===
                              "SHIPPED" && (
                              <p>
                                Order
                                handed to
                                courier
                              </p>
                            )}

                            {status ===
                              "DELIVERED" && (
                              <p>
                                Order
                                delivered
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              <div className="tracking-info-grid">
                <div className="tracking-info-box">
                  <span>CUSTOMER</span>

                  <strong>
                    {
                      trackedOrder.customer_name
                    }
                  </strong>
                </div>

                <div className="tracking-info-box">
                  <span>ORDER TOTAL</span>

                  <strong>
                    ₹
                    {Number(
                      trackedOrder.total
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </strong>
                </div>

                <div className="tracking-info-box">
                  <span>PAYMENT</span>

                  <strong>
                    {
                      trackedOrder.payment_method
                    }
                  </strong>

                  <small>
                    {
                      trackedOrder.payment_status
                    }
                  </small>
                </div>

                <div className="tracking-info-box">
                  <span>ORDER DATE</span>

                  <strong>
                    {new Date(
                      trackedOrder.created_at
                    ).toLocaleDateString(
                      "en-IN"
                    )}
                  </strong>
                </div>
              </div>

              {(trackedOrder.courier_name ||
                trackedOrder.tracking_number) && (
                <div className="tracking-shipping-box">
                  <h3>
                    SHIPPING DETAILS
                  </h3>

                  {trackedOrder.courier_name && (
                    <p>
                      <strong>
                        Courier:
                      </strong>{" "}
                      {
                        trackedOrder.courier_name
                      }
                    </p>
                  )}

                  {trackedOrder.tracking_number && (
                    <p>
                      <strong>
                        AWB / Tracking:
                      </strong>{" "}
                      {
                        trackedOrder.tracking_number
                      }
                    </p>
                  )}

                  {trackedOrder.shipped_at && (
                    <p>
                      <strong>
                        Shipped:
                      </strong>{" "}
                      {new Date(
                        trackedOrder.shipped_at
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="tracking-products-box">
                <h3>
                  ORDER ITEMS
                </h3>

                {items.length === 0 ? (
                  <p>
                    No items found.
                  </p>
                ) : (
                  <div className="tracking-products">
                    {items.map(
                      (item, index) => (
                        <div
                          className="tracking-product-row"
                          key={index}
                        >
                          <div>
                            <strong>
                              {
                                item.product_name
                              }
                            </strong>

                            <p>
                              Article:{" "}
                              {
                                item.article_code
                              }
                            </p>

                            <p>
                              Size:{" "}
                              {item.size ||
                                "—"}{" "}
                              | Colour:{" "}
                              {item.color ||
                                "—"}
                            </p>
                          </div>

                          <div>
                            <p>
                              Qty:{" "}
                              {
                                item.quantity
                              }
                            </p>

                            <strong>
                              ₹
                              {Number(
                                item.price
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </strong>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // -----------------------------
  // ACCOUNT
  // -----------------------------
  function AccountPage() {
    if (logged) {
      return (
        <section className="account-page">
          <div className="account-box">
            <h1>ACCOUNT</h1>

            <p>Logged in as:</p>

            <strong>
              {userEmail}
            </strong>

            <div className="account-buttons">
              <button
                className="dark-btn"
                onClick={() => {
                  setPage("admin");
                  setAdminTab(
                    "products"
                  );
                }}
              >
                ADMIN PANEL
              </button>

              <button
                className="outline-btn"
                onClick={
                  handleLogout
                }
              >
                LOGOUT
              </button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="account-page">
        <form
          className="login-box"
          onSubmit={handleLogin}
        >
          <h1>ADMIN LOGIN</h1>

          <input
            type="email"
            placeholder="Email"
            value={
              loginForm.email
            }
            onChange={(e) =>
              setLoginForm({
                ...loginForm,
                email: e.target.value,
              })
            }
          />

          <input
            type="password"
            placeholder="Password"
            value={
              loginForm.password
            }
            onChange={(e) =>
              setLoginForm({
                ...loginForm,
                password:
                  e.target.value,
              })
            }
          />

          <button
            className="dark-btn"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "LOGGING IN..."
              : "LOGIN"}
          </button>
        </form>
      </section>
    );
  }

  // -----------------------------
  // ADMIN ORDERS
  // -----------------------------
  function OrdersPanel() {
    if (selectedOrder) {
      return (
        <div className="admin-orders">
          <button
            className="back-btn"
            onClick={() =>
              setSelectedOrder(null)
            }
          >
            ← BACK TO ORDERS
          </button>

          <div className="order-detail-header">
            <div>
              <p>ORDER</p>

              <h2>
                {
                  selectedOrder.order_number
                }
              </h2>
            </div>

            <select
              value={
                selectedOrder.order_status ||
                "NEW"
              }
              onChange={(e) =>
                updateOrderStatus(
                  e.target.value
                )
              }
              disabled={loading}
            >
              <option value="NEW">
                NEW
              </option>

              <option value="CONFIRMED">
                CONFIRMED
              </option>

              <option value="PACKED">
                PACKED
              </option>

              <option value="SHIPPED">
                SHIPPED
              </option>

              <option value="DELIVERED">
                DELIVERED
              </option>

              <option value="CANCELLED">
                CANCELLED
              </option>
            </select>
          </div>

          <div className="order-detail-grid">
            <div className="order-info-box">
              <h3>CUSTOMER DETAILS</h3>

              <p>
                <strong>Name:</strong>{" "}
                {
                  selectedOrder.customer_name
                }
              </p>

              <p>
                <strong>Phone:</strong>{" "}
                {selectedOrder.phone}
              </p>

              <p>
                <strong>Address:</strong>{" "}
                {selectedOrder.address}
              </p>

              <p>
                <strong>City:</strong>{" "}
                {selectedOrder.city}
              </p>

              <p>
                <strong>State:</strong>{" "}
                {selectedOrder.state}
              </p>

              <p>
                <strong>Pincode:</strong>{" "}
                {
                  selectedOrder.pincode
                }
              </p>
            </div>

            <div className="order-info-box">
              <h3>PAYMENT</h3>

              <p>
                <strong>
                  Method:
                </strong>{" "}
                {
                  selectedOrder.payment_method
                }
              </p>

              <p>
                <strong>
                  Payment Status:
                </strong>{" "}
                {
                  selectedOrder.payment_status
                }
              </p>

              <p>
                <strong>
                  Subtotal:
                </strong>{" "}
                ₹
                {Number(
                  selectedOrder.subtotal
                ).toLocaleString(
                  "en-IN"
                )}
              </p>

              <p>
                <strong>
                  Discount:
                </strong>{" "}
                ₹
                {Number(
                  selectedOrder.discount
                ).toLocaleString(
                  "en-IN"
                )}
              </p>

              <p>
                <strong>
                  Total:
                </strong>{" "}
                ₹
                {Number(
                  selectedOrder.total
                ).toLocaleString(
                  "en-IN"
                )}
              </p>
            </div>
          </div>

          <div className="order-info-box">
            <h3>PRODUCTS</h3>

            {orderItems.length === 0 ? (
              <p>
                No products found.
              </p>
            ) : (
              <div className="order-products">
                {orderItems.map(
                  (item) => (
                    <div
                      className="order-product-row"
                      key={item.id}
                    >
                      <div>
                        <strong>
                          {
                            item.product_name
                          }
                        </strong>

                        <p>
                          Article:{" "}
                          {
                            item.article_code
                          }
                        </p>

                        <p>
                          Size:{" "}
                          {item.size ||
                            "—"}{" "}
                          | Colour:{" "}
                          {item.color ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <p>
                          Qty:{" "}
                          {
                            item.quantity
                          }
                        </p>

                        <strong>
                          ₹
                          {Number(
                            item.price
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </strong>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="packing-box">
            <h3>
              PACKING / SHIPPING DETAILS
            </h3>

            <label>
              Courier Name
            </label>

            <input
              type="text"
              placeholder="Example: Delhivery / XpressBees / NimbusPost"
              value={
                packingForm.courier_name
              }
              onChange={(e) =>
                setPackingForm({
                  ...packingForm,
                  courier_name:
                    e.target.value,
                })
              }
            />

            <label>
              AWB / Tracking Number
            </label>

            <input
              type="text"
              placeholder="Enter AWB / Tracking number"
              value={
                packingForm.tracking_number
              }
              onChange={(e) =>
                setPackingForm({
                  ...packingForm,
                  tracking_number:
                    e.target.value,
                })
              }
            />

            <label>
              Package Weight (KG)
            </label>

            <input
              type="number"
              step="0.01"
              placeholder="1.20"
              value={
                packingForm.package_weight
              }
              onChange={(e) =>
                setPackingForm({
                  ...packingForm,
                  package_weight:
                    e.target.value,
                })
              }
            />

            <div className="checkout-two-column">
              <div>
                <label>
                  Length (CM)
                </label>

                <input
                  type="number"
                  step="0.1"
                  placeholder="15"
                  value={
                    packingForm.package_length
                  }
                  onChange={(e) =>
                    setPackingForm({
                      ...packingForm,
                      package_length:
                        e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label>
                  Width (CM)
                </label>

                <input
                  type="number"
                  step="0.1"
                  placeholder="12"
                  value={
                    packingForm.package_width
                  }
                  onChange={(e) =>
                    setPackingForm({
                      ...packingForm,
                      package_width:
                        e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <label>
              Height (CM)
            </label>

            <input
              type="number"
              step="0.1"
              placeholder="3"
              value={
                packingForm.package_height
              }
              onChange={(e) =>
                setPackingForm({
                  ...packingForm,
                  package_height:
                    e.target.value,
                })
              }
            />

            <label>
              Packing Note
            </label>

            <textarea
              rows="4"
              placeholder="Example: Checked item, packed in polybag, invoice added."
              value={
                packingForm.packing_note
              }
              onChange={(e) =>
                setPackingForm({
                  ...packingForm,
                  packing_note:
                    e.target.value,
                })
              }
            />

            <button
              className="dark-btn"
              onClick={
                saveOrderDetails
              }
              disabled={loading}
            >
              {loading
                ? "SAVING..."
                : "SAVE PACKING DETAILS"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="admin-orders">
        <div className="orders-heading">
          <div>
            <p>SK STORE</p>
            <h2>CUSTOMER ORDERS</h2>
          </div>

          <button
            className="dark-btn"
            onClick={
              loadOrders
            }
          >
            REFRESH
          </button>
        </div>

        {ordersLoading ? (
          <div className="empty-result">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-result">
            No orders found.
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div
                className="admin-order-card"
                key={order.id}
                onClick={() =>
                  openOrder(order)
                }
              >
                <div>
                  <p className="order-card-label">
                    ORDER
                  </p>

                  <h3>
                    {
                      order.order_number
                    }
                  </h3>

                  <p>
                    {
                      order.customer_name
                    }
                  </p>

                  <p>
                    {order.phone}
                  </p>
                </div>

                <div>
                  <p>
                    {order.city},{" "}
                    {order.state}
                  </p>

                  <p>
                    ₹
                    {Number(
                      order.total
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </p>

                  <span
                    className={`order-status status-${(
                      order.order_status ||
                      "NEW"
                    ).toLowerCase()}`}
                  >
                    {
                      order.order_status
                    }
                  </span>
                </div>

                <div>
                  <p>
                    {new Date(
                      order.created_at
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </p>

                  <button
                    className="outline-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrder(order);
                    }}
                  >
                    VIEW ORDER
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -----------------------------
  // ADMIN
  // -----------------------------
  function AdminPage() {
    if (!logged) {
      return AccountPage();
    }

    return (
      <section className="admin-page">
        <div className="page-title">
          <p>SK STORE</p>
          <h1>ADMIN PANEL</h1>
        </div>

        <div className="admin-tabs">
          <button
            className={
              adminTab === "products"
                ? "admin-tab active"
                : "admin-tab"
            }
            onClick={() =>
              setAdminTab(
                "products"
              )
            }
          >
            ADD PRODUCT
          </button>

          <button
            className={
              adminTab === "orders"
                ? "admin-tab active"
                : "admin-tab"
            }
            onClick={() => {
              setAdminTab("orders");
              loadOrders();
            }}
          >
            ORDERS
          </button>
        </div>

        {adminTab === "orders" ? (
          OrdersPanel()
        ) : (
          <form
            className="admin-form"
            onSubmit={
              handleAddProduct
            }
          >
            <h2>ADD PRODUCT</h2>

            <label>
              Product Name *
            </label>

            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Product name"
            />

            <label>
              Article Code *
            </label>

            <input
              type="text"
              value={
                form.article
              }
              onChange={(e) =>
                setForm((prev) => ({ ...prev, article: e.target.value }))
              }
              placeholder="Article code"
            />

            <label>
              Description
            </label>

            <textarea
              rows="4"
              value={
                form.description
              }
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Product description"
            />

            <label>
              Size
            </label>

            <input
              type="text"
              value={form.size}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, size: e.target.value }))
              }
              placeholder="40"
            />

            <label>
              Colour
            </label>

            <input
              type="text"
              value={form.color}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, color: e.target.value }))
              }
              placeholder="Black"
            />

            <label>
              Price *
            </label>

            <input
              type="number"
              value={
                form.price
              }
              onChange={(e) =>
                setForm((prev) => ({ ...prev, price: e.target.value }))
              }
              placeholder="599"
            />

            <label>
              Stock *
            </label>

            <input
              type="number"
              min="1"
              max="1"
              value="1"
              readOnly
              title="SK STORE keeps one piece per article"
            />

            <small style={{ color: "#777", display: "block", marginTop: "4px" }}>
              Single-piece article: stock is automatically set to 1.
            </small>

            <label>
              Category *
            </label>

            <input
              type="text"
              value={
                form.category
              }
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
              placeholder="Dresses / Tops / Western Wear"
            />

            <label>
              Product Photo
            </label>

            <input
              ref={imageInputRef}
              id="product-image-upload"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                if (!file.type.startsWith("image/")) {
                  alert("Please select an image file.");
                  e.target.value = "";
                  return;
                }

                if (file.size > 10 * 1024 * 1024) {
                  alert("Image must be smaller than 10 MB.");
                  e.target.value = "";
                  return;
                }

                setForm((prev) => ({
                  ...prev,
                  imageFile: file,
                }));
                setSelectedImageName(file.name);

                if (imagePreview) URL.revokeObjectURL(imagePreview);
                setImagePreview(URL.createObjectURL(file));
              }}
            />

            <button
              type="button"
              className="dark-btn"
              onClick={() => imageInputRef.current?.click()}
            >
              {selectedImageName ? "CHANGE PHOTO" : "CHOOSE PRODUCT PHOTO"}
            </button>

            {selectedImageName && (
              <div style={{ marginTop: "12px" }}>
                <strong>Selected:</strong> {selectedImageName}
              </div>
            )}

            {imagePreview && (
              <div style={{ marginTop: "15px", width: "180px", height: "220px", overflow: "hidden", border: "1px solid #ddd", borderRadius: "6px" }}>
                <img
                  src={imagePreview}
                  alt="Product preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}

            <button
              className="dark-btn"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "SAVING..."
                : "ADD PRODUCT"}
            </button>
          </form>
        )}
      </section>
    );
  }

  // -----------------------------
  // CREATOR CLUB
  // -----------------------------
  function CreatorPage() {
    return (
      <section className="creator-page">
        <div className="creator-box">
          <p>SK STORE</p>

          <h1>
            CREATOR
            <br />
            CLUB
          </h1>

          <p>
            Create. Share. Earn.
          </p>

          <button
            className="dark-btn"
            onClick={() =>
              window.open(
                "https://www.instagram.com/sk_surplusstore/",
                "_blank"
              )
            }
          >
            JOIN CREATOR CLUB
          </button>
        </div>
      </section>
    );
  }

  // -----------------------------
  // ROUTER
  // -----------------------------
  function renderPage() {
    if (page === "home") return HomePage();
    if (page === "shop") return ShopPage();
    if (page === "product") return ProductPage();
    if (page === "cart") return CartPage();
    if (page === "checkout") return CheckoutPage();
    if (page === "track") return TrackOrderPage();
    if (page === "account") return AccountPage();
    if (page === "admin") return AdminPage();
    if (page === "creator") return CreatorPage();
    return HomePage();
  }

  return (
    <>
      <Header />

      <main>
        {renderPage()}
      </main>

      <footer className="footer">
        <div>
          <h2>SK STORE</h2>

          <p>
            Fashion. Style.
            Confidence.
          </p>
        </div>

        <div>
          <p>
            ©{" "}
            {new Date().getFullYear()}{" "}
            SK STORE
          </p>
        </div>
      </footer>
    </>
  );
}

createRoot(
  document.getElementById("root")
).render(
  <App />
);