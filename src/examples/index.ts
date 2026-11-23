// Screens that load instantly, without calling the API. They are written in the
// same format the model returns and are checked by the test suite, so they also
// serve as the reference output for the prompt.

import type { UiDocument } from '../shared/catalog.js';

export interface Example {
  prompt: string;
  document: UiDocument;
}

const signUp: Example = {
  prompt: 'A sign-up form for a project management tool, with name, work email, password, team size and terms',
  document: {
    title: 'Sign-up form',
    nodes: [
      { id: 'page', parent: null, component: 'Stack', props: { direction: 'vertical', gap: 'lg', align: 'stretch', justify: 'start', wrap: false } },
      { id: 'intro', parent: 'page', component: 'Stack', props: { direction: 'vertical', gap: 'sm', align: 'start', justify: 'start', wrap: false } },
      { id: 'eyebrow', parent: 'intro', component: 'Badge', props: { label: '14-day free trial', variant: 'primary', dot: true } },
      { id: 'heading', parent: 'intro', component: 'Typography', props: { variant: 'h1', color: 'primary', text: 'Create your workspace' } },
      { id: 'lede', parent: 'intro', component: 'Typography', props: { variant: 'bodyLg', color: 'secondary', text: 'Plan sprints, track work and ship with your team. No card needed.' } },
      {
        id: 'signup-form',
        parent: 'page',
        component: 'Form',
        props: {
          title: null,
          description: null,
          submitLabel: 'Create workspace',
          fields: [
            { type: 'input', name: 'name', label: 'Full name', required: true, inputType: 'text', placeholder: 'Laura Martínez' },
            { type: 'input', name: 'email', label: 'Work email', required: true, inputType: 'email', placeholder: 'laura@northwind.io' },
            { type: 'input', name: 'password', label: 'Password', required: true, inputType: 'password', placeholder: null },
            {
              type: 'select',
              name: 'teamSize',
              label: 'Team size',
              required: true,
              options: [
                { value: '1-5', label: '1 to 5 people' },
                { value: '6-20', label: '6 to 20 people' },
                { value: '21-100', label: '21 to 100 people' },
                { value: '100+', label: 'More than 100' },
              ],
            },
            { type: 'checkbox', name: 'terms', label: 'I agree to the Terms of Service and Privacy Policy', required: true },
          ],
        },
      },
      { id: 'signin', parent: 'page', component: 'Typography', props: { variant: 'bodySm', color: 'secondary', text: 'Already have a workspace? Sign in instead.' } },
    ],
  },
};

const plan = (id: string, name: string, price: number | null, blurb: string, features: string[], featured: boolean) => [
  { id, parent: 'plans', component: 'Card', props: { variant: featured ? 'default' : 'outlined' } },
  { id: `${id}-header`, parent: id, component: 'CardHeader', props: {} },
  { id: `${id}-top`, parent: `${id}-header`, component: 'Stack', props: { direction: 'horizontal', gap: 'sm', align: 'center', justify: 'between', wrap: false } },
  { id: `${id}-name`, parent: `${id}-top`, component: 'Typography', props: { variant: 'h2', color: 'primary', text: name } },
  ...(featured ? [{ id: `${id}-badge`, parent: `${id}-top`, component: 'Badge', props: { label: 'Most popular', variant: 'primary', dot: false } }] : []),
  { id: `${id}-body`, parent: id, component: 'CardBody', props: {} },
  { id: `${id}-content`, parent: `${id}-body`, component: 'Stack', props: { direction: 'vertical', gap: 'md', align: 'stretch', justify: 'start', wrap: false } },
  price === null
    ? { id: `${id}-price`, parent: `${id}-content`, component: 'Typography', props: { variant: 'h3', color: 'primary', text: 'Custom pricing' } }
    : { id: `${id}-price`, parent: `${id}-content`, component: 'Stat', props: { value: price, decimals: '0', prefix: '€', suffix: price ? ' / seat' : null, label: price ? 'per month, billed yearly' : 'free forever', delta: null, trend: null } },
  { id: `${id}-blurb`, parent: `${id}-content`, component: 'Typography', props: { variant: 'bodySm', color: 'secondary', text: blurb } },
  { id: `${id}-divider`, parent: `${id}-content`, component: 'Divider', props: { label: null, spacing: 'none' } },
  ...features.map((feature, i) => ({
    id: `${id}-feature-${i}`,
    parent: `${id}-content`,
    component: 'Typography',
    props: { variant: 'body', color: 'primary', text: feature },
  })),
  { id: `${id}-footer`, parent: id, component: 'CardFooter', props: { divider: false } },
  {
    id: `${id}-cta`,
    parent: `${id}-footer`,
    component: 'Button',
    props: { variant: featured ? 'primary' : 'secondary', size: 'md', fullWidth: true, text: name === 'Enterprise' ? 'Talk to sales' : `Choose ${name}` },
  },
];

const pricing: Example = {
  prompt: 'A pricing page with three plans for a design tool, highlighting the middle one',
  document: {
    title: 'Pricing plans',
    nodes: [
      { id: 'page', parent: null, component: 'Stack', props: { direction: 'vertical', gap: 'xl', align: 'stretch', justify: 'start', wrap: false } },
      { id: 'intro', parent: 'page', component: 'Stack', props: { direction: 'vertical', gap: 'sm', align: 'start', justify: 'start', wrap: false } },
      { id: 'heading', parent: 'intro', component: 'Typography', props: { variant: 'h1', color: 'primary', text: 'Simple pricing for every team' } },
      { id: 'lede', parent: 'intro', component: 'Typography', props: { variant: 'bodyLg', color: 'secondary', text: 'Start free, upgrade when you need more seats. Cancel any time.' } },
      { id: 'plans', parent: 'page', component: 'Grid', props: { columns: '3', gap: 'lg' } },
      ...plan('starter', 'Starter', 0, 'For individuals exploring ideas.', ['3 active projects', 'Export to PNG and SVG', 'Community support'], false),
      ...plan('pro', 'Pro', 12, 'For teams that design together every day.', ['Unlimited projects', 'Shared component libraries', 'Version history for 90 days'], true),
      ...plan('enterprise', 'Enterprise', null, 'For organisations with security needs.', ['SSO and SCIM provisioning', 'Unlimited version history', 'Dedicated success manager'], false),
    ] as UiDocument['nodes'],
  },
};

const team: Example = {
  prompt: 'An admin screen to manage team members: a summary, a search field and a table with roles and status',
  document: {
    title: 'Team members',
    nodes: [
      { id: 'page', parent: null, component: 'Stack', props: { direction: 'vertical', gap: 'lg', align: 'stretch', justify: 'start', wrap: false } },
      { id: 'top', parent: 'page', component: 'Stack', props: { direction: 'horizontal', gap: 'md', align: 'end', justify: 'between', wrap: true } },
      { id: 'titles', parent: 'top', component: 'Stack', props: { direction: 'vertical', gap: 'sm', align: 'start', justify: 'start', wrap: false } },
      { id: 'heading', parent: 'titles', component: 'Typography', props: { variant: 'h1', color: 'primary', text: 'Team members' } },
      { id: 'lede', parent: 'titles', component: 'Typography', props: { variant: 'body', color: 'secondary', text: '12 people in Northwind Studio, 2 invitations pending.' } },
      { id: 'invite', parent: 'top', component: 'Button', props: { variant: 'primary', size: 'md', fullWidth: false, text: 'Invite member' } },
      { id: 'seats', parent: 'page', component: 'Alert', props: { variant: 'warning', title: '2 seats left', text: 'Your Pro plan includes 14 seats. Add more before inviting a larger group.' } },
      { id: 'search', parent: 'page', component: 'Input', props: { label: 'Search members', inputType: 'search', placeholder: 'Name or email', hint: null, required: false } },
      {
        id: 'members',
        parent: 'page',
        component: 'DataTable',
        props: {
          columns: [
            { key: 'name', header: 'Name', align: 'left' },
            { key: 'email', header: 'Email', align: 'left' },
            { key: 'role', header: 'Role', align: 'left' },
            { key: 'lastActive', header: 'Last active', align: 'right' },
          ],
          rows: [
            { cells: ['Laura Martínez', 'laura@northwind.io', 'Owner', 'Today'] },
            { cells: ['Jordi Puig', 'jordi@northwind.io', 'Admin', 'Today'] },
            { cells: ['Aisha Khan', 'aisha@northwind.io', 'Editor', 'Yesterday'] },
            { cells: ['Tom Becker', 'tom@northwind.io', 'Editor', '3 days ago'] },
            { cells: ['Nora Lind', 'nora@northwind.io', 'Viewer', '2 weeks ago'] },
          ],
          striped: false,
          dense: false,
        },
      },
    ],
  },
};

const settings: Example = {
  prompt: 'A notification settings page for a banking app, with a profile card and channel preferences',
  document: {
    title: 'Notification settings',
    nodes: [
      { id: 'page', parent: null, component: 'Stack', props: { direction: 'vertical', gap: 'lg', align: 'stretch', justify: 'start', wrap: false } },
      { id: 'heading', parent: 'page', component: 'Typography', props: { variant: 'h1', color: 'primary', text: 'Notifications' } },
      { id: 'profile', parent: 'page', component: 'Card', props: { variant: 'outlined' } },
      { id: 'profile-body', parent: 'profile', component: 'CardBody', props: {} },
      { id: 'profile-row', parent: 'profile-body', component: 'Stack', props: { direction: 'horizontal', gap: 'md', align: 'center', justify: 'start', wrap: false } },
      { id: 'avatar', parent: 'profile-row', component: 'Avatar', props: { initials: 'MP', size: 'lg', status: 'online' } },
      { id: 'profile-text', parent: 'profile-row', component: 'Stack', props: { direction: 'vertical', gap: 'none', align: 'start', justify: 'start', wrap: false } },
      { id: 'profile-name', parent: 'profile-text', component: 'Typography', props: { variant: 'h2', color: 'primary', text: 'Marta Pérez' } },
      { id: 'profile-email', parent: 'profile-text', component: 'Typography', props: { variant: 'bodySm', color: 'secondary', text: 'marta.perez@email.com · Current account ending 4821' } },
      { id: 'alerts', parent: 'page', component: 'Card', props: { variant: 'default' } },
      { id: 'alerts-header', parent: 'alerts', component: 'CardHeader', props: {} },
      { id: 'alerts-title', parent: 'alerts-header', component: 'Typography', props: { variant: 'h2', color: 'primary', text: 'What to tell me about' } },
      { id: 'alerts-body', parent: 'alerts', component: 'CardBody', props: {} },
      { id: 'alerts-list', parent: 'alerts-body', component: 'Stack', props: { direction: 'vertical', gap: 'md', align: 'start', justify: 'start', wrap: false } },
      { id: 'alert-payments', parent: 'alerts-list', component: 'Checkbox', props: { label: 'Card payments over €50', checked: true } },
      { id: 'alert-salary', parent: 'alerts-list', component: 'Checkbox', props: { label: 'Incoming transfers and salary', checked: true } },
      { id: 'alert-low', parent: 'alerts-list', component: 'Checkbox', props: { label: 'Balance below €100', checked: false } },
      { id: 'alert-offers', parent: 'alerts-list', component: 'Checkbox', props: { label: 'Offers and product news', checked: false } },
      {
        id: 'channel',
        parent: 'alerts-list',
        component: 'RadioGroup',
        props: {
          name: 'channel',
          label: 'Send them by',
          direction: 'horizontal',
          options: [
            { value: 'push', label: 'Push notification' },
            { value: 'sms', label: 'SMS' },
            { value: 'email', label: 'Email' },
          ],
        },
      },
      { id: 'alerts-footer', parent: 'alerts', component: 'CardFooter', props: { divider: true } },
      { id: 'actions', parent: 'alerts-footer', component: 'Stack', props: { direction: 'horizontal', gap: 'sm', align: 'center', justify: 'end', wrap: false } },
      { id: 'cancel', parent: 'actions', component: 'Button', props: { variant: 'ghost', size: 'md', fullWidth: false, text: 'Cancel' } },
      { id: 'save', parent: 'actions', component: 'Button', props: { variant: 'primary', size: 'md', fullWidth: false, text: 'Save preferences' } },
    ],
  },
};

export const EXAMPLES: readonly Example[] = [signUp, pricing, team, settings];
