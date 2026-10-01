/**
 * 表示層。
 * CardService が登場するのはこのファイルだけ。
 */

// --- サマリーカード ---------------------------------------------------

function buildHomeCard(summary) {
  var card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader()
      .setTitle('今週のサマリー')
      .setSubtitle(summary.rangeLabel)
  );

  var section = CardService.newCardSection();
  var shown = 0;

  summary.rows.forEach(function (row) {
    if (row.count === 0) return;
    shown += 1;

    var bottom = row.detail + '   ' + row.delta;
    if (row.goal) {
      bottom = row.goal.text + ' ・ ' + row.goal.remainingText + '\n' + bottom;
    }

    section.addWidget(
      CardService.newDecoratedText()
        .setTopLabel(row.label + '  ' + row.count + '件')
        .setText(row.value)
        .setBottomLabel(bottom)
        .setWrapText(true)
    );
  });

  if (shown === 0) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '該当する予定がありません。予定に色を設定するか、設定画面で色とラベルの対応を登録してください。'
      )
    );
  }

  section.addWidget(
    CardService.newTextButton()
      .setText('設定')
      .setOnClickAction(
        CardService.newAction().setFunctionName('onOpenSettings')
      )
  );

  return card.addSection(section).build();
}

// --- 設定カード -------------------------------------------------------

function buildSettingsCard(config) {
  var card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader()
      .setTitle('設定')
      .setSubtitle('色に名前をつけると集計されます')
  );

  var colorSection = CardService.newCardSection().setHeader('予定の色');

  COLOR_IDS.forEach(function (id) {
    colorSection.addWidget(
      CardService.newTextInput()
        .setFieldName('color_' + id)
        .setTitle(COLOR_NAMES[id])
        .setValue(config.colors[id] || '')
    );
  });

  var extraSection = CardService.newCardSection().setHeader('補助設定');

  extraSection.addWidget(
    CardService.newTextInput()
      .setFieldName('tags')
      .setTitle('タグ（カンマ区切り）')
      .setHint('色を使わない予定向け。例: #筋トレ, #読書')
      .setValue(config.tags.join(', '))
  );

  extraSection.addWidget(
    CardService.newTextInput()
      .setFieldName('goals')
      .setTitle('週の目標（分）')
      .setHint('ラベル=分 をカンマ区切りで。例: 運動=180, 読書=120')
      .setValue(serializeGoals(config.goals))
  );

  var buttons = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('保存')
        .setOnClickAction(
          CardService.newAction().setFunctionName('onSaveSettings')
        )
    )
    .addButton(
      CardService.newTextButton()
        .setText('初期値に戻す')
        .setOnClickAction(
          CardService.newAction().setFunctionName('onResetSettings')
        )
    );

  extraSection.addWidget(buttons);

  return card.addSection(colorSection).addSection(extraSection).build();
}

// --- 操作のハンドラ ---------------------------------------------------

function onOpenSettings() {
  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().pushCard(buildSettingsCard(getConfig()))
    )
    .build();
}

function onSaveSettings(e) {
  var form = (e && e.formInput) || {};

  var colors = {};
  COLOR_IDS.forEach(function (id) {
    var value = form['color_' + id];
    if (value) colors[id] = value;
  });

  var tags = String(form.tags || '')
    .split(/[,、]/)
    .map(function (tag) { return tag.trim(); })
    .filter(function (tag) { return tag.length > 0; });

  saveConfig({
    colors: colors,
    tags: tags,
    goals: parseGoals(form.goals),
    weekStartsOn: 1
  });

  return respondWithHome('保存しました');
}

function onResetSettings() {
  resetConfig();
  return respondWithHome('初期値に戻しました');
}

/** 設定を書き換えたあと、サマリーを作り直してルートに戻す。 */
function respondWithHome(message) {
  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation().popToRoot().updateCard(buildHomeCard(loadSummary()))
    )
    .setNotification(CardService.newNotification().setText(message))
    .build();
}

// --- 目標の文字列変換 -------------------------------------------------

function serializeGoals(goals) {
  return Object.keys(goals || {})
    .map(function (label) { return label + '=' + goals[label]; })
    .join(', ');
}

function parseGoals(text) {
  var goals = {};

  String(text || '')
    .split(/[,、]/)
    .forEach(function (pair) {
      var parts = pair.split(/[=＝]/);
      if (parts.length !== 2) return;

      var label = parts[0].trim();
      var minutes = parseInt(parts[1].replace(/[^\d]/g, ''), 10);

      if (label && minutes > 0) goals[label] = minutes;
    });

  return goals;
}
