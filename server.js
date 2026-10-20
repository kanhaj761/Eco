// EcoTrack backend - zero dependencies (Node 18+). Run: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,SECRET=process.env.JWT_SECRET||crypto.randomBytes(32).toString('hex');
const STAFF_SIGNUP=process.env.ALLOW_STAFF_SIGNUP!=='false'; // set to false in production
const DBF=path.join(__dirname,'data','db.json'),WWW=path.join(__dirname,'..','www');
fs.mkdirSync(path.dirname(DBF),{recursive:true});
let db={accounts:[],complaints:[],tasks:[]};try{db=JSON.parse(fs.readFileSync(DBF))}catch(e){}
const save=()=>fs.writeFileSync(DBF,JSON.stringify(db,null,1));
const hash=(pw,salt=crypto.randomBytes(16).toString('hex'))=>salt+':'+crypto.scryptSync(pw,salt,64).toString('hex');
const check=(pw,h)=>{const[s,x]=h.split(':');const y=hash(pw,s).split(':')[1];return crypto.timingSafeEqual(Buffer.from(x),Buffer.from(y))};
if(!db.accounts.length){[['admin','admin','admin123'],['employee','employee','emp123'],['citizen','citizen','citizen123']].forEach(([r,u,p])=>db.accounts.push({name:'Yash Jaiswal',role:r,user:u,id:r=='employee'?'EMP1023':undefined,ph:hash(p)}));save()}
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const sign=a=>{const p=b64({user:a.user,role:a.role,exp:Date.now()+7*864e5});return p+'.'+crypto.createHmac('sha256',SECRET).update(p).digest('base64url')};
const verify=t=>{try{const[p,s]=(t||'').split('.');if(s!==crypto.createHmac('sha256',SECRET).update(p).digest('base64url'))return null;const o=JSON.parse(Buffer.from(p,'base64url'));return o.exp>Date.now()?db.accounts.find(a=>a.user==o.user&&a.role==o.role):null}catch(e){return null}};
const pub=a=>({name:a.name,role:a.role,user:a.user,id:a.id,mobile:a.mobile,email:a.email});
const send=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'});res.end(JSON.stringify(o))};
const body=req=>new Promise(r=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e6)req.destroy()});req.on('end',()=>{try{r(JSON.parse(d||'{}'))}catch(e){r({})}})});
const ROLES=['citizen','employee','admin'],same=(a,u)=>[a.user,a.mobile,a.email].filter(Boolean).some(v=>v.toLowerCase()==u.toLowerCase());
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://x'),p=url.pathname;
 if(req.method=='OPTIONS')return send(res,204,{});
 if(!p.startsWith('/api/')){ // serve frontend
  let f=path.join(WWW,p=='/'?'index.html':p);if(!f.startsWith(WWW)||!fs.existsSync(f))return send(res,404,{error:'Not found'});
  let d=fs.readFileSync(f);if(f.endsWith('index.html'))d=d.toString().replace("window.ECO_API=''","window.ECO_API=''+location.origin");
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});return res.end(d)}
 const me=verify((req.headers.authorization||'').replace('Bearer ',''));
 try{
 if(p=='/api/health')return send(res,200,{ok:true});
 if(p=='/api/register'&&req.method=='POST'){const b=await body(req),n=(b.name||'').trim(),u=(b.user||'').trim();
  if(!ROLES.includes(b.role))return send(res,400,{error:'Invalid role.'});
  if(b.role!='citizen'&&!STAFF_SIGNUP)return send(res,403,{error:'Staff accounts are created by the administrator.'});
  if(!n||!u)return send(res,400,{error:'Name and username are required.'});
  if((b.password||'').length<6)return send(res,400,{error:'Password must be at least 6 characters.'});
  if(db.accounts.some(a=>same(a,u)))return send(res,409,{error:'This username is already registered.'});
  const a={name:n,role:b.role,user:u,ph:hash(b.password)};if(/^\d{10}$/.test(u))a.mobile=u;if(u.includes('@'))a.email=u;
  if(a.role=='employee')a.id='EMP'+(2000+db.accounts.length);db.accounts.push(a);save();return send(res,201,{account:pub(a)})}
 if(p=='/api/login'&&req.method=='POST'){const b=await body(req),u=(b.user||'').trim(),a=db.accounts.find(x=>x.role==b.role&&same(x,u));
  if(!a||!check(b.password||'',a.ph))return send(res,401,{error:'Invalid username or password for this role.'});
  return send(res,200,{token:sign(a),account:pub(a)})}
 if(!me)return send(res,401,{error:'Login required.'});
 if(p=='/api/me')return send(res,200,{account:pub(me)});
 if(p=='/api/complaints'){
  if(req.method=='GET')return send(res,200,me.role=='citizen'?db.complaints.filter(c=>c.by==me.user):db.complaints);
  if(req.method=='POST'){const b=await body(req);const c={id:'CMP-'+(1000+db.complaints.length+1),type:b.type||'General',location:b.location||'',details:b.details||'',status:'Open',by:me.user,at:new Date().toISOString()};db.complaints.unshift(c);save();return send(res,201,c)}}
 let m=p.match(/^\/api\/complaints\/([\w-]+)$/);
 if(m&&req.method=='PATCH'){if(me.role=='citizen')return send(res,403,{error:'Not allowed.'});const c=db.complaints.find(x=>x.id==m[1]);if(!c)return send(res,404,{error:'Not found.'});const b=await body(req);if(b.status)c.status=String(b.status);save();return send(res,200,c)}
 if(p=='/api/tasks'){
  if(req.method=='GET')return send(res,200,me.role=='employee'?db.tasks.filter(t=>t.assignee==me.user):me.role=='admin'?db.tasks:[]);
  if(req.method=='POST'){if(me.role!='admin')return send(res,403,{error:'Admin only.'});const b=await body(req);const t={id:'TSK-'+(1000+db.tasks.length+1),title:b.title||'Task',location:b.location||'',assignee:b.assignee||'',priority:b.priority||'Medium',status:'Pending'};db.tasks.unshift(t);save();return send(res,201,t)}}
 m=p.match(/^\/api\/tasks\/([\w-]+)$/);
 if(m&&req.method=='PATCH'){if(me.role=='citizen')return send(res,403,{error:'Not allowed.'});const t=db.tasks.find(x=>x.id==m[1]);if(!t)return send(res,404,{error:'Not found.'});if(me.role=='employee'&&t.assignee!=me.user)return send(res,403,{error:'Not your task.'});const b=await body(req);if(b.status)t.status=String(b.status);save();return send(res,200,t)}
 if(p=='/api/employees'&&me.role=='admin')return send(res,200,db.accounts.filter(a=>a.role=='employee').map(pub));
 if(p=='/api/residents'&&me.role=='admin')return send(res,200,db.accounts.filter(a=>a.role=='citizen').map(pub));
 send(res,404,{error:'Not found.'})}catch(e){send(res,500,{error:'Server error.'})}
}).listen(PORT,()=>console.log('EcoTrack running on http://localhost:'+PORT));
