// sketch.js
// Vara sonora: mapea el movimiento (acelerómetro) a pitch, timbre y volumen con p5.sound

let osc, filt, env, meter;
let started = false, motionReady = false;

let ax = 0, ay = 0, az = 0, pax = 0, pay = 0, paz = 0;
let jerk = 0, amag = 0;
let vis = { freq: 220, cutoff: 800, amp: 0 };

let ui = {};
function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();

  // Audio nodes
  osc = new p5.Oscillator('triangle'); // forma inicial
  filt = new p5.LowPass();             // filtro de timbre
  env = new p5.Envelope();             // envolvente de amplitud
  env.setADSR(0.01, 0.12, 0.2, 0.15);  // ataque/decay/sustain/release
  env.setRange(0.4, 0.0);              // nivel máximo y mínimo

  osc.disconnect();    // desconecta del master para insertar filtro
  osc.connect(filt);   // osc -> filtro -> salida
  osc.start();
  osc.amp(0);          // silencio hasta disparar env

  meter = new p5.Amplitude();

  // UI
  ui.startBtn = select('#startBtn');
  ui.state = select('#state');
  ui.sens = select('#sens');
  ui.pmin = select('#pmin');
  ui.pmax = select('#pmax');
  ui.bright = select('#bright');
  ui.smooth = select('#smooth');
  ui.wave = select('#wave');
  ui.invert = select('#invert');

  ui.startBtn.mousePressed(enableAudioAndMotion);
  ui.wave.changed(() => osc.setType(ui.wave.value()));

  textAlign(CENTER, CENTER);
}

async function enableAudioAndMotion() {
  // 1) Arrancar contexto de audio por gesto
  try {
    await userStartAudio();
    if (getAudioContext().state !== 'running') await getAudioContext().resume();
    started = true;
  } catch (e) { console.error(e); }

  // 2) Solicitar permiso de movimiento en iOS 13+
  try {
    if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission();
      if (r === 'granted') motionReady = true;
    } else {
      // Otros navegadores no requieren permiso explícito
      motionReady = true;
    }
  } catch (e) {
    console.error(e);
  }

  updateState();
}

function updateState() {
  const a = started ? 'Audio: activo' : 'Audio: detenido';
  const s = motionReady ? 'Sensores: OK' : 'Sensores: sin permiso';
  ui.state.html(`${a} · ${s}`);
}

function draw() {
  background(10, 14, 20);

  // Leer aceleración si está disponible
  if (motionReady) {
    // p5 expone accelerationX/Y/Z cuando hay devicemotion
    ax = (typeof accelerationX === 'number') ? accelerationX : ax;
    ay = (typeof accelerationY === 'number') ? accelerationY : ay;
    az = (typeof accelerationZ === 'number') ? accelerationZ : az;
  }

  // Magnitud y "sacudida" (jerk)
  const da = createVector(ax - pax, ay - pay, az - paz);
  jerk = da.mag();                         // cambio instantáneo
  amag = createVector(ax, ay, az).mag();   // intensidad total

  pax = ax; pay = ay; paz = az;

  // Parámetros de usuario
  const sens = parseFloat(ui.sens.value());     // sensibilidad de disparo
  const pmin = parseFloat(ui.pmin.value());
  const pmax = parseFloat(ui.pmax.value());
  const bright = parseFloat(ui.bright.value()); // brillo/timbre
  const smooth = parseFloat(ui.smooth.value());
  const inv = ui.invert.elt.checked ? -1 : 1;

  // 1) Pitch desde jerk (más brusco = más agudo)
  const jNorm = constrain(jerk / sens, 0, 1);
  let fTarget = lerp(pmin, pmax, jNorm);
  fTarget = inv < 0 ? map(fTarget, pmin, pmax, pmax, pmin) : fTarget;
  vis.freq = lerp(vis.freq, fTarget, smooth);
  osc.freq(vis.freq);

  // 2) Timbre: filtro lowpass (magnitud -> cutoff, brillo -> resonancia)
  const cutoffTarget = map(constrain(amag, 0, 20), 0, 20, 300, 9000);
  vis.cutoff = lerp(vis.cutoff, cutoffTarget, 0.15);
  filt.freq(vis.cutoff);
  filt.res(0.1 + bright * 20.0); // más brillo = más resonancia/Q

  // 3) Volumen: disparar envolvente en sacudidas
  if (jNorm > 0.12 && started) {
    const peak = map(constrain(amag, 0, 20), 0, 20, 0.05, 0.7);
    env.setRange(peak, 0.0);
    env.play(osc, 0, 0.0); // disparo inmediato
    vis.amp = peak;
  }
  // Visualización
  drawUI();
}

function drawUI() {
  // Disco central según intensidad y color por frecuencia
  const hue = map(vis.freq, 80, 1600, 190, 330, true);
  const r = map(constrain(amag, 0, 20), 0, 20, 40, min(width, height) * 0.45);
  push();
  translate(width / 2, (height - 120) / 2);
  noStroke();

  // halo
  fill(60, 160, 255, 20);
  circle(0, 0, r * 2.2);

  // disco
  fill(lerpColor(color('#2b6de9'), color('#ff5b5b'), map(vis.cutoff, 300, 9000, 0, 1, true)));
  circle(0, 0, r * 2);

  // indicador de dirección
  stroke(245);
  strokeWeight(3);
  line(0, 0, ax * 10, -ay * 10);
  noStroke();

  // texto de depuración
  fill(230);
  textSize(14);
  text(
    `jerk: ${jerk.toFixed(3)}\n|a|: ${amag.toFixed(3)}\nfreq: ${vis.freq.toFixed(1)} Hz\ncutoff: ${Math.round(vis.cutoff)} Hz`,
    0, 0
  );
  pop();

  // medidor inferior
  const level = meter.getLevel();
  const bar = map(level, 0, 0.5, 0, width);
  fill('#2b6de9');
  rect(0, height - 6, bar, 6);
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
