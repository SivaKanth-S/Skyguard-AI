
'use strict';
/* ============================================================
   SkyGuard AI — app.js
   All functions exported via the SG namespace.
   Each page calls only what it needs via inline <script>.
   ============================================================ */

window.SG = {};

// ── Theme System ─────────────────────────────────────────────
SG.activeCharts = [];

SG.getTheme = function () {
  try {
    return localStorage.getItem('skyguard_theme') || 'dark';
  } catch (e) {
    return 'dark';
  }
};

/* ── Light theme token values (mirrors style.css [data-theme="light"]) ── */
const LIGHT_TOKENS = {
  '--bg':               '#f4f6fb',
  '--surface':          '#ffffff',
  '--surface2':         '#e9eef6',
  '--border':           '#d0d7de',
  '--text':             '#1f2328',
  '--muted':            '#57606a',
  '--accent':           '#0969da',
  '--green':            '#1a7f37',
  '--red':              '#cf222e',
  '--orange':           '#d46b08',
  '--yellow':           '#b58105',
  '--purple':           '#8250df',
  '--blue':             '#0969da',
  '--shadow':           '0 4px 20px rgba(140,149,159,.18)',
  '--grad':             'linear-gradient(135deg,#0969da,#1a7f37,#8250df)',
  '--nav-bg':           'rgba(255,255,255,.94)',
  '--map-overlay-bg':   'rgba(255,255,255,.94)',
  '--map-overlay-text': '#1f2328',
  '--card-hover-border':'rgba(9,105,218,.35)',
  '--badge-bg-alpha':   '.15',
  '--tooltip-bg':       '#ffffff',
  '--select-bg':        '#f6f8fa',
};

SG.applyTheme = function (theme) {
  const isLight = theme === 'light';
  const root = document.documentElement;

  // ① Set data-theme attribute (keeps CSS [data-theme] selectors in sync)
  root.setAttribute('data-theme', isLight ? 'light' : 'dark');
  if (document.body) document.body.classList.toggle('light-theme', isLight);

  // ② DIRECTLY override CSS variables on the root element via JS
  //    This works regardless of browser CSS caching — guaranteed full-page update.
  if (isLight) {
    Object.entries(LIGHT_TOKENS).forEach(([k, v]) => root.style.setProperty(k, v));
  } else {
    // Dark mode: remove inline overrides so :root CSS defaults take over
    Object.keys(LIGHT_TOKENS).forEach(k => root.style.removeProperty(k));
  }

  // ③ Force body & key surfaces to repaint (belt-and-suspenders)
  if (document.body) {
    document.body.style.backgroundColor = isLight ? '#f4f6fb' : '#0d1117';
    document.body.style.color           = isLight ? '#1f2328' : '#e6edf3';
  }

  // ④ Update navbar theme toggle buttons
  document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn').forEach(btn => {
    const iconEl  = btn.querySelector('.theme-icon');
    const labelEl = btn.querySelector('.theme-label');
    if (iconEl)  iconEl.textContent  = isLight ? '☀️' : '🌙';
    if (labelEl) labelEl.textContent = isLight ? 'Light' : 'Dark';
    btn.setAttribute('aria-label', isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme');
    btn.setAttribute('title',      isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme');
  });

  // ⑤ Update map-overlay floating theme buttons
  document.querySelectorAll('.map-ui-theme-icon').forEach(el => { el.textContent = isLight ? '☀️' : '🌙'; });
  document.querySelectorAll('.map-ui-theme-label').forEach(el => { el.textContent = isLight ? 'Light' : 'Dark'; });

  // ⑥ Update Chart.js defaults + redraw all registered charts
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color       = isLight ? '#57606a' : '#8b949e';
    Chart.defaults.borderColor = isLight ? '#d0d7de' : '#30363d';
    if (Array.isArray(SG.activeCharts)) {
      SG.activeCharts.forEach(ch => {
        try {
          if (!ch || typeof ch.update !== 'function') return;
          // Update plugin colors
          if (ch.options.plugins && ch.options.plugins.tooltip) {
            Object.assign(ch.options.plugins.tooltip, {
              backgroundColor: isLight ? '#ffffff' : '#1e2530',
              borderColor:     isLight ? '#d0d7de' : '#30363d',
              titleColor:      isLight ? '#1f2328' : '#e6edf3',
              bodyColor:       isLight ? '#57606a' : '#8b949e',
            });
          }
          // Update scale colors
          if (ch.options.scales) {
            Object.values(ch.options.scales).forEach(scale => {
              if (scale.ticks) scale.ticks.color = isLight ? '#57606a' : '#8b949e';
              if (scale.grid)  scale.grid.color  = isLight ? '#e1e4e8' : '#30363d';
            });
          }
          // Update radar-specific scale
          if (ch.options.scales && ch.options.scales.r) {
            ch.options.scales.r.grid.color        = isLight ? '#d0d7de' : 'rgba(48,54,61,.8)';
            ch.options.scales.r.angleLines.color  = isLight ? '#d0d7de' : 'rgba(48,54,61,.8)';
            ch.options.scales.r.pointLabels.color = isLight ? '#57606a' : '#8b949e';
          }
          ch.update('none'); // 'none' = skip animation for instant repaint
        } catch (err) { /* ignore unmounted chart errors */ }
      });
    }
  }
};

SG.toggleTheme = function () {
  const current = SG.getTheme();
  const next = current === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem('skyguard_theme', next);
  } catch (e) {}
  SG.applyTheme(next);
  return next;
};

SG.initTheme = function () {
  // Apply saved theme immediately (CSS vars + body style)
  SG.applyTheme(SG.getTheme());

  // Bind click listeners to every theme toggle button in the page
  function bindThemeBtns() {
    document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn').forEach(function(btn) {
      if (!btn._themeListenerAttached) {
        btn._themeListenerAttached = true;
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          SG.toggleTheme();
        });
        // Remove any inline onclick to prevent double-fire
        btn.removeAttribute('onclick');
      }
    });
  }

  // Bind now (works when app.js is at bottom of body, DOM already ready)
  bindThemeBtns();

  // Also bind on DOMContentLoaded as a fallback (e.g. if script is in <head>)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindThemeBtns);
  }
};

// Initialise immediately — app.js sits at end of <body> so DOM is ready
SG.initTheme();

// ── Chart.js defaults ────────────────────────────────────────
if (typeof Chart !== 'undefined') {
  const isLight = SG.getTheme() === 'light';
  Chart.defaults.color          = isLight ? '#57606a' : '#8b949e';
  Chart.defaults.font.family    = "'Inter', system-ui, sans-serif";
  Chart.defaults.borderColor    = isLight ? '#d0d7de' : '#30363d';
}

const C = {
  red:'#e74c3c', orange:'#e67e22', yellow:'#f39c12',
  blue:'#3498db', green:'#2ecc71', purple:'#9b59b6',
  accent:'#58a6ff', muted:'#8b949e',
};
const SEV = { CRITICAL:C.red, HIGH:C.orange, MEDIUM:C.yellow, LOW:C.blue, NORMAL:C.green };
const TT  = { backgroundColor:'#1e2530', borderColor:'#30363d', borderWidth:1 };

/* ============================================================
   TAMIL NADU AWS STATION DEFINITIONS
   20 real AWS locations across Tamil Nadu
   coverage_km = approximate station monitoring radius in km
   ============================================================ */
const TN_STATIONS = [
  // Original 15
  { id:0,  name:'Chennai — Nungambakkam', short:'Chennai',       lat:13.0604, lng:80.2496, t:34, p:1008, h:72,  coverage_km:35 },
  { id:1,  name:'Madurai — Meenambakkam', short:'Madurai',       lat:9.8327,  lng:78.0930, t:33, p:1005, h:68,  coverage_km:30 },
  { id:2,  name:'Coimbatore — Peelamedu', short:'Coimbatore',    lat:11.0300, lng:77.0390, t:29, p:1010, h:65,  coverage_km:32 },
  { id:3,  name:'Tiruchirappalli',        short:'Trichy',        lat:10.7905, lng:78.7047, t:35, p:1004, h:70,  coverage_km:28 },
  { id:4,  name:'Salem — Fairlands',      short:'Salem',         lat:11.6643, lng:78.1460, t:31, p:1007, h:62,  coverage_km:25 },
  { id:5,  name:'Tirunelveli',            short:'Tirunelveli',   lat:8.7271,  lng:77.6954, t:32, p:1006, h:75,  coverage_km:27 },
  { id:6,  name:'Vellore — Katpadi',      short:'Vellore',       lat:12.9165, lng:79.1325, t:30, p:1009, h:60,  coverage_km:24 },
  { id:7,  name:'Erode — Surampatti',     short:'Erode',         lat:11.3410, lng:77.7172, t:30, p:1008, h:63,  coverage_km:26 },
  { id:8,  name:'Thoothukudi — Harbour',  short:'Thoothukudi',   lat:8.7642,  lng:78.1348, t:33, p:1007, h:80,  coverage_km:22 },
  { id:9,  name:'Dindigul — Sirumalai',   short:'Dindigul',      lat:10.3624, lng:77.9695, t:28, p:1012, h:67,  coverage_km:23 },
  { id:10, name:'Kancheepuram',           short:'Kancheepuram',  lat:12.8352, lng:79.7100, t:33, p:1008, h:71,  coverage_km:22 },
  { id:11, name:'Thanjavur',              short:'Thanjavur',     lat:10.7870, lng:79.1378, t:34, p:1005, h:74,  coverage_km:26 },
  { id:12, name:'Nagapattinam — Coast',   short:'Nagapattinam',  lat:10.7672, lng:79.8449, t:32, p:1007, h:82,  coverage_km:20 },
  { id:13, name:'Ooty — Nilgiris',        short:'Ooty',          lat:11.4102, lng:76.6950, t:16, p:1015, h:78,  coverage_km:18 },
  { id:14, name:'Rameshwaram — Island',   short:'Rameshwaram',   lat:9.2876,  lng:79.3129, t:31, p:1008, h:83,  coverage_km:20 },
  // 5 new stations
  { id:15, name:'Cuddalore — Coastal',    short:'Cuddalore',     lat:11.7480, lng:79.7680, t:32, p:1007, h:80,  coverage_km:22 },
  { id:16, name:'Puducherry — Raj Nivas', short:'Puducherry',    lat:11.9340, lng:79.8300, t:33, p:1007, h:78,  coverage_km:18 },
  { id:17, name:'Hosur — Denkanikottai',  short:'Hosur',         lat:12.7409, lng:77.8253, t:27, p:1011, h:60,  coverage_km:20 },
  { id:18, name:'Karur — Pappireddipatti',short:'Karur',         lat:10.9601, lng:78.0766, t:32, p:1006, h:65,  coverage_km:22 },
  { id:19, name:'Virudhunagar',           short:'Virudhunagar',  lat:9.5850,  lng:77.9624, t:33, p:1005, h:68,  coverage_km:20 },
];

/* ============================================================
   NAVBAR
   ============================================================ */
SG.initNav = function () {
  SG.initTheme();
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () =>
    nav?.classList.toggle('scrolled', window.scrollY > 30)
  );
  const burger = document.getElementById('burger');
  const links  = document.getElementById('navLinks');
  burger?.addEventListener('click', () => links?.classList.toggle('open'));
  links?.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
};

/* ============================================================
   HERO PARTICLE CANVAS
   ============================================================ */
SG.initCanvas = function () {
  const cv = document.getElementById('heroCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, pts = [], raf;
  const resize = () => { W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight; };
  const mkPt   = () => ({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.38, vy:(Math.random()-.5)*.38, r:Math.random()*1.6+.4, a:Math.random()*.5+.15 });
  const draw = () => {
    ctx.clearRect(0,0,W,H);
    for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++) {
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.hypot(dx,dy);
      if (d<128) { ctx.beginPath(); ctx.strokeStyle=`rgba(88,166,255,${.12*(1-d/128)})`; ctx.lineWidth=.5; ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
    }
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=`rgba(88,166,255,${p.a})`; ctx.fill(); p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>W)p.vx*=-1; if(p.y<0||p.y>H)p.vy*=-1; });
    raf = requestAnimationFrame(draw);
  };
  resize(); pts = Array.from({length:110},mkPt); draw();
  window.addEventListener('resize',()=>{ cancelAnimationFrame(raf); resize(); pts=Array.from({length:110},mkPt); draw(); });
};

/* ============================================================
   HERO SENSOR CARDS
   ============================================================ */
SG.initSensors = function () {
  const bases = [{t:34.2,p:1008.5,h:72.3},{t:29.8,p:1002.1,h:88.5},{t:22.4,p:1015.3,h:55.2}];
  let si=0, aCd=0;
  const upd = (id,status) => {
    const card=document.getElementById('sc'+id), tag=document.getElementById('st'+id);
    if(!card||!tag) return;
    tag.className='scard-tag '+(status==='bad'?'bad':status==='warn'?'warn':'ok');
    tag.textContent=status==='bad'?'ANOMALY DETECTED':status==='warn'?'WARNING':'NORMAL';
    card.classList.toggle('flash',status==='bad');
  };
  const tick = () => {
    const b=bases[si];
    let t=b.t+(Math.random()-.5)*.4, p=b.p+(Math.random()-.5)*.2, h=b.h+(Math.random()-.5)*1.5;
    let ts='ok',ps='ok',hs='ok';
    if(!aCd&&Math.random()<.05) aCd=3;
    if(aCd>0){ const tp=Math.floor(Math.random()*3); if(tp===0){t+=22+Math.random()*12;ts='bad';}else if(tp===1){p+=42+Math.random()*20;ps='bad';}else{h=97+Math.random()*3;hs='bad';} aCd--; }
    const sv0=document.getElementById('sv0'),sv1=document.getElementById('sv1'),sv2=document.getElementById('sv2');
    if(sv0)sv0.textContent=t.toFixed(1)+'°C'; if(sv1)sv1.textContent=p.toFixed(1)+' hPa'; if(sv2)sv2.textContent=h.toFixed(1)+'%';
    upd(0,ts); upd(1,ps); upd(2,hs);
  };
  setInterval(tick,1600);
  setInterval(()=>{ si=(si+1)%bases.length; },8000);
};

/* ============================================================
   COUNTER ANIMATION
   ============================================================ */
SG.initCounters = function () {
  const els = document.querySelectorAll('.hstat-num[data-target]');
  if (!els.length) return;
  const run = () => els.forEach(el => {
    const target=parseFloat(el.dataset.target), isFloat=el.dataset.float==='1';
    const dur=1600, t0=performance.now();
    const tick = now => {
      const p=Math.min((now-t0)/dur,1), e=1-Math.pow(1-p,3);
      el.textContent=isFloat?(target*e).toFixed(1):Math.floor(target*e);
      if(p<1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const obs = new IntersectionObserver(en=>{ if(en[0].isIntersecting){run();obs.disconnect();} },{threshold:.3});
  const target = document.querySelector('.hero-stats')||els[0].parentElement;
  if(target) obs.observe(target);
};

/* ============================================================
   SCROLL FADE-IN
   ============================================================ */
SG.initFade = function () {
  const items = document.querySelectorAll('.fi');
  items.forEach((el,i) => { el.style.transitionDelay=`${(i%6)*0.07}s`; });
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('show');
        /* If a Leaflet map is inside this element, invalidate its size
           once the fade-in transition completes so tiles render correctly */
        e.target.addEventListener('transitionend', () => {
          if (SG._locMap) SG._locMap.invalidateSize();
          if (SG._tnMap)  SG._tnMap.invalidateSize();
        }, { once: true });
        obs.unobserve(e.target);
      }
    });
  },{threshold:.1});
  items.forEach(el => obs.observe(el));
};

/* ============================================================
   PROGRESS BARS (architecture page)
   ============================================================ */
SG.initProgressBars = function () {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(!e.isIntersecting) return;
      e.target.querySelectorAll('.prog-fill[data-w]').forEach(f=>{ f.style.width=f.dataset.w+'%'; });
      obs.unobserve(e.target);
    });
  },{threshold:.3});
  document.querySelectorAll('.model-card').forEach(el => obs.observe(el));
};

/* ============================================================
   METRIC BARS (metrics page)
   ============================================================ */
SG.initMetricBars = function () {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(!e.isIntersecting) return;
      e.target.querySelectorAll('.m-fill[data-w]').forEach(f=>{ f.style.width=f.dataset.w+'%'; });
      obs.unobserve(e.target);
    });
  },{threshold:.3});
  document.querySelectorAll('.m-bar-section').forEach(el => obs.observe(el));
};

/* ============================================================
   FILTER TABS (anomalies page)
   ============================================================ */
SG.initFilterTabs = function () {
  const tabs=document.querySelectorAll('.ftab'), cards=document.querySelectorAll('#anomGrid .card[data-cat]');
  if(!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click',()=>{
      tabs.forEach(t=>t.classList.remove('on')); tab.classList.add('on');
      const f=tab.dataset.f;
      cards.forEach(c=>{ const match=f==='all'||c.dataset.cat===f; c.style.opacity=match?'1':'0.18'; c.style.transform=match?'':'scale(.97)'; c.style.pointerEvents=match?'':'none'; });
    });
  });
};

/* ============================================================
   ANOMALY MINI CHARTS (anomalies page)
   ============================================================ */
SG.initMiniCharts = function () {
  const line = (data,color) => ({
    type:'line',
    data:{labels:data.map((_,i)=>i),datasets:[{data,borderColor:color,borderWidth:2,pointRadius:0,tension:.3,fill:false}]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}},
  });
  const norm=(base,n,amp)=>Array.from({length:n},(_,i)=>base+Math.sin(i/4)*amp+(Math.random()-.5)*amp*.4);
  const sp=norm(34,30,.4); sp[18]=72;
  const sC=document.getElementById('spikeC')?.getContext('2d'); if(sC) new Chart(sC,line(sp,C.red));
  const fr=norm(34,30,.3); for(let i=12;i<28;i++)fr[i]=fr[11];
  const fC=document.getElementById('frozenC')?.getContext('2d'); if(fC) new Chart(fC,line(fr,C.blue));
  const dr=norm(1005,30,.2); for(let i=10;i<30;i++)dr[i]+=(i-10)*.8;
  const dC=document.getElementById('driftC')?.getContext('2d'); if(dC) new Chart(dC,line(dr,C.yellow));
  const oo=norm(34,30,.3); oo[15]=74; oo[16]=72;
  const oC=document.getElementById('oorC')?.getContext('2d'); if(oC) new Chart(oC,line(oo,C.red));
  const mt=norm(34,30,.3),mh=norm(72,30,1); mt[20]=54; mh[20]=96;
  const mC=document.getElementById('multiC')?.getContext('2d');
  if(mC) new Chart(mC,{type:'line',data:{labels:mt.map((_,i)=>i),datasets:[{data:mt,borderColor:C.red,borderWidth:2,pointRadius:0,tension:.3,fill:false},{data:mh,borderColor:C.green,borderWidth:2,pointRadius:0,tension:.3,fill:false}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}}});
  const no=norm(34,30,.3); for(let i=12;i<22;i++)no[i]+=(Math.random()-.5)*18;
  const nC=document.getElementById('noiseC')?.getContext('2d'); if(nC) new Chart(nC,line(no,C.orange));
  const ms=norm(30,30,.3); for(let i=10;i<22;i++)ms[i]=null;
  const msC=document.getElementById('missingC')?.getContext('2d');
  if(msC) new Chart(msC,{type:'line',data:{labels:ms.map((_,i)=>i),datasets:[{data:ms,borderColor:C.muted,borderWidth:2,pointRadius:0,tension:.3,fill:false,spanGaps:false}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}}}});
};

/* ============================================================
   METRICS CHARTS (metrics page)
   ============================================================ */
SG.initMetricsCharts = function () {
  const isLight = SG.getTheme() === 'light';
  const TTMetrics = { backgroundColor: isLight ? '#ffffff' : '#1e2530', borderColor: isLight ? '#d0d7de' : '#30363d', borderWidth: 1, titleColor: isLight ? '#1f2328' : '#e6edf3', bodyColor: isLight ? '#57606a' : '#8b949e' };
  const rCtx=document.getElementById('radarChart')?.getContext('2d');
  if(rCtx) {
    const rc = new Chart(rCtx,{type:'radar',data:{labels:['Accuracy','Precision','Recall','ROC-AUC','Real-Time','Explainability','Scalability','Energy'],datasets:[{label:'SkyGuard AI',data:[97,93,96,98,92,90,88,85],backgroundColor:'rgba(88,166,255,.13)',borderColor:C.accent,borderWidth:2,pointBackgroundColor:C.accent,pointRadius:4},{label:'Threshold Baseline',data:[72,65,78,70,95,45,70,90],backgroundColor:'rgba(230,126,34,.07)',borderColor:C.orange,borderWidth:1.5,pointBackgroundColor:C.orange,pointRadius:3,borderDash:[4,4]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:14,usePointStyle:true}},tooltip:TTMetrics},scales:{r:{min:0,max:100,ticks:{stepSize:20,display:false},grid:{color:isLight?'#d0d7de':'rgba(48,54,61,.8)'},angleLines:{color:isLight?'#d0d7de':'rgba(48,54,61,.8)'},pointLabels:{font:{size:10},color:isLight?'#57606a':'#8b949e'}}}}});
    SG.activeCharts.push(rc);
  }
  const bCtx=document.getElementById('barChart')?.getContext('2d');
  if(bCtx) {
    const bc = new Chart(bCtx,{type:'bar',data:{labels:['Precision','Recall','F1','ROC-AUC','Accuracy'],datasets:[{label:'SkyGuard AI',data:[93,96,94,98,97],backgroundColor:[C.blue,C.green,C.red,C.purple,C.yellow],borderRadius:6,borderSkipped:false},{label:'Threshold Baseline',data:[65,78,71,70,72],backgroundColor:'rgba(139,148,158,.22)',borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:14,usePointStyle:true}},tooltip:{...TTMetrics,callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.y}%`}}},scales:{x:{grid:{display:false},ticks:{font:{size:11}}},y:{min:0,max:110,grid:{color:isLight?'#e9eef6':'#1e2530'},ticks:{callback:v=>v+'%',font:{size:11}}}}}});
    SG.activeCharts.push(bc);
  }
};

/* ============================================================
   LIVE DASHBOARD  (15-station Tamil Nadu network)
   ============================================================ */
SG.initDashboard = function () {
  const MAX = 60;
  const N   = TN_STATIONS.length; // 15

  const state = {
    on:true, speed:1000, si:0, atype:'none',
    total:0, anoms:0, crits:0,
    sts: TN_STATIONS.map(s => ({ name:s.name, short:s.short, total:0, anoms:0, sev:'NORMAL', t:s.t, p:s.p, h:s.h, conf:0.05 })),
    sev: { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0 },
  };
  const hist = Array.from({length:N}, ()=>({ t:[], p:[], h:[], s:[], lb:[] }));

  /* Ensure hist grows when custom stations are added */
  function getHist(idx) {
    while (hist.length <= idx) hist.push({ t:[], p:[], h:[], s:[], lb:[] });
    return hist[idx];
  }
  let timer = null;

  /* ── build charts ── */
  const isLight = SG.getTheme() === 'light';
  const TTDash = { backgroundColor: isLight ? '#ffffff' : '#1e2530', borderColor: isLight ? '#d0d7de' : '#30363d', borderWidth: 1, titleColor: isLight ? '#1f2328' : '#e6edf3', bodyColor: isLight ? '#57606a' : '#8b949e' };
  const gridDash = isLight ? '#e9eef6' : '#1e2530';

  const tsCtx = document.getElementById('tsChart')?.getContext('2d');
  let tsChart = null;
  if (tsCtx) {
    tsChart = new Chart(tsCtx, {
      type:'line',
      data:{labels:[],datasets:[
        {label:'Temp °C',      data:[],borderColor:C.red,   backgroundColor:'rgba(231,76,60,.05)', fill:true, borderWidth:1.5,pointRadius:0,tension:.3,yAxisID:'yT'},
        {label:'Pressure hPa', data:[],borderColor:C.blue,  backgroundColor:'rgba(52,152,219,.04)',fill:false,borderWidth:1.5,pointRadius:0,tension:.3,yAxisID:'yP'},
        {label:'Humidity %',   data:[],borderColor:C.green, backgroundColor:'rgba(46,204,113,.04)',fill:false,borderWidth:1.5,pointRadius:0,tension:.3,yAxisID:'yH'},
        {label:'Anomaly',type:'scatter',data:[],pointRadius:7,pointStyle:'triangle',backgroundColor:[],borderColor:[],borderWidth:2,yAxisID:'yT',showLine:false},
      ]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},
        interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{...TTDash,callbacks:{label:c=>c.dataset.label==='Anomaly'?null:` ${c.dataset.label}: ${c.parsed.y?.toFixed(2)}`}}},
        scales:{
          x:{grid:{color:gridDash},ticks:{maxTicksLimit:8,font:{size:10}}},
          yT:{type:'linear',position:'left', grid:{color:gridDash},ticks:{color:C.red,  font:{size:9},callback:v=>v+'°C'}},
          yP:{type:'linear',position:'right',grid:{drawOnChartArea:false},ticks:{color:C.blue, font:{size:9},callback:v=>v+'hPa'}},
          yH:{type:'linear',position:'right',grid:{drawOnChartArea:false},ticks:{color:C.green,font:{size:9},callback:v=>v+'%'},display:false},
        },
      },
    });
    SG.activeCharts.push(tsChart);
  }

  const cfCtx = document.getElementById('confChart')?.getContext('2d');
  let cfChart = null;
  if (cfCtx) {
    cfChart = new Chart(cfCtx, {
      type:'line',
      data:{labels:[],datasets:[{label:'Confidence',data:[],borderColor:C.accent,backgroundColor:'rgba(88,166,255,.1)',fill:true,borderWidth:1.5,pointRadius:0,tension:.4}]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:0},
        plugins:{legend:{display:false},tooltip:TTDash,annotation:{annotations:{
          c1:{type:'line',yMin:.85,yMax:.85,borderColor:C.red,   borderWidth:1,borderDash:[4,4]},
          c2:{type:'line',yMin:.65,yMax:.65,borderColor:C.orange,borderWidth:1,borderDash:[4,4]},
          c3:{type:'line',yMin:.45,yMax:.45,borderColor:C.yellow,borderWidth:1,borderDash:[4,4]},
        }}},
        scales:{
          x:{grid:{color:gridDash},ticks:{maxTicksLimit:6,font:{size:10}}},
          y:{min:0,max:1,grid:{color:gridDash},ticks:{callback:v=>(v*100).toFixed(0)+'%',font:{size:10}}},
        },
      },
    });
    SG.activeCharts.push(cfChart);
  }

  const svCtx = document.getElementById('sevChart')?.getContext('2d');
  let svChart = null;
  if (svCtx) {
    svChart = new Chart(svCtx, {
      type:'doughnut',
      data:{labels:['CRITICAL','HIGH','MEDIUM','LOW'],datasets:[{data:[0,0,0,0],backgroundColor:[C.red,C.orange,C.yellow,C.blue],borderColor:isLight?'#ffffff':'#161b22',borderWidth:3,hoverOffset:6}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'65%',
        plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:12,usePointStyle:true}},tooltip:{...TTDash,callbacks:{label:c=>` ${c.label}: ${c.parsed}`}}}},
    });
    SG.activeCharts.push(svChart);
  }

  /* ── helpers ── */
  const push = (a,v) => { a.push(v); if(a.length>MAX) a.shift(); };

  function gen() {
    const st = state.sts[state.si];
    /* Use TN_STATIONS base values if available, otherwise fall back to state values */
    const b  = TN_STATIONS[state.si] || { t: st.t||32, p: st.p||1007, h: st.h||70 };
    let t = b.t + (Math.random()-.5)*.8;
    let p = b.p + (Math.random()-.5)*.4;
    let h = b.h + (Math.random()-.5)*2;
    let s = .05 + Math.random()*.1;
    const a = state.atype;

    if (a==='spike_temp') { t+=22+Math.random()*14; s=.88+Math.random()*.1; }
    if (a==='spike_pres') { p+=44+Math.random()*20; s=.82+Math.random()*.1; }
    if (a==='frozen')     { t=b.t;                   s=.55+Math.random()*.15; }
    if (a==='oor')        { t=65+Math.random()*10;   s=.96; }
    if (a==='multi')      { t=52+Math.random()*5; h=93+Math.random()*6; p=1058+Math.random()*15; s=.78+Math.random()*.15; }
    if (a==='missing')    { t=null; p=null; h=null; s=.95; }

    const sev = s>=.85?'CRITICAL':s>=.65?'HIGH':s>=.45?'MEDIUM':s>=.25?'LOW':'NORMAL';
    const lb  = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return { t, p, h, s, sev, lb, a };
  }

  function updCharts() {
    const hx = getHist(state.si);
    if (tsChart) {
      tsChart.data.labels           = hx.lb;
      tsChart.data.datasets[0].data = hx.t;
      tsChart.data.datasets[1].data = hx.p;
      tsChart.data.datasets[2].data = hx.h;
      const pts=[], clr=[];
      hx.s.forEach((sc,i) => {
        if (sc>=.25) { pts.push({x:hx.lb[i],y:hx.t[i]}); clr.push(SEV[sc>=.85?'CRITICAL':sc>=.65?'HIGH':sc>=.45?'MEDIUM':'LOW']); }
      });
      tsChart.data.datasets[3].data=pts;
      tsChart.data.datasets[3].backgroundColor=clr;
      tsChart.data.datasets[3].borderColor=clr;
      tsChart.update('none');
    }
    if (cfChart) { cfChart.data.labels=hx.lb; cfChart.data.datasets[0].data=hx.s; cfChart.update('none'); }
    if (svChart) { svChart.data.datasets[0].data=[state.sev.CRITICAL,state.sev.HIGH,state.sev.MEDIUM,state.sev.LOW]; svChart.update('none'); }
  }

  function updKPIs() {
    const r = state.total>0 ? state.anoms/state.total : 0;
    const $ = id => document.getElementById(id);
    if($('kTotal'))  $('kTotal').textContent  = state.total;
    if($('kAnom'))   $('kAnom').textContent   = state.anoms;
    if($('kCrit'))   $('kCrit').textContent   = state.crits;
    const h = $('kHealth');
    if (h) h.textContent = r<.02?'🟢':r<.08?'🟡':r<.2?'🟠':'🔴';
    // map stats bar
    if($('mapTotal'))  $('mapTotal').textContent  = state.total;
    if($('mapAnom'))   $('mapAnom').textContent    = state.anoms;
    if($('mapCrit'))   $('mapCrit').textContent    = state.crits;
    if($('mapHealth')) $('mapHealth').textContent  = r<.02?'🟢':r<.08?'🟡':r<.2?'🟠':'🔴';
  }

  function updStations() {
    const el = document.getElementById('stList');
    if (!el) return;
    // Only show the currently selected station
    const s   = state.sts[state.si];
    const r   = s.total > 0 ? s.anoms / s.total : 0;
    const lbl = r < .02 ? 'HEALTHY' : r < .08 ? 'DEGRADED' : r < .2 ? 'FAULT' : 'CRITICAL';
    const cc  = r < .02 ? '' : r < .08 ? 'deg' : r < .2 ? 'fault' : 'crit';
    el.innerHTML = `<div class="st-item ${cc}"><div class="st-dot"></div><div class="st-info"><strong>${s.name}</strong><small>${s.anoms}/${s.total} anomalies · ${lbl}</small></div></div>`;
    // push updates to the map
    if (typeof SG._mapUpdateMarkers === 'function') SG._mapUpdateMarkers(state.sts);
  }

  const ROOT = {
    spike_temp:'Spike — Temperature', spike_pres:'Spike — Pressure',
    frozen:'Sensor Frozen', oor:'Physical Impossibility — OOR',
    multi:'Multivariate Inconsistency', missing:'Communication Loss',
    none:'Statistical deviation',
  };

  function addAlert(r) {
    const feed = document.getElementById('alertFeed');
    if (!feed) return;
    feed.querySelector('.af-empty')?.remove();
    const item = document.createElement('div');
    item.className = `af-item ${r.sev.toLowerCase()}`;
    const stName = state.sts[state.si].name;
    const vals   = r.t==null ? 'ALL NULL' : `T=${r.t?.toFixed(1)}°C P=${r.p?.toFixed(1)}hPa H=${r.h?.toFixed(1)}%`;
    item.innerHTML = `<div class="af-sev ${r.sev}">${r.sev}</div>
      <div class="af-text"><strong>${stName}</strong>
        <span>${vals} · ${(r.s*100).toFixed(1)}%</span>
        <span style="font-size:10px">${ROOT[r.a]||'Anomaly'}</span>
      </div>`;
    feed.insertBefore(item, feed.firstChild);
    while (feed.children.length > 14) feed.removeChild(feed.lastChild);
  }

  function tick() {
    const si = state.si;
    /* Guard: skip if this station was removed */
    if (state.sts[si]?.removed) return;
    const r  = gen();
    const hx = getHist(si);
    push(hx.t, r.t); push(hx.p, r.p); push(hx.h, r.h); push(hx.s, r.s); push(hx.lb, r.lb);
    state.total++; state.sts[si].total++;
    // update current station live values
    state.sts[si].t    = r.t ?? state.sts[si].t;
    state.sts[si].p    = r.p ?? state.sts[si].p;
    state.sts[si].h    = r.h ?? state.sts[si].h;
    state.sts[si].conf = r.s;
    state.sts[si].sev  = r.sev;
    if (r.sev !== 'NORMAL') {
      state.anoms++; state.crits += r.sev==='CRITICAL'?1:0;
      state.sts[si].anoms++; state.sev[r.sev]++;
      addAlert(r);
    }
    updCharts(); updKPIs(); updStations();
  }

  const start = () => { clearInterval(timer); timer = setInterval(tick, state.speed); };
  start();

  /* ── controls ── */
  document.getElementById('stSel')?.addEventListener('change', e => {
    const newSi = +e.target.value;
    /* Reset per-session KPIs when switching stations */
    state.total = 0;
    state.anoms = 0;
    state.crits = 0;
    state.sev   = { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0 };
    /* Clear alert feed */
    const feed = document.getElementById('alertFeed');
    if (feed) feed.innerHTML = '<div class="af-empty">No anomalies detected yet…</div>';
    state.si = newSi;
    /* Ensure this station entry exists in state.sts */
    if (!state.sts[newSi]) {
      const cst = SG._customStationById ? SG._customStationById(newSi) : null;
      if (cst) {
        state.sts[newSi] = { name:cst.name, short:cst.short, total:0, anoms:0, sev:'NORMAL', t:cst.t, p:cst.p, h:cst.h, conf:0.05, custom:true };
      }
    }
    if (typeof SG._mapSelectStation === 'function') SG._mapSelectStation(newSi);
  });
  
  const triggerDashInject = (atype) => {
    state.atype = atype;
    const st = TN_STATIONS[state.si] || (SG._customStationById ? SG._customStationById(state.si) : null) || { name: 'Station ' + state.si, lat: 10.85, lng: 78.65 };
    if (atype !== 'none' && SG._tnMap) {
      SG.triggerInjectAnimation(SG._tnMap, st.lat, st.lng, atype, st.name);
    }
    if (typeof tick === 'function') tick();
  };

  document.getElementById('anSel')?.addEventListener('change', e => {
    triggerDashInject(e.target.value);
  });

  document.getElementById('injectBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('anSel');
    if (sel) {
      if (sel.value === 'none') sel.value = 'spike_temp';
      triggerDashInject(sel.value);
    }
  });

  document.querySelectorAll('.sp-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.sp-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); state.speed = +b.dataset.ms; if(state.on) start();
    });
  });

  const tb = document.getElementById('toggleBtn');
  const ti = document.getElementById('toggleIcon');
  tb?.addEventListener('click', () => {
    state.on = !state.on;
    if (state.on) { start(); if(ti)ti.textContent='⏸'; if(tb)tb.childNodes[tb.childNodes.length-1].textContent=' Pause'; }
    else          { clearInterval(timer);timer=null; if(ti)ti.textContent='▶'; if(tb)tb.childNodes[tb.childNodes.length-1].textContent=' Resume'; }
  });

  // Expose state for map to read
  SG._dashState = state;
};

/* ============================================================
   RELATABLE INJECT ANOMALY MAP ANIMATION SYSTEM
   ============================================================ */
SG.triggerInjectAnimation = function(map, lat, lng, atype, stationName, customDetails) {
  if (!map || typeof L === 'undefined') return;

  const ANOMALY_META = {
    spike_temp: { name: 'Temperature Spike', icon: '🌡️🔥', color: '#ff3b30', bgGlow: 'rgba(255, 59, 48, 0.45)', text: 'Thermal Heatwave Surge (+32.4°C jump)' },
    spike_pres: { name: 'Pressure Spike', icon: '🌀⚡', color: '#00f2fe', bgGlow: 'rgba(0, 242, 254, 0.45)', text: 'Barometric Shockwave Surge (+54.8 hPa surge)' },
    frozen:     { name: 'Frozen Sensor', icon: '❄️🔒', color: '#00d2ff', bgGlow: 'rgba(0, 210, 255, 0.45)', text: 'Telemetry Freeze Stagnation (Readings Locked)' },
    oor:        { name: 'Out of Range', icon: '⚠️💥', color: '#ff0055', bgGlow: 'rgba(255, 0, 85, 0.45)', text: 'Physical Impossibility Breach (>65°C Limit)' },
    multi:      { name: 'Multivariate Fault', icon: '⚡👾', color: '#f5af19', bgGlow: 'rgba(245, 175, 25, 0.45)', text: 'Cross-Sensor Biohazard Inconsistency' },
    missing:    { name: 'Communication Loss', icon: '📡❌', color: '#ff416c', bgGlow: 'rgba(255, 65, 108, 0.45)', text: 'Station Telemetry Signal Disconnect (100% Drop)' },
    none:       { name: 'Normal State', icon: '🟢✨', color: '#2ecc71', bgGlow: 'rgba(46, 204, 113, 0.45)', text: 'All Sensor Signals Nominal' }
  };

  const meta = ANOMALY_META[atype] || ANOMALY_META['spike_temp'];
  if (atype === 'none') return;

  // 1. Pan map to target location
  if (lat != null && lng != null) {
    map.panTo([lat, lng], { animate: true, duration: 0.6 });
  }

  // 2. Spawn Concentric Shockwave Rings + Cyber Reticle Snap Leaflet Overlay
  if (lat != null && lng != null) {
    const animHtml = `
      <div class="sg-anomaly-anim-container" style="--an-color: ${meta.color}; --an-glow: ${meta.bgGlow}">
        <div class="sg-shockwave-ring ring-1"></div>
        <div class="sg-shockwave-ring ring-2"></div>
        <div class="sg-shockwave-ring ring-3"></div>
        <div class="sg-target-reticle">
          <div class="reticle-corner tl"></div>
          <div class="reticle-corner tr"></div>
          <div class="reticle-corner bl"></div>
          <div class="reticle-corner br"></div>
          <div class="reticle-center-dot"></div>
        </div>
        <div class="sg-floating-anomaly-badge">
          <span class="an-icon">${meta.icon}</span>
          <div class="an-info">
            <div class="an-title">${meta.name} Injected</div>
            <div class="an-desc">${stationName || 'Target Station'}</div>
          </div>
        </div>
      </div>
    `;

    const animIcon = L.divIcon({
      className: 'sg-anim-leaflet-wrapper',
      html: animHtml,
      iconSize: [200, 200],
      iconAnchor: [100, 100]
    });

    const animMarker = L.marker([lat, lng], { icon: animIcon, zIndexOffset: 1000, interactive: false }).addTo(map);

    setTimeout(() => {
      try { map.removeLayer(animMarker); } catch(e) {}
    }, 4200);
  }

  // 3. Render Glassmorphic Map HUD Alert Banner inside the map wrap container
  try {
    const mapEl = map.getContainer();
    const mapWrap = mapEl.closest('.map-wrap, .loc-map-wrap, .map-section') || mapEl.parentElement;
    if (mapWrap) {
      let hud = mapWrap.querySelector('.sg-map-hud-banner');
      if (!hud) {
        hud = document.createElement('div');
        hud.className = 'sg-map-hud-banner';
        mapWrap.appendChild(hud);
      }

      hud.style.borderColor = meta.color;
      hud.style.boxShadow = `0 8px 32px ${meta.bgGlow}, inset 0 0 15px ${meta.bgGlow}`;
      hud.innerHTML = `
        <div class="hud-content">
          <span class="hud-badge" style="background:${meta.color}">${meta.icon} ANOMALY INJECTED</span>
          <div class="hud-text">
            <strong>${stationName || 'Target Station'}: ${meta.name}</strong>
            <span>${customDetails || meta.text}</span>
          </div>
        </div>
        <button class="hud-close" onclick="this.parentElement.classList.remove('active')">&times;</button>
      `;

      // Animate banner entry
      hud.classList.remove('active');
      void hud.offsetWidth; // trigger reflow
      hud.classList.add('active');

      // Auto dismiss banner after 5.5 seconds
      if (hud._dismissTimer) clearTimeout(hud._dismissTimer);
      hud._dismissTimer = setTimeout(() => {
        if (hud) hud.classList.remove('active');
      }, 5500);
    }
  } catch(err) {
    console.error("Map HUD Banner error:", err);
  }
};

/* ============================================================
   MAP READY CALLBACKS & HELPERS (Leaflet / OpenStreetMap)
   ============================================================ */
SG.initAllMaps = function () {
  SG.initTNMap();
  SG.initAddStation();
};

/* ============================================================
   TAMIL NADU MAP — Leaflet (CartoDB / OpenStreetMap)
   Each station renders:
     1. L.circle — geo-accurate coverage zone
     2. L.circleMarker — station dot with threat indicator
   Dark / Light theme toggle is built in.
   ============================================================ */
SG.initTNMap = function () {
  if (typeof L === 'undefined') { console.warn('Leaflet not loaded'); return; }
  const el = document.getElementById('tnMap');
  if (!el) return;

  /* ── CSS: tooltips, labels, pulse animation ──────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .leaflet-attribution-flag          { display:none!important; }
    .leaflet-control-attribution       { background:rgba(13,17,23,.75)!important; color:#6e7681!important; font-size:10px!important; }
    .leaflet-control-attribution a     { color:#58a6ff!important; }
    .leaflet-control-zoom a            { background:#161b22!important; color:#e6edf3!important; border-color:#30363d!important; line-height:26px!important; }
    .leaflet-control-zoom a:hover      { background:#1e2530!important; color:#58a6ff!important; }

    .sg-tt { background:#161b22!important; border:1px solid #30363d!important; color:#e6edf3!important;
             border-radius:10px!important; padding:10px 14px!important;
             box-shadow:0 4px 24px rgba(0,0,0,.7)!important; pointer-events:none!important; }
    .sg-tt::before,.leaflet-tooltip-top.sg-tt::before { display:none!important; }

    .sg-label { background:transparent!important; border:none!important; box-shadow:none!important;
                color:#c9d1d9; font-family:Inter,sans-serif; font-size:10px; font-weight:600;
                white-space:nowrap; pointer-events:none!important; letter-spacing:.3px;
                text-shadow:0 1px 5px #0d1117,0 0 8px #0d1117; }
    .sg-label.sel { color:#58a6ff!important; font-weight:800; font-size:11.5px; }

    @keyframes sg-pulse {
      0%   { transform:scale(1);   opacity:.85; }
      70%  { transform:scale(2.8); opacity:0;   }
      100% { transform:scale(2.8); opacity:0;   }
    }
    .sg-pulse-ring { border-radius:50%; position:absolute;
                     animation:sg-pulse 1.9s ease-out infinite; pointer-events:none; }
  `;
  document.head.appendChild(styleEl);

  /* ── Map init ────────────────────────────────────────── */
  const map = L.map('tnMap', {
    center: [10.85, 78.65], zoom: 7, minZoom: 5, maxZoom: 16,
    zoomControl: false, attributionControl: false,
  });
  SG._tnMap = map; // expose for initFade invalidateSize
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    subdomains: ['a', 'b', 'c'],
    className: 'dark-cyber-tile',
    maxNativeZoom: 19, maxZoom: 19, minZoom: 4,
    errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%230d1117"/></svg>',
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  /* Force Leaflet to recalculate container size after DOM layout is complete.
     Use multiple delays to handle both fast and slow layout reflows,
     and also listen for the fade-in transition on the wrapper. */
  setTimeout(() => map.invalidateSize(), 150);
  setTimeout(() => map.invalidateSize(), 500);
  const _tnMapEl = document.getElementById('tnMap');
  if (_tnMapEl) {
    const _tnWrap = _tnMapEl.closest('.loc-map-wrap, .map-wrap, [class*="map"]');
    if (_tnWrap) {
      _tnWrap.addEventListener('transitionend', () => map.invalidateSize(), { once: true });
    }
    // ResizeObserver fallback
    if (typeof ResizeObserver !== 'undefined') {
      const _tnRO = new ResizeObserver(() => map.invalidateSize());
      _tnRO.observe(_tnMapEl);
      setTimeout(() => _tnRO.disconnect(), 3000);
    }
  }

  /* ── Wire map click → add-station flow ───────────────── */
  map.on('click', e => {
    if (typeof SG._onMapClick === 'function') {
      SG._onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });

  /* ── Colours & helpers ───────────────────────────────── */
  const SEV_COL = { HEALTHY:'#2ecc71', DEGRADED:'#f39c12', FAULT:'#e67e22', CRITICAL:'#e74c3c', NORMAL:'#2ecc71' };

  function stateToHealth(st) {
    const r = st.total > 0 ? st.anoms / st.total : 0;
    return r < .02 ? 'HEALTHY' : r < .08 ? 'DEGRADED' : r < .2 ? 'FAULT' : 'CRITICAL';
  }

  /* ── Tooltip card ────────────────────────────────────── */
  function tooltipHTML(st, sst, col, health) {
    const t    = sst?.t != null ? sst.t.toFixed(1)+'°C'   : st.t+'°C';
    const p    = sst?.p != null ? sst.p.toFixed(1)+' hPa' : st.p+' hPa';
    const h    = sst?.h != null ? sst.h.toFixed(1)+'%'    : st.h+'%';
    const conf = sst ? (sst.conf*100).toFixed(1)+'%' : '—';
    return `<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.65;min-width:186px">
      <div style="font-weight:700;font-size:13px;margin-bottom:7px;display:flex;align-items:center;gap:6px">
        <span style="width:9px;height:9px;border-radius:50%;background:${col};display:inline-block;flex-shrink:0"></span>${st.name}
      </div>
      <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">🌡 Temp</span><b style="font-family:monospace">${t}</b></div>
      <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">🔵 Pressure</span><b style="font-family:monospace">${p}</b></div>
      <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">💧 Humidity</span><b style="font-family:monospace">${h}</b></div>
      <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">📊 Confidence</span><b style="font-family:monospace">${conf}</b></div>
      <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">📡 Coverage</span><b style="font-family:monospace">${st.coverage_km} km radius</b></div>
      <div style="margin-top:7px;text-align:center">
        <span style="background:${col}22;color:${col};padding:2px 10px;border-radius:9px;font-weight:800;font-size:10px;letter-spacing:1px">${health}</span>
      </div>
    </div>`;
  }

  /* ── Pulse icon factory ──────────────────────────────── */
  function makePulseIcon(col, px) {
    return L.divIcon({
      className: '',
      html: `<div class="sg-pulse-ring" style="width:${px*2}px;height:${px*2}px;background:${col};opacity:.5"></div>`,
      iconSize: [px*2, px*2], iconAnchor: [px, px],
    });
  }

  /* ── Label icon factory ──────────────────────────────── */
  function makeLabelIcon(short, sel) {
    return L.divIcon({
      className: 'sg-label' + (sel ? ' sel' : ''),
      html: `<span>${short}</span>`,
      iconSize: [130, 20], iconAnchor: [-5, -5],
    });
  }

  /* ── Build all stations ──────────────────────────────── */
  const stations = []; // { coverageCircle, dot, labelMarker, pulseLayer }
  let selectedIdx = 0;

  TN_STATIONS.forEach((st, i) => {
    const initCol = '#2ecc71';
    const isSel   = i === 0;

    /*
     * Layer 1 — Coverage zone: L.circle with radius in metres
     * radius = coverage_km * 1000  (real geographic metres on the map)
     * This scales naturally when zooming — bigger circle = wider sensor reach
     */
    const coverageCircle = L.circle([st.lat, st.lng], {
      radius:      st.coverage_km * 1000,   // ← the key calculation
      color:       initCol,
      fillColor:   initCol,
      fillOpacity: isSel ? 0.10 : 0.05,
      weight:      isSel ? 1.5  : 0.8,
      opacity:     isSel ? 0.7  : 0.35,
      dashArray:   isSel ? null : '4 4',    // dashed for non-selected
      interactive: false,
    }).addTo(map);

    /*
     * Layer 2 — Station dot: L.circleMarker (fixed pixel radius, zoom-independent)
     */
    const dot = L.circleMarker([st.lat, st.lng], {
      radius:      isSel ? 11 : 8,
      color:       isSel ? '#ffffff' : initCol,
      fillColor:   initCol,
      fillOpacity: 0.92,
      weight:      isSel ? 2.5 : 1.5,
    }).addTo(map);

    /* Layer 3 — Name label */
    const labelMarker = L.marker([st.lat, st.lng], {
      icon: makeLabelIcon(st.short, isSel),
      interactive: false,
      zIndexOffset: 20,
    }).addTo(map);

    /* Layer 4 — Pulse ring (hidden until anomaly) */
    const pulseMarker = L.marker([st.lat, st.lng], {
      icon: makePulseIcon(initCol, 18),
      zIndexOffset: -10, interactive: false,
    });
    const pulseLayer = { marker: pulseMarker, active: false };

    /* Tooltip on dot */
    dot.bindTooltip(tooltipHTML(st, null, initCol, 'HEALTHY'),
      { direction:'top', permanent:false, className:'sg-tt', offset:[0,-6] });

    dot.on('mouseover', function () {
      const ds  = SG._dashState;
      const sst = ds ? ds.sts[i] : null;
      const h   = sst ? stateToHealth(sst) : 'HEALTHY';
      dot.setTooltipContent(tooltipHTML(st, sst, SEV_COL[h], h));
      this.openTooltip();
    });

    dot.on('click', () => {
      selectStation(i);
      const sel = document.getElementById('stSel');
      if (sel) { sel.value = String(i); sel.dispatchEvent(new Event('change')); }
    });

    stations.push({ coverageCircle, dot, labelMarker, pulseLayer });
  });

  /* ── Apply visual state to one station ──────────────── */
  function applyStyle(i, col, selected, anomalous) {
    const { coverageCircle, dot, labelMarker, pulseLayer } = stations[i];

    /* Coverage circle — selected gets solid fill + bright stroke */
    coverageCircle.setStyle({
      color:       selected ? col : col,
      fillColor:   col,
      fillOpacity: selected ? 0.13 : anomalous ? 0.09 : 0.04,
      weight:      selected ? 2    : anomalous ? 1.2  : 0.7,
      opacity:     selected ? 0.9  : anomalous ? 0.7  : 0.3,
      dashArray:   selected ? null : anomalous ? null : '5 5',
    });

    /* Dot */
    dot.setRadius(selected ? 13 : anomalous ? 10 : 8);
    dot.setStyle({
      color:       selected ? '#ffffff' : col,
      fillColor:   col,
      fillOpacity: selected ? 1 : 0.88,
      weight:      selected ? 2.5 : anomalous ? 2 : 1.5,
    });

    /* Label */
    labelMarker.setIcon(makeLabelIcon(TN_STATIONS[i].short, selected));

    /* Pulse ring */
    if (anomalous && !pulseLayer.active) {
      pulseLayer.marker.setIcon(makePulseIcon(col, 18));
      pulseLayer.marker.addTo(map);
      pulseLayer.active = true;
    } else if (!anomalous && pulseLayer.active) {
      pulseLayer.marker.remove();
      pulseLayer.active = false;
    } else if (anomalous) {
      pulseLayer.marker.setIcon(makePulseIcon(col, 18));
    }
  }

  /* ── Refresh all stations ────────────────────────────── */
  function refreshMarkers(sts) {
    stations.forEach((_, i) => {
      const sst    = sts ? sts[i] : null;
      if (sst?.removed) return;            // skip removed custom stations
      const health = sst ? stateToHealth(sst) : 'HEALTHY';
      applyStyle(i, SEV_COL[health], i === selectedIdx, sst ? sst.sev !== 'NORMAL' : false);
    });
  }

  /* ── Select a station ────────────────────────────────── */
  function selectStation(idx) {
    selectedIdx = idx;
    /* support both built-in and custom stations */
    const st = TN_STATIONS[idx] || (SG._customStationById ? SG._customStationById(idx) : null);
    if (!st) return;
    const ds  = SG._dashState;
    const sst = ds ? ds.sts[idx] : null;
    const health = sst ? stateToHealth(sst) : 'HEALTHY';
    const col    = SEV_COL[health];

    /* Zoom — built-in stations use the stations[] array, custom use customMapLayers */
    const builtIn = stations[idx];
    const custom  = customMapLayers[idx];
    const zoomTarget = builtIn ? builtIn.coverageCircle : (custom ? custom.coverageCircle : null);
    if (zoomTarget) {
      map.fitBounds(zoomTarget.getBounds(), { padding:[40,40], maxZoom:10, animate:true, duration:0.5 });
    } else {
      map.setView([st.lat, st.lng], 9, { animate:true });
    }

    /* Info popup */
    const pip = document.getElementById('mapInfoPopup');
    if (pip) {
      document.getElementById('mipName').innerHTML  = `<span style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block"></span> ${st.name}`;
      document.getElementById('mipTemp').textContent = sst?.t != null ? sst.t.toFixed(1)+'°C'   : st.t+'°C';
      document.getElementById('mipPres').textContent = sst?.p != null ? sst.p.toFixed(1)+' hPa' : st.p+' hPa';
      document.getElementById('mipHum').textContent  = sst?.h != null ? sst.h.toFixed(1)+'%'    : st.h+'%';
      document.getElementById('mipConf').textContent = sst ? (sst.conf*100).toFixed(1)+'%' : '—';
      const covEl = document.getElementById('mipCov');
      if (covEl) covEl.textContent = st.coverage_km + ' km radius';
      const sevEl = document.getElementById('mipSev');
      if (sevEl) { sevEl.textContent = health; sevEl.style.cssText = `background:${col}22;color:${col};font-size:9px;font-weight:800;padding:2px 9px;border-radius:9px;letter-spacing:.8px`; }
      pip.classList.add('show');
      const nameEl = document.getElementById('mapSelName');
      if (nameEl) nameEl.textContent = st.short;
    }

    /* notify add-station logic about which station is selected */
    if (typeof SG._onStationSelected === 'function') SG._onStationSelected(idx);

    refreshMarkers(ds ? ds.sts : null);
  }

  /* ── Dashboard tick hooks ────────────────────────────── */
  SG._mapUpdateMarkers = function (sts) {
    refreshMarkers(sts);
    const sst = SG._dashState?.sts[selectedIdx];
    if (!sst) return;
    const health = stateToHealth(sst);
    const col    = SEV_COL[health];
    const upd = (id, val) => { const e=document.getElementById(id); if(e) e.textContent=val; };
    upd('mipTemp', sst.t!=null ? sst.t.toFixed(1)+'°C'   : '—');
    upd('mipPres', sst.p!=null ? sst.p.toFixed(1)+' hPa' : '—');
    upd('mipHum',  sst.h!=null ? sst.h.toFixed(1)+'%'    : '—');
    upd('mipConf', (sst.conf*100).toFixed(1)+'%');
    const sevEl = document.getElementById('mipSev');
    if (sevEl) { sevEl.textContent=health; sevEl.style.cssText=`background:${col}22;color:${col};font-size:9px;font-weight:800;padding:2px 9px;border-radius:9px;letter-spacing:.8px`; }
  };

  SG._mapSelectStation = function (idx) { selectStation(idx); };

  /* ── Add / remove custom stations from outside ───────── */
  const customMapLayers = {}; // id → { coverageCircle, dot, labelMarker, pulseLayer }

  SG._mapAddCustomStation = function (st) {
    const col   = '#58a6ff'; // accent blue for custom stations
    const isSel = false;

    /* coverage circle */
    const coverageCircle = L.circle([st.lat, st.lng], {
      radius:      st.coverage_km * 1000,
      color:       col, fillColor: col,
      fillOpacity: 0.07, weight: 1.5,
      opacity: 0.6, dashArray: null,
      interactive: false,
    }).addTo(map);

    /* dot */
    const dot = L.circleMarker([st.lat, st.lng], {
      radius: 10, color: '#ffffff', fillColor: col,
      fillOpacity: 0.95, weight: 2.5,
    }).addTo(map);

    /* label */
    const labelMarker = L.marker([st.lat, st.lng], {
      icon: L.divIcon({
        className: 'sg-label sel',
        html: `<span>⭐ ${st.short}</span>`,
        iconSize: [140, 20], iconAnchor: [-5, -5],
      }),
      interactive: false, zIndexOffset: 30,
    }).addTo(map);

    /* pulse ring (starts active for new custom stations to draw attention) */
    const pulseMarker = L.marker([st.lat, st.lng], {
      icon: makePulseIcon(col, 20),
      zIndexOffset: -10, interactive: false,
    }).addTo(map);
    const pulseLayer = { marker: pulseMarker, active: true };

    /* tooltip */
    dot.bindTooltip('', { direction: 'top', permanent: false, className: 'sg-tt', offset: [0, -6] });
    dot.on('mouseover', function () {
      const ds  = SG._dashState;
      const sst = ds?.sts[st.id];
      const h   = (sst && !sst.removed) ? stateToHealth(sst) : 'HEALTHY';
      dot.setTooltipContent(tooltipHTML(st, (sst && !sst.removed) ? sst : null, col, h));
      this.openTooltip();
    });
    dot.on('click', () => {
      if (typeof SG._mapSelectStation === 'function') SG._mapSelectStation(st.id);
      const sel = document.getElementById('stSel');
      if (sel) { sel.value = String(st.id); sel.dispatchEvent(new Event('change')); }
    });

    customMapLayers[st.id] = { coverageCircle, dot, labelMarker, pulseLayer };

    /* zoom to fit the new coverage circle */
    map.fitBounds(coverageCircle.getBounds(), { padding: [40, 40], maxZoom: 11, animate: true });
  };

  SG._mapRemoveCustomStation = function (id) {
    const layers = customMapLayers[id];
    if (!layers) return;
    layers.coverageCircle.remove();
    layers.dot.remove();
    layers.labelMarker.remove();
    layers.pulseLayer.marker.remove();
    delete customMapLayers[id];
  };

  /* initial render */
  selectStation(0);

  /* ── Multi-Style Tile Selector & Compass Control ─────── */
  let _tileRef = null;
  map.eachLayer(l => { if (l instanceof L.TileLayer) _tileRef = l; });

  const MAP_STYLES = {
    dark: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      className: 'dark-cyber-tile',
      maxNativeZoom: 19, maxZoom: 19, minZoom: 4,
      errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%230d1117"/></svg>'
    },
    streets: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      className: '',
      maxNativeZoom: 19, maxZoom: 19, minZoom: 4,
      errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%23161b22"/></svg>'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      className: '',
      maxNativeZoom: 18, maxZoom: 18, minZoom: 4,
      errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%23161b22"/></svg>'
    }
  };

  SG.setTNMapStyle = function (styleKey) {
    const cfg = MAP_STYLES[styleKey] || MAP_STYLES.dark;
    if (_tileRef) map.removeLayer(_tileRef);
    _tileRef = L.tileLayer(cfg.url, cfg).addTo(map);
    _tileRef.bringToBack();
  };

  SG.setTNMapTheme = function (styleKey) {
    SG.setTNMapStyle(styleKey);
    ['tnDarkBtn', 'tnLightBtn', 'tnSatBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });
    if (styleKey === 'dark') document.getElementById('tnDarkBtn')?.classList.add('active');
    else if (styleKey === 'streets') document.getElementById('tnLightBtn')?.classList.add('active');
    else if (styleKey === 'satellite') document.getElementById('tnSatBtn')?.classList.add('active');
  };
  SG.setTNMapLayer = SG.setTNMapTheme;

  SG.resetTNMapOrientation = function () {
    map.flyTo([10.85, 78.65], 7, { duration: 0.8 });
    const compassBtn = document.getElementById('tnCompassBtn');
    if (compassBtn) {
      compassBtn.style.transform = 'scale(1.2) rotate(360deg)';
      setTimeout(() => { compassBtn.style.transform = ''; }, 400);
    }
  };
};

/* ============================================================
   ADD STATION — click-on-map flow
   1. Toggle "add mode" button enables map crosshair
   2. User clicks map → radius modal appears with slider
   3. Confirm → circle + dot + label pinned, station live
   4. Delete button in info popup removes custom stations
   ============================================================ */
SG.initAddStation = function () {

  /* ── DOM ─────────────────────────────────────────────── */
  const toggleBtn   = document.getElementById('toggleAddMode');
  const mapEl       = document.getElementById('tnMap');
  const hintBanner  = document.getElementById('addHintBanner');
  const overlay     = document.getElementById('radiusModalOverlay');
  const rmCoords    = document.getElementById('rmCoords');
  const rmName      = document.getElementById('rmName');
  const rmShort     = document.getElementById('rmShort');
  const rmRadius    = document.getElementById('rmRadius');
  const rmRadiusVal = document.getElementById('rmRadiusVal');
  const rmConfirm   = document.getElementById('rmConfirm');
  const rmCancel    = document.getElementById('rmCancel');
  const stSel       = document.getElementById('stSel');
  const customList  = document.getElementById('customList');
  const countPill   = document.getElementById('mapStationCount');
  const mipDeleteBtn= document.getElementById('mipDeleteBtn');
  const toast       = document.getElementById('sgToast');
  const toastIcon   = document.getElementById('sgToastIcon');
  const toastMsg    = document.getElementById('sgToastMsg');

  /* ── State ───────────────────────────────────────────── */
  let addMode      = false;
  let pendingCoord = null;      // { lat, lng } waiting for modal confirm
  const customStations = [];    // user-added station objects
  let currentSelectedId = null; // track which station is shown in popup

  /* ── localStorage persistence ────────────────────────── */
  const STORAGE_KEY = 'sg_custom_stations';

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customStations));
    } catch(e) { /* storage unavailable — silent fail */ }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || saved.length === 0) return;

      saved.forEach(station => {
        /* Avoid ID collisions with TN_STATIONS */
        station.id = Math.max(TN_STATIONS.length, station.id);
        customStations.push(station);

        /* Add to map */
        if (typeof SG._mapAddCustomStation === 'function') SG._mapAddCustomStation(station);

        /* Add to dropdown */
        const opt = document.createElement('option');
        opt.value = String(station.id);
        opt.textContent = station.name;
        stSel?.appendChild(opt);

        /* Add to dash state */
        if (SG._dashState) {
          while (SG._dashState.sts.length <= station.id) {
            SG._dashState.sts.push({ name:'—', short:'—', total:0, anoms:0, sev:'NORMAL', t:32, p:1007, h:70, conf:0.05 });
          }
          SG._dashState.sts[station.id] = {
            name: station.name, short: station.short,
            total:0, anoms:0, sev:'NORMAL',
            t:station.t, p:station.p, h:station.h, conf:0.05, custom:true,
          };
        }
      });

      /* Reassign IDs to be sequential from current count to avoid gaps */
      const total = TN_STATIONS.length + customStations.length;
      if (countPill) countPill.textContent = `Tamil Nadu AWS · ${total} Stations`;
      renderList();
    } catch(e) { /* parse error — ignore */ }
  }

  /* ── Toast ───────────────────────────────────────────── */
  let toastTimer;
  function showToast(msg, icon = '✅') {
    toastIcon.textContent = icon;
    toastMsg.textContent  = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  /* ── Toggle add-mode ─────────────────────────────────── */
  toggleBtn?.addEventListener('click', () => {
    addMode = !addMode;
    toggleBtn.classList.toggle('active', addMode);
    toggleBtn.textContent = addMode ? '✕  Cancel Add Mode' : '＋ Add Station (tap map)';
    mapEl?.classList.toggle('add-mode', addMode);
    hintBanner?.classList.toggle('show', addMode);
    if (!addMode) closeModal();
  });

  /* ── Radius slider live update ───────────────────────── */
  rmRadius?.addEventListener('input', () => {
    if (rmRadiusVal) rmRadiusVal.textContent = rmRadius.value + ' km';
  });

  /* ── Open modal at clicked coord ─────────────────────── */
  function openModal(lat, lng) {
    pendingCoord = { lat, lng };
    if (rmCoords) rmCoords.textContent = `📌 ${lat.toFixed(5)},  ${lng.toFixed(5)}`;
    if (rmName)  rmName.value  = 'Fetching location…';
    if (rmShort) rmShort.value = '';
    if (rmRadius){ rmRadius.value = '25'; }
    if (rmRadiusVal) rmRadiusVal.textContent = '25 km';
    overlay?.classList.add('show');
    /* Auto-focus radius slider; name will fill once geocode responds */
    setTimeout(() => rmRadius?.focus(), 120);

    /* ── Reverse geocode via Nominatim (free, no key) ── */
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`)
      .then(r => r.json())
      .then(data => {
        if (!overlay?.classList.contains('show')) return; // modal closed
        const addr  = data.address || {};
        /* Build a readable name from the most specific available field */
        const place = addr.village || addr.town || addr.suburb || addr.city_district
                   || addr.city    || addr.county || addr.state_district
                   || addr.state   || data.display_name?.split(',')[0]
                   || 'Custom Station';
        const district = addr.county || addr.state_district || addr.state || '';
        const fullName = district ? `${place} — ${district}` : place;
        if (rmName)  rmName.value  = fullName;
        if (rmShort) rmShort.value = place.split(' ')[0];   // first word as short label
      })
      .catch(() => {
        if (rmName && rmName.value === 'Fetching location…') {
          rmName.value = `Station at ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        }
      });
  }

  function closeModal() {
    overlay?.classList.remove('show');
    pendingCoord = null;
  }

  rmCancel?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  /* ── Confirm — add station ───────────────────────────── */
  rmConfirm?.addEventListener('click', () => {
    if (!pendingCoord) return;
    const name  = rmName?.value.trim() || `Custom Station ${customStations.length + 1}`;
    const short = rmShort?.value.trim() || name.split('—')[0].trim().split(' ')[0];
    const km    = parseFloat(rmRadius?.value || '25');
    const { lat, lng } = pendingCoord;

    const newId = TN_STATIONS.length + customStations.length;
    const station = {
      id: newId, name, short,
      lat, lng, coverage_km: km,
      t: 32, p: 1007, h: 70,
      custom: true,
    };

    customStations.push(station);
    saveToStorage();
    closeModal();

    /* turn off add mode */
    addMode = false;
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '＋ Add Station (tap map)';
    mapEl?.classList.remove('add-mode');
    hintBanner?.classList.remove('show');

    /* add to map */
    if (typeof SG._mapAddCustomStation === 'function') {
      SG._mapAddCustomStation(station);
    }

    /* add to dropdown */
    const opt = document.createElement('option');
    opt.value = String(newId);
    opt.textContent = name;
    stSel?.appendChild(opt);

    /* add to dash state */
    if (SG._dashState) {
      /* state.sts is indexed by station id — pad if needed */
      while (SG._dashState.sts.length <= newId) {
        SG._dashState.sts.push({ name:'—', short:'—', total:0, anoms:0, sev:'NORMAL', t:32, p:1007, h:70, conf:0.05 });
      }
      SG._dashState.sts[newId] = {
        name, short, total:0, anoms:0,
        sev:'NORMAL', t:station.t, p:station.p, h:station.h, conf:0.05, custom:true,
      };
    }

    /* update count pill */
    const total = TN_STATIONS.length + customStations.length;
    if (countPill) countPill.textContent = `Tamil Nadu AWS · ${total} Stations`;

    /* render list */
    renderList();

    /* select it */
    if (stSel) { stSel.value = String(newId); stSel.dispatchEvent(new Event('change')); }

    showToast(`📍 "${short}" added to the map`);
  });

  /* ── Map click handler (exposed for initTNMap) ───────── */
  SG._onMapClick = function (lat, lng) {
    if (!addMode) return;
    openModal(lat, lng);
  };

  /* ── Info popup delete button ────────────────────────── */
  mipDeleteBtn?.addEventListener('click', () => {
    if (currentSelectedId == null) return;
    const idx = customStations.findIndex(s => s.id === currentSelectedId);
    if (idx === -1) return;
    const st = customStations[idx];

    if (typeof SG._mapRemoveCustomStation === 'function') {
      SG._mapRemoveCustomStation(st.id);
    }

    /* remove from dropdown */
    stSel?.querySelector(`option[value="${st.id}"]`)?.remove();

    /* mark in dash state */
    if (SG._dashState?.sts[st.id]) {
      SG._dashState.sts[st.id] = { name:'—', short:'—', total:0, anoms:0, sev:'NORMAL', t:0,p:0,h:0,conf:0, removed:true };
    }

    customStations.splice(idx, 1);
    saveToStorage();

    const total = TN_STATIONS.length + customStations.length;
    if (countPill) countPill.textContent = `Tamil Nadu AWS · ${total} Stations`;

    renderList();
    showToast(`🗑 "${st.short}" removed`, '🗑️');

    /* hide popup, switch to station 0 */
    document.getElementById('mapInfoPopup')?.classList.remove('show');
    if (stSel) { stSel.value = '0'; stSel.dispatchEvent(new Event('change')); }
    currentSelectedId = null;
  });

  /* ── Track selected station (to show/hide delete btn) ── */
  SG._onStationSelected = function (id) {
    currentSelectedId = id;
    const isCustom = customStations.some(s => s.id === id);
    if (mipDeleteBtn) mipDeleteBtn.style.display = isCustom ? 'flex' : 'none';
  };

  /* ── Render custom stations list below toolbar ────────── */
  function renderList() {
    if (!customList) return;
    customList.innerHTML = customStations.length === 0 ? '' :
      customStations.map(s => `
        <div class="cst-item" id="cst-${s.id}">
          <div class="cst-dot"></div>
          <div class="cst-name">${s.name}</div>
          <div class="cst-meta">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)} · ${s.coverage_km} km</div>
          <button class="cst-del" title="Delete station" onclick="SG._removeStationById(${s.id})">🗑</button>
        </div>`).join('');
  }

  /* ── Remove by ID (called from list) ────────────────── */
  SG._removeStationById = function (id) {
    const idx = customStations.findIndex(s => s.id === id);
    if (idx === -1) return;
    const st = customStations[idx];

    if (typeof SG._mapRemoveCustomStation === 'function') SG._mapRemoveCustomStation(id);
    stSel?.querySelector(`option[value="${id}"]`)?.remove();
    if (SG._dashState?.sts[id]) {
      SG._dashState.sts[id] = { name:'—', short:'—', total:0, anoms:0, sev:'NORMAL', t:0,p:0,h:0,conf:0, removed:true };
    }
    customStations.splice(idx, 1);
    saveToStorage();

    const total = TN_STATIONS.length + customStations.length;
    if (countPill) countPill.textContent = `Tamil Nadu AWS · ${total} Stations`;
    renderList();
    showToast(`🗑 "${st.short}" removed`, '🗑️');

    if (stSel) { stSel.value = '0'; stSel.dispatchEvent(new Event('change')); }
    if (currentSelectedId === id) {
      document.getElementById('mapInfoPopup')?.classList.remove('show');
      currentSelectedId = null;
    }
  };

  /* ── Lookup a custom station by id (used by initTNMap) ── */
  SG._customStationById = function (id) {
    return customStations.find(s => s.id === id) || null;
  };

  /* ── Restore persisted stations on load ──────────────── */
  loadFromStorage();
};

/* ============================================================
   CITY ANALYSIS PAGE
   Generates synthetic Day / Week / Month history for each
   Tamil Nadu AWS station and renders:
     – Temperature, Pressure, Humidity, Anomaly Confidence
       time-series charts
     – Anomaly type doughnut + severity doughnut
     – Anomaly events table
     – All-cities comparison bar chart
   ============================================================ */
SG.initAnalysis = function () {

  /* ── Populate city dropdown ──────────────────────────── */
  const citySelect = document.getElementById('citySelect');
  if (!citySelect) return;
  TN_STATIONS.forEach(st => {
    const opt = document.createElement('option');
    opt.value = String(st.id);
    opt.textContent = st.name;
    citySelect.appendChild(opt);
  });

  /* ── State ───────────────────────────────────────────── */
  let activePeriod = 'day';
  let activeCityId = 0;
  let cmpMetric    = 'temp';

  /* ── Chart instances (destroyed & rebuilt on update) ─── */
  let charts = {};

  /* ── Colour palette ──────────────────────────────────── */
  const PAL = {
    temp: '#e74c3c', pres: '#3498db', hum: '#2ecc71',
    anom: '#e67e22', accent: '#58a6ff',
  };

  /* ── Deterministic pseudo-random seeded by city + period */
  function seededRand(seed) {
    let s = seed;
    return function() {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /* ── Generate history data for a city + period ──────── */
  function generateHistory(cityId, period) {
    const st   = TN_STATIONS[cityId];
    const rand = seededRand(cityId * 1000 + (period === 'day' ? 1 : period === 'week' ? 7 : 30));
    const n    = period === 'day' ? 24 : period === 'week' ? 28 : 30; // hourly/6h/daily points
    const labels = [];
    const temp = [], pres = [], hum = [], conf = [];
    const anomTypes   = { spike:0, frozen:0, drift:0, oor:0, multi:0, noise:0, missing:0 };
    const anomSev     = { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0 };
    const anomEvents  = [];

    /* diurnal cycle amplitudes */
    const tAmp = 4 + rand() * 4;
    const pAmp = 1 + rand() * 1.5;
    const hAmp = 8 + rand() * 8;

    for (let i = 0; i < n; i++) {
      /* label */
      if (period === 'day') {
        labels.push(`${String(i).padStart(2,'0')}:00`);
      } else if (period === 'week') {
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        labels.push(`${days[Math.floor(i/4)%7]} ${String((i%4)*6).padStart(2,'0')}h`);
      } else {
        labels.push(`Day ${i + 1}`);
      }

      /* base values with diurnal oscillation */
      const phase = (i / n) * 2 * Math.PI;
      const t = st.t + tAmp * Math.sin(phase - 1) + (rand() - .5) * 1.5;
      const p = st.p + pAmp * Math.sin(phase + 1) + (rand() - .5) * 0.8;
      const h = st.h - hAmp * Math.sin(phase - 1) + (rand() - .5) * 3;

      /* occasional anomaly injection (5% chance) */
      let anomScore = rand() * 0.18;
      let anomFlag = false;
      if (rand() < 0.05) {
        const type = ['spike','frozen','drift','oor','multi','noise','missing'][Math.floor(rand()*7)];
        anomScore = 0.45 + rand() * 0.5;
        anomFlag  = true;
        anomTypes[type]++;
        const sev = anomScore >= .85 ? 'CRITICAL' : anomScore >= .65 ? 'HIGH' : anomScore >= .45 ? 'MEDIUM' : 'LOW';
        anomSev[sev]++;
        anomEvents.push({ label:labels[i], t:t.toFixed(1), p:p.toFixed(1), h:h.toFixed(1), type, conf:(anomScore*100).toFixed(1), sev });
      }

      temp.push(parseFloat(t.toFixed(2)));
      pres.push(parseFloat(p.toFixed(2)));
      hum.push(parseFloat(Math.max(0, Math.min(100, h)).toFixed(2)));
      conf.push(parseFloat(anomScore.toFixed(3)));
    }

    return { labels, temp, pres, hum, conf, anomTypes, anomSev, anomEvents };
  }

  /* ── Compute stats ───────────────────────────────────── */
  function stats(arr) {
    const valid = arr.filter(v => v != null && !isNaN(v));
    if (!valid.length) return { avg:0, min:0, max:0 };
    const avg = valid.reduce((a,b) => a+b, 0) / valid.length;
    return { avg: parseFloat(avg.toFixed(1)), min: Math.min(...valid), max: Math.max(...valid) };
  }

  /* ── Destroy + recreate a chart ──────────────────────── */
  function mkChart(id, config) {
    if (charts[id]) { charts[id].destroy(); }
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    charts[id] = new Chart(ctx, config);
    SG.activeCharts.push(charts[id]);
  }

  /* ── Shared chart options helpers ────────────────────── */
  function getGridColor() {
    return SG.getTheme() === 'light' ? '#d0d7de' : '#1e2530';
  }
  function getTT2() {
    const isLight = SG.getTheme() === 'light';
    return { backgroundColor: isLight ? '#ffffff' : '#1e2530', borderColor: isLight ? '#d0d7de' : '#30363d', borderWidth: 1, titleColor: isLight ? '#1f2328' : '#e6edf3', bodyColor: isLight ? '#57606a' : '#8b949e' };
  }

  function lineOpts(yLabel, color) {
    const isLight = SG.getTheme() === 'light';
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      interaction: { mode:'index', intersect:false },
      plugins: { legend:{ display:false }, tooltip: getTT2() },
      scales: {
        x: { grid:{ color: getGridColor() }, ticks:{ maxTicksLimit:8, font:{size:10}, color: isLight ? '#57606a' : '#6e7681' } },
        y: { grid:{ color: getGridColor() }, ticks:{ color, font:{size:10}, callback: v => v + yLabel } },
      },
    };
  }

  /* ── Render everything for current city + period ──────── */
  function render() {
    const st   = TN_STATIONS[activeCityId];
    const data = generateHistory(activeCityId, activePeriod);
    const periodLabel = activePeriod === 'day' ? '24-Hour' : activePeriod === 'week' ? '7-Day' : '30-Day';

    /* KPIs */
    const sT = stats(data.temp), sP = stats(data.pres), sH = stats(data.hum);
    const totalAnoms = data.anomEvents.length;
    const anomRate   = ((totalAnoms / data.labels.length) * 100).toFixed(1);

    document.getElementById('kvAvgTemp').textContent = sT.avg + '°C';
    document.getElementById('kvTempRange').textContent = `Min ${sT.min}° · Max ${sT.max}°`;
    document.getElementById('kvAvgPres').textContent = sP.avg + ' hPa';
    document.getElementById('kvPresRange').textContent = `Min ${sP.min} · Max ${sP.max}`;
    document.getElementById('kvAvgHum').textContent  = sH.avg + '%';
    document.getElementById('kvHumRange').textContent = `Min ${sH.min}% · Max ${sH.max}%`;
    document.getElementById('kvAnoms').textContent  = totalAnoms;
    document.getElementById('kvAnomsRate').textContent = anomRate + '% anomaly rate';

    /* Badges */
    document.getElementById('badgeTemp').textContent = `avg ${sT.avg}°C`;
    document.getElementById('badgePres').textContent = `avg ${sP.avg} hPa`;
    document.getElementById('badgeHum').textContent  = `avg ${sH.avg}%`;
    document.getElementById('badgeAnom').textContent = `${totalAnoms} events`;

    /* Temperature chart */
    mkChart('tempChart', {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.temp, borderColor: PAL.temp,
          backgroundColor: 'rgba(231,76,60,.08)', fill:true,
          borderWidth:2, pointRadius:0, tension:.35,
        }],
      },
      options: lineOpts('°C', PAL.temp),
    });

    /* Pressure chart */
    mkChart('presChart', {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.pres, borderColor: PAL.pres,
          backgroundColor: 'rgba(52,152,219,.08)', fill:true,
          borderWidth:2, pointRadius:0, tension:.35,
        }],
      },
      options: lineOpts(' hPa', PAL.pres),
    });

    /* Humidity chart */
    mkChart('humChart', {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.hum, borderColor: PAL.hum,
          backgroundColor: 'rgba(46,204,113,.08)', fill:true,
          borderWidth:2, pointRadius:0, tension:.35,
        }],
      },
      options: lineOpts('%', PAL.hum),
    });

    /* Anomaly confidence chart */
    const confColors = data.conf.map(v =>
      v >= .85 ? C.red : v >= .65 ? C.orange : v >= .45 ? C.yellow : v >= .25 ? C.blue : 'rgba(88,166,255,.25)'
    );
    mkChart('anomChart', {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.conf, backgroundColor: confColors,
          borderRadius: 3, borderSkipped: false,
        }],
      },
      options: {
        responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend:{display:false}, tooltip:{...TT2, callbacks:{label:c=>` Confidence: ${(c.parsed.y*100).toFixed(1)}%`}} },
        scales:{
          x:{ grid:{color:gridColor}, ticks:{maxTicksLimit:8, font:{size:10}, color:'#6e7681'} },
          y:{ min:0, max:1, grid:{color:gridColor}, ticks:{color:C.orange, font:{size:10}, callback:v=>(v*100).toFixed(0)+'%'} },
        },
      },
    });

    /* Anomaly type doughnut */
    const typeLabels = Object.keys(data.anomTypes);
    const typeVals   = Object.values(data.anomTypes);
    const typeCols   = ['#e74c3c','#3498db','#f39c12','#ff6b6b','#9b59b6','#e67e22','#8b949e'];
    mkChart('typeChart', {
      type: 'doughnut',
      data: { labels: typeLabels.map(t => t.charAt(0).toUpperCase()+t.slice(1)), datasets:[{ data:typeVals, backgroundColor:typeCols, borderColor:'#161b22', borderWidth:3, hoverOffset:6 }] },
      options: {
        responsive:true, maintainAspectRatio:false, cutout:'60%',
        plugins:{ legend:{position:'right', labels:{font:{size:10}, padding:10, usePointStyle:true}}, tooltip:{...TT2, callbacks:{label:c=>` ${c.label}: ${c.parsed}`}} },
      },
    });

    /* Severity doughnut */
    const sevVals = [data.anomSev.CRITICAL, data.anomSev.HIGH, data.anomSev.MEDIUM, data.anomSev.LOW];
    mkChart('sevChart', {
      type: 'doughnut',
      data: { labels:['CRITICAL','HIGH','MEDIUM','LOW'], datasets:[{ data:sevVals, backgroundColor:[C.red,C.orange,C.yellow,C.blue], borderColor:'#161b22', borderWidth:3, hoverOffset:6 }] },
      options: {
        responsive:true, maintainAspectRatio:false, cutout:'60%',
        plugins:{ legend:{position:'right', labels:{font:{size:10}, padding:10, usePointStyle:true}}, tooltip:{...TT2, callbacks:{label:c=>` ${c.label}: ${c.parsed}`}} },
      },
    });

    /* Event table */
    const SEV_CLS = { CRITICAL:'tc', HIGH:'th', MEDIUM:'tm', LOW:'' };
    document.getElementById('tableTitle').textContent = `${st.short} — ${periodLabel}`;
    const tbody = document.getElementById('eventTbody');
    if (tbody) {
      if (data.anomEvents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--green);padding:18px">✅ No anomalies detected in this period</td></tr>`;
      } else {
        tbody.innerHTML = data.anomEvents.map(ev => `
          <tr>
            <td style="font-family:var(--mono);color:var(--accent)">${ev.label}</td>
            <td>${ev.t}°C</td>
            <td>${ev.p} hPa</td>
            <td>${ev.h}%</td>
            <td><span class="abadge ${ev.type}">${ev.type.toUpperCase()}</span></td>
            <td style="font-family:var(--mono)">${ev.conf}%</td>
            <td class="${SEV_CLS[ev.sev]||''}">${ev.sev}</td>
          </tr>`).join('');
      }
    }

    renderComparison();
  }

  /* ── All-cities comparison bar chart ─────────────────── */
  function renderComparison() {
    const metricMap = { temp:'temp', pres:'pres', hum:'hum', anom:'conf' };
    const labelMap  = { temp:'Avg Temperature (°C)', pres:'Avg Pressure (hPa)', hum:'Avg Humidity (%)', anom:'Avg Anomaly Confidence' };
    const colMap    = { temp:PAL.temp, pres:PAL.pres, hum:PAL.hum, anom:PAL.anom };

    const cityNames = TN_STATIONS.map(s => s.short);
    const vals = TN_STATIONS.map(s => {
      const d = generateHistory(s.id, activePeriod);
      const arr = d[metricMap[cmpMetric]];
      return stats(arr).avg;
    });

    /* highlight selected city */
    const bgColors = TN_STATIONS.map((s, i) =>
      i === activeCityId
        ? colMap[cmpMetric]
        : colMap[cmpMetric] + '55'
    );

    document.getElementById('compareTitle').textContent = `${labelMap[cmpMetric]} — ${activePeriod === 'day' ? '24-Hour' : activePeriod === 'week' ? '7-Day' : '30-Day'} Average`;

    mkChart('cmpChart', {
      type: 'bar',
      data: {
        labels: cityNames,
        datasets: [{
          label: labelMap[cmpMetric],
          data: vals,
          backgroundColor: bgColors,
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend:{display:false}, tooltip:{...TT2} },
        scales:{
          x:{ grid:{color:gridColor}, ticks:{ font:{size:10}, color:'#6e7681', maxRotation:45 } },
          y:{ grid:{color:gridColor}, ticks:{ font:{size:10}, color:colMap[cmpMetric] } },
        },
      },
    });
  }

  /* ── Event listeners ─────────────────────────────────── */
  citySelect.addEventListener('change', () => {
    activeCityId = +citySelect.value;
    render();
  });

  document.querySelectorAll('.ptab[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ptab[data-period]').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      activePeriod = btn.dataset.period;
      render();
    });
  });

  /* expose comparison metric setter for inline onclick */
  SG.setCmpMetric = function(m) {
    cmpMetric = m;
    ['Temp','Pres','Hum','Anom'].forEach(k => {
      const el = document.getElementById('cmpBtn'+k);
      if (el) el.classList.toggle('on', k.toLowerCase() === m || (m==='anom' && k==='Anom') || (m==='temp' && k==='Temp') || (m==='pres' && k==='Pres') || (m==='hum' && k==='Hum'));
    });
    renderComparison();
  };

  /* ── Initial render ──────────────────────────────────── */
  render();
};

/* ============================================================
   LIVE LOCATION TRACKER
   – Requests browser Geolocation API
   – Renders user position on a dark Leaflet map
   – Draws all TN_STATIONS with threat-coloured coverage zones
   – Detects if user is inside a station's coverage radius
   – Raises alerts and updates KPIs in real time
   ============================================================ */
/* Guard: keep a single Leaflet map instance for the location page */
SG._locMap = SG._locMap || null;

SG.initLiveLocation = function () {
  if (typeof L === 'undefined') { console.warn('Leaflet not loaded'); return; }
  const mapEl = document.getElementById('locMap');
  if (!mapEl) return;

  /* ── If map already initialised, just (re)start tracking ── */
  if (SG._locMap) {
    const startBtn = document.getElementById('startTrackBtn');
    startBtn?.click();
    return;
  }

  /* ── DOM refs ────────────────────────────────────────── */
  const startBtn       = document.getElementById('startTrackBtn');
  const stopBtn        = document.getElementById('stopTrackBtn');
  const centerBtn      = document.getElementById('centerBtn');
  const accBadge       = document.getElementById('accBadge');
  const acquiringOvl   = document.getElementById('acquiringOverlay');
  const deniedOvl      = document.getElementById('deniedOverlay');
  const trackingPill   = document.getElementById('trackingPill');
  const trackingText   = document.getElementById('trackingPillText');
  const threatPill     = document.getElementById('threatPill');
  const threatPillText = document.getElementById('threatPillText');
  const locStatusPill  = document.getElementById('locStatusPill');
  const lcbLat         = document.getElementById('lcbLat');
  const lcbLng         = document.getElementById('lcbLng');
  const lcbAlt         = document.getElementById('lcbAlt');
  const lcbSpd         = document.getElementById('lcbSpd');
  const lcbNearby      = document.getElementById('lcbNearby');
  const kvDist         = document.getElementById('kvDist');
  const kvConf         = document.getElementById('kvConf');
  const kvAlerts       = document.getElementById('kvAlerts');
  const kvZone         = document.getElementById('kvZone');
  const nearbyList     = document.getElementById('nearbyList');
  const alertFeed      = document.getElementById('locAlertFeed');
  const alertEmpty     = document.getElementById('locAlertEmpty');
  const toastEl        = document.getElementById('sgToast');
  const toastIcon      = document.getElementById('sgToastIcon');
  const toastMsg       = document.getElementById('sgToastMsg');

  /* ── Threat colour palette ───────────────────────────── */
  const THREAT_COL = {
    CRITICAL : '#e74c3c',
    HIGH     : '#e67e22',
    MEDIUM   : '#f39c12',
    LOW      : '#3498db',
    HEALTHY  : '#2ecc71',
  };

  /* ── Severity from anomaly confidence ─────────────────── */
  function confToSev(c) {
    return c >= .85 ? 'CRITICAL' : c >= .65 ? 'HIGH' : c >= .45 ? 'MEDIUM' : c >= .25 ? 'LOW' : 'HEALTHY';
  }

  /* ── Simulated live anomaly confidence per station ──────
     Uses a deterministic pseudo-random that slowly drifts
     so each station's "threat level" changes over time.   */
  const stationConf = TN_STATIONS.map(() => Math.random() * 0.2);
  let confDriftTimer = null;

  /* ── Load custom stations saved from dashboard ───────── */
  const STORAGE_KEY = 'sg_custom_stations';
  let customStations = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) customStations = JSON.parse(raw).filter(s => s && s.lat && s.lng) || [];
  } catch(e) { customStations = []; }

  /* Combined list: built-in + custom */
  const allStations = [...TN_STATIONS, ...customStations];

  /* Pad stationConf for custom stations */
  customStations.forEach(() => stationConf.push(Math.random() * 0.2));

  function driftConf() {
    stationConf.forEach((_, i) => {
      stationConf[i] = Math.max(0, Math.min(1,
        stationConf[i] + (Math.random() - 0.5) * 0.06
      ));
    });
    refreshStationStyles();
    refreshNearby();
    assessThreats();
  }

  /* ── Map initialisation ──────────────────────────────── */
  const map = L.map('locMap', {
    center: [10.85, 78.65], zoom: 7,
    minZoom: 5, maxZoom: 16,
    zoomControl: false, attributionControl: false,
  });
  SG._locMap = map;

  /* Dark tile layer (OpenStreetMap Dark Cyber) */
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    subdomains: ['a', 'b', 'c'],
    className: 'dark-cyber-tile',
    maxNativeZoom: 19, maxZoom: 19, minZoom: 4,
    errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%230d1117"/></svg>',
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  /* Force Leaflet to recalculate container size after DOM layout is complete.
     Multiple delays + ResizeObserver ensure correct sizing after fade-in. */
  setTimeout(() => map.invalidateSize(), 150);
  setTimeout(() => map.invalidateSize(), 500);
  if (typeof ResizeObserver !== 'undefined') {
    const _locRO = new ResizeObserver(() => map.invalidateSize());
    _locRO.observe(mapEl);
    setTimeout(() => _locRO.disconnect(), 3000);
  }
  /* Also invalidate when parent fade-in transition completes */
  const _locWrap = mapEl.closest('.loc-map-wrap');
  if (_locWrap) {
    _locWrap.addEventListener('transitionend', () => map.invalidateSize(), { once: true });
  }

  /* ── Build station layers ────────────────────────────── */
  const stLayers = allStations.map((st, i) => {
    const conf   = stationConf[i];
    const sev    = confToSev(conf);
    const col    = st.custom ? '#58a6ff' : THREAT_COL[sev];

    const circle = L.circle([st.lat, st.lng], {
      radius      : st.coverage_km * 1000,
      color       : col, fillColor: col,
      fillOpacity : sev === 'CRITICAL' ? 0.15 : sev === 'HIGH' ? 0.1 : sev === 'MEDIUM' ? 0.07 : 0.04,
      weight      : sev === 'CRITICAL' ? 2 : 1,
      opacity     : 0.7,
      dashArray   : sev === 'HEALTHY' ? '5 5' : null,
      interactive : true,
    }).addTo(map);

    const dot = L.circleMarker([st.lat, st.lng], {
      radius: 7, color: '#fff',
      fillColor: col, fillOpacity: 0.9, weight: 1.5,
    }).addTo(map);

    const labelM = L.marker([st.lat, st.lng], {
      icon: L.divIcon({
        className : 'sg-label',
        html      : `<span>${st.custom ? '⭐ ' : ''}${st.short}</span>`,
        iconSize  : [130, 18],
        iconAnchor: [-4, -4],
      }),
      interactive: false, zIndexOffset: 10,
    }).addTo(map);

    /* tooltip showing station data */
    const ttContent = () => {
      const cv = stationConf[i];
      const sv = confToSev(cv);
      const c  = st.custom ? '#58a6ff' : THREAT_COL[sv];
      return `<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.65;min-width:190px">
        <div style="font-weight:800;font-size:13px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span style="width:9px;height:9px;border-radius:50%;background:${c};display:inline-block"></span>${st.custom ? '⭐ ' : ''}${st.name}${st.custom ? ' <span style="font-size:9px;opacity:.7">(custom)</span>' : ''}
        </div>
        <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">🌡 Temp</span><b style="font-family:monospace">${st.t}°C</b></div>
        <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">🔵 Pressure</span><b style="font-family:monospace">${st.p} hPa</b></div>
        <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">💧 Humidity</span><b style="font-family:monospace">${st.h}%</b></div>
        <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">📊 Confidence</span><b style="font-family:monospace">${(cv*100).toFixed(1)}%</b></div>
        <div style="display:flex;justify-content:space-between;gap:14px"><span style="color:#8b949e">📡 Coverage</span><b style="font-family:monospace">${st.coverage_km} km</b></div>
        <div style="margin-top:7px;text-align:center">
          <span style="background:${c}22;color:${c};padding:2px 10px;border-radius:9px;font-weight:800;font-size:10px;letter-spacing:1px">${st.custom ? 'CUSTOM' : sv}</span>
        </div>
      </div>`;
    };

    circle.bindTooltip(ttContent(), { direction:'top', className:'sg-tt', offset:[0,-2] });
    dot.bindTooltip(ttContent(),    { direction:'top', className:'sg-tt', offset:[0,-6] });
    circle.on('mouseover', () => { circle.setTooltipContent(ttContent()); circle.openTooltip(); });
    dot.on('mouseover',    () => { dot.setTooltipContent(ttContent());    dot.openTooltip();    });

    return { circle, dot, labelM };
  });

  /* ── Refresh station colours after confidence drift ────── */
  function refreshStationStyles() {
    stLayers.forEach(({ circle, dot }, i) => {
      const st   = allStations[i];
      const conf = stationConf[i];
      const sev  = confToSev(conf);
      const col  = st?.custom ? '#58a6ff' : THREAT_COL[sev];
      circle.setStyle({
        color       : col, fillColor: col,
        fillOpacity : sev === 'CRITICAL' ? 0.15 : sev === 'HIGH' ? 0.1 : sev === 'MEDIUM' ? 0.07 : 0.04,
        weight      : sev === 'CRITICAL' ? 2 : 1,
        dashArray   : sev === 'HEALTHY' ? '5 5' : null,
      });
      dot.setStyle({ fillColor: col });
    });
  }

  /* ── User location layer ────────────────────────────── */
  const userIcon = L.divIcon({
    className : '',
    html      : '<div class="user-loc-icon tracking"></div>',
    iconSize  : [18, 18],
    iconAnchor: [9, 9],
  });

  let userMarker   = null;
  let accuracyCircle = null;

  function setUserPosition(lat, lng, acc) {
    if (!userMarker) {
      userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      userMarker.bindTooltip('📍 Your Location', {
        direction: 'top', permanent: false, className: 'sg-tt', offset: [0, -12]
      });
    } else {
      userMarker.setLatLng([lat, lng]);
    }
    if (!accuracyCircle) {
      accuracyCircle = L.circle([lat, lng], {
        radius      : acc,
        color       : '#58a6ff', fillColor: '#58a6ff',
        fillOpacity : 0.08, weight: 1.5, opacity: 0.5,
        dashArray   : '4 4', interactive: false,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng([lat, lng]);
      accuracyCircle.setRadius(acc);
    }
  }

  /* ── Haversine distance (km) ─────────────────────────── */
  function haversine(lat1, lng1, lat2, lng2) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat/2)**2 +
                 Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  /* ── State ───────────────────────────────────────────── */
  let userLat      = null;
  let userLng      = null;
  let watchId      = null;
  let alertCount   = 0;
  let isTracking   = false;
  const NEARBY_KM  = 150;
  let toastTimer   = null;
  let lastThreats  = [];

  /* ── Toast helper ─────────────────────────────────────── */
  function showToast(msg, icon = '📍') {
    if (!toastEl) return;
    toastIcon.textContent = icon;
    toastMsg.textContent  = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4000);
  }

  /* ── Refresh nearby station list ─────────────────────── */
  function refreshNearby() {
    if (userLat === null) return;
    const sev_color = { CRITICAL:'#e74c3c', HIGH:'#e67e22', MEDIUM:'#f39c12', LOW:'#3498db', HEALTHY:'#2ecc71' };
    const sev_cls   = { CRITICAL:'background:rgba(231,76,60,.2);color:#e74c3c', HIGH:'background:rgba(230,126,34,.2);color:#e67e22', MEDIUM:'background:rgba(243,156,18,.2);color:#f39c12', LOW:'background:rgba(52,152,219,.2);color:#3498db', HEALTHY:'background:rgba(46,204,113,.15);color:#2ecc71' };

    const sorted = allStations
      .map((st, i) => ({
        ...st,
        dist : haversine(userLat, userLng, st.lat, st.lng),
        conf : stationConf[i] ?? 0.1,
        sev  : confToSev(stationConf[i] ?? 0.1),
      }))
      .filter(st => st.dist <= NEARBY_KM)
      .sort((a, b) => a.dist - b.dist);

    if (!nearbyList) return;

    if (sorted.length === 0) {
      nearbyList.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:18px">No stations within ${NEARBY_KM} km of your location.</div>`;
      lcbNearby.textContent = '0';
      return;
    }

    nearbyList.innerHTML = sorted.slice(0, 8).map(st => `
      <div class="nearby-item">
        <div class="nearby-dot" style="background:${st.custom ? '#58a6ff' : sev_color[st.sev]}"></div>
        <div class="nearby-info">
          <strong>${st.custom ? '⭐ ' : ''}${st.name}</strong>
          <small>${st.t}°C · ${st.p} hPa · ${st.h}% RH${st.custom ? ' · Custom Station' : ` · Conf ${(st.conf*100).toFixed(0)}%`}</small>
        </div>
        <span class="nearby-dist">${st.dist.toFixed(1)} km</span>
        <span class="nearby-sev-badge" style="${st.custom ? 'background:rgba(88,166,255,.2);color:#58a6ff' : sev_cls[st.sev]};border-radius:7px;font-size:9px;font-weight:800;padding:2px 8px;letter-spacing:.5px">${st.custom ? 'CUSTOM' : st.sev}</span>
      </div>`).join('');

    /* KPI: nearest station */
    const nearest = sorted[0];
    if (kvDist) kvDist.textContent = nearest.dist.toFixed(1);

    /* KPI: max confidence nearby */
    const maxConf = Math.max(...sorted.map(s => s.conf));
    if (kvConf) kvConf.textContent = (maxConf * 100).toFixed(0) + '%';
    const kpiConfEl = document.getElementById('kpiConf');
    if (kpiConfEl) kpiConfEl.classList.toggle('alert-kpi', maxConf >= 0.65);

    /* Nearby threats count */
    const inZone = sorted.filter(s => s.dist <= s.coverage_km && s.conf >= 0.45).length;
    lcbNearby.textContent = inZone;
  }

  /* ── Assess active threats ────────────────────────────── */
  function assessThreats() {
    if (userLat === null) return;

    const threats = allStations
      .map((st, i) => ({
        ...st,
        dist : haversine(userLat, userLng, st.lat, st.lng),
        conf : stationConf[i] ?? 0.1,
        sev  : confToSev(stationConf[i] ?? 0.1),
      }))
      .filter(st => st.dist <= st.coverage_km && st.conf >= 0.45)
      .sort((a, b) => b.conf - a.conf);

    /* Zone KPI */
    const worstSev = threats.length
      ? threats[0].sev
      : (allStations.some((st, i) => haversine(userLat, userLng, st.lat, st.lng) <= 50) ? 'HEALTHY' : 'OUTSIDE');
    const zoneDisplay = {
      CRITICAL : '🔴 CRITICAL',
      HIGH     : '🟠 HIGH',
      MEDIUM   : '🟡 MEDIUM',
      LOW      : '🔵 LOW',
      HEALTHY  : '🟢 SAFE',
      OUTSIDE  : '⚪ CLEAR',
    };
    if (kvZone) {
      kvZone.textContent = zoneDisplay[worstSev] || '⚪ CLEAR';
      const kpiZoneEl = document.getElementById('kpiZone');
      if (kpiZoneEl) kpiZoneEl.classList.toggle('alert-kpi', worstSev === 'CRITICAL' || worstSev === 'HIGH');
    }

    /* Threat pill */
    if (threats.length > 0) {
      threatPill?.classList.remove('hidden');
      if (threatPillText) threatPillText.textContent = `${threats.length} THREAT${threats.length > 1 ? 'S' : ''} NEAR YOU`;
      if (locStatusPill) { locStatusPill.className = 'live-pill'; locStatusPill.innerHTML = `<span class="pulse" style="background:var(--red)"></span> ${worstSev} THREAT`; locStatusPill.style.color = 'var(--red)'; locStatusPill.style.background = 'rgba(231,76,60,.1)'; locStatusPill.style.borderColor = 'rgba(231,76,60,.3)'; }
    } else {
      threatPill?.classList.add('hidden');
      if (locStatusPill && isTracking) { locStatusPill.style.color = ''; locStatusPill.style.background = ''; locStatusPill.style.borderColor = ''; locStatusPill.innerHTML = `<span class="pulse"></span> TRACKING ACTIVE`; }
    }

    /* New threats vs last check → raise alerts */
    const newThreatIds = new Set(threats.map(t => t.id));
    const prevThreatIds = new Set(lastThreats);
    threats.forEach(t => {
      if (!prevThreatIds.has(t.id)) {
        pushAlert(t.sev, t.name, t.dist, t.conf);
        if (t.sev === 'CRITICAL' || t.sev === 'HIGH') {
          showToast(`⚠️ ${t.sev} zone: ${t.short} — ${t.dist.toFixed(1)} km away`, '🚨');
        }
      }
    });
    /* Cleared threats → raise CLEAR alert */
    lastThreats.forEach(id => {
      if (!newThreatIds.has(id)) {
        const st = allStations.find(s => s.id === id);
        if (st) pushAlert('CLEAR', st.name, haversine(userLat, userLng, st.lat, st.lng), stationConf[allStations.findIndex(s => s.id === id)] ?? 0.1);
      }
    });
    lastThreats = Array.from(newThreatIds);
  }

  /* ── Push an alert into the feed ─────────────────────── */
  function pushAlert(sev, stName, dist, conf) {
    if (!alertFeed) return;
    alertEmpty?.classList.add('hidden');

    alertCount++;
    if (kvAlerts) kvAlerts.textContent = alertCount;
    const kpiAlertsEl = document.getElementById('kpiAlertsCount');
    if (kpiAlertsEl) kpiAlertsEl.classList.toggle('alert-kpi', alertCount > 0);

    const sevCls = { CRITICAL:'critical', HIGH:'high', MEDIUM:'medium', LOW:'', CLEAR:'safe', HEALTHY:'safe' };
    const sevLabel = { CRITICAL:'THREAT', HIGH:'WARNING', MEDIUM:'ADVISORY', LOW:'ADVISORY', CLEAR:'CLEAR', HEALTHY:'CLEAR' };
    const time  = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

    const item = document.createElement('div');
    item.className = `loc-alert-item ${sevCls[sev] || ''}`;
    item.innerHTML = `
      <div class="loc-alert-sev ${sevLabel[sev] || sev}">${sevLabel[sev] || sev}</div>
      <div class="loc-alert-text">
        <strong>${stName}</strong>
        <span>${dist.toFixed(1)} km · Conf ${(conf*100).toFixed(0)}% · ${time}</span>
        <span style="font-size:10px">${sev === 'CLEAR' ? 'Station returned to normal' : 'You are inside an active anomaly zone'}</span>
      </div>`;
    alertFeed.insertBefore(item, alertFeed.firstChild);
    while (alertFeed.children.length > 16) alertFeed.removeChild(alertFeed.lastChild);
  }

  /* ── Geolocation success callback ─────────────────────── */
  function onPosition(pos) {
    const { latitude: lat, longitude: lng, altitude, speed, accuracy } = pos.coords;

    /* Hide overlays on first fix */
    acquiringOvl?.classList.add('hidden');
    deniedOvl?.classList.add('hidden');

    userLat = lat;
    userLng = lng;

    setUserPosition(lat, lng, accuracy);

    /* Update coordinate bar */
    if (lcbLat) lcbLat.textContent = lat.toFixed(5);
    if (lcbLng) lcbLng.textContent = lng.toFixed(5);
    if (lcbAlt) lcbAlt.textContent = altitude != null ? altitude.toFixed(0) + ' m' : 'N/A';
    if (lcbSpd) lcbSpd.textContent = speed != null ? (speed * 3.6).toFixed(1) + ' km/h' : 'N/A';
    if (accBadge) accBadge.textContent = `Accuracy: ±${accuracy.toFixed(0)} m`;

    /* Update tracking pill */
    if (trackingText) trackingText.textContent = 'Tracking Active';
    if (trackingPill) {
      const dot = trackingPill.querySelector('.pulse');
      if (dot) dot.style.background = 'var(--green)';
    }

    /* Re-run analysis */
    refreshNearby();
    assessThreats();
  }

  /* ── Geolocation error callback ───────────────────────── */
  function onError(err) {
    acquiringOvl?.classList.add('hidden');
    if (err.code === err.PERMISSION_DENIED) {
      deniedOvl?.classList.remove('hidden');
      if (locStatusPill) locStatusPill.innerHTML = `<span class="pulse" style="background:var(--red)"></span> ACCESS DENIED`;
    } else {
      showToast('GPS signal lost. Retrying…', '📡');
      if (trackingText) trackingText.textContent = 'Signal Lost — Retrying';
    }
  }

  /* ── Start / stop tracking ─────────────────────────────── */
  function startTracking() {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation not supported in this browser.', '⚠️');
      return;
    }
    isTracking = true;
    acquiringOvl?.classList.remove('hidden');
    startBtn?.setAttribute('disabled', '');
    stopBtn?.removeAttribute('disabled');
    centerBtn?.removeAttribute('disabled');
    if (locStatusPill) locStatusPill.innerHTML = `<span class="pulse"></span> ACQUIRING GPS`;

    watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy : true,
      maximumAge         : 5000,
      timeout            : 15000,
    });

    /* Drift confidence levels every 6 s to simulate live anomaly changes */
    confDriftTimer = setInterval(driftConf, 6000);

    showToast('GPS tracking started.', '📡');
  }

  function stopTracking() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    clearInterval(confDriftTimer); confDriftTimer = null;
    isTracking = false;
    startBtn?.removeAttribute('disabled');
    stopBtn?.setAttribute('disabled', '');
    centerBtn?.setAttribute('disabled', '');
    acquiringOvl?.classList.add('hidden');
    threatPill?.classList.add('hidden');
    if (trackingText) trackingText.textContent = 'Not tracking';
    if (trackingPill) { const d = trackingPill.querySelector('.pulse'); if (d) d.style.background = 'var(--muted)'; }
    if (locStatusPill) { locStatusPill.style.color = ''; locStatusPill.style.background = ''; locStatusPill.style.borderColor = ''; locStatusPill.innerHTML = `<span class="pulse" style="background:var(--muted)"></span> TRACKING STOPPED`; }
    showToast('Tracking stopped.', '⏹️');
  }

  startBtn?.addEventListener('click',  startTracking);
  stopBtn?.addEventListener('click',   stopTracking);
  centerBtn?.addEventListener('click', () => {
    if (userLat !== null) map.setView([userLat, userLng], 10, { animate:true });
  });

  /* ── Wire up Location Page Anomaly Injection Bar ─────── */
  const locAnSel = document.getElementById('locAnSel');
  const locInjectBtn = document.getElementById('locInjectBtn');

  const triggerLocInject = (atype) => {
    if (!atype || atype === 'none') return;

    // Target closest station to user position or default active station
    let targetSt = allStations[0];
    if (userLat !== null && userLng !== null) {
      let minD = Infinity;
      allStations.forEach(s => {
        const d = Math.hypot(s.lat - userLat, s.lng - userLng);
        if (d < minD) { minD = d; targetSt = s; }
      });
    }

    const targetIdx = allStations.indexOf(targetSt);

    if (targetIdx !== -1 && typeof stationConf !== 'undefined') {
      stationConf[targetIdx] = atype === 'missing' ? 0.95 : atype === 'oor' ? 0.98 : 0.88;
      refreshStationStyles();
      refreshNearby();
      assessThreats();
    }

    if (SG._locMap && targetSt) {
      SG.triggerInjectAnimation(SG._locMap, targetSt.lat, targetSt.lng, atype, targetSt.name, "Simulated anomaly injected on live location map view.");
    }
  };

  locAnSel?.addEventListener('change', e => {
    triggerLocInject(e.target.value);
  });

  locInjectBtn?.addEventListener('click', () => {
    if (locAnSel) {
      if (locAnSel.value === 'none') locAnSel.value = 'spike_temp';
      triggerLocInject(locAnSel.value);
    }
  });

  /* ── Multi-Style Tile Selector & Compass Control ─────── */
  let _locTileRef = null;
  map.eachLayer(l => { if (l instanceof L.TileLayer) _locTileRef = l; });

  const LOC_MAP_STYLES = {
    dark: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      className: 'dark-cyber-tile',
      maxNativeZoom: 19, maxZoom: 19, minZoom: 4,
      errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%230d1117"/></svg>'
    },
    streets: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      className: '',
      maxNativeZoom: 19, maxZoom: 19, minZoom: 4,
      errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%23161b22"/></svg>'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      className: '',
      maxNativeZoom: 18, maxZoom: 18, minZoom: 4,
      errorTileUrl: 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%23161b22"/></svg>'
    }
  };

  SG.setLocMapStyle = function (styleKey) {
    const cfg = LOC_MAP_STYLES[styleKey] || LOC_MAP_STYLES.dark;
    if (_locTileRef) map.removeLayer(_locTileRef);
    _locTileRef = L.tileLayer(cfg.url, cfg).addTo(map);
    _locTileRef.bringToBack();
  };

  SG.setLocMapTheme = function (styleKey) {
    SG.setLocMapStyle(styleKey);
    ['locDarkBtn', 'locLightBtn', 'locSatBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });
    if (styleKey === 'dark') document.getElementById('locDarkBtn')?.classList.add('active');
    else if (styleKey === 'streets') document.getElementById('locLightBtn')?.classList.add('active');
    else if (styleKey === 'satellite') document.getElementById('locSatBtn')?.classList.add('active');
  };
  SG.setLocMapLayer = SG.setLocMapTheme;

  SG.resetLocMapOrientation = function () {
    if (userLat !== null) {
      map.flyTo([userLat, userLng], 11, { duration: 0.8 });
    } else {
      map.flyTo([10.85, 78.65], 7, { duration: 0.8 });
    }
    const compassBtn = document.getElementById('locCompassBtn');
    if (compassBtn) {
      compassBtn.style.transform = 'scale(1.2) rotate(360deg)';
      setTimeout(() => { compassBtn.style.transform = ''; }, 400);
    }
  };
};
