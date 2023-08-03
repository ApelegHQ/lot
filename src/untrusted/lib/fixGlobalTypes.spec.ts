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

import fixGlobalTypes from './fixGlobalTypes.js';
import { Worker } from 'node:worker_threads';

describe('fixGlobalTypes can run in an empty environment', async () => {
	it("doesn't crash", async () => {
		let res: { (): void }, rej: { (e?: unknown): void };

		const p = new Promise<void>((resolve, reject) => {
			res = resolve;
			rej = reject;
		});
		const w = new Worker(
			`(function(){
			with(new Proxy(this, { has(){return true} })) {
			const globalThis = this;
			const __buildtimeSettings__ = {fixGlobalTypes:!0};
			try {
				if (
					[
						typeof Object,
						typeof Function,
						typeof Boolean,
						typeof Error,
						typeof __$clearlySomethingThatShouldBeUndefined$__
					].reduce((acc, cv) => acc || cv !== 'undefined', false)
				) throw '$$_$$inv';
			} catch (e) {
				if (e === '$$_$$inv') throw 'invalid environment';
			}
			(${fixGlobalTypes.toString()})();
			}
			}).call(Object.create(null));`,
			{
				['workerData']: {},
				['env']: Object.create(null),
				['eval']: true,
			},
		);

		const v = setTimeout(() => {
			rej(new Error('Timed out'));
			w.terminate();
		}, 1500);

		w.on('error', (e) => {
			rej(e);
			clearTimeout(v);
			console.log('Crash information', e);
		});

		w.on('exit', (s) => {
			if (s === 0) {
				res();
			} else {
				rej(new Error('Exited with code: ' + String(s)));
			}
			clearTimeout(v);
		});

		await p;
	});
});
