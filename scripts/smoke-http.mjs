#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

const routes = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/login/candidate',
  '/login/recruiter',
  '/signup/candidate',
  '/signup/recruiter',
  '/health',
];

const timeoutMs = 10000;

async function checkRoute(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    const passed = response.status >= 200 && response.status < 400;
    return {
      path,
      url,
      status: response.status,
      passed,
      error: null,
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      path,
      url,
      status: null,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function run() {
  console.log(`Running HTTP smoke checks against ${baseUrl}`);

  const results = [];
  for (const path of routes) {
    // Sequential checks keep logs easier to read in CI.
    // If needed, this can be parallelized later.
    const result = await checkRoute(path);
    results.push(result);
  }

  let failureCount = 0;
  for (const result of results) {
    if (result.passed) {
      console.log(`PASS ${result.path} -> ${result.status}`);
    } else {
      failureCount += 1;
      if (result.error) {
        console.log(`FAIL ${result.path} -> ${result.error}`);
      } else {
        console.log(`FAIL ${result.path} -> ${result.status}`);
      }
    }
  }

  if (failureCount > 0) {
    console.error(`Smoke check failed: ${failureCount} route(s) failed.`);
    process.exit(1);
  }

  console.log('Smoke check passed.');
}

run();
