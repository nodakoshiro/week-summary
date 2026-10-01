/**
 * 設定層。
 * 利用者ごとの設定は PropertiesService の UserProperties に保存する。
 * 開発者からは中身が見えず、利用者ごとに隔離される。
 */

var PROP_KEY = 'settings.v2';

/**
 * カレンダーUI上の色名。
 * API 側の enum 名（PALE_BLUE など）とは一致しないため、
 * 画面に出すのは必ずこちらを使う。
 */
var COLOR_NAMES = {
  '1': 'ラベンダー',
  '2': 'セージ',
  '3': 'グレープ',
  '4': 'フラミンゴ',
  '5': 'バナナ',
  '6': 'ミカン',
  '7': 'ピーコック',
  '8': 'グラファイト',
  '9': 'ブルーベリー',
  '10': 'バジル',
  '11': 'トマト'
};

/** 設定カードに並べる順。カレンダーの色の一覧と同じ順にしている。 */
var COLOR_IDS = ['4', '11', '6', '5', '10', '2', '7', '1', '9', '3', '8'];

/** 初期値。未設定の利用者にはこれが出る。 */
function defaultSettings() {
  return {
    // 色ID → 表示名。空文字なら集計しない。
    colors: {
      '10': '運動',
      '9': '読書',
      '11': '食費'
    },
    // 色が付いていない予定のための補助。任意。
    tags: [],
    // 表示名 → 週あたりの目標（分）。0 なら目標なし。
    goals: {},
    weekStartsOn: 1,
    amountPattern: '[¥￥]\\s*([0-9,]+)'
  };
}

function getConfig() {
  var stored = PropertiesService.getUserProperties().getProperty(PROP_KEY);

  var settings;
  if (stored) {
    try {
      settings = JSON.parse(stored);
    } catch (err) {
      settings = defaultSettings();
    }
  } else {
    settings = defaultSettings();
  }

  return normalizeSettings(settings);
}

function saveConfig(settings) {
  PropertiesService.getUserProperties().setProperty(
    PROP_KEY,
    JSON.stringify(normalizeSettings(settings))
  );
}

function resetConfig() {
  PropertiesService.getUserProperties().deleteProperty(PROP_KEY);
}

/**
 * 欠けた項目を埋め、余計な空白を落とす。
 * 古い形式の設定が残っていても壊れないようにするための層。
 */
function normalizeSettings(settings) {
  var base = defaultSettings();
  var colors = {};

  COLOR_IDS.forEach(function (id) {
    var label = (settings.colors && settings.colors[id]) || '';
    label = String(label).replace(/[\s\u3000]+/g, ' ').trim();
    if (label) colors[id] = label;
  });

  var tags = (settings.tags || [])
    .map(function (tag) {
      return String(tag).replace(/[\s\u3000]+/g, '').trim();
    })
    .filter(function (tag) {
      return tag.length > 0;
    });

  return {
    colors: colors,
    tags: tags,
    goals: settings.goals || {},
    weekStartsOn: settings.weekStartsOn || base.weekStartsOn,
    amountPattern: settings.amountPattern || base.amountPattern
  };
}
