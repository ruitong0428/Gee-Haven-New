const orderStatuses=["New","Confirmed","Preparing","Completed"];
const orderLabels={New:"Order Placed",Confirmed:"Confirmed",Preparing:"Preparing",Completed:"Completed",Cancelled:"Cancelled",Refunded:"Refunded"};
function miniProgress(status){
  const idx=orderStatuses.indexOf(status);
  if(idx<0)return `<span class="badge">${orderLabels[status]||status}</span>`;
  return `<div class="mini-progress">${orderStatuses.map((s,i)=>`<span class="${i<=idx?"active":""}" title="${orderLabels[s]}"></span>`).join("")}</div><small>${orderLabels[status]}</small>`;
}
function detailMarkup(o,items,dbHistory){
  const history=[...(dbHistory||[]),...localOrderHistoryFor(o.id)].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const itemRows=(items||[]).map(i=>`<div class="summary-row"><span>${i.item_name} × ${i.quantity}</span><b>${money(i.item_total)}</b></div>`).join("");
  const historyRows=history.map(h=>`<div class="timeline-row"><b>${orderLabels[h.status]||h.status}</b><span>${new Date(h.created_at).toLocaleString()}</span></div>`).join("");
  return `<div class="detail-box"><h3>Order #${o.order_number||String(o.id).slice(0,8)}</h3><p class="sub">${o.customer_name||"Customer"}</p><h4>Items</h4>${itemRows||"-"}<h4>Price Details</h4><div class="summary-row"><span>Subtotal</span><b>${money(o.subtotal)}</b></div><div class="summary-row"><span>Discount</span><b>-${money(Math.max(0,Number(o.subtotal)-Number(o.service_charge)/.1-Number(o.total)+Number(o.sst)*0))}</b></div><div class="summary-row"><span>Service Charge</span><b>${money(o.service_charge)}</b></div><div class="summary-row"><span>SST</span><b>${money(o.sst)}</b></div><div class="summary-row total"><span>Total</span><b>${money(o.total)}</b></div><h4>Status Times</h4><div class="timeline">${historyRows||"<span class='sub'>No status history.</span>"}</div></div>`;
}
async function showOrderDetails(id){
  const [{data:o,error},{data:items},{data:history}]=await Promise.all([
    db.from("orders").select("*").eq("id",id).single(),
    db.from("order_items").select("*").eq("order_id",id).order("id"),
    db.from("order_status_history").select("*").eq("order_id",id).order("created_at")
  ]);
  if(error||!o)return toast("Unable to load order details.",true);
  const merged=applyLocalOrderOverride(o);
  const old=$("#orderDetailModal"); if(old)old.remove();
  document.body.insertAdjacentHTML("beforeend",`<div id="orderDetailModal" class="modal-backdrop"><div class="modal-card"><button class="modal-close" onclick="document.getElementById('orderDetailModal').remove()">×</button>${detailMarkup(merged,items,history)}</div></div>`);
}
async function renderOrders(data){
  const merged=data.map(applyLocalOrderOverride);
  const active=merged.filter(o=>["New","Confirmed","Preparing"].includes(o.status));
  const done=merged.filter(o=>["Completed","Cancelled","Refunded"].includes(o.status));
  const row=o=>`<div class="simple-order"><div><strong>#${o.order_number||String(o.id).slice(0,8)}</strong><span class="sub">${new Date(o.created_at).toLocaleString()}</span></div><div>${miniProgress(o.status)}</div><strong>${money(o.total)}</strong><div class="order-actions"><a class="btn secondary" href="track.html?id=${o.id}">Track</a><button class="btn secondary" onclick="showOrderDetails('${o.id}')">Order Details</button></div></div>`;
  $("#activeOrders").innerHTML=active.length?active.map(row).join(""):`<div class="empty">No active orders.</div>`;
  $("#historyOrders").innerHTML=done.length?done.map(row).join(""):`<div class="empty">No order history yet.</div>`;
}
async function loadMyOrders(){
  const user=await requireLogin();if(!user)return;
  const {data,error}=await db.from("orders").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
  if(error)return toast(error.message,true);
  await renderOrders(data||[]);
}
document.addEventListener("DOMContentLoaded",()=>{loadMyOrders();setInterval(loadMyOrders,5000);});
window.showOrderDetails=showOrderDetails;
