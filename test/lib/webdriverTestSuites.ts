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
import { Options as SafariOptions } from 'selenium-webdriver/safari';
import baseTests from './baseTests.json';

export const enabledBrowsers = () => {
	const webdriverBrowsers = new Set(
		process.env.WEBDRIVER_BROWSERS?.split(/[ ,;]/) ??
			[
				webdriver.Browser.CHROME,
				(process.platform === 'win32' && webdriver.Browser.EDGE) ||
					undefined,
				webdriver.Browser.FIREFOX,
				(process.platform === 'darwin' && webdriver.Browser.SAFARI) ||
					undefined,
			].filter(Boolean),
	);

	return [
		[webdriver.Browser.CHROME, 'Chrome'],
		[webdriver.Browser.EDGE, 'Edge'],
		[webdriver.Browser.FIREFOX, 'Firefox'],
		[webdriver.Browser.SAFARI, 'Safari'],
	].filter(([browserName]) => webdriverBrowsers.has(browserName));
};

const chromeOptions = new ChromeOptions();
chromeOptions.addArguments('--headless=new');

const edgeOptions = new EdgeOptions();
edgeOptions.headless();

const firefoxOptions = new FirefoxOptions();
firefoxOptions.headless();

const safariOptions = new SafariOptions();

export const webdriverTestSuites =
	(codePromise: Promise<string>, browserName: string) => () => {
		let driver: webdriver.WebDriver;
		let code: string;

		before(async function () {
			this.timeout(30e3);

			await Promise.all([
				(async () => {
					code = await codePromise;
				})(),
				(async () => {
					driver = await new webdriver.Builder()
						.forBrowser(browserName)
						.setChromeOptions(chromeOptions)
						.setEdgeOptions(edgeOptions)
						.setFirefoxOptions(firefoxOptions)
						.setSafariOptions(safariOptions)
						.build();

					await driver.get('about:blank');
				})(),
			]);

			await driver.executeScript(
				code + '; console.log("SCRIPT SUCCESSFULLY LOADED");',
			);
		});

		after(async function () {
			this.timeout(30e3);

			if (driver) {
				await driver.quit().then(() => {
					driver = undefined as unknown as typeof driver;
				});
			}
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

			baseTests.forEach(([expression, errorName]: unknown[]) => {
				if (String(expression).includes('return')) return;
				it(`${expression} ${
					errorName === true
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
						errorName === true
							? [true]
							: [
									null,
									{
										name:
											// TODO: Handle this in a different
											// way. ReferenceError only happens
											// when not using globalProxy
											Array.isArray(errorName)
												? 'TypeError'
												: errorName,
									},
							  ],
					);
				});
			});

			baseTests.forEach(([expression, errorName]: unknown[]) => {
				it(`Task with ${expression} ${
					errorName === true
						? 'succeeds'
						: `causes error ${JSON.stringify(errorName)}`
				}`, async () => {
					const result = await driver.executeAsyncScript(
						`(async () => {
						const callback = arguments[arguments.length - 1];
						try {
							const sandbox = await m(
								${JSON.stringify(`module.exports={foo:function(){${expression}}}`)},
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
						errorName === true
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
										name:
											// TODO: Handle this in a different
											// way. ReferenceError only happens
											// when not using globalProxy
											Array.isArray(errorName)
												? 'TypeError'
												: errorName,
									},
							  ],
					);
				});
			});
		});
	};
