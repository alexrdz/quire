import crypto from 'node:crypto';
import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { normalizeArtistSlug, suggestAlternativeSlugs } from '$domain/theme';
import { artistLoginSchema, artistSignupSchema, safeRedirectPathSchema } from '$schemas/auth';
import { auth, createSessionForUser } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';

function resolveRedirectTarget(rawRedirect: string | null | undefined): {
	redirectTo: string;
	hasExplicitRedirect: boolean;
} {
	if (!rawRedirect) {
		return { redirectTo: '/dashboard', hasExplicitRedirect: false };
	}
	const parsed = safeRedirectPathSchema.safeParse(rawRedirect);
	if (!parsed.success) {
		return { redirectTo: '/dashboard', hasExplicitRedirect: false };
	}
	return { redirectTo: parsed.data, hasExplicitRedirect: true };
}

async function getAvailableSlugSuggestions(baseSlug: string): Promise<string[]> {
	const candidates = suggestAlternativeSlugs(baseSlug);
	if (candidates.length === 0) return [];

	const takenRows = await db
		.select({ slug: schema.artists.slug })
		.from(schema.artists)
		.where(inArray(schema.artists.slug, candidates));

	const takenSet = new Set(takenRows.map((row) => row.slug));
	return candidates.filter((candidate) => !takenSet.has(candidate)).slice(0, 4);
}

export const load: ServerLoad = async ({ request, url }) => {
	await seedDatabase();

	const session = await auth.api.getSession({
		headers: request.headers
	});

	const { redirectTo, hasExplicitRedirect } = resolveRedirectTarget(
		url.searchParams.get('redirect')
	);
	const initialMode =
		url.searchParams.get('mode') === 'signup' ? ('signup' as const) : ('login' as const);
	const resetSuccess = url.searchParams.get('reset') === 'success';

	const defaultRole =
		url.searchParams.get('role') === 'fan' ||
		redirectTo.startsWith('/i/') ||
		redirectTo.startsWith('/a/') ||
		redirectTo.startsWith('/me/')
			? ('fan' as const)
			: ('artist' as const);

	if (session?.user) {
		throw redirect(303, redirectTo);
	}

	return {
		redirectTo,
		hasExplicitRedirect,
		defaultRole,
		initialMode,
		resetSuccess
	};
};

export const actions: Actions = {
	login: async ({ request, url, cookies }) => {
		await seedDatabase();
		const formData = await request.formData();
		const emailRaw = String(formData.get('email') || '');
		const password = String(formData.get('password') || '');
		const rawRedirect =
			String(formData.get('redirectTo') || '') || url.searchParams.get('redirect') || undefined;

		const parsed = artistLoginSchema.safeParse({
			email: emailRaw,
			password,
			redirectTo: rawRedirect
		});

		if (!parsed.success) {
			return fail(400, {
				mode: 'login' as const,
				error: parsed.error.issues[0]?.message || 'Please enter both email and password.',
				values: { email: emailRaw.trim() }
			});
		}

		try {
			const res = await auth.api.signInEmail({
				body: {
					email: parsed.data.email,
					password: parsed.data.password
				},
				headers: request.headers
			});

			if (!res?.user?.id) {
				return fail(400, {
					mode: 'login' as const,
					error: 'Invalid email or password.',
					values: { email: parsed.data.email }
				});
			}

			await createSessionForUser(cookies, res.user.id);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Invalid email or password.';
			return fail(400, {
				mode: 'login' as const,
				error: message,
				values: { email: parsed.data.email }
			});
		}

		throw redirect(303, parsed.data.redirectTo || '/dashboard');
	},

	signup: async ({ request, url, cookies }) => {
		await seedDatabase();
		const formData = await request.formData();
		const nameRaw = String(formData.get('name') || '');
		const slugRaw = String(formData.get('slug') || '');
		const emailRaw = String(formData.get('email') || '');
		const password = String(formData.get('password') || '');
		const rawRedirect =
			String(formData.get('redirectTo') || '') || url.searchParams.get('redirect') || undefined;

		const normalizedSlug = normalizeArtistSlug(slugRaw || nameRaw);

		const parsed = artistSignupSchema.safeParse({
			name: nameRaw,
			slug: normalizedSlug,
			email: emailRaw,
			password,
			redirectTo: rawRedirect
		});

		if (!parsed.success) {
			const slugIssue = parsed.error.issues.find((issue) => issue.path.includes('slug'));
			const slugSuggestions = slugIssue
				? await getAvailableSlugSuggestions(normalizedSlug || nameRaw)
				: undefined;

			return fail(400, {
				mode: 'signup' as const,
				error:
					parsed.error.issues[0]?.message ||
					'Band name, artist handle, valid email, and a password of at least 8 characters are required.',
				slugSuggestions,
				values: {
					name: nameRaw.trim(),
					email: emailRaw.trim().toLowerCase(),
					slug: normalizedSlug
				}
			});
		}

		const cleanSlug = parsed.data.slug ?? normalizedSlug;

		// First-come, first-served collision check before creating the Better Auth user
		const existingArtist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, cleanSlug)
		});

		if (existingArtist) {
			const slugSuggestions = await getAvailableSlugSuggestions(cleanSlug);
			return fail(409, {
				mode: 'signup' as const,
				error: `The handle "/a/${cleanSlug}" is already claimed. Choose a different handle or pick an available option below.`,
				slugSuggestions,
				values: {
					name: parsed.data.name,
					email: parsed.data.email,
					slug: cleanSlug
				}
			});
		}

		let userId: string | null = null;

		try {
			const res = await auth.api.signUpEmail({
				body: {
					email: parsed.data.email,
					password: parsed.data.password,
					name: parsed.data.name,
					accountType: 'artist'
				},
				headers: request.headers
			});
			userId = res?.user?.id ?? null;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Failed to create account.';
			return fail(400, {
				mode: 'signup' as const,
				error: message,
				values: {
					name: parsed.data.name,
					email: parsed.data.email,
					slug: cleanSlug
				}
			});
		}

		if (!userId) {
			return fail(400, {
				mode: 'signup' as const,
				error: 'Could not create artist account.',
				values: {
					name: parsed.data.name,
					email: parsed.data.email,
					slug: cleanSlug
				}
			});
		}

		const artistId = crypto.randomUUID();
		const now = new Date();

		try {
			await db.insert(schema.artists).values({
				id: artistId,
				userId,
				slug: cleanSlug,
				displayName: parsed.data.name,
				bio: 'Live digital zines and tour archive on Quire.',
				accentColor: '#05D9E8',
				typePairing: 'sans-serif',
				tipPresetsJson: '[3, 5, 10]',
				linksJson: '[]',
				payoutsEnabled: false,
				verified: false,
				generalWallApproveFirst: false,
				createdAt: now,
				updatedAt: now
			});

			await db.insert(schema.templatePages).values({
				id: crypto.randomUUID(),
				artistId,
				position: 1,
				kind: 'text',
				contentJson: JSON.stringify({
					title: `About ${parsed.data.name}`,
					body: 'Thanks for coming out to the show. Sign the Wall and grab your attendance stub on the Endpaper.'
				}),
				createdAt: now
			});
		} catch {
			// Roll back user if artist slug raced between check and insert
			await db.delete(schema.users).where(eq(schema.users.id, userId));
			const slugSuggestions = await getAvailableSlugSuggestions(cleanSlug);
			return fail(409, {
				mode: 'signup' as const,
				error: `The handle "/a/${cleanSlug}" was just claimed. Please choose another handle.`,
				slugSuggestions,
				values: {
					name: parsed.data.name,
					email: parsed.data.email,
					slug: cleanSlug
				}
			});
		}

		await createSessionForUser(cookies, userId);

		const targetUrl =
			parsed.data.redirectTo && parsed.data.redirectTo !== '/dashboard'
				? parsed.data.redirectTo
				: '/dashboard?onboarding=1';

		throw redirect(303, targetUrl);
	},

	googleSignIn: async ({ request, url, cookies }) => {
		const formData = await request.formData();
		const rawRedirect =
			String(formData.get('redirectTo') || '') || url.searchParams.get('redirect') || '/me/stubs';
		const parsedRedirect = safeRedirectPathSchema.safeParse(rawRedirect);
		const redirectTo = parsedRedirect.success ? parsedRedirect.data : '/me/stubs';

		const hasGoogleKeys = Boolean(
			process.env.GOOGLE_CLIENT_ID &&
				process.env.GOOGLE_CLIENT_ID !== 'mock_google_client_id' &&
				process.env.GOOGLE_CLIENT_SECRET
		);

		if (hasGoogleKeys) {
			const res = await auth.api.signInSocial({
				body: {
					provider: 'google',
					callbackURL: redirectTo
				},
				headers: request.headers
			});
			if (res?.url) {
				throw redirect(303, res.url);
			}
		}

		// Local dev fallback when Google OAuth keys are not configured yet
		await seedDatabase();
		const fanUser = await db.query.users.findFirst({
			where: eq(schema.users.email, 'maya@example.com')
		});
		if (fanUser) {
			await createSessionForUser(cookies, fanUser.id);
		}
		throw redirect(303, redirectTo);
	}
};
