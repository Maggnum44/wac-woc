// Groan Tube simulation using device accelerometer + p5.sound

let osc, filter, started = false;
let smoothAx = 0, smoothAy = 0, smoothAz = 0;
let prevAx = 0, prevAy = 0, prevAz = 0;
let intensity = 0;

// UI elements
let startBtn, sensitivityEl, pitchMinEl, pitchMaxEl, brightnessEl;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(20);

  // connect to HTML controls
  startBtn = select('#startBtn');
  sensitivityEl = select('#sensitivity');
  pitchMinEl = select('#pitchMin');
  pitchMaxEl = select('#pitchMax');
  brightnessEl = select('#brightness');

  startBtn.mousePressed(toggleStart);

  // create audio nodes
  filter = new p5.LowPass();
  osc = new p5.Oscillator('saw');
  osc.disconnect();
  osc.connect(filter);
  osc.start();
  osc.amp(0);

  // prevent autoplay on mobile: wait for gesture
  userStartAudio();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function toggleStart() {
  // resume audio context (mobile requirement)
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }

  // On iOS 13+ we must request motion permission from the user
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(response => {
      if (response === 'granted') {
        started = true;
        startBtn.attribute('disabled', '');
        startBtn.html('Sonido activo');
      } else {
        // user denied motion permission - still allow audio but warn
        started = true;
        startBtn.attribute('disabled', '');
        startBtn.html('Sonido activo (sin sensores)');
      }
    }).catch(err => {
      // some browsers might reject; still start audio
      started = true;
      startBtn.attribute('disabled', '');
      startBtn.html('Sonido activo');
    });
  } else {
    // Non-iOS or older browsers
    started = true;
    startBtn.attribute('disabled', '');
    startBtn.html('Sonido activo');
  }
}

function draw() {
  background(30, 30, 40);

  // Read accelerometer values provided by p5 (may be 0 on desktop)
  let ax = (typeof accelerationX !== 'undefined') ? accelerationX : 0;
  let ay = (typeof accelerationY !== 'undefined') ? accelerationY : 0;
  let az = (typeof accelerationZ !== 'undefined') ? accelerationZ : 0;

  // Smooth the raw values to avoid jumps
  smoothAx = lerp(smoothAx, ax, 0.15);
  smoothAy = lerp(smoothAy, ay, 0.15);
  smoothAz = lerp(smoothAz, az, 0.15);

  // Movement intensity measured as delta from previous smoothed values
  let dx = smoothAx - prevAx;
  let dy = smoothAy - prevAy;
  let dz = smoothAz - prevAz;
  let deltaMag = sqrt(dx * dx + dy * dy + dz * dz);

  // sensitivity slider modifies how delta maps to 0..1
  let sensitivity = Number(sensitivityEl.value());
  intensity = constrain(map(deltaMag, 0, sensitivity, 0, 1), 0, 1);

  // Pitch mapping: tilt (x) defines base pitch; agitation (intensity) raises it
  let pMin = Number(pitchMinEl.value());
  let pMax = Number(pitchMaxEl.value());
  // map tilt (smoothAx) to base pitch (inverted so flipping inverts tone)
  let baseFreq = map(smoothAx, -9.8, 9.8, pMax, pMin); // tilt inversion
  baseFreq = constrain(baseFreq, pMin, pMax);
  // agitation increases pitch a bit
  let freq = baseFreq * (1 + intensity * 0.6);

  // Filter cutoff: controlled by brightness slider and intensity
  let brightness = Number(brightnessEl.value());
  // base cutoff from brightness (normalize to Hz)
  let cutoff = map(brightness, 0, 1, 300, 6000);
  cutoff *= (1 + intensity * 2.0);
  cutoff = constrain(cutoff, 50, 22050);

  // Smooth transitions for frequency and filter
  let currentFreq = osc.freq() || 220;
  let smoothFreq = lerp(currentFreq, freq, 0.12);
  osc.freq(smoothFreq);
  filter.freq(lerp(filter.freq() || 1000, cutoff, 0.08));

  // Amplitude: scale with intensity with smoothing
  let targetAmp = started ? intensity * 0.7 : 0;
  let curAmp = osc.getAmp();
  let smoothAmp = lerp(curAmp, targetAmp, 0.12);
  osc.amp(smoothAmp, 0.02);

  // Visual indicator: direction and intensity
  push();
  translate(width / 2, height / 2);
  // draw intensity circle
  noStroke();
  fill(60, 160, 220, 180);
  let radius = 40 + intensity * min(width, height) * 0.25;
  ellipse(0, 0, radius, radius);

  // draw direction arrow based on tilt (ax, ay)
  stroke(255);
  strokeWeight(3);
  let arrowX = map(smoothAx, -9.8, 9.8, -width * 0.4, width * 0.4);
  let arrowY = map(smoothAy, -9.8, 9.8, -height * 0.4, height * 0.4);
  line(0, 0, arrowX, arrowY);
  fill(255);
  noStroke();
  textAlign(CENTER);
  textSize(14);
  text('Intensidad: ' + nf(intensity, 1, 2), 0, radius / 2 + 20);
  pop();

  // keep previous smoothed values for next delta
  prevAx = smoothAx; prevAy = smoothAy; prevAz = smoothAz;

  // small hint on desktop
  if (!started) {
    push();
    fill(255);
    textAlign(LEFT);
    textSize(12);
    text('Pulsa "Iniciar sonido" para permitir audio en móvil', 10, height - 10);
    pop();
  }
}

// helpful: also respond to deviceMoved event to make it more responsive on some devices
function deviceMoved() {
  // deviceMoved triggers frequently; we allow draw() to handle most mapping
}


