const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(__dirname, '..', 'seed', 'sample-data.json');

let cache = null;

/** 兼容旧数据：连接缺少封闭时段字段时补空数组（视为无封闭） */
function migrate(data) {
  if (data && Array.isArray(data.edges)) {
    for (const e of data.edges) {
      if (!Array.isArray(e.closures)) e.closures = [];
    }
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(SEED_FILE, DATA_FILE);
    console.log('[store] 数据文件不存在，已用示例数据初始化:', DATA_FILE);
  }
}

function load() {
  if (!cache) {
    ensureDataFile();
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    migrate(cache);
  }
  return cache;
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2) + '\n');
}

function reset() {
  cache = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  save();
  return cache;
}

module.exports = { load, save, reset };
