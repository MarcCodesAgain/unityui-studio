// The component catalog: the only building blocks the model may use.
//
// The same Zod schemas serve three jobs:
//   1. They are printed into the system prompt as compact type signatures.
//   2. The client validates each streamed node against them before rendering.
//   3. The evals validate every final document.
//
// Why not a strict structured output? The API compiles the schema into a
// grammar, and a union of 19 component types is too large to compile (it fits
// about 6). Validation in code plus evals gives the same safety without
// shrinking the catalog.
//
// The interface is a flat list of nodes that point to their parent by id, not a
// nested tree: parents come first, so the screen can render while it streams.
// Every prop is required; props that can be absent are nullable. That gives the
// model one obvious shape to fill.

import { z } from 'zod';

const id = z.string().describe('Unique, short, kebab-case id, for example "login-card".');
const parent = z
  .string()
  .nullable()
  .describe('Id of the container this node sits in, or null for a top-level node. The parent must appear earlier in the list.');

const option = z.object({ value: z.string(), label: z.string() });
const spacing = z.enum(['none', 'sm', 'md', 'lg', 'xl']);

function node<Name extends string, Props extends z.ZodRawShape>(component: Name, description: string, props: Props) {
  return z
    .object({ id, parent, component: z.literal(component), props: z.object(props) })
    .describe(description);
}

export const StackNode = node('Stack', 'Layout container that stacks its children in a row or a column.', {
  direction: z.enum(['vertical', 'horizontal']),
  gap: spacing,
  align: z.enum(['start', 'center', 'end', 'stretch']),
  justify: z.enum(['start', 'center', 'end', 'between']),
  wrap: z.boolean(),
});

export const GridNode = node('Grid', 'Layout container that places its children in equal-width columns. Collapses to one column on small screens.', {
  columns: z.enum(['2', '3', '4']),
  gap: spacing,
});

export const CardNode = node('Card', 'Bordered surface that groups related content. Put CardHeader, CardBody and CardFooter inside it.', {
  variant: z.enum(['default', 'outlined', 'ghost']),
});
export const CardHeaderNode = node('CardHeader', 'Top section of a Card. Only valid directly inside a Card.', {});
export const CardBodyNode = node('CardBody', 'Main section of a Card. Only valid directly inside a Card.', {});
export const CardFooterNode = node('CardFooter', 'Bottom section of a Card, usually for actions. Only valid directly inside a Card.', {
  divider: z.boolean().describe('Draw a line above the footer.'),
});

export const TypographyNode = node('Typography', 'Any text: headings, paragraphs, labels and captions.', {
  variant: z.enum(['display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'bodyLg', 'body', 'bodySm', 'label', 'caption', 'overline']),
  color: z.enum(['primary', 'secondary', 'accent']),
  text: z.string(),
});

export const StatNode = node('Stat', 'A big number with a small label: prices, totals, KPIs. Use it instead of a heading for any figure.', {
  value: z.number(),
  decimals: z.enum(['0', '1', '2']),
  prefix: z.string().nullable().describe('For example "€" or "$".'),
  suffix: z.string().nullable().describe('For example "%", "k" or " / month".'),
  label: z.string().nullable(),
  delta: z.string().nullable().describe('Change versus the previous period, for example "+12% vs last month".'),
  trend: z.enum(['up', 'down']).nullable(),
});

export const ButtonNode = node('Button', 'A button. Use primary for the main action, secondary or ghost for the rest.', {
  variant: z.enum(['primary', 'secondary', 'ghost']),
  size: z.enum(['sm', 'md', 'lg']),
  fullWidth: z.boolean(),
  text: z.string(),
});

export const InputNode = node('Input', 'Single-line text field with a visible label.', {
  label: z.string(),
  inputType: z.enum(['text', 'email', 'password', 'number', 'search', 'tel', 'url', 'date']),
  placeholder: z.string().nullable(),
  hint: z.string().nullable(),
  required: z.boolean(),
});

export const SelectNode = node('Select', 'Dropdown to pick one option.', {
  label: z.string(),
  placeholder: z.string().nullable(),
  options: z.array(option),
});

export const CheckboxNode = node('Checkbox', 'A single checkbox with its label.', {
  label: z.string(),
  checked: z.boolean(),
});

export const RadioGroupNode = node('RadioGroup', 'A labelled group of mutually exclusive options.', {
  name: z.string(),
  label: z.string(),
  options: z.array(option),
  direction: z.enum(['vertical', 'horizontal']),
});

export const BadgeNode = node('Badge', 'Small status or category label.', {
  label: z.string(),
  variant: z.enum(['default', 'primary', 'outline', 'ghost']),
  dot: z.boolean(),
});

export const AlertNode = node('Alert', 'Inline message about the state of the page.', {
  variant: z.enum(['info', 'success', 'warning', 'error']),
  title: z.string().nullable(),
  text: z.string(),
});

export const AvatarNode = node('Avatar', 'A person shown by their initials.', {
  initials: z.string(),
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']),
  status: z.enum(['online', 'offline', 'busy', 'away']).nullable(),
});

export const DividerNode = node('Divider', 'Horizontal line that separates content, optionally with a label.', {
  label: z.string().nullable(),
  spacing: z.enum(['none', 'sm', 'md', 'lg']),
});

export const SpinnerNode = node('Spinner', 'Loading indicator.', {
  size: z.enum(['sm', 'md', 'lg']),
  label: z.string(),
});

export const DataTableNode = node('DataTable', 'Sortable table of data. Each row has one cell per column, in column order.', {
  columns: z.array(
    z.object({
      key: z.string(),
      header: z.string(),
      align: z.enum(['left', 'center', 'right']),
    }),
  ),
  rows: z.array(z.object({ cells: z.array(z.string()) })),
  striped: z.boolean(),
  dense: z.boolean(),
});

const baseField = { name: z.string(), label: z.string(), required: z.boolean() };

export const FormNode = node('Form', 'A complete form with validation and a submit button. Prefer it over loose inputs when the user submits data.', {
  title: z.string().nullable(),
  description: z.string().nullable(),
  submitLabel: z.string(),
  fields: z.array(
    z.union([
      z.object({ type: z.literal('input'), ...baseField, inputType: InputNode.shape.props.shape.inputType, placeholder: z.string().nullable() }),
      z.object({ type: z.literal('textarea'), ...baseField, placeholder: z.string().nullable() }),
      z.object({ type: z.literal('select'), ...baseField, options: z.array(option) }),
      z.object({ type: z.literal('checkbox'), ...baseField }),
      z.object({ type: z.literal('radio'), ...baseField, options: z.array(option) }),
    ]),
  ),
});

export const UiNode = z.discriminatedUnion('component', [
  StackNode,
  GridNode,
  CardNode,
  CardHeaderNode,
  CardBodyNode,
  CardFooterNode,
  TypographyNode,
  StatNode,
  ButtonNode,
  InputNode,
  SelectNode,
  CheckboxNode,
  RadioGroupNode,
  BadgeNode,
  AlertNode,
  AvatarNode,
  DividerNode,
  SpinnerNode,
  DataTableNode,
  FormNode,
]);

export const UiDocument = z.object({
  title: z.string().describe('Short name for the screen, for example "Sign-up form".'),
  nodes: z.array(UiNode),
});

export type UiNode = z.infer<typeof UiNode>;
export type UiDocument = z.infer<typeof UiDocument>;
export type ComponentName = UiNode['component'];
export type NodeOf<C extends ComponentName> = Extract<UiNode, { component: C }>;

/** Components that can hold children. Everything else is a leaf. */
export const CONTAINERS: ReadonlySet<ComponentName> = new Set([
  'Stack',
  'Grid',
  'Card',
  'CardHeader',
  'CardBody',
  'CardFooter',
]);

/** Components that are only valid directly inside a specific parent. */
export const REQUIRED_PARENT: Partial<Record<ComponentName, ComponentName>> = {
  CardHeader: 'Card',
  CardBody: 'Card',
  CardFooter: 'Card',
};

/** Hard limits the server and the client both enforce. */
export const LIMITS = {
  promptChars: 600,
  maxNodes: 120,
} as const;
