const puppeteer = require('puppeteer');
const commandLineArgs = require('command-line-args')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const optionDefinitions = [
  { name: 'url', type: String},
  { name: 'output', type: String}
];

const options = commandLineArgs(optionDefinitions);

(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto(options.url);
  await sleep(5000);
  await page.screenshot({path: options.output});

  await browser.close();
})();
