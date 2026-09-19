// 舞台区域连接图的通行耗时计算（支持通道封闭时段的时间依赖最短路）

/**
 * 规范化封闭时段：过滤非法区间、按开始秒排序并合并重叠/相邻区间。
 * 封闭时段为左闭右开区间 [start, end)：start 秒起封闭，end 秒恢复通行。
 */
function normalizeClosures(closures) {
  if (!Array.isArray(closures)) return [];
  const sorted = closures
    .filter((c) => c && Number.isInteger(c.start) && Number.isInteger(c.end) && c.start >= 0 && c.end > c.start)
    .map((c) => ({ start: c.start, end: c.end }))
    .sort((x, y) => x.start - y.start || x.end - y.end);
  const merged = [];
  for (const c of sorted) {
    const last = merged[merged.length - 1];
    if (last && c.start <= last.end) last.end = Math.max(last.end, c.end);
    else merged.push({ ...c });
  }
  return merged;
}

/**
 * 在 t 时刻准备进入一条耗时 seconds 的连接时，若通行区间 [t, t+seconds]
 * 与任一封闭时段重叠，则需在原地等待至封闭结束；
 * 返回最早可进入时刻与累计等待秒数。
 */
function earliestEnter(t, seconds, closures) {
  let enter = t;
  let wait = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of closures) {
      if (enter < c.end && enter + seconds > c.start) {
        wait += c.end - enter;
        enter = c.end;
        changed = true;
      }
    }
  }
  return { enter, wait };
}

function buildAdjacency(edges) {
  const adj = new Map();
  const add = (from, to, edge) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({
      to,
      edgeId: edge.id,
      seconds: edge.seconds,
      closures: normalizeClosures(edge.closures),
    });
  };
  for (const e of edges) {
    if (e.a === e.b) continue;
    // 无向边：两个方向耗时与封闭时段相同
    add(e.a, e.b, e);
    add(e.b, e.a, e);
  }
  return adj;
}

/**
 * 时间依赖最短路：从 fromId 于 departAt 时刻出发，按通行耗时逐边推演；
 * 进入连接若与封闭时段重叠，则在该区域等待（或改走其他路径），
 * 返回到达 toId 的最早时刻、总等待时长与实际路线；不可达时返回 null。
 *
 * 等待只会让到达更晚（FIFO），故 Dijkstra 贪心仍然成立。
 *
 * @returns {{arrival: number, wait: number, legs: Array, path: string[]} | null}
 *   legs 为逐边明细：{ edgeId, from, to, wait, enterAt, arriveAt }
 */
function earliestPath(edges, fromId, toId, departAt = 0) {
  if (fromId === toId) return { arrival: departAt, wait: 0, legs: [], path: [fromId] };

  const adj = buildAdjacency(edges);
  const dist = new Map([[fromId, departAt]]);
  const prev = new Map();
  const visited = new Set();
  const queue = [{ id: fromId, d: departAt }];

  while (queue.length > 0) {
    // 图规模小，直接线性取最小值
    let bestIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].d < queue[bestIdx].d) bestIdx = i;
    }
    const { id, d } = queue.splice(bestIdx, 1)[0];
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === toId) break;

    for (const nb of adj.get(id) || []) {
      const { enter, wait } = earliestEnter(d, nb.seconds, nb.closures);
      const arrive = enter + nb.seconds;
      if (arrive < (dist.has(nb.to) ? dist.get(nb.to) : Infinity)) {
        dist.set(nb.to, arrive);
        prev.set(nb.to, { from: id, edgeId: nb.edgeId, wait, enterAt: enter, arriveAt: arrive });
        queue.push({ id: nb.to, d: arrive });
      }
    }
  }

  if (!dist.has(toId)) return null;

  const legs = [];
  const path = [toId];
  let cur = toId;
  while (cur !== fromId) {
    const p = prev.get(cur);
    legs.unshift({ edgeId: p.edgeId, from: p.from, to: cur, wait: p.wait, enterAt: p.enterAt, arriveAt: p.arriveAt });
    path.unshift(p.from);
    cur = p.from;
  }

  return {
    arrival: dist.get(toId),
    wait: legs.reduce((sum, l) => sum + l.wait, 0),
    legs,
    path,
  };
}

module.exports = { earliestPath, earliestEnter, normalizeClosures };
