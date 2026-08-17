"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {buildUpsertSql, loadLegacyCourseData} = require("./course-content-lib");

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

const sourceDirectory = optionValue("--source");
const outputPath = optionValue("--output");
if (!sourceDirectory || !outputPath) {
  console.error("用法: node scripts/prepare-course-content-import.js --source <旧数据目录> --output <私有SQL文件>");
  process.exit(1);
}

const data = loadLegacyCourseData(path.resolve(sourceDirectory));
const result = buildUpsertSql(data);
fs.mkdirSync(path.dirname(path.resolve(outputPath)), {recursive:true});
fs.writeFileSync(path.resolve(outputPath), result.sql, "utf8");
console.log(JSON.stringify(result.summary));
