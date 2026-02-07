/**
 * 测试 node:crypto 和 crypto 模块的区别和性能
 */

// 测试数据
const testData = "Hello, World! This is a test string for crypto comparison.";
const iterations = 10000;

// Deno 测试
if (typeof Deno !== "undefined") {
  console.log("=== Deno 环境测试 ===");

  const requireFn = (globalThis as any).require;
  if (requireFn) {
    const nodeCrypto = requireFn("node:crypto");
    const crypto = requireFn("crypto");

    console.log("node:crypto 类型:", typeof nodeCrypto);
    console.log("crypto 类型:", typeof crypto);
    console.log("是否相同对象:", nodeCrypto === crypto);

    // 性能测试
    if (nodeCrypto && nodeCrypto.createHash) {
      const start1 = performance.now();
      for (let i = 0; i < iterations; i++) {
        const hash = nodeCrypto.createHash("sha256");
        hash.update(testData);
        hash.digest("hex");
      }
      const time1 = performance.now() - start1;
      console.log(`node:crypto 耗时: ${time1.toFixed(2)}ms (${iterations} 次)`);
    }

    if (crypto && crypto.createHash) {
      const start2 = performance.now();
      for (let i = 0; i < iterations; i++) {
        const hash = crypto.createHash("sha256");
        hash.update(testData);
        hash.digest("hex");
      }
      const time2 = performance.now() - start2;
      console.log(`crypto 耗时: ${time2.toFixed(2)}ms (${iterations} 次)`);
    }
  } else {
    console.log("Deno 中 require 不可用");
  }
}

// Bun 测试（使用 globalThis 避免 Deno 类型检查报错）
if (typeof (globalThis as any).Bun !== "undefined") {
  console.log("\n=== Bun 环境测试 ===");

  const requireFn = (globalThis as any).require;
  const nodeCrypto = requireFn("node:crypto");
  const crypto = requireFn("crypto");

  console.log("node:crypto 类型:", typeof nodeCrypto);
  console.log("crypto 类型:", typeof crypto);
  console.log("是否相同对象:", nodeCrypto === crypto);

  // 性能测试
  if (nodeCrypto && nodeCrypto.createHash) {
    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const hash = nodeCrypto.createHash("sha256");
      hash.update(testData);
      hash.digest("hex");
    }
    const time1 = performance.now() - start1;
    console.log(`node:crypto 耗时: ${time1.toFixed(2)}ms (${iterations} 次)`);
  }

  if (crypto && crypto.createHash) {
    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const hash = crypto.createHash("sha256");
      hash.update(testData);
      hash.digest("hex");
    }
    const time2 = performance.now() - start2;
    console.log(`crypto 耗时: ${time2.toFixed(2)}ms (${iterations} 次)`);
  }
}
