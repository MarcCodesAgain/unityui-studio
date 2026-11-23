// Turns a tree into a ready-to-paste React component that imports UnityUI.

import type { UiNode } from './catalog.js';
import { gridStyle, stackStyle } from './layout.js';
import type { TreeNode } from './tree.js';

const INDENT = '  ';
const ON_SUBMIT = Symbol('onSubmit');

function str(value: string): string {
  return JSON.stringify(value);
}

function text(value: string): string {
  // JSX text cannot contain these characters unescaped.
  return /[{}<>]/.test(value) ? `{${str(value)}}` : value;
}

/** A JS literal with bare keys where possible, so the export reads like hand-written code. */
function jsValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jsValue).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : str(k)}: ${jsValue(v)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return typeof value === 'string' ? `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'` : String(value);
}

function attrs(values: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) parts.push(key);
    else if (value === ON_SUBMIT) parts.push(`${key}={(values) => console.log(values)}`);
    // JSX attribute strings have no escapes, so anything tricky goes in braces.
    else if (typeof value === 'string') parts.push(/["\\\n]/.test(value) ? `${key}={${jsValue(value)}}` : `${key}="${value}"`);
    else parts.push(`${key}={${jsValue(value)}}`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

interface Element {
  tag: string;
  props: Record<string, unknown>;
  text?: string;
}

function toElement(node: UiNode): Element {
  switch (node.component) {
    case 'Stack':
      return { tag: 'div', props: { style: stackStyle(node.props) } };
    case 'Grid':
      return { tag: 'div', props: { style: gridStyle(node.props) } };
    case 'Card':
      return { tag: 'Card', props: { variant: node.props.variant === 'default' ? null : node.props.variant } };
    case 'CardHeader':
      return { tag: 'Card.Header', props: {} };
    case 'CardBody':
      return { tag: 'Card.Body', props: {} };
    case 'CardFooter':
      return { tag: 'Card.Footer', props: { divider: node.props.divider } };
    case 'Typography':
      return { tag: 'Typography', props: { variant: node.props.variant, color: node.props.color === 'primary' ? null : node.props.color }, text: node.props.text };
    case 'Stat':
      return {
        tag: 'Stat',
        props: {
          value: node.props.value,
          decimals: node.props.decimals === '0' ? null : Number(node.props.decimals),
          prefix: node.props.prefix,
          suffix: node.props.suffix,
          label: node.props.label,
          delta: node.props.delta,
          trend: node.props.trend,
        },
      };
    case 'Button':
      return {
        tag: 'Button',
        props: { variant: node.props.variant, size: node.props.size === 'md' ? null : node.props.size, fullWidth: node.props.fullWidth },
        text: node.props.text,
      };
    case 'Input':
      return {
        tag: 'Input',
        props: { label: node.props.label, type: node.props.inputType, placeholder: node.props.placeholder, hint: node.props.hint, required: node.props.required, fullWidth: true },
      };
    case 'Select':
      return { tag: 'Select', props: { label: node.props.label, placeholder: node.props.placeholder, options: node.props.options, fullWidth: true } };
    case 'Checkbox':
      return { tag: 'Checkbox', props: { label: node.props.label, defaultChecked: node.props.checked } };
    case 'RadioGroup':
      return { tag: 'RadioGroup', props: { name: node.props.name, label: node.props.label, options: node.props.options, direction: node.props.direction === 'vertical' ? null : node.props.direction } };
    case 'Badge':
      return { tag: 'Badge', props: { label: node.props.label, variant: node.props.variant === 'default' ? null : node.props.variant, dot: node.props.dot } };
    case 'Alert':
      return { tag: 'Alert', props: { variant: node.props.variant, title: node.props.title }, text: node.props.text };
    case 'Avatar':
      return { tag: 'Avatar', props: { initials: node.props.initials, size: node.props.size, status: node.props.status } };
    case 'Divider':
      return { tag: 'Divider', props: { label: node.props.label, spacing: node.props.spacing } };
    case 'Spinner':
      return { tag: 'Spinner', props: { size: node.props.size, label: node.props.label } };
    case 'DataTable': {
      const data = node.props.rows.map((row, i) => ({
        id: String(i + 1),
        ...Object.fromEntries(node.props.columns.map((col, c) => [col.key, row.cells[c] ?? ''])),
      }));
      return {
        tag: 'DataTable',
        props: {
          columns: node.props.columns.map((col) => ({ key: col.key, header: col.header, accessor: col.key, align: col.align, sortable: true })),
          data,
          rowKey: 'id',
          striped: node.props.striped,
          dense: node.props.dense,
        },
      };
    }
    case 'Form':
      return {
        tag: 'Form',
        props: {
          title: node.props.title,
          description: node.props.description,
          submitLabel: node.props.submitLabel,
          fields: node.props.fields.map((field) =>
            Object.fromEntries(Object.entries(field).filter(([, v]) => v !== null && v !== false)),
          ),
          onSubmit: ON_SUBMIT,
        },
      };
  }
}

function render(tree: TreeNode, depth: number, imports: Set<string>): string {
  const pad = INDENT.repeat(depth);
  const element = toElement(tree.node);
  const root = element.tag.split('.')[0];
  if (root !== 'div') imports.add(root);

  const props = attrs(element.props);
  const children = tree.children.map((child) => render(child, depth + 1, imports));

  if (element.text !== undefined) return `${pad}<${element.tag}${props}>${text(element.text)}</${element.tag}>`;
  if (children.length === 0) return `${pad}<${element.tag}${props} />`;
  return `${pad}<${element.tag}${props}>\n${children.join('\n')}\n${pad}</${element.tag}>`;
}

function componentName(title: string): string {
  const name = title
    .normalize('NFD')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
  return /^[A-Z]/.test(name) ? name : 'GeneratedScreen';
}

// Stat is a studio composition of UnityUI's CountUp and Stat* parts, so the
// export ships it as a small local component built from the real exports.
const STAT_HELPER = `function Stat({ value, decimals = 0, prefix, suffix, label, delta, trend }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <StatValue>
        <CountUp to={value} decimals={decimals} prefix={prefix} suffix={suffix} />
      </StatValue>
      {label && <StatLabel>{label}</StatLabel>}
      {delta && <StatDelta $positive={trend && trend === 'up'}>{delta}</StatDelta>}
    </div>
  );
}

`;

export function exportJsx(title: string, roots: readonly TreeNode[]): string {
  const imports = new Set<string>();
  const body =
    roots.length === 1
      ? render(roots[0], 2, imports)
      : `${INDENT.repeat(2)}<>\n${roots.map((root) => render(root, 3, imports)).join('\n')}\n${INDENT.repeat(2)}</>`;

  const usesStat = imports.delete('Stat');
  if (usesStat) for (const name of ['CountUp', 'StatValue', 'StatLabel', 'StatDelta']) imports.add(name);

  const importLine = imports.size ? `import { ${[...imports].sort().join(', ')} } from '@marcllopis/unityui';\n\n` : '';
  return `${importLine}${usesStat ? STAT_HELPER : ''}export function ${componentName(title)}() {\n${INDENT}return (\n${body}\n${INDENT});\n}\n`;
}
