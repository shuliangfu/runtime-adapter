/**
 * 详细测试 node:crypto 和 crypto 模块的性能差异
 */

const testData = "Hello, World! This is a test string for crypto performance comparison.";
const iterations = 50000;

// Bun 测试
if (typeof (globalThis as any).Bun !== "undefined") {
  console.log("=== Bun 环境详细测试 ===\n");

  const nodeCrypto = require("node:crypto");
  const crypto = require("crypto");

  console.log("1. 模块关系:");
  console.log("   node:crypto === crypto:", nodeCrypto === crypto);
  console.log("   node:crypto.createHash === crypto.createHash:",
    nodeCrypto.createHash === crypto.createHash);

  console.log("\n2. 性能测试 (50,000 次哈希计算):");

  // 测试 node:crypto
  const start1 = performance.now();
  for (let i = 0; i < iterations; i++) {
    const hash = nodeCrypto.createHash("sha256");
    hash.update(testData);
    hash.digest("hex");
  }
  const time1 = performance.now() - start1;
  console.log(`   node:crypto: ${time1.toFixed(2)}ms (平均 ${(time1/iterations).toFixed(4)}ms/次)`);

  // 测试 crypto
  const start2 = performance.now();
  for (let i = 0; i < iterations; i++) {
    const hash = crypto.createHash("sha256");
    hash.update(testData);
    hash.digest("hex");
  }
  const time2 = performance.now() - start2;
  console.log(`   crypto:      ${time2.toFixed(2)}ms (平均 ${(time2/iterations).toFixed(4)}ms/次)`);

  console.log(`\n   性能差异: ${Math.abs(time1 - time2).toFixed(2)}ms (${((Math.abs(time1 - time2) / Math.max(time1, time2)) * 100).toFixed(1)}%)`);

  // 多次测试取平均值
  console.log("\n3. 多次测试取平均值 (5 次，每次 10,000 次):");
  const runs = 5;
  const runIterations = 10000;

  let total1 = 0, total2 = 0;
  for (let run = 0; run < runs; run++) {
    const s1 = performance.now();
    for (let i = 0; i < runIterations; i++) {
      const hash = nodeCrypto.createHash("sha256");
      hash.update(testData);
      hash.digest("hex");
    }
    total1 += performance.now() - s1;

    const s2 = performance.now();
    for (let i = 0; i < runIterations; i++) {
      const hash = crypto.createHash("sha256");
      hash.update(testData);
      hash.digest("hex");
    }
    total2 += performance.now() - s2;
  }

  const avg1 = total1 / runs;
  const avg2 = total2 / runs;
  console.log(`   node:crypto 平均: ${avg1.toFixed(2)}ms`);
  console.log(`   crypto 平均:      ${avg2.toFixed(2)}ms`);
  console.log(`   差异: ${Math.abs(avg1 - avg2).toFixed(2)}ms`);

  console.log("\n4. 结论:");
  if (nodeCrypto === crypto) {
    console.log("   ✅ node:crypto 和 crypto 是同一个模块");
    console.log("   ✅ 性能差异可能是测试误差，实际性能相同");
  } else {
    console.log("   ⚠️  node:crypto 和 crypto 是不同的模块");
    if (avg1 < avg2) {
      console.log(`   ✅ node:crypto 更快 (快 ${((avg2 - avg1) / avg2 * 100).toFixed(1)}%)`);
    } else {
      console.log(`   ✅ crypto 更快 (快 ${((avg1 - avg2) / avg1 * 100).toFixed(1)}%)`);
    }
  }
}
