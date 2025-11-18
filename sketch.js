// --- Variables de audio ---
let osc;          // Oscilador principal (tubo)
let filter;       // Filtro para dar color "tubular"
let started = false;

// --- Control de movimiento ---
let intensity = 0;      // Intensidad suavizada del movimiento
let smoothedFreq = 200; // Frecuencia suavizada
let smoothedAmp = 0;    // Amplitud suavizada

// --- Sliders (HTML) ---
let sensSlider, minPitchSlider, maxPitchSlider, brightSlider;
let statusEl;
let startButton;

// --- Setup de p5 ---
function setup() {
  createCanvas(windowWidth, windowHeight);

  // Fondo negro, texto centrado
  textAlign(CENTER, CENTER);
  rectMode(CENTER);

  // Cogemos los elementos HTML ya creados en index.html
  startButton = document.getElementById("startButton");
  sensSlider = document.getElementById("sensSlider");
  minPitchSlider = document.getElementById("minPitchSlider");
  maxPitchSlider = document.getElementById("maxPitchSlider");
  brightSlider = document.getElementById("brightSlider");
  statusEl = document.getElementById("status");

  startButton.addEventListener("click", onStartButton);
}

// Se llama continuamente
function draw() {
  background(0);

  // Texto de ayuda si aún no está iniciado
  if (!started) {
    fill(255);
    textSize(20);
    text(
      "Toca el botón \"Activar sonido\"\n" +
      "y luego mueve el móvil como una vara\n" +
      "para generar el waaaac–woooc.",
      width / 2,
      height / 2
    );
    return;
  }

  // --- LECTURA DEL ACELERÓMETRO ---
  // Variables de sistema de p5.js: accelerationX/Y/Z y pAccelerationX/Y/Z
  // (pueden ser 0 en escritorio o navegador sin permisos)
  let ax = accelerationX;
  let ay = accelerationY;
  let az = accelerationZ;

  let pax = pAccelerationX;
  let pay = pAccelerationY;
  let paz = pAccelerationZ;

  // Medida simple de "sacudida": distancia entre aceleraciones actual y previa
  let delta = dist(ax, ay, az, pax, pay, paz);

  // Suavizamos la intensidad para evitar saltos bruscos
  intensity = lerp(intensity, delta, 0.3);

  // --- MAPEOS A PARÁMETROS SONOROS ---

  // 1) Pitch: usamos la aceleración en Y (inclinar la vara hacia arriba/abajo)
  let minF = parseFloat(minPitchSlider.value);
  let maxF = parseFloat(maxPitchSlider.value);

  // En muchos móviles, ay suele ir de aprox. -20 a 20
  let targetFreq = map(ay, -20, 20, maxF, minF, true);
  smoothedFreq = lerp(smoothedFreq, targetFreq, 0.15);
  osc.freq(smoothedFreq);

  // 2) Amplitud: basada en intensidad * sensibilidad
  let sens = parseFloat(sensSlider.value);
  let rawAmp = constrain((intensity * sens) / 40, 0, 1);
  smoothedAmp = lerp(smoothedAmp, rawAmp, 0.2);
  osc.amp(smoothedAmp, 0.05); // 0.05s para ramp suave

  // 3) Brillo (filtro): base fija + extra según intensidad
  let baseBright = parseFloat(brightSlider.value);
  let cutoff = constrain(baseBright + intensity * 80, 300, 10000);
  filter.freq(cutoff);
  filter.res(8); // resonancia moderada

  // --- INTERFAZ VISUAL ---
  drawVisualizer(ax, ay, az);
  drawHUD(ax, ay, az, cutoff);
}

// Visualizador del movimiento
function drawVisualizer(ax, ay, az) {
  // Color según dirección principal (eje dominante)
  let mag = sqrt(ax * ax + ay * ay + az * az);
  let normInt = constrain(intensity / 20, 0, 1);

  // Color base entre azul (tranquilo) y naranja (agitadísimo)
  let r = lerp(30, 255, normInt);
  let g = lerp(80, 160, normInt);
  let b = lerp(200, 40, normInt);

  // Círculo central cuyo tamaño crece con la intensidad
  let maxRadius = min(width, height) * 0.4;
  let radius = lerp(maxRadius * 0.1, maxRadius, normInt);

  noStroke();
  fill(r, g, b, 180);
  ellipse(width / 2, height / 2, radius, radius);

  // Una "barra" vertical tipo VU
  let barWidth = 40;
  let barHeight = map(normInt, 0, 1, 10, height * 0.8);
  let barX = width - barWidth - 20;
  let barY = height - barHeight - 20;

  fill(255, 220);
  rectMode(CORNER);
  rect(barX, barY, barWidth, barHeight);
}

// HUD con texto de debug
function drawHUD(ax, ay, az, cutoff) {
  fill(255);
  textSize(12);
  textAlign(LEFT, TOP);
  let lines = [
    "ax: " + ax.toFixed(2),
    "ay: " + ay.toFixed(2),
    "az: " + az.toFixed(2),
    "intensidad: " + intensity.toFixed(2),
    "freq: " + smoothedFreq.toFixed(1) + " Hz",
    "amp: " + smoothedAmp.toFixed(2),
    "cutoff: " + cutoff.toFixed(0) + " Hz"
  ];
  text(lines.join("\n"), 10, 10);
}

// Gestiona el botón "Activar sonido"
async function onStartButton() {
  // 1) Reanudar contexto de audio (requisito en navegadores modernos)
  let ctx = getAudioContext();
  if (ctx.state !== "running") {
    await ctx.resume();
  }

  // 2) Pedir permiso para el acelerómetro en iOS (si hace falta)
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    try {
      const response = await DeviceMotionEvent.requestPermission();
      if (response !== "granted") {
        statusEl.textContent =
          "Permiso de movimiento denegado. Actívalo en ajustes del navegador.";
        return;
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent =
        "Error al pedir permiso de movimiento: " + err.message;
      return;
    }
  }

  // 3) Crear la cadena de síntesis (oscilador + filtro)
  if (!osc) {
    osc = new p5.Oscillator("sawtooth"); // diente de sierra para sonido algo áspero
    filter = new p5.Filter("bandpass");  // filtro de banda para color "tubular"

    // Conectamos: osc -> filter -> salida
    osc.disconnect();
    osc.connect(filter);

    // Valores iniciales razonables
    osc.freq(smoothedFreq);
    osc.amp(0);
    filter.freq(1000);
    filter.res(8);

    osc.start();
  }

  started = true;
  statusEl.textContent =
    "¡Listo! Mueve el móvil como si fuera la groan tube (más fuerte = más volumen/brillo).";
  startButton.textContent = "Sonido activo";
}

// Hacer que el canvas siga ocupando la pantalla al rotar el móvil
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
