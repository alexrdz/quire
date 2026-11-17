import { redirect, type RequestHandler } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies, url }) => {
	await clearSessionCookie(cookies);
	const redirectTo = url.searchParams.get('redirect') || '/';
	throw redirect(303, redirectTo);
};

export const GET: RequestHandler = async ({ cookies, url }) => {
	await clearSessionCookie(cookies);
	const redirectTo = url.searchParams.get('redirect') || '/';
	throw redirect(303, redirectTo);
};
