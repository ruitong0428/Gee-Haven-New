async function checkAdmin(){
  const user=await requireLogin(); if(!user)return null;

  // Demo Admin login: admin / password123
  if (localStorage.getItem("gee_admin_demo") === "1") {
    return user;
  }

  const {data,error}=await db.from("profiles").select("role,full_name,username").eq("id",user.id).single();
  if(error||!data||!["admin","staff"].includes(data.role)){
    document.body.innerHTML=`<div class="form-card center"><h1>Admin Access Required</h1><p>You need an admin/staff account.</p><a class="btn" href="../index.html">Back Home</a></div>`;
    return null;
  }
  return user;
}

async function dashboard(){
  if(!await checkAdmin())return;
  const {data}=await db.from("orders").select("id,status,total,payment_status"); const rows=(data||[]).map(applyLocalOrderOverride);
  $("#kOrders").textContent=rows.length;
  $("#kActive").textContent=rows.filter(x=>["New","Confirmed","Preparing"].includes(x.status)).length;
  $("#kSales").textContent=money(rows.filter(x=>x.payment_status==="Paid").reduce((a,x)=>a+Number(x.total),0));
  $("#kRefunds").textContent=rows.filter(x=>x.payment_status==="Refunded").length;
}

async function activeOrders(){
  if(!await checkAdmin())return;
  const {data,error}=await db.from("orders").select("*,order_items(*)").order("created_at",{ascending:false});
  if(error)return toast(error.message,true);
  const merged=(data||[]).map(applyLocalOrderOverride).filter(o=>["New","Confirmed","Preparing"].includes(o.status));
  const labels={New:"Order Placed",Confirmed:"Confirmed",Preparing:"Preparing"};
  const next={New:"Confirmed",Confirmed:"Preparing",Preparing:"Completed"};
  $("#activeOrders").innerHTML=merged.length?merged.map(o=>{
    const n=next[o.status];
    const items=(o.order_items||[]).map(i=>`${i.item_name} × ${i.quantity} <span class="sub">(${money(i.item_total)})</span>`).join("<br>");
    const idx=["New","Confirmed","Preparing","Completed"].indexOf(o.status);
    const progress=["New","Confirmed","Preparing","Completed"].map((s,i)=>`<span class="${i<=idx?"active":""}">${i+1}</span>`).join("");
    const button=n?`<button class="btn ${n==="Completed"?"green":""}" onclick="setStatus('${o.id}','${n}')">${n==="Confirmed"?"Confirm Order":n==="Preparing"?"Start Preparing":"Complete Order"}</button>`:"";
    return `<div class="order-card"><div class="order-head"><div><h3>Order #${o.order_number||String(o.id).slice(0,8)}</h3><div class="sub">Customer: ${o.customer_name||"Customer"} · ${new Date(o.created_at).toLocaleString()}</div></div><span class="badge">${labels[o.status]}</span></div><div class="admin-progress">${progress}</div><p><b>Items:</b><br>${items||"-"}</p><div class="price-breakdown"><span>Subtotal ${money(o.subtotal)}</span><span>Service ${money(o.service_charge)}</span><span>SST ${money(o.sst)}</span><b>Total ${money(o.total)}</b></div><p class="sub">Payment: ${o.payment_status} · ${o.table_info||"Counter"}</p><div class="actions">${button}<button class="btn secondary" onclick="showAdminOrderDetails('${o.id}')">Order Details</button>${o.status==="New"?`<button class="btn red" onclick="setStatus('${o.id}','Cancelled')">Reject</button>`:""}</div></div>`;
  }).join(""):`<div class="empty">No active orders.</div>`;
}

async function setStatus(id,status){
  const patch={status,updated_at:new Date().toISOString()};
  if(status==="Completed")patch.payment_status="Paid"; // cash/counter payment collected on completion
  const {error}=await db.from("orders").update(patch).eq("id",id);
  if(error){
    // Couldn't write to Supabase — almost always because you're using the
    // Demo Admin shortcut, which has no real login session. Keep the change
    // locally so the flow (and the customer's progress bar, in this same
    // browser) still moves forward.
    recordLocalOrderStatus(id,status);
    toast(`Order updated to ${status} (saved locally — Demo Admin can't write to Supabase).`);
    activeOrders();
    return;
  }
  toast(`Order updated to ${status}.`); activeOrders();
}

async function showAdminOrderDetails(id){
  const [{data:o,error},{data:items},{data:dbHistory}]=await Promise.all([
    db.from("orders").select("*").eq("id",id).single(),
    db.from("order_items").select("*").eq("order_id",id).order("id"),
    db.from("order_status_history").select("*").eq("order_id",id).order("created_at")
  ]);
  if(error||!o)return toast("Unable to load order details.",true);
  const merged=applyLocalOrderOverride(o);
  const history=[...(dbHistory||[]),...localOrderHistoryFor(id)].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const rows=(items||[]).map(i=>`<div class="summary-row"><span>${i.item_name} × ${i.quantity}</span><b>${money(i.item_total)}</b></div>`).join("");
  const times=history.map(h=>`<div class="timeline-row"><b>${h.status}</b><span>${new Date(h.created_at).toLocaleString()}</span></div>`).join("");
  const old=$("#adminOrderDetailModal");if(old)old.remove();
  document.body.insertAdjacentHTML("beforeend",`<div id="adminOrderDetailModal" class="modal-backdrop"><div class="modal-card"><button class="modal-close" onclick="document.getElementById('adminOrderDetailModal').remove()">×</button><h2>Order #${o.order_number||String(o.id).slice(0,8)}</h2><p class="sub">Customer: ${o.customer_name||"-"}<br>Created: ${new Date(o.created_at).toLocaleString()}<br>Payment: ${o.payment_method||"-"} · ${o.payment_status}<br>Status: ${merged.status}</p><h3>Order Items</h3>${rows||"-"}<h3>Price Record</h3><div class="summary-row"><span>Subtotal</span><b>${money(o.subtotal)}</b></div><div class="summary-row"><span>Discount</span><b>-${money(Number(o.subtotal)>=100?10:0)}</b></div><div class="summary-row"><span>Service Charge</span><b>${money(o.service_charge)}</b></div><div class="summary-row"><span>SST</span><b>${money(o.sst)}</b></div><div class="summary-row total"><span>Total</span><b>${money(o.total)}</b></div><h3>Status Time Record</h3><div class="timeline">${times||"-"}</div></div></div>`);
}


async function history(){
  if(!await checkAdmin())return;
  const {data,error}=await db.from("orders").select("*,order_items(*)").order("created_at",{ascending:false});
  if(error)return toast(error.message,true);
  const merged=(data||[]).map(applyLocalOrderOverride);
  $("#historyBody").innerHTML=merged.map(o=>`<tr><td>#${o.order_number||String(o.id).slice(0,8)}</td><td>${o.customer_name||"-"}</td><td>${(o.order_items||[]).map(i=>`${i.item_name} × ${i.quantity}`).join("<br>")}</td><td>${money(o.total)}</td><td>${o.status}</td><td>${o.payment_status}</td><td>${new Date(o.created_at).toLocaleString()}</td><td><button class="btn secondary" onclick="showAdminOrderDetails('${o.id}')">Order Details</button></td></tr>`).join("");
}
async function refunds(){
  if(!await checkAdmin())return;
  const {data,error}=await db.from("orders").select("*").eq("payment_status","Paid").order("created_at",{ascending:false});
  if(error)return toast(error.message,true);
  $("#refundBody").innerHTML=(data||[]).map(o=>`<tr><td>#${o.order_number||String(o.id).slice(0,8)}</td><td>${o.customer_name||"-"}</td><td>${money(o.total)}</td><td>${o.status}</td><td><button class="btn red" onclick="refundOrder('${o.id}',${o.total})">Refund</button></td></tr>`).join("");
}
async function refundOrder(id,amount){
  const reason=prompt("Refund reason:","Customer request"); if(reason===null)return;
  const {error}=await db.from("refunds").insert({order_id:id,amount,refund_type:"Full",reason,status:"Processed"});
  if(error)return toast(error.message,true);
  const {error:orderError}=await db.from("orders").update({payment_status:"Refunded",status:"Refunded",updated_at:new Date().toISOString()}).eq("id",id);
  if(orderError)recordLocalOrderStatus(id,"Refunded");
  toast("Refund recorded in Gee Haven."); refunds();
}
// --- Menu Management (admin) -----------------------------------------------
let adminMenuCache = [];

async function loadCategoryOptions(){
  const sel = $("#newFoodCategory");
  const {data} = await db.from("categories").select("*").order("display_order").order("name");
  const cats = [...(data||[]), ...localDemoCategories().filter(c=>!(data||[]).some(x=>String(x.id)===String(c.id)))];
  if(sel){
    sel.innerHTML = cats.length
      ? cats.map(c=>`<option value="${c.id}">${c.icon||"🍽️"} ${c.name}</option>`).join("")
      : `<option value="">Add a category first ↑</option>`;
  }
  return cats;
}

async function addCategory(){
  const name = $("#newCategoryName").value.trim();
  if(!name) return toast("Please enter a category name.", true);
  const icon = $("#newCategoryIcon").value.trim() || "🍽️";
  const description = $("#newCategoryDescription").value.trim();
  const display_order = Number($("#newCategoryOrder").value) || 0;

  const {error} = await db.from("categories").insert({name, icon, description, display_order, is_active:true});
  if(error){
    // Supabase write failed (Demo Admin has no real session, or Supabase
    // isn't configured yet) — keep it locally so the admin UI still works.
    const cats = localDemoCategories();
    cats.push({id:"local-"+uid(), name, icon, description, display_order, is_active:true});
    saveLocalDemoCategories(cats);
    toast("已保存为本地演示分类（Supabase 写入失败：" + error.message + "）");
  } else {
    toast("Category added.");
  }
  $("#newCategoryName").value=""; $("#newCategoryIcon").value=""; $("#newCategoryDescription").value=""; $("#newCategoryOrder").value="10";
  await menuAdmin();
}

async function addFood(){
  const name = $("#newFoodName").value.trim();
  const category_id = $("#newFoodCategory").value;
  const price = Number($("#newFoodPrice").value);
  const image_url = $("#newFoodImage").value.trim();
  const description = $("#newFoodDescription").value.trim();
  if(!name) return toast("Please enter a food name.", true);
  if(!category_id) return toast("Please add a category first.", true);
  if(!(price>=0)) return toast("Please enter a valid price.", true);

  const {error} = await db.from("menu_items").insert({name, category_id, price, image_url, description, is_available:true});
  if(error){
    const foods = localDemoFoods();
    foods.push({id:"local-"+uid(), name, category_id, price, image_url, description, is_available:true});
    saveLocalDemoFoods(foods);
    toast("已保存为本地演示菜品（Supabase 写入失败：" + error.message + "）");
  } else {
    toast("Food added.");
  }
  $("#newFoodName").value=""; $("#newFoodPrice").value=""; $("#newFoodImage").value=""; $("#newFoodDescription").value="";
  await menuAdmin();
}

async function menuAdmin(){
  if(!await checkAdmin())return;
  const cats = await loadCategoryOptions();
  const {data,error} = await db.from("menu_items").select("*,categories(name)").order("display_order");
  const dbItems = (!error && data) ? data.map(x=>({...x, category:x.categories?.name||"Other"})) : [];
  const locals = localDemoFoods().map(x=>{
    const c = cats.find(c=>String(c.id)===String(x.category_id));
    return {...x, category:c?.name||"Other"};
  });
  adminMenuCache = [...dbItems, ...locals];

  $("#menuAdminBody").innerHTML = adminMenuCache.length ? adminMenuCache.map(x=>{
    const available = x.is_available !== false;
    return `<tr>
      <td>${x.name}</td>
      <td>${x.category}</td>
      <td><input type="number" step="0.01" min="0" value="${x.price}" id="price_${x.id}" style="width:90px"></td>
      <td><input type="text" value="${x.name}" id="name_${x.id}" style="width:140px"></td>
      <td><button class="btn ${available?"green":"red"}" onclick="toggleMenu('${x.id}',${available})">${available?"✅ Available":"⛔ Sold Out"}</button></td>
      <td><button class="btn" onclick="saveMenu('${x.id}')">💾 Save</button> <button class="btn red" onclick="deleteMenu('${x.id}')">🗑️ Delete</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" class="empty">No menu items yet — add one above.</td></tr>`;
}

async function saveMenu(id){
  const priceEl = $("#price_"+id), nameEl = $("#name_"+id);
  const price = Number(priceEl?.value), name = (nameEl?.value||"").trim();
  if(!name) return toast("Name cannot be empty.", true);
  if(!(price>=0)) return toast("Please enter a valid price.", true);

  if(String(id).startsWith("local-")){
    const foods = localDemoFoods();
    const idx = foods.findIndex(x=>String(x.id)===String(id));
    if(idx>-1){ foods[idx].name=name; foods[idx].price=price; saveLocalDemoFoods(foods); }
  } else {
    const {error} = await db.from("menu_items").update({name, price, updated_at:new Date().toISOString()}).eq("id", id);
    if(error) return toast(error.message, true);
  }
  toast("Saved. Customers will see this within 10 seconds.");
  menuAdmin();
}

async function toggleMenu(id, currentlyAvailable){
  const next = !currentlyAvailable;
  if(String(id).startsWith("local-")){
    const foods = localDemoFoods();
    const idx = foods.findIndex(x=>String(x.id)===String(id));
    if(idx>-1){ foods[idx].is_available=next; saveLocalDemoFoods(foods); }
  } else {
    const {error} = await db.from("menu_items").update({is_available:next, updated_at:new Date().toISOString()}).eq("id", id);
    if(error) return toast(error.message, true);
  }
  toast(next ? "Marked available." : "Marked sold out.");
  menuAdmin();
}

async function deleteMenu(id){
  if(!confirm("Delete this menu item? This cannot be undone.")) return;
  if(String(id).startsWith("local-")){
    saveLocalDemoFoods(localDemoFoods().filter(x=>String(x.id)!==String(id)));
  } else {
    const {error} = await db.from("menu_items").delete().eq("id", id);
    if(error) return toast(error.message, true);
  }
  toast("Deleted.");
  menuAdmin();
}

window.setStatus=setStatus; window.showAdminOrderDetails=showAdminOrderDetails; window.saveMenu=saveMenu; window.toggleMenu=toggleMenu; window.deleteMenu=deleteMenu; window.addCategory=addCategory; window.addFood=addFood; window.refundOrder=refundOrder;
document.addEventListener("DOMContentLoaded",()=>{if($("#kOrders"))dashboard();if($("#activeOrders"))activeOrders();if($("#historyBody"))history();if($("#menuAdminBody"))menuAdmin();if($("#refundBody"))refunds();});
