(function (factoryDeps) {
  const globalDeps = factoryDeps || {};

  const nativeWebSocket = globalDeps.WebSocket || window.WebSocket;
  const nativeSetTimeout = globalDeps.setTimeout || window.setTimeout.bind(window);
  const nativeClearTimeout = globalDeps.clearTimeout || window.clearTimeout.bind(window);
  const nativeRandom = globalDeps.random || Math.random;
  const nativeDocument = globalDeps.document || window.document;
  const nativeNodeSelector = globalDeps.nodeSelector || window.NodeSelector;

  let ws = null;
  let currentNodeUrl = null;
  let currentUid = null;

  let reconnectTimer = null;
  let openTimeoutTimer = null;

  let manuallyClosed = false;
  let isConnecting = false;
  let isReconnecting = false;

  // 同一ノード試行カウントは廃止。別ノード選択の試行回数のみ管理する
  let failoverAttempts = 0;
  let connectionGeneration = 0;

  let activeOptions = null;

  const handlers = {
    open: [],
    close: [],
    error: [],
    reconnect: [],
    resumed: [],
    raw: [],
    nodechange: [],
    statechange: []
  };

  const subscriptions = new Set();

  const defaultConfig = {
    openTimeoutMs: 5000,
    reconnectDelayMs: 500,      // 指数バックオフの基底遅延（ms）
    reconnectDelayMaxMs: 16000, // 指数バックオフの上限（ms）
    visibilityReconnect: true,
    debug: true
  };

  const config = { ...defaultConfig };

  function log(...args) {
    if (config.debug) console.log("[WSBroker]", ...args);
  }

  function warn(...args) {
    console.warn("[WSBroker]", ...args);
  }

  function errorLog(...args) {
    console.error("[WSBroker]", ...args);
  }

  function emit(type, payload) {
    const list = handlers[type] || [];
    for (const fn of list) {
      try {
        fn(payload);
      } catch (err) {
        errorLog("handler error", type, err);
      }
    }
  }

  function emitStateChange(reason) {
    emit("statechange", {
      reason,
      state: getState()
    });
  }

  function on(type, handler) {
    if (!handlers[type]) handlers[type] = [];
    handlers[type].push(handler);
  }

  function off(type, handler) {
    if (!handlers[type]) return;
    handlers[type] = handlers[type].filter(fn => fn !== handler);
  }

  function normalizeNodeUrl(url) {
    return String(url || "").trim().replace(/\/$/, "");
  }

  function buildWsUrl(nodeUrl) {
    const base = normalizeNodeUrl(nodeUrl);
    return base.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:") + "/ws";
  }

  function getReadyState() {
    return ws ? ws.readyState : nativeWebSocket.CLOSED;
  }

  function isOpen() {
    return getReadyState() === nativeWebSocket.OPEN;
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      nativeClearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearOpenTimeoutTimer() {
    if (openTimeoutTimer) {
      nativeClearTimeout(openTimeoutTimer);
      openTimeoutTimer = null;
    }
  }

  function resetConnectionState() {
    currentUid = null;
  }

  function detachSocket(socket) {
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  }

  function hardCloseSocket() {
    clearOpenTimeoutTimer();

    if (!ws) {
      resetConnectionState();
      emitStateChange("hard-close-no-socket");
      return;
    }

    const socket = ws;
    ws = null;

    try {
      detachSocket(socket);
      socket.close();
    } catch (err) {
      warn("hardCloseSocket error", err);
    }

    resetConnectionState();
    emitStateChange("hard-close");
  }

  function sendRaw(obj) {
    if (!ws || ws.readyState !== nativeWebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    ws.send(JSON.stringify(obj));
  }

  function subscribe(topic) {
    const t = String(topic || "").trim();
    if (!t) throw new Error("topic is empty");

    subscriptions.add(t);

    if (isOpen() && currentUid) {
      sendRaw({ uid: currentUid, subscribe: t });
      log("subscribe", t);
    }

    emitStateChange("subscribe");
  }

  function unsubscribe(topic) {
    const t = String(topic || "").trim();
    if (!t) return;

    subscriptions.delete(t);

    if (isOpen() && currentUid) {
      try {
        sendRaw({ uid: currentUid, unsubscribe: t });
        log("unsubscribe", t);
      } catch (err) {
        warn("unsubscribe failed", err);
      }
    }

    emitStateChange("unsubscribe");
  }

  function resubscribeAll() {
    if (!isOpen() || !currentUid) return;

    for (const topic of subscriptions) {
      try {
        sendRaw({ uid: currentUid, subscribe: topic });
        log("resubscribe", topic);
      } catch (err) {
        warn("resubscribe failed", topic, err);
      }
    }
  }

  function mergeConfig(partial) {
    if (!partial || typeof partial !== "object") return;
    Object.assign(config, partial);
  }

  function getState() {
    return {
      currentNodeUrl,
      currentUid,
      readyState: getReadyState(),
      subscriptions: [...subscriptions],
      isConnecting,
      isReconnecting,
      manuallyClosed,
      failoverAttempts,
      connectionGeneration,
      config: { ...config }
    };
  }

  function normalizeConnectOptions(nodeUrlOrOptions, maybeOptions) {
    if (typeof nodeUrlOrOptions === "string") {
      return {
        nodeUrl: normalizeNodeUrl(nodeUrlOrOptions),
        ...(maybeOptions || {})
      };
    }

    const options = nodeUrlOrOptions || {};
    return {
      ...options,
      nodeUrl: normalizeNodeUrl(options.nodeUrl)
    };
  }

  function snapshotActiveOptions(options, targetNodeUrl) {
    activeOptions = {
      nodeUrl: targetNodeUrl,
      nodeCandidates: Array.isArray(options.nodeCandidates) ? [...options.nodeCandidates] : null,
      nodeSelectorOptions: options.nodeSelectorOptions ? { ...options.nodeSelectorOptions } : null,
      config: options.config ? { ...options.config } : null
    };
  }

  function shouldReconnect() {
    return !manuallyClosed;
  }

  function getNodeSelector() {
    return nativeNodeSelector || window.NodeSelector;
  }

  function getWebSocketClass() {
    return nativeWebSocket || window.WebSocket;
  }

  function calcBackoffDelay(attempt, cfg = config, randomFn = nativeRandom) {
    const base = cfg.reconnectDelayMs || 500;
    const max  = cfg.reconnectDelayMaxMs || 16000;
    const exp  = Math.min(base * Math.pow(2, attempt - 1), max);
    const jitter = exp * 0.2 * (randomFn() * 2 - 1); // ±20%
    return Math.round(Math.max(0, exp + jitter));
  }

  async function selectNewNode(options, excludeNodeUrl) {
    const nodeCandidates = Array.isArray(options?.nodeCandidates)
      ? options.nodeCandidates.map(normalizeNodeUrl).filter(Boolean)
      : [];

    const selectorOptions = options?.nodeSelectorOptions || {};

    if (!nodeCandidates.length) {
      throw new Error("nodeCandidates is empty");
    }

    // 失敗したノードを候補から除外する
    const filteredCandidates = excludeNodeUrl
      ? nodeCandidates.filter(url => url !== normalizeNodeUrl(excludeNodeUrl))
      : nodeCandidates;

    // 除外後に候補が空になった場合は全候補を使う（候補が1つしかない極端なケース）
    const finalCandidates = filteredCandidates.length ? filteredCandidates : nodeCandidates;

    const selector = getNodeSelector();
    if (!selector || typeof selector.selectBestNodeWithRetry !== "function") {
      throw new Error("NodeSelector.selectBestNodeWithRetry is not available");
    }

    log("selectNewNode start", {
      excludeNodeUrl: excludeNodeUrl || null,
      candidates: finalCandidates
    });

    const result = await selector.selectBestNodeWithRetry(
      finalCandidates,
      selectorOptions
    );

    if (!result || !result.selected || !result.selected.nodeUrl) {
      throw new Error("node selection result is invalid");
    }

    return normalizeNodeUrl(result.selected.nodeUrl);
  }

  async function connect(nodeUrlOrOptions, maybeOptions) {
    const options = normalizeConnectOptions(nodeUrlOrOptions, maybeOptions);
    mergeConfig(options.config);

    const targetNodeUrl = options.nodeUrl;
    if (!targetNodeUrl) {
      throw new Error("nodeUrl is empty");
    }

    if (isConnecting) {
      throw new Error("connect already in progress");
    }

    // 初回接続が open 前に失敗しても failover 情報を失わないよう、
    // activeOptions は Promise 解決前ではなく connect 冒頭で保存する。
    snapshotActiveOptions(options, targetNodeUrl);

    clearReconnectTimer();
    manuallyClosed = false;
    isConnecting = true;

    const generation = ++connectionGeneration;
    const previousNodeUrl = currentNodeUrl;
    currentNodeUrl = targetNodeUrl;

    hardCloseSocket();

    emitStateChange("connect-start");

    try {
      const wsUrl = buildWsUrl(targetNodeUrl);
      log("connect start", { generation, nodeUrl: targetNodeUrl, wsUrl });

      await new Promise((resolve, reject) => {
        let settled = false;
        const WebSocketClass = getWebSocketClass();
        const socket = new WebSocketClass(wsUrl);

        ws = socket;

        openTimeoutTimer = nativeSetTimeout(() => {
          if (settled) return;
          settled = true;

          clearOpenTimeoutTimer();

          if (ws === socket) {
            ws = null;
          }

          try {
            detachSocket(socket);
            socket.close();
          } catch (err) {
            warn("socket close after open timeout failed", err);
          }

          reject(new Error("WebSocket open timeout"));
        }, config.openTimeoutMs);

        socket.onopen = () => {
          if (generation !== connectionGeneration) {
            log("ignore stale onopen", { generation, current: connectionGeneration });
            return;
          }
          if (settled) return;
          settled = true;
          clearOpenTimeoutTimer();

          failoverAttempts = 0;
          log("open", { nodeUrl: currentNodeUrl, generation });

          emit("open", { nodeUrl: currentNodeUrl, generation });

          if (previousNodeUrl && previousNodeUrl !== currentNodeUrl) {
            emit("nodechange", {
              from: previousNodeUrl,
              to: currentNodeUrl
            });
          }

          emitStateChange("open");
          resolve();
        };

        socket.onmessage = event => {
          if (generation !== connectionGeneration) {
            log("ignore stale onmessage", { generation, current: connectionGeneration });
            return;
          }

          let msg;
          try {
            msg = JSON.parse(event.data);
          } catch (err) {
            warn("invalid json message", err);
            return;
          }

          emit("raw", msg);

          if (msg && msg.topic) {
            emit(msg.topic, msg.data);
          }

          if (msg && msg.uid) {
            const isNewUid = currentUid !== msg.uid;
            currentUid = msg.uid;

            log("uid acquired", currentUid);

            if (isNewUid) {
              resubscribeAll();
            }

            emit("resumed", {
              nodeUrl: currentNodeUrl,
              uid: currentUid,
              generation
            });

            emitStateChange("uid-acquired");
          }
        };

        socket.onerror = event => {
          if (generation !== connectionGeneration) {
            log("ignore stale onerror", { generation, current: connectionGeneration });
            return;
          }

          warn("socket error", event);
          emit("error", {
            event,
            nodeUrl: currentNodeUrl,
            generation
          });

          if (!settled) {
            settled = true;
            clearOpenTimeoutTimer();

            if (ws === socket) {
              ws = null;
            }

            reject(new Error("WebSocket error before open"));
          }
        };

        socket.onclose = event => {
          if (generation !== connectionGeneration) {
            log("ignore stale onclose", { generation, current: connectionGeneration });
            return;
          }

          clearOpenTimeoutTimer();

          warn("socket close", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            nodeUrl: currentNodeUrl,
            generation
          });

          emit("close", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            nodeUrl: currentNodeUrl,
            generation
          });

          resetConnectionState();

          if (ws === socket) {
            ws = null;
          }

          emitStateChange("close");

          if (!settled) {
            settled = true;
            reject(new Error("WebSocket closed before open"));
            return;
          }

          if (shouldReconnect()) {
            scheduleReconnect("socket-close");
          }
        };
      });

      return { nodeUrl: currentNodeUrl };
    } finally {
      isConnecting = false;
      emitStateChange("connect-finished");
    }
  }

  async function connectInBackground(nodeUrlOrOptions, maybeOptions) {
    try {
      return await connect(nodeUrlOrOptions, maybeOptions);
    } catch (err) {
      warn("background connect failed", err);

      if (shouldReconnect()) {
        scheduleReconnect("initial-connect-failed");
      }

      return null;
    }
  }

  // 失敗ノードを除外して NodeSelector で別ノードを選択し接続する
  async function reconnectWithFailover(reason) {
    if (!shouldReconnect()) {
      log("manual close; reconnect skipped");
      return;
    }

    if (isConnecting) {
      log("reconnect skipped because connect is in progress");
      return;
    }

    const options = activeOptions || {};
    const failedNodeUrl = currentNodeUrl || options.nodeUrl;

    if (!failedNodeUrl) {
      warn("reconnect skipped: currentNodeUrl is empty");
      return;
    }

    failoverAttempts += 1;

    emit("reconnect", {
      reason,
      failedNodeUrl,
      attempt: failoverAttempts
    });

    emitStateChange("reconnect-attempt");

    try {
      log("selecting new node (excluding failed)", { failedNodeUrl, attempt: failoverAttempts });

      const nextNodeUrl = await selectNewNode(options, failedNodeUrl);

      failoverAttempts = 0;

      log("failover to new node", { from: failedNodeUrl, to: nextNodeUrl });

      await connect({ ...options, nodeUrl: nextNodeUrl });

    } catch (err) {
      warn("reconnectWithFailover failed", err);
      scheduleReconnect("retry-after-failed-reconnect");
    }
  }

  function scheduleReconnect(reason) {
    if (!shouldReconnect()) {
      log("manual close; reconnect skipped");
      return;
    }

    if (reconnectTimer) {
      log("reconnect already scheduled", reason);
      return;
    }

    const delay = calcBackoffDelay(failoverAttempts + 1, config, nativeRandom);

    warn("schedule reconnect", {
      reason,
      delay,
      attempt: failoverAttempts + 1,
      nodeUrl: currentNodeUrl
    });

    reconnectTimer = nativeSetTimeout(async () => {
      reconnectTimer = null;
      isReconnecting = true;
      emitStateChange("reconnect-start");

      try {
        await reconnectWithFailover(reason);
      } finally {
        isReconnecting = false;
        emitStateChange("reconnect-finished");
      }
    }, delay);
  }

  function close() {
    manuallyClosed = true;
    clearReconnectTimer();
    hardCloseSocket();
    emitStateChange("manual-close");
  }

  async function forceReconnect(reason = "manual-force-reconnect") {
    if (manuallyClosed) {
      manuallyClosed = false;
    }

    clearReconnectTimer();

    if (isConnecting || isReconnecting) {
      throw new Error("reconnect already in progress");
    }

    isReconnecting = true;
    emitStateChange("force-reconnect-start");

    try {
      await reconnectWithFailover(reason);
    } finally {
      isReconnecting = false;
      emitStateChange("force-reconnect-finished");
    }
  }

  async function switchNode(nodeUrl) {
    const nextNodeUrl = normalizeNodeUrl(nodeUrl);
    if (!nextNodeUrl) {
      throw new Error("nodeUrl is empty");
    }

    const options = activeOptions || {};

    return connect({ ...options, nodeUrl: nextNodeUrl });
  }

  async function refreshNodeSelection() {
    const options = activeOptions || {};
    const current = currentNodeUrl || options.nodeUrl;

    const nextNodeUrl = await selectNewNode(options, null);

    if (normalizeNodeUrl(nextNodeUrl) === normalizeNodeUrl(current)) {
      log("refreshNodeSelection: same node selected", nextNodeUrl);
      return { changed: false, nodeUrl: nextNodeUrl };
    }

    await switchNode(nextNodeUrl);

    return { changed: true, nodeUrl: nextNodeUrl };
  }

  function configure(partialConfig) {
    mergeConfig(partialConfig);
    emitStateChange("configure");
  }

  function onVisibilityChange() {
    if (!config.visibilityReconnect) return;
    if (nativeDocument.visibilityState !== "visible") return;
    if (manuallyClosed) return;

    const readyState = getReadyState();

    log("visibility visible", {
      readyState,
      currentNodeUrl,
      isConnecting,
      isReconnecting
    });

    if (
      readyState !== nativeWebSocket.OPEN &&
      readyState !== nativeWebSocket.CONNECTING &&
      !isConnecting &&
      !isReconnecting
    ) {
      scheduleReconnect("visibility-visible");
    }
  }

  nativeDocument.addEventListener("visibilitychange", onVisibilityChange);

  function destroy() {
    manuallyClosed = true;
    clearReconnectTimer();
    hardCloseSocket();
    nativeDocument.removeEventListener("visibilitychange", onVisibilityChange);
    emitStateChange("destroy");
  }

  function _createTestHooks() {
    return {
      buildWsUrl,
      calcBackoffDelay,
      normalizeNodeUrl,
      shouldReconnect,
      selectNewNode,
      hardCloseSocket,
      detachSocket,
      clearReconnectTimer,
      clearOpenTimeoutTimer,
      onVisibilityChange
    };
  }

  window.WSBroker = {
    connect,
    connectInBackground,
    close,
    destroy,
    subscribe,
    unsubscribe,
    sendRaw,
    on,
    off,
    getState,
    configure,
    forceReconnect,
    switchNode,
    refreshNodeSelection,
    _createTestHooks
  };
})(window.__wsFactoryDeps || {});