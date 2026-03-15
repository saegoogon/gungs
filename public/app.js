const elements = {
  appName: document.querySelector("#app-name"),
  headlineQuality: document.querySelector("#headline-quality"),
  roomSize: document.querySelector("#room-size"),
  roomSizeValue: document.querySelector("#room-size-value"),
  deviceCount: document.querySelector("#device-count"),
  deviceCountValue: document.querySelector("#device-count-value"),
  wallCount: document.querySelector("#wall-count"),
  wallCountValue: document.querySelector("#wall-count-value"),
  signalScore: document.querySelector("#signal-score"),
  signalSummary: document.querySelector("#signal-summary"),
  speedSummary: document.querySelector("#speed-summary"),
  latencySummary: document.querySelector("#latency-summary"),
  routerSummary: document.querySelector("#router-summary"),
  interferenceSummary: document.querySelector("#interference-summary"),
  diagnosisTitle: document.querySelector("#diagnosis-title"),
  diagnosisCopy: document.querySelector("#diagnosis-copy"),
  routerNode: document.querySelector("#router-node"),
  choiceChips: [...document.querySelectorAll(".choice-chip")],
  bars: [...document.querySelectorAll(".bar")],
};

const state = {
  appName: "WiFi Spot",
  band: "dual",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const payload = await response.json();
    state.appName = payload.appName || state.appName;
    document.title = `${state.appName} | Smart Home Network Guide`;
    elements.appName.textContent = state.appName;
  } catch {
    elements.appName.textContent = state.appName;
  }
}

function getBandBonus() {
  if (state.band === "dual") return 14;
  if (state.band === "5ghz") return 8;
  return 4;
}

function getBandLabel() {
  if (state.band === "dual") return "듀얼 밴드";
  if (state.band === "5ghz") return "5GHz 중심";
  return "2.4GHz 중심";
}

function getDiagnosis(score, roomSize, devices, walls) {
  if (score >= 80) {
    return {
      title: "지금 환경이면 거실 중앙 배치가 가장 좋아요.",
      copy: "현재 조건은 꽤 안정적이에요. 공유기를 바닥보다 높은 위치에 두면 방 끝까지 더 고르게 퍼질 가능성이 큽니다.",
      speed: "빠름",
      latency: "낮음",
      interference: walls >= 3 ? "보통" : "낮음",
      quality: "안정적",
      routerOffset: "50%",
    };
  }

  if (score >= 60) {
    return {
      title: "신호는 괜찮지만 위치 조정 효과가 큰 환경이에요.",
      copy: "집이 조금 넓거나 벽이 있어서 방 끝에서 속도 저하가 생길 수 있어요. 공유기를 집 중심 쪽으로 당겨 보세요.",
      speed: "보통",
      latency: devices >= 15 ? "보통" : "낮음",
      interference: "보통",
      quality: "무난함",
      routerOffset: roomSize > 70 ? "45%" : "52%",
    };
  }

  return {
    title: "와이파이 확장이나 메시 구성을 같이 생각해보는 게 좋아요.",
    copy: `면적 ${roomSize}m², 기기 ${devices}대, 벽 ${walls}개 조합이면 한 대의 공유기만으로는 약할 수 있어요. ${getBandLabel()}보다 넓은 범위 커버가 중요합니다.`,
    speed: "느림",
    latency: "높음",
    interference: walls >= 4 ? "높음" : "보통",
    quality: "주의 필요",
    routerOffset: "40%",
  };
}

function render() {
  const roomSize = Number(elements.roomSize.value);
  const devices = Number(elements.deviceCount.value);
  const walls = Number(elements.wallCount.value);

  elements.roomSizeValue.textContent = String(roomSize);
  elements.deviceCountValue.textContent = String(devices);
  elements.wallCountValue.textContent = String(walls);

  const score = clamp(
    Math.round(100 - roomSize * 0.28 - devices * 1.6 - walls * 7 + getBandBonus()),
    18,
    98,
  );

  const diagnosis = getDiagnosis(score, roomSize, devices, walls);
  const activeBars = Math.max(1, Math.min(5, Math.ceil(score / 20)));

  elements.signalScore.textContent = `${score}점`;
  elements.signalSummary.textContent =
    score >= 80
      ? "웹서핑과 영상 시청, 게임까지 비교적 안정적으로 사용할 수 있어요."
      : score >= 60
        ? "일상 사용은 무난하지만 방 끝이나 벽 뒤에서 약해질 수 있어요."
        : "끊김이나 속도 저하가 자주 생길 수 있어요. 위치 조정이 필요해요.";

  elements.speedSummary.textContent = diagnosis.speed;
  elements.latencySummary.textContent = diagnosis.latency;
  elements.routerSummary.textContent = getBandLabel();
  elements.interferenceSummary.textContent = diagnosis.interference;
  elements.headlineQuality.textContent = diagnosis.quality;
  elements.diagnosisTitle.textContent = diagnosis.title;
  elements.diagnosisCopy.textContent = diagnosis.copy;
  elements.routerNode.style.left = diagnosis.routerOffset;

  elements.bars.forEach((bar, index) => {
    bar.classList.toggle("active", index < activeBars);
  });
}

function registerEvents() {
  [elements.roomSize, elements.deviceCount, elements.wallCount].forEach((input) => {
    input.addEventListener("input", render);
  });

  elements.choiceChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.band = chip.dataset.band;
      elements.choiceChips.forEach((button) => {
        button.classList.toggle("active", button === chip);
      });
      render();
    });
  });
}

(async function init() {
  await loadConfig();
  registerEvents();
  render();
})();
