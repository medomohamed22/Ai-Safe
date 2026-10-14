const fs = require('node:fs');
const { chromium } = require('playwright');
const defaultChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
module.exports = { chromium, chromePath: process.env.CHROME_PATH || (fs.existsSync(defaultChrome) ? defaultChrome : undefined) };
