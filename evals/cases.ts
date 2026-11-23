// Prompts the studio should handle well. Each case lists components a good
// answer must use; the scorer also checks structure, lint warnings and cost.
// Mixed languages on purpose: the copy should follow the request.

import type { ComponentName } from '../src/shared/catalog.js';

export interface EvalCase {
  id: string;
  prompt: string;
  mustUse: ComponentName[];
}

export const CASES: EvalCase[] = [
  { id: 'login', prompt: 'A login screen with email, password, a remember me option and a link to reset the password', mustUse: ['Form'] },
  { id: 'signup-es', prompt: 'Un formulario de registro para una app de reservas de pádel, con nombre, email, teléfono y nivel de juego', mustUse: ['Form'] },
  { id: 'pricing', prompt: 'Pricing page with three plans for a podcast hosting service', mustUse: ['Grid', 'Card', 'Button'] },
  { id: 'dashboard', prompt: 'An analytics overview for an online shop: four stat cards and a table of the latest orders', mustUse: ['Grid', 'Card', 'DataTable'] },
  { id: 'team-table', prompt: 'A screen to manage the members of a team, with a search field, an invite button and a table', mustUse: ['DataTable', 'Button', 'Input'] },
  { id: 'settings', prompt: 'Notification preferences for a calendar app: which events to be notified about and through which channel', mustUse: ['Checkbox'] },
  { id: 'profile', prompt: 'A user profile card with avatar, name, role, location and two actions', mustUse: ['Card', 'Avatar', 'Button'] },
  { id: 'empty-state', prompt: 'An empty state for a project list when the user has no projects yet', mustUse: ['Typography', 'Button'] },
  { id: 'checkout', prompt: 'A checkout page with an order summary and a payment form', mustUse: ['Form', 'Card'] },
  { id: 'error-page', prompt: 'A page shown when a payment fails, explaining what happened and what to do next', mustUse: ['Alert', 'Button'] },
  { id: 'contact-ca', prompt: "Un formulari de contacte per a un estudi d'arquitectura, amb motiu de la consulta", mustUse: ['Form'] },
  { id: 'feature-grid', prompt: 'A features section for a note-taking app with six features', mustUse: ['Grid'] },
];
