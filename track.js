const statuses=["New","Confirmed","Preparing","Completed"];
const statusLabels={New:"Order Placed",Confirmed:"Confirmed",Preparing:"Preparing",Completed:"Completed"};
function renderTrack(status){
  const index=statuses.indexOf(status);
  $("#trackSteps").innerHTML=statuses.map((s,i)=>`<div class="status ${i<=index?"active":""}"><span>${i+1}</span>${statusLabels[s]}</div>`).join("");
}
async function loadTrack(){
  const id=new URLSearchParams(location.search).get("id")||localStorage.getItem("gee_last_order"); if(!id)return;
  const user=await getUser(); if(!user)return;
  const {data:o,error}=await db.from("orders").select("*").eq("id",id).single();
  if(error||!o)return;
  if(user.id!==o.user_id && !localStorage.getItem("gee_admin_demo"))return;
  const merged=applyLocalOrderOverride(o);
  $("#trackId").textContent="#"+(merged.order_number||String(merged.id).slice(0,8));
  $("#trackCurrent").textContent=statusLabels[merged.status]||merged.status;
  renderTrack(merged.status);
}
document.addEventListener("DOMContentLoaded",()=>{loadTrack();setInterval(loadTrack,3000);});
