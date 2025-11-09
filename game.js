(() => {
  // --- BASIC SETUP ---
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const intro = document.getElementById("intro");
  const game = document.getElementById("game");
  const startBtn = document.getElementById("startBtn");
  const shardCountEl = document.getElementById("shardCount");
  const victoryEl = document.getElementById("victory");

  // Light enchanted forest palette (not too dark)
  const COLORS = {
    sky: "#e9f4ef",
    farTrees: "#b3d6c7",
    midTrees: "#89c3ac",
    nearTrees: "#6aa689",
    ground: "#7fb28f",
    platform: "#5a8f73",
    shardCore: "#bfe9ff",
    shardGlow: "rgba(173, 216, 255, 0.65)",
    player: "#5c6aa8",   // armor bluish
    duck: "#f3c350"      // duck yellow
  };

  // --- INPUT ---
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    if(e.key.toLowerCase() === "q") quack();
    if(e.key.toLowerCase() === "r" && state.victory) resetLevel();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // --- SIMPLE AUDIO (WebAudio bleep) ---
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq, dur=0.08, type="sine", gain=0.04){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    setTimeout(()=>{o.stop();}, dur*1000);
  }
  function collectSound(){ beep(880, .06, "triangle", .05); beep(1320, .06, "triangle", .04); }
  function quack(){ beep(300, .08, "square", .06); beep(260, .08, "square", .06); }

  // --- WORLD ---
  const GRAV = 0.9;
  const FRICTION = 0.85;

  const state = {
    cameraX: 0,
    victory: false,
    shardsCollected: 0
  };

  // Platforms
  const platforms = [
    {x: -100, y: H-60, w: 2000, h: 60}, // ground strip
    {x: 200, y: H-140, w: 160, h: 16},
    {x: 420, y: H-200, w: 140, h: 16},
    {x: 680, y: H-260, w: 160, h: 16},
    {x: 980, y: H-220, w: 140, h: 16},
    {x: 1240, y: H-180, w: 160, h: 16},
    {x: 1520, y: H-220, w: 140, h: 16},
    {x: 1780, y: H-260, w: 160, h: 16},
  ];

  // Shards
  const shards = [
    {x: 220, y: H-180, got:false},
    {x: 460, y: H-240, got:false},
    {x: 720, y: H-300, got:false},
    {x: 1000,y: H-260, got:false},
    {x: 1280,y: H-220, got:false},
    {x: 1560,y: H-260, got:false},
    {x: 1820,y: H-300, got:false},
    {x: 1640,y: H-120, got:false}, // near ground
  ];

  // Player & Duck
  const player = { x: 60, y: H-100, vx: 0, vy: 0, w: 28, h: 46, onGround: false, facing: 1 };
  const duck =   { x: 30, y: H-80,  vx: 0, vy: 0, w: 22, h: 18, wobble: 0 };

  // --- PHYSICS HELPERS ---
  function aabb(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  function resolveCollisions(body){
    body.onGround = false;
    for(const p of platforms){
      if(aabb(body, p)){
        // from top
        if(body.vy > 0 && body.y + body.h - p.y < 20){
          body.y = p.y - body.h; body.vy = 0; body.onGround = true;
        } else if (body.vy < 0 && p.y + p.h - body.y < 20){
          body.y = p.y + p.h; body.vy = 0;
        } else if (body.vx > 0){
          body.x = p.x - body.w; body.vx = 0;
        } else if (body.vx < 0){
          body.x = p.x + p.w; body.vx = 0;
        }
      }
    }
  }

  // --- DRAW HELPERS ---
  function drawParallax(){
    ctx.fillStyle = COLORS.sky; ctx.fillRect(0,0,W,H);

    // gentle sun glow
    const grad = ctx.createRadialGradient(W*0.8, H*0.2, 10, W*0.8, H*0.2, 260);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    // distant trees
    const cam = state.cameraX * 0.2;
    ctx.fillStyle = COLORS.farTrees;
    for(let i=0;i<8;i++){
      const x = -cam + i*180 - (state.cameraX%180);
      ctx.fillRect(x, H-180, 120, 180);
      ctx.fillRect(x+60, H-220, 80, 220);
    }

    // mid trees
    ctx.fillStyle = COLORS.midTrees;
    const cam2 = state.cameraX * 0.5;
    for(let i=0;i<8;i++){
      const x = -cam2 + i*220 - (state.cameraX%220);
      ctx.fillRect(x, H-160, 140, 160);
      ctx.fillRect(x+90, H-200, 100, 200);
    }

    // near bushes
    ctx.fillStyle = COLORS.nearTrees;
    const cam3 = state.cameraX * 0.8;
    for(let i=0;i<12;i++){
      const x = -cam3 + i*140 - (state.cameraX%140);
      ctx.beginPath();
      ctx.ellipse(x, H-70, 70, 24, 0, 0, Math.PI*2); ctx.fill();
    }

    // ground stripe
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, H-60, W, 60);
  }

  function drawPlatforms(){
    ctx.fillStyle = COLORS.platform;
    for(const p of platforms){
      const x = p.x - state.cameraX;
      if(x+p.w < -50 || x > W+50) continue;
      ctx.fillRect(x, p.y, p.w, p.h);
    }
  }

  function drawShard(s, pulse){
    const x = s.x - state.cameraX, y = s.y;
    if(s.got) return;
    // Glow
    ctx.beginPath(); ctx.fillStyle = COLORS.shardGlow;
    ctx.ellipse(x, y, 16+Math.sin(pulse)*2, 12+Math.sin(pulse)*1.5, 0, 0, Math.PI*2); ctx.fill();
    // Core
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(pulse*1.2)*0.15);
    ctx.fillStyle = COLORS.shardCore;
    ctx.beginPath();
    ctx.moveTo(0,-12); ctx.lineTo(10,0); ctx.lineTo(0,12); ctx.lineTo(-8,0); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(){
    const x = player.x - state.cameraX, y = player.y;
    // body
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, y, player.w, player.h);
    // face (lighter)
    ctx.fillStyle = "#f6d7b0";
    ctx.fillRect(x+4, y+6, 10, 10);
    // direction hint arrow (when near shard)
  }

  function drawDuck(t){
    const x = duck.x - state.cameraX, y = duck.y;
    ctx.save();
    ctx.translate(x + duck.w/2, y + duck.h/2 + Math.sin(t*8 + duck.wobble)*1.5);
    ctx.scale(1,1);
    ctx.translate(-duck.w/2, -duck.h/2);
    // body
    ctx.fillStyle = COLORS.duck; ctx.fillRect(2,6,18,10);
    // head
    ctx.fillRect(14,2,8,8);
    // beak
    ctx.fillStyle="#d28e2c"; ctx.fillRect(20,5,6,4);
    // leg
    ctx.fillStyle="#b56b2a"; ctx.fillRect(6,16,4,3);
    ctx.fillRect(12,16,4,3);
    ctx.restore();
  }

  // --- UPDATE LOOP ---
  let last = 0;
  function loop(t){
    const dt = Math.min(32, t - last)/16.666;
    last = t;

    // input
    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");
    const jump = keys.has(" ") || keys.has("space");

    if(left) { player.vx -= 0.8; player.facing = -1; }
    if(right){ player.vx += 0.8; player.facing =  1; }
    if(jump && player.onGround){ player.vy = -14; beep(520,.06,"sine",.05); }

    // physics
    player.vx *= FRICTION;
    player.vy += GRAV;
    player.x += player.vx; player.y += player.vy;
    resolveCollisions(player);

    // duck follows with a slight delay
    const targetX = player.x - 26 * player.facing;
    const targetY = player.y + 10;
    duck.vx += (targetX - duck.x) * 0.02;
    duck.vy += (targetY - duck.y) * 0.04 + 0.6; // tiny gravity
    duck.vx *= 0.9; duck.vy *= 0.86;
    duck.x += duck.vx; duck.y += duck.vy;
    resolveCollisions(duck);

    // camera
    state.cameraX = Math.max(0, player.x - W*0.4);

    // shard collection & hints
    const pulse = t/400;
    for(const s of shards){
      if(!s.got){
        // pickup
        const box = {x:s.x-10,y:s.y-10,w:20,h:20};
        if(aabb({x:player.x,y:player.y,w:player.w,h:player.h}, {...box})){
          s.got = true; state.shardsCollected++; collectSound();
          shardCountEl.textContent = `Shards: ${state.shardsCollected} / 8`;
          if(state.shardsCollected>=8){ state.victory = true; victoryEl.classList.remove("hidden"); }
        }
        // duck turns toward nearest shard
      }
    }

    // render
    drawParallax(); drawPlatforms();
    for(const s of shards){ drawShard(s, pulse); }
    drawPlayer(); drawDuck(t/1000);

    requestAnimationFrame(loop);
  }

  function resetLevel(){
    for(const s of shards){ s.got=false; }
    state.shardsCollected = 0; shardCountEl.textContent = "Shards: 0 / 8";
    state.victory = false; victoryEl.classList.add("hidden");
    player.x = 60; player.y = H-100; player.vx=player.vy=0;
    duck.x = 30; duck.y = H-80; duck.vx=duck.vy=0;
  }

  // --- BOOT ---
  startBtn.addEventListener("click", () => {
    intro.classList.add("hidden");
    game.classList.remove("hidden");
    audioCtx.resume(); // enable sound on user gesture
    requestAnimationFrame(loop);
  });

})();