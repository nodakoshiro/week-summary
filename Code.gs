/**
 * エントリ層。
 * ここは薄く保つ。ロジックを書き始めたら aggregate.gs に移す。
 */
function onHomepage() {
  return buildHomeCard(loadSummary());
}

/**
 * 今週と前週を読んで集計する。
 * onHomepage と、設定保存後の再描画の両方から呼ばれる。
 */
function loadSummary() {
  var config = getConfig();

  var range = currentWeekRange(new Date(), config);
  var prevRange = shiftWeek(range, -1);

  return summarize(
    fetchEvents(range),
    fetchEvents(prevRange),
    config,
    range
  );
}
