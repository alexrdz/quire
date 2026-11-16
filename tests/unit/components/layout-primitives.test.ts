import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Stack from '../../../src/lib/components/layout/Stack.svelte';
import Box from '../../../src/lib/components/layout/Box.svelte';
import Cluster from '../../../src/lib/components/layout/Cluster.svelte';
import Grid from '../../../src/lib/components/layout/Grid.svelte';
import Center from '../../../src/lib/components/layout/Center.svelte';
import Split from '../../../src/lib/components/layout/Split.svelte';
import Switcher from '../../../src/lib/components/layout/Switcher.svelte';
import Cover from '../../../src/lib/components/layout/Cover.svelte';
import Frame from '../../../src/lib/components/layout/Frame.svelte';
import Reel from '../../../src/lib/components/layout/Reel.svelte';
import Container from '../../../src/lib/components/layout/Container.svelte';

describe('Layout Primitives (CUBE CSS)', () => {
	it('renders Stack with data-stack attributes and polymorphic tag', () => {
		const res = render(Stack, {
			props: {
				gap: 'md',
				align: 'center',
				as: 'section'
			}
		});
		expect(res.html).toContain('<section');
		expect(res.html).toContain('data-stack="gap:md align:center"');
	});

	it('renders Box with data-box attributes and variants', () => {
		const res = render(Box, {
			props: {
				padding: 'lg',
				border: 'none',
				radius: 'md',
				variant: 'raised'
			}
		});
		expect(res.html).toContain('data-box="padding:lg variant:raised border:none radius:md"');
	});

	it('renders Box with invert variant', () => {
		const res = render(Box, {
			props: {
				padding: 'sm',
				variant: 'invert'
			}
		});
		expect(res.html).toContain('data-box="padding:sm invert"');
	});

	it('renders Cluster with data-cluster attributes', () => {
		const res = render(Cluster, {
			props: {
				gap: 'sm',
				align: 'center',
				justify: 'between',
				nowrap: true
			}
		});
		expect(res.html).toContain('data-cluster="gap:sm justify:between align:center nowrap"');
	});

	it('renders Grid with data-grid attributes', () => {
		const res = render(Grid, {
			props: {
				min: '250px',
				gap: 'lg'
			}
		});
		expect(res.html).toContain('data-grid="min:250px gap:lg"');
	});

	it('renders Center with data-center attributes', () => {
		const res = render(Center, {
			props: {
				max: 'measure',
				padding: 'md',
				intrinsic: true,
				centerText: true,
				centerVertically: true
			}
		});
		expect(res.html).toContain('data-center="max:measure padding:md intrinsic center:text center:vertically"');
	});

	it('renders Split with data-split attributes', () => {
		const res = render(Split, {
			props: {
				ratio: '1-2',
				gap: 'md',
				collapse: 'sm',
				align: 'center'
			}
		});
		expect(res.html).toContain('data-split="ratio:1-2 gap:md collapse:sm align:center"');
	});

	it('renders Switcher with data-switcher attributes', () => {
		const res = render(Switcher, {
			props: {
				collapse: 'lg',
				gap: 'md',
				limit: 3,
				align: 'center'
			}
		});
		expect(res.html).toContain('data-switcher="collapse:lg limit:3 gap:md align:center"');
	});

	it('renders Cover with data-cover attributes', () => {
		const res = render(Cover, {
			props: {
				padding: 'sm',
				height: 100
			}
		});
		expect(res.html).toContain('data-cover="padding:sm height:100"');
	});

	it('renders Frame with data-frame attributes', () => {
		const res = render(Frame, {
			props: {
				ratio: '16:9'
			}
		});
		expect(res.html).toContain('data-frame="ratio:16:9"');
	});

	it('renders Reel with data-reel attributes', () => {
		const res = render(Reel, {
			props: {
				gap: 'md',
				items: 3,
				snap: 'center'
			}
		});
		expect(res.html).toContain('data-reel="gap:md items:3 snap:center"');
	});

	it('renders Container with data-container attributes', () => {
		const res = render(Container, {
			props: {
				width: 'main',
				padding: 'md'
			}
		});
		expect(res.html).toContain('data-container="width:main padding:md"');
	});
});
