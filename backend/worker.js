/**
 * Flor Morado Finance Inbox - Cloudflare Worker + KV
 * Bind a KV namespace as FINANCE_INBOX and define FINANCE_TOKEN as a secret.
 */
const JSON_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'Authorization, Content-Type',
  'access-control-allow-methods':'GET, POST, PATCH, OPTIONS',
  'cache-control':'no-store'
};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const auth=(request,env)=>request.headers.get('authorization')===`Bearer ${env.FINANCE_TOKEN}`;
const colombiaParts=()=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:JSON_HEADERS});
    if(!auth(request,env))return reply({ok:false,error:'unauthorized'},401);
    const url=new URL(request.url);
    if(url.pathname!=='/'&&url.pathname!=='/transactions')return reply({ok:false,error:'not_found'},404);

    if(request.method==='POST'){
      let x; try{x=await request.json();}catch{return reply({ok:false,error:'invalid_json'},400);}
      const type=x.type==='income'?'income':x.type==='expense'?'expense':'';
      const amount=Number(x.amount||0);
      const accountName=String(x.accountName||'').trim();
      if(!type||!(amount>0)||!accountName)return reply({ok:false,error:'type_amount_account_required'},400);
      const p=colombiaParts();
      const id=crypto.randomUUID();
      const row={id,type,amount,accountName,category:String(x.category||'Otros').trim()||'Otros',note:String(x.note||'').trim(),date:String(x.date||`${p.year}-${p.month}-${p.day}`).slice(0,10),time:String(x.time||`${p.hour}:${p.minute}:${p.second}`).slice(0,8),createdAt:new Date().toISOString(),pending:true};
      await env.FINANCE_INBOX.put(`tx:${id}`,JSON.stringify(row));
      return reply({ok:true,id,transaction:row},201);
    }

    if(request.method==='GET'){
      const list=await env.FINANCE_INBOX.list({prefix:'tx:',limit:100});
      const rows=[];
      for(const k of list.keys){const raw=await env.FINANCE_INBOX.get(k.name);if(!raw)continue;try{const x=JSON.parse(raw);if(x.pending!==false)rows.push(x);}catch{}}
      rows.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
      return reply({ok:true,transactions:rows});
    }

    if(request.method==='PATCH'){
      let x; try{x=await request.json();}catch{return reply({ok:false,error:'invalid_json'},400);}
      const ack=Array.isArray(x.ack)?x.ack.slice(0,100).map(String):[];
      let count=0;
      for(const id of ack){const key=`tx:${id}`;const raw=await env.FINANCE_INBOX.get(key);if(!raw)continue;try{const row=JSON.parse(raw);row.pending=false;row.acknowledgedAt=new Date().toISOString();await env.FINANCE_INBOX.put(key,JSON.stringify(row),{expirationTtl:2592000});count++;}catch{}}
      return reply({ok:true,acknowledged:count});
    }
    return reply({ok:false,error:'method_not_allowed'},405);
  }
};
