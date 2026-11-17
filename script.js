// ==========================================================================
// CATCH QUEST - STAGE 4: STATE & STORAGE
// Modern Nature Arcade
// Safe localStorage Best-Score Persistence, Robust State Management,
// Freeze Pause/Resume, Clean Reset & Leak Prevention
// ==========================================================================

// DOM Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score-display');
const bestScoreDisplay = document.getElementById('best-score-display');
const livesDisplay = document.getElementById('lives-display');
const speedDisplay = document.getElementById('speed-display');

const readyScreen = document.getElementById('ready-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const gameOverBestScore = document.getElementById('game-over-best-score');
const pauseScore = document.getElementById('pause-score');
const pauseBestScore = document.getElementById('pause-best-score');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const resetBtn = document.getElementById('reset-btn');
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
const muteText = document.getElementById('mute-text');

// Game Dimensions & Physics
const GAME_WIDTH = 400;
const GAME_HEIGHT = 500;
const BASKET_WIDTH = 80;
const BASKET_HEIGHT = 20;
const BASKET_Y = GAME_HEIGHT - 15 - BASKET_HEIGHT; // 465px from top

const OBJECT_SIZE = 24;
const INITIAL_OBJECT_SPEED = 150; // pixels per second base speed
const INITIAL_BASKET_SPEED = 300; // pixels per second base speed (2.0x ratio with object speed)
const SPEED_INCREMENT = 30; // speed increment upon difficulty milestones
const INITIAL_SPAWN_INTERVAL_MS = 1400; // scheduled timed spawn interval
const MIN_SPAWN_INTERVAL_MS = 500; // maximum spawn acceleration floor
const SPAWN_ACCELERATION_MS = 90; // reduction in spawn interval per milestone

// ==========================================================================
// STAGE 4: SAFE STORAGE SYSTEM (BEST-SCORE PERSISTENCE)
// ==========================================================================
const STORAGE_KEY = 'catch_quest_best_score_v1';
let bestScore = 0;

/**
 * Safely loads the best score from localStorage with comprehensive validation
 * and fallback handling for private browsing / blocked storage access.
 */
function loadBestScore() {
  try {
    const rawVal = localStorage.getItem(STORAGE_KEY);
    if (rawVal !== null && rawVal !== undefined) {
      const parsed = parseInt(rawVal, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Unable to access localStorage. Using in-memory fallback.', err);
  }
  return 0;
}

/**
 * Safely writes a new best score to localStorage and updates all displays.
 */
function saveBestScore(val) {
  try {
    localStorage.setItem(STORAGE_KEY, String(val));
  } catch (err) {
    console.warn('Unable to save best score to localStorage.', err);
  }
}

/**
 * Checks if current score beats best score; if so, updates bestScore & saves immediately.
 */
function checkAndUpdateBestScore() {
  if (score > bestScore) {
    bestScore = score;
    saveBestScore(bestScore);
    updateStatsUI();
  }
}

// Initial best score load
bestScore = loadBestScore();

// ==========================================================================
// STAGE 4: GAME STATE & TIMING MANAGEMENT
// States: 'Ready', 'Playing', 'Paused', 'GameOver'
// ==========================================================================
let gameState = 'Ready';
let score = 0;
let lives = 3;
let objectSpeed = INITIAL_OBJECT_SPEED;
let basketSpeed = INITIAL_BASKET_SPEED;
let totalProcessedObjects = 0;
let currentSpawnInterval = INITIAL_SPAWN_INTERVAL_MS;
let goodItemRatio = 0.50; // Strict 50/50 balance initially

let basketX = (GAME_WIDTH - BASKET_WIDTH) / 2;
const fallingObjects = []; // Active falling items

// Sensory Feedback Systems: Particles, Popups, and Screen Shake
const particles = [];
const scorePopups = [];
let screenShakeTime = 0;
let screenShakeIntensity = 0;

// Loop & Timer IDs
let animationFrameId = null;
let spawnTimeoutId = null;
let lastFrameTime = 0;

// Pause Freeze Timing Management:
// Tracks time elapsed towards the next spawn when paused, so spawn timing resumes seamlessly.
let spawnTimerScheduledDuration = 0;
let spawnTimerStartTime = 0;
let spawnTimerRemainingMs = 0;

// Input State
const pressedKeys = {
  left: false,
  right: false
};

// ==========================================================================
// PROCEDURAL AUDIO ENGINE (Web Audio API & Web Speech API)
// ==========================================================================
let audioCtx = null;
let masterGainNode = null;
let isMuted = false;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.setValueAtTime(isMuted ? 0 : 1.0, audioCtx.currentTime);
      masterGainNode.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Global unlock listener on first user interaction
window.addEventListener('pointerdown', initAudioContext, { once: false });
window.addEventListener('keydown', initAudioContext, { once: false });

function toggleMute() {
  initAudioContext();
  isMuted = !isMuted;
  if (masterGainNode && audioCtx) {
    masterGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGainNode.gain.setValueAtTime(isMuted ? 0 : 1.0, audioCtx.currentTime);
  }

  if (isMuted) {
    muteBtn.classList.add('muted');
    muteIcon.textContent = '🔇';
    muteText.textContent = 'Muted';
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } else {
    muteBtn.classList.remove('muted');
    muteIcon.textContent = '🔊';
    muteText.textContent = 'Sound: ON';
    playButtonSound();
  }
}

// 1. Button Press Sound: Short, crisp rising pitch chirp (400Hz -> 800Hz over 50ms)
function playButtonSound() {
  if (isMuted || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    const now = audioCtx.currentTime;

    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(masterGainNode);

    osc.start(now);
    osc.stop(now + 0.055);
  } catch (e) {
    // Graceful fallback
  }
}

// 2. Apple Picked (Good) Sound: Cheerful ascending major arpeggio chime (C5 -> E5 -> G5 -> C6)
function playAppleCatchSound() {
  if (isMuted || !audioCtx) return;
  try {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const startTime = audioCtx.currentTime;

    notes.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + index * 0.045);

      const noteStart = startTime + index * 0.045;
      const noteEnd = noteStart + 0.16;

      gain.gain.setValueAtTime(0.2, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);

      osc.connect(gain);
      gain.connect(masterGainNode);

      osc.start(noteStart);
      osc.stop(noteEnd);
    });
  } catch (e) {
    // Graceful fallback
  }
}

// 3. Bomb Caught (Crash) Sound: Noise burst + deep sub-bass drop (150Hz -> 30Hz)
function playBombCrashSound() {
  if (isMuted || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;

    // Sub-bass impact drop (150Hz down to 30Hz)
    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    subGain.gain.setValueAtTime(0.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    subOsc.connect(subGain);
    subGain.connect(masterGainNode);

    subOsc.start(now);
    subOsc.stop(now + 0.36);

    // Low-pass filtered noise buffer burst
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.3);
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGainNode);

    noiseSource.start(now);
    noiseSource.stop(now + 0.31);
  } catch (e) {
    // Graceful fallback
  }
}

// 4. Voice Lines & Game State Announcements via Web Speech API
function speakVoice(text, options = {}) {
  if (isMuted || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // cancel any active utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.1;
    utterance.volume = options.volume || 0.9;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')));
      if (preferred) utterance.voice = preferred;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    // Silently continue if voice blocked by browser policy
  }
}

// ==========================================================================
// HIGH-DPI CANVAS SETUP & UI UPDATES
// ==========================================================================
function setupCanvasResolution() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = GAME_WIDTH * dpr;
  canvas.height = GAME_HEIGHT * dpr;
  ctx.scale(dpr, dpr);
}
setupCanvasResolution();

function updateStatsUI() {
  scoreDisplay.textContent = score;
  bestScoreDisplay.textContent = bestScore;
  livesDisplay.textContent = lives;
  speedDisplay.textContent = Math.round(objectSpeed);

  if (pauseScore) pauseScore.textContent = score;
  if (pauseBestScore) pauseBestScore.textContent = bestScore;
  if (gameOverBestScore) gameOverBestScore.textContent = bestScore;
}

// Keyboard Listeners
window.addEventListener('keydown', (event) => {
  // Key controls active only during Playing state
  if (gameState === 'Playing') {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      pressedKeys.left = true;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      pressedKeys.right = true;
    }
  }

  // Pause key 'p' or 'P' toggles pause when Playing or Paused
  if (event.key === 'p' || event.key === 'P') {
    if (gameState === 'Playing' || gameState === 'Paused') {
      togglePause();
    }
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
    pressedKeys.left = false;
  } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
    pressedKeys.right = false;
  }
});

window.addEventListener('blur', () => {
  pressedKeys.left = false;
  pressedKeys.right = false;
});

// UI Event Handlers (Attached ONCE to prevent listener stacking)
startBtn.addEventListener('click', () => {
  initAudioContext();
  playButtonSound();
  startGame();
});

restartBtn.addEventListener('click', () => {
  initAudioContext();
  playButtonSound();
  startGame();
});

pauseBtn.addEventListener('click', () => {
  initAudioContext();
  playButtonSound();
  togglePause();
});

resumeBtn.addEventListener('click', () => {
  initAudioContext();
  playButtonSound();
  resumeGame();
});

resetBtn.addEventListener('click', () => {
  initAudioContext();
  playButtonSound();
  resetToReady();
});

muteBtn.addEventListener('click', toggleMute);

function setScore(newScore) {
  score = Math.max(0, newScore);
  checkAndUpdateBestScore();
  updateStatsUI();
}

function setLives(newLives) {
  lives = Math.max(0, newLives);
  updateStatsUI();
}

function removeAllObjects() {
  fallingObjects.length = 0;
}

// Dynamic Difficulty Progression:
// Triggered on every 3 processed objects (milestones)
function onObjectProcessed() {
  totalProcessedObjects++;
  if (totalProcessedObjects % 3 === 0) {
    currentSpawnInterval = Math.max(MIN_SPAWN_INTERVAL_MS, currentSpawnInterval - SPAWN_ACCELERATION_MS);
    objectSpeed += SPEED_INCREMENT;
    basketSpeed = objectSpeed * 2.0;
    goodItemRatio = 0.50;
    updateStatsUI();
  }
}

// Spawn single falling object
function spawnObject() {
  if (gameState !== 'Playing') return;

  const type = Math.random() < goodItemRatio ? 'apple' : 'bomb';
  const x = Math.random() * (GAME_WIDTH - OBJECT_SIZE);
  const y = 0;

  fallingObjects.push({
    type,
    x,
    y,
    processed: false
  });
}

// Scheduled Continuous Timed Spawning with Freeze Resume Support
function scheduleNextObject(delay = currentSpawnInterval) {
  if (gameState !== 'Playing') return;

  if (spawnTimeoutId !== null) {
    clearTimeout(spawnTimeoutId);
    spawnTimeoutId = null;
  }

  spawnTimerScheduledDuration = delay;
  spawnTimerStartTime = Date.now();

  spawnTimeoutId = setTimeout(() => {
    spawnTimeoutId = null;
    if (gameState === 'Playing') {
      spawnObject();
      scheduleNextObject(currentSpawnInterval);
    }
  }, delay);
}

// ==========================================================================
// PARTICLE, POPUP & SCREEN SHAKE FEEDBACK ENGINES
// ==========================================================================
function triggerScreenShake(intensity = 6, duration = 0.3) {
  screenShakeIntensity = intensity;
  screenShakeTime = duration;
}

function spawnCatchParticles(x, y, type) {
  if (type === 'apple') {
    const colors = ['#52b788', '#2d6a4f', '#ffd166', '#ffffff', '#70e000'];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      particles.push({
        x: x + OBJECT_SIZE / 2,
        y: y + OBJECT_SIZE / 2,
        vx: Math.cos(angle) * speed * 0.7,
        vy: -Math.abs(Math.sin(angle) * speed) - 30, // Drift upward
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2.5 + Math.random() * 3,
        alpha: 1,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.5 + Math.random() * 0.4,
        isSparkle: true
      });
    }
  } else if (type === 'bomb') {
    const sparkColors = ['#ff4d6d', '#ff7b00', '#ffd166', '#d90429'];
    const smokeColors = ['#415a77', '#1b263b', '#5c7490'];
    const count = 24;

    for (let i = 0; i < count; i++) {
      const isSmoke = i % 3 === 0;
      const angle = Math.random() * Math.PI * 2;
      const speed = isSmoke ? (20 + Math.random() * 50) : (60 + Math.random() * 120);

      particles.push({
        x: x + OBJECT_SIZE / 2,
        y: y + OBJECT_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        color: isSmoke ? smokeColors[Math.floor(Math.random() * smokeColors.length)] : sparkColors[Math.floor(Math.random() * sparkColors.length)],
        size: isSmoke ? (5 + Math.random() * 6) : (2 + Math.random() * 3),
        alpha: 1,
        life: isSmoke ? (0.6 + Math.random() * 0.4) : (0.35 + Math.random() * 0.3),
        maxLife: isSmoke ? 0.8 : 0.5,
        isSmoke: isSmoke
      });
    }
  }
}

function spawnFloatingScore(x, y, text, color = '#ffd166') {
  scorePopups.push({
    x: Math.max(30, Math.min(x, GAME_WIDTH - 60)),
    y: y,
    text: text,
    color: color,
    alpha: 1,
    life: 0.8,
    maxLife: 0.8,
    vy: -50 // Float upward
  });
}

function updateFeedbackEffects(deltaTime) {
  if (screenShakeTime > 0) {
    screenShakeTime -= deltaTime;
    if (screenShakeTime < 0) screenShakeTime = 0;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= deltaTime;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * deltaTime;
    p.y += p.vy * deltaTime;
    if (p.isSmoke) {
      p.size += deltaTime * 6;
    }
    p.alpha = Math.max(0, p.life / p.maxLife);
  }

  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const popup = scorePopups[i];
    popup.life -= deltaTime;
    if (popup.life <= 0) {
      scorePopups.splice(i, 1);
      continue;
    }
    popup.y += popup.vy * deltaTime;
    popup.alpha = Math.max(0, popup.life / popup.maxLife);
  }
}

function renderFeedbackEffects() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < scorePopups.length; i++) {
    const popup = scorePopups[i];
    ctx.save();
    ctx.globalAlpha = popup.alpha;
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    ctx.strokeStyle = '#0d1b2a';
    ctx.lineWidth = 3;
    ctx.strokeText(popup.text, popup.x, popup.y);

    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.restore();
  }
}

// Improved collision detection: object center must enter within the basket's inner rim
function checkCollision(obj) {
  const objCenterX = obj.x + OBJECT_SIZE / 2;
  const objBottom = obj.y + OBJECT_SIZE;
  const objTop = obj.y;

  const basketLeft = basketX + 4; // Inside inner rim
  const basketRight = basketX + BASKET_WIDTH - 4;
  const basketTop = BASKET_Y;
  const basketCatchThreshold = BASKET_Y + 12;

  return (
    objCenterX >= basketLeft &&
    objCenterX <= basketRight &&
    objBottom >= basketTop &&
    objTop <= basketCatchThreshold
  );
}

// ==========================================================================
// CODE-DRAWN PROCEDURAL ASSETS (Canvas 2D - Modern Nature Arcade)
// ==========================================================================

// 1. Playfield Background
function renderPlayfield() {
  ctx.fillStyle = '#415a77';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  grad.addColorStop(0, 'rgba(119, 141, 169, 0.25)');
  grad.addColorStop(0.7, 'rgba(65, 90, 119, 0.1)');
  grad.addColorStop(1, 'rgba(27, 38, 59, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Ground Baseline
  ctx.fillStyle = '#1b263b';
  ctx.fillRect(0, BASKET_Y + BASKET_HEIGHT + 2, GAME_WIDTH, GAME_HEIGHT - (BASKET_Y + BASKET_HEIGHT + 2));

  ctx.strokeStyle = '#5c7490';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, BASKET_Y + BASKET_HEIGHT + 2);
  ctx.lineTo(GAME_WIDTH, BASKET_Y + BASKET_HEIGHT + 2);
  ctx.stroke();
}

// 2. Recognizable Red Apple with Dimple, Stem, and Green Leaf
function renderApple(x, y, size) {
  ctx.save();
  ctx.translate(x, y);

  const cx = size / 2;
  const topY = 7;
  const bottomY = size - 2;
  const leftX = 2;
  const rightX = size - 2;

  // Brown Woody Stem
  ctx.strokeStyle = '#6f4e37';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.quadraticCurveTo(cx + 2, 2, cx + 4, 1);
  ctx.stroke();

  // Vibrant Green Leaf
  ctx.fillStyle = '#2d6a4f';
  ctx.strokeStyle = '#1b4332';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx + 1, topY - 1);
  ctx.quadraticCurveTo(cx + 8, topY - 5, cx + 9, topY - 1);
  ctx.quadraticCurveTo(cx + 6, topY + 2, cx + 1, topY - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#52b788';
  ctx.beginPath();
  ctx.arc(cx + 5, topY - 2, 1, 0, Math.PI * 2);
  ctx.fill();

  // Apple Body - Recognizable double-lobed silhouette with top indentation
  const appleGrad = ctx.createRadialGradient(cx - 3, topY + 5, 2, cx, topY + 8, 12);
  appleGrad.addColorStop(0, '#ff4d6d');
  appleGrad.addColorStop(0.6, '#d90429');
  appleGrad.addColorStop(1, '#9b2226');

  ctx.fillStyle = appleGrad;
  ctx.strokeStyle = '#800f2f';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.moveTo(cx, topY + 2);
  ctx.bezierCurveTo(cx - 4, topY - 1, leftX, topY + 1, leftX, topY + 7);
  ctx.bezierCurveTo(leftX, bottomY - 1, cx - 4, bottomY, cx - 1, bottomY);
  ctx.lineTo(cx + 1, bottomY);
  ctx.bezierCurveTo(cx + 4, bottomY, rightX, bottomY - 1, rightX, topY + 7);
  ctx.bezierCurveTo(rightX, topY + 1, cx + 4, topY - 1, cx, topY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle Gloss
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - 4, topY + 5, 2, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 3. Recognizable Cartoon Bomb with Fuse and Burning Spark
function renderBomb(x, y, size) {
  ctx.save();
  ctx.translate(x, y);

  const cx = size / 2;
  const cy = size / 2 + 2;
  const radius = 8;

  // Burning Fuse
  ctx.strokeStyle = '#d4a373';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - 2);
  ctx.quadraticCurveTo(cx + 6, cy - radius - 6, cx + 5, 2);
  ctx.stroke();

  // Spark at Fuse Tip
  const sparkX = cx + 5;
  const sparkY = 2;

  ctx.fillStyle = '#ff7b00';
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffea00';
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sparkX - 2.5, sparkY);
  ctx.lineTo(sparkX + 2.5, sparkY);
  ctx.moveTo(sparkX, sparkY - 2.5);
  ctx.lineTo(sparkX, sparkY + 2.5);
  ctx.stroke();

  // Cylindrical Neck / Cap
  ctx.fillStyle = '#5c7490';
  ctx.strokeStyle = '#1b263b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(cx - 3, cy - radius - 2, 6, 2.5);
  ctx.fill();
  ctx.stroke();

  // Dark Spherical Bomb Body
  const bombGrad = ctx.createRadialGradient(cx - 2.5, cy - 2.5, 1, cx, cy, radius);
  bombGrad.addColorStop(0, '#415a77');
  bombGrad.addColorStop(0.5, '#1b263b');
  bombGrad.addColorStop(1, '#0d1b2a');

  ctx.fillStyle = bombGrad;
  ctx.strokeStyle = '#0d1b2a';
  ctx.lineWidth = 1.3;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Specular Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(cx - 2.8, cy - 2.8, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 4. Recognizable Woven Basket
function renderBasket(x, y, w, h) {
  ctx.save();

  const rimInset = 5;
  const bottomInset = 12;

  const basketGrad = ctx.createLinearGradient(x, y, x, y + h);
  basketGrad.addColorStop(0, '#778da9');
  basketGrad.addColorStop(0.5, '#5c7490');
  basketGrad.addColorStop(1, '#415a77');

  ctx.fillStyle = basketGrad;
  ctx.strokeStyle = '#1b263b';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(x + rimInset, y + 4);
  ctx.quadraticCurveTo(x + rimInset - 2, y + h * 0.5, x + bottomInset, y + h);
  ctx.lineTo(x + w - bottomInset, y + h);
  ctx.quadraticCurveTo(x + w - rimInset + 2, y + h * 0.5, x + w - rimInset, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Wicker Texture / Weave Stripes
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + rimInset, y + 4);
  ctx.quadraticCurveTo(x + rimInset - 2, y + h * 0.5, x + bottomInset, y + h);
  ctx.lineTo(x + w - bottomInset, y + h);
  ctx.quadraticCurveTo(x + w - rimInset + 2, y + h * 0.5, x + w - rimInset, y + 4);
  ctx.closePath();
  ctx.clip();

  ctx.strokeStyle = '#1b263b';
  ctx.lineWidth = 1;
  for (let wy = y + 8; wy < y + h; wy += 5) {
    ctx.beginPath();
    ctx.moveTo(x, wy);
    ctx.lineTo(x + w, wy);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.2;
  for (let wx = x + bottomInset; wx < x + w - bottomInset; wx += 8) {
    ctx.beginPath();
    ctx.moveTo(wx, y + 4);
    ctx.lineTo(wx + 2, y + h);
    ctx.stroke();
  }
  ctx.restore();

  // Open Top Rim
  ctx.fillStyle = '#778da9';
  ctx.strokeStyle = '#1b263b';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.roundRect(x, y, w, 5, [3]);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 1.5);
  ctx.lineTo(x + w - 3, y + 1.5);
  ctx.stroke();

  ctx.restore();
}

// Master Render Pass
function renderGame() {
  ctx.save();

  if (screenShakeTime > 0) {
    const shakeOffsetX = (Math.random() * 2 - 1) * screenShakeIntensity;
    const shakeOffsetY = (Math.random() * 2 - 1) * screenShakeIntensity;
    ctx.translate(shakeOffsetX, shakeOffsetY);
  }

  renderPlayfield();

  // Render Basket
  renderBasket(basketX, BASKET_Y, BASKET_WIDTH, BASKET_HEIGHT);

  // Render Active Falling Objects
  for (let i = 0; i < fallingObjects.length; i++) {
    const obj = fallingObjects[i];
    if (!obj.processed) {
      if (obj.type === 'apple') {
        renderApple(obj.x, obj.y, OBJECT_SIZE);
      } else if (obj.type === 'bomb') {
        renderBomb(obj.x, obj.y, OBJECT_SIZE);
      }
    }
  }

  renderFeedbackEffects();

  ctx.restore();
}

// ==========================================================================
// GAME ENGINE LOOP (Stage 4 State-Gated Update Loop)
// ==========================================================================
function gameLoop(timestamp) {
  // Hard state check: Stop immediately if not in Playing state
  if (gameState !== 'Playing') {
    animationFrameId = null;
    return;
  }

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  // Delta-time capped at 100ms to prevent massive jumps after hiccups
  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
  lastFrameTime = timestamp;

  // 1. Basket Movement
  if (pressedKeys.left && !pressedKeys.right) {
    basketX -= basketSpeed * deltaTime;
  } else if (pressedKeys.right && !pressedKeys.left) {
    basketX += basketSpeed * deltaTime;
  }

  // Clamping within playfield bounds
  if (basketX < 0) basketX = 0;
  if (basketX > GAME_WIDTH - BASKET_WIDTH) basketX = GAME_WIDTH - BASKET_WIDTH;

  // 2. Falling Objects Update & Collision
  for (let i = fallingObjects.length - 1; i >= 0; i--) {
    const obj = fallingObjects[i];
    if (obj.processed) {
      fallingObjects.splice(i, 1);
      continue;
    }

    obj.y += objectSpeed * deltaTime;

    // Check collision with basket
    if (checkCollision(obj)) {
      obj.processed = true;
      const catchX = obj.x;
      const catchY = obj.y;
      const catchType = obj.type;
      fallingObjects.splice(i, 1);
      onObjectProcessed();

      if (catchType === 'apple') {
        playAppleCatchSound();
        spawnCatchParticles(catchX, catchY, 'apple');
        spawnFloatingScore(catchX + OBJECT_SIZE / 2, catchY - 10, '+1', '#ffd166');
        setScore(score + 1);
      } else if (catchType === 'bomb') {
        playBombCrashSound();
        triggerScreenShake(8, 0.35);
        spawnCatchParticles(catchX, catchY, 'bomb');
        spawnFloatingScore(catchX + OBJECT_SIZE / 2, catchY - 10, 'CRASH!', '#ff4d6d');
        setLives(lives - 1);
        if (lives <= 0) {
          triggerGameOver();
          return;
        }
      }
    } else if (obj.y > GAME_HEIGHT) {
      // Missed object past bottom boundary
      obj.processed = true;
      const missedType = obj.type;
      const missedX = obj.x;
      fallingObjects.splice(i, 1);
      onObjectProcessed();

      if (missedType === 'apple') {
        triggerScreenShake(3, 0.2);
        const actualPenalty = score > 0 ? '-1' : 'MISS!';
        spawnFloatingScore(missedX + OBJECT_SIZE / 2, GAME_HEIGHT - 30, actualPenalty, '#ff4d6d');
        setScore(score - 1);
        setLives(lives - 1);
        if (lives <= 0) {
          triggerGameOver();
          return;
        }
      }
    }
  }

  // Update feedback effects
  updateFeedbackEffects(deltaTime);

  // 3. Render
  renderGame();

  // Schedule next frame only if still in Playing state
  if (gameState === 'Playing') {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

// ==========================================================================
// LIFECYCLE MANAGEMENT: START, PAUSE, RESUME, RESTART, GAME OVER
// ==========================================================================

/**
 * Starts or restarts a gameplay session cleanly.
 * Resets score, lives, objects, and speed, but preserves saved best score.
 */
function startGame() {
  // Clear any existing animation frame or spawn timer to prevent stacking
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (spawnTimeoutId !== null) {
    clearTimeout(spawnTimeoutId);
    spawnTimeoutId = null;
  }

  // Clear entities
  removeAllObjects();
  particles.length = 0;
  scorePopups.length = 0;
  screenShakeTime = 0;
  screenShakeIntensity = 0;

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Reset Round State
  gameState = 'Playing';
  score = 0;
  lives = 3;
  objectSpeed = INITIAL_OBJECT_SPEED;
  basketSpeed = INITIAL_BASKET_SPEED;
  currentSpawnInterval = INITIAL_SPAWN_INTERVAL_MS;
  goodItemRatio = 0.50;
  totalProcessedObjects = 0;
  basketX = (GAME_WIDTH - BASKET_WIDTH) / 2;
  pressedKeys.left = false;
  pressedKeys.right = false;
  lastFrameTime = 0;
  spawnTimerRemainingMs = 0;

  updateStatsUI();

  // Update UI Elements
  pauseBtn.disabled = false;
  pauseBtn.textContent = 'Pause';
  readyScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

  speakVoice("Good luck!", { rate: 1.05, pitch: 1.2 });
  spawnCatchParticles(basketX + BASKET_WIDTH / 2 - 12, BASKET_Y - 20, 'apple');

  // Spawn initial object and schedule next
  spawnObject();
  scheduleNextObject(currentSpawnInterval);
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Freezes the game: halts loops, cancels spawn timers, and stores remaining interval time.
 */
function pauseGame() {
  if (gameState !== 'Playing') return;

  gameState = 'Paused';

  // 1. Cancel animation frame loop
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 2. Freeze spawn timer and calculate remaining time
  if (spawnTimeoutId !== null) {
    clearTimeout(spawnTimeoutId);
    spawnTimeoutId = null;
    const elapsed = Date.now() - spawnTimerStartTime;
    spawnTimerRemainingMs = Math.max(50, spawnTimerScheduledDuration - elapsed);
  } else {
    spawnTimerRemainingMs = currentSpawnInterval;
  }

  // 3. Reset input states to prevent sticky keys while paused
  pressedKeys.left = false;
  pressedKeys.right = false;

  // 4. Update UI
  pauseBtn.textContent = 'Resume';
  updateStatsUI();
  pauseScreen.classList.remove('hidden');

  speakVoice("Relax player", { rate: 0.95, pitch: 1.0 });

  // Render static frozen frame
  renderGame();
}

/**
 * Resumes game from the exact position and remaining spawn interval.
 */
function resumeGame() {
  if (gameState !== 'Paused') return;

  gameState = 'Playing';
  lastFrameTime = 0; // Reset lastFrameTime to prevent delta-time surge on resume

  pauseBtn.textContent = 'Pause';
  pauseScreen.classList.add('hidden');

  // Resume spawning with remaining timer offset
  const resumeDelay = spawnTimerRemainingMs > 0 ? spawnTimerRemainingMs : currentSpawnInterval;
  spawnTimerRemainingMs = 0;
  scheduleNextObject(resumeDelay);

  // Restart loop cleanly
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Toggles between Playing and Paused.
 */
function togglePause() {
  if (gameState === 'Playing') {
    pauseGame();
  } else if (gameState === 'Paused') {
    resumeGame();
  }
}

/**
 * Resets the game to the initial Ready screen while preserving the saved best score.
 */
function resetToReady() {
  // Clear any existing loops
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (spawnTimeoutId !== null) {
    clearTimeout(spawnTimeoutId);
    spawnTimeoutId = null;
  }

  removeAllObjects();
  particles.length = 0;
  scorePopups.length = 0;
  screenShakeTime = 0;
  screenShakeIntensity = 0;

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  gameState = 'Ready';
  score = 0;
  lives = 3;
  objectSpeed = INITIAL_OBJECT_SPEED;
  basketSpeed = INITIAL_BASKET_SPEED;
  currentSpawnInterval = INITIAL_SPAWN_INTERVAL_MS;
  goodItemRatio = 0.50;
  totalProcessedObjects = 0;
  basketX = (GAME_WIDTH - BASKET_WIDTH) / 2;
  pressedKeys.left = false;
  pressedKeys.right = false;
  lastFrameTime = 0;
  spawnTimerRemainingMs = 0;

  updateStatsUI();
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';

  pauseScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  readyScreen.classList.remove('hidden');

  renderGame();
}

/**
 * Triggers Game Over state.
 */
function triggerGameOver() {
  gameState = 'GameOver';

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (spawnTimeoutId !== null) {
    clearTimeout(spawnTimeoutId);
    spawnTimeoutId = null;
  }

  removeAllObjects();
  pressedKeys.left = false;
  pressedKeys.right = false;
  screenShakeTime = 0;
  screenShakeIntensity = 0;

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Make sure best score is synchronized
  checkAndUpdateBestScore();

  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  finalScoreDisplay.textContent = score;
  updateStatsUI();

  gameOverScreen.classList.remove('hidden');

  speakVoice("Better luck next time", { rate: 0.95, pitch: 0.95 });

  renderGame();
}

// Initial draw & stats update on load
updateStatsUI();
renderGame();
