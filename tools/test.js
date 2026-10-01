/**
 * Node で純粋層のテストを走らせる。
 *
 *   npm test
 *
 * .gs ファイルを書き換えずにそのまま読み込むため、vm で実行している。
 * CalendarApp や CardService に依存するファイルは読み込まない。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const files = ["aggregate.gs", "test.gs"];

const context = vm.createContext({
  console,
  Date,
  JSON,
  Math,
  Object,
  Number,
  String,
  Array,
  RegExp,
  Error,
  parseInt,
  parseFloat,
  isNaN,
});

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

const failures = context.runTests();
process.exit(failures > 0 ? 1 : 0);
