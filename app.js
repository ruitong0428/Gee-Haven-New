const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];

function money(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

// --- Local "demo" menu storage --------------------------------------------
// Used as a fallback whenever Supabase isn't configured yet, or when writing
// via Supabase fails (e.g. the Demo Admin shortcut, which has no real
// Supabase Auth session and so can't pass row-level security). This lets the
// admin Menu page still add/edit categories & food, and the customer Menu
// page merges these in alongside anything stored for real in Supabase.
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
}
function localDemoCategories() {
  try { return JSON.parse(localStorage.getItem("gee_demo_categories") || "[]"); }
  catch (e) { return []; }
}
function saveLocalDemoCategories(list) {
  localStorage.setItem("gee_demo_categories", JSON.stringify(list));
}
function localDemoFoods() {
  try { return JSON.parse(localStorage.getItem("gee_demo_foods") || "[]"); }
  catch (e) { return []; }
}
function saveLocalDemoFoods(list) {
  localStorage.setItem("gee_demo_foods", JSON.stringify(list));
}

// --- Local order-status fallback -------------------------------------------
// The admin "Confirm / Start Preparing / Complete" buttons write straight to
// Supabase. That only works for a real staff/admin account. The Demo Admin
// shortcut (admin/password123) has no real Supabase session, so that write
// gets rejected by the database's security rules. When that happens we keep
// the status change here instead, so the demo still works end-to-end and the
// customer's progress bar (opened in the same browser) still updates.
function localOrderOverrides() {
  try { return JSON.parse(localStorage.getItem("gee_demo_order_status") || "{}"); }
  catch (e) { return {}; }
}
function saveLocalOrderOverrides(map) {
  localStorage.setItem("gee_demo_order_status", JSON.stringify(map));
}
function recordLocalOrderStatus(orderId, status) {
  const overrides = localOrderOverrides();
  const now = new Date().toISOString();
  const entry = overrides[orderId] || { history: [] };
  entry.status = status;
  entry.updated_at = now;
  entry.history = [...(entry.history || []), { status, created_at: now }];
  overrides[orderId] = entry;
  saveLocalOrderOverrides(overrides);
}
function applyLocalOrderOverride(order) {
  const entry = localOrderOverrides()[order.id];
  if (!entry) return order;
  return { ...order, status: entry.status, updated_at: entry.updated_at || order.updated_at };
}
function localOrderHistoryFor(orderId) {
  return (localOrderOverrides()[orderId]?.history) || [];
}

// --- Per-account cart --------------------------------------------------
// Each logged-in account (and guests) gets its own cart, keyed by user id,
// so switching accounts on the same browser never mixes carts together.
let cartKey = "gee_cart_guest";

async function refreshCartKey() {
  const user = await getUser();
  cartKey = "gee_cart_" + (user ? user.id : "guest");
  refreshCartUI();
}

function cart() {
  try { return JSON.parse(localStorage.getItem(cartKey) || "[]"); }
  catch { return []; }
}

function saveCart(items) {
  localStorage.setItem(cartKey, JSON.stringify(items));
  refreshCartUI();
}

function clearCart() {
  localStorage.removeItem(cartKey);
  refreshCartUI();
}

function cartCount() {
  return cart().reduce((sum, item) => sum + Number(item.qty), 0);
}

function subtotal() {
  return cart().reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
}

function refreshCartUI() {
  $$("[data-cart-count]").forEach(el => el.textContent = cartCount());
  $$("[data-cart-total]").forEach(el => el.textContent = money(subtotal()));
}

function toast(message, error=false) {
  const old = $(".toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "toast" + (error ? " error" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

async function getUser() {
  // Demo Admin session
  if (localStorage.getItem("gee_admin_demo") === "1") {
    return {
      id: "demo-admin",
      email: "admin@geehaven.local",
      user_metadata: { full_name: "Gee Haven Admin" }
    };
  }

  const { data } = await db.auth.getUser();
  return data.user || null;
}

function isDemoAdmin(user) {
  // The "Demo Admin" login (admin / password123) is a front-end-only shortcut
  // for previewing the admin panel. It has no real Supabase Auth session, so
  // its id is not a valid UUID and it can never satisfy the database's
  // row-level security rules for placing a real customer order.
  return !!user && user.id === "demo-admin";
}

async function requireLogin() {
  const user = await getUser();
  if (!user) {
    location.href = "login.html?next=" + encodeURIComponent(location.pathname + location.search);
    return null;
  }
  return user;
}

async function logout() {
  localStorage.removeItem("gee_admin_demo");
  await db.auth.signOut();
  location.href = "index.html";
}

function updateAuthUI() {
  getUser().then(async user => {
    const name = user?.user_metadata?.full_name;
    $$("[data-auth-user]").forEach(el => {
      if (user) {
        el.textContent = "👤 " + (name ? `${name} · ${user.email}` : user.email);
        el.style.display = "";
      } else {
        el.textContent = "";
        el.style.display = "none";
      }
    });
    $$("[data-login-link]").forEach(el => {
      el.style.display = user ? "none" : "";
    });
    $$("[data-logout-nav]").forEach(el => {
      el.style.display = user ? "" : "none";
    });

    // Show the "Admin dashboard" nav shortcut for admin/staff accounts only.
    let isStaffOrAdmin = false;
    if (user && isDemoAdmin(user)) {
      isStaffOrAdmin = true;
    } else if (user) {
      const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
      isStaffOrAdmin = profile?.role === "admin" || profile?.role === "staff";
    }
    $$("[data-admin-link]").forEach(el => {
      el.style.display = isStaffOrAdmin ? "" : "none";
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  refreshCartUI();
  refreshCartKey().then(() => { renderCart?.(); });
  updateAuthUI();
  $$("[data-logout], [data-logout-nav]").forEach(btn => btn.addEventListener("click", logout));
});
