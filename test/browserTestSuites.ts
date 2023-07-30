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

import assert from 'node:assert/strict';
import webdriver from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import { Options as EdgeOptions } from 'selenium-webdriver/edge';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox';

const chromeOptions = new ChromeOptions();
chromeOptions.addArguments('--headless=new');

const edgeOptions = new EdgeOptions();
edgeOptions.headless();

const firefoxOptions = new FirefoxOptions();
firefoxOptions.headless();

export const browserTestSuites = (code: string, browserName: string) => () => {
	let driver: webdriver.WebDriver;

	before(async function () {
		this.timeout(30e3);

		driver = await new webdriver.Builder()
			.forBrowser(browserName)
			.setChromeOptions(chromeOptions)
			.setEdgeOptions(edgeOptions)
			.setFirefoxOptions(firefoxOptions)
			.build();

		await driver.get('about:blank');
		await driver.executeScript(
			code + '; console.log("SCRIPT SUCCESSFULLY LOADED");',
		);
	});

	after(async function () {
		this.timeout(30e3);

		driver && (await driver.quit());
		driver = undefined as unknown as typeof driver;
	});

	describe('Can run tasks', () => {
		it('should return result for sync task', async () => {
			const result = await driver.executeAsyncScript(`
			(async () => {
				const callback = arguments[arguments.length - 1];
				try {
					const sandbox = await m(
						'module.exports={foo:()=>"bar"}',
					);
					const result = await sandbox('foo');

					callback([result]);
				} catch(e) {
					callback([null, {name: e && e.name}]);
				}
			})()
			`);
			assert.deepEqual(result, ['bar']);
		});

		it('should return result for async task', async () => {
			const result = await driver.executeAsyncScript(
				`(async () => {
					const callback = arguments[arguments.length - 1];
					try {
						const sandbox = await m(
							'module.exports={foo:()=>Promise.resolve("bar")}',
						);
						const result = await sandbox('foo');

						callback([result]);
					} catch(e) {
						callback([null, {name: e && e.name}]);
					}
				})()`,
			);
			assert.deepEqual(result, ['bar']);
		});

		it('should return result for multiple arguments', async () => {
			const result = await driver.executeAsyncScript(
				`(async () => {
					const callback = arguments[arguments.length - 1];
					try {
						const sandbox = await m(
							'module.exports={foo:(a,b)=>"bar"+b+a}',
						);
						const result = await sandbox('foo', 'X', 'Y');

						callback([result]);
					} catch(e) {
						callback([null, {name: e && e.name}]);
					}
				})()`,
			);
			assert.deepEqual(result, ['barYX']);
		});
	});

	describe('Error conditions', () => {
		it('invalid syntax causes error', async () => {
			const result = await driver.executeAsyncScript(
				`(async () => {
					const callback = arguments[arguments.length - 1];
					try {
						const sandbox = await m(
							'\\u0000',
						);

						callback([true]);
					} catch(e) {
						callback([null, {name: e && e.name}]);
					}
				})()`,
			);
			assert.deepEqual(result, [null, { name: 'SyntaxError' }]);
		});

		const SUCCESS = Symbol();

		const tests: [string, string | typeof SUCCESS][] = [
			['""', SUCCESS],
			['%', 'SyntaxError'],
			['eval("")', 'EvalError'],
			['clearTimeout(setTimeout("", 1000))', 'EvalError'],
			['clearInterval(setInterval("", 1000))', 'EvalError'],
			['clearTimeout(setTimeout(Boolean, 1000))', SUCCESS],
			['clearInterval(setInterval(Boolean, 1000))', SUCCESS],
			['Function("")', 'EvalError'],
			['new Function("")', 'EvalError'],
			['(()=>{}).constructor("")', 'EvalError'],
			['new ((()=>{}).constructor)("")', 'EvalError'],
			['(async ()=>{}).constructor("")', 'EvalError'],
			['new ((async ()=>{}).constructor)("")', 'EvalError'],
			['(function* (){}).constructor("")', 'EvalError'],
			['new ((function* (){}).constructor)("")', 'EvalError'],
			['(async function* (){}).constructor("")', 'EvalError'],
			['new ((async function* (){}).constructor)("")', 'EvalError'],
			['Boolean.constructor("")', 'EvalError'],
			['new (Boolean.constructor)("")', 'EvalError'],
			['Boolean.constructor.bind(Boolean)("")', 'EvalError'],
			[
				'Function.prototype.bind.call(Boolean.constructor, Boolean)("")',
				'EvalError',
			],
			['class x extends Boolean.constructor{};new x()', 'EvalError'],
			['class x extends Boolean{};new x()', SUCCESS],
		];

		tests.forEach(([expression, errorName]) => {
			it(`${expression} ${
				errorName === SUCCESS
					? 'succeeds'
					: `causes error ${JSON.stringify(errorName)}`
			}`, async () => {
				const result = await driver.executeAsyncScript(
					`(async () => {
						const callback = arguments[arguments.length - 1];
						try {
							const sandbox = await m(
								${JSON.stringify(expression)},
							);

							callback([true]);
						} catch(e) {
							callback([null, {name: e && e.name}]);
						}	
					})()`,
				);

				assert.deepEqual(
					result,
					errorName === SUCCESS
						? [true]
						: [
								null,
								{
									name: errorName,
								},
						  ],
				);
			});
		});

		tests.forEach(([expression, errorName]) => {
			it(`Task with ${expression} ${
				errorName === SUCCESS
					? 'succeeds'
					: `causes error ${JSON.stringify(errorName)}`
			}`, async () => {
				const result = await driver.executeAsyncScript(
					`(async () => {
						const callback = arguments[arguments.length - 1];
						try {
							const sandbox = await m(
								${JSON.stringify(`module.exports={foo:()=>{${expression}}}`)},
							);

							try {
								await sandbox('foo');
							} catch(e) {
								callback([null, {name: e && e.name}]);
							}

							callback([true]);
						} catch(e) {
							callback([null, null, {name: e && e.name}]);
						}
					})()`,
				);

				assert.deepEqual(
					result,
					errorName === SUCCESS
						? [true]
						: errorName === 'SyntaxError'
						? [
								null,
								null,
								{
									name: errorName,
								},
						  ]
						: [
								null,
								{
									name: errorName,
								},
						  ],
				);
			});
		});
	});
};
