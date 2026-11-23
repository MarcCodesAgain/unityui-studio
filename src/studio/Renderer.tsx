import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  CountUp,
  DataTable,
  Divider,
  Form,
  Input,
  RadioGroup,
  Select,
  Spinner,
  StatDelta,
  StatLabel,
  StatValue,
  Typography,
} from '@marcllopis/unityui';
import type { FormField } from '@marcllopis/unityui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { NodeOf, UiNode } from '../shared/catalog';
import { gridStyle, stackStyle } from '../shared/layout';
import type { TreeNode } from '../shared/tree';

// The preview only needs the controls to feel real, so state stays local.
function DemoRadioGroup({ props }: { props: NodeOf<'RadioGroup'>['props'] }) {
  const [value, setValue] = useState<string>();
  return <RadioGroup {...props} value={value} onChange={setValue} />;
}

function DemoDataTable({ props }: { props: NodeOf<'DataTable'>['props'] }) {
  const data = props.rows.map((row, i) =>
    Object.fromEntries([['__row', String(i)], ...props.columns.map((col, c) => [col.key, row.cells[c] ?? ''])]),
  );
  return (
    <DataTable
      columns={props.columns.map((col) => ({ key: col.key, header: col.header, accessor: col.key, align: col.align, sortable: true }))}
      data={data}
      rowKey="__row"
      striped={props.striped}
      dense={props.dense}
    />
  );
}

function toFormField(field: NodeOf<'Form'>['props']['fields'][number]): FormField {
  switch (field.type) {
    case 'input':
      return { ...field, placeholder: field.placeholder ?? undefined };
    case 'textarea':
      return { ...field, placeholder: field.placeholder ?? undefined };
    default:
      return field;
  }
}

function renderNode(node: UiNode, children: ReactNode): ReactNode {
  switch (node.component) {
    case 'Stack':
      return <div style={stackStyle(node.props)}>{children}</div>;
    case 'Grid':
      return <div style={gridStyle(node.props)}>{children}</div>;
    case 'Card':
      return <Card variant={node.props.variant}>{children}</Card>;
    case 'CardHeader':
      return <Card.Header>{children}</Card.Header>;
    case 'CardBody':
      return <Card.Body>{children}</Card.Body>;
    case 'CardFooter':
      return <Card.Footer divider={node.props.divider}>{children}</Card.Footer>;
    case 'Typography':
      return (
        <Typography variant={node.props.variant} color={node.props.color}>
          {node.props.text}
        </Typography>
      );
    case 'Stat':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <StatValue>
            <CountUp
              to={node.props.value}
              decimals={Number(node.props.decimals)}
              prefix={node.props.prefix ?? undefined}
              suffix={node.props.suffix ?? undefined}
              duration={900}
            />
          </StatValue>
          {node.props.label && <StatLabel>{node.props.label}</StatLabel>}
          {node.props.delta && <StatDelta $positive={node.props.trend === null ? undefined : node.props.trend === 'up'}>{node.props.delta}</StatDelta>}
        </div>
      );
    case 'Button':
      return (
        <Button variant={node.props.variant} size={node.props.size} fullWidth={node.props.fullWidth} type="button">
          {node.props.text}
        </Button>
      );
    case 'Input':
      return (
        <Input
          label={node.props.label}
          type={node.props.inputType}
          placeholder={node.props.placeholder ?? undefined}
          hint={node.props.hint ?? undefined}
          required={node.props.required}
          fullWidth
        />
      );
    case 'Select':
      return (
        <Select label={node.props.label} placeholder={node.props.placeholder ?? undefined} options={node.props.options} fullWidth />
      );
    case 'Checkbox':
      return <Checkbox label={node.props.label} defaultChecked={node.props.checked} />;
    case 'RadioGroup':
      return <DemoRadioGroup props={node.props} />;
    case 'Badge':
      return <Badge label={node.props.label} variant={node.props.variant} dot={node.props.dot} />;
    case 'Alert':
      return (
        <Alert variant={node.props.variant} title={node.props.title ?? undefined}>
          {node.props.text}
        </Alert>
      );
    case 'Avatar':
      return <Avatar initials={node.props.initials} size={node.props.size} status={node.props.status ?? undefined} />;
    case 'Divider':
      return <Divider label={node.props.label ?? undefined} spacing={node.props.spacing} />;
    case 'Spinner':
      return <Spinner size={node.props.size} label={node.props.label} />;
    case 'DataTable':
      return <DemoDataTable props={node.props} />;
    case 'Form':
      return (
        <Form
          title={node.props.title ?? undefined}
          description={node.props.description ?? undefined}
          submitLabel={node.props.submitLabel}
          fields={node.props.fields.map(toFormField)}
          onSubmit={() => undefined}
          successMessage="Submitted. This is a preview, so nothing was sent."
        />
      );
  }
}

function RenderTree({ tree }: { tree: TreeNode }) {
  const children = tree.children.map((child) => <RenderTree key={child.node.id} tree={child} />);
  return <>{renderNode(tree.node, children.length ? children : null)}</>;
}

export function Renderer({ roots }: { roots: TreeNode[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {roots.map((root) => (
        <RenderTree key={root.node.id} tree={root} />
      ))}
    </div>
  );
}
