const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_WEBP_QUALITY = 0.85;
const RASTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export interface OptimizeImageOptions {
	maxDimension?: number;
	quality?: number;
}

function replaceExtensionWithWebp(filename: string): string {
	const trimmed = filename.trim();
	if (!trimmed) return 'upload.webp';
	const dotIdx = trimmed.lastIndexOf('.');
	const base = dotIdx > 0 ? trimmed.slice(0, dotIdx) : trimmed;
	return `${base}.webp`;
}

/**
 * Downscales oversized raster images to at most `maxDimension` px and converts
 * them to WebP in the browser using Canvas when the encoded output is smaller.
 * Returns the original File unchanged for SVG, non-image inputs, or SSR contexts.
 */
export async function optimizeImageFile(
	file: File,
	options: OptimizeImageOptions = {}
): Promise<File> {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return file;
	}

	if (!file || file.size <= 0) {
		return file;
	}

	const mime = file.type.toLowerCase();
	if (mime === 'image/svg+xml' || !RASTER_IMAGE_TYPES.has(mime)) {
		return file;
	}

	const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
	const quality = options.quality ?? DEFAULT_WEBP_QUALITY;

	try {
		const objectUrl = URL.createObjectURL(file);
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image();
			el.onload = () => resolve(el);
			el.onerror = () => reject(new Error('Image decode failed'));
			el.src = objectUrl;
		}).finally(() => {
			URL.revokeObjectURL(objectUrl);
		});

		const srcWidth = img.naturalWidth || img.width;
		const srcHeight = img.naturalHeight || img.height;
		if (srcWidth <= 0 || srcHeight <= 0) {
			return file;
		}

		const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
		const targetWidth = Math.max(1, Math.round(srcWidth * scale));
		const targetHeight = Math.max(1, Math.round(srcHeight * scale));

		const canvas = document.createElement('canvas');
		canvas.width = targetWidth;
		canvas.height = targetHeight;

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return file;
		}

		ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

		const webpBlob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
		});

		if (!webpBlob || webpBlob.size <= 0) {
			return file;
		}

		// Keep original when resizing wasn't needed and original is already smaller
		if (scale === 1 && webpBlob.size >= file.size) {
			return file;
		}

		return new File([webpBlob], replaceExtensionWithWebp(file.name), {
			type: 'image/webp',
			lastModified: Date.now()
		});
	} catch {
		return file;
	}
}

/**
 * Optimizes the selected image file on an <input type="file"> element in place
 * using DataTransfer so standard HTML multipart form submissions send WebP bytes.
 */
export async function optimizeFileInputOnChange(
	event: Event,
	options?: OptimizeImageOptions
): Promise<File | null> {
	const input = event.currentTarget as HTMLInputElement | null;
	const original = input?.files?.[0];
	if (!input || !original) {
		return null;
	}

	const optimized = await optimizeImageFile(original, options);
	if (optimized !== original && typeof DataTransfer !== 'undefined') {
		const dt = new DataTransfer();
		dt.items.add(optimized);
		input.files = dt.files;
	}

	return optimized;
}
