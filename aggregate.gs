/**
 * 純粋ロジック層。
 * CalendarApp も CardService も PropertiesService もここには登場しない。
 * Node でそのまま require して走る。集計のバグは全部このファイルに集まる。
 */

var DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// --- 週の範囲 ---------------------------------------------------------

function currentWeekRange(baseDate, config) {
  var weekStartsOn = config.weekStartsOn;
  var offset = (baseDate.getDay() - weekStartsOn + 7) % 7;

  var start = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() - offset
  );
  var end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 7
  );

  return {
    start: start,
    end: end,
    weekStartsOn: weekStartsOn,
    label: rangeLabel(start)
  };
}

function shiftWeek(range, weeks) {
  var start = new Date(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate() + weeks * 7
  );
  return currentWeekRange(start, { weekStartsOn: range.weekStartsOn });
}

function rangeLabel(start) {
  var last = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return (start.getMonth() + 1) + '/' + start.getDate() +
    ' - ' + (last.getMonth() + 1) + '/' + last.getDate();
}

// --- 分類 -------------------------------------------------------------

/**
 * 集計対象のラベル一覧。色IDの昇順、そのあとタグ。
 * config だけを見る純粋関数。
 */
function labelsOf(config) {
  var seen = {};
  var labels = [];

  Object.keys(config.colors)
    .sort(function (a, b) { return Number(a) - Number(b); })
    .forEach(function (id) {
      var label = config.colors[id];
      if (label && !seen[label]) {
        seen[label] = true;
        labels.push(label);
      }
    });

  config.tags.forEach(function (tag) {
    if (!seen[tag]) {
      seen[tag] = true;
      labels.push(tag);
    }
  });

  return labels;
}

/**
 * 予定を1つのラベルに割り当てる。該当しなければ null。
 * 色が設定されていればそれを優先し、なければタグを見る。
 * 1つの予定は1つのラベルにしか入らない。
 */
function classify(event, config) {
  if (event.colorId && config.colors[event.colorId]) {
    return config.colors[event.colorId];
  }

  var text = event.title + ' ' + event.description;
  for (var i = 0; i < config.tags.length; i++) {
    if (text.indexOf(config.tags[i]) !== -1) {
      return config.tags[i];
    }
  }

  return null;
}

// --- 集計 -------------------------------------------------------------

function aggregate(events, config) {
  var buckets = {};
  labelsOf(config).forEach(function (label) {
    buckets[label] = { label: label, count: 0, minutes: 0, amount: 0, byDay: {}, allDayByDay: {} };
  });

  events.forEach(function (event) {
    if (event.declined) return;

    var label = classify(event, config);
    if (!label || !buckets[label]) return;

    var bucket = buckets[label];
    bucket.count += 1;

    var text = event.title + ' ' + event.description;
    var amount = parseAmount(text, config.amountPattern);
    if (amount !== null) {
      bucket.amount += amount;
      return;
    }

    // 終日予定は 24 時間として入ってくるので、時間ではなく週に入る日を数える
    if (event.allDay) {
      markAllDayDays(bucket.allDayByDay, event);
      return;
    }

    var minutes = Math.max(0, Math.round((event.endMs - event.startMs) / 60000));
    bucket.minutes += minutes;

    if (event.dayIndex >= 0 && event.dayIndex <= 6) {
      bucket.byDay[event.dayIndex] = (bucket.byDay[event.dayIndex] || 0) + minutes;
    }
  });

  return buckets;
}

/**
 * 終日予定がかかる日に、週の中（0〜6）に限って印をつける。
 * 終日予定は最終日の翌日 0:00 で終わるので、長さを日に直せば何日分かわかる。
 * 同じ日に終日予定が重なっても1日と数える。
 */
function markAllDayDays(allDayByDay, event) {
  var days = Math.max(1, Math.round((event.endMs - event.startMs) / 86400000));
  var first = Math.max(0, event.dayIndex);
  var last = Math.min(6, event.dayIndex + days - 1);

  for (var day = first; day <= last; day++) {
    allDayByDay[day] = true;
  }
}

function countDays(allDayByDay) {
  return Object.keys(allDayByDay).length;
}

function summarize(thisEvents, prevEvents, config, range) {
  var now = aggregate(thisEvents, config);
  var prev = aggregate(prevEvents, config);

  var rows = labelsOf(config).map(function (label) {
    var n = now[label];
    var shown = describeBucket(n, prev[label], range.weekStartsOn);

    return {
      label: label,
      count: n.count,
      value: shown.value,
      detail: shown.detail,
      delta: shown.delta,
      goal: buildGoal(label, n.minutes, config)
    };
  });

  return { rangeLabel: range.label, rows: rows };
}

/**
 * 行に出す値・内訳・先週比を作る。
 * 金額があれば金額、終日予定しかなければ日数、それ以外は時間で出す。
 */
function describeBucket(n, p, weekStartsOn) {
  if (n.amount > 0) {
    return {
      value: formatAmount(n.amount),
      detail: n.count + '件',
      delta: formatDelta(n.amount - p.amount, formatAmount)
    };
  }

  var days = countDays(n.allDayByDay);

  if (n.minutes === 0 && days > 0) {
    return {
      value: '終日 ' + formatDays(days),
      detail: buildAllDayDetail(n.allDayByDay, weekStartsOn),
      delta: formatDelta(days - countDays(p.allDayByDay), formatDays)
    };
  }

  var detail = buildDayDetail(n.byDay, weekStartsOn);
  if (days > 0) detail += ' / 終日 ' + formatDays(days);

  return {
    value: formatMinutes(n.minutes),
    detail: detail,
    delta: formatDelta(n.minutes - p.minutes, formatMinutes)
  };
}

/** 目標が設定されていれば達成率を返す。なければ null。 */
function buildGoal(label, minutes, config) {
  var target = config.goals && config.goals[label];
  if (!target || target <= 0) return null;

  var percent = Math.round((minutes / target) * 100);
  var remaining = Math.max(0, target - minutes);

  return {
    target: target,
    percent: percent,
    remaining: remaining,
    text: formatMinutes(target) + ' 中 ' + percent + '%',
    remainingText: remaining > 0 ? 'あと ' + formatMinutes(remaining) : '達成'
  };
}

function parseAmount(text, pattern) {
  var matched = text.match(new RegExp(pattern));
  if (!matched) return null;

  var value = Number(matched[1].replace(/,/g, ''));
  return isNaN(value) ? null : value;
}

// --- 表示用の整形 -----------------------------------------------------

function formatMinutes(minutes) {
  if (minutes <= 0) return '0分';

  var hours = Math.floor(minutes / 60);
  var rest = minutes % 60;

  if (hours === 0) return rest + '分';
  if (rest === 0) return hours + '時間';
  return hours + '時間' + rest + '分';
}

function formatAmount(amount) {
  return '¥' + String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDays(days) {
  return days + '日';
}

function formatDelta(diff, formatter) {
  if (diff === 0) return '先週比 ±0';
  return '先週比 ' + (diff > 0 ? '+' : '−') + formatter(Math.abs(diff));
}

function buildDayDetail(byDay, weekStartsOn) {
  var parts = Object.keys(byDay)
    .map(Number)
    .sort(function (a, b) { return a - b; })
    .map(function (dayIndex) {
      var label = DAY_LABELS[(weekStartsOn + dayIndex) % 7];
      return label + ' ' + formatMinutes(byDay[dayIndex]);
    });

  return parts.length ? parts.join(' / ') : '予定なし';
}

/** 終日予定がかかった曜日を「土・日」の形で並べる。 */
function buildAllDayDetail(allDayByDay, weekStartsOn) {
  return Object.keys(allDayByDay)
    .map(Number)
    .sort(function (a, b) { return a - b; })
    .map(function (dayIndex) {
      return DAY_LABELS[(weekStartsOn + dayIndex) % 7];
    })
    .join('・');
}

// Node から require できるようにする。Apps Script 側では module が
// 未定義なのでこのブロックは無視される。
if (typeof module !== 'undefined') {
  module.exports = {
    currentWeekRange: currentWeekRange,
    shiftWeek: shiftWeek,
    labelsOf: labelsOf,
    classify: classify,
    aggregate: aggregate,
    summarize: summarize,
    buildGoal: buildGoal,
    parseAmount: parseAmount,
    formatMinutes: formatMinutes,
    formatAmount: formatAmount,
    formatDays: formatDays,
    buildDayDetail: buildDayDetail,
    buildAllDayDetail: buildAllDayDetail
  };
}
