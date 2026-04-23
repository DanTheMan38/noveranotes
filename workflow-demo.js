(() => {
  const demoShell = document.querySelector("[data-workflow-demo]");
  if (!demoShell) {
    return;
  }

  const canvas = demoShell.querySelector("[data-workflow-canvas]");
  const startButton = document.querySelector("[data-start-workflow]");
  const resetButton = document.querySelector("[data-reset-workflow]");
  const statusElement = document.querySelector("[data-workflow-status]");
  const captionElement = document.querySelector("[data-workflow-caption]");
  const progressElement = document.querySelector("[data-workflow-progress]");
  const stepCards = Array.from(document.querySelectorAll("[data-workflow-step]"));
  const context = canvas.getContext("2d");
  const autoStart = new URL(window.location.href).searchParams.get("autostart") === "1";

  if (!context || !startButton || !resetButton || !statusElement || !captionElement || !progressElement) {
    return;
  }

  const WORLD_WIDTH = 1200;
  const WORLD_HEIGHT = 740;
  const DOMINO_THRESHOLD = 0.77;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;
  const supportsResizeObserver = typeof ResizeObserver !== "undefined";
  const themeObserver = typeof MutationObserver !== "undefined" ? new MutationObserver(() => drawScene()) : null;

  let reduceMotion = reduceMotionQuery.matches;
  let frameId = 0;
  let lastTimestamp = 0;
  let activeStepIndex = -1;

  const stageCopy = [
    {
      status: "A task drops into the workflow.",
      caption: "The marble represents a real input: a question, a brief, a bug report, or a message that needs action.",
    },
    {
      status: "The prompt shapes the path.",
      caption: "The rails stand for structure. Good prompts and clear steps keep the task from wobbling off into vague territory.",
    },
    {
      status: "The model is doing the thinking work.",
      caption: "The spiral represents drafting, transforming, planning, summarising, or classifying before anything else gets triggered.",
    },
    {
      status: "Tools and checks are firing in sequence.",
      caption: "The dominoes represent search, validation, formatting, routing, and review steps handing the work forward.",
    },
    {
      status: "The result is reaching the finish.",
      caption: "The toy-car handoff stands for delivery: show the answer, take the action, update the system, or send the final output to a person.",
    },
  ];

  const stationBadges = [
    { x: 66, y: 42, label: "1 Task" },
    { x: 232, y: 116, label: "2 Prompt" },
    { x: 516, y: 82, label: "3 Model" },
    { x: 844, y: 478, label: "4 Tools" },
    { x: 862, y: 88, label: "5 Finish" },
  ];

  const burstParticles = [
    { angle: -1.35, distance: 116, size: 7, color: "burstA" },
    { angle: -1.02, distance: 134, size: 8, color: "burstB" },
    { angle: -0.72, distance: 124, size: 6, color: "burstC" },
    { angle: -0.4, distance: 108, size: 5, color: "burstA" },
    { angle: -0.08, distance: 128, size: 8, color: "burstB" },
    { angle: 0.26, distance: 114, size: 6, color: "burstC" },
    { angle: 0.62, distance: 122, size: 7, color: "burstA" },
    { angle: 0.98, distance: 112, size: 6, color: "burstB" },
    { angle: 1.28, distance: 126, size: 7, color: "burstC" },
    { angle: 1.62, distance: 118, size: 5, color: "burstA" },
    { angle: 1.96, distance: 96, size: 4, color: "burstB" },
    { angle: 2.3, distance: 86, size: 4, color: "burstC" },
  ];

  const dominoes = Array.from({ length: 8 }, (_, index) => ({
    x: 850 + index * 24,
    y: 548,
    width: 18,
    height: 84,
  }));

  const marblePath = buildMarblePath();
  const marbleMetrics = buildPathMetrics(marblePath);
  const carPath = buildCarPath();
  const carMetrics = buildPathMetrics(carPath);

  let state = createIdleState();

  function createIdleState() {
    return {
      phase: "idle",
      marbleProgress: 0,
      carProgress: 0,
      barrierProgress: 0,
      dominoProgress: dominoes.map(() => 0),
      burstProgress: 0,
      totalProgress: 0,
      marblePoint: pointAtProgress(marblePath, marbleMetrics, 0),
      carPoint: pointAtProgress(carPath, carMetrics, 0),
    };
  }

  function buildMarblePath() {
    const center = { x: 432, y: 292 };
    const spiral = sampleSpiral(center, 154, 44, -1.18, 8.28, 180);
    const points = [];

    appendPoints(points, sampleLine({ x: 150, y: 76 }, { x: 150, y: 108 }, 8));
    appendPoints(points, sampleBezier(
      { x: 150, y: 108 },
      { x: 192, y: 122 },
      { x: 324, y: 136 },
      spiral[0],
      42,
    ));
    appendPoints(points, spiral);
    appendPoints(points, sampleBezier(
      spiral[spiral.length - 1],
      { x: 500, y: 386 },
      { x: 656, y: 458 },
      { x: 804, y: 520 },
      62,
    ));
    appendPoints(points, sampleLine({ x: 804, y: 520 }, { x: 832, y: 536 }, 8));

    return points;
  }

  function buildCarPath() {
    const points = [];
    appendPoints(points, sampleLine({ x: 1010, y: 554 }, { x: 1024, y: 554 }, 4));
    appendPoints(points, sampleBezier(
      { x: 1024, y: 554 },
      { x: 1130, y: 542 },
      { x: 1148, y: 328 },
      { x: 998, y: 196 },
      96,
    ));
    appendPoints(points, sampleBezier(
      { x: 998, y: 196 },
      { x: 970, y: 174 },
      { x: 940, y: 160 },
      { x: 908, y: 152 },
      32,
    ));

    return points;
  }

  function buildPathMetrics(points) {
    const segments = [];
    let totalLength = 0;

    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      segments.push({
        start,
        end,
        startLength: totalLength,
        length,
      });
      totalLength += length;
    }

    return { segments, totalLength };
  }

  function pointAtProgress(points, metrics, progress) {
    if (progress <= 0) {
      const first = points[0];
      const second = points[1] || first;
      return {
        x: first.x,
        y: first.y,
        angle: Math.atan2(second.y - first.y, second.x - first.x),
      };
    }

    if (progress >= 1) {
      const last = points[points.length - 1];
      const previous = points[points.length - 2] || last;
      return {
        x: last.x,
        y: last.y,
        angle: Math.atan2(last.y - previous.y, last.x - previous.x),
      };
    }

    const targetLength = metrics.totalLength * progress;
    const segment = metrics.segments.find(
      (item) => targetLength >= item.startLength && targetLength <= item.startLength + item.length,
    ) || metrics.segments[metrics.segments.length - 1];
    const localDistance = targetLength - segment.startLength;
    const localProgress = segment.length === 0 ? 0 : localDistance / segment.length;

    return {
      x: lerp(segment.start.x, segment.end.x, localProgress),
      y: lerp(segment.start.y, segment.end.y, localProgress),
      angle: Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x),
    };
  }

  function appendPoints(base, extra) {
    extra.forEach((point, index) => {
      if (!base.length || index > 0) {
        base.push(point);
      }
    });
  }

  function sampleLine(start, end, count) {
    return Array.from({ length: count }, (_, index) => {
      const progress = count === 1 ? 0 : index / (count - 1);
      return {
        x: lerp(start.x, end.x, progress),
        y: lerp(start.y, end.y, progress),
      };
    });
  }

  function sampleBezier(start, controlA, controlB, end, count) {
    return Array.from({ length: count }, (_, index) => {
      const t = count === 1 ? 0 : index / (count - 1);
      const inverse = 1 - t;
      return {
        x:
          inverse ** 3 * start.x +
          3 * inverse ** 2 * t * controlA.x +
          3 * inverse * t ** 2 * controlB.x +
          t ** 3 * end.x,
        y:
          inverse ** 3 * start.y +
          3 * inverse ** 2 * t * controlA.y +
          3 * inverse * t ** 2 * controlB.y +
          t ** 3 * end.y,
      };
    });
  }

  function sampleSpiral(center, startRadius, endRadius, startAngle, endAngle, count) {
    return Array.from({ length: count }, (_, index) => {
      const progress = count === 1 ? 0 : index / (count - 1);
      const radius = lerp(startRadius, endRadius, progress);
      const angle = lerp(startAngle, endAngle, progress);
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    });
  }

  function lerp(start, end, progress) {
    return start + (end - start) * progress;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function easeOutCubic(progress) {
    return 1 - (1 - progress) ** 3;
  }

  function easeInOutCubic(progress) {
    return progress < 0.5
      ? 4 * progress ** 3
      : 1 - ((-2 * progress + 2) ** 3) / 2;
  }

  function resizeCanvas() {
    const bounds = demoShell.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(bounds.width * ratio));
    const height = Math.max(1, Math.floor(bounds.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.setTransform(canvas.width / WORLD_WIDTH, 0, 0, canvas.height / WORLD_HEIGHT, 0, 0);
  }

  function getPalette() {
    const isDark = root.dataset.theme === "dark";

    if (isDark) {
      return {
        backgroundTop: "#08111f",
        backgroundBottom: "#121827",
        mistA: "rgba(49, 213, 198, 0.18)",
        mistB: "rgba(255, 184, 77, 0.14)",
        grid: "rgba(226, 232, 240, 0.07)",
        frameLine: "rgba(226, 232, 240, 0.12)",
        plate: "rgba(8, 15, 26, 0.88)",
        plateEdge: "rgba(226, 232, 240, 0.12)",
        plateText: "#f5f8ff",
        plateMuted: "#c8d4e8",
        trackShadow: "rgba(2, 8, 18, 0.38)",
        trackOuter: "#1f334f",
        trackInner: "#e8fbf8",
        trackAccent: "rgba(49, 213, 198, 0.9)",
        carTrackInner: "#ffe0a0",
        support: "rgba(226, 232, 240, 0.12)",
        marblePrimary: "#8fb4ff",
        marbleSecondary: "#eef5ff",
        marbleGlow: "rgba(143, 180, 255, 0.24)",
        dominoA: "#ff8f82",
        dominoB: "#ffd37a",
        carBody: "#31d5c6",
        carCab: "#8fb4ff",
        wheel: "#07101f",
        barrier: "#ffd37a",
        burstA: "#ffd37a",
        burstB: "#ff8f82",
        burstC: "#8fb4ff",
        finishFlag: "#f5f8ff",
        labelIdle: "rgba(226, 232, 240, 0.14)",
        labelActive: "#8fb4ff",
        labelDone: "#31d5c6",
        bannerBg: "rgba(8, 15, 26, 0.92)",
        bannerEdge: "rgba(143, 180, 255, 0.22)",
        bannerText: "#f5f8ff",
      };
    }

    return {
      backgroundTop: "#edf9ff",
      backgroundBottom: "#fff6ea",
      mistA: "rgba(45, 108, 223, 0.12)",
      mistB: "rgba(255, 184, 77, 0.18)",
      grid: "rgba(10, 16, 32, 0.07)",
      frameLine: "rgba(10, 16, 32, 0.08)",
      plate: "rgba(255, 255, 255, 0.88)",
      plateEdge: "rgba(20, 44, 72, 0.12)",
      plateText: "#0a1020",
      plateMuted: "#526076",
      trackShadow: "rgba(19, 44, 72, 0.16)",
      trackOuter: "#16304b",
      trackInner: "#f5fffd",
      trackAccent: "rgba(29, 185, 171, 0.9)",
      carTrackInner: "#fff1cf",
      support: "rgba(22, 48, 75, 0.12)",
      marblePrimary: "#2d6cdf",
      marbleSecondary: "#d7e6ff",
      marbleGlow: "rgba(45, 108, 223, 0.18)",
      dominoA: "#ff6f61",
      dominoB: "#ffb84d",
      carBody: "#1db9ab",
      carCab: "#2d6cdf",
      wheel: "#0a1020",
      barrier: "#ffb84d",
      burstA: "#ffb84d",
      burstB: "#ff6f61",
      burstC: "#2d6cdf",
      finishFlag: "#0a1020",
      labelIdle: "rgba(10, 16, 32, 0.14)",
      labelActive: "#2d6cdf",
      labelDone: "#1db9ab",
      bannerBg: "rgba(255, 255, 255, 0.9)",
      bannerEdge: "rgba(29, 185, 171, 0.22)",
      bannerText: "#0a1020",
    };
  }

  function updateStepCards(index, isDone) {
    if (index === activeStepIndex && !isDone) {
      return;
    }

    activeStepIndex = index;
    stepCards.forEach((card, cardIndex) => {
      card.classList.toggle("is-active", cardIndex === index && !isDone);
      card.classList.toggle("is-complete", cardIndex < index || (isDone && cardIndex <= index));
    });
  }

  function updateNarration() {
    if (state.phase === "idle") {
      statusElement.textContent = "Ready to drop the marble.";
      captionElement.textContent =
        "One clear task enters the system, then each part of the setup passes useful work to the next part.";
      progressElement.style.width = "0%";
      updateStepCards(-1, false);
      return;
    }

    if (state.phase === "done") {
      statusElement.textContent = "Workflow complete.";
      captionElement.textContent =
        "One input has moved through planning, model work, tool triggers, and a final handoff. That is the core logic behind many useful AI workflows.";
      progressElement.style.width = "100%";
      updateStepCards(4, true);
      return;
    }

    let stepIndex = 0;

    if (state.marbleProgress < 0.18) {
      stepIndex = 0;
    } else if (state.marbleProgress < 0.32) {
      stepIndex = 1;
    } else if (state.marbleProgress < DOMINO_THRESHOLD) {
      stepIndex = 2;
    } else if (state.carProgress < 0.58) {
      stepIndex = 3;
    } else {
      stepIndex = 4;
    }

    statusElement.textContent = stageCopy[stepIndex].status;
    captionElement.textContent = stageCopy[stepIndex].caption;
    progressElement.style.width = `${Math.round(state.totalProgress * 100)}%`;
    updateStepCards(stepIndex, false);
  }

  function resetRun() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    state = createIdleState();
    startButton.disabled = false;
    startButton.textContent = "Start the workflow";
    updateNarration();
    drawScene();
  }

  function finishRun() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    state.phase = "done";
    state.totalProgress = 1;
    startButton.disabled = false;
    startButton.textContent = "Replay";
    updateNarration();
    drawScene();
  }

  function startRun() {
    cancelAnimationFrame(frameId);
    startButton.disabled = true;
    startButton.textContent = "Running...";

    state = {
      phase: "running",
      startedAt: performance.now(),
      dominoTriggeredAt: null,
      carStartedAt: null,
      burstStartedAt: null,
      marbleProgress: 0,
      carProgress: 0,
      barrierProgress: 0,
      dominoProgress: dominoes.map(() => 0),
      burstProgress: 0,
      totalProgress: 0,
      marblePoint: pointAtProgress(marblePath, marbleMetrics, 0),
      carPoint: pointAtProgress(carPath, carMetrics, 0),
    };

    updateNarration();
    drawScene();
    frameId = requestAnimationFrame(tick);
  }

  function tick(timestamp) {
    lastTimestamp = timestamp;

    const marbleDuration = reduceMotion ? 3400 : 5600;
    const dominoDelay = reduceMotion ? 70 : 120;
    const dominoDuration = reduceMotion ? 180 : 280;
    const barrierDuration = reduceMotion ? 180 : 300;
    const carLead = reduceMotion ? 120 : 240;
    const carDuration = reduceMotion ? 1600 : 2200;
    const burstDuration = reduceMotion ? 700 : 1500;
    const elapsed = timestamp - state.startedAt;

    state.marbleProgress = clamp(elapsed / marbleDuration, 0, 1);
    state.marblePoint = pointAtProgress(marblePath, marbleMetrics, easeInOutCubic(state.marbleProgress));

    if (state.marbleProgress >= DOMINO_THRESHOLD && state.dominoTriggeredAt === null) {
      state.dominoTriggeredAt = timestamp;
      state.carStartedAt = timestamp + carLead;
    }

    if (state.dominoTriggeredAt !== null) {
      const dominoElapsed = timestamp - state.dominoTriggeredAt;
      state.dominoProgress = dominoes.map((_, index) => {
        const localElapsed = dominoElapsed - index * dominoDelay;
        return clamp(localElapsed / dominoDuration, 0, 1);
      });
      state.barrierProgress = clamp(dominoElapsed / barrierDuration, 0, 1);
    }

    if (state.carStartedAt !== null) {
      const carElapsed = timestamp - state.carStartedAt;
      state.carProgress = clamp(carElapsed / carDuration, 0, 1);
      state.carPoint = pointAtProgress(carPath, carMetrics, easeInOutCubic(state.carProgress));
    } else {
      state.carPoint = pointAtProgress(carPath, carMetrics, 0);
    }

    if (state.carProgress >= 1 && state.burstStartedAt === null) {
      state.burstStartedAt = timestamp;
    }

    if (state.burstStartedAt !== null) {
      state.burstProgress = clamp((timestamp - state.burstStartedAt) / burstDuration, 0, 1);
    }

    if (state.marbleProgress < DOMINO_THRESHOLD) {
      state.totalProgress = (state.marbleProgress / DOMINO_THRESHOLD) * 0.72;
    } else {
      state.totalProgress = 0.72 + state.carProgress * 0.28;
    }

    updateNarration();
    drawScene();

    if (state.burstStartedAt !== null && state.burstProgress >= 1) {
      finishRun();
      return;
    }

    frameId = requestAnimationFrame(tick);
  }

  function drawScene() {
    resizeCanvas();
    const palette = getPalette();

    context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawBackground(palette);
    drawSupportPosts(palette);
    drawTrack(marblePath, {
      shadow: palette.trackShadow,
      outer: palette.trackOuter,
      inner: palette.trackInner,
      accent: palette.trackAccent,
      width: 32,
    });
    drawTrack(carPath, {
      shadow: palette.trackShadow,
      outer: palette.trackOuter,
      inner: palette.carTrackInner,
      accent: palette.trackAccent,
      width: 28,
    });
    drawStartFunnel(palette);
    drawFinishGate(palette);
    drawStationBadges(palette);
    drawBarrier(palette);
    drawDominoes(palette);
    drawCar(palette);
    drawMarble(palette);
    drawBurst(palette);

    if (state.phase === "done") {
      drawCompletionBanner(palette);
    }
  }

  function drawBackground(palette) {
    const gradient = context.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    gradient.addColorStop(0, palette.backgroundTop);
    gradient.addColorStop(1, palette.backgroundBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const mistA = context.createRadialGradient(220, 120, 10, 220, 120, 280);
    mistA.addColorStop(0, palette.mistA);
    mistA.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = mistA;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const mistB = context.createRadialGradient(920, 620, 12, 920, 620, 260);
    mistB.addColorStop(0, palette.mistB);
    mistB.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = mistB;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    context.strokeStyle = palette.grid;
    context.lineWidth = 1;

    for (let x = 36; x < WORLD_WIDTH; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, WORLD_HEIGHT);
      context.stroke();
    }

    for (let y = 36; y < WORLD_HEIGHT; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WORLD_WIDTH, y);
      context.stroke();
    }
  }

  function drawSupportPosts(palette) {
    const posts = [
      { x: 156, y: 104, height: 92 },
      { x: 288, y: 134, height: 118 },
      { x: 422, y: 236, height: 146 },
      { x: 616, y: 458, height: 126 },
      { x: 796, y: 520, height: 110 },
      { x: 1012, y: 550, height: 136 },
      { x: 910, y: 154, height: 128 },
    ];

    posts.forEach((post) => {
      context.fillStyle = palette.support;
      roundedRect(context, post.x - 8, post.y, 16, post.height, 8);
      context.fill();
    });
  }

  function drawTrack(points, colors) {
    strokePolyline(points, colors.shadow, colors.width + 10);
    strokePolyline(points, colors.outer, colors.width);
    strokePolyline(points, colors.inner, colors.width - 12);

    context.save();
    context.setLineDash([14, 12]);
    strokePolyline(points, colors.accent, 4);
    context.restore();
  }

  function strokePolyline(points, strokeStyle, lineWidth) {
    context.save();
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.forEach((point) => {
      context.lineTo(point.x, point.y);
    });
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    context.restore();
  }

  function drawStartFunnel(palette) {
    context.save();
    context.translate(150, 34);
    context.fillStyle = palette.plate;
    context.strokeStyle = palette.plateEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-40, 0);
    context.lineTo(-24, 42);
    context.lineTo(-12, 54);
    context.lineTo(12, 54);
    context.lineTo(24, 42);
    context.lineTo(40, 0);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = palette.plateText;
    context.font = '800 14px "Segoe UI", Arial, sans-serif';
    context.textAlign = "center";
    context.fillText("Drop point", 0, 18);
    context.restore();
  }

  function drawFinishGate(palette) {
    context.save();
    context.translate(912, 154);
    context.fillStyle = palette.finishFlag;
    context.fillRect(-2, -24, 4, 52);
    context.beginPath();
    context.moveTo(2, -22);
    context.lineTo(44, -10);
    context.lineTo(2, 2);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawStationBadges(palette) {
    stationBadges.forEach((badge, index) => {
      let fill = palette.labelIdle;
      let text = palette.plateText;

      if (state.phase === "done" || index < activeStepIndex) {
        fill = palette.labelDone;
        text = "#ffffff";
      } else if (index === activeStepIndex) {
        fill = palette.labelActive;
        text = "#ffffff";
      }

      context.save();
      context.font = '800 14px "Segoe UI", Arial, sans-serif';
      const width = Math.max(92, context.measureText(badge.label).width + 28);
      roundedRect(context, badge.x, badge.y, width, 32, 16);
      context.fillStyle = fill;
      context.fill();
      context.fillStyle = text;
      context.textBaseline = "middle";
      context.fillText(badge.label, badge.x + 14, badge.y + 17);
      context.restore();
    });
  }

  function drawBarrier(palette) {
    const barrierAngle = -Math.PI / 3 * easeOutCubic(state.barrierProgress);

    context.save();
    context.translate(1002, 554);
    context.fillStyle = palette.barrier;
    roundedRect(context, -4, -48, 8, 56, 4);
    context.fill();
    context.rotate(barrierAngle);
    roundedRect(context, -46, -8, 52, 12, 6);
    context.fill();
    context.restore();
  }

  function drawDominoes(palette) {
    context.save();
    context.strokeStyle = palette.frameLine;
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(830, 590);
    context.lineTo(1012, 590);
    context.stroke();
    context.restore();

    dominoes.forEach((domino, index) => {
      const progress = easeOutCubic(state.dominoProgress[index]);
      const angle = (Math.PI / 180) * 68 * progress;

      context.save();
      context.translate(domino.x, domino.y);
      context.rotate(angle);
      context.fillStyle = index % 2 === 0 ? palette.dominoA : palette.dominoB;
      roundedRect(context, -domino.width / 2, -domino.height, domino.width, domino.height, 8);
      context.fill();
      context.restore();
    });
  }

  function drawCar(palette) {
    if (state.phase === "idle" && state.carProgress === 0) {
      renderCarShape(state.carPoint, palette, 0);
      return;
    }

    renderCarShape(state.carPoint, palette, state.carPoint.angle);
  }

  function renderCarShape(point, palette, angle) {
    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);

    context.fillStyle = "rgba(10, 16, 32, 0.16)";
    context.beginPath();
    context.ellipse(0, 16, 26, 10, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = palette.carBody;
    roundedRect(context, -28, -16, 56, 26, 10);
    context.fill();

    context.fillStyle = palette.carCab;
    roundedRect(context, -4, -30, 24, 18, 8);
    context.fill();

    context.fillStyle = palette.wheel;
    context.beginPath();
    context.arc(-16, 14, 7, 0, Math.PI * 2);
    context.arc(18, 14, 7, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(-16, 14, 2, 0, Math.PI * 2);
    context.arc(18, 14, 2, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }

  function drawMarble(palette) {
    const point = state.marblePoint;

    context.save();
    context.fillStyle = palette.marbleGlow;
    context.beginPath();
    context.arc(point.x, point.y, 24, 0, Math.PI * 2);
    context.fill();

    const gradient = context.createRadialGradient(point.x - 6, point.y - 6, 2, point.x, point.y, 16);
    gradient.addColorStop(0, palette.marbleSecondary);
    gradient.addColorStop(1, palette.marblePrimary);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(point.x, point.y, 14, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255, 255, 255, 0.72)";
    context.beginPath();
    context.arc(point.x - 5, point.y - 5, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawBurst(palette) {
    if (state.burstProgress <= 0) {
      return;
    }

    const centerX = 912;
    const centerY = 150;
    const alpha = 1 - state.burstProgress;
    const distanceMultiplier = easeOutCubic(state.burstProgress);

    burstParticles.forEach((particle) => {
      const color = palette[particle.color];
      const x = centerX + Math.cos(particle.angle) * particle.distance * distanceMultiplier;
      const y = centerY + Math.sin(particle.angle) * particle.distance * distanceMultiplier;

      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(x, y);
      context.stroke();

      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
  }

  function drawCompletionBanner(palette) {
    context.save();
    roundedRect(context, 424, 642, 352, 58, 18);
    context.fillStyle = palette.bannerBg;
    context.fill();
    context.strokeStyle = palette.bannerEdge;
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = palette.bannerText;
    context.font = '800 22px "Segoe UI", Arial, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Workflow complete", 600, 670);
    context.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const adjustedRadius = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + adjustedRadius, y);
    ctx.lineTo(x + width - adjustedRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + adjustedRadius);
    ctx.lineTo(x + width, y + height - adjustedRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - adjustedRadius, y + height);
    ctx.lineTo(x + adjustedRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - adjustedRadius);
    ctx.lineTo(x, y + adjustedRadius);
    ctx.quadraticCurveTo(x, y, x + adjustedRadius, y);
    ctx.closePath();
  }

  if (supportsResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
      drawScene();
    });
    resizeObserver.observe(demoShell);
  } else {
    window.addEventListener("resize", drawScene);
  }

  if (themeObserver) {
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }

  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener("change", (event) => {
      reduceMotion = event.matches;
      drawScene();
    });
  }

  startButton.addEventListener("click", startRun);
  resetButton.addEventListener("click", resetRun);

  updateNarration();
  drawScene();

  if (autoStart) {
    requestAnimationFrame(() => {
      startRun();
    });
  }
})();
