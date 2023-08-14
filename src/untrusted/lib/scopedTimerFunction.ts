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

import { oCreate, oHasOwnProperty } from './utils.js';

type TSetTimer = typeof setImmediate | typeof setInterval | typeof setTimeout;

/**
 * Creates a scoped timer function which maps to a unique identifier and
 * provides a way to clear the timer. The goal of this function is to allow
 * using, e.g., setTimeout and clearTimeout without exposing values that
 * may be used to control these functions in the global scope.
 *
 * @template T
 * @param setTimer - The timer function, like `setImmediate`,
 * `setInterval`, or `setTimeout`.
 * @param clearTimer - A function to clear the timer with the same type as
 * the setTimer.
 * @returns - A tuple containing the scoped set timer and clear timer functions.
 *
 * @example
 * const [scopedSetTimeout, scopedClearTimeout] = scopedTimerFunction(setTimeout, clearTimeout);
 * const timerId = scopedSetTimeout(() => console.log('Hello, world!'), 1000);
 * scopedClearTimeout(timerId);
 */
const scopedTimerFunction = <T extends TSetTimer>(
	setTimer: T,
	clearTimer: { (id?: ReturnType<T>): void },
): [{ (...args: Parameters<T>): number }, { (id?: number): void }] => {
	let count = 0;
	const map: Record<number, ReturnType<T>> = oCreate(null);

	const scopedSetTimer = (...args: Parameters<T>): number => {
		if (typeof args[0] !== 'function') return 0;

		const curCount = ++count;

		const callback = args[0];
		args[0] = (...args: Parameters<typeof callback>) => {
			delete map[curCount];
			callback(...args);
		};
		const value = (
			setTimer as unknown as { (...a: typeof args): (typeof map)[number] }
		)(...args);
		map[curCount] = value;

		return curCount;
	};

	const scopedClearTimer = (id?: number) => {
		if (id && oHasOwnProperty(map, id)) {
			clearTimer(map[id]);
			delete map[id];
		}
	};

	return [scopedSetTimer, scopedClearTimer];
};

export default scopedTimerFunction;
