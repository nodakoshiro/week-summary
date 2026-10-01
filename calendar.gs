/**
 * データ取得層。
 * CalendarApp が登場するのはこのファイルだけ。
 * Google の型は外に出さず、素のオブジェクトに変換して返す。
 */
function fetchEvents(range) {
  var calendar = CalendarApp.getDefaultCalendar();
  var events = calendar.getEvents(range.start, range.end);

  return events.map(function (event) {
    return toInternalEvent(event, range);
  });
}

function toInternalEvent(event, range) {
  var startMs = event.getStartTime().getTime();

  return {
    title: event.getTitle() || '',
    description: event.getDescription() || '',
    startMs: startMs,
    endMs: event.getEndTime().getTime(),
    allDay: event.isAllDayEvent(),
    declined: isDeclined(event),
    // 色を指定していない予定（カレンダーの既定色）は空文字が返る想定。
    // 実機で必ず確認すること。
    colorId: readColor(event),
    // 週の何日目か。0 = 週の初日。タイムゾーンはここで吸収する。
    dayIndex: Math.floor((startMs - range.start.getTime()) / 86400000)
  };
}

function readColor(event) {
  try {
    return event.getColor() || '';
  } catch (err) {
    return '';
  }
}

function isDeclined(event) {
  try {
    return event.getMyStatus() === CalendarApp.GuestStatus.NO;
  } catch (err) {
    // 自分が主催で参加者がいない予定などでは取得できないことがある
    return false;
  }
}
