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

import './nodejsLoadWebcrypto.js'; // MUST BEFORE ANY LOCAL IMPORTS

import assert from 'node:assert/strict';
import getRandomSecret from './getRandomSecret.js';

const multiply = (v: number[], min: number, max: number): number =>
	v.reduce((acc, cv) => acc + Math.log((cv - min + 1) / (max - min + 1)), 0) /
	v.length;

describe('getRandomSecret', () => {
	// NOTE: These tests only verify that the values look random enough, not
	// that they actually are. They are meant to catch an obviously broken
	// function, but they do not protect against a weak, compromised or broken
	// (CS)PRNG provided by the host platform.
	it('Generates random values', () => {
		const randomSecrets = Array<void>(512).fill().map(getRandomSecret);

		randomSecrets.forEach((v) => {
			assert.ok(/^[A-P]{32}$/.test(v));
		});

		// Verify uniqueness
		assert.equal(new Set(randomSecrets).size, randomSecrets.length);

		const characters = randomSecrets
			.flatMap((v) => v.split(''))
			.map((v) => v.charCodeAt(0));

		const normalProduct = multiply(
			characters,
			'A'.charCodeAt(0),
			'P'.charCodeAt(0),
		);

		// Verify distribution
		assert.ok(Math.abs(normalProduct - -0.8555) <= 0.03125);

		const dist: Record<number, number> = {};
		characters.forEach((cv) => (dist[cv] = (dist[cv] || 0) + 1));

		const expectedFrequency =
			characters.length / ('P'.charCodeAt(0) - 'A'.charCodeAt(0) + 1);

		Object.values(dist).forEach((n) => {
			assert.ok(Math.abs(n - expectedFrequency) < expectedFrequency / 8);
		});
	});
});
