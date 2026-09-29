const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, 'public');
const dbDir = path.join(__dirname, 'db');
const dbFile = path.join(dbDir, 'database.json');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const seed = {
  customers: [], appointments: [], messages: [],
  staff: [
    {staff_id:1,full_name:'Ananya Sharma',role:'Senior Stylist',working_days:[1,2,3,4,5,6],start_time:'09:00',end_time:'20:00',active:true},
    {staff_id:2,full_name:'Riya Kapoor',role:'Hair & Beauty Specialist',working_days:[1,2,3,4,5,6],start_time:'09:00',end_time:'20:00',active:true},
    {staff_id:3,full_name:'Neha Verma',role:'Skin Specialist',working_days:[1,2,3,4,5,6],start_time:'10:00',end_time:'19:00',active:true},
    {staff_id:4,full_name:'Aarav Mehta',role:'Senior Grooming Expert',working_days:[1,2,3,4,5,6],start_time:'09:00',end_time:'20:00',active:true}
  ],
  services: [
    {service_id:1,service_name:'Haircut & Styling',description:'Professional haircut and styling tailored to you.',price:499,duration_minutes:45,is_premium:0,active:true},
    {service_id:2,service_name:'Hair Coloring',description:'Premium hair coloring with expert consultation.',price:1499,duration_minutes:120,is_premium:0,active:true},
    {service_id:3,service_name:'Facial Treatment',description:'Refreshing facial treatment for healthy glowing skin.',price:799,duration_minutes:60,is_premium:0,active:true},
    {service_id:4,service_name:'Manicure & Pedicure',description:'Complete hand and foot care treatment.',price:699,duration_minutes:60,is_premium:0,active:true},
    {service_id:5,service_name:'Bridal Package',description:'A complete premium beauty package for your special day.',price:4999,duration_minutes:240,is_premium:1,active:true},
    {service_id:6,service_name:'Luxury Hair Spa',description:'Deep nourishment and relaxation for beautiful hair.',price:1999,duration_minutes:90,is_premium:1,active:true},
    {service_id:7,service_name:'Premium Skin Therapy',description:'Advanced skin care treatment using premium products.',price:2499,duration_minutes:90,is_premium:1,active:true}
  ],
  settings:{open_time:'09:00',close_time:'20:00',slot_interval:30}
};

function clone(x){return JSON.parse(JSON.stringify(x));}
function ensureDb(){
  fs.mkdirSync(dbDir,{recursive:true});
  if(!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(seed,null,2));
}
function loadDb(){ensureDb(); try{return JSON.parse(fs.readFileSync(dbFile,'utf8'));}catch(e){fs.writeFileSync(dbFile,JSON.stringify(seed,null,2));return clone(seed);}}
let db=loadDb();
function saveDb(){fs.writeFileSync(dbFile,JSON.stringify(db,null,2));}
function nextId(items,key){return items.reduce((m,x)=>Math.max(m,Number(x[key])||0),0)+1;}

const mimeTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
function sendJson(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>2e6)req.destroy();});req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);});}
function serveFile(res,file){fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404,{'Content-Type':'text/plain'}).end('Page not found');res.writeHead(200,{'Content-Type':mimeTypes[path.extname(file).toLowerCase()]||'application/octet-stream'});res.end(data);});}
function safePath(p){const normalized=path.normalize(decodeURIComponent(p)).replace(/^([.][.][/\\])+/, '');return path.join(publicDir,normalized.replace(/^[/\\]+/,''));}
function validDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00'));}
function minutes(t){const [h,m]=String(t).slice(0,5).split(':').map(Number);return h*60+m;}
function overlaps(aStart,aDur,bStart,bDur){return minutes(aStart)<minutes(bStart)+bDur && minutes(bStart)<minutes(aStart)+aDur;}
function dateDay(d){return new Date(d+'T00:00:00').getDay();}
function activeAppointments(){return db.appointments.filter(a=>!['cancelled','completed'].includes(a.status));}
function availableStaff(date,time,serviceId){
  const service=db.services.find(s=>s.service_id===Number(serviceId)&&s.active!==false); if(!service)return [];
  const day=dateDay(date);
  return db.staff.filter(s=>s.active!==false && s.working_days.includes(day) && minutes(time)>=minutes(s.start_time) && minutes(time)+service.duration_minutes<=minutes(s.end_time) && !activeAppointments().some(a=>a.appointment_date===date && Number(a.staff_id)===s.staff_id && overlaps(a.appointment_time, Number((db.services.find(x=>x.service_id===Number(a.service_id))||{}).duration_minutes||30), time, service.duration_minutes)));
}
function auth(req){return req.headers['x-admin-user']===ADMIN_USER && req.headers['x-admin-pass']===ADMIN_PASS;}

const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`), p=u.pathname;
  if(p==='/api/health'&&req.method==='GET')return sendJson(res,200,{status:'ok',service:'Style Hub',database:'file-persistent'});
  if(p==='/api/all-services'&&req.method==='GET')return sendJson(res,200,db.services.filter(s=>s.active!==false));
  if(p==='/api/premium'&&req.method==='GET')return sendJson(res,200,db.services.filter(s=>s.is_premium&&s.active!==false));
  if(p==='/api/staff'&&req.method==='GET')return sendJson(res,200,db.staff.filter(s=>s.active!==false));
  if(p==='/api/available-staff'&&req.method==='GET'){const date=u.searchParams.get('date'),time=u.searchParams.get('time'),sid=u.searchParams.get('service_id');if(!date||!time||!sid)return sendJson(res,400,{error:'date, time and service_id are required'});return sendJson(res,200,{staff:availableStaff(date,time,sid)});}
  if(p==='/api/available-slots'&&req.method==='GET'){
    const date=u.searchParams.get('date'),sid=Number(u.searchParams.get('service_id'));if(!validDate(date)||!sid)return sendJson(res,400,{error:'Valid date and service_id are required'});
    const service=db.services.find(s=>s.service_id===sid&&s.active!==false);if(!service)return sendJson(res,404,{error:'Service not found'});
    const slots=[];for(let m=minutes(db.settings.open_time);m+service.duration_minutes<=minutes(db.settings.close_time);m+=db.settings.slot_interval){const h=String(Math.floor(m/60)).padStart(2,'0'),mi=String(m%60).padStart(2,'0'),time=`${h}:${mi}`;if(availableStaff(date,time,sid).length)slots.push(time);}
    return sendJson(res,200,{date,service_id:sid,slots});
  }
  if(p==='/api/customers'&&req.method==='POST'){
    const d=await readBody(req);if(!d.full_name||!d.phone||!d.email)return sendJson(res,400,{error:'Full name, phone and email are required'});
    let c=db.customers.find(x=>x.email.toLowerCase()===String(d.email).trim().toLowerCase());if(!c){c={customer_id:nextId(db.customers,'customer_id'),full_name:String(d.full_name).trim(),phone:String(d.phone).trim(),email:String(d.email).trim(),created_at:new Date().toISOString()};db.customers.push(c);saveDb();}else{c.full_name=String(d.full_name).trim();c.phone=String(d.phone).trim();saveDb();}return sendJson(res,201,{customer_id:c.customer_id});
  }
  if(p==='/api/appointments'&&req.method==='POST'){
    const d=await readBody(req),sid=Number(d.service_id);if(!d.customer_id||!sid||!d.appointment_date||!d.appointment_time)return sendJson(res,400,{error:'Required appointment fields are missing'});
    const service=db.services.find(s=>s.service_id===sid&&s.active!==false);if(!service)return sendJson(res,400,{error:'Invalid service selected'});
    if(!validDate(d.appointment_date))return sendJson(res,400,{error:'Invalid appointment date'});const time=String(d.appointment_time).slice(0,5);if(minutes(time)<minutes(db.settings.open_time)||minutes(time)+service.duration_minutes>minutes(db.settings.close_time))return sendJson(res,400,{error:'Selected time is outside salon hours'});
    if(new Date(d.appointment_date+'T'+time+':00')<new Date())return sendJson(res,400,{error:'Please choose a future date and time'});
    let staffId=d.staff_id?Number(d.staff_id):null;let candidates=availableStaff(d.appointment_date,time,sid);if(staffId&&!candidates.some(s=>s.staff_id===staffId))return sendJson(res,409,{error:'Selected staff member is not available for this slot'});if(!staffId){if(!candidates.length)return sendJson(res,409,{error:'No staff is available for this slot'});staffId=candidates[0].staff_id;}
    const customer=db.customers.find(c=>c.customer_id===Number(d.customer_id));if(!customer)return sendJson(res,400,{error:'Customer not found'});
    const a={appointment_id:nextId(db.appointments,'appointment_id'),customer_id:customer.customer_id,staff_id:staffId,service_id:sid,appointment_date:d.appointment_date,appointment_time:time,notes:d.notes||'',status:'confirmed',created_at:new Date().toISOString()};db.appointments.push(a);saveDb();return sendJson(res,201,{success:true,appointment_id:a.appointment_id,staff_id:staffId,appointment:a});
  }
  if(p==='/api/messages'&&req.method==='POST'){const d=await readBody(req);if(!d.name||!d.email||!d.subject||!d.message)return sendJson(res,400,{error:'All contact fields are required'});db.messages.push({message_id:nextId(db.messages,'message_id'),...d,status:'new',created_at:new Date().toISOString()});saveDb();return sendJson(res,201,{success:true,message:'Message received'});}

  // Admin APIs
  if(p==='/api/admin/login'&&req.method==='POST'){const d=await readBody(req);if(d.username===ADMIN_USER&&d.password===ADMIN_PASS)return sendJson(res,200,{success:true});return sendJson(res,401,{error:'Invalid admin credentials'});}
  if(p.startsWith('/api/admin/')&&!auth(req))return sendJson(res,401,{error:'Admin authentication required'});
  if(p==='/api/admin/dashboard'&&req.method==='GET'){
    const today=new Date().toISOString().slice(0,10);return sendJson(res,200,{stats:{customers:db.customers.length,appointments:db.appointments.length,todayAppointments:db.appointments.filter(a=>a.appointment_date===today&&a.status!=='cancelled').length,pending:db.appointments.filter(a=>a.status==='confirmed').length,messages:db.messages.filter(m=>m.status==='new').length,revenue:db.appointments.filter(a=>['confirmed','completed'].includes(a.status)).reduce((sum,a)=>sum+(db.services.find(s=>s.service_id===Number(a.service_id))?.price||0),0)}});
  }
  if(p==='/api/admin/appointments'&&req.method==='GET'){
    const rows=db.appointments.map(a=>({...a,customer:db.customers.find(c=>c.customer_id===Number(a.customer_id)),service:db.services.find(s=>s.service_id===Number(a.service_id)),staff:db.staff.find(s=>s.staff_id===Number(a.staff_id))}));return sendJson(res,200,rows);
  }
  if(p.startsWith('/api/admin/appointments/')&&req.method==='PATCH'){
    const id=Number(p.split('/').pop()),d=await readBody(req),a=db.appointments.find(x=>x.appointment_id===id);if(!a)return sendJson(res,404,{error:'Appointment not found'});
    if(d.status&&!['confirmed','completed','cancelled','no-show'].includes(d.status))return sendJson(res,400,{error:'Invalid status'});if(d.status)a.status=d.status;if(d.staff_id!==undefined)a.staff_id=d.staff_id?Number(d.staff_id):null;saveDb();return sendJson(res,200,{success:true,appointment:a});
  }
  if(p==='/api/admin/customers'&&req.method==='GET')return sendJson(res,200,db.customers.map(c=>({...c,appointments:db.appointments.filter(a=>a.customer_id===c.customer_id).length})));
  if(p==='/api/admin/messages'&&req.method==='GET')return sendJson(res,200,db.messages);
  if(p.startsWith('/api/admin/messages/')&&req.method==='PATCH'){const id=Number(p.split('/').pop()),d=await readBody(req),m=db.messages.find(x=>x.message_id===id);if(!m)return sendJson(res,404,{error:'Message not found'});if(d.status)m.status=d.status;saveDb();return sendJson(res,200,{success:true});}
  if(p==='/api/admin/services'&&req.method==='GET')return sendJson(res,200,db.services);
  if(p.startsWith('/api/admin/services/')&&req.method==='PATCH'){const id=Number(p.split('/').pop()),d=await readBody(req),s=db.services.find(x=>x.service_id===id);if(!s)return sendJson(res,404,{error:'Service not found'});Object.assign(s,{service_name:d.service_name??s.service_name,price:d.price??s.price,duration_minutes:d.duration_minutes??s.duration_minutes,active:d.active??s.active});saveDb();return sendJson(res,200,{success:true,service:s});}
  if(p==='/api/admin/staff'&&req.method==='GET')return sendJson(res,200,db.staff);
  if(p.startsWith('/api/admin/staff/')&&req.method==='PATCH'){const id=Number(p.split('/').pop()),d=await readBody(req),s=db.staff.find(x=>x.staff_id===id);if(!s)return sendJson(res,404,{error:'Staff not found'});Object.assign(s,{active:d.active??s.active,start_time:d.start_time??s.start_time,end_time:d.end_time??s.end_time});saveDb();return sendJson(res,200,{success:true,staff:s});}

  if(req.method!=='GET'&&req.method!=='HEAD')return sendJson(res,405,{error:'Method not allowed'});
  const aliases={'/':'/index.html','/services.html':'/index.html','/about.html':'/index.html'};const requested=aliases[p]||p;return serveFile(res,safePath(requested));
 }catch(e){console.error(e);sendJson(res,500,{error:'Internal server error'});}
});
server.listen(PORT,()=>console.log(`Style Hub is running at http://localhost:${PORT}`));
