/**
 * 純粋層のテスト。
 * Apps Script のエディタで runTests を実行するか、
 * Node で `node test.js` として走らせる（README 参照）。
 */

var TEST_CONFIG = {
  colors: { '10': '運動', '11': '食費' },
  tags: ['#読書'],
  goals: { '運動': 180 },
  weekStartsOn: 1,
  amountPattern: '[¥￥]\\s*([0-9,]+)'
};

// summarize に渡す週の範囲。表示に使う項目だけあればよい
var TEST_RANGE = { label: '9/29 - 10/5', weekStartsOn: 1 };

// 月曜 0:00 を起点にした相対時刻でイベントを作る
function ev(dayIndex, startHour, durationMin, title, options) {
  var opts = options || {};
  var startMs = dayIndex * 86400000 + startHour * 3600000;

  return {
    title: title,
    description: opts.description || '',
    startMs: startMs,
    endMs: startMs + durationMin * 60000,
    allDay: !!opts.allDay,
    declined: !!opts.declined,
    colorId: opts.colorId || '',
    dayIndex: opts.dayIndex === undefined ? dayIndex : opts.dayIndex
  };
}

function runTests() {
  var failures = [];

  check(failures, '色で分類する', function () {
    var result = aggregate([
      ev(0, 7, 45, 'ジム', { colorId: '10' }),
      ev(2, 7, 45, 'ジム', { colorId: '10' })
    ], TEST_CONFIG);

    assertEqual(result['運動'].minutes, 90);
    assertEqual(result['運動'].count, 2);
  });

  check(failures, '色がなければタグを見る', function () {
    var result = aggregate([
      ev(1, 20, 60, '積読消化 #読書')
    ], TEST_CONFIG);

    assertEqual(result['#読書'].minutes, 60);
  });

  check(failures, '色がタグより優先される', function () {
    var result = aggregate([
      ev(1, 20, 60, '読みながら歩く #読書', { colorId: '10' })
    ], TEST_CONFIG);

    assertEqual(result['運動'].count, 1);
    assertEqual(result['#読書'].count, 0);
  });

  check(failures, '設定にない色は集計しない', function () {
    var result = aggregate([
      ev(1, 20, 60, '打ち合わせ', { colorId: '7' })
    ], TEST_CONFIG);

    assertEqual(labelsOf(TEST_CONFIG).length, 3);
    assertEqual(result['運動'].count, 0);
    assertEqual(result['食費'].count, 0);
  });

  check(failures, '1つの予定は1つのラベルにしか入らない', function () {
    var result = aggregate([
      ev(0, 12, 60, 'ランチ #読書', { colorId: '11', description: '¥1200' })
    ], TEST_CONFIG);

    assertEqual(result['食費'].count, 1);
    assertEqual(result['#読書'].count, 0);
  });

  check(failures, '終日予定は時間に含めない', function () {
    var result = aggregate([
      ev(0, 0, 1440, '休養日', { colorId: '10', allDay: true })
    ], TEST_CONFIG);

    assertEqual(result['運動'].minutes, 0);
    assertEqual(result['運動'].count, 1);
  });

  check(failures, '終日予定は週に入る日数で数える', function () {
    var result = aggregate([
      ev(5, 0, 2 * 1440, '旅行', { colorId: '10', allDay: true })
    ], TEST_CONFIG);

    assertEqual(Object.keys(result['運動'].allDayByDay).length, 2);
    assertEqual(result['運動'].minutes, 0);
  });

  check(failures, '週をまたぐ終日予定は週に入る日だけ数える', function () {
    var result = aggregate([
      ev(-1, 0, 3 * 1440, '前の週から', { colorId: '10', allDay: true }),
      ev(6, 0, 3 * 1440, '合宿 #読書', { allDay: true })
    ], TEST_CONFIG);

    assertEqual(Object.keys(result['運動'].allDayByDay).length, 2);
    assertEqual(Object.keys(result['#読書'].allDayByDay).length, 1);
  });

  check(failures, '同じ日に重なる終日予定は1日と数える', function () {
    var result = aggregate([
      ev(2, 0, 1440, '遠征', { colorId: '10', allDay: true }),
      ev(2, 0, 1440, '試合', { colorId: '10', allDay: true })
    ], TEST_CONFIG);

    assertEqual(Object.keys(result['運動'].allDayByDay).length, 1);
    assertEqual(result['運動'].count, 2);
  });

  check(failures, '終日予定しかない行は日数を出す', function () {
    var row = summarize([
      ev(5, 0, 2 * 1440, '旅行', { colorId: '10', allDay: true })
    ], [], TEST_CONFIG, TEST_RANGE).rows[0];

    assertEqual(row.value, '終日 2日');
    assertEqual(row.detail, '土・日');
    assertEqual(row.delta, '先週比 +2日');
  });

  check(failures, '時間の予定と終日予定がある行は両方出す', function () {
    var row = summarize([
      ev(0, 7, 60, 'ジム', { colorId: '10' }),
      ev(2, 0, 1440, '遠征', { colorId: '10', allDay: true })
    ], [], TEST_CONFIG, TEST_RANGE).rows[0];

    assertEqual(row.value, '1時間');
    assertEqual(row.detail, '月 1時間 / 終日 1日');
    assertEqual(row.delta, '先週比 +1時間');
  });

  check(failures, '辞退した予定は除外する', function () {
    var result = aggregate([
      ev(1, 19, 60, 'パーソナル', { colorId: '10', declined: true })
    ], TEST_CONFIG);

    assertEqual(result['運動'].count, 0);
  });

  check(failures, '繰り返し予定は展開後の各回で数える', function () {
    var result = aggregate([
      ev(0, 7, 45, 'ジム', { colorId: '10' }),
      ev(2, 7, 45, 'ジム', { colorId: '10' }),
      ev(5, 7, 45, 'ジム', { colorId: '10' })
    ], TEST_CONFIG);

    assertEqual(result['運動'].count, 3);
    assertEqual(Object.keys(result['運動'].byDay).length, 3);
  });

  check(failures, '週の開始より前に始まる予定は曜日内訳から外す', function () {
    var result = aggregate([
      ev(0, 7, 60, 'またぎ', { colorId: '10', dayIndex: -1 })
    ], TEST_CONFIG);

    assertEqual(result['運動'].minutes, 60);
    assertEqual(Object.keys(result['運動'].byDay).length, 0);
  });

  check(failures, '金額表記があれば時間ではなく金額を積む', function () {
    var result = aggregate([
      ev(0, 12, 60, 'ランチ ¥1,200', { colorId: '11' }),
      ev(1, 12, 60, 'ランチ ¥800', { colorId: '11' })
    ], TEST_CONFIG);

    assertEqual(result['食費'].amount, 2000);
    assertEqual(result['食費'].minutes, 0);
  });

  check(failures, '目標の達成率を出す', function () {
    var goal = buildGoal('運動', 135, TEST_CONFIG);

    assertEqual(goal.percent, 75);
    assertEqual(goal.remainingText, 'あと 45分');
  });

  check(failures, '目標がないラベルは null', function () {
    assertEqual(buildGoal('食費', 100, TEST_CONFIG), null);
  });

  check(failures, '時間の表示を整形する', function () {
    assertEqual(formatMinutes(135), '2時間15分');
    assertEqual(formatMinutes(120), '2時間');
    assertEqual(formatMinutes(45), '45分');
    assertEqual(formatMinutes(0), '0分');
  });

  return report(failures);
}

// --- 最小のテストヘルパ ------------------------------------------------

function check(failures, name, fn) {
  try {
    fn();
  } catch (err) {
    failures.push(name + ' : ' + err.message);
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(
      'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
    );
  }
}

function report(failures) {
  var message = failures.length
    ? 'FAIL (' + failures.length + ')\n' + failures.join('\n')
    : 'PASS';

  if (typeof Logger !== 'undefined') {
    Logger.log(message);
  } else {
    console.log(message);
  }
  return failures.length;
}
