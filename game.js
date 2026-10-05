const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const scoreDisplay = document.getElementById('scoreDisplay');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const clearHighScoreButton = document.getElementById('clearHighScoreButton');
const finalScoreDisplay = document.getElementById('finalScoreDisplay');
const finalHighScoreDisplay = document.getElementById('finalHighScoreDisplay');
const newHighScoreText = document.getElementById('newHighScoreText');

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const GROUND_Y = 190;

const INITIAL_SPEED = 5;
const MAX_SPEED = 30;
const ACCELERATION = 0.7;

const MIN_DAY_NIGHT_INTERVAL = 15;
const MAX_DAY_NIGHT_INTERVAL = 30;
const DAY_NIGHT_TRANSITION_SPEED = 0.5;

const OBSTACLE_TYPES = {
  CACTUS: 'cactus',
  BIRD: 'bird'
};

const POWERUP_TYPES = {
  GUN: 'gun',
  MAGNET: 'magnet',
  SHIELD: 'shield',
  INVINCIBLE: 'invincible'
};

const BIRD_HEIGHTS = [80, 120, 160];
const BIRD_UNLOCK_SCORE = 300;
const SPEED_MILESTONES = [6, 8, 10, 12, 14];
const MILESTONE_MESSAGE_DURATION = 1500;
const MIN_OBSTACLE_GAP = 360;

const HIGH_SCORE_KEY = 'dinoGameHighScore';

const PLAYER_SIZE = {
  width: 42,
  height: 42
};

const player = {
  x: 80,
  y: GROUND_Y - PLAYER_SIZE.height,
  width: PLAYER_SIZE.width,
  height: PLAYER_SIZE.height,
  velocityY: 0,
  gravity: 2200,
  jumpPower: -760,
  grounded: true,
  shieldTimer: 0,
  magnetTimer: 0,
  invincibleTimer: 0,
  gunTimer: 0,
  weaponCooldown: 0
};

let gameState = 'ready';
let score = 0;
let highScore = 0;
let gameSpeed = INITIAL_SPEED;
let speedBoost = 0;
let lastTime = 0;
let spawnTimer = 1.2;
let powerUpSpawnTimer = 8;
let obstacles = [];
let powerUps = [];
let groundX = 0;
let isNight = false;
let dayNightTimer = 0;
let nextDayNightChange = 0;
let dayNightProgress = 0;
let reachedMilestones = [];
let milestoneMessage = '';
let milestoneExpiryTime = 0;
let runCycle = 0;
let stars = [];
let clouds = [];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatScore(value) {
  return String(Math.floor(value)).padStart(6, '0');
}

function getRandomDayNightInterval() {
  return MIN_DAY_NIGHT_INTERVAL + Math.random() * (MAX_DAY_NIGHT_INTERVAL - MIN_DAY_NIGHT_INTERVAL);
}

function mixColors(colorA, colorB, amount) {
  const hexA = colorA.replace('#', '');
  const hexB = colorB.replace('#', '');

  const a = [
    parseInt(hexA.slice(0, 2), 16),
    parseInt(hexA.slice(2, 4), 16),
    parseInt(hexA.slice(4, 6), 16)
  ];

  const b = [
    parseInt(hexB.slice(0, 2), 16),
    parseInt(hexB.slice(2, 4), 16),
    parseInt(hexB.slice(4, 6), 16)
  ];

  const mixed = a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function createStars() {
  stars = [];
  for (let i = 0; i < 60; i += 1) {
    stars.push({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * 110 + 14,
      size: Math.random() * 2.6 + 1.2,
      brightness: Math.random() * 0.7 + 0.3
    });
  }
}

function createClouds() {
  clouds = [];
  for (let i = 0; i < 7; i += 1) {
    clouds.push({
      x: Math.random() * GAME_WIDTH,
      y: 20 + Math.random() * 80,
      width: 42 + Math.random() * 36,
      height: 18 + Math.random() * 12,
      speed: 18 + Math.random() * 14
    });
  }
}

function loadHighScore() {
  const saved = Number(localStorage.getItem(HIGH_SCORE_KEY));
  highScore = Number.isFinite(saved) ? saved : 0;
}

function saveHighScore() {
  localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
}

function updateHighScoreUI() {
  highScoreDisplay.textContent = formatScore(highScore);
  finalHighScoreDisplay.textContent = formatScore(highScore);
}

function resetPlayer() {
  player.x = 80;
  player.y = GROUND_Y - player.height;
  player.velocityY = 0;
  player.grounded = true;
  player.shieldTimer = 0;
  player.magnetTimer = 0;
  player.invincibleTimer = 0;
  player.gunTimer = 0;
  player.weaponCooldown = 0;
}

function toggleDayNight() {
  isNight = !isNight;
  dayNightTimer = 0;
  nextDayNightChange = getRandomDayNightInterval();
}

function updateDayNight(deltaTime) {
  dayNightTimer += deltaTime;

  if (dayNightTimer >= nextDayNightChange) {
    toggleDayNight();
  }

  if (isNight) {
    dayNightProgress = clamp(dayNightProgress + deltaTime * DAY_NIGHT_TRANSITION_SPEED, 0, 1);
  } else {
    dayNightProgress = clamp(dayNightProgress - deltaTime * DAY_NIGHT_TRANSITION_SPEED, 0, 1);
  }
}

function drawSky() {
  const dayColor = '#dfeef8';
  const duskColor = '#b9c7d9';
  const nightColor = '#0c1735';
  const fillColor = mixColors(dayColor, nightColor, dayNightProgress);
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, mixColors('#eaf5ff', '#1c2b4d', dayNightProgress));
  gradient.addColorStop(1, mixColors('#dfeef8', '#0f1832', dayNightProgress));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawStars() {
  const starAlpha = clamp(dayNightProgress, 0, 1);
  if (starAlpha <= 0.05) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = starAlpha;
  ctx.fillStyle = '#f4f8ff';

  for (const star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMoon() {
  const alpha = clamp(dayNightProgress, 0, 1);
  if (alpha <= 0.02) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#f8f7d7';
  ctx.beginPath();
  ctx.arc(780, 52, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = mixColors('#f8f7d7', '#dfeef8', 0.5);
  ctx.beginPath();
  ctx.arc(786, 48, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClouds() {
  const cloudAlpha = 1 - dayNightProgress * 0.8;
  ctx.save();
  ctx.globalAlpha = clamp(cloudAlpha, 0.1, 1);
  ctx.fillStyle = '#ffffff';

  for (const cloud of clouds) {
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.height * 0.5, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.width * 0.3, cloud.y - 8, cloud.height * 0.6, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.width * 0.6, cloud.y, cloud.height * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function updateClouds(deltaTime) {
  for (const cloud of clouds) {
    cloud.x -= (gameSpeed * 14 + cloud.speed) * deltaTime;
    if (cloud.x < -80) {
      cloud.x = GAME_WIDTH + 40;
      cloud.y = 18 + Math.random() * 90;
    }
  }
}

function drawGround() {
  const groundColor = mixColors('#d4d5a3', '#1b2438', dayNightProgress);
  const lineColor = mixColors('#70705f', '#d7d7d9', dayNightProgress);

  ctx.fillStyle = groundColor;
  ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

  ctx.fillStyle = lineColor;
  ctx.fillRect(0, GROUND_Y + 18, GAME_WIDTH, 4);

  const segmentWidth = 24;
  const startX = groundX % segmentWidth;

  for (let x = -segmentWidth; x < GAME_WIDTH + segmentWidth; x += segmentWidth) {
    ctx.fillStyle = mixColors('#808060', '#a4a4b0', dayNightProgress);
    ctx.fillRect(startX + x, GROUND_Y + 18, 12, 7);
    ctx.fillStyle = mixColors('#4d4d4d', '#d7d7d7', dayNightProgress);
    ctx.fillRect(startX + x + 12, GROUND_Y + 18, 10, 7);
  }
}

function updateGround(deltaTime) {
  groundX -= (gameSpeed * 38) * deltaTime;
  if (groundX <= -24) {
    groundX = 0;
  }
}

function drawDino() {
  const bodyAlpha = 1;
  const dinoColor = isNight ? '#f5f7ff' : '#222222';
  const eyeColor = isNight ? '#0b1020' : '#ffffff';
  const legColor = isNight ? '#dce8ff' : '#333333';
  const stride = player.grounded ? Math.sin(runCycle) * 5 : 0;

  ctx.save();
  ctx.globalAlpha = bodyAlpha;
  ctx.fillStyle = dinoColor;

  const x = player.x;
  const y = player.y;

  ctx.fillRect(x + 10, y + 8, 18, 18);
  ctx.fillRect(x + 28, y + 8, 12, 14);
  ctx.fillRect(x + 2, y + 18, 30, 18);
  ctx.fillRect(x + 20, y + 22, 20, 14);
  ctx.fillRect(x + 12, y + 30, 12, 12);
  ctx.fillRect(x + 24, y + 30, 12, 12);
  ctx.fillRect(x + 0, y + 18, 8, 18);

  ctx.fillStyle = legColor;
  ctx.fillRect(x + 12, y + 40 + stride, 8, 12);
  ctx.fillRect(x + 28, y + 40 - stride, 8, 12);

  ctx.fillStyle = eyeColor;
  ctx.fillRect(x + 30, y + 12, 4, 4);

  ctx.fillStyle = dinoColor;
  ctx.fillRect(x + 35, y + 18, 9, 6);
  ctx.fillRect(x + 0, y + 25, 6, 10);

  ctx.restore();
}

function drawCactus(obstacle) {
  const cactusColor = isNight ? '#dce1f0' : '#2e2e2e';
  const shadowColor = isNight ? '#a8b1c7' : '#4d4d4d';

  ctx.fillStyle = cactusColor;
  ctx.fillRect(obstacle.x + 8, obstacle.y + 14, 14, obstacle.height - 14);
  ctx.fillRect(obstacle.x + 22, obstacle.y + 6, 12, obstacle.height - 6);
  ctx.fillRect(obstacle.x + 4, obstacle.y + 28, 18, 12);
  ctx.fillRect(obstacle.x + 22, obstacle.y + 28, 18, 12);

  ctx.fillStyle = shadowColor;
  ctx.fillRect(obstacle.x + 8, obstacle.y + 8, 6, 6);
  ctx.fillRect(obstacle.x + 24, obstacle.y + 2, 6, 6);
}

function drawBird(obstacle) {
  const wingFrame = obstacle.animationFrame;
  const bodyColor = isNight ? '#f5f7ff' : '#2a2a2a';
  const accentColor = isNight ? '#c9d7ff' : '#505050';

  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.lineTo(12, 8);
  ctx.lineTo(28, 10);
  ctx.lineTo(36, 15);
  ctx.lineTo(24, 20);
  ctx.lineTo(8, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = accentColor;
  if (wingFrame === 0) {
    ctx.beginPath();
    ctx.moveTo(10, 15);
    ctx.lineTo(22, 8);
    ctx.lineTo(28, 15);
    ctx.lineTo(18, 18);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(10, 15);
    ctx.lineTo(22, 21);
    ctx.lineTo(30, 15);
    ctx.lineTo(18, 12);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = isNight ? '#101821' : '#efefef';
  ctx.fillRect(30, 12, 4, 3);

  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of obstacles) {
    if (obstacle.type === OBSTACLE_TYPES.CACTUS) {
      drawCactus(obstacle);
    } else {
      drawBird(obstacle);
    }
  }
}

function drawPlayer() {
  drawDino();

  if (player.shieldTimer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(88, 202, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (player.invincibleTimer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 220, 84, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPowerUps() {
  for (const powerUp of powerUps) {
    const colors = {
      [POWERUP_TYPES.GUN]: '#ef4f4f',
      [POWERUP_TYPES.MAGNET]: '#4da3ff',
      [POWERUP_TYPES.SHIELD]: '#52d39a',
      [POWERUP_TYPES.INVINCIBLE]: '#ffd76a'
    };

    const labelMap = {
      [POWERUP_TYPES.GUN]: 'G',
      [POWERUP_TYPES.MAGNET]: 'M',
      [POWERUP_TYPES.SHIELD]: 'S',
      [POWERUP_TYPES.INVINCIBLE]: '★'
    };

    const x = powerUp.x;
    const y = powerUp.y;
    const size = powerUp.size;

    ctx.save();
    ctx.fillStyle = colors[powerUp.type];
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelMap[powerUp.type], x + size / 2, y + size / 2 + 1);
    ctx.restore();
  }
}

function drawScore() {
  ctx.save();
  ctx.fillStyle = isNight ? 'rgba(255,255,255,0.9)' : 'rgba(30,30,30,0.9)';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(`Score: ${formatScore(score)}`, 22, 26);
  ctx.fillText(`Speed: ${gameSpeed.toFixed(2)}`, 22, 52);
  ctx.restore();
}

function drawMilestoneMessage() {
  if (!milestoneMessage) {
    return;
  }

  const now = performance.now();
  if (now > milestoneExpiryTime) {
    milestoneMessage = '';
    return;
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = isNight ? 'rgba(255,255,255,0.95)' : 'rgba(35,35,35,0.9)';
  ctx.font = 'bold 26px Arial';
  ctx.fillText('SPEED UP!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8);
  ctx.font = 'bold 18px Arial';
  ctx.fillText(`Speed Lv.${reachedMilestones.length}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22);
  ctx.restore();
}
function spawnPowerUp() {
  const pick = Object.values(POWERUP_TYPES);
  const type = pick[Math.floor(Math.random() * pick.length)];

  powerUps.push({
    type,
    x: GAME_WIDTH + 30,
    y: GROUND_Y - 56 - Math.random() * 60,
    size: 18
  });
}

function activatePowerUp(type) {
  if (type === POWERUP_TYPES.SHIELD) {
    player.shieldTimer = 7;
  }
  if (type === POWERUP_TYPES.MAGNET) {
    player.magnetTimer = 8;
  }
  if (type === POWERUP_TYPES.INVINCIBLE) {
    player.invincibleTimer = 7;
  }
  if (type === POWERUP_TYPES.GUN) {
    player.gunTimer = 8;
  }

  score += 50;
}

function updatePowerUps(deltaTime) {
  for (let i = powerUps.length - 1; i >= 0; i -= 1) {
    const powerUp = powerUps[i];
    powerUp.x -= gameSpeed * 38 * deltaTime;

    if (powerUp.x + powerUp.size < 0) {
      powerUps.splice(i, 1);
      continue;
    }

    const hitBox = {
      x: powerUp.x,
      y: powerUp.y,
      width: powerUp.size,
      height: powerUp.size
    };

    const playerBox = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height
    };

    if (rectsIntersect(playerBox, hitBox)) {
      activatePowerUp(powerUp.type);
      powerUps.splice(i, 1);
    }
  }
}

function fireGun() {
  if (player.weaponCooldown > 0) {
    return;
  }

  let targetIndex = -1;
  for (let i = 0; i < obstacles.length; i += 1) {
    if (obstacles[i].x > player.x + 20) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex >= 0) {
    obstacles.splice(targetIndex, 1);
    player.weaponCooldown = 0.45;
    score += 25;
  }
}
function spawnObstacle() {
  const lastObstacle = obstacles[obstacles.length - 1];
  const minGap = Math.max(MIN_OBSTACLE_GAP, 420 - (gameSpeed - INITIAL_SPEED) * 18);

  if (lastObstacle && lastObstacle.x > GAME_WIDTH - minGap) {
    return;
  }

  const shouldSpawnBird = score >= BIRD_UNLOCK_SCORE && Math.random() < 0.42;
  const obstacleType = shouldSpawnBird ? OBSTACLE_TYPES.BIRD : OBSTACLE_TYPES.CACTUS;

  const obstacle = {
    type: obstacleType,
    x: GAME_WIDTH + 30,
    y: 0,
    width: 0,
    height: 0,
    animationTime: 0,
    animationFrame: 0
  };

  if (obstacleType === OBSTACLE_TYPES.CACTUS) {
    obstacle.width = 30 + Math.random() * 18;
    obstacle.height = 34 + Math.random() * 26;
    obstacle.y = GROUND_Y - obstacle.height + 4;
  } else {
    const birdHeight = BIRD_HEIGHTS[Math.floor(Math.random() * BIRD_HEIGHTS.length)];
    obstacle.width = 42;
    obstacle.height = 28;
    obstacle.y = GROUND_Y - birdHeight - 8;
    obstacle.animationFrame = Math.random() > 0.5 ? 1 : 0;
  }

  obstacles.push(obstacle);
}

function updateObstacles(deltaTime) {
  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i];
    obstacle.x -= (gameSpeed * 34 + (obstacle.type === OBSTACLE_TYPES.BIRD ? 8 : 0)) * deltaTime;

    if (obstacle.type === OBSTACLE_TYPES.BIRD) {
      obstacle.animationTime += deltaTime;
      if (obstacle.animationTime >= 0.12) {
        obstacle.animationFrame = obstacle.animationFrame === 0 ? 1 : 0;
        obstacle.animationTime = 0;
      }
    }

    if (obstacle.x + obstacle.width < -10) {
      obstacles.splice(i, 1);
    }
  }
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function checkCollision() {
  const playerBox = {
    x: player.x + 5,
    y: player.y + 4,
    width: player.width - 10,
    height: player.height - 6
  };

  for (const obstacle of obstacles) {
    const obstacleBox = {
      x: obstacle.x + 4,
      y: obstacle.y + 4,
      width: Math.max(obstacle.width - 8, 12),
      height: Math.max(obstacle.height - 8, 10)
    };

    if (rectsIntersect(playerBox, obstacleBox)) {
      if (player.shieldTimer > 0) {
        player.shieldTimer = 0;
        obstacles.splice(obstacles.indexOf(obstacle), 1);
        score += 30;
        return;
      }

      if (player.invincibleTimer > 0) {
        obstacles.splice(obstacles.indexOf(obstacle), 1);
        score += 30;
        return;
      }

      gameOver();
      return;
    }
  }
}

function updateScore(deltaTime) {
  score += deltaTime * 10;
  speedBoost += deltaTime * ACCELERATION;
  gameSpeed = clamp(INITIAL_SPEED + speedBoost, INITIAL_SPEED, MAX_SPEED);

  player.shieldTimer = Math.max(0, player.shieldTimer - deltaTime);
  player.magnetTimer = Math.max(0, player.magnetTimer - deltaTime);
  player.invincibleTimer = Math.max(0, player.invincibleTimer - deltaTime);
  player.gunTimer = Math.max(0, player.gunTimer - deltaTime);
  player.weaponCooldown = Math.max(0, player.weaponCooldown - deltaTime);

  if (player.gunTimer > 0) {
    fireGun();
  }

  if (player.magnetTimer > 0) {
    for (const obstacle of obstacles) {
      if (obstacle.x > player.x - 120 && obstacle.x < player.x + 260) {
        obstacle.x -= deltaTime * 180;
      }
    }
  }

  scoreDisplay.textContent = formatScore(score);
}

function checkSpeedMilestone() {
  for (const milestone of SPEED_MILESTONES) {
    if (!reachedMilestones.includes(milestone) && gameSpeed >= milestone) {
      reachedMilestones.push(milestone);
      milestoneMessage = 'SPEED UP!';
      milestoneExpiryTime = performance.now() + MILESTONE_MESSAGE_DURATION;
      break;
    }
  }
}

function updatePlayer(deltaTime) {
  player.velocityY += player.gravity * deltaTime;
  player.y += player.velocityY * deltaTime;

  if (player.y + player.height >= GROUND_Y) {
    player.y = GROUND_Y - player.height;
    player.velocityY = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
}

function handleJump() {
  if (gameState === 'ready') {
    startGame();
    return;
  }

  if (gameState === 'gameover') {
    startGame();
    return;
  }

  if (gameState === 'playing' && player.grounded) {
    player.velocityY = player.jumpPower;
    player.grounded = false;
  }
}

function showStartOverlay() {
  startOverlay.classList.remove('hidden');
  startOverlay.classList.add('visible');
  gameOverOverlay.classList.add('hidden');
  gameOverOverlay.classList.remove('visible');
}

function hideStartOverlay() {
  startOverlay.classList.add('hidden');
  startOverlay.classList.remove('visible');
}

function showGameOverOverlay() {
  hideStartOverlay();
  gameOverOverlay.classList.remove('hidden');
  gameOverOverlay.classList.add('visible');
}

function updateGameOverUI() {
  finalScoreDisplay.textContent = formatScore(score);
  finalHighScoreDisplay.textContent = formatScore(highScore);

  const isNewRecord = score > (Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0);
  newHighScoreText.classList.toggle('hidden', !isNewRecord);
}

function gameOver() {
  if (gameState === 'gameover') {
    return;
  }

  gameState = 'gameover';

  const previousHighScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  if (score > previousHighScore) {
    highScore = Math.floor(score);
    saveHighScore();
  } else {
    highScore = previousHighScore;
  }

  updateHighScoreUI();
  updateGameOverUI();
  showGameOverOverlay();
}

function resetGame() {
  gameState = 'ready';
  score = 0;
  gameSpeed = INITIAL_SPEED;
  speedBoost = 0;
  obstacles = [];
  powerUps = [];
  powerUpSpawnTimer = 8;
  spawnTimer = 1.2;
  groundX = 0;
  reachedMilestones = [];
  milestoneMessage = '';
  milestoneExpiryTime = 0;
  runCycle = 0;
  isNight = false;
  dayNightTimer = 0;
  nextDayNightChange = getRandomDayNightInterval();
  dayNightProgress = 0;
  resetPlayer();
  scoreDisplay.textContent = formatScore(score);
  updateHighScoreUI();
  showStartOverlay();
}

function startGame() {
  resetGame();
  gameState = 'playing';
  hideStartOverlay();
  gameOverOverlay.classList.add('hidden');
  gameOverOverlay.classList.remove('visible');
}

function update(deltaTime) {
  runCycle += deltaTime * (gameSpeed * 2.2);

  updateGround(deltaTime);
  updateClouds(deltaTime);
  updateDayNight(deltaTime);
  updatePlayer(deltaTime);
  updateScore(deltaTime);
  checkSpeedMilestone();

  powerUpSpawnTimer -= deltaTime;
  if (powerUpSpawnTimer <= 0) {
    spawnPowerUp();
    powerUpSpawnTimer = 5 + Math.random() * 5;
  }

  spawnTimer -= deltaTime;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = Math.max(0.9, 1.8 - (gameSpeed - INITIAL_SPEED) * 0.07) + Math.random() * 0.55;
  }

  updateObstacles(deltaTime);
  updatePowerUps(deltaTime);
  checkCollision();
}

function drawBackground() {
  drawSky();
  drawStars();
  drawMoon();
  drawClouds();
}

function draw() {
  drawBackground();
  drawGround();
  drawPowerUps();
  drawObstacles();
  drawPlayer();
  drawScore();
  drawMilestoneMessage();
}

function gameLoop(currentTime) {
  const deltaTime = clamp((currentTime - lastTime) / 1000, 0, 0.033);
  lastTime = currentTime;

  if (gameState === 'playing') {
    update(deltaTime);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function handlePointerDown(event) {
  if (event.target.closest('button')) {
    return;
  }

  if (gameState === 'ready') {
    startGame();
    return;
  }

  if (gameState === 'gameover') {
    startGame();
    return;
  }

  handleJump();
}

function bindEvents() {
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      if (gameState === 'ready' || gameState === 'gameover') {
        startGame();
      } else if (gameState === 'playing') {
        handleJump();
      }
    }
  });

  startButton.addEventListener('click', () => {
    startGame();
  });

  restartButton.addEventListener('click', () => {
    startGame();
  });

  canvas.addEventListener('pointerdown', handlePointerDown);

  clearHighScoreButton.addEventListener('click', () => {
    const confirmed = window.confirm('確定要清除最高分嗎？');
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(HIGH_SCORE_KEY);
    highScore = 0;
    updateHighScoreUI();
    updateGameOverUI();
  });
}

function initGame() {
  loadHighScore();
  createStars();
  createClouds();
  resetGame();
  bindEvents();
  updateHighScoreUI();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

initGame();
