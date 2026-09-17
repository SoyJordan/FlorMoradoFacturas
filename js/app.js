const KEY='florMoradoDB_v1';
// ===== FINANZAS V1.4.1: tipos disponibles antes de migrar datos guardados =====
const FIN_ASSET_TYPES=['cash','savings','checking','wallet','other','receivable','asset'];
const FIN_LIABILITY_TYPES=['credit','debt','commitment'];
const FIN_LIQUID_TYPES=['cash','savings','checking','wallet'];
const FIN_TYPE_LABELS={cash:'Efectivo',savings:'Ahorros',checking:'Cuenta corriente',wallet:'Billetera digital',credit:'Tarjeta de crédito',debt:'Deuda / préstamo',receivable:'Cuenta por cobrar',asset:'Activo',commitment:'Pedido / compromiso pendiente',other:'Otra'};
const DEFAULTS={clients:[],products:[],sales:[],cashMovements:[],finance:{accounts:[],transactions:[],recurring:[]},seq:1,settings:{name:'Flor Morado Muebles',phone:'',address:'',email:'',social:'',city:'',footer:'Gracias por su compra.'}};
let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
const db={...DEFAULTS,...stored,settings:{...DEFAULTS.settings,...(stored.settings||{})}};
db.clients=Array.isArray(db.clients)?db.clients:[];
db.products=Array.isArray(db.products)?db.products:[];
db.sales=Array.isArray(db.sales)?db.sales:[];
db.cashMovements=Array.isArray(db.cashMovements)?db.cashMovements:[];
db.finance=db.finance&&typeof db.finance==='object'?db.finance:{accounts:[],transactions:[],recurring:[]};
db.finance.accounts=Array.isArray(db.finance.accounts)?db.finance.accounts:[];
db.finance.transactions=Array.isArray(db.finance.transactions)?db.finance.transactions:[];
db.finance.recurring=Array.isArray(db.finance.recurring)?db.finance.recurring:[];
// Normaliza tipos creados con versiones anteriores o valores con espacios/mayúsculas.
const FIN_TYPE_ALIASES={
  'cuenta por cobrar':'receivable','por cobrar':'receivable','receivable':'receivable',
  'activo':'asset','asset':'asset',
  'pedido / compromiso pendiente':'commitment','pedido pendiente':'commitment','compromiso':'commitment','commitment':'commitment',
  'deuda / préstamo':'debt','deuda':'debt','debt':'debt',
  'tarjeta de crédito':'credit','credit':'credit',
  'efectivo':'cash','cash':'cash','ahorros':'savings','cuenta de ahorros':'savings','savings':'savings',
  'cuenta corriente':'checking','checking':'checking','billetera digital':'wallet','wallet':'wallet','otra':'other','other':'other'
};
for(const a of db.finance.accounts){
  const raw=String(a.type||'other').trim();
  a.type=FIN_TYPE_ALIASES[raw.toLowerCase()]||raw.toLowerCase();
  if(FIN_LIABILITY_TYPES.includes(a.type)&&Number(a.opening||0)<0)a.opening=Math.abs(Number(a.opening||0));
}
for(const p of db.products){if(p.minStock===undefined)p.minStock=1;}
for(const s of db.sales){
  if(!s.orderStatus)s.orderStatus='Pendiente';
  if(s.deliveryDate===undefined)s.deliveryDate='';
  if(s.actualDeliveryDate===undefined)s.actualDeliveryDate='';
  if(s.shippingExpense===undefined)s.shippingExpense=0;
  if(s.otherExpenses===undefined)s.otherExpenses=0;
  if(!Array.isArray(s.payments))s.payments=[];
  if(!Array.isArray(s.items))s.items=[];
  for(const it of s.items)if(it.customDetails===undefined)it.customDetails='';
  if(s.payments.length){s.deposit=s.payments.reduce((a,p)=>a+Number(p.amount||0),0);s.balance=Math.max(0,Number(s.total||0)-s.deposit);}
}

const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0));
const save=()=>{localStorage.setItem(KEY,JSON.stringify(db));renderAll();};
const id=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random();
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const CO_TIME_ZONE='America/Bogota';
function colombiaParts(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:CO_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);
  return Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
}
const today=()=>{const x=colombiaParts();return `${x.year}-${x.month}-${x.day}`;};
const colombiaTime=()=>{const x=colombiaParts();return `${x.hour}:${x.minute}:${x.second}`;};
const nowStamp=()=>new Date().toISOString();
function movementDateTime(m){
  const date=String(m.date||'');
  if(m.time)return `${date} · ${String(m.time).slice(0,5)}`;
  if(m.createdAt){
    const d=new Date(m.createdAt);
    if(!isNaN(d))return new Intl.DateTimeFormat('es-CO',{timeZone:CO_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true}).format(d);
  }
  return date;
}
function movementSort(arr){
  return arr.map((m,i)=>({m,i})).sort((a,b)=>{
    const da=String(a.m.date||''),dbb=String(b.m.date||'');
    if(da!==dbb)return dbb.localeCompare(da);
    const ca=String(a.m.createdAt||''),cb=String(b.m.createdAt||'');
    if(ca||cb){const c=cb.localeCompare(ca);if(c)return c;}
    const ta=String(a.m.time||''),tb=String(b.m.time||'');
    if(ta||tb){const t=tb.localeCompare(ta);if(t)return t;}
    return b.i-a.i;
  }).map(x=>x.m);
}

function movementDayLabel(date){
  if(!date)return 'Sin fecha';
  const d=new Date(`${date}T12:00:00Z`);
  if(isNaN(d))return date;
  return new Intl.DateTimeFormat('es-CO',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
}
function movementRowsGrouped(arr,rowHtml){
  let last='';
  return arr.map(m=>{
    const day=String(m.date||'');
    const head=day!==last?`<div class="movement-day">${esc(movementDayLabel(day))}</div>`:'';
    last=day;
    return head+rowHtml(m);
  }).join('');
}

const activeSales=()=>db.sales.filter(s=>s.orderStatus!=='Cancelada');
let currentReceiptSaleId=null;

function show(v){$$('.view').forEach(x=>x.classList.toggle('active',x.id===v));$$('.tabs button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));window.scrollTo({top:0,behavior:'smooth'});} 
$$('.tabs button').forEach(b=>b.onclick=()=>show(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));

// ===== Atajo iOS · Buzón financiero sincronizado (V1.4.7) =====
function financeSyncConfig(){
  return {
    endpoint:String(db.settings.financeSyncEndpoint||'').trim().replace(/\/$/,''),
    token:String(db.settings.financeSyncToken||'').trim()
  };
}
function financeSyncReady(){const c=financeSyncConfig();return /^https:\/\//i.test(c.endpoint)&&c.token.length>=8;}
function financeSyncStatus(text,isError=false){
  const el=$('#finSyncStatus'); if(!el)return; el.textContent=text; el.classList.toggle('money-out',!!isError);
}
function findFinanceAccountByName(name){
  const q=String(name||'').trim().toLocaleLowerCase('es-CO');
  return db.finance.accounts.find(a=>String(a.name||'').trim().toLocaleLowerCase('es-CO')===q);
}
async function syncFinanceInbox({silent=false}={}){
  const c=financeSyncConfig();
  if(!financeSyncReady()){if(!silent)financeSyncStatus('Configura una URL HTTPS y una clave privada de mínimo 8 caracteres.',true);return {imported:0,skipped:0};}
  if(!navigator.onLine){if(!silent)financeSyncStatus('Sin conexión. La app sincronizará cuando vuelva Internet.',true);return {imported:0,skipped:0};}
  try{
    if(!silent)financeSyncStatus('Sincronizando…');
    const r=await fetch(c.endpoint,{method:'GET',headers:{'Authorization':'Bearer '+c.token,'Accept':'application/json'},cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const payload=await r.json();
    const rows=Array.isArray(payload.transactions)?payload.transactions:[];
    const importedIds=new Set(db.finance.transactions.map(t=>String(t.syncId||'')).filter(Boolean));
    const ack=[],missing=[]; let imported=0;
    for(const x of rows){
      const syncId=String(x.id||''); if(!syncId||importedIds.has(syncId)){if(syncId)ack.push(syncId);continue;}
      const type=x.type==='income'?'income':x.type==='expense'?'expense':'';
      const amount=Number(x.amount||0); const account=findFinanceAccountByName(x.accountName);
      if(!type||!(amount>0)||!account){missing.push(x);continue;}
      db.finance.transactions.push({
        id:id(),syncId,source:'ios-shortcut',date:String(x.date||today()).slice(0,10),time:String(x.time||colombiaTime()).slice(0,8),
        createdAt:x.createdAt||nowStamp(),type,fromId:type==='expense'?account.id:'',toId:type==='income'?account.id:'',
        category:String(x.category||'Otros'),amount,note:String(x.note||'').trim()
      });
      importedIds.add(syncId); ack.push(syncId); imported++;
    }
    if(imported){localStorage.setItem(KEY,JSON.stringify(db));renderAll();}
    if(ack.length){
      fetch(c.endpoint,{method:'PATCH',headers:{'Authorization':'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify({ack})}).catch(()=>{});
    }
    db.settings.financeSyncLastAt=nowStamp(); localStorage.setItem(KEY,JSON.stringify(db));
    const msg=missing.length?`${imported} importado(s). ${missing.length} pendiente(s): revisa que el nombre de la cuenta exista exactamente en Finanzas.`:`${imported} movimiento(s) nuevo(s). Sincronización al día.`;
    if(!silent)financeSyncStatus(msg,missing.length>0);
    return {imported,skipped:missing.length};
  }catch(e){if(!silent)financeSyncStatus('No se pudo sincronizar: '+e.message,true);return {imported:0,skipped:0,error:e};}
}
function refreshFinanceSyncUi(){
  const c=financeSyncConfig();
  if($('#finSyncEndpoint'))$('#finSyncEndpoint').value=c.endpoint;
  if($('#finSyncToken'))$('#finSyncToken').value=c.token;
  if($('#finSyncStatus')){
    const raw=db.settings.financeSyncLastAt;
    financeSyncStatus(financeSyncReady()?(raw?'Configurado · última sincronización '+new Date(raw).toLocaleString('es-CO'):'Configurado · pendiente de primera sincronización'):'Sin configurar.');
  }
}


function clientSales(clientId){return db.sales.filter(s=>s.clientId===clientId&&s.orderStatus!=='Cancelada');}
function renderClients(){
 $('#saleClient').innerHTML='<option value="">Seleccionar cliente</option>'+db.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
 $('#clientList').innerHTML=db.clients.length?db.clients.map(c=>{const sales=clientSales(c.id);const total=sales.reduce((a,s)=>a+Number(s.total||0),0);const debt=sales.reduce((a,s)=>a+Number(s.balance||0),0);return `<div class="row"><div><strong>${esc(c.name)}</strong><div class="meta">${esc(c.phone||'Sin teléfono')} · ${esc(c.address||'Sin dirección')}<br>${sales.length} compra(s) · Saldo ${money(debt)}</div></div><div class="right"><div class="row-actions"><button onclick="openClientProfile('${c.id}')">Ver ficha</button><button class="secondary" onclick="editClient('${c.id}')">Editar</button><button class="danger-btn" onclick="deleteClient('${c.id}')">Eliminar</button></div><div class="meta">Compras ${money(total)}</div></div></div>`}).join(''):'<p class="muted">Todavía no hay clientes.</p>';
}
window.deleteClient=x=>{if(db.sales.some(s=>s.clientId===x))return alert('Este cliente tiene ventas registradas. Para conservar el historial no se puede eliminar. Puedes editar sus datos.');if(confirm('¿Eliminar este cliente?')){db.clients=db.clients.filter(c=>c.id!==x);save();}};
window.editClient=x=>{const c=db.clients.find(z=>z.id===x);if(!c)return;$('#clientEditId').value=c.id;$('#clientName').value=c.name||'';$('#clientPhone').value=c.phone||'';$('#clientAddress').value=c.address||'';$('#clientNotes').value=c.notes||'';$('#clientFormTitle').textContent='Editar cliente';$('#addClient').textContent='Guardar cambios';$('#cancelClientEdit').classList.remove('hidden');show('clients');};
function clearClientForm(){['clientEditId','clientName','clientPhone','clientAddress','clientNotes'].forEach(x=>$('#'+x).value='');$('#clientFormTitle').textContent='Clientes';$('#addClient').textContent='Guardar cliente';$('#cancelClientEdit').classList.add('hidden');}
$('#cancelClientEdit').onclick=clearClientForm;
$('#addClient').onclick=()=>{const name=$('#clientName').value.trim();if(!name)return alert('Escribe el nombre del cliente.');const data={name,phone:$('#clientPhone').value.trim(),address:$('#clientAddress').value.trim(),notes:$('#clientNotes').value.trim()};const editId=$('#clientEditId').value;if(editId){const c=db.clients.find(x=>x.id===editId);if(c)Object.assign(c,data);}else db.clients.push({id:id(),...data});clearClientForm();save();};
window.openClientProfile=x=>{const c=db.clients.find(z=>z.id===x);if(!c)return;const sales=[...clientSales(x)].reverse();const total=sales.reduce((a,s)=>a+Number(s.total||0),0);const paid=sales.reduce((a,s)=>a+Number(s.deposit||0),0);const debt=sales.reduce((a,s)=>a+Number(s.balance||0),0);$('#clientProfile').innerHTML=`<div class="profile-head"><h2>${esc(c.name)}</h2><span>${esc(c.phone||'Sin teléfono')}</span></div><div class="profile-grid"><div><span>Total comprado</span><strong>${money(total)}</strong></div><div><span>Total abonado</span><strong>${money(paid)}</strong></div><div><span>Saldo pendiente</span><strong>${money(debt)}</strong></div><div><span>Número de compras</span><strong>${sales.length}</strong></div></div>${c.address?`<p><strong>Dirección:</strong> ${esc(c.address)}</p>`:''}${c.notes?`<p><strong>Notas:</strong> ${esc(c.notes)}</p>`:''}<h3>Historial</h3>${sales.length?sales.map(s=>`<div class="profile-sale" onclick="closeClientAndOpenSale('${s.id}')"><span><strong>${esc(s.number)}</strong><br>${esc(s.date)} · ${esc(s.orderStatus)}</span><strong>${money(s.total)}</strong></div>`).join(''):'<p class="muted">Sin compras.</p>'}`;$('#clientModal').classList.remove('hidden');};
window.closeClientAndOpenSale=x=>{$('#clientModal').classList.add('hidden');renderReceipt(db.sales.find(s=>s.id===x));};
$('#closeClientModal').onclick=()=>$('#clientModal').classList.add('hidden');

function productExtra(p){return [p.measures,p.color,p.material].filter(Boolean).join(' · ')}
function renderProducts(){
 $('#productList').innerHTML=db.products.length?db.products.map(p=>{const low=Number(p.stock||0)<=Number(p.minStock??1);return `<div class="row ${low?'low-stock-row':''}"><div><strong>${esc(p.name)}</strong>${low?'<span class="badge stock">Stock bajo</span>':''}<div class="meta">${esc(p.ref||'Sin ref.')} · ${esc(p.category||'Sin categoría')} · Stock: ${Number(p.stock||0)} / mínimo ${Number(p.minStock??1)}${productExtra(p)?'<br>'+esc(productExtra(p)):''}${p.details?'<br>'+esc(p.details):''}</div></div><div class="right"><strong>${money(p.price)}</strong><div class="meta">Costo ${money(p.cost)}</div><div class="row-actions"><button class="secondary" onclick="editProduct('${p.id}')">Editar</button><button class="secondary" onclick="adjustStock('${p.id}')">Stock</button></div></div></div>`}).join(''):'<p class="muted">Todavía no hay productos.</p>';
 refreshSaleItemSelects();
}
window.adjustStock=x=>{const p=db.products.find(z=>z.id===x);const n=prompt(`Nuevo stock para ${p.name}:`,p.stock);if(n!==null&&!isNaN(n)){p.stock=Number(n);save();}};
window.editProduct=x=>{const p=db.products.find(z=>z.id===x);if(!p)return;$('#prodEditId').value=p.id;$('#prodName').value=p.name||'';$('#prodRef').value=p.ref||'';$('#prodCategory').value=p.category||'';$('#prodMeasures').value=p.measures||'';$('#prodColor').value=p.color||'';$('#prodMaterial').value=p.material||'';$('#prodCost').value=p.cost||0;$('#prodPrice').value=p.price||0;$('#prodStock').value=p.stock||0;$('#prodMinStock').value=p.minStock??1;$('#prodDetails').value=p.details||'';$('#productFormTitle').textContent='Editar producto';$('#addProduct').textContent='Guardar cambios';$('#cancelProductEdit').classList.remove('hidden');show('inventory');window.scrollTo({top:0,behavior:'smooth'});};
function clearProductForm(){['prodEditId','prodName','prodRef','prodCategory','prodMeasures','prodColor','prodMaterial','prodCost','prodPrice','prodStock','prodDetails'].forEach(x=>$('#'+x).value='');$('#prodMinStock').value=1;$('#productFormTitle').textContent='Agregar producto';$('#addProduct').textContent='Guardar producto';$('#cancelProductEdit').classList.add('hidden');}
$('#cancelProductEdit').onclick=clearProductForm;
$('#addProduct').onclick=()=>{const name=$('#prodName').value.trim();if(!name)return alert('Escribe el nombre del producto.');const data={name,ref:$('#prodRef').value.trim(),category:$('#prodCategory').value.trim(),measures:$('#prodMeasures').value.trim(),color:$('#prodColor').value.trim(),material:$('#prodMaterial').value.trim(),cost:Number($('#prodCost').value||0),price:Number($('#prodPrice').value||0),stock:Number($('#prodStock').value||0),minStock:Number($('#prodMinStock').value||0),details:$('#prodDetails').value.trim()};const editId=$('#prodEditId').value;if(editId){const p=db.products.find(x=>x.id===editId);if(p)Object.assign(p,data);}else db.products.push({id:id(),...data});clearProductForm();save();};

function addSaleItem(){const d=document.createElement('div');d.className='sale-item-card';d.innerHTML=`<div class="sale-item"><label>Producto<select class="item-prod"></select></label><label>Cant.<input class="item-qty" type="number" min="1" value="1"></label><label>Precio<input class="item-price" type="number" min="0" step="1000"></label><button class="remove" aria-label="Eliminar producto">×</button></div><label class="custom-label">Personalización / especificaciones de este pedido<textarea class="item-custom" rows="2" placeholder="Ej. Tela gris 014, brazo derecho, 220 × 160 cm, patas color nogal..."></textarea></label>`;$('#saleItems').appendChild(d);d.querySelector('.remove').onclick=()=>{d.remove();calcSale();};d.querySelectorAll('input,select,textarea').forEach(e=>e.addEventListener('input',calcSale));d.querySelector('.item-prod').addEventListener('change',e=>{const p=db.products.find(x=>x.id===e.target.value);if(p)d.querySelector('.item-price').value=p.price;calcSale();});refreshSaleItemSelects();}
$('#addSaleItem').onclick=addSaleItem;
function refreshSaleItemSelects(){ $$('.item-prod').forEach(s=>{const cur=s.value;s.innerHTML='<option value="">Seleccionar</option>'+db.products.map(p=>`<option value="${p.id}">${esc(p.name)} (stock ${Number(p.stock||0)})</option>`).join('');s.value=cur;});}
function getSaleDraft(){const items=$$('.sale-item-card').map(card=>{const r=card.querySelector('.sale-item'),productId=r.querySelector('.item-prod').value,p=db.products.find(x=>x.id===productId);return{productId,qty:Number(r.querySelector('.item-qty').value||0),price:Number(r.querySelector('.item-price').value||0),customDetails:card.querySelector('.item-custom').value.trim(),name:p?.name||'',ref:p?.ref||'',measures:p?.measures||'',color:p?.color||'',material:p?.material||'',details:p?.details||'',cost:Number(p?.cost||0)}}).filter(x=>x.productId&&x.qty>0);const subtotal=items.reduce((a,x)=>a+x.qty*x.price,0);const shipping=Number($('#saleShipping').value||0),discount=Number($('#saleDiscount').value||0),deposit=Number($('#saleDeposit').value||0),shippingExpense=Number($('#saleShippingExpense').value||0),otherExpenses=Number($('#saleOtherExpenses').value||0);const total=Math.max(0,subtotal+shipping-discount),balance=Math.max(0,total-deposit),cogs=items.reduce((a,x)=>a+Number(x.cost||0)*x.qty,0),profit=total-cogs-shippingExpense-otherExpenses;return{items,subtotal,shipping,discount,deposit,total,balance,shippingExpense,otherExpenses,profit};}
function calcSale(){const s=getSaleDraft();$('#saleSubtotal').textContent=money(s.subtotal);$('#saleTotal').textContent=money(s.total);$('#saleBalance').textContent=money(s.balance);$('#saleProfit').textContent=money(s.profit);}['saleShipping','saleDiscount','saleDeposit','saleShippingExpense','saleOtherExpenses'].forEach(x=>$('#'+x).addEventListener('input',calcSale));

$('#saveSale').onclick=()=>{const client=db.clients.find(c=>c.id===$('#saleClient').value);if(!client)return alert('Selecciona un cliente.');const d=getSaleDraft();if(!d.items.length)return alert('Agrega al menos un producto.');for(const it of d.items){const p=db.products.find(x=>x.id===it.productId);if(p&&Number(p.stock)<it.qty&&!confirm(`${p.name} tiene stock ${p.stock} y estás vendiendo ${it.qty}. ¿Continuar?`))return;}const number='FM-'+String(db.seq).padStart(4,'0');const sale={id:id(),number,date:$('#saleDate').value||today(),time:colombiaTime(),createdAt:nowStamp(),deliveryDate:$('#saleDeliveryDate').value||'',actualDeliveryDate:$('#saleOrderStatus').value==='Entregada'?today():'',orderStatus:$('#saleOrderStatus').value||'Pendiente',clientId:client.id,payment:$('#salePayment').value,notes:$('#saleNotes').value.trim(),...d,payments:d.deposit?[{id:id(),date:$('#saleDate').value||today(),time:colombiaTime(),createdAt:nowStamp(),amount:d.deposit,method:$('#salePayment').value,note:'Abono inicial'}]:[]};db.seq++;db.sales.push(sale);for(const it of d.items){const p=db.products.find(x=>x.id===it.productId);if(p)p.stock-=it.qty;}save();renderReceipt(sale);resetSale();};
function resetSale(){$('#saleClient').value='';$('#saleDate').value=today();$('#saleDeliveryDate').value='';$('#saleOrderStatus').value='Pendiente';$('#saleShipping').value=0;$('#saleDiscount').value=0;$('#saleDeposit').value=0;$('#saleShippingExpense').value=0;$('#saleOtherExpenses').value=0;$('#saleNotes').value='';$('#saleItems').innerHTML='';addSaleItem();calcSale();}

function registerPayment(saleId){const s=db.sales.find(z=>z.id===saleId);if(!s||s.orderStatus==='Cancelada')return alert('No se pueden registrar abonos en una venta cancelada.');if(s.balance<=0)return;const raw=prompt(`Saldo actual ${money(s.balance)}.\nValor del abono:`);if(raw===null)return;const a=Number(String(raw).replace(/[^0-9.-]/g,''));if(!a||a<=0)return alert('Ingresa un valor válido.');if(a>s.balance&&!confirm(`El abono supera el saldo por ${money(a-s.balance)}. ¿Registrarlo de todas formas?`))return;const date=prompt('Fecha del abono (AAAA-MM-DD):',today())||today();const method=prompt('Método de pago:',s.payment||'Efectivo')||'';const note=prompt('Nota del abono (opcional):','')||'';s.payments=s.payments||[];s.payments.push({id:id(),date,time:colombiaTime(),createdAt:nowStamp(),amount:a,method,note});s.deposit=(s.payments||[]).reduce((sum,p)=>sum+Number(p.amount||0),0);s.balance=Math.max(0,s.total-s.deposit);save();if(!$('#modal').classList.contains('hidden'))renderReceipt(s);}
window.addPayment=registerPayment;
function paymentStatus(s){if(Number(s.balance||0)<=0)return 'Pagada';if(Number(s.deposit||0)>0)return 'Abonada';return 'Pendiente';}
function renderReceivables(){const due=activeSales().filter(s=>s.balance>0);$('#receivableList').innerHTML=due.length?due.map(s=>{const c=db.clients.find(x=>x.id===s.clientId);return `<div class="row"><div><strong>${esc(c?.name||'Cliente')}</strong><div class="meta">${s.number} · ${s.date}${s.deliveryDate?` · Entrega ${esc(s.deliveryDate)}`:''} · Total ${money(s.total)}</div></div><div class="right"><strong>${money(s.balance)}</strong><div class="row-actions"><button onclick="addPayment('${s.id}')">Registrar abono</button><button class="secondary" onclick="openSale('${s.id}')">Ver</button></div></div></div>`}).join(''):'<p class="muted">No hay saldos pendientes.</p>';}

const ORDER_STATUSES=['Pendiente','En producción','Listo para entregar','Entregada','Cancelada'];
function setOrderStatus(saleId){const s=db.sales.find(z=>z.id===saleId);if(!s)return;const menu=ORDER_STATUSES.map((x,i)=>`${i+1}. ${x}`).join('\n');const raw=prompt(`Estado actual: ${s.orderStatus||'Pendiente'}\n\n${menu}\n\nEscribe el número del nuevo estado:`);if(raw===null)return;const next=ORDER_STATUSES[Number(raw)-1];if(!next)return alert('Opción no válida.');if(next==='Cancelada'&&s.orderStatus!=='Cancelada'){if(!confirm('Al cancelar la venta, dejará de contar en ventas/cartera y las unidades se devolverán al inventario. Los abonos ya recibidos se conservarán en el historial de caja. ¿Continuar?'))return;for(const it of s.items||[]){const p=db.products.find(x=>x.id===it.productId);if(p)p.stock=Number(p.stock||0)+Number(it.qty||0);}s.stockRestoredOnCancel=true;}
 if(s.orderStatus==='Cancelada'&&next!=='Cancelada'&&s.stockRestoredOnCancel){for(const it of s.items||[]){const p=db.products.find(x=>x.id===it.productId);if(p)p.stock=Number(p.stock||0)-Number(it.qty||0);}s.stockRestoredOnCancel=false;}
 s.orderStatus=next;if(next==='Entregada'&&!s.actualDeliveryDate)s.actualDeliveryDate=today();if(next!=='Entregada')s.actualDeliveryDate='';save();if(currentReceiptSaleId===saleId)renderReceipt(s);}
window.changeSaleStatus=setOrderStatus;

function renderHistory(){const q=$('#historySearch').value.toLowerCase(),status=$('#historyStatus').value;const arr=[...db.sales].reverse().filter(s=>{const c=db.clients.find(x=>x.id===s.clientId);return (!q||s.number.toLowerCase().includes(q)||(c?.name||'').toLowerCase().includes(q))&&(!status||s.orderStatus===status)});$('#historyList').innerHTML=arr.length?arr.map(s=>{const c=db.clients.find(x=>x.id===s.clientId),ps=paymentStatus(s);return `<div class="row"><div><strong>${s.number} · ${esc(c?.name||'Cliente')}</strong><div class="meta">${s.date}${s.deliveryDate?` · Entrega ${esc(s.deliveryDate)}`:''} · ${money(s.total)}</div><div class="badge-row"><span class="badge order ${statusClass(s.orderStatus)}">${esc(s.orderStatus||'Pendiente')}</span><span class="badge ${ps==='Pagada'?'paid':ps==='Abonada'?'partial':'debt'}">${ps}${s.balance>0?' · '+money(s.balance):''}</span></div></div><div class="right"><div class="meta">Utilidad ${money(saleProfit(s))}</div><div class="row-actions">${s.balance>0&&s.orderStatus!=='Cancelada'?`<button onclick="addPayment('${s.id}')">+ Abono</button>`:''}<button class="secondary" onclick="changeSaleStatus('${s.id}')">Estado</button><button class="secondary" onclick="openSale('${s.id}')">Ver</button><button class="danger-btn" onclick="deleteSale('${s.id}')">Eliminar</button></div></div></div>`}).join(''):'<p class="muted">No hay ventas.</p>';}
function statusClass(s){return s==='Entregada'?'delivered':s==='Cancelada'?'cancelled':s==='Listo para entregar'?'ready':s==='En producción'?'production':'pending';}
function deleteSale(saleId){const s=db.sales.find(z=>z.id===saleId);if(!s)return;const c=db.clients.find(x=>x.id===s.clientId);const ok=confirm(`¿Eliminar definitivamente ${s.number}${c?.name?' de '+c.name:''}?\n\nSe eliminarán también sus abonos y el saldo pendiente. Las unidades vendidas se devolverán al inventario si todavía no fueron devueltas por una cancelación.\n\nEsta acción no se puede deshacer.`);if(!ok)return;if(!s.stockRestoredOnCancel){for(const it of (s.items||[])){const p=db.products.find(x=>x.id===it.productId);if(p)p.stock=Number(p.stock||0)+Number(it.qty||0);}}db.sales=db.sales.filter(z=>z.id!==saleId);if(currentReceiptSaleId===saleId){$('#modal').classList.add('hidden');currentReceiptSaleId=null;}save();}
window.deleteSale=deleteSale;
$('#historySearch').addEventListener('input',renderHistory);$('#historyStatus').addEventListener('change',renderHistory);window.openSale=x=>renderReceipt(db.sales.find(s=>s.id===x));

function receiptContact(){const b=db.settings;return [b.address,[b.city,b.phone].filter(Boolean).join(' · '),b.email,b.social].filter(Boolean).map(esc).join('<br>')}
function itemDescription(it){const p=db.products.find(x=>x.id===it.productId)||{};const d={name:it.name||p.name||'Producto',ref:it.ref||p.ref||'',measures:it.measures||p.measures||'',color:it.color||p.color||'',material:it.material||p.material||'',details:it.details||p.details||'',customDetails:it.customDetails||''};const extra=[d.ref?`Ref. ${d.ref}`:'',d.measures,d.color,d.material,d.details].filter(Boolean).map(esc).join(' · ');return `<strong>${esc(d.name)}</strong>${extra?`<span class="item-detail">${extra}</span>`:''}${d.customDetails?`<span class="item-custom-print"><b>Personalización:</b> ${esc(d.customDetails)}</span>`:''}`;}
function renderReceipt(s){if(!s)return;currentReceiptSaleId=s.id;const c=db.clients.find(x=>x.id===s.clientId);const rows=s.items.map(it=>`<tr><td>${itemDescription(it)}</td><td>${it.qty}</td><td>${money(it.price)}</td><td>${money(it.qty*it.price)}</td></tr>`).join('');const pays=(s.payments||[]);const payRows=pays.length?pays.map((p,i)=>`<div class="payment-row"><span>${i+1}. ${esc(p.date||'')} ${p.method?`· ${esc(p.method)}`:''}${p.note?` · ${esc(p.note)}`:''}</span><strong>${money(p.amount)}</strong></div>`).join(''):'<span class="muted">Sin abonos registrados.</span>';const b=db.settings;$('#receipt').innerHTML=`<div class="receipt"><div class="receipt-head"><img src="assets/logo-flor-morado.jpg" class="receipt-logo" alt="Logo"><div class="receipt-brand"><div class="receipt-kicker">COMPROBANTE DE VENTA / CUENTA DE COBRO</div><h2>${esc(b.name||'Flor Morado Muebles')}</h2><div class="contact">${receiptContact()}</div></div><div class="receipt-number"><span>Comprobante</span><strong>${esc(s.number)}</strong><span>${esc(s.date)}</span></div></div><div class="client-box"><strong>Cliente:</strong> ${esc(c?.name||'')}<br>${c?.phone?`<strong>Teléfono:</strong> ${esc(c.phone)}<br>`:''}${c?.address?`<strong>Dirección:</strong> ${esc(c.address)}<br>`:''}<strong>Estado del pedido:</strong> ${esc(s.orderStatus||'Pendiente')}${s.deliveryDate?`<br><strong>Fecha prometida de entrega:</strong> ${esc(s.deliveryDate)}`:''}${s.actualDeliveryDate?`<br><strong>Entregado:</strong> ${esc(s.actualDeliveryDate)}`:''}</div><table class="receipt-table"><thead><tr><th>Producto / descripción</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="receipt-total"><div><span>Subtotal</span><strong>${money(s.subtotal)}</strong></div><div><span>Transporte</span><strong>${money(s.shipping)}</strong></div><div><span>Descuento</span><strong>-${money(s.discount)}</strong></div><div class="grand"><span>Total</span><strong>${money(s.total)}</strong></div><div><span>Abonado</span><strong>${money(s.deposit)}</strong></div><div class="grand"><span>Saldo</span><strong>${money(s.balance)}</strong></div></div><div class="payments-box"><h4>Abonos registrados</h4>${payRows}</div><p><strong>Forma de pago inicial:</strong> ${esc(s.payment||'')}</p>${s.notes?`<p><strong>Observaciones:</strong> ${esc(s.notes)}</p>`:''}<div class="receipt-footer">${b.footer?`<div>${esc(b.footer)}</div>`:''}<div>Documento interno de venta. No constituye factura electrónica.</div></div></div>`;$('#paymentFromReceipt').classList.toggle('hidden',!(s.balance>0&&s.orderStatus!=='Cancelada'));$('#modal').classList.remove('hidden');}
$('#paymentFromReceipt').onclick=()=>currentReceiptSaleId&&registerPayment(currentReceiptSaleId);$('#statusFromReceipt').onclick=()=>currentReceiptSaleId&&setOrderStatus(currentReceiptSaleId);$('#deleteReceipt').onclick=()=>currentReceiptSaleId&&deleteSale(currentReceiptSaleId);$('#closeModal').onclick=$('#closeModal2').onclick=()=>{$('#modal').classList.add('hidden');currentReceiptSaleId=null;};

// ===== PDF / compartir comprobante · V1.4.8 =====
// Genera un PDF real con apariencia mucho más cercana al comprobante visual de la app:
// colores de Flor Morado, logo, bloques destacados y distribución tipo plantilla.
function pdfCp1252(ch){
  const cp=ch.codePointAt(0);
  if(cp>=32&&cp<=126)return cp;
  if(cp>=160&&cp<=255)return cp;
  const map={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
  return map[cp]??63;
}
function pdfLiteral(value){
  let out='(';
  for(const ch of String(value??'')){
    const b=pdfCp1252(ch);
    if(b===40||b===41||b===92)out+='\\'+String.fromCharCode(b);
    else if(b<32||b>126)out+='\\'+b.toString(8).padStart(3,'0');
    else out+=String.fromCharCode(b);
  }
  return out+')';
}
function pdfPlainItemDescription(it){
  const p=db.products.find(x=>x.id===it.productId)||{};
  const parts=[it.name||p.name||'Producto'];
  const ref=it.ref||p.ref||''; if(ref)parts.push('Ref. '+ref);
  for(const x of [it.measures||p.measures||'',it.color||p.color||'',it.material||p.material||'',it.details||p.details||''])if(x)parts.push(x);
  const custom=it.customDetails||''; if(custom)parts.push('Personalización: '+custom);
  return parts.join(' · ');
}
function pdfWrap(text,maxChars){
  const src=String(text??'').replace(/\s+/g,' ').trim(); if(!src)return [''];
  const words=src.split(' '),lines=[]; let line='';
  for(const w of words){
    if(w.length>maxChars){if(line){lines.push(line);line='';} for(let i=0;i<w.length;i+=maxChars)lines.push(w.slice(i,i+maxChars)); continue;}
    const next=line?line+' '+w:w;
    if(next.length>maxChars){if(line)lines.push(line);line=w;}else line=next;
  }
  if(line)lines.push(line); return lines;
}
function pdfAscii(str){return new TextEncoder().encode(str);}
function pdfConcat(parts){const len=parts.reduce((a,p)=>a+(p?p.length:0),0);const out=new Uint8Array(len);let off=0;for(const p of parts){if(!p)continue;out.set(p,off);off+=p.length;}return out;}
function pdfDataUrlToBytes(dataUrl){const b64=String(dataUrl||'').split(',')[1]||'';const bin=atob(b64);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function pdfLoadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
async function pdfLogoData(){
  try{
    const url=new URL('assets/logo-flor-morado.jpg',window.location.href).href;
    const [resp,img]=await Promise.all([fetch(url),pdfLoadImage(url)]);
    const bytes=new Uint8Array(await resp.arrayBuffer());
    return {bytes,width:img.naturalWidth||300,height:img.naturalHeight||300};
  }catch(err){
    console.warn('No fue posible cargar el logo para el PDF.',err);
    return null;
  }
}
async function buildReceiptPdfBlobFallback(s){
  const PAGE_W=595.28,PAGE_H=841.89,M=38,TOP=802,BOTTOM=38;
  const C={
    purple:[0.365,0.137,0.643],
    cyan:[0.075,0.616,0.71],
    text:[0.09,0.075,0.11],
    muted:[0.38,0.35,0.39],
    line:[0.87,0.84,0.9],
    softPurple:[0.945,0.91,0.985],
    softerPurple:[0.988,0.976,0.996],
    softCyan:[0.969,0.988,0.992],
    cyanLine:[0.843,0.941,0.957],
    white:[1,1,1],
    warn:[0.31,0.125,0.553]
  };
  const logo=await pdfLogoData();
  const pages=[]; let ops=[],y=TOP;
  const fmt=n=>Number(n).toFixed(2).replace(/\.00$/,'');
  const rgb=a=>a.map(v=>fmt(v)).join(' ');
  const txt=(x,yy,t,size=10,bold=false,color=C.text)=>{ops.push(`BT ${rgb(color)} rg /F${bold?2:1} ${fmt(size)} Tf 1 0 0 1 ${fmt(x)} ${fmt(yy)} Tm ${pdfLiteral(t)} Tj ET\n`);};
  const line=(x1,y1,x2,y2,w=.6,color=C.line)=>ops.push(`${rgb(color)} RG ${fmt(w)} w ${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S\n`);
  const rect=(x,yy,w,h,opt={})=>{const fill=opt.fill||null,stroke=('stroke' in opt)?opt.stroke:C.line,lineW=opt.lineW??0.8;let s='';if(fill)s+=`${rgb(fill)} rg `;if(stroke)s+=`${rgb(stroke)} RG ${fmt(lineW)} w `;s+=`${fmt(x)} ${fmt(yy)} ${fmt(w)} ${fmt(h)} re `;s+=fill&&stroke?'B':fill?'f':stroke?'S':'n';ops.push(s+'\n');};
  const image=(name,x,yy,w,h)=>ops.push(`q ${fmt(w)} 0 0 ${fmt(h)} ${fmt(x)} ${fmt(yy)} cm /${name} Do Q\n`);
  const pagePush=()=>{if(ops.length)pages.push(ops.join(''));ops=[];y=TOP;};
  const ensure=(h)=>{if(y-h<BOTTOM){pagePush();header(true);}};
  const writeWrapped=(text,x,maxChars,size=9,bold=false,leading=12,color=C.text)=>{const lines=pdfWrap(text,maxChars);ensure(lines.length*leading+2);for(const l of lines){txt(x,y,l,size,bold,color);y-=leading;}return lines.length;};
  const b=db.settings,c=db.clients.find(x=>x.id===s.clientId);
  const header=(continued=false)=>{
    const logoSize=64;
    if(logo)image('Im1',M,TOP-64,logoSize,logoSize);
    txt(M+(logo?78:0),TOP-5,'COMPROBANTE DE VENTA / CUENTA DE COBRO',9,true,C.cyan);
    txt(M+(logo?78:0),TOP-26,b.name||'Flor Morado Muebles',20,true,C.purple);
    const contact=[b.address,[b.city,b.phone].filter(Boolean).join(' · '),b.email,b.social].filter(Boolean).join(' · ');
    let cy=TOP-40;
    for(const l of pdfWrap(contact,58)) { txt(M+(logo?78:0),cy,l,8,false,C.muted); cy-=10; }
    const boxX=428,boxY=TOP-56,boxW=129,boxH=58;
    rect(boxX,boxY,boxW,boxH,{fill:C.softerPurple,stroke:C.line,lineW:0.9});
    txt(boxX+10,TOP-14,continued?'Continuación':'Comprobante',8,false,C.muted);
    txt(boxX+10,TOP-31,s.number||'',13,true,C.purple);
    txt(boxX+10,TOP-46,s.date||'',8,false,C.muted);
    line(M,TOP-74,PAGE_W-M,TOP-74,2,C.purple);
    line(M,TOP-78,PAGE_W-M,TOP-78,1.2,C.cyan);
    y=TOP-98;
  };
  header(false);

  const clientLines=[];
  clientLines.push({label:'Cliente:',value:c?.name||''});
  if(c?.phone)clientLines.push({label:'Teléfono:',value:c.phone});
  if(c?.address)clientLines.push({label:'Dirección:',value:c.address});
  clientLines.push({label:'Estado del pedido:',value:s.orderStatus||'Pendiente'});
  if(s.deliveryDate)clientLines.push({label:'Fecha prometida de entrega:',value:s.deliveryDate});
  if(s.actualDeliveryDate)clientLines.push({label:'Entregado:',value:s.actualDeliveryDate});
  let clientHeight=14;
  clientLines.forEach(r=>{clientHeight+=Math.max(14,pdfWrap(r.value,62).length*12);});
  ensure(clientHeight+10);
  rect(M,y-clientHeight,PAGE_W-2*M,clientHeight,{fill:C.softerPurple,stroke:C.line,lineW:0.8});
  let yy=y-16;
  clientLines.forEach(r=>{
    txt(M+10,yy,r.label,9,true,C.text);
    const lines=pdfWrap(r.value,62);
    txt(M+98,yy,lines[0]||'',9,false,C.text);
    for(let i=1;i<lines.length;i++)txt(M+98,yy-i*12,lines[i],9,false,C.text);
    yy-=Math.max(14,lines.length*12);
  });
  y-=clientHeight+16;

  ensure(36);
  rect(M,y-20,PAGE_W-2*M,20,{fill:C.softPurple,stroke:C.line,lineW:0.6});
  txt(M+8,y-13,'Producto / descripción',9,true,C.purple);
  txt(357,y-13,'Cant.',9,true,C.purple);
  txt(411,y-13,'Precio',9,true,C.purple);
  txt(504,y-13,'Total',9,true,C.purple);
  y-=28;

  const tableHeader=()=>{rect(M,y-20,PAGE_W-2*M,20,{fill:C.softPurple,stroke:C.line,lineW:0.6});txt(M+8,y-13,'Producto / descripción',9,true,C.purple);txt(357,y-13,'Cant.',9,true,C.purple);txt(411,y-13,'Precio',9,true,C.purple);txt(504,y-13,'Total',9,true,C.purple);y-=28;};

  for(const it of (s.items||[])){
    const desc=pdfWrap(pdfPlainItemDescription(it),50);
    const rowH=Math.max(24,desc.length*11+10);
    ensure(rowH+10);
    if(pages.length>0&&y>TOP-110)tableHeader();
    const rowBottom=y-rowH+6;
    line(M,rowBottom,PAGE_W-M,rowBottom,0.25,C.line);
    const yyItem=y-1;
    desc.forEach((l,i)=>txt(M+4,yyItem-i*11,l,8.5,i===0,C.text));
    txt(368,yyItem,String(it.qty||0),8.5,false,C.text);
    txt(401,yyItem,money(it.price),8.5,false,C.text);
    txt(489,yyItem,money(Number(it.qty||0)*Number(it.price||0)),8.5,false,C.text);
    y-=rowH;
  }
  y-=8;

  const totalsTop=y; const totalsX=346, totalsW=PAGE_W-M-totalsX;
  ensure(118);
  line(totalsX,totalsTop, PAGE_W-M, totalsTop, 2.2, C.cyan);
  const totalLine=(label,val,bold=false)=>{txt(totalsX,y,label,9,bold,bold?C.purple:C.text);txt(481,y,val,9,bold,bold?C.purple:C.text);y-=14;};
  totalLine('Subtotal',money(s.subtotal));
  totalLine('Transporte',money(s.shipping));
  totalLine('Descuento','-'+money(s.discount));
  totalLine('TOTAL',money(s.total),true);
  totalLine('Abonado',money(s.deposit));
  totalLine('SALDO',money(s.balance),true);
  y-=4;

  const payRows=s.payments||[];
  let payHeight=34+(payRows.length?payRows.reduce((a,p,i)=>a+Math.max(16,pdfWrap(`${i+1}. ${p.date||''}${p.method?' · '+p.method:''}${p.note?' · '+p.note:''} — ${money(p.amount)}`,90).length*11),0):14);
  ensure(payHeight+10);
  rect(M,y-payHeight,PAGE_W-2*M,payHeight,{fill:C.softCyan,stroke:C.cyanLine,lineW:0.8});
  txt(M+12,y-16,'Abonos registrados',10,true,C.cyan);
  let py=y-32;
  if(!payRows.length){txt(M+12,py,'Sin abonos registrados.',8.5,false,C.muted);py-=12;}
  else for(const [i,p] of payRows.entries()){
    const lines=pdfWrap(`${i+1}. ${p.date||''}${p.method?' · '+p.method:''}${p.note?' · '+p.note:''} — ${money(p.amount)}`,90);
    lines.forEach((l,idx)=>txt(M+12,py-idx*11,l,8.5,false,C.text));
    py-=Math.max(15,lines.length*11+2);
    line(M+12,py+4,PAGE_W-M-12,py+4,0.25,C.cyanLine);
  }
  y-=payHeight+14;

  ensure(70);
  txt(M,y,'Forma de pago inicial:',9,true,C.text); txt(M+105,y,s.payment||'',9,false,C.text); y-=15;
  if(s.notes){
    txt(M,y,'Observaciones:',9,true,C.text); y-=12;
    writeWrapped(s.notes,M,92,8.5,false,11,C.text);
    y-=4;
  }
  line(M,y,PAGE_W-M,y,0.7,C.line); y-=12;
  if(b.footer){writeWrapped(b.footer,M,92,8,false,10,C.muted);}
  writeWrapped('Documento interno de venta. No constituye factura electrónica.',M,92,7.5,false,9,C.muted);
  if(ops.length)pages.push(ops.join(''));

  const objects=[]; const add=o=>{objects.push(o);return objects.length;};
  const catalogId=add([]); const pagesId=add([]);
  const fontId=add([pdfAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')]);
  const boldId=add([pdfAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')]);
  let imageId=null;
  if(logo&&logo.bytes?.length){
    const head=pdfAscii(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`);
    const tail=pdfAscii('\nendstream');
    imageId=add([head,logo.bytes,tail]);
  }
  const pageIds=[];
  for(const stream of pages){
    const contentId=add([pdfAscii(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)]);
    const res=`<< /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >>${imageId?` /XObject << /Im1 ${imageId} 0 R >>`:''} >>`;
    const pageId=add([pdfAscii(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${fmt(PAGE_W)} ${fmt(PAGE_H)}] /Resources ${res} /Contents ${contentId} 0 R >>`)]);
    pageIds.push(pageId);
  }
  objects[catalogId-1]=[pdfAscii(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)];
  objects[pagesId-1]=[pdfAscii(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] >>`)];

  const chunks=[pdfAscii('%PDF-1.4\n%FM-PDF\n')];
  const offsets=[0]; let offset=chunks[0].length;
  for(let i=0;i<objects.length;i++){
    const start=pdfAscii(`${i+1} 0 obj\n`), end=pdfAscii('\nendobj\n');
    offsets.push(offset);
    chunks.push(start,...objects[i],end);
    offset+=start.length+objects[i].reduce((a,p)=>a+p.length,0)+end.length;
  }
  const xrefOffset=offset;
  let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  const trailer=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(pdfAscii(xref),pdfAscii(trailer));
  return new Blob(chunks,{type:'application/pdf'});
}

async function receiptImageAsDataUrl(src){
  try{
    const r=await fetch(src); const b=await r.blob();
    return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(b);});
  }catch(e){return src;}
}
function canvasToJpegBytes(canvas,quality=.94){
  const url=canvas.toDataURL('image/jpeg',quality);
  return pdfDataUrlToBytes(url);
}
function buildJpegPagesPdf(jpegs){
  const PAGE_W=595.28,PAGE_H=841.89,M=22;
  const objs=[];const add=parts=>{objs.push(parts);return objs.length;};
  const catalogId=add([]),pagesId=add([]),pageIds=[];
  for(const pg of jpegs){
    const imgHead=pdfAscii(`<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`);
    const imgId=add([imgHead,pg.bytes,pdfAscii('\nendstream')]);
    const innerW=PAGE_W-2*M,innerH=PAGE_H-2*M;
    const scale=Math.min(innerW/pg.width,innerH/pg.height);
    const drawW=pg.width*scale,drawH=pg.height*scale;
    const x=(PAGE_W-drawW)/2,y=(PAGE_H-drawH)/2;
    const stream=`q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q\n`;
    const contentId=add([pdfAscii(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)]);
    const pageId=add([pdfAscii(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im1 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`)]);
    pageIds.push(pageId);
  }
  objs[catalogId-1]=[pdfAscii(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)];
  objs[pagesId-1]=[pdfAscii(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`)];
  const chunks=[pdfAscii('%PDF-1.4\n%FM-VISUAL\n')],offsets=[0];let offset=chunks[0].length;
  for(let i=0;i<objs.length;i++){
    offsets.push(offset);
    const a=pdfAscii(`${i+1} 0 obj\n`),b=pdfAscii('\nendobj\n');chunks.push(a,...objs[i],b);
    offset+=a.length+objs[i].reduce((n,x)=>n+x.length,0)+b.length;
  }
  const xrefOffset=offset;let xref=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  chunks.push(pdfAscii(xref),pdfAscii(`trailer\n<< /Size ${objs.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob(chunks,{type:'application/pdf'});
}
async function buildReceiptVisualPdfBlob(s){
  const source=document.querySelector('#receipt .receipt');
  if(!source)throw new Error('Vista de comprobante no disponible');
  const clone=source.cloneNode(true);
  // El logo se incrusta como data URL para que el SVG/canvas de iOS no dependa de recursos externos.
  const imgs=[...clone.querySelectorAll('img')];
  for(const img of imgs){
    const abs=new URL(img.getAttribute('src')||'',location.href).href;
    img.setAttribute('src',await receiptImageAsDataUrl(abs));
  }
  let css='';
  try{css=await (await fetch(new URL('css/styles.css',location.href).href)).text();}catch(e){}
  const w=Math.max(680,source.scrollWidth||source.getBoundingClientRect().width||680);
  const h=Math.max(300,source.scrollHeight||source.getBoundingClientRect().height||300);
  const html=`<div xmlns="http://www.w3.org/1999/xhtml" style="background:white;width:${w}px;padding:28px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${clone.outerHTML}</div>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h+56}" viewBox="0 0 ${w} ${h+56}"><foreignObject x="0" y="0" width="100%" height="100%"><style xmlns="http://www.w3.org/1999/xhtml">${css.replace(/<\/style/gi,'<\\/style')}</style>${html}</foreignObject></svg>`;
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
  try{
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});
    const scale=Math.min(2,1600/w);
    const canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round((h+56)*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    // Divide la captura en páginas A4 sin deformarla.
    const pageRatio=(841.89-44)/(595.28-44); // alto/ ancho útil
    const sliceH=Math.floor(canvas.width*pageRatio);
    const pages=[];
    for(let top=0;top<canvas.height;top+=sliceH){
      const curH=Math.min(sliceH,canvas.height-top);
      const part=document.createElement('canvas');part.width=canvas.width;part.height=curH;
      const pctx=part.getContext('2d');pctx.fillStyle='#fff';pctx.fillRect(0,0,part.width,part.height);pctx.drawImage(canvas,0,top,canvas.width,curH,0,0,part.width,part.height);
      pages.push({bytes:canvasToJpegBytes(part,.94),width:part.width,height:part.height});
    }
    if(!pages.length)throw new Error('No se pudo rasterizar el comprobante');
    return buildJpegPagesPdf(pages);
  }finally{URL.revokeObjectURL(url);}
}
async function buildReceiptPdfBlob(s){
  try{return await buildReceiptVisualPdfBlob(s);}catch(err){console.warn('PDF visual no disponible; se usa respaldo vectorial.',err);return await buildReceiptPdfBlobFallback(s);}
}
async function shareReceiptPdf(){
  const s=db.sales.find(x=>x.id===currentReceiptSaleId); if(!s)return alert('No se encontró el comprobante.');
  try{
    const blob=await buildReceiptPdfBlob(s);
    const safe=String(s.number||'comprobante').replace(/[^a-z0-9_-]+/gi,'-');
    const file=new File([blob],`${safe}.pdf`,{type:'application/pdf'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:`Comprobante ${s.number||''}`,text:`Comprobante de ${db.settings.name||'Flor Morado Muebles'}`});
      return;
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`${safe}.pdf`;a.target='_blank';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(err){
    if(err&&err.name==='AbortError')return;
    console.error('Error generando/compartiendo PDF',err);
    alert('No fue posible generar el PDF. Intenta cerrar y volver a abrir la app.');
  }
}
$('#printReceipt').onclick=shareReceiptPdf;

function saleProfit(s){const cogs=(s.items||[]).reduce((a,it)=>{const p=db.products.find(x=>x.id===it.productId);const cost=('cost'in it)?Number(it.cost||0):Number(p?.cost||0);return a+cost*Number(it.qty||0)},0);return Number(s.total||0)-cogs-Number(s.shippingExpense||0)-Number(s.otherExpenses||0);}
function virtualCashMovements(){const arr=[];for(const s of db.sales){const c=db.clients.find(x=>x.id===s.clientId);for(const p of s.payments||[])arr.push({id:'pay_'+p.id,date:p.date||s.date,time:p.time||'',createdAt:p.createdAt||'',type:'income',category:'Abono cliente',note:`${s.number} · ${c?.name||'Cliente'}${p.note?' · '+p.note:''}`,amount:Number(p.amount||0),automatic:true,saleId:s.id});if(s.orderStatus!=='Cancelada'&&Number(s.shippingExpense||0)>0)arr.push({id:'ship_'+s.id,date:s.date,time:s.time||'',createdAt:s.createdAt||'',type:'expense',category:'Transporte de venta',note:s.number,amount:Number(s.shippingExpense||0),automatic:true,saleId:s.id});if(s.orderStatus!=='Cancelada'&&Number(s.otherExpenses||0)>0)arr.push({id:'other_'+s.id,date:s.date,time:s.time||'',createdAt:s.createdAt||'',type:'expense',category:'Otros gastos de venta',note:s.number,amount:Number(s.otherExpenses||0),automatic:true,saleId:s.id});}return [...arr,...db.cashMovements];}
function renderCash(){
 const all=movementSort(virtualCashMovements());
 const ym=today().slice(0,7),month=all.filter(m=>String(m.date||'').startsWith(ym));
 const inc=month.filter(m=>m.type==='income').reduce((a,m)=>a+Number(m.amount||0),0),exp=month.filter(m=>m.type==='expense').reduce((a,m)=>a+Number(m.amount||0),0),balance=all.reduce((a,m)=>a+(m.type==='income'?1:-1)*Number(m.amount||0),0);
 $('#cashIncomeMonth').textContent=money(inc);$('#cashExpenseMonth').textContent=money(exp);$('#cashBalanceAll').textContent=money(balance);
 $('#cashList').innerHTML=all.length?movementRowsGrouped(all,m=>`<div class="row"><div><strong>${esc(m.category||'Movimiento')}</strong><div class="meta">${esc(movementDateTime(m))} · ${esc(m.note||'')}${m.automatic?' · Automático':''}</div></div><div class="right"><strong class="${m.type==='income'?'money-in':'money-out'}">${m.type==='income'?'+':'-'}${money(m.amount)}</strong>${!m.automatic?`<div class="row-actions"><button class="danger-btn" onclick="deleteCashMovement('${m.id}')">Eliminar</button></div>`:''}</div></div>`):'<p class="muted">Todavía no hay movimientos.</p>';
}
$('#addCashMovement').onclick=()=>{const amount=Number($('#cashAmount').value||0);if(amount<=0)return alert('Ingresa un valor válido.');db.cashMovements.push({id:id(),date:$('#cashDate').value||today(),time:colombiaTime(),createdAt:nowStamp(),type:$('#cashType').value,category:$('#cashCategory').value.trim()||($('#cashType').value==='expense'?'Gasto':'Ingreso adicional'),amount,note:$('#cashNote').value.trim()});$('#cashAmount').value='';$('#cashCategory').value='';$('#cashNote').value='';save();};
window.deleteCashMovement=x=>{if(confirm('¿Eliminar este movimiento manual?')){db.cashMovements=db.cashMovements.filter(m=>m.id!==x);save();}};

function renderStats(){const ym=today().slice(0,7);const ms=activeSales().filter(s=>String(s.date||'').startsWith(ym));$('#statSales').textContent=money(ms.reduce((a,s)=>a+Number(s.total||0),0));$('#statProfit').textContent=money(ms.reduce((a,s)=>a+saleProfit(s),0));$('#statDebt').textContent=money(activeSales().reduce((a,s)=>a+Number(s.balance||0),0));$('#statLow').textContent=db.products.filter(p=>Number(p.stock||0)<=Number(p.minStock??1)).length;const cash=virtualCashMovements(),cashMonth=cash.filter(m=>String(m.date||'').startsWith(ym));$('#statCollected').textContent=money(cashMonth.filter(m=>m.type==='income'&&m.category==='Abono cliente').reduce((a,m)=>a+Number(m.amount||0),0));$('#statExpenses').textContent=money(cashMonth.filter(m=>m.type==='expense').reduce((a,m)=>a+Number(m.amount||0),0));$('#statCash').textContent=money(cash.reduce((a,m)=>a+(m.type==='income'?1:-1)*Number(m.amount||0),0));$('#statPending').textContent=activeSales().filter(s=>s.orderStatus!=='Entregada').length;renderUpcomingDeliveries();}
function renderUpcomingDeliveries(){const arr=activeSales().filter(s=>s.deliveryDate&&s.orderStatus!=='Entregada').sort((a,b)=>sDate(a.deliveryDate)-sDate(b.deliveryDate)).slice(0,6);$('#upcomingDeliveries').innerHTML=arr.length?arr.map(s=>{const c=db.clients.find(x=>x.id===s.clientId);const late=s.deliveryDate<today();return `<div class="row"><div><strong>${esc(s.number)} · ${esc(c?.name||'Cliente')}</strong><div class="meta">${late?'⚠️ Vencida':'Entrega'} ${esc(s.deliveryDate)} · ${esc(s.orderStatus)}</div></div><button class="secondary" onclick="openSale('${s.id}')">Ver</button></div>`}).join(''):'<p class="muted">No hay entregas programadas.</p>';}
function sDate(x){return new Date(x+'T00:00:00').getTime()||0;}

function renderSettings(){const b=db.settings;$('#bizName').value=b.name||'';$('#bizPhone').value=b.phone||'';$('#bizAddress').value=b.address||'';$('#bizEmail').value=b.email||'';$('#bizSocial').value=b.social||'';$('#bizCity').value=b.city||'';$('#bizFooter').value=b.footer||'';}
$('#saveSettings').onclick=()=>{db.settings={...db.settings,name:$('#bizName').value.trim()||'Flor Morado Muebles',phone:$('#bizPhone').value.trim(),address:$('#bizAddress').value.trim(),email:$('#bizEmail').value.trim(),social:$('#bizSocial').value.trim(),city:$('#bizCity').value.trim(),footer:$('#bizFooter').value.trim()};save();alert('Datos del negocio guardados.');};


// ===== FINANZAS V1.4.1 =====
function finIsLiability(a){return a&&FIN_LIABILITY_TYPES.includes(a.type)}
function finAccount(id){return db.finance.accounts.find(a=>a.id===id)}
function finBalance(a){
  let bal=Number(a.opening||0);
  for(const t of db.finance.transactions){
    const n=Number(t.amount||0);
    if(finIsLiability(a)){
      if(t.type==='charge'&&t.toId===a.id)bal+=n;
      if(t.type==='payment'&&t.toId===a.id)bal-=n;
      if(t.type==='transfer'&&t.toId===a.id)bal-=n;
      if(t.type==='transfer'&&t.fromId===a.id)bal+=n;
    }else{
      if(t.type==='income'&&t.toId===a.id)bal+=n;
      if(t.type==='expense'&&t.fromId===a.id)bal-=n;
      if(t.type==='transfer'&&t.fromId===a.id)bal-=n;
      if(t.type==='transfer'&&t.toId===a.id)bal+=n;
      if(t.type==='payment'&&t.fromId===a.id)bal-=n;
    }
  }
  return Math.max(0,bal);
}
function finLiabilityStats(a){
  const opening=Math.max(0,Number(a.opening||0));
  let charges=0,payments=0;
  for(const t of db.finance.transactions){
    const n=Number(t.amount||0);
    if(t.type==='charge'&&t.toId===a.id)charges+=n;
    if(t.type==='payment'&&t.toId===a.id)payments+=n;
    if(t.type==='transfer'&&t.fromId===a.id)charges+=n;
    if(t.type==='transfer'&&t.toId===a.id)payments+=n;
  }
  const original=opening+charges;
  const pending=Math.max(0,original-payments);
  const paid=Math.min(original,payments);
  const progress=original>0?Math.min(100,Math.round((paid/original)*100)):0;
  return {opening,charges,original,payments,paid,pending,progress};
}
function finMonthTx(){const ym=today().slice(0,7);return db.finance.transactions.filter(t=>String(t.date||'').startsWith(ym));}
function finIncomeExpense(t){
  if(t.type==='income')return {income:Number(t.amount||0),expense:0};
  if(t.type==='expense')return {income:0,expense:Number(t.amount||0)};
  if(t.type==='charge')return {income:0,expense:Number(t.amount||0)};
  return {income:0,expense:0};
}
function finDaysElapsed(){return Math.max(1,new Date().getDate())}
function finEscAccountOptions(includeLiabilities=true){return db.finance.accounts.filter(a=>includeLiabilities||!finIsLiability(a)).map(a=>`<option value="${a.id}">${esc(a.name)} · ${esc(FIN_TYPE_LABELS[a.type]||a.type)}</option>`).join('')}
function finRenderSelectors(){
 const all='<option value="">Seleccionar cuenta</option>'+finEscAccountOptions(true);
 const assets='<option value="">Seleccionar cuenta</option>'+finEscAccountOptions(false);
 $('#finTxFrom').innerHTML=all; $('#finTxTo').innerHTML=all;
 $('#finRecurringAccount').innerHTML=assets;
 const cur=$('#finMovementFilter').value; $('#finMovementFilter').innerHTML='<option value="">Todas las cuentas</option>'+finEscAccountOptions(true); if([...$('#finMovementFilter').options].some(o=>o.value===cur))$('#finMovementFilter').value=cur;
}
function finRenderAccounts(){
 const wrap=$('#finAccounts'); if(!wrap)return;
 wrap.innerHTML=db.finance.accounts.length?db.finance.accounts.map(a=>{
   const b=finBalance(a),liab=finIsLiability(a),limit=Number(a.limit||0);
   const avail=a.type==='credit'&&limit?Math.max(0,limit-b):null;
   let detail='';
   if(liab){const st=finLiabilityStats(a);detail=`<small>Deuda original ${money(st.original)} · Abonado ${money(st.paid)}</small><small>Progreso ${st.progress}%</small><div class="debt-progress"><i style="width:${st.progress}%"></i></div>`;}
   return `<div class="finance-account ${liab?'liability':''}"><div class="account-icon">${a.type==='credit'?'💳':a.type==='debt'?'📉':a.type==='commitment'?'🏭':a.type==='receivable'?'👤':a.type==='asset'?'💎':a.type==='cash'?'💵':a.type==='savings'?'🏦':'💰'}</div><div class="account-main"><strong>${esc(a.name)}</strong><span>${esc(FIN_TYPE_LABELS[a.type]||a.type)}${a.note?' · '+esc(a.note):''}</span>${detail}${a.type==='credit'&&limit?`<small>Cupo disponible ${money(avail)} de ${money(limit)}</small>`:''}${(a.cutoff||a.dueDay)?`<small>${a.cutoff?'Corte día '+a.cutoff:''}${a.cutoff&&a.dueDay?' · ':''}${a.dueDay?'Pago día '+a.dueDay:''}</small>`:''}</div><div class="account-balance"><span>${liab?'Saldo pendiente':'Saldo'}</span><strong class="${liab?'money-out':''}">${liab?'−':''}${money(b)}</strong><div class="row-actions">${liab?`<button onclick="openFinPayment('${a.id}')">+ Abono</button>`:a.type==='receivable'?`<button onclick="openFinCollection('${a.id}')">+ Cobro</button>`:a.type==='asset'?`<button onclick="openFinAssetConvert('${a.id}')">Convertir</button>`:''}<button class="secondary" onclick="editFinAccount('${a.id}')">Editar</button><button class="danger-btn" onclick="deleteFinAccount('${a.id}')">Eliminar</button></div></div></div>`
 }).join(''):'<p class="muted">Aún no has creado cuentas. Empieza por Efectivo, Nequi, Ahorros o una tarjeta/deuda.</p>';
}

function renderFinance(){
 if(!$('#finAccounts'))return; finRenderSelectors();finRenderAccounts();
 const liquid=db.finance.accounts.filter(a=>FIN_LIQUID_TYPES.includes(a.type)).reduce((s,a)=>s+finBalance(a),0);
 const receivables=db.finance.accounts.filter(a=>a.type==='receivable').reduce((s,a)=>s+finBalance(a),0);
 const otherAssets=db.finance.accounts.filter(a=>a.type==='asset'||a.type==='other').reduce((s,a)=>s+finBalance(a),0);
 const debts=db.finance.accounts.filter(a=>a.type==='credit'||a.type==='debt').reduce((s,a)=>s+Math.max(0,finBalance(a)),0);
 const commitments=db.finance.accounts.filter(a=>a.type==='commitment').reduce((s,a)=>s+Math.max(0,finBalance(a)),0);
 const totalAssets=liquid+receivables+otherAssets;
 const totalLiabilities=debts+commitments;
 const m=finMonthTx();let inc=0,exp=0;for(const t of m){const x=finIncomeExpense(t);inc+=x.income;exp+=x.expense;}
 $('#finAvailable').textContent=money(liquid);$('#finReceivable').textContent=money(receivables);$('#finAssets').textContent=money(otherAssets);$('#finDebt').textContent=money(debts);$('#finCommitments').textContent=money(commitments);$('#finNetWorth').textContent=money(totalAssets-totalLiabilities);$('#finMonthNet').textContent=money(inc-exp);$('#finMonthIncome').textContent=money(inc);$('#finMonthExpense').textContent=money(exp);$('#finDailyExpense').textContent=money(exp/finDaysElapsed());
 const now=new Date(),day=now.getDate();const upcoming=db.finance.recurring.filter(r=>r.active!==false&&Number(r.day||1)>=day).reduce((s,r)=>s+Number(r.amount||0),0);$('#finUpcomingTotal').textContent=money(upcoming);
 $('#finMonthSummary').innerHTML=`<div><span>Ingreso promedio/día</span><strong>${money(inc/finDaysElapsed())}</strong></div><div><span>Gasto promedio/día</span><strong>${money(exp/finDaysElapsed())}</strong></div><div><span>Disponible real menos recurrentes</span><strong>${money(liquid-upcoming)}</strong></div>`;
 const cats={};for(const t of m){const x=finIncomeExpense(t);if(x.expense>0)cats[t.category||'Sin categoría']=(cats[t.category||'Sin categoría']||0)+x.expense;}const max=Math.max(1,...Object.values(cats));$('#finCategorySummary').innerHTML=Object.keys(cats).length?Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`<div class="catbar"><div><span>${esc(k)}</span><strong>${money(v)}</strong></div><i><b style="width:${Math.max(3,Math.round(v/max*100))}%"></b></i></div>`).join(''):'<p class="muted small">Sin gastos registrados este mes.</p>';
 finRenderRecurring();finRenderMovements();
}
function finOpenAccountForm(a=null){$('#finAccountForm').classList.remove('hidden');$('#finAccountEditId').value=a?.id||'';$('#finAccountName').value=a?.name||'';$('#finAccountType').value=a?.type||'cash';$('#finAccountOpening').value=Number(a?.opening||0);$('#finAccountLimit').value=Number(a?.limit||0);$('#finAccountCutoff').value=a?.cutoff||'';$('#finAccountDueDay').value=a?.dueDay||'';$('#finAccountNote').value=a?.note||'';finUpdateOpeningLabel();}
function finCloseAccountForm(){$('#finAccountForm').classList.add('hidden');$('#finAccountEditId').value='';}
function finUpdateOpeningLabel(){const liability=FIN_LIABILITY_TYPES.includes($('#finAccountType').value);$('#finOpeningLabel').childNodes[0].nodeValue=liability?($('#finAccountType').value==='commitment'?'Valor original del compromiso':'Deuda inicial (escribe valor positivo)'):($('#finAccountType').value==='receivable'?'Valor por cobrar':$('#finAccountType').value==='asset'?'Valor del activo':'Saldo inicial');}
$('#toggleAccountForm').onclick=()=>finOpenAccountForm();$('#cancelFinAccount').onclick=finCloseAccountForm;$('#finAccountType').onchange=finUpdateOpeningLabel;
$('#saveFinAccount').onclick=()=>{const name=$('#finAccountName').value.trim();if(!name)return alert('Escribe un nombre para la cuenta.');const type=$('#finAccountType').value;const openingRaw=Number($('#finAccountOpening').value||0);const data={name,type,opening:FIN_LIABILITY_TYPES.includes(type)?Math.abs(openingRaw):openingRaw,limit:Number($('#finAccountLimit').value||0),cutoff:Number($('#finAccountCutoff').value||0)||'',dueDay:Number($('#finAccountDueDay').value||0)||'',note:$('#finAccountNote').value.trim()};const eid=$('#finAccountEditId').value;if(eid){const a=finAccount(eid);if(a)Object.assign(a,data);}else db.finance.accounts.push({id:id(),...data});finCloseAccountForm();save();};
window.editFinAccount=x=>{const a=finAccount(x);if(a){finOpenAccountForm(a);show('finance');}};
window.deleteFinAccount=x=>{if(db.finance.transactions.some(t=>t.fromId===x||t.toId===x)||db.finance.recurring.some(r=>r.accountId===x))return alert('Esta cuenta tiene movimientos o pagos recurrentes. Elimínalos primero para conservar el historial.');if(confirm('¿Eliminar esta cuenta?')){db.finance.accounts=db.finance.accounts.filter(a=>a.id!==x);save();}};
function finRenderRecurring(){const box=$('#finRecurringList');box.innerHTML=db.finance.recurring.length?db.finance.recurring.sort((a,b)=>Number(a.day)-Number(b.day)).map(r=>{const a=finAccount(r.accountId);return `<div class="row"><div><strong>${esc(r.name)}</strong><div class="meta">${r.type==='income'?'Ingreso':'Gasto'} · ${esc(r.category||'Sin categoría')} · Día ${r.day} · ${esc(a?.name||'Sin cuenta')}</div></div><div class="right"><strong class="${r.type==='income'?'money-in':'money-out'}">${money(r.amount)}</strong><div class="row-actions"><button class="secondary" onclick="postRecurring('${r.id}')">Registrar ahora</button><button class="secondary" onclick="editFinRecurring('${r.id}')">Editar</button><button class="danger-btn" onclick="deleteFinRecurring('${r.id}')">Eliminar</button></div></div></div>`}).join(''):'<p class="muted">No tienes movimientos recurrentes configurados.</p>';}
function finRecurringForm(r=null){$('#finRecurringForm').classList.remove('hidden');$('#finRecurringEditId').value=r?.id||'';$('#finRecurringName').value=r?.name||'';$('#finRecurringType').value=r?.type||'expense';$('#finRecurringCategory').value=r?.category||'';$('#finRecurringAmount').value=Number(r?.amount||0)||'';$('#finRecurringAccount').value=r?.accountId||'';$('#finRecurringDay').value=r?.day||1;}
$('#toggleRecurringForm').onclick=()=>finRecurringForm();$('#cancelFinRecurring').onclick=()=>$('#finRecurringForm').classList.add('hidden');
$('#saveFinRecurring').onclick=()=>{const name=$('#finRecurringName').value.trim(),amount=Number($('#finRecurringAmount').value||0),accountId=$('#finRecurringAccount').value;if(!name||amount<=0||!accountId)return alert('Completa concepto, valor y cuenta.');const d={name,type:$('#finRecurringType').value,category:$('#finRecurringCategory').value.trim()||'Otros',amount,accountId,day:Math.min(31,Math.max(1,Number($('#finRecurringDay').value||1))),active:true};const eid=$('#finRecurringEditId').value;if(eid){const r=db.finance.recurring.find(x=>x.id===eid);if(r)Object.assign(r,d);}else db.finance.recurring.push({id:id(),...d});$('#finRecurringForm').classList.add('hidden');save();};
window.editFinRecurring=x=>{const r=db.finance.recurring.find(z=>z.id===x);if(r)finRecurringForm(r)};window.deleteFinRecurring=x=>{if(confirm('¿Eliminar este recurrente?')){db.finance.recurring=db.finance.recurring.filter(r=>r.id!==x);save();}};
window.postRecurring=x=>{const r=db.finance.recurring.find(z=>z.id===x);if(!r)return;const exists=db.finance.transactions.some(t=>t.recurringId===r.id&&String(t.date||'').slice(0,7)===today().slice(0,7));if(exists&&!confirm('Ya registraste este recurrente este mes. ¿Registrar otro igualmente?'))return;db.finance.transactions.push({id:id(),date:today(),time:colombiaTime(),createdAt:nowStamp(),type:r.type,fromId:r.type==='expense'?r.accountId:'',toId:r.type==='income'?r.accountId:'',category:r.category,amount:Number(r.amount),note:r.name,recurringId:r.id});save();};
function finTxLabel(t){const f=finAccount(t.fromId),to=finAccount(t.toId);if(t.type==='income')return `Ingreso · ${esc(to?.name||'')}`;if(t.type==='expense')return `Gasto · ${esc(f?.name||'')}`;if(t.type==='transfer')return `${esc(f?.name||'')} → ${esc(to?.name||'')}`;if(t.type==='charge')return `Cargo · ${esc(to?.name||'')}`;if(t.type==='payment')return `Abono · ${esc(f?.name||'')} → ${esc(to?.name||'')}`;return t.type;}
function finRenderMovements(){
 const filter=$('#finMovementFilter').value;let arr=[...db.finance.transactions];
 if(filter)arr=arr.filter(t=>t.fromId===filter||t.toId===filter);
 arr=movementSort(arr).slice(0,150);
 $('#finMovements').innerHTML=arr.length?movementRowsGrouped(arr,t=>{const sign=t.type==='income'?'+':(t.type==='expense'||t.type==='charge')?'-':'';const cls=t.type==='income'?'money-in':(t.type==='expense'||t.type==='charge')?'money-out':'';return `<div class="row"><div><strong>${esc(t.note||t.category||'Movimiento')}</strong><div class="meta">${esc(movementDateTime(t))} · ${finTxLabel(t)}${t.category?' · '+esc(t.category):''}</div></div><div class="right"><strong class="${cls}">${sign}${money(t.amount)}</strong><div class="row-actions"><button class="danger-btn" onclick="deleteFinTx('${t.id}')">Eliminar</button></div></div></div>`;}):'<p class="muted">No hay movimientos financieros.</p>';
}
$('#finMovementFilter').onchange=finRenderMovements;
function finTxUi(){const t=$('#finTxType').value;$('#finTxFromWrap').classList.toggle('hidden',t==='income'||t==='charge');$('#finTxToWrap').classList.toggle('hidden',t==='expense');$('#finTxCategoryWrap').classList.toggle('hidden',t==='transfer'||t==='payment');if(t==='income'){$('#finTxTo').innerHTML='<option value="">Cuenta que recibe</option>'+finEscAccountOptions(false)}else if(t==='expense'){$('#finTxFrom').innerHTML='<option value="">Cuenta que paga</option>'+finEscAccountOptions(false)}else if(t==='charge'){$('#finTxTo').innerHTML='<option value="">Tarjeta / deuda</option>'+db.finance.accounts.filter(finIsLiability).map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}else if(t==='payment'){$('#finTxFrom').innerHTML='<option value="">Sin cuenta / abono histórico</option>'+finEscAccountOptions(false);$('#finTxTo').innerHTML='<option value="">Tarjeta / deuda</option>'+db.finance.accounts.filter(finIsLiability).map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}else{finRenderSelectors();}}

function finOpenTx(){if(!db.finance.accounts.length)return alert('Primero crea al menos una cuenta.');$('#finTxDate').value=today();$('#finTxAmount').value='';$('#finTxNote').value='';$('#finTxCategory').value='';$('#finTxType').value='expense';finTxUi();$('#finMovementModal').classList.remove('hidden');}
window.openFinPayment=x=>{const a=finAccount(x);if(!a||!finIsLiability(a))return;$('#finTxDate').value=today();$('#finTxAmount').value='';$('#finTxNote').value='Abono a '+a.name;$('#finTxCategory').value='Deudas';$('#finTxType').value='payment';finTxUi();$('#finTxTo').value=a.id;$('#finMovementModal').classList.remove('hidden');};
window.openFinCollection=x=>{const a=finAccount(x);if(!a||a.type!=='receivable')return;const destinations=db.finance.accounts.filter(z=>FIN_LIQUID_TYPES.includes(z.type));if(!destinations.length)return alert('Crea primero una cuenta de Efectivo, Ahorros, Corriente o Billetera para recibir el cobro.');const pending=finBalance(a);const raw=prompt(`Saldo por cobrar ${money(pending)}.\nValor recibido:`);if(raw===null)return;const amount=Number(String(raw).replace(/[^0-9.-]/g,''));if(!amount||amount<=0)return alert('Ingresa un valor válido.');if(amount>pending&&!confirm(`El cobro supera el saldo pendiente (${money(pending)}). ¿Continuar?`))return;let dest=destinations[0];if(destinations.length>1){const menu=destinations.map((z,i)=>`${i+1}. ${z.name}`).join('\n');const n=Number(prompt(`¿Dónde recibiste el dinero?\n\n${menu}`, '1'));if(!destinations[n-1])return;dest=destinations[n-1];}db.finance.transactions.push({id:id(),date:today(),time:colombiaTime(),createdAt:nowStamp(),type:'transfer',fromId:a.id,toId:dest.id,category:'Cobro cartera',amount,note:'Cobro de '+a.name});save();};
window.openFinAssetConvert=x=>{const a=finAccount(x);if(!a||a.type!=='asset')return;const destinations=db.finance.accounts.filter(z=>FIN_LIQUID_TYPES.includes(z.type));if(!destinations.length)return alert('Crea primero una cuenta de Efectivo, Ahorros, Corriente o Billetera para recibir el valor.');const available=finBalance(a);const raw=prompt(`Valor registrado del activo ${money(available)}.\nValor a convertir/recuperar:`);if(raw===null)return;const amount=Number(String(raw).replace(/[^0-9.-]/g,''));if(!amount||amount<=0)return alert('Ingresa un valor válido.');if(amount>available&&!confirm(`El valor supera el saldo del activo (${money(available)}). ¿Continuar?`))return;let dest=destinations[0];if(destinations.length>1){const menu=destinations.map((z,i)=>`${i+1}. ${z.name}`).join('\n');const n=Number(prompt(`¿A qué cuenta entra el dinero?\n\n${menu}`, '1'));if(!destinations[n-1])return;dest=destinations[n-1];}db.finance.transactions.push({id:id(),date:today(),time:colombiaTime(),createdAt:nowStamp(),type:'transfer',fromId:a.id,toId:dest.id,category:'Conversión de activo',amount,note:'Conversión de '+a.name});save();};
$('#newFinMovement').onclick=finOpenTx;
function closeFinMovementModal(){ $('#finMovementModal').classList.add('hidden'); }
$('#closeFinMovement').onclick=$('#cancelFinTx').onclick=closeFinMovementModal;$('#finTxType').onchange=finTxUi;

$('#iosShortcutBtn').onclick=()=>{refreshFinanceSyncUi();$('#iosShortcutModal').classList.remove('hidden');};
$('#closeIosShortcut').onclick=()=>$('#iosShortcutModal').classList.add('hidden');
$('#saveFinSync').onclick=()=>{
  db.settings.financeSyncEndpoint=$('#finSyncEndpoint').value.trim().replace(/\/$/,'');
  db.settings.financeSyncToken=$('#finSyncToken').value.trim();
  localStorage.setItem(KEY,JSON.stringify(db)); refreshFinanceSyncUi();
  financeSyncStatus(financeSyncReady()?'Configuración guardada. Ya puedes usar el Atajo.':'Guardado, pero falta una URL HTTPS válida o una clave de mínimo 8 caracteres.',!financeSyncReady());
};
$('#syncFinNow').onclick=()=>syncFinanceInbox();
$('#copyShortcutJson').onclick=async()=>{
  const sample=JSON.stringify({type:'expense',amount:85000,accountName:db.finance.accounts[0]?.name||'Nequi',category:'Transporte',note:'Flete'},null,2);
  try{await navigator.clipboard.writeText(sample);$('#copyShortcutJson').textContent='✓ JSON copiado';setTimeout(()=>$('#copyShortcutJson').textContent='Copiar JSON de ejemplo',1800);}catch{prompt('Copia este JSON:',sample);}
};
$('#openShortcutsApp').onclick=()=>{location.href='shortcuts://';};
$('#saveFinTx').onclick=()=>{const type=$('#finTxType').value,amount=Number($('#finTxAmount').value||0),fromId=$('#finTxFrom').value,toId=$('#finTxTo').value;if(amount<=0)return alert('Ingresa un valor válido.');if((type==='expense'||type==='transfer')&&!fromId)return alert('Selecciona la cuenta de origen.');if((type==='income'||type==='transfer'||type==='charge'||type==='payment')&&!toId)return alert('Selecciona la cuenta destino.');if(type==='transfer'&&fromId===toId)return alert('Origen y destino deben ser diferentes.');if(type==='payment'){const a=finAccount(toId);const pending=a?finBalance(a):0;if(amount>pending&&!confirm(`El abono supera el saldo pendiente (${money(pending)}). ¿Registrarlo igualmente?`))return;}db.finance.transactions.push({id:id(),date:$('#finTxDate').value||today(),time:colombiaTime(),createdAt:nowStamp(),type,fromId,toId,category:$('#finTxCategory').value.trim()||((type==='charge'||type==='payment')?'Deudas':'Otros'),amount,note:$('#finTxNote').value.trim()});$('#finMovementModal').classList.add('hidden');save();};
window.deleteFinTx=x=>{if(confirm('¿Eliminar este movimiento financiero?')){db.finance.transactions=db.finance.transactions.filter(t=>t.id!==x);save();}};

function renderAll(){renderClients();renderProducts();renderReceivables();renderHistory();renderCash();renderStats();renderSettings();renderFinance();}

function backupStamp(){
 const d=new Date(),pad=n=>String(n).padStart(2,'0');
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}
function backupFileName(){return `FlorMorado_Backup_${backupStamp()}.json`;}
function backupPayload(){return JSON.stringify({...db,_backup:{app:'Flor Morado Muebles',version:'1.4.7',createdAt:new Date().toISOString()}},null,2);}
function updateBackupUi(){
 const el=$('#lastBackupText'),warn=$('#backupWarning'); if(!el||!warn)return;
 const raw=db.settings.lastBackupAt;
 if(!raw){el.textContent='Nunca';warn.textContent='⚠️ Aún no has creado una copia de seguridad. Guarda una en iCloud Drive.';warn.classList.remove('hidden');return;}
 const d=new Date(raw);el.textContent=isNaN(d)?raw:d.toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'});
 const days=(Date.now()-d.getTime())/86400000;
 if(days>=7){warn.textContent=`⚠️ Han pasado ${Math.floor(days)} días desde el último backup. Te recomiendo crear uno hoy.`;warn.classList.remove('hidden');}else warn.classList.add('hidden');
}
async function createBackup(){
 db.settings.lastBackupAt=new Date().toISOString();
 localStorage.setItem(KEY,JSON.stringify(db));
 const text=backupPayload(),name=backupFileName(),blob=new Blob([text],{type:'application/json'}),file=new File([blob],name,{type:'application/json'});
 updateBackupUi();
 try{
   if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
     await navigator.share({files:[file],title:'Backup Flor Morado',text:'Guarda esta copia en Archivos → iCloud Drive.'});
     return;
   }
 }catch(err){if(err&&err.name==='AbortError')return;}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
 alert('Backup creado. En iPhone guárdalo en Archivos → iCloud Drive.');
}
function validBackup(x){return x&&typeof x==='object'&&Array.isArray(x.clients)&&Array.isArray(x.products)&&Array.isArray(x.sales)&&x.finance&&typeof x.finance==='object';}
function restoreBackupFile(f){
 const r=new FileReader();
 r.onload=()=>{try{
   const x=JSON.parse(r.result);if(!validBackup(x))throw new Error('invalid');
   const when=x._backup?.createdAt?new Date(x._backup.createdAt).toLocaleString('es-CO'):'fecha no disponible';
   if(!confirm(`Vas a reemplazar los datos actuales con este backup (${when}).\n\n¿Continuar?`))return;
   Object.assign(db,x);delete db._backup;
   db.settings={...DEFAULTS.settings,...(x.settings||{})};
   db.cashMovements=Array.isArray(x.cashMovements)?x.cashMovements:[];
   db.finance=x.finance&&typeof x.finance==='object'?x.finance:{accounts:[],transactions:[],recurring:[]};
   db.finance.accounts=Array.isArray(db.finance.accounts)?db.finance.accounts:[];db.finance.transactions=Array.isArray(db.finance.transactions)?db.finance.transactions:[];db.finance.recurring=Array.isArray(db.finance.recurring)?db.finance.recurring:[];
   for(const a of db.finance.accounts){if(FIN_LIABILITY_TYPES.includes(a.type)&&Number(a.opening||0)<0)a.opening=Math.abs(Number(a.opening||0));}
   for(const p of db.products)if(p.minStock===undefined)p.minStock=1;
   for(const s of db.sales){if(!s.orderStatus)s.orderStatus='Pendiente';if(s.shippingExpense===undefined)s.shippingExpense=0;if(s.otherExpenses===undefined)s.otherExpenses=0;if(!Array.isArray(s.payments))s.payments=[];}
   localStorage.setItem(KEY,JSON.stringify(db));renderAll();updateBackupUi();alert('Backup restaurado correctamente.');
 }catch{alert('Archivo de backup no válido. No se modificó ningún dato.');}finally{$('#importFile').value='';}};
 r.readAsText(f);
}
$('#backupBtn').onclick=createBackup;
$('#createBackup').onclick=createBackup;
$('#restoreBackup').onclick=()=>$('#importFile').click();
$('#importFile').onchange=e=>{const f=e.target.files[0];if(f)restoreBackupFile(f);};

$('#saleDate').value=today();$('#cashDate').value=today();renderAll();updateBackupUi();addSaleItem();calcSale();refreshFinanceSyncUi(); if(financeSyncReady())syncFinanceInbox({silent:true});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=1.4.7',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});

// Revisa el buzón al volver a primer plano, sin interrumpir al usuario.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&financeSyncReady())syncFinanceInbox({silent:true});});
window.addEventListener('online',()=>{if(financeSyncReady())syncFinanceInbox({silent:true});});
