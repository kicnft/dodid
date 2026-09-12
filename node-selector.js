(function () {

function normalizeNodeUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRandomNodes(nodes, count) {
  const arr = nodes.map(normalizeNodeUrl);
  return shuffle(arr).slice(0, count);
}

async function fetchWithTimeout(url, timeoutMs, deps = {}) {
  const fetchFn = deps.fetch || fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(url, { signal: controller.signal });
    if (!res.ok) throw new Error("http");
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function probeNode(nodeUrl, timeoutMs, deps = {}) {
  const base = normalizeNodeUrl(nodeUrl);
  const fetcher = (url) => fetchWithTimeout(url, timeoutMs, deps);

  try {
    const health = await fetcher(base + "/node/health");

    if (health?.status?.apiNode !== "up") {
      throw new Error("api down");
    }

    const [chain, blocks] = await Promise.all([
      fetcher(base + "/chain/info"),
      fetcher(base + "/blocks?order=desc&pageSize=1")
    ]);

    const height = Number(chain?.height ?? 0);
    if (!height) throw new Error("height");

    const hash = blocks?.data?.[0]?.meta?.hash;
    if (!hash) throw new Error("hash");

    return {
      nodeUrl: base,
      ok: true,
      height,
      lastBlockHash: hash
    };

  } catch {
    return {
      nodeUrl: base,
      ok: false
    };
  }
}

function evaluateConsensus(probes, minConsensus) {
  const votes = new Map();

  for (const p of probes) {
    if (!p.ok) continue;

    const hash = p.lastBlockHash;
    const count = (votes.get(hash) || 0) + 1;
    votes.set(hash, count);

    if (count >= minConsensus) {
      return probes.filter(x => x.lastBlockHash === hash);
    }
  }

  return null;
}

function chooseBestNode(group) {
  return group.sort((a, b) =>
    b.height - a.height ||
    a.nodeUrl.localeCompare(b.nodeUrl)
  )[0];
}

function chooseFallback(probes) {
  const ok = probes.filter(p => p.ok);
  return ok.length ? chooseBestNode(ok) : null;
}

async function selectBestNode(nodes, options = {}, deps = {}) {
  const {
    selectCount = 5,
    minConsensus = 3,
    timeoutMs = 5000,
    onProgress = null
  } = options;

  const probe = deps.probe || ((n, t) => probeNode(n, t, deps));
  const sample = getRandomNodes(nodes, selectCount);

  const probes = [];
  let resolved = false;

  return new Promise(resolve => {

    const timer = setTimeout(finish, timeoutMs);

    const tasks = sample.map(node => probe(node, timeoutMs));
    let completed = 0;

    function finish() {
      clearTimeout(timer);
      if (resolved) return;
      resolved = true;

      const fallback = chooseFallback(probes);
      resolve({ selected: fallback, probes });
    }

    tasks.forEach(task => {
      task.then(result => {
        completed++;
        probes.push(result);

        if (onProgress) onProgress(completed, selectCount, result);

        if (!resolved) {
          const consensus = evaluateConsensus(probes, minConsensus);

          if (consensus) {
            resolved = true;
            clearTimeout(timer);
            const best = chooseBestNode(consensus);
            resolve({ selected: best, probes });
            return;
          }

          if (completed === tasks.length) {
            finish();
          }
        }
      }).catch(() => {
        completed++;
        if (!resolved && completed === tasks.length) {
          finish();
        }
      });
    });
  });
}

/* ===============================
 * retry拡張版
 * =============================== */

async function selectBestNodeWithRetry(nodes, options = {}, deps = {}) {

  const {
    retry = 1,
    retryStrategy = "resample" // 明示
  } = options;

  let lastResult = null;

  for (let attempt = 0; attempt <= retry; attempt++) {

    const result = await selectBestNode(nodes, options, deps);
    lastResult = result;

    if (result && result.selected) {
      return result;
    }

    if (attempt < retry) {
      console.warn("[NodeSelector] retry", {
        attempt: attempt + 1,
        strategy: retryStrategy
      });

      // 現状は resample のみサポート
      if (retryStrategy !== "resample") {
        console.warn("[NodeSelector] unknown retryStrategy, fallback to resample");
      }
    }
  }

  return lastResult;
}

window.NodeSelector = {
  normalizeNodeUrl,
  getRandomNodes,
  fetchWithTimeout,
  probeNode,
  evaluateConsensus,
  chooseBestNode,
  chooseFallback,
  selectBestNode,
  selectBestNodeWithRetry
};

})();