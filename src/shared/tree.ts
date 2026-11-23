// Turns the flat node list into a tree and checks the rules the JSON schema
// cannot express: unique ids, parents that exist and come first, leaves without
// children, and card sections only inside cards.
//
// Broken nodes are dropped (with their subtree) rather than failing the whole
// document, so a single slip from the model never blanks the preview.

import { CONTAINERS, LIMITS, REQUIRED_PARENT, UiNode } from './catalog.js';
import type { UiNode as UiNodeType } from './catalog.js';

export interface TreeNode {
  node: UiNodeType;
  children: TreeNode[];
}

export interface Issue {
  severity: 'error' | 'warning';
  nodeId: string | null;
  message: string;
}

export interface BuiltTree {
  roots: TreeNode[];
  issues: Issue[];
  /** Nodes that made it into the tree, in document order. */
  nodes: UiNodeType[];
}

function cardBodyFor(card: TreeNode, issues: Issue[]): TreeNode {
  const last = card.children.at(-1);
  if (last?.node.component === 'CardBody' && last.node.id.endsWith('__body')) return last;
  issues.push({ severity: 'warning', nodeId: card.node.id, message: 'Content placed directly in a Card was wrapped in a CardBody.' });
  const body: TreeNode = { node: { id: `${card.node.id}__body`, parent: card.node.id, component: 'CardBody', props: {} }, children: [] };
  card.children.push(body);
  return body;
}

export function buildTree(input: readonly unknown[]): BuiltTree {
  const issues: Issue[] = [];
  const byId = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  const nodes: UiNodeType[] = [];

  for (const raw of input.slice(0, LIMITS.maxNodes)) {
    const parsed = UiNode.safeParse(raw);
    const rawId = typeof raw === 'object' && raw && 'id' in raw ? String((raw as { id: unknown }).id) : null;
    if (!parsed.success) {
      issues.push({ severity: 'error', nodeId: rawId, message: `Invalid node: ${parsed.error.issues[0]?.message ?? 'unknown error'}` });
      continue;
    }
    const node = parsed.data;

    if (byId.has(node.id)) {
      issues.push({ severity: 'error', nodeId: node.id, message: `Duplicate id "${node.id}", node skipped.` });
      continue;
    }

    const requiredParent = REQUIRED_PARENT[node.component];
    let parent: TreeNode | undefined;

    if (node.parent !== null) {
      parent = byId.get(node.parent);
      if (!parent) {
        issues.push({ severity: 'error', nodeId: node.id, message: `Parent "${node.parent}" is missing or comes later, node skipped.` });
        continue;
      }
      if (!CONTAINERS.has(parent.node.component)) {
        issues.push({ severity: 'error', nodeId: node.id, message: `${parent.node.component} cannot contain other components, node skipped.` });
        continue;
      }
    }

    if (requiredParent && parent?.node.component !== requiredParent) {
      issues.push({ severity: 'error', nodeId: node.id, message: `${node.component} must sit directly inside a ${requiredParent}, node skipped.` });
      continue;
    }

    const treeNode: TreeNode = { node, children: [] };
    byId.set(node.id, treeNode);
    nodes.push(node);

    // Card padding lives in its sections, so loose content inside a Card would
    // touch the border. Move it into a CardBody the model forgot to add.
    if (parent?.node.component === 'Card' && !requiredParent) {
      parent = cardBodyFor(parent, issues);
    }
    (parent ? parent.children : roots).push(treeNode);
  }

  if (input.length > LIMITS.maxNodes) {
    issues.push({ severity: 'warning', nodeId: null, message: `Only the first ${LIMITS.maxNodes} nodes are shown.` });
  }

  return { roots, issues, nodes };
}
