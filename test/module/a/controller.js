const moduleTitle = 'Sample Module A — Hero Banner';
const moduleDescription = 'Demonstrates pulling LogicManifest metadata into an Express + EJS view.';

const defaultFormValues = {
  headline: 'Welcome to LogicManifest',
  subheading: 'Build composable UI modules faster.',
  ctaLabel: 'Launch Module',
  destinationUrl: 'https://logic-auto.dev/docs',
};

const formFields = [
  { name: 'headline', label: 'Headline', type: 'text', placeholder: 'Welcome headline' },
  { name: 'subheading', label: 'Subheading', type: 'text', placeholder: 'Supportive message' },
  { name: 'ctaLabel', label: 'CTA Label', type: 'text', placeholder: 'Get Started' },
  { name: 'destinationUrl', label: 'Destination URL', type: 'url', placeholder: 'https://example.com' },
];

export const moduleDefinition = {
  slug: 'sample-a',
  title: moduleTitle,
  description: moduleDescription,
  model: ({ manifestJSON }) => buildHeroModel({ manifestJSON }),
};

export function buildHeroModel({ manifestJSON } = {}) {
  return {
    highlights: [
      'Reusable hero layout',
      `Manifest kind: ${manifestJSON?.kind ?? 'module'}`,
      `Layer: ${manifestJSON?.layer ?? 'ui'}`,
    ],
  };
}

export function buildFormModel({ manifestJSON } = {}) {
  return {
    formHeading: 'Hero Banner Quick Draft',
    submissionNote: 'TODO: wire up POST /modules/sample-a/form to persist submissions.',
    fields: formFields,
    defaults: { ...defaultFormValues },
    manifestSummary: buildManifestSummary(manifestJSON),
  };
}

function buildManifestSummary(manifestJSON = {}) {
  return {
    packageName: manifestJSON.packageName ?? '@logic-auto/sample-a',
    version: manifestJSON.version ?? '1.0.0',
    tags: manifestJSON.tags ?? [],
  };
}
