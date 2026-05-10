/**
 * Express route table for the F05 /clients endpoints.
 * Note: role gating is intentionally NOT done with `requireRole('admin')` for
 * the GET handlers — both admin and user can list/read clients, and the
 * controller is responsible for scoping the result set by role.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { wrap } from '../controllers/auth.controller';
import {
  createClient,
  deactivateClient,
  getClientById,
  getClients,
  updateClient,
} from '../controllers/clients.controller';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Client:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         clientNumber:
 *           type: string
 *           nullable: true
 *           example: "#001"
 *         name:
 *           type: string
 *           example: Acme Corp
 *         contactInfo:
 *           type: string
 *           nullable: true
 *           example: "phone: 050-0000000"
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: List clients
 *     description: >
 *       Admin sees all clients including archived ones.
 *       Users see only active clients reachable via their active task assignments.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Clients retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 *       401:
 *         description: Missing or invalid token
 */
router.get('/', authenticate, wrap(getClients));

/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Create a client (admin only)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Corp
 *               contact_info:
 *                 type: string
 *                 example: "phone: 050-0000000"
 *               client_number:
 *                 type: string
 *                 example: "#001"
 *     responses:
 *       201:
 *         description: >
 *           Client created. When an active client with the same name already exists
 *           the body is `{ data, warning }`; otherwise the row is returned flat.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Client'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Client'
 *                     warning:
 *                       type: string
 *                       example: A client with this name already exists
 *       400:
 *         description: Missing or invalid name
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Non-admin user
 *       409:
 *         description: client_number already taken
 */
router.post('/', authenticate, requireRole('admin'), wrap(createClient));

/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Get a single client by id
 *     description: >
 *       Admin can fetch any client. Users can only fetch active clients reachable
 *       via their active task assignments. Unauthorized reads return 404 (not 403)
 *       to avoid leaking the existence of unrelated clients.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Client found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: Client not found or not visible to the requesting user
 */
router.get('/:id', authenticate, wrap(getClientById));

/**
 * @swagger
 * /clients/{id}:
 *   put:
 *     summary: Partially update a client (admin only)
 *     description: >
 *       Any field omitted from the body is preserved from the current DB row.
 *       An explicit empty string for `contact_info` or `client_number` clears
 *       the field (sets to null). Emits an UPDATE audit row with old and new values.
 *       Uses a row-level lock to prevent concurrent update races.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               contact_info:
 *                 type: string
 *                 nullable: true
 *               client_number:
 *                 type: string
 *                 nullable: true
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated client
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       400:
 *         description: Invalid field value
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Non-admin user
 *       404:
 *         description: Client not found
 *       409:
 *         description: client_number already taken by another client
 */
router.put('/:id', authenticate, requireRole('admin'), wrap(updateClient));

/**
 * @swagger
 * /clients/{id}:
 *   delete:
 *     summary: Soft-delete (archive) a client (admin only)
 *     description: >
 *       Flips `is_active` to false. When the client still has active projects,
 *       the response body includes a `warning` string describing the impact on
 *       user-facing task dropdowns. Idempotent: archiving an already-archived
 *       client succeeds. Emits a DEACTIVATE audit row.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: >
 *           Client archived. `warning` is present when the client had active projects.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Client'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Client'
 *                     warning:
 *                       type: string
 *                       example: "This client has 2 active projects; their tasks will no longer appear in user dropdowns."
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Non-admin user
 *       404:
 *         description: Client not found
 */
router.delete('/:id', authenticate, requireRole('admin'), wrap(deactivateClient));

export default router;
