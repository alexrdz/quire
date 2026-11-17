export type FooterLink = Readonly<{ label: string; href: string }>;

export type FooterGroup = Readonly<{
	heading: string;
	links: readonly FooterLink[];
}>;

export const FOOTER_GROUPS: readonly FooterGroup[] = [
	{
		heading: 'Platform',
		links: [
			{ label: 'Claim your zine', href: '/login?mode=signup' },
			{ label: 'Artist login', href: '/login' },
			{ label: 'Fan stubs wallet', href: '/me/stubs' }
		]
	},
	{
		heading: 'Featured tour',
		links: [
			{ label: 'The Neon Velvet hub', href: '/a/the-neon-velvet' },
			{ label: 'Brooklyn kickoff zine', href: '/i/neon-velvet-brooklyn-2026-10-12' },
			{ label: 'Philadelphia gig zine', href: '/i/neon-velvet-philly-2026-10-15' },
			{ label: 'DC main stage zine', href: '/i/neon-velvet-dc-2026-10-18' }
		]
	},
	{
		heading: 'Support',
		links: [
			{ label: 'FAQ', href: '/faq' },
			{ label: 'Contact support', href: '/support' }
		]
	},
	{
		heading: 'Legal',
		links: [
			{ label: 'Terms of Service', href: '/legal/terms' },
			{ label: 'Privacy Policy', href: '/legal/privacy' }
		]
	}
] as const;

export const LEGAL_LINKS: readonly FooterLink[] = [
	{ label: 'Terms', href: '/legal/terms' },
	{ label: 'Privacy', href: '/legal/privacy' },
	{ label: 'FAQ', href: '/faq' }
] as const;

export const LEGAL_ENTITY = 'Tech-Mex, LLC';
export const SUPPORT_EMAIL = 'support@quire.live';
export const LEGAL_UPDATED = 'November 17, 2026';
