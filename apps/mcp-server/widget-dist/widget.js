(function(){"use strict";function D(){const t=`
:root{
  --bg:#0b0d10;
  --card:#161a1f;
  --card-border:#2b3138;
  --text:#e9eaee;
  --muted:#a9b0bb;
  --input:#0f1318;
  --input-border:#3a414a;
  --btn:#222a33;
  --btn-hover:#2c3440;
  --danger:#3b2729;
  --danger-border:#6b2f2f;
  --accent:#79a7ff;
  --shadow:0 10px 30px rgba(0,0,0,.35);
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#f7f8fa;
    --card:#ffffff;
    --card-border:#e7e9ee;
    --text:#0f1720;
    --muted:#526074;
    --input:#fff;
    --input-border:#ccd3dd;
    --btn:#f3f5f8;
    --btn-hover:#e9edf3;
    --danger:#ffeaea;
    --danger-border:#ffb4b4;
    --accent:#3b82f6;
    --shadow:0 8px 24px rgba(0,0,0,.08);
  }
}
*{box-sizing:border-box}
body{color:var(--text)}
.card{
  background:var(--card);
  border:1px solid var(--card-border);
  border-radius:18px;
  padding:20px;
  box-shadow:var(--shadow);
}
.title{margin:0 0 12px;font-size:22px;font-weight:800;letter-spacing:.2px}
.row{display:flex;align-items:center;gap:12px}
.controls{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0 6px}
.counts{color:var(--muted);font-size:13px}
.filter{display:flex;gap:8px}
.btn{
  padding:8px 12px;border-radius:10px;border:1px solid var(--input-border);
  background:var(--btn);color:var(--text);cursor:pointer;line-height:1;
}
.btn:hover{background:var(--btn-hover)}
.btn.active{background:#354051}
.btn-danger{background:var(--danger);border-color:var(--danger-border)}
.input{
  height:44px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--input-border);
  background:var(--input);color:var(--text);outline:none;
}
.input::placeholder{color:var(--muted)}
.input:focus,.btn:focus{outline:2px solid var(--accent);outline-offset:2px}
.list{display:grid;gap:10px;margin-top:8px}
.todo-text{flex:1}
.todo-text.done{text-decoration:line-through;opacity:.55}
.checkbox{width:18px;height:18px;transform:scale(1.15);accent-color:var(--accent);cursor:pointer}
  `.trim(),n=document.createElement("style");n.textContent=t,document.head.appendChild(n)}function o(t,n={},r=[]){const c=document.createElement(t);for(const[a,e]of Object.entries(n))a==="style"&&typeof e=="object"?Object.assign(c.style,e):a.startsWith("on")&&typeof e=="function"?c[a.toLowerCase()]=e:e!=null&&c.setAttribute(a,String(e));for(const a of r)c.append(a instanceof Node?a:document.createTextNode(a));return c}D();const $=document.getElementById("root"),A=o("div",{class:"card"}),z=o("h3",{class:"title"},["My Todos"]),l=o("form",{class:"row",style:{gap:"10px",marginBottom:"10px"}}),p=o("input",{class:"input",placeholder:"Add a task…"}),N=o("button",{class:"btn",type:"submit"},["Add"]),L=o("div",{class:"controls"}),E=o("div",{class:"filter"}),b=o("button",{class:"btn active",type:"button"},["All"]),u=o("button",{class:"btn",type:"button"},["Active"]),f=o("button",{class:"btn",type:"button"},["Done"]);E.append(b,u,f);const C=o("div",{class:"counts"},["—"]),x=o("button",{class:"btn btn-danger",type:"button"},["Clear completed"]);L.append(E,C,x);const d=o("div",{class:"list"});l.append(p,N),A.append(z,l,L,d),$.replaceChildren(A);let g=[],v="all",h=!1;function y(t){v=t,b.classList.toggle("active",t==="all"),u.classList.toggle("active",t==="active"),f.classList.toggle("active",t==="done"),w()}b.onclick=()=>y("all"),u.onclick=()=>y("active"),f.onclick=()=>y("done");async function s(t,n){var r,c;try{return await((c=(r=window.openai)==null?void 0:r.callTool)==null?void 0:c.call(r,t,n))}catch(a){console.error("callTool failed:",a);return}}async function i(){var t,n;if(!h){h=!0;try{const r=await s("list_todos",{}),c=(n=(t=r==null?void 0:r.structuredContent)==null?void 0:t.todos)!=null?n:g;Array.isArray(c)&&(g=c),w()}finally{h=!1}}}function w(){const t=g,n=t.length,r=t.filter(e=>e.done).length,c=n-r;C.textContent=`${n} total — ${c} active, ${r} done`,x.style.display=r>0?"inline-block":"none";let a=t;if(v==="active"?a=t.filter(e=>!e.done):v==="done"&&(a=t.filter(e=>e.done)),d.innerHTML="",!a.length){d.append(o("div",{class:"counts"},["No tasks here."]));return}for(const e of a){const T=o("div",{class:"row"}),m=o("input",{type:"checkbox",class:"checkbox"});m.checked=e.done,m.addEventListener("change",async()=>{await s("toggle_todo",{id:e.id}),await i()});const _=o("span",{class:`todo-text${e.done?" done":""}`,title:"Click to edit"},[e.text]);_.addEventListener("click",async()=>{var B;const k=((B=prompt("Edit task",e.text))!=null?B:"").trim();!k||k===e.text||(await s("edit_todo",{id:e.id,text:k}),await i())});const j=o("button",{class:"btn btn-danger",type:"button"},["Delete"]);j.addEventListener("click",async()=>{await s("delete_todo",{id:e.id}),await i()}),T.append(m,_,j),d.append(T)}}l.addEventListener("submit",async t=>{t.preventDefault();const n=p.value.trim();n&&(p.value="",await s("add_todo",{text:n}),await i())}),x.onclick=async()=>{await s("clear_completed",{}),await i()},i(),window.addEventListener("openai:set_globals",()=>i()),w()})();
