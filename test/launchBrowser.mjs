#!/usr/bin/env node

/* Copyright © 2023 Exact Realty Limited.
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import webdriver from 'selenium-webdriver';
import getCodeHelper from './lib/getCodeHelper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const modules = {
	['bare']: 'bareSandbox',
	['browser']: 'browserSandbox',
	['worker']: 'workerSandbox',
};
const browsers = {
	['chrome']: webdriver.Browser.CHROME,
	['edge']: webdriver.Browser.EDGE,
	['firefox']: webdriver.Browser.FIREFOX,
	['safari']: webdriver.Browser.SAFARI,
};

/**
 * @type {(typeof browsers)[string]}
 */
let browser;
/**
 * @type {(typeof modules)[string]}
 */
let moduleName;

/**
 * @param {boolean} err
 */
const usage = (err) => {
	const file = err ? process.stderr : process.stdout;

	file.write(
		`Usage: ${process.argv[0]} BROWSER MODULE\n\n` +
			'BROWSER can be one of Chrome, Edge, Firefox or Safari\n' +
			'MODULE can be one of Browser or Worker\n\n',
	);

	process.exit(err ? 0 : 1);
};

if (
	process.argv.length === 3 &&
	['-h', '-?', '--help', '/h', '/?', '/help'].includes(
		process.argv[1].toLowerCase(),
	)
) {
	usage(false);
}

if (process.argv.length !== 4) {
	process.stderr.write(`${process.argv[0]}: Invalid number of options\n`);
	usage(true);
}

{
	const temp = process.argv[2].toLowerCase();
	if (!Object.prototype.hasOwnProperty.call(browsers, process.argv[2])) {
		process.stderr.write(
			`${process.argv[0]}: Invalid browser: ${process.argv[2]}\n`,
		);
		usage(true);
	}

	browser = browsers[temp];
}

{
	const temp = process.argv[3].toLowerCase();
	if (!Object.prototype.hasOwnProperty.call(modules, process.argv[3])) {
		process.stderr.write(
			`${process.argv[0]}: Invalid module: ${process.argv[3]}\n`,
		);
		usage(true);
	}

	moduleName = modules[temp];
}

getCodeHelper(__dirname, '../dist/index.mjs', moduleName)
	.then(async (code) => {
		const driver = await new webdriver.Builder()
			.forBrowser(browser)
			.build();

		await driver.get('about:blank');
		await driver.executeScript(
			code + '; console.log("SCRIPT SUCCESSFULLY LOADED");',
		);
	})
	.catch((e) => {
		console.error('Failed to launch browser', e);
	});
