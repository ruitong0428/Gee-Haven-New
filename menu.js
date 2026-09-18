let items = [];
let selectedCategory = "All";

const demo = [
 {id:"demo-1",name:"Hainan Chicken Rice",description:"Tender chicken with fragrant rice and homemade sauce.",price:16.90,category:"Food",image:"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-2",name:"Nasi Lemak Special",description:"Coconut rice with sambal and classic sides.",price:14.90,category:"Food",image:"https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-3",name:"Sweet & Sour Chicken",description:"Crispy chicken with a bright sweet and sour sauce.",price:18.90,category:"Food",image:"https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-4",name:"Cantonese Fried Rice",description:"Wok-fried rice with egg and vegetables.",price:13.90,category:"Food",image:"https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-5",name:"Iced Lemon Tea",description:"Refreshing tea with fresh lemon.",price:6.00,category:"Drinks",image:"https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-6",name:"Siu Mai (4 pcs)",description:"Classic steamed dim sum.",price:6.90,category:"Dim Sum",image:"https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-7",name:"Har Kow (4 pcs)",description:"Crystal prawn dumplings.",price:6.90,category:"Dim Sum",image:"https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-8",name:"Red Bean Dessert Soup",description:"Warm traditional sweet soup.",price:6.90,category:"Dessert",image:"https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-9",name:"Mango Pudding",description:"Smooth chilled mango dessert.",price:8.90,category:"Dessert",image:"https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80"},
 {id:"demo-10",name:"Chinese Herbal Soup",description:"Comforting warm soup.",price:9.90,category:"Soup",image:"https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80"}
];

// (localDemoCategories/localDemoFoods now live in app.js so every page can use them)

async function loadCategories(){
  const {data,error}=await db.from("categories").select("*").eq("is_active",true).order("display_order").order("name");
  const all=[...(error?[]:(data||[]))];
  localDemoCategories().forEach(c=>{if(!all.some(x=>String(x.id)===String(c.id)))all.push(c)});
  const sidebar=$("#categorySidebar");
  if(!sidebar)return;
  sidebar.innerHTML=`<button class="category active" data-category="All">✨ All</button>`+all.map(c=>`<button class="category" data-category="${c.name}">${c.icon||"🍽️"} ${c.name}</button>`).join("");
  $$(".category").forEach(btn=>btn.addEventListener("click",()=>{
    selectedCategory=btn.dataset.category;
    $$(".category").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    renderMenu();
  }));
}

async function loadMenu(){
  await loadCategories();
  const {data,error}=await db.from("menu_items").select("*,categories(name)").eq("is_available",true).order("display_order");
  const dbItems=(!error && data)?data.map(x=>({...x,category:x.categories?.name||"Other",image:x.image_url||"assets/logo.png"})):[];
  const locals=localDemoFoods().filter(x=>x.is_available!==false).map(x=>{
    const c=localDemoCategories().find(c=>String(c.id)===String(x.category_id));
    return {...x,category:c?.name||"Other",image:x.image_url||"assets/logo.png"};
  });
  items=[...dbItems,...locals];
  if(!items.length)items=demo;
  window.GEE_MENU_ITEMS = items;
  if($("#menuGrid")) renderMenu();
}

function renderMenu(){
  const q=($("#menuSearch")?.value||"").toLowerCase();
  const list=items.filter(x=>
    (selectedCategory==="All" || x.category===selectedCategory) &&
    (!q || x.name.toLowerCase().includes(q))
  );
  $("#menuGrid").innerHTML=list.length ? list.map(x=>`
    <article class="food-card">
      <img class="food-img" src="${x.image}" onerror="this.src='assets/logo.png'" alt="${x.name}">
      <div class="food-body">
        <h3>${x.name}</h3>
        <p>${x.description||"Deliciously prepared by Gee Haven."}</p>
        <div class="food-bottom">
          <span class="price">${money(x.price)}</span>
          <button class="btn" onclick="addToCart('${x.id}')">Add</button>
        </div>
      </div>
    </article>`).join("") : `<div class="empty">No menu items found.</div>`;
}

function addToCart(id){
  const item=items.find(x=>String(x.id)===String(id));
  if(!item)return;
  const c=cart();
  const existing=c.find(x=>String(x.id)===String(id));
  if(existing)existing.qty++;
  else c.push({id:item.id,name:item.name,price:Number(item.price),qty:1,image:item.image});
  saveCart(c); renderCart(); toast(`${item.name} added to cart.`);
}

function renderCart(){
  const box=$("#cartItems"); if(!box)return;
  const c=cart();
  box.innerHTML=c.length?c.map((x,i)=>`
    <div class="cart-item">
      <img src="${x.image||'assets/logo.png'}" onerror="this.src='assets/logo.png'">
      <div class="cart-info">
        <strong>${x.name}</strong>
        <div class="sub">${money(x.price)}</div>
        <div class="qty-controls">
          <button onclick="changeQty(${i},-1)">−</button>
          <span>${x.qty}</span>
          <button onclick="changeQty(${i},1)">+</button>
          <button onclick="deleteCart(${i})">Remove</button>
        </div>
      </div>
      <strong>${money(x.price*x.qty)}</strong>
    </div>`).join(""):`<div class="empty">Your cart is empty.</div>`;
  $("#cartSubtotal").textContent=money(subtotal());
  refreshCartUI();
}

function changeQty(i,d){
  const c=cart(); c[i].qty+=d;
  if(c[i].qty<=0)c.splice(i,1);
  saveCart(c);renderCart();
}
function deleteCart(i){
  const c=cart();c.splice(i,1);saveCart(c);renderCart();
}
function toggleCart(){ $("#cartDrawer")?.classList.toggle("hidden"); }

window.addToCart=addToCart;
window.changeQty=changeQty;
window.deleteCart=deleteCart;
window.toggleCart=toggleCart;

document.addEventListener("DOMContentLoaded",async()=>{
  // Always load the menu data (needed by the AI sprite on every page),
  // even on pages that don't show the #menuGrid.
  await loadMenu();
  if(!$("#menuGrid"))return;
  renderCart();
  setInterval(loadMenu, 10000);
  $("#menuSearch")?.addEventListener("input",renderMenu);
});
