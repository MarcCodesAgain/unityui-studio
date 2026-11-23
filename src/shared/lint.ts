// Design and accessibility checks on a valid tree. These are warnings: the
// screen still renders, but the studio shows them and the evals count them.

import type { UiNode } from './catalog.js';
import type { Issue, TreeNode } from './tree.js';

const HEADING_LEVEL: Record<string, number> = { display: 1, h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };

function warn(nodeId: string | null, message: string): Issue {
  return { severity: 'warning', nodeId, message };
}

export function lint(nodes: readonly UiNode[], roots: readonly TreeNode[]): Issue[] {
  const issues: Issue[] = [];
  let topLevelHeadings = 0;
  let previousLevel = 0;

  for (const node of nodes) {
    switch (node.component) {
      case 'Typography': {
        const level = HEADING_LEVEL[node.props.variant];
        if (!level) break;
        if (level === 1) topLevelHeadings += 1;
        if (previousLevel && level > previousLevel + 1) {
          issues.push(warn(node.id, `Heading jumps from level ${previousLevel} to ${level}; screen reader users navigate by heading level.`));
        }
        previousLevel = level;
        if (!node.props.text.trim()) issues.push(warn(node.id, 'Empty heading.'));
        break;
      }
      case 'Button':
        if (!node.props.text.trim()) issues.push(warn(node.id, 'Button has no text, so it has no accessible name.'));
        break;
      case 'Input':
      case 'Select':
      case 'Checkbox':
      case 'RadioGroup':
        if (!node.props.label.trim()) issues.push(warn(node.id, `${node.component} has no label.`));
        break;
      case 'Avatar':
        if (!node.props.initials.trim()) issues.push(warn(node.id, 'Avatar has no initials.'));
        break;
      case 'DataTable':
        node.props.rows.forEach((row, i) => {
          if (row.cells.length !== node.props.columns.length) {
            issues.push(warn(node.id, `Row ${i + 1} has ${row.cells.length} cells for ${node.props.columns.length} columns.`));
          }
        });
        break;
      case 'Form':
        if (node.props.fields.length === 0) issues.push(warn(node.id, 'Form has no fields.'));
        if (new Set(node.props.fields.map((f) => f.name)).size !== node.props.fields.length) {
          issues.push(warn(node.id, 'Two form fields share the same name.'));
        }
        break;
      default:
        break;
    }
  }

  if (topLevelHeadings > 1) issues.push(warn(null, `${topLevelHeadings} top-level headings; a screen usually has one.`));

  const primaryButtonsPerContainer = (children: readonly TreeNode[], containerId: string | null) => {
    const primaries = children.filter((c) => c.node.component === 'Button' && c.node.props.variant === 'primary');
    if (primaries.length > 1) issues.push(warn(containerId, 'More than one primary button side by side; keep one main action.'));
    for (const child of children) primaryButtonsPerContainer(child.children, child.node.id);
  };
  primaryButtonsPerContainer(roots, null);

  const emptyContainers = (children: readonly TreeNode[]) => {
    for (const child of children) {
      const isContainer = ['Stack', 'Grid', 'Card', 'CardHeader', 'CardBody', 'CardFooter'].includes(child.node.component);
      if (isContainer && child.children.length === 0) issues.push(warn(child.node.id, `Empty ${child.node.component}.`));
      emptyContainers(child.children);
    }
  };
  emptyContainers(roots);

  return issues;
}
