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
import { Options as ChromeOptions } from 'selenium-webdriver/chrome.js';
import { Options as EdgeOptions } from 'selenium-webdriver/edge.js';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { Options as SafariOptions } from 'selenium-webdriver/safari.js';
// eslint-disable-next-line prettier/prettier
import baseTests from './baseTests.json' assert { type: 'json' };

export const enabledBrowsers = () => {
	const webdriverBrowsers = new Set(
		process.env.WEBDRIVER_BROWSERS?.split(/[ ,;]/) ??
			[
				webdriver.Browser.CHROME,
				webdriver.Browser.EDGE,
				webdriver.Browser.FIREFOX,
				webdriver.Browser.SAFARI,
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
edgeOptions.addArguments('--headless=new');

const firefoxOptions = new FirefoxOptions();
firefoxOptions.addArguments('--headless');

const safariOptions = new SafariOptions();

export const webdriverTestSuites =
	(codePromise: Promise<string>, browserName: string) =>
	async (
		t: Pick<typeof import('node:test'), 'before' | 'after' | 'test'>,
	) => {
		let driver: webdriver.WebDriver;
		let code: string;

		t.before(
			async () => {
				await Promise.all([
					(async () => {
						code = await codePromise;
					})(),
					(async () => {
						try {
							const driver_ = await new webdriver.Builder()
								.forBrowser(browserName)
								.setChromeOptions(chromeOptions)
								.setEdgeOptions(edgeOptions)
								.setFirefoxOptions(firefoxOptions)
								.setSafariOptions(safariOptions)
								.build();

							await driver_.get('about:blank');

							driver = driver_;
						} catch (e) {
							if (
								e &&
								e instanceof Error &&
								(e.message.includes(
									'Unable to obtain browser driver',
								) ||
									(e.name === 'WebDriverError' &&
										e.message.includes(
											'unknown error: cannot find',
										)) ||
									e.name === 'SessionNotCreatedError')
							) {
								return;
							}
							throw e;
						}
					})(),
				]);

				if (!driver) {
					(t as unknown as Record<string, typeof Boolean>)['skip'](
						'Driver unavailable',
					);
					return;
				}

				await driver.executeScript(
					code + '; console.log("SCRIPT SUCCESSFULLY LOADED");',
				);
			},
			{ timeout: 12e4 },
		);

		t.after(
			async () => {
				if (driver) {
					await driver.quit().then(() => {
						driver = undefined as unknown as typeof driver;
					});
				}
			},
			{ timeout: 30e3 },
		);

		await t.test('Can run tasks', async (t) => {
			if (!driver) {
				t.skip();
				return;
			}

			await t.test('should return result for sync task', async () => {
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

			await t.test('should return result for async task', async () => {
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

			await t.test(
				'should return result for multiple arguments',
				async () => {
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
				},
			);
		});

		await t.test('Error conditions', async (t) => {
			if (!driver) {
				t.skip();
				return;
			}

			await t.test('invalid syntax causes error', async () => {
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

			await Promise.all(
				baseTests.map(([expression, errorName]: unknown[]) => {
					if (String(expression).includes('return')) return;
					return t.test(
						`${expression} ${
							errorName === true
								? 'succeeds'
								: `causes error ${JSON.stringify(errorName)}`
						}`,
						async () => {
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
						},
					);
				}),
			);

			await Promise.all(
				baseTests.map(([expression, errorName]: unknown[]) => {
					return t.test(
						`Task with ${expression} ${
							errorName === true
								? 'succeeds'
								: `causes error ${JSON.stringify(errorName)}`
						}`,
						async () => {
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
						},
					);
				}),
			);
		});
	};
