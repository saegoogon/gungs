const API = {
  csrfToken: "",
  async request(path, options = {}) {
    const method = options.method || "GET";
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(method !== "GET" && API.csrfToken ? { "X-CSRF-Token": API.csrfToken } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    if (payload.csrfToken) {
      API.csrfToken = payload.csrfToken;
    }
    return payload;
  },
};

const TICK_MS = 1000;
const SAVE_INTERVAL_MS = 10000;
const RARITIES = ["COMMON", "RARE", "EPIC", "LEGEND", "RELIC"];
const RARITY_KEYS = ["common", "rare", "epic", "legend", "relic"];
const AFFIXES = [
  ["damageFlat", "forge damage", "flat", 4, 18, 1.1],
  ["damagePercent", "strip damage", "percent", 3, 12, 0.85],
  ["scrapFlat", "scrap pulse", "flat", 1, 6, 0.42],
  ["scrapPercent", "scrap yield", "percent", 4, 16, 0.8],
  ["creditFlat", "credit leak", "flat", 1, 5, 0.35],
  ["shardLuck", "shard chance", "percent", 2, 10, 0.55],
  ["heatGuard", "heat guard", "percent", 4, 14, 0.7],
];
const PREFIXES = ["Void", "Hex", "Ruin", "Night", "Cinder", "Black", "Ghost", "Shard", "Abyss"];
const SUFFIXES = ["Edge", "Spine", "Fang", "Howl", "Needle", "Breaker", "Reaper", "Circuit", "Maw"];

const upgrades = [
  { id: "drill", title: "Seed Injector", costBase: 25, growth: 1.6, description: "Raises random enhance output and direct strip damage." },
  { id: "crew", title: "Scrap Runners", costBase: 45, growth: 1.7, description: "Boosts passive scrap income from off-grid workers." },
  { id: "forge", title: "Blackforge Loop", costBase: 70, growth: 1.8, description: "Adds heavy pressure to the core enhancement stack." },
  { id: "scanner", title: "Trace Scanner", costBase: 90, growth: 1.95, description: "Improves cursed shard drops and dragon trail rewards." },
];

const labUpgrades = [
  { id: "overclock", title: "Heat Overclock", costBase: 150, growth: 2, description: "Amplifies all strip damage through unstable tuning." },
  { id: "logistics", title: "Ghost Logistics", costBase: 180, growth: 2.05, description: "Increases passive scrap flow through hidden routes." },
  { id: "luck", title: "Black Signal", costBase: 220, growth: 2.15, description: "Raises shard luck and rare board reward frequency." },
];

const skinCatalog = [
  { id: "default", name: "Rust Default", description: "The base loadout every new handle starts with." },
  { id: "founder-gold", name: "Founder Gold", description: "Reserved skin for future premium buyers." },
];

const state = {
  profile: null,
  paymentProvider: "coming soon",
  paymentEnabled: false,
  soundEnabled: true,
  audioContext: null,
  musicTimer: null,
  musicStep: 0,
};

const elements = {
  authModal: document.querySelector("#auth-modal"),
  authStatus: document.querySelector("#auth-status"),
  usernameInput: document.querySelector("#username-input"),
  registerButton: document.querySelector("#register-button"),
  loginButton: document.querySelector("#login-button"),
  usernameLabel: document.querySelector("#username-label"),
  premiumGems: document.querySelector("#premium-gems"),
  soundButton: document.querySelector("#sound-button"),
  saveButton: document.querySelector("#save-button"),
  mineButton: document.querySelector("#mine-button"),
  mineButtonMobile: document.querySelector("#mine-button-mobile"),
  fightButton: document.querySelector("#fight-button"),
  fightButtonMobile: document.querySelector("#fight-button-mobile"),
  bossButton: document.querySelector("#boss-button"),
  bossButtonMobile: document.querySelector("#boss-button-mobile"),
  heroTitle: document.querySelector("#hero-title"),
  heroCopy: document.querySelector("#hero-copy"),
  syncBadge: document.querySelector("#sync-badge"),
  syncText: document.querySelector("#sync-text"),
  offlineLabel: document.querySelector("#offline-label"),
  paymentProvider: document.querySelector("#payment-provider"),
  goldStat: document.querySelector("#gold-stat"),
  oreStat: document.querySelector("#ore-stat"),
  crystalStat: document.querySelector("#crystal-stat"),
  coreStat: document.querySelector("#core-stat"),
  powerStat: document.querySelector("#power-stat"),
  oreRateStat: document.querySelector("#ore-rate-stat"),
  bossFloorBadge: document.querySelector("#boss-floor-badge"),
  bossName: document.querySelector("#boss-name"),
  bossHealthFill: document.querySelector("#boss-health-fill"),
  bossHealthText: document.querySelector("#boss-health-text"),
  combatText: document.querySelector("#combat-text"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  upgradeList: document.querySelector("#upgrade-list"),
  labList: document.querySelector("#lab-list"),
  questList: document.querySelector("#quest-list"),
  storeList: document.querySelector("#store-list"),
  skinList: document.querySelector("#skin-list"),
  logList: document.querySelector("#log-list"),
  impactLayer: document.querySelector("#impact-layer"),
  weaponCard: document.querySelector(".weapon-card"),
  weaponName: document.querySelector("#weapon-name"),
  weaponRarity: document.querySelector("#weapon-rarity"),
  weaponChance: document.querySelector("#weapon-chance"),
  weaponHeat: document.querySelector("#weapon-heat"),
  weaponOptions: document.querySelector("#weapon-options"),
};

const number = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: value > 100 ? 0 : 1 }).format(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const choice = (list) => list[Math.floor(Math.random() * list.length)];
const getGameState = () => state.profile?.gameState;

function createDefaultWeapon() {
  return {
    name: "Void Edge",
    tier: 0,
    rarityIndex: 0,
    heat: 0,
    failStack: 0,
    successChance: 0.92,
    highestTier: 0,
    options: [
      { key: "damageFlat", label: "forge damage", value: 4, type: "flat", text: "+4 forge damage" },
      { key: "scrapFlat", label: "scrap pulse", value: 1, type: "flat", text: "+1 scrap pulse" },
    ],
  };
}

function pushLog(text) {
  const gameState = getGameState();
  if (!gameState) return;
  gameState.logs.unshift({ id: `${Date.now()}-${Math.random()}`, text: String(text).slice(0, 180) });
  gameState.logs = gameState.logs.slice(0, 24);
}

function affixText(option) {
  return `+${number(option.value)}${option.type === "percent" ? "%" : ""} ${option.label}`;
}

function optionTotal(gameState, key) {
  return (gameState.weapon?.options || []).filter((option) => option.key === key).reduce((sum, option) => sum + Number(option.value || 0), 0);
}

function enhanceChance(gameState) {
  const { weapon, lab, upgrades: gameUpgrades, resources } = gameState;
  return clamp(0.94 - weapon.tier * 0.048 - weapon.heat * 0.0025 + lab.luck * 0.007 + gameUpgrades.scanner * 0.003 + resources.cores * 0.004 + weapon.failStack * 0.03, 0.22, 0.95);
}

function rollRarity(gameState) {
  const roll = Math.random() + gameState.weapon.tier * 0.02 + (gameState.lab.luck + gameState.resources.cores) * 0.01;
  if (roll > 1.72) return 4;
  if (roll > 1.38) return 3;
  if (roll > 1.02) return 2;
  if (roll > 0.72) return 1;
  return 0;
}

function rollOptions(gameState, rarityIndex, tier) {
  const count = clamp(2 + Math.floor(rarityIndex / 2) + Math.floor(tier / 12), 2, 5);
  const picked = new Set();
  const output = [];
  while (output.length < count) {
    const [key, label, type, min, max, scale] = choice(AFFIXES);
    if (picked.has(key)) continue;
    picked.add(key);
    const raw = min + Math.random() * (max - min) + tier * scale + rarityIndex * scale * 1.6;
    const value = type === "percent" ? Number(raw.toFixed(1)) : Math.max(1, Math.round(raw));
    output.push({ key, label, value, type, text: affixText({ label, value, type }) });
  }
  return output;
}

function ensureGameStateShape(gameState) {
  if (!gameState) return null;
  gameState.logs = Array.isArray(gameState.logs) ? gameState.logs : [];
  gameState.resources = { gold: 0, ore: 0, crystals: 0, cores: 0, premiumGems: 0, ...(gameState.resources || {}) };
  gameState.progression = { depth: 1, kills: 0, bossFloor: 10, ascensions: 0, ...(gameState.progression || {}) };
  gameState.upgrades = { drill: 0, crew: 0, forge: 0, scanner: 0, ...(gameState.upgrades || {}) };
  gameState.lab = { overclock: 0, logistics: 0, luck: 0, ...(gameState.lab || {}) };
  gameState.cosmetics = { activeSkin: "default", ownedSkins: ["default"], ...(gameState.cosmetics || {}) };
  gameState.stats = { oreMined: 0, damageDealt: 0, sessions: 1, enhances: 0, fails: 0, ...(gameState.stats || {}) };
  gameState.weapon = { ...createDefaultWeapon(), ...(gameState.weapon || {}) };
  if (!Array.isArray(gameState.weapon.options) || !gameState.weapon.options.length) gameState.weapon.options = createDefaultWeapon().options;
  gameState.weapon.tier = Math.max(0, Math.floor(gameState.weapon.tier || 0));
  gameState.weapon.rarityIndex = clamp(Math.floor(gameState.weapon.rarityIndex || 0), 0, 4);
  gameState.weapon.heat = clamp(Math.floor(gameState.weapon.heat || 0), 0, 100);
  gameState.weapon.failStack = clamp(Math.floor(gameState.weapon.failStack || 0), 0, 6);
  gameState.weapon.highestTier = Math.max(gameState.weapon.highestTier || 0, gameState.weapon.tier);
  gameState.weapon.successChance = enhanceChance(gameState);
  return gameState;
}

function ensureAudioContext() {
  if (!state.soundEnabled) return null;
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    state.audioContext = new AudioContextClass();
  }
  if (state.audioContext.state === "suspended") state.audioContext.resume();
  return state.audioContext;
}

function tone(ctx, freq, duration, gainValue, type, when) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.03);
}

function startMusic() {
  const ctx = ensureAudioContext();
  if (!ctx || state.musicTimer) return;
  const progression = [[110, 165], [98, 147], [123, 184], [87, 130]];
  const playStep = () => {
    const [root, second] = progression[state.musicStep % progression.length];
    const now = ctx.currentTime + 0.02;
    tone(ctx, root, 1.6, 0.03, "sine", now);
    tone(ctx, second, 1.2, 0.018, "triangle", now + 0.08);
    tone(ctx, root * 2, 0.22, 0.008, "square", now + 0.32);
    state.musicStep += 1;
  };
  playStep();
  state.musicTimer = window.setInterval(playStep, 1800);
}

function stopMusic() {
  if (state.musicTimer) {
    clearInterval(state.musicTimer);
    state.musicTimer = null;
  }
}

function playSound(type) {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  startMusic();
  const now = ctx.currentTime;
  if (type === "enhance") {
    tone(ctx, 520, 0.16, 0.09, "triangle", now);
    tone(ctx, 730, 0.18, 0.04, "sine", now + 0.03);
  } else if (type === "boss") {
    tone(ctx, 180, 0.22, 0.12, "sawtooth", now);
    tone(ctx, 95, 0.26, 0.06, "triangle", now + 0.02);
  } else if (type === "fail") {
    tone(ctx, 240, 0.1, 0.08, "square", now);
    tone(ctx, 130, 0.2, 0.05, "sawtooth", now + 0.03);
  }
}

function spawnFeedback(text, x, y, variant) {
  if (!elements.impactLayer) return;
  const node = document.createElement("div");
  node.className = `floating-feedback ${variant}`;
  node.textContent = text;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  elements.impactLayer.appendChild(node);
  setTimeout(() => node.remove(), 900);
}

function buttonCenter(button) {
  const rect = button.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function shake(target) {
  if (!target) return;
  target.classList.remove("screen-shake");
  void target.offsetWidth;
  target.classList.add("screen-shake");
  setTimeout(() => target.classList.remove("screen-shake"), 260);
}

function flashWeapon(outcome) {
  if (!elements.weaponCard) return;
  elements.weaponCard.classList.remove("success", "fail");
  void elements.weaponCard.offsetWidth;
  elements.weaponCard.classList.add(outcome);
  setTimeout(() => elements.weaponCard.classList.remove(outcome), 360);
}

function calcPower(gameState) {
  const base = 1 + gameState.upgrades.drill * 2 + (4 + gameState.upgrades.forge * 3) + Math.floor(gameState.progression.depth / 2);
  const flat = gameState.weapon.tier * 5 + optionTotal(gameState, "damageFlat");
  const percent = 1 + optionTotal(gameState, "damagePercent") / 100;
  const lab = 1 + gameState.lab.overclock * 0.18;
  const core = 1 + gameState.resources.cores * 0.12;
  return Math.floor((base + flat) * percent * lab * core);
}

function calcOrePerSecond(gameState) {
  const base = gameState.upgrades.crew * 1.8 + gameState.lab.logistics * 1.5 + optionTotal(gameState, "scrapFlat") * 0.35;
  const percent = 1 + optionTotal(gameState, "scrapPercent") / 100;
  return Number((base * percent * (1 + gameState.resources.cores * 0.12)).toFixed(1));
}

function costFor(entry, level) {
  return Math.floor(entry.costBase * entry.growth ** level);
}

function updateQuestProgress(gameState) {
  const mapping = { ore: Math.floor(gameState.stats.oreMined), kills: gameState.progression.kills, depth: gameState.progression.depth };
  gameState.quests = gameState.quests.map((quest) => ({ ...quest, progress: Math.min(quest.goal, mapping[quest.id] ?? quest.progress) }));
}

function passiveTick() {
  const gameState = ensureGameStateShape(getGameState());
  if (!gameState) return;
  const oreRate = calcOrePerSecond(gameState);
  gameState.resources.ore += oreRate;
  gameState.resources.gold += Math.max(1, Math.floor(gameState.progression.depth * 0.35 + gameState.lab.logistics + optionTotal(gameState, "creditFlat") * 0.2));
  gameState.stats.oreMined += oreRate;
  gameState.weapon.heat = Math.max(0, gameState.weapon.heat - 1);
  gameState.weapon.successChance = enhanceChance(gameState);
  updateQuestProgress(gameState);
}

function advanceBossState(gameState) {
  if (gameState.boss.hp > 0) return;
  gameState.resources.gold += Math.floor(80 + gameState.progression.depth * 10 + optionTotal(gameState, "creditFlat"));
  gameState.resources.ore += Math.floor(50 + gameState.progression.depth * 9 + optionTotal(gameState, "scrapFlat"));
  gameState.resources.crystals += 1 + Math.floor(gameState.lab.luck / 2);
  gameState.progression.kills += 1;
  if (gameState.progression.depth >= gameState.progression.bossFloor) {
    gameState.resources.cores += 1;
    gameState.progression.bossFloor += 10;
    pushLog("Dragon target burned out. Void core secured.");
  }
  gameState.progression.depth += 1;
  const nextHp = Math.floor(120 * (1 + (gameState.progression.depth - 1) * 0.22));
  gameState.boss = { name: `Dragon Node ${gameState.progression.depth}`, hp: nextHp, maxHp: nextHp, ready: gameState.progression.depth >= gameState.progression.bossFloor };
  pushLog(`Board rank advanced to forge node ${gameState.progression.depth}.`);
  updateQuestProgress(gameState);
}

function attackBoss(auto = false, sourceButton = elements.fightButton) {
  const gameState = ensureGameStateShape(getGameState());
  if (!gameState) return;
  const damage = calcPower(gameState);
  gameState.boss.hp = Math.max(0, gameState.boss.hp - damage);
  gameState.stats.damageDealt += damage;
  elements.combatText.textContent = auto ? `Auto-strip thread dealt ${number(damage)} damage.` : `Manual strip dealt ${number(damage)} damage.`;
  if (!auto && sourceButton) {
    const point = buttonCenter(sourceButton);
    spawnFeedback(`-${number(damage)}`, point.x, point.y, "hit");
    shake(document.querySelector(".boss-panel"));
    playSound("boss");
  }
  advanceBossState(gameState);
}

function enhanceWeapon(sourceButton = elements.mineButton) {
  const gameState = ensureGameStateShape(getGameState());
  if (!gameState) return;
  const weapon = gameState.weapon;
  const chance = enhanceChance(gameState);
  const scrapGain = Math.max(1, Math.floor((1 + gameState.upgrades.drill + Math.floor(weapon.tier * 0.35) + optionTotal(gameState, "scrapFlat")) * (1 + optionTotal(gameState, "scrapPercent") / 100)));
  const creditGain = Math.max(1, Math.floor(scrapGain * 0.55 + optionTotal(gameState, "creditFlat")));
  const shardChance = 0.04 + gameState.upgrades.scanner * 0.01 + gameState.lab.luck * 0.018 + optionTotal(gameState, "shardLuck") / 100;

  gameState.resources.ore += scrapGain;
  gameState.resources.gold += creditGain;
  gameState.stats.oreMined += scrapGain;
  gameState.stats.enhances += 1;

  if (Math.random() < chance) {
    weapon.tier += 1;
    weapon.highestTier = Math.max(weapon.highestTier, weapon.tier);
    weapon.failStack = 0;
    weapon.heat = clamp(weapon.heat + 8 + Math.floor(weapon.tier * 0.4), 0, 100);
    weapon.rarityIndex = Math.max(weapon.rarityIndex, rollRarity(gameState));
    weapon.options = rollOptions(gameState, weapon.rarityIndex, weapon.tier);
    if (weapon.tier === 1 || weapon.tier % 4 === 0 || Math.random() < 0.18) weapon.name = `${choice(PREFIXES)} ${choice(SUFFIXES)}`;
    if (Math.random() < shardChance) {
      gameState.resources.crystals += 1;
      pushLog("A cursed shard dropped during the enhancement surge.");
    }
    pushLog(`${weapon.name} hit +${weapon.tier} with ${RARITIES[weapon.rarityIndex]} grade.`);
    elements.combatText.textContent = `${weapon.name} enhancement succeeded at +${weapon.tier}.`;
    if (sourceButton) {
      const point = buttonCenter(sourceButton);
      spawnFeedback(`SUCCESS +${weapon.tier}`, point.x, point.y, "mine");
    }
    playSound("enhance");
    flashWeapon("success");
  } else {
    gameState.stats.fails += 1;
    weapon.failStack = clamp(weapon.failStack + 1, 0, 6);
    const protectedFail = Math.random() < optionTotal(gameState, "heatGuard") / 100;
    weapon.heat = clamp(weapon.heat + 14 - Math.round(optionTotal(gameState, "heatGuard") / 10), 0, 100);
    if (!protectedFail && weapon.tier >= 4) {
      weapon.tier = Math.max(0, weapon.tier - (weapon.tier >= 10 ? 2 : 1));
      if (weapon.rarityIndex > 0 && Math.random() < 0.22) weapon.rarityIndex -= 1;
    }
    weapon.options = rollOptions(gameState, weapon.rarityIndex, weapon.tier);
    pushLog(protectedFail ? `${weapon.name} failed, but heat guard held the frame.` : `${weapon.name} failed and dropped to +${weapon.tier}.`);
    elements.combatText.textContent = protectedFail ? "Enhancement failed, but your safety options held the frame together." : "Enhancement failed. The blade glitched and lost stability.";
    if (sourceButton) {
      const point = buttonCenter(sourceButton);
      spawnFeedback("FAIL", point.x, point.y, "hit");
    }
    playSound("fail");
    flashWeapon("fail");
    shake(elements.weaponCard);
  }

  weapon.successChance = enhanceChance(gameState);
  updateQuestProgress(gameState);
  render();
}

function buyUpgrade(id) {
  const gameState = ensureGameStateShape(getGameState());
  const entry = upgrades.find((item) => item.id === id);
  if (!gameState || !entry) return;
  const cost = costFor(entry, gameState.upgrades[id]);
  if (gameState.resources.ore < cost) return;
  gameState.resources.ore -= cost;
  gameState.upgrades[id] += 1;
  pushLog(`${entry.title} reached tier ${gameState.upgrades[id]}.`);
  render();
}

function buyLab(id) {
  const gameState = ensureGameStateShape(getGameState());
  const entry = labUpgrades.find((item) => item.id === id);
  if (!gameState || !entry) return;
  const cost = costFor(entry, gameState.lab[id]);
  if (gameState.resources.gold < cost) return;
  gameState.resources.gold -= cost;
  gameState.lab[id] += 1;
  pushLog(`${entry.title} patch upgraded to tier ${gameState.lab[id]}.`);
  render();
}

async function claimQuest(id) {
  try {
    const payload = await API.request("/api/game/claim-quest", { method: "POST", body: { questId: id } });
    state.profile = payload.profile;
    ensureGameStateShape(getGameState());
    setSync("REWARD CLAIMED", "Server confirmed the board payout.");
    render();
  } catch (error) {
    setSync("CLAIM FAILED", error.message, true);
  }
}

function selectSkin(id) {
  const gameState = ensureGameStateShape(getGameState());
  if (!gameState || !gameState.cosmetics.ownedSkins.includes(id)) return;
  gameState.cosmetics.activeSkin = id;
  pushLog(`${skinCatalog.find((item) => item.id === id)?.name || id} is now active.`);
  render();
}

function renderList(target, nodes) {
  target.innerHTML = "";
  nodes.forEach((node) => target.appendChild(node));
}

function buildCard({ title, description, meta, buttonLabel, disabled, className = "ghost-button small-button", onClick }) {
  const card = document.createElement("div");
  card.className = "list-item";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.className = "muted-text";
  copy.textContent = description;
  const row = document.createElement("div");
  row.className = "item-row";
  const info = document.createElement("span");
  info.className = "item-meta";
  info.textContent = meta;
  const button = document.createElement("button");
  button.className = className;
  button.textContent = buttonLabel;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  row.append(info, button);
  card.append(heading, copy, row);
  return card;
}

function createLogNode(entry) {
  const node = document.createElement("div");
  node.className = "log-entry";
  const strong = document.createElement("strong");
  strong.textContent = "LOG";
  node.append(strong, document.createTextNode(` ${entry.text}`));
  return node;
}

function createLeaderboardNode(entry, index) {
  const node = document.createElement("div");
  node.className = "list-item";
  const strong = document.createElement("strong");
  strong.textContent = `#${index + 1} ${entry.username}`;
  const meta = document.createElement("span");
  meta.className = "item-meta";
  meta.textContent = `Node ${entry.depth} | Power ${number(entry.power)}`;
  node.append(strong, meta);
  return node;
}

function renderWeapon(gameState) {
  const weapon = gameState.weapon;
  elements.weaponCard.dataset.rarity = RARITY_KEYS[weapon.rarityIndex];
  elements.weaponRarity.textContent = RARITIES[weapon.rarityIndex];
  elements.weaponName.textContent = `${weapon.name.toUpperCase()} // +${weapon.tier}`;
  elements.weaponChance.textContent = `RATE ${Math.round(weapon.successChance * 100)}%`;
  elements.weaponHeat.textContent = weapon.heat >= 75 ? "HEAT CRITICAL" : weapon.heat >= 45 ? "HEAT HIGH" : weapon.heat >= 20 ? "HEAT WARM" : "HEAT LOW";
  elements.weaponOptions.innerHTML = "";
  weapon.options.forEach((option) => {
    const span = document.createElement("span");
    span.className = "weapon-option";
    span.textContent = option.text;
    elements.weaponOptions.appendChild(span);
  });
}

function render() {
  if (!state.profile) return;
  const gameState = ensureGameStateShape(getGameState());
  updateQuestProgress(gameState);
  elements.authModal.classList.remove("visible");
  elements.usernameLabel.textContent = state.profile.username;
  elements.premiumGems.textContent = number(gameState.resources.premiumGems);
  elements.heroTitle.textContent = `${gameState.weapon.name} +${gameState.weapon.tier}`;
  elements.heroCopy.textContent = `${RARITIES[gameState.weapon.rarityIndex]} loadout active. Highest rank +${gameState.weapon.highestTier}. Failures raise heat, while random options bend scrap, damage, and shard luck.`;
  elements.soundButton.textContent = state.soundEnabled ? "AUDIO ON" : "AUDIO OFF";
  elements.offlineLabel.textContent = new Date(gameState.lastUpdatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  elements.paymentProvider.textContent = state.paymentEnabled ? state.paymentProvider : "coming soon";
  elements.goldStat.textContent = number(gameState.resources.gold);
  elements.oreStat.textContent = number(gameState.resources.ore);
  elements.crystalStat.textContent = number(gameState.resources.crystals);
  elements.coreStat.textContent = number(gameState.resources.cores);
  elements.powerStat.textContent = number(calcPower(gameState));
  elements.oreRateStat.textContent = `${number(calcOrePerSecond(gameState))}/s`;
  elements.bossFloorBadge.textContent = `${gameState.progression.bossFloor}TH NODE`;
  elements.bossName.textContent = gameState.boss.name;
  elements.bossHealthFill.style.width = `${Math.max(0, (gameState.boss.hp / gameState.boss.maxHp) * 100)}%`;
  elements.bossHealthText.textContent = `${number(gameState.boss.hp)} / ${number(gameState.boss.maxHp)}`;
  renderWeapon(gameState);

  renderList(elements.upgradeList, upgrades.map((entry) => buildCard({
    title: entry.title,
    description: entry.description,
    meta: `Lv.${gameState.upgrades[entry.id]} | ${number(costFor(entry, gameState.upgrades[entry.id]))} scrap`,
    buttonLabel: "Enhance",
    disabled: gameState.resources.ore < costFor(entry, gameState.upgrades[entry.id]),
    onClick: () => buyUpgrade(entry.id),
  })));

  renderList(elements.labList, labUpgrades.map((entry) => buildCard({
    title: entry.title,
    description: entry.description,
    meta: `Tier ${gameState.lab[entry.id]} | ${number(costFor(entry, gameState.lab[entry.id]))} credits`,
    buttonLabel: "Patch",
    disabled: gameState.resources.gold < costFor(entry, gameState.lab[entry.id]),
    onClick: () => buyLab(entry.id),
  })));

  renderList(elements.questList, gameState.quests.map((quest) => buildCard({
    title: quest.label,
    description: "Clear the thread target and claim instant board rewards from the server.",
    meta: quest.claimed ? "Claimed" : `${quest.progress} / ${quest.goal}`,
    buttonLabel: quest.claimed ? "Done" : quest.progress >= quest.goal ? "Claim" : "Pending",
    disabled: quest.claimed || quest.progress < quest.goal,
    className: "primary-button small-button",
    onClick: () => claimQuest(quest.id),
  })));

  renderList(elements.storeList, [buildCard({
    title: "Premium thread locked",
    description: "Paid trade will open after business setup and payment activation. For now the board stays free to test.",
    meta: "Free public build",
    buttonLabel: "Locked",
    disabled: true,
    className: "secondary-button small-button",
    onClick: () => {},
  })]);

  renderList(elements.skinList, skinCatalog.map((skin) => buildCard({
    title: skin.name,
    description: skin.description,
    meta: gameState.cosmetics.ownedSkins.includes(skin.id) ? "Owned" : "Locked",
    buttonLabel: gameState.cosmetics.activeSkin === skin.id ? "Active" : "Equip",
    disabled: !gameState.cosmetics.ownedSkins.includes(skin.id) || gameState.cosmetics.activeSkin === skin.id,
    onClick: () => selectSkin(skin.id),
  })));

  renderList(elements.logList, gameState.logs.map(createLogNode));
}

function setSync(title, body, isError = false) {
  elements.syncBadge.textContent = title;
  elements.syncBadge.style.color = isError ? "#ffd2dc" : "";
  elements.syncText.textContent = body;
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  if (!state.soundEnabled) {
    stopMusic();
    if (state.audioContext) state.audioContext.suspend();
  } else {
    ensureAudioContext();
    startMusic();
  }
  render();
}

async function syncToServer() {
  if (!state.profile) return;
  try {
    setSync("SYNCING", "Pushing your current board state to the server.");
    await API.request("/api/game/save", { method: "POST", body: { gameState: getGameState() } });
    setSync("SYNCED", "Server thread is now updated.");
  } catch (error) {
    setSync("SYNC FAILED", error.message, true);
  }
}

async function fetchSession() {
  try {
    const session = await API.request("/api/session");
    state.profile = session.profile;
    ensureGameStateShape(getGameState());
    render();
  } catch {
    elements.authModal.classList.add("visible");
  }
}

async function fetchStore() {
  try {
    const config = await API.request("/api/config");
    state.paymentProvider = config.paymentProvider || "coming soon";
    state.paymentEnabled = Boolean(config.toss?.enabled);
    render();
  } catch (error) {
    setSync("STORE ERROR", error.message, true);
  }
}

async function fetchLeaderboard() {
  try {
    const payload = await API.request("/api/leaderboard");
    renderList(elements.leaderboardList, payload.leaderboard.map(createLeaderboardNode));
  } catch (error) {
    setSync("BOARD ERROR", error.message, true);
  }
}

async function authenticate(mode) {
  const username = elements.usernameInput.value.trim();
  if (username.length < 2) {
    elements.authStatus.textContent = "Handle must be at least 2 characters.";
    return;
  }
  try {
    elements.authStatus.textContent = "Processing handle...";
    const payload = await API.request(`/api/auth/${mode}`, { method: "POST", body: { username } });
    state.profile = payload.profile;
    ensureGameStateShape(getGameState());
    elements.authModal.classList.remove("visible");
    setSync("CONNECTED", `${payload.profile.username} entered the market board.`);
    render();
    fetchStore();
    fetchLeaderboard();
  } catch (error) {
    elements.authStatus.textContent = error.message;
  }
}

function attemptBoss(sourceButton) {
  const gameState = ensureGameStateShape(getGameState());
  if (!gameState) return;
  if (gameState.progression.depth < gameState.progression.bossFloor) {
    elements.combatText.textContent = `Reach node ${gameState.progression.bossFloor} to trigger the dragon trace.`;
    return;
  }
  attackBoss(false, sourceButton);
  render();
}

elements.registerButton.addEventListener("click", () => authenticate("register"));
elements.loginButton.addEventListener("click", () => authenticate("login"));
elements.soundButton.addEventListener("click", () => toggleSound());
elements.saveButton.addEventListener("click", () => syncToServer());
elements.mineButton.addEventListener("click", () => enhanceWeapon(elements.mineButton));
elements.mineButtonMobile.addEventListener("click", () => enhanceWeapon(elements.mineButtonMobile));
elements.fightButton.addEventListener("click", () => {
  attackBoss(false, elements.fightButton);
  render();
});
elements.fightButtonMobile.addEventListener("click", () => {
  attackBoss(false, elements.fightButtonMobile);
  render();
});
elements.bossButton.addEventListener("click", () => attemptBoss(elements.bossButton));
elements.bossButtonMobile.addEventListener("click", () => attemptBoss(elements.bossButtonMobile));

setInterval(() => {
  if (!state.profile) return;
  passiveTick();
  if (Math.random() < 0.24) attackBoss(true);
  render();
}, TICK_MS);

setInterval(() => {
  syncToServer();
  fetchLeaderboard();
}, SAVE_INTERVAL_MS);

fetchSession();
fetchStore();
fetchLeaderboard();
