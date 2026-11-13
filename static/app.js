const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const icons = {
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  left: '<path d="m14 5-7 7 7 7"/>',
  right: '<path d="m10 5 7 7-7 7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  home: '<path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/>',
  chat: '<path d="M21 11a9 9 0 0 1-13 8l-5 2 1-6a9 9 0 1 1 17-4Z"/><path d="M8 8c1 4 2 5 6 6l2-2M8 8l2-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield:
    '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>',
};
const icon = (n) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.spark}</svg>`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const naira = (n) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: n % 100 ? 2 : 0,
  }).format(n / 100);
function storedJSON(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const restoredCart = storedJSON(localStorage, "lola-cart", []);
let state = {
  products: [],
  categories: [],
  session: {},
  cart: Array.isArray(restoredCart)
    ? restoredCart.filter(
        (i) =>
          i &&
          typeof i.product_id === "string" &&
          typeof i.variant_id === "string" &&
          Number.isInteger(i.qty) &&
          i.qty > 0 &&
          Number.isInteger(i.price) &&
          i.price >= 0,
      )
    : [],
  category: "All",
  query: "",
  sort: "curated",
  slide: 0,
};
let carouselTimer;
let carouselPaused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let checkoutBusy = false,
  renderVersion = 0;
const saveCart = () => {
  localStorage.setItem("lola-cart", JSON.stringify(state.cart));
  sessionStorage.removeItem("lola-checkout-key");
};
const count = () => state.cart.reduce((a, i) => a + i.qty, 0);
const path = () => location.pathname;
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => ($("#toast").style.display = "none"),
    3500,
  );
}
async function api(url, body) {
  let res = await fetch("/api/" + url, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body instanceof FormData
        ? { "X-CSRF-Token": state.session.csrf }
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": state.session.csrf,
          },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw Error("Could not load the boutique. Please try again.");
  }
  if (!res.ok) {
    const e = Error(data.error || "Please try again.");
    e.data = data;
    e.status = res.status;
    throw e;
  }
  return data;
}
function go(url) {
  history.pushState({}, "", url);
  window.scrollTo(0, 0);
  render();
}
document.addEventListener("click", (e) => {
  let a = e.target.closest("a[data-link]");
  if (a && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    go(a.getAttribute("href"));
  }
});
window.onpopstate = () => render();
function shell(body, active = "shop") {
  return `<div class="topbar">A LITTLE LUXURY, EVERY DAY. &nbsp; MADE FOR YOUR MOMENTS.</div><header class="header"><div class="header-inner"><a data-link href="/" class="wordmark">Lola’s Luxe<i> .</i><span class="brand-sub">THE CURATED BOUTIQUE</span></a><nav class="desktop-nav" aria-label="Shop"><a data-link href="/" class="${active === "shop" ? "active" : ""}">The boutique</a><a data-link href="/category/Bags">Bags</a><a data-link href="/category/Shoes">Shoes</a><a data-link href="/category/Basic%20Tops">Tops</a><a data-link href="/categories">All categories</a></nav><div class="header-actions"><a data-link href="/search" class="icon-btn" aria-label="Search products">${icon("search")}</a><a data-link href="/cart" class="icon-btn" aria-label="Your bag, ${count()} items">${icon("bag")}${count() ? `<span class="count">${count()}</span>` : ""}</a></div></div></header><main class="content">${body}</main><footer class="footer"><div class="content"><div class="footer-top"><div><a data-link href="/" class="wordmark">Lola’s Luxe<i> .</i></a><p>Thoughtfully chosen. Beautifully you.<br>Your little corner of everyday luxury.</p></div><div class="footer-links"><a data-link href="/category/Bags">Shop the edit</a><a href="https://wa.me/2347071181050" target="_blank" rel="noopener">Chat on WhatsApp ↗</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Lola’s Luxe. All rights reserved.</span><span>Curated with love in Nigeria &nbsp; · &nbsp; ₦ NGN</span></div></div></footer><nav class="mobile-nav" aria-label="Main navigation">${[
    ["home", "Boutique", "/", "shop"],
    ["grid", "Categories", "/categories", "categories"],
    ["bag", `Bag${count() ? " (" + count() + ")" : ""}`, "/cart", "cart"],
  ]
    .map(
      ([i, t, h, a]) =>
        `<a data-link href="${h}" class="${a === active ? "active" : ""}">${icon(i)}${t}</a>`,
    )
    .join("")}</nav>`;
}
const heading = (t, sub = "") =>
  `<div class="page-heading"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
function cards(ps) {
  return ps.length
    ? `<div class="grid">${ps.map((p, i) => `<article class="product"><a data-link class="product-image" href="/product/${p.id}"><img src="${esc(p.images[0].startsWith("/static/images/") ? p.images[0] + "?v=2" : p.images[0])}" alt="${esc(p.name)}" ${i > 3 ? 'loading="lazy"' : ""} width="360" height="480"><span class="badge">${p.sample ? "Preview sample" : p.variants.every((v) => v.available === 0) ? "Sold out" : "The luxe edit"}</span></a><div class="product-info"><div class="product-category">${esc(p.category)}</div><a data-link class="product-name" href="/product/${p.id}">${esc(p.name)}</a><span class="price">${naira(p.price)}</span><a data-link href="/product/${p.id}" class="quick-add icon-btn" aria-label="Choose options for ${esc(p.name)}">${icon("plus")}</a></div></article>`).join("")}</div>`
    : `<div class="empty"><h2>${state.query ? "No pieces found" : "A new edit is on its way"}</h2><p>${state.query ? "Try another search or explore a different category." : "Check back soon for something lovely."}</p><a class="btn secondary" data-link href="/">Explore the boutique</a></div>`;
}
const slides = [
  {
    category: "Bottoms",
    tag: "THE EVERYDAY MUSE",
    title: "Effortless style.<br><em>Beautifully you.</em>",
    desc: "Beautiful pieces for wherever life takes you. Meet your next wardrobe favourites.",
    image: "hero-editorial",
  },
  {
    category: "Shoes",
    tag: "YOUR NEXT GREAT STEP",
    title: "Little details.<br><em>Lasting impressions.</em>",
    desc: "From slow mornings to special evenings. Discover shoes that finish the story.",
    image: "shoes",
  },
  {
    category: "Bags",
    tag: "CARRY SOMETHING LOVELY",
    title: "Everyday moments.<br><em>A little more luxe.</em>",
    desc: "The perfect companion to your favourite outfit. Explore our carefully chosen bags.",
    image: "bag",
  },
];
function hero() {
  let s = slides[state.slide];
  return `<div class="hero-heading"><span class="eyebrow">THE CURATED EDIT / ${String(state.slide + 1).padStart(2, "0")}</span><span class="tiny">Considered pieces. Endless possibilities.</span></div><section class="hero" aria-label="Featured collection"><div class="hero-copy"><span class="eyebrow">${s.tag}</span><h1>${s.title}</h1><p>${s.desc}</p><a data-link class="btn" href="/category/${encodeURIComponent(s.category)}">Shop ${s.category.toLowerCase()} ${icon("arrow")}</a></div><img class="hero-photo ${["bag", "shoes"].includes(s.image) ? "hero-accessory" : ""}" src="/static/images/${s.image}.webp?v=2" alt="${s.image === "hero-editorial" ? "A woman wearing softly pleated blush trousers" : s.category + " collection preview"}"></section><div class="hero-bottom"><button class="carousel-pause" data-carousel-pause aria-label="${carouselPaused ? 'Start automatic slideshow' : 'Pause automatic slideshow'}">${carouselPaused ? "Play" : "Pause"}</button><div class="dots">${slides.map((s, i) => `<button data-slide="${i}" class="${state.slide === i ? "active" : ""}" aria-label="Show Shop ${s.category}" aria-pressed="${state.slide === i}"></button>`).join("")}</div><div><span class="tiny">A wardrobe, thoughtfully curated.</span><button class="carousel-control" data-slide="${(state.slide + slides.length - 1) % slides.length}" aria-label="Previous collection">${icon("left")}</button><button class="carousel-control" data-slide="${(state.slide + 1) % slides.length}" aria-label="Next collection">${icon("right")}</button></div></div>`;
}
function catalogueProducts() {
  let ps = state.products.filter(
    (p) =>
      (state.category === "All" || p.category === state.category) &&
      (!state.query ||
        (p.name + " " + p.category + " " + p.description)
          .toLowerCase()
          .includes(state.query.toLowerCase())),
  );
  if (state.sort === "low") ps.sort((a, b) => a.price - b.price);
  if (state.sort === "high") ps.sort((a, b) => b.price - a.price);
  return ps;
}
function catalogue(category = "All", search = false) {
  state.category = category;
  const ps = catalogueProducts();
  const home = !search && path() === "/";
  return shell(
    `${home ? `<div id="hero">${hero()}</div><div class="benefits"><span>${icon("spark")} Thoughtfully curated pieces</span><span>${icon("chat")} Personal WhatsApp checkout</span><span>${icon("shield")} A little luxury, made personal</span></div>` : heading(search ? "Find your next favourite" : esc(category), search ? "A little something you’ll love." : category === "Bottoms" ? "Joggers, capri pants, trousers and more." : "Your wardrobe’s next chapter starts here.")} ${search ? `<div class="searchbox">${icon("search")}<input id="search" type="search" aria-label="Search products" placeholder="Search bags, shoes, clothing…" value="${esc(state.query)}"><button id="clear-search" aria-label="Clear search">${icon("close")}</button></div>` : ""}<section id="edit"><div class="section-heading"><div><span class="eyebrow">CHOSEN WITH YOU IN MIND</span><h2>${home ? "Your next favourites" : search ? "The search edit" : esc(category) + " edit"}</h2><p id="result-count" aria-live="polite">${ps.length} ${ps.length === 1 ? "piece" : "pieces"} to make your own</p></div>${state.session.preview ? '<span class="sample-notice">Preview catalogue</span>' : ""}</div><div class="filters"><div class="chips" aria-label="Product category">${["All", ...state.categories].map((c) => `<button class="chip ${c === category ? "active" : ""}" data-category="${esc(c)}" aria-pressed="${c === category}">${esc(c)}</button>`).join("")}</div><select id="sort" class="sort" aria-label="Sort products"><option value="curated">Curated for you</option><option value="low" ${state.sort === "low" ? "selected" : ""}>Price: low to high</option><option value="high" ${state.sort === "high" ? "selected" : ""}>Price: high to low</option></select></div><div id="product-grid">${cards(ps)}</div></section><section class="story"><div><div class="eyebrow">A PERSONAL TOUCH</div><h2>Your style. Your pace.</h2><p>Ask us on WhatsApp about paying in instalments.<br>Oluwadamilola is here to help you find your perfect piece.</p></div><a class="btn secondary" href="https://wa.me/2347071181050" target="_blank" rel="noopener">${icon("chat")} Let’s chat</a></section>`,
    category === "All" ? "shop" : "categories",
  );
}
function bindCatalogue() {
  let h = $("#hero");
  if (h) {
    const show = (index) => {
      state.slide = (index + slides.length) % slides.length;
      const focused = document.activeElement;
      const selector = focused?.matches("[data-slide]") ? `[data-slide="${focused.dataset.slide}"]` : focused?.matches("[data-carousel-pause]") ? "[data-carousel-pause]" : null;
      h.innerHTML = hero();
      if (selector) h.querySelector(selector)?.focus({preventScroll: true});
    };
    const schedule = () => {
      clearInterval(carouselTimer);
      carouselTimer = setInterval(() => {
        if (!carouselPaused && !document.hidden && !h.contains(document.activeElement) && !(matchMedia("(hover: hover)").matches && h.matches(":hover"))) show(state.slide + 1);
      }, 5000);
    };
    h.onclick = (e) => {
      if (e.target.closest("[data-carousel-pause]")) {
        carouselPaused = !carouselPaused;
        show(state.slide);
        schedule();
      }
      const button = e.target.closest("[data-slide]");
      if (button) { show(+button.dataset.slide); schedule(); }
    };
    let start;
    h.ontouchstart = (e) => (start = e.touches[0].clientX);
    h.ontouchend = (e) => {
      const diff = e.changedTouches[0].clientX - start;
      if (Math.abs(diff) > 40) { show(state.slide + (diff < 0 ? 1 : -1)); schedule(); }
    };
    schedule();
  }
  $$("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        state.category = b.dataset.category;
        if (path().startsWith("/category/")) {
          go(
            state.category === "All"
              ? "/"
              : "/category/" + encodeURIComponent(state.category),
          );
          return;
        }
        let pos = scrollY;
        $("#app").innerHTML = catalogue(state.category, path() === "/search");
        bindCatalogue();
        window.scrollTo(0, pos);
      }),
  );
  if ($("#sort"))
    $("#sort").onchange = (e) => {
      state.sort = e.target.value;
      let pos = scrollY;
      $("#app").innerHTML = catalogue(state.category, path() === "/search");
      bindCatalogue();
      window.scrollTo(0, pos);
    };
  if ($("#search")) {
    $("#search").oninput = (e) => {
      state.query = e.target.value;
      const ps = catalogueProducts();
      $("#result-count").textContent =
        `${ps.length} ${ps.length === 1 ? "piece" : "pieces"} to make your own`;
      $("#product-grid").innerHTML = cards(ps);
    };
    $("#clear-search").onclick = () => {
      state.query = "";
      $("#search").value = "";
      $("#search").dispatchEvent(new Event("input"));
      $("#search").focus();
    };
  }
}
function detail(p) {
  return shell(
    `<div class="breadcrumb"><a data-link href="/">Boutique</a> &nbsp; / &nbsp; <a data-link href="/category/${esc(p.category)}">${esc(p.category)}</a> &nbsp; / &nbsp; ${esc(p.name)}</div><div class="detail"><section><img class="gallery-main" id="main-photo" src="${esc(p.images[0].startsWith("/static/images/") ? p.images[0] + "?v=2" : p.images[0])}" alt="${esc(p.name)}"><div class="thumbs">${p.images.map((im, i) => `<button data-photo="${esc(im.startsWith("/static/images/") ? im + "?v=2" : im)}" aria-label="View photo ${i + 1}"><img src="${esc(im.startsWith("/static/images/") ? im + "?v=2" : im)}" alt=""></button>`).join("")}</div></section><section class="details-copy"><span class="eyebrow">${esc(p.category)} · THE LOLA’S LUXE EDIT</span><h1>${esc(p.name)}</h1><div class="price">${naira(p.price)}</div>${p.sample ? '<p class="sample-notice">Preview sample — not a live product</p>' : ""}<p class="description">${esc(p.description)}</p><label class="field">Choose size & colour<select id="variant" aria-label="Choose size and colour">${p.variants.map((v) => `<option value="${v.id}" ${v.available === 0 ? "disabled" : ""}>${esc(v.size || "One size")} / ${esc(v.colour || "Default")} ${v.available === 0 ? "— Unavailable" : ""}</option>`).join("")}</select></label><p id="availability" class="availability"></p><label class="field">Quantity<div class="qty"><button id="minus" aria-label="Reduce quantity">−</button><span id="qty">1</span><button id="plus" aria-label="Increase quantity">+</button></div></label><button class="btn full" id="add-cart" ${p.variants.every((v) => v.available < 1) ? "disabled" : ""}>${icon("bag")} Add to bag</button><p class="tiny">Product subtotal only. Any delivery fee is agreed on WhatsApp.</p><div class="note">Ask us on WhatsApp about paying in instalments.</div><div class="detail-perks"><details><summary>Pickup & delivery</summary><p>Pickup details are shared privately. For delivery, Oluwadamilola arranges a third-party rider or driver and confirms the fee with you on WhatsApp.</p></details><details><summary>Fit, fabric & care</summary><p>Need a closer look or help choosing a size? <a class="text-btn" href="https://wa.me/2347071181050" target="_blank" rel="noopener">Ask Oluwadamilola</a> before placing your order.</p></details></div></section></div>`,
  );
}
function bindDetail(p) {
  let qty = 1;
  const variant = () => p.variants.find((v) => v.id === $("#variant").value);
  const update = () => {
    let v = variant();
    $("#availability").textContent =
      v && v.available
        ? `${v.available} available in this combination`
        : "This combination is unavailable";
    $("#qty").textContent = qty;
  };
  if (p.variants.some((v) => v.available))
    $("#variant").value = p.variants.find((v) => v.available).id;
  update();
  $("#variant").onchange = () => {
    qty = 1;
    update();
  };
  $("#minus").onclick = () => {
    qty = Math.max(1, qty - 1);
    update();
  };
  $("#plus").onclick = () => {
    qty = Math.min(99, variant()?.available || 1, qty + 1);
    update();
  };
  $$("[data-photo]").forEach(
    (b) => (b.onclick = () => ($("#main-photo").src = b.dataset.photo)),
  );
  $("#add-cart").onclick = () => {
    let v = variant();
    if (!v || !v.available) return;
    let line = state.cart.find(
      (i) => i.product_id === p.id && i.variant_id === v.id,
    );
    if ((line?.qty || 0) + qty > v.available) {
      toast("You already have the available quantity in your bag.");
      return;
    }
    if (line) line.qty += qty;
    else
      state.cart.push({
        product_id: p.id,
        variant_id: v.id,
        name: p.name,
        size: v.size,
        colour: v.colour,
        qty,
        price: p.price,
        image: p.images[0],
      });
    saveCart();
    $("#app").innerHTML = detail(p);
    bindDetail(p);
    toast("A lovely choice. Added to your bag.");
  };
}
let fulfilment = sessionStorage.getItem("lola-fulfilment") || "Pickup";
function cart() {
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  return shell(
    `${heading("Your bag", count() ? `${count()} thoughtfully chosen ${count() === 1 ? "piece" : "pieces"}. Ready when you are.` : "A little space for something lovely.")}${!count() ? `<div class="empty">${icon("bag")}<h2>Your next favourite is waiting</h2><p>Explore the edit and add a little luxe to your day.</p><a data-link href="/" class="btn">Explore the boutique ${icon("arrow")}</a></div>` : `<div id="cart-error"></div><div class="cart-layout"><div>${state.cart.map((i, index) => `<article class="cart-line"><a data-link href="/product/${i.product_id}"><img src="${esc(i.image)}" alt="${esc(i.name)}"></a><div class="cart-info"><h3>${esc(i.name)}</h3><p>${esc(i.colour)} · ${esc(i.size || "One size")}</p><span class="price">${naira(i.price)}</span><div class="qty"><button data-qty="${index}" data-delta="-1" aria-label="Reduce ${esc(i.name)} quantity">−</button><span>${i.qty}</span><button data-qty="${index}" data-delta="1" aria-label="Increase ${esc(i.name)} quantity">+</button></div></div><button class="icon-btn" data-remove="${index}" aria-label="Remove ${esc(i.name)}">${icon("trash")}</button></article>`).join("")}<p class="tiny">Every piece, checked again at checkout.</p><a data-link class="text-btn" href="/">← Continue discovering</a></div><aside><div class="panel"><h3>Order summary</h3><div class="row"><span>Product subtotal</span><span>${naira(total)}</span></div><div class="row"><span>Delivery fee</span><span>Agreed on WhatsApp</span></div><div class="total row"><span>Product subtotal</span><span>${naira(total)}</span></div><p class="tiny">Choose how you’d like to receive your order.</p><div class="fulfilment">${["Pickup", "Request delivery"].map((f) => `<label><input type="radio" name="fulfilment" value="${f}" ${fulfilment === f ? "checked" : ""}> ${f}</label>`).join("")}</div><p id="fulfilment-note" class="tiny">${fulfilment === "Pickup" ? "Pickup details are shared privately in WhatsApp." : "A third-party rider or driver handles delivery. Oluwadamilola confirms the fee on WhatsApp."}</p><button class="btn full" id="checkout">${icon("chat")} Checkout on WhatsApp</button><p class="tiny">Your order is a request until confirmed. Tap <strong>Send</strong> in WhatsApp to share it with Oluwadamilola.</p></div><div class="note">Ask us on WhatsApp about paying in instalments.</div></aside></div>`}`,
    "cart",
  );
}
function bindCart() {
  $$("[data-qty]").forEach(
    (b) =>
      (b.onclick = () => {
        let i = state.cart[+b.dataset.qty];
        i.qty = Math.max(1, Math.min(99, i.qty + +b.dataset.delta));
        saveCart();
        $("#app").innerHTML = cart();
        bindCart();
      }),
  );
  $$("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        state.cart.splice(+b.dataset.remove, 1);
        saveCart();
        $("#app").innerHTML = cart();
        bindCart();
      }),
  );
  $$("[name=fulfilment]").forEach(
    (r) =>
      (r.onchange = () => {
        fulfilment = r.value;
        sessionStorage.setItem("lola-fulfilment", fulfilment);
        sessionStorage.removeItem("lola-checkout-key");
        $("#fulfilment-note").textContent =
          fulfilment === "Pickup"
            ? "Pickup details are shared privately in WhatsApp."
            : "A third-party rider or driver handles delivery. Oluwadamilola confirms the fee on WhatsApp.";
      }),
  );
  if ($("#checkout"))
    $("#checkout").onclick = async () => {
      if (checkoutBusy) return;
      checkoutBusy = true;
      $("#checkout").disabled = true;
      $("#checkout").textContent = "Checking your pieces…";
      let key =
        sessionStorage.getItem("lola-checkout-key") || crypto.randomUUID();
      sessionStorage.setItem("lola-checkout-key", key);
      try {
        let handoff = await api("checkout", {
          key,
          items: state.cart.map(({ product_id, variant_id, qty, price }) => ({
            product_id,
            variant_id,
            qty,
            price,
          })),
          fulfilment,
        });
        sessionStorage.setItem("lola-handoff", JSON.stringify(handoff));
        state.cart = [];
        saveCart();
        go("/handoff");
        window.open(handoff.url, "_blank", "noopener");
      } catch (e) {
        if (e.data?.issues) {
          let issues = e.data.issues;
          $("#cart-error").innerHTML =
            `<div class="error"><strong>Let’s review your bag</strong><p>${issues.map((i) => `${esc(i.name)} — ${i.available ? `now ${naira(i.price)}, ${i.available} available` : "unavailable"}`).join("<br>")}</p><button class="btn small secondary" id="review-cart">Update cart for review</button></div>`;
          $("#review-cart").onclick = () => {
            for (let issue of issues) {
              let i = state.cart.find(
                (i) =>
                  i.product_id === issue.product_id &&
                  i.variant_id === issue.variant_id,
              );
              if (i) {
                i.qty = Math.min(i.qty, issue.available);
                i.price = issue.price;
              }
            }
            state.cart = state.cart.filter((i) => i.qty > 0);
            saveCart();
            $("#app").innerHTML = cart();
            bindCart();
            toast("Cart updated. Please review before checkout.");
          };
        } else toast(e.message);
        $("#checkout").disabled = false;
        $("#checkout").innerHTML = icon("chat") + " Checkout on WhatsApp";
      } finally {
        checkoutBusy = false;
      }
    };
}
function handoff() {
  let h = JSON.parse(sessionStorage.getItem("lola-handoff") || "null");
  if (!h)
    return shell(
      heading("No order request here yet") +
        '<a data-link class="btn" href="/cart">View your bag</a>',
      "cart",
    );
  return shell(
    `<section class="handoff"><div class="success-symbol">${icon("check")}</div><span class="eyebrow">YOUR NEXT STEP: WHATSAPP</span><h1>A little closer to lovely.</h1><p>Your order request <strong>${esc(h.reference)}</strong> is saved. Open WhatsApp and tap <strong>Send</strong> to share it with Oluwadamilola.</p><div class="note">Awaiting payment · This is an order request. Availability, payment details and any delivery fee are confirmed in WhatsApp.</div><pre>${esc(h.message)}</pre><a class="btn full" href="${esc(h.url)}" target="_blank" rel="noopener">${icon("chat")} Open WhatsApp again</a><button class="text-btn" id="copy-message">${icon("copy")} Copy order message</button><p class="tiny">If WhatsApp didn’t open, use the button above or copy the message and send it to +234 707 118 1050.</p><a data-link href="/" class="text-btn">Continue browsing</a></section>`,
    "cart",
  );
}
function adminTabs(tab) {
  const links = state.session.role === "superadmin" ? [["dashboard", "/admin", "Overview"], ["products", "/admin/products", "Products"], ["orders", "/admin/orders", "Orders"], ["team", "/admin/team", "Team"]] : [["products", "/admin/products", "Products"]];
  return `<nav class="admin-tabs">${links.map(([key, url, label]) => `<a data-link href="${url}" class="${tab === key ? "active" : ""}">${label}</a>`).join("")}<button id="logout" class="text-btn">Sign out</button></nav>`;
}
function teamView(members, activity) {
  return adminShell(`<section class="panel"><h2>Your team</h2><p>You are the Super Admin. Product Admins can upload photos and save drafts. Only you can publish products and access orders or finances.</p><form id="invite-staff"><label class="field">Product Admin username<input name="username" required minlength="3" maxlength="60" pattern="[A-Za-z0-9._-]+" autocomplete="off"></label><button class="btn">Create invitation</button></form><div id="invite-result" role="status"></div></section><section class="panel"><h2>Product Admins</h2>${members.length ? members.map(m => `<div class="panel"><strong>${esc(m.username)}</strong><p>${m.active ? esc(m.status) : "Access revoked"}</p><button class="text-btn" data-staff-reset="${esc(m.id)}">${m.active ? "New invitation / reset password" : "Invite again"}</button>${m.active ? `<button class="text-btn" data-staff-revoke="${esc(m.id)}">Revoke access</button>` : ""}</div>`).join("") : "<p>No helpers invited yet.</p>"}</section><section class="panel"><h2>Recent product activity</h2>${activity.length ? activity.map(a => `<p><strong>${esc(a.actor)}</strong> · ${esc(a.action)} · ${esc(a.product_name || "Removed product")}<br><span class="tiny">${esc(new Date(a.created).toLocaleString())}</span></p>`).join("") : "<p>Product changes will appear here.</p>"}</section>`, "team");
}
function bindTeam() {
  const invitation = async (body, button) => {
    button.disabled = true;
    try {
      const result = await api("staff", body);
      await render();
      const url = location.origin + "/admin/activate#" + result.token;
      $("#invite-result").innerHTML = `<div class="note"><p>Share this private, single-use link with your helper. It expires in 24 hours. Their username is shown in the team list below.</p><label class="field">Invitation link<input readonly id="invite-link" value="${esc(url)}"></label><button class="text-btn" id="copy-invite">Copy invitation link</button></div>`;
      $("#copy-invite").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Invitation link copied."); } catch { $("#invite-link").select(); toast("Copy the selected link."); } };
    } catch (err) { toast(err.message); } finally { button.disabled = false; }
  };
  $("#invite-staff").onsubmit = e => { e.preventDefault(); invitation({username: new FormData(e.target).get("username")}, e.submitter); };
  $$("[data-staff-reset]").forEach(b => b.onclick = () => invitation({action:"reset", id:b.dataset.staffReset}, b));
  $$("[data-staff-revoke]").forEach(b => b.onclick = async () => { b.disabled = true; try { await api("staff", {action:"revoke", id:b.dataset.staffRevoke}); await render(); toast("Access revoked."); } catch (err) { toast(err.message); b.disabled = false; } });
}
function activationView() {
  const token = location.hash.slice(1);
  history.replaceState({}, "", "/admin/activate");
  $("#app").innerHTML = shell(`<form class="login panel" id="activate-staff"><h1>Join the boutique team</h1><p>Your invitation gives you Product Admin access. Choose your own password, then sign in with the username your Super Admin assigned.</p><div id="activation-error" role="alert"></div><label class="field">New password<input name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required></label><label class="field">Confirm password<input name="confirm" type="password" minlength="12" maxlength="200" autocomplete="new-password" required></label><button class="btn">Activate account</button></form>`);
  $("#activate-staff").onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true;
    const data = Object.fromEntries(new FormData(e.target));
    try {
      if (data.password !== data.confirm) throw Error("Passwords do not match.");
      await api("staff/activate", {token, password:data.password});
      go("/admin"); toast("Account activated. Sign in with your assigned username.");
    } catch(err) { $("#activation-error").textContent = err.message; } finally { b.disabled = false; }
  };
}
function adminShell(body, tab) {
  return shell(
    heading(
      "Your boutique, at a glance.",
      `${state.session.role === "superadmin" ? "Super Admin" : "Product Admin"} · ${esc(state.session.owner)}`,
    ) +
      adminTabs(tab) +
      body,
    "admin",
  );
}
function login() {
  return shell(
    `<form class="login panel" id="login"><span class="eyebrow">PRIVATE TEAM ACCESS</span><h1>Welcome back.</h1><p class="muted">Sign in to care for your boutique.</p><div id="login-error"></div><label class="field">Username<input name="username" autocomplete="username" required></label><label class="field">Password<input type="password" name="password" autocomplete="current-password" required></label><button class="btn full">Sign in securely ${icon("arrow")}</button><p class="tiny">Invitation-only access. Product Admins: ask your Super Admin for a password reset link. Store owner: contact your website administrator for account recovery.</p></form>`,
    "admin",
  );
}
function bindLogin() {
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    let b = e.submitter;
    b.disabled = true;
    try {
      let r = await api("login", Object.fromEntries(new FormData(e.target)));
      state.session = await api("session");
      go("/admin");
    } catch (err) {
      $("#login-error").innerHTML =
        `<div class="error">${esc(err.message)}</div>`;
    } finally {
      b.disabled = false;
    }
  };
}
function dashboard(d) {
  return adminShell(
    `<div class="section-heading"><div><span class="eyebrow">REAL RECORDS, CLEARER PICTURE</span><h2>Sales overview</h2></div></div><form id="date-filter" class="inline-fields"><label class="field">From<input type="date" name="start" value="${esc(new URLSearchParams(location.search).get("start") || "")}"></label><label class="field">To<input type="date" name="end" value="${esc(new URLSearchParams(location.search).get("end") || "")}"></label><button class="btn small">Apply dates</button></form><p class="tiny">Completed sales · Africa/Lagos time · Website checkout orders only</p><div class="metrics">${[
      ["Paid website orders", d.paid_orders, "Products fully paid"],
      ["Product sales", naira(d.product_sales), "Delivery fees excluded"],
      ["Items sold", d.items_sold, "Units on paid orders"],
      [
        "Best-selling product",
        d.bestseller?.name || "—",
        d.bestseller
          ? d.bestseller.units + " units sold"
          : "No completed sales yet",
      ],
      ["Published products", d.published, "Currently in your boutique"],
      [
        "Payments on open orders",
        naira(d.open_payments),
        "Current product receipts on active requests",
      ],
    ]
      .map(
        ([t, n, s]) =>
          `<div class="metric"><span>${t}</span><strong>${esc(n)}</strong><small>${s}</small></div>`,
      )
      .join(
        "",
      )}</div><div class="note">Product sales count once the product balance reaches zero. Payments on open orders are a separate current balance summary.${d.closed_receipts ? " Received on dismissed requests: " + naira(d.closed_receipts) + "; payment histories remain in the order book." : ""}${state.session.preview ? " Preview sample orders are included in this preview database." : ""}</div><div class="spacer"></div><a data-link href="/admin/products/new" class="btn">${icon("plus")} Publish something lovely</a>`,
    "dashboard",
  );
}
let allOrders = [],
  adminProducts = [],
  editingProduct = null,
  paymentKey = null;
const statusPill = (o) =>
  `<span class="pill ${o.status === "Paid" ? "paid" : ""}">${esc(o.status)}</span>`;
function orderList(os) {
  return os.length
    ? `<div class="admin-list">${os.map((o) => `<a data-link class="panel" href="/admin/order/${o.id}"><div class="grow"><h3>${o.id}</h3><span class="tiny">${new Date(o.created).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })} · ${o.items.reduce((n, i) => n + i.qty, 0)} items · ${o.fulfilment}</span>${o.overdue || o.follow_up ? '<p class="error">Follow up: ' + (o.overdue ? "overdue balance" : "third payment left a balance") + "</p>" : ""}</div><div><div class="price">${naira(o.total)}</div><p class="tiny">Balance ${naira(o.balance)}</p></div>${statusPill(o)}${icon("right")}</a>`).join("")}</div>`
    : '<div class="empty"><h2>No orders here yet</h2><p>Website checkout requests will appear here.</p></div>';
}
function ordersView() {
  return adminShell(
    `<div class="section-heading"><h2>Your order book</h2><span class="tiny">${allOrders.length} requests</span></div><div class="searchbox">${icon("search")}<input id="order-search" aria-label="Find order by reference" placeholder="Find an order by reference…"></div><select id="order-status" aria-label="Filter orders by status"><option>All statuses</option>${["Awaiting payment", "Part-paid", "Paid", "Dismissed"].map((s) => `<option>${s}</option>`).join("")}</select><div id="order-list">${orderList(allOrders)}</div>`,
    "orders",
  );
}
function adminProductList(ps) {
  return ps.length
    ? `<div class="admin-list">${ps.map((p) => `<a data-link class="panel" href="/admin/products/${p.id}"><img src="${esc(p.images[0].startsWith("/static/images/") ? p.images[0] + "?v=2" : p.images[0])}" alt=""><div class="grow"><h3>${esc(p.name)}</h3><span class="tiny">${esc(p.category)} · ${p.variants.reduce((s, v) => s + v.available, 0)} available${p.sample ? " · Preview sample" : ""}</span></div><span class="price">${naira(p.price)}</span><span class="pill">${p.published ? "Published" : "Draft"}</span>${icon("right")}</a>`).join("")}</div>`
    : '<div class="empty"><h2>Make room for something lovely</h2><p>Add your first product to begin.</p></div>';
}
function productsView() {
  return adminShell(
    `<div class="section-heading"><h2>Your collection</h2><a data-link class="btn small" href="/admin/products/new">${icon("plus")} Add product</a></div><div class="searchbox">${icon("search")}<input id="product-search" aria-label="Search owner products" placeholder="Search your products…"></div><div id="admin-product-list">${adminProductList(adminProducts)}</div><div class="panel"><h3>Categories</h3><p class="tiny">${state.categories.map(esc).join(" · ")}</p><form id="add-category" class="inline-fields"><label class="field">New category<input name="name" maxlength="40" required></label><button class="btn small secondary">Add category</button></form></div>`,
    "products",
  );
}
function variantRow(v = {}) {
  return `<div class="variant-row" data-id="${esc(v.id || "")}"><input aria-label="Size" placeholder="Size / One size" value="${esc(v.size || "")}"><input aria-label="Colour" placeholder="Colour" value="${esc(v.colour || "")}"><input aria-label="Stock" type="number" min="0" max="100000" value="${v.stock || 0}"><button class="icon-btn remove-variant" type="button" aria-label="Remove combination">${icon("trash")}</button></div>`;
}
function productForm(p) {
  if (state.session.role === "product_admin" && p?.published) {
    return adminShell(`<section class="panel"><h2>${esc(p.name)}</h2><p>This product is live. Ask your Super Admin to make changes to published products.</p><a data-link class="btn" href="/admin/products">Back to products</a></section>`, "products");
  }
  editingProduct = p || {
    name: "",
    price: 0,
    description: "",
    images: [],
    variants: [{ size: "One size", colour: "", stock: 1 }],
    category: state.categories[0],
    published: false,
  };
  let x = editingProduct;
  return adminShell(
    `<form class="admin-form panel" id="product-form"><h2>${p ? "Edit your piece" : "A new favourite"}</h2>${p?.sample ? '<p class="note">This is a preview sample. Create a new product for your live catalogue.</p>' : ""}<div id="form-error"></div><label class="field">Product name<input name="name" required maxlength="150" value="${esc(x.name)}"></label><div class="form-grid"><label class="field">Category<select name="category" aria-label="Category">${state.categories.map((c) => `<option ${c === x.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label><label class="field">Price (₦)<input name="price" type="number" step="0.01" min="0.01" required value="${x.price / 100 || ""}"></label></div><label class="field">Description<textarea name="description" maxlength="5000">${esc(x.description)}</textarea></label><label class="field">Photos (up to 8)<input id="upload" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><p class="tiny">Photos are optimized and stored for your catalogue.</p><div id="photos" class="photo-list">${photosView()}</div><div class="spacer"></div><h3>Size & colour combinations</h3><p class="tiny">Stock applies to each exact combination. Set stock to 0 for sold out. Existing reservations reduce available stock.</p><div class="variant-row tiny"><span>Size</span><span>Colour</span><span>Stock</span><span></span></div><div id="variants">${x.variants.map(variantRow).join("")}</div><button class="text-btn" id="add-variant" type="button">+ Add combination</button>${state.session.role === "superadmin" ? `<label class="check"><input type="checkbox" name="published" ${x.published ? "checked" : ""}> Publish in the boutique</label>` : `<p class="note">Saved as a draft for your Super Admin to review and publish. Live products can only be edited by the Super Admin.</p>`}<button class="btn" id="save-product">Save product</button> <a data-link href="/admin/products" class="text-btn">Back to products</a></form>`,
    "products",
  );
}
function photosView() {
  return editingProduct.images
    .map(
      (im, i) =>
        `<div><img src="${esc(im.startsWith("/static/images/") ? im + "?v=2" : im)}" alt="Product photo ${i + 1}"><button type="button" class="icon-btn" data-remove-photo="${i}" aria-label="Remove photo ${i + 1}">${icon("close")}</button></div>`,
    )
    .join("");
}
// Resize on the phone before upload so original camera files fit Vercel's body limit.
async function preparePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 12 * 1024 * 1024)
    throw Error("Choose a photo smaller than 12 MB.");
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw Error(
      "This photo could not be opened. Choose another JPG, PNG or WebP.",
    );
  }
  try {
    if (image.width * image.height > 24000000)
      throw Error("Choose a photo under 24 megapixels.");
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdf9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    if (!blob || blob.size > 3 * 1024 * 1024)
      throw Error("Photo is too large to send. Please choose a smaller image.");
    return blob;
  } finally {
    image.close();
  }
}

function bindProductForm() {
  const photoBind = () =>
    $$("[data-remove-photo]").forEach(
      (b) =>
        (b.onclick = () => {
          editingProduct.images.splice(+b.dataset.removePhoto, 1);
          $("#photos").innerHTML = photosView();
          photoBind();
        }),
    );
  photoBind();
  const variantBind = () =>
    $$(".remove-variant").forEach(
      (b) => (b.onclick = () => b.closest(".variant-row").remove()),
    );
  variantBind();
  $("#add-variant").onclick = () => {
    $("#variants").insertAdjacentHTML("beforeend", variantRow());
    variantBind();
  };
  $("#upload").onchange = async (e) => {
    let files = [...e.target.files];
    if (files.length + editingProduct.images.length > 8) {
      toast("Choose up to 8 photos in total.");
      return;
    }
    $("#save-product").disabled = true;
    try {
      for (let f of files) {
        let form = new FormData();
        form.append("photo", await preparePhoto(f), "product.jpg");
        let r = await api("upload", form);
        editingProduct.images.push(r.url);
      }
      $("#photos").innerHTML = photosView();
      photoBind();
      toast("Photos uploaded.");
    } catch (err) {
      toast(err.message);
    } finally {
      $("#save-product").disabled = false;
    }
  };
  $("#product-form").onsubmit = async (e) => {
    e.preventDefault();
    let f = new FormData(e.target),
      b = $("#save-product");
    b.disabled = true;
    let variants = $$("#variants .variant-row").map((row) => ({
      id: row.dataset.id || undefined,
      size: row.children[0].value,
      colour: row.children[1].value,
      stock: Number(row.children[2].value),
    }));
    try {
      await api("products", {
        ...editingProduct,
        name: f.get("name"),
        category: f.get("category"),
        price: Math.round(Number(f.get("price")) * 100),
        description: f.get("description"),
        published: f.has("published"),
        variants,
      });
      state.products = await api("products");
      toast("Your product is saved.");
      go("/admin/products");
    } catch (err) {
      $("#form-error").innerHTML =
        `<div class="error">${esc(err.message)}</div>`;
      b.disabled = false;
      $("#form-error").scrollIntoView({ block: "center" });
    }
  };
}
function orderView(o) {
  let replaced = new Set(o.payments.map((p) => p.corrects).filter(Boolean));
  return adminShell(
    `<div class="section-heading"><div><a data-link href="/admin/orders" class="text-btn">← Order book</a><h2>${o.id}</h2><span class="tiny">${o.fulfilment} · Website order request</span></div>${statusPill(o)}</div>${o.overdue || o.follow_up ? `<div class="error">Follow up: ${o.overdue ? "the agreed due date has passed. " : ""}${o.follow_up ? "The third payment left a product balance." : ""}</div>` : ""}${o.excess ? `<div class="error">Excess product payment: ${naira(o.excess)}. Review with the customer.</div>` : ""}${o.delivery_excess ? `<div class="error">Excess delivery payment: ${naira(o.delivery_excess)}. Review with the customer.</div>` : ""}${(o.inventory_conflicts || []).map((message) => `<div class="error">${esc(message)}</div>`).join("")}<div id="order-error"></div><div class="admin-order"><div><section class="panel"><h3>Original order</h3>${o.items.map((i) => `<div class="cart-line"><img src="${esc(i.image)}" alt=""><div class="cart-info"><h3>${esc(i.name)}</h3><p>${esc(i.size || "One size")} / ${esc(i.colour)} · Qty ${i.qty}</p><span class="price">${naira(i.price * i.qty)}</span>${!["Paid", "Dismissed"].includes(o.status) ? `<div><button class="text-btn" data-reserve="${esc(i.variant_id)}" data-product="${esc(i.product_id)}" data-qty="${o.reservations.some((r) => r.variant === i.variant_id && r.product_id === i.product_id) ? 0 : i.qty}">${o.reservations.some((r) => r.variant === i.variant_id && r.product_id === i.product_id) ? "Release reservation" : "Reserve this selection"}</button></div>` : ""}</div></div>`).join("")}<div class="row"><span>Product total</span><strong>${naira(o.total)}</strong></div><div class="row"><span>Paid toward products</span><strong>${naira(o.paid_products)}</strong></div><div class="row total"><span>Product balance</span><strong>${naira(o.balance)}</strong></div><div class="row"><span>Agreed delivery fee</span><span>${naira(o.delivery_fee)}</span></div><p class="tiny">${o.rider_direct ? "Customer pays rider directly; this fee is not owner receipts." : `Owner received for delivery: ${naira(o.paid_delivery)} · Delivery balance: ${naira(o.delivery_balance)}`}</p></section><section class="panel"><h3>Payment history</h3>${!o.payments.length ? '<p class="tiny">No verified transfers recorded yet.</p>' : o.payments.map((p) => `<div class="payment-entry ${replaced.has(p.id) ? "corrected" : ""}"><div class="row"><strong>${naira(p.products)} products + ${naira(p.delivery)} delivery</strong><span>${esc(p.received)}</span></div><p>Recorded by ${esc(p.actor)} · ${esc(p.created)}</p>${p.note ? `<p>Exception / note: ${esc(p.note)}</p>` : ""}${p.corrects ? `<p>Correction of ${esc(p.corrects)} · Reason: ${esc(p.reason)}</p>` : ""}${replaced.has(p.id) ? '<span class="pill">Preserved · corrected</span>' : o.status !== "Dismissed" ? `<button data-correct="${p.id}" class="text-btn">Correct this payment</button>` : ""}</div>`).join("")}</section></div><aside>${o.status !== "Dismissed" ? `<form class="panel" id="payment-form"><h3 id="payment-title">Record verified payment</h3><p class="tiny">Only log money you have actually received. Split a combined transfer between products and delivery.</p><input type="hidden" name="corrects"><label class="field">Received on<input type="date" name="received" value="${new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })}" required></label><div class="form-grid"><label class="field">Toward products (₦)<input type="number" step="0.01" min="0" name="products" value="0" required></label><label class="field">Toward delivery (₦)<input type="number" step="0.01" min="0" name="delivery" value="0" required></label></div><label class="field">Note / exception<textarea name="note" placeholder="Explain any payment outside the agreement or excess"></textarea></label><label class="field" id="correction-field" hidden>Correction reason<input name="reason"></label><button class="btn full">Record payment</button><button type="button" id="cancel-correction" class="text-btn" hidden>Cancel correction</button></form><form class="panel" id="agreement"><h3>Agreement & delivery</h3><p class="tiny">Up to 3 payments. Stated terms: ₦2,000 minimum and completion within 2 weeks. How the minimum applies and the start date are unconfirmed; record your agreed due date and terms here.</p><label class="field">Agreed due date<input type="date" name="due" value="${esc(o.due || "")}"></label><label class="field">Agreement note<textarea name="note">${esc(o.note)}</textarea></label><label class="field">Agreed delivery fee (₦)<input name="delivery_fee" type="number" step="0.01" min="0" value="${o.delivery_fee / 100}"></label><label class="check"><input type="checkbox" name="rider_direct" ${o.rider_direct ? "checked" : ""}> Customer pays rider directly</label><button class="btn secondary full">Save agreement</button></form>${o.status !== "Paid" ? `<details class="panel"><summary>Close / dismiss request</summary><form id="dismiss"><p class="tiny">${o.payments.length ? "Review every payment above before closing. The payment history and received amounts remain accounted for." : "You can dismiss an abandoned request with no payments."}</p>${o.payments.length ? `<div class="close-review"><label class="field">Type ${o.id} to confirm review<input name="review" required></label><label class="field">Closing reason<textarea name="reason" required></textarea></label></div>` : ""}<button class="btn secondary full">Dismiss request</button></form></details>` : ""}` : '<div class="panel"><h3>Request closed</h3><p class="tiny">Original payments and closing notes are retained for review.</p><p>${esc(o.note)}</p></div>'}</aside></div>`,
    "orders",
  );
}
function bindOrder(o) {
  const pendingName = "lola-pending-payment-" + o.id;
  let pending = storedJSON(sessionStorage, pendingName, null);
  if (pending && o.payments.some((p) => p.submission_key === pending.key)) {
    sessionStorage.removeItem(pendingName);
    pending = null;
  }
  paymentKey = pending?.key || crypto.randomUUID();
  const refresh = async () => {
    state.products = await api("products");
    await render();
  };
  const showError = (e) => {
    $("#order-error").innerHTML = `<div class="error">${esc(e.message)}</div>`;
    $("#order-error").scrollIntoView({ block: "center" });
  };
  $$("[data-reserve]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          await api(`orders/${o.id}/reserve`, {
            product_id: b.dataset.product,
            variant_id: b.dataset.reserve,
            qty: +b.dataset.qty,
          });
          toast("Reservation updated.");
          await refresh();
        } catch (e) {
          showError(e);
          b.disabled = false;
        }
      }),
  );
  if ($("#payment-form")) {
    $("#payment-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target),
        button = e.submitter;
      button.disabled = true;
      try {
        const payment = {
          key: paymentKey,
          products: Math.round(Number(f.get("products")) * 100),
          delivery: Math.round(Number(f.get("delivery")) * 100),
          received: f.get("received"),
          note: f.get("note"),
          corrects: f.get("corrects") || null,
          reason: f.get("reason"),
        };
        sessionStorage.setItem(pendingName, JSON.stringify(payment));
        await api(`orders/${o.id}/payments`, payment);
        sessionStorage.removeItem(pendingName);
        toast("Payment recorded.");
        await refresh();
      } catch (err) {
        showError(err);
        button.disabled = false;
      }
    };
    $$("[data-correct]").forEach(
      (b) =>
        (b.onclick = () => {
          let p = o.payments.find((p) => p.id === b.dataset.correct),
            f = $("#payment-form");
          f.elements.corrects.value = p.id;
          f.elements.products.value = p.products / 100;
          f.elements.delivery.value = p.delivery / 100;
          f.elements.received.value = p.received;
          $("#payment-title").textContent = "Correct payment";
          $("#correction-field").hidden = false;
          $("#cancel-correction").hidden = false;
          f.elements.reason.required = true;
          paymentKey = crypto.randomUUID();
          f.scrollIntoView({ block: "center", behavior: "smooth" });
        }),
    );
    if (pending) {
      const form = $("#payment-form");
      for (const key of ["products", "delivery"])
        form.elements[key].value = pending[key] / 100;
      for (const key of ["received", "note", "corrects", "reason"])
        form.elements[key].value = pending[key] || "";
      form.insertAdjacentHTML(
        "afterbegin",
        '<p class="note">An unconfirmed payment entry was restored. Check the history below before retrying; a retry uses the same submission reference.</p>',
      );
      if (pending.corrects) {
        $("#payment-title").textContent = "Correct payment";
        $("#correction-field").hidden = false;
        form.elements.reason.required = true;
      }
    }
    $("#cancel-correction").onclick = () => {
      sessionStorage.removeItem(pendingName);
      render();
    };
    $("#agreement").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target),
        b = e.submitter;
      b.disabled = true;
      try {
        await api(`orders/${o.id}/agreement`, {
          due: f.get("due"),
          note: f.get("note"),
          delivery_fee: Math.round(Number(f.get("delivery_fee")) * 100),
          rider_direct: f.has("rider_direct"),
        });
        toast("Agreement saved.");
        await render();
      } catch (err) {
        showError(err);
        b.disabled = false;
      }
    };
  }
  if ($("#dismiss"))
    $("#dismiss").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target),
        b = e.submitter;
      b.disabled = true;
      try {
        await api(`orders/${o.id}/dismiss`, Object.fromEntries(f));
        toast("Request dismissed.");
        await render();
      } catch (err) {
        showError(err);
        b.disabled = false;
      }
    };
}
async function render() {
  clearInterval(carouselTimer);
  let version = ++renderVersion;
  let p = path();
  try {
    if (p.startsWith("/admin")) {
      if (p === "/admin/activate") { activationView(); return; }
      state.session = await api("session");
      if (!state.session.owner) {
        $("#app").innerHTML = login();
        bindLogin();
        return;
      }
      if (state.session.role === "product_admin" && !p.startsWith("/admin/products")) { go("/admin/products"); return; }
      let body;
      if (p === "/admin/team") {
        const [members, activity] = await Promise.all([api("staff"), api("product-activity")]);
        body = teamView(members, activity);
      } else if (p === "/admin") {
        let d = await api("dashboard" + location.search);
        if (version !== renderVersion) return;
        body = dashboard(d);
      } else if (p === "/admin/orders") {
        allOrders = await api("orders");
        body = ordersView();
      } else if (p.startsWith("/admin/order/")) {
        allOrders = await api("orders");
        let o = allOrders.find((o) => o.id === p.split("/").pop());
        if (!o) throw Error("Order not found.");
        body = orderView(o);
      } else {
        adminProducts = await api("products?admin=1");
        if (p === "/admin/products") body = productsView();
        else {
          let id = p.split("/").pop();
          let item = adminProducts.find((p) => p.id === id);
          if (id !== "new" && !item) throw Error("Product not found.");
          body = productForm(item);
        }
      }
      if (version !== renderVersion) return;
      $("#app").innerHTML = body;
      $("#logout").onclick = async () => {
        await api("logout", {});
        state.session = await api("session");
        go("/admin");
      };
      if ($("#invite-staff")) bindTeam();
      if ($("#date-filter"))
        $("#date-filter").onsubmit = (e) => {
          e.preventDefault();
          go("/admin?" + new URLSearchParams(new FormData(e.target)));
        };
      if ($("#order-search")) {
        let filter = () =>
          ($("#order-list").innerHTML = orderList(
            allOrders.filter(
              (o) =>
                o.id
                  .toLowerCase()
                  .includes($("#order-search").value.toLowerCase()) &&
                ($("#order-status").value === "All statuses" ||
                  o.status === $("#order-status").value),
            ),
          ));
        $("#order-search").oninput = filter;
        $("#order-status").onchange = filter;
      }
      if ($("#product-search")) {
        $("#product-search").oninput = (e) =>
          ($("#admin-product-list").innerHTML = adminProductList(
            adminProducts.filter((p) =>
              p.name.toLowerCase().includes(e.target.value.toLowerCase()),
            ),
          ));
        $("#add-category").onsubmit = async (e) => {
          e.preventDefault();
          try {
            await api("categories", {
              name: new FormData(e.target).get("name"),
            });
            state.categories = await api("categories");
            await render();
          } catch (err) {
            toast(err.message);
          }
        };
      }
      if ($("#product-form")) bindProductForm();
      if (p.startsWith("/admin/order/"))
        bindOrder(allOrders.find((o) => o.id === p.split("/").pop()));
      return;
    }
    if (p === "/cart") {
      $("#app").innerHTML = cart();
      bindCart();
    } else if (p === "/handoff") {
      $("#app").innerHTML = handoff();
      if ($("#copy-message"))
        $("#copy-message").onclick = async () => {
          let h = JSON.parse(sessionStorage.getItem("lola-handoff"));
          try {
            await navigator.clipboard.writeText(h.message);
            toast("Order message copied.");
          } catch {
            toast("Select the order message above and copy it.");
          }
        };
    } else if (p.startsWith("/product/")) {
      let item = state.products.find((x) => x.id === p.split("/").pop());
      if (!item)
        throw Error("This piece is unavailable. Explore the latest edit.");
      $("#app").innerHTML = detail(item);
      bindDetail(item);
    } else if (p === "/categories") {
      $("#app").innerHTML = shell(
        heading(
          "Find your kind of lovely",
          "Explore the boutique, one edit at a time.",
        ) +
          `<div class="grid">${state.categories.map((c, i) => `<a data-link href="/category/${encodeURIComponent(c)}" class="panel"><span class="eyebrow">THE ${esc(c.toUpperCase())} EDIT</span><h2>${esc(c)}</h2>${c === "Bottoms" ? "<p>Joggers, capri pants, trousers and more.</p>" : ""}<span class="text-btn">Discover ${icon("arrow")}</span></a>`).join("")}</div>`,
        "categories",
      );
    } else if (p === "/" || p === "/search" || p.startsWith("/category/")) {
      let c = p.startsWith("/category/")
        ? decodeURIComponent(p.split("/").pop())
        : "All";
      if (p !== "/search") state.query = "";
      $("#app").innerHTML = catalogue(c, p === "/search");
      bindCatalogue();
    } else {
      $("#app").innerHTML = shell(
        heading("This page has wandered off.") +
          '<a class="btn" data-link href="/">Back to the boutique</a>',
      );
    }
  } catch (err) {
    if (err.status === 401) {
      state.session.owner = null;
      $("#app").innerHTML = login();
      bindLogin();
    } else {
      $("#app").innerHTML = shell(
        `<div class="empty"><h2>We couldn’t open this page.</h2><p>${esc(err.message)}</p><button class="btn" id="retry">Try again</button> <a class="text-btn" data-link href="/">Back to the boutique</a></div>`,
      );
      $("#retry").onclick = () => init();
    }
  }
}
async function init() {
  try {
    state.session = await api("session");
    [state.products, state.categories] = await Promise.all([
      api("products"),
      api("categories"),
    ]);
    await render();
  } catch (e) {
    $("#app").innerHTML = shell(
      `<div class="empty"><h2>A little pause.</h2><p>We couldn’t load the boutique. Please check your connection.</p><button class="btn" id="retry">Try again</button></div>`,
    );
    $("#retry").onclick = init;
  }
}
init();
