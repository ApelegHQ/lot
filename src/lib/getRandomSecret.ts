const bufferToHex = (buffer: Uint8Array) =>
	Array.prototype.map
		.call(buffer, (v) =>
			String.fromCharCode(
				1 + (0x40 | ((v >> 4) & 0x0f)),
				1 + (0x40 | ((v >> 0) & 0x0f)),
			),
		)
		.join('');

const getRandomSecret = (): string =>
	bufferToHex(self.crypto.getRandomValues(new Uint8Array(16)));

export default getRandomSecret;
