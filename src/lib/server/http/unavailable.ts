/**
 * Tier-1 failure page (ADR 0007, decision 30): served for every request when the
 * core configuration is invalid. Static HTML with no app imports, so it renders
 * even when the database and auth cannot start.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Quire is temporarily unavailable</title>
<style>
body { margin: 0; min-block-size: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #f6f1e7; color: #1f1b16; }
main { max-inline-size: 32rem; padding-inline: 1.5rem; text-align: center; }
h1 { font-size: 1.5rem; margin-block: 0 0.75rem; }
p { line-height: 1.5; margin-block: 0; }
</style>
</head>
<body>
<main>
<h1>Quire is temporarily unavailable</h1>
<p>We're working on it. Please try again in a few minutes.</p>
</main>
</body>
</html>`;

export function unavailableResponse(): Response {
	return new Response(PAGE, {
		status: 503,
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'no-store',
			'retry-after': '300'
		}
	});
}
