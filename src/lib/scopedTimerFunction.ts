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

type TSetTimer = typeof setImmediate | typeof setInterval | typeof setTimeout;

const scopedTimerFunction = <T extends TSetTimer>(
	setTimer: T,
	clearTimer: { (id?: ReturnType<T>): void },
): [{ (...args: Parameters<T>): number }, { (id?: number): void }] => {
	let count = 0;
	const map: Record<number, ReturnType<T>> = Object.create(null);

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
		if (id && Object.prototype.hasOwnProperty.call(map, id)) {
			clearTimer(map[id]);
			delete map[id];
		}
	};

	return [scopedSetTimer, scopedClearTimer];
};

export default scopedTimerFunction;
