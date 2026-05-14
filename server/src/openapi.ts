import type { OpenAPIV3 } from 'openapi-types';

export const openapiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Time Reporting API',
    version: '1.0.0',
    description: 'Backend API for the time-reporting system (F01–F19).',
  },
  servers: [
    { url: 'https://team-rocket-server.onrender.com', description: 'Production server' },
    { url: 'http://localhost:3001', description: 'Local dev server' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      UserProfile: {
        type: 'object',
        description: 'Returned by /users/me and /auth/login',
        properties: {
          id: { type: 'integer', example: 1 },
          email: { type: 'string', example: 'user@example.com' },
          firstName: { type: 'string', example: 'Jane' },
          lastName: { type: 'string', example: 'Doe' },
          role: { type: 'string', enum: ['admin', 'user'] },
          mustChangePassword: { type: 'boolean', example: false },
        },
      },
      UserListItem: {
        type: 'object',
        description: 'Returned by admin user list/create/update endpoints',
        properties: {
          id: { type: 'integer', example: 1 },
          email: { type: 'string', example: 'user@example.com' },
          firstName: { type: 'string', example: 'Jane' },
          lastName: { type: 'string', example: 'Doe' },
          role: { type: 'string', enum: ['admin', 'user'] },
          isActive: { type: 'boolean', example: true },
          mustChangePassword: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Client: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          clientNumber: { type: 'string', nullable: true, example: '#001' },
          name: { type: 'string', example: 'Acme Corp' },
          contactInfo: { type: 'string', nullable: true, example: 'phone: 050-0000000' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Website Redesign' },
          clientId: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Frontend Development' },
          projectId: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      TimeEntry: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'integer', example: 1 },
          clientId: { type: 'integer', example: 1 },
          projectId: { type: 'integer', example: 1 },
          taskId: { type: 'integer', example: 1 },
          date: { type: 'string', format: 'date', example: '2026-05-13' },
          startTime: { type: 'string', example: '09:00' },
          endTime: { type: 'string', example: '17:00' },
          location: { type: 'string', enum: ['office', 'home', 'client'] },
          description: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Absence: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'integer', example: 1 },
          startDate: { type: 'string', format: 'date', example: '2026-05-01' },
          endDate: { type: 'string', format: 'date', example: '2026-05-05' },
          type: { type: 'string', enum: ['sick', 'vacation_full', 'vacation_half', 'reserve'] },
          isPartial: { type: 'boolean', example: false },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Assignment: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'integer', example: 1 },
          taskId: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          user: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
            },
          },
          task: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string' },
            },
          },
          projectId: { type: 'integer' },
          projectName: { type: 'string' },
          clientId: { type: 'integer' },
          clientName: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ─── Auth ───────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        summary: 'Log in and receive an access token',
        tags: ['Auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@example.com' },
                  password: { type: 'string', example: 'secret' },
                  rememberMe: { type: 'boolean', example: false, description: 'If true, sets a 30-day persistent refresh-token cookie' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful — returns access token and user info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    user: { $ref: '#/components/schemas/UserProfile' },
                  },
                },
              },
            },
          },
          400: { description: 'Missing email or password' },
          401: { description: 'Invalid credentials or account locked' },
          429: { description: 'Too many login attempts' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Log out and invalidate the refresh token cookie',
        tags: ['Auth'],
        security: [],
        responses: {
          204: { description: 'Logged out (cookie cleared)' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Exchange a refresh token cookie for a new access token',
        tags: ['Auth'],
        security: [],
        responses: {
          200: {
            description: 'New access token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { accessToken: { type: 'string' } },
                },
              },
            },
          },
          401: { description: 'Missing, expired, or revoked refresh token' },
          429: { description: 'Too many refresh attempts' },
        },
      },
    },
    '/auth/change-password': {
      post: {
        summary: 'Change the authenticated user\'s own password',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', description: 'The user\'s existing password' },
                  newPassword: { type: 'string', description: 'Must satisfy password policy' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Password changed — returns a fresh access token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { accessToken: { type: 'string' } },
                },
              },
            },
          },
          400: { description: 'Validation error or password policy violation' },
          401: { description: 'Current password incorrect or not authenticated' },
        },
      },
    },

    // ─── Users ──────────────────────────────────────────────────────────────
    '/users/me': {
      get: {
        summary: 'Get the authenticated user\'s profile',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } } },
          401: { description: 'Not authenticated' },
        },
      },
      put: {
        summary: 'Update the authenticated user\'s own profile',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['first_name', 'last_name'],
                properties: {
                  first_name: { type: 'string', example: 'Jane' },
                  last_name: { type: 'string', example: 'Doe' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/users/me/sort-preference': {
      post: {
        summary: 'Save the authenticated user\'s table sort preference',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sortKey: { type: 'string', example: 'date' },
                  sortDirection: { type: 'string', enum: ['asc', 'desc'] },
                },
              },
            },
          },
        },
        responses: {
          204: { description: 'Preference saved' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/users/me/permissions': {
      get: {
        summary: 'Get permission flags for the authenticated user',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Permission flags object' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/users': {
      get: {
        summary: 'List users',
        description: 'Admin sees all users with full details; users with canAssignProjectTasks flag see a minimal list of active users (id, firstName, lastName only).',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'user'] }, description: 'Filter by role (admin only)' },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' }, description: 'Filter by active status (admin only)' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name or email (admin only)' },
        ],
        responses: {
          200: {
            description: 'User list wrapped in { data: [...] }',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/UserListItem' } },
                  },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
          403: { description: 'Forbidden — user has no canAssignProjectTasks flag' },
        },
      },
      post: {
        summary: 'Create a new user (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['first_name', 'last_name', 'email', 'password'],
                properties: {
                  first_name: { type: 'string', example: 'Jane' },
                  last_name: { type: 'string', example: 'Doe' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'user'], default: 'user' },
                  is_active: { type: 'boolean', default: true },
                  employee_number: { type: 'string', nullable: true },
                  employment_type: { type: 'string', nullable: true },
                  employment_percentage: { type: 'number', nullable: true },
                  department: { type: 'string', nullable: true },
                  daily_hours_override: { type: 'integer', nullable: true, description: 'Override default daily work hours' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserListItem' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          409: { description: 'Email already exists' },
        },
      },
    },
    '/users/{id}': {
      get: {
        summary: 'Get a user by id (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'User', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserListItem' } } } },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'User not found' },
        },
      },
      put: {
        summary: 'Update a user (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['first_name', 'last_name', 'email'],
                properties: {
                  first_name: { type: 'string', example: 'Jane' },
                  last_name: { type: 'string', example: 'Doe' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'user'] },
                  is_active: { type: 'boolean' },
                  employee_number: { type: 'string', nullable: true },
                  employment_type: { type: 'string', nullable: true },
                  employment_percentage: { type: 'number', nullable: true },
                  department: { type: 'string', nullable: true },
                  daily_hours_override: { type: 'integer', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserListItem' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'User not found' },
        },
      },
      delete: {
        summary: 'Deactivate a user (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          204: { description: 'User deactivated' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only — or self-deactivation forbidden' },
          404: { description: 'User not found' },
        },
      },
    },
    '/users/{id}/permissions': {
      get: {
        summary: 'Get permission flags for a user (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Permission flags object' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'User not found' },
        },
      },
      post: {
        summary: 'Set a permission flag for a user (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['flag', 'value'],
                properties: {
                  flag: { type: 'string', example: 'canAssignProjectTasks' },
                  value: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Flag updated' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'User not found' },
        },
      },
    },
    '/users/{id}/permissions/{flagId}': {
      delete: {
        summary: 'Revoke a specific permission flag from a user (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'flagId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Flag revoked' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'User or flag not found' },
        },
      },
    },
    '/users/{id}/reset-password': {
      post: {
        summary: 'Reset a user\'s password to a temporary one (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['temporary_password'],
                properties: {
                  temporary_password: { type: 'string', description: 'Must satisfy password policy; user will be forced to change on next login' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Password reset — returns the temporary password',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { temporaryPassword: { type: 'string' } },
                },
              },
            },
          },
          400: { description: 'Validation error or password policy violation' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'User not found' },
        },
      },
    },

    // ─── Clients ─────────────────────────────────────────────────────────────
    '/clients': {
      get: {
        summary: 'List clients',
        description: 'Admin sees all clients including archived ones. Users see only active clients reachable via their active task assignments.',
        tags: ['Clients'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Client list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Client' } } } } },
          401: { description: 'Not authenticated' },
        },
      },
      post: {
        summary: 'Create a client (admin only)',
        tags: ['Clients'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Acme Corp' },
                  contact_info: { type: 'string', nullable: true },
                  client_number: { type: 'string', nullable: true, example: '#001' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Client created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          409: { description: 'client_number already taken' },
        },
      },
    },
    '/clients/{id}': {
      get: {
        summary: 'Get a client by id',
        description: 'Admin can fetch any client. Users can only fetch active clients reachable via their assignments. Returns 404 (not 403) for unauthorized reads.',
        tags: ['Clients'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Client', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Client not found or not visible' },
        },
      },
      put: {
        summary: 'Update a client (admin only)',
        tags: ['Clients'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  contact_info: { type: 'string', nullable: true },
                  client_number: { type: 'string', nullable: true },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated client', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'Client not found' },
          409: { description: 'client_number already taken' },
        },
      },
      delete: {
        summary: 'Archive a client (admin only)',
        description: 'Soft-delete: flips is_active to false. Idempotent.',
        tags: ['Clients'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Client archived' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'Client not found' },
        },
      },
    },

    // ─── Projects ────────────────────────────────────────────────────────────
    '/projects': {
      get: {
        summary: 'List projects',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Project list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Project' } } } } },
          401: { description: 'Not authenticated' },
        },
      },
      post: {
        summary: 'Create a project (admin only)',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'clientId'],
                properties: {
                  name: { type: 'string' },
                  clientId: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Project created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/projects/{id}': {
      get: {
        summary: 'Get a project by id',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Project', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Project not found' },
        },
      },
      put: {
        summary: 'Update a project (admin only)',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  clientId: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated project', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'Project not found' },
        },
      },
      delete: {
        summary: 'Archive a project (admin only)',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Project archived' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'Project not found' },
        },
      },
    },

    // ─── Tasks ───────────────────────────────────────────────────────────────
    '/tasks': {
      get: {
        summary: 'List tasks',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Task list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } } } } },
          401: { description: 'Not authenticated' },
        },
      },
      post: {
        summary: 'Create a task (admin only)',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'projectId'],
                properties: {
                  name: { type: 'string' },
                  projectId: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Task created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/tasks/{id}': {
      get: {
        summary: 'Get a task by id',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Task', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Task not found' },
        },
      },
      put: {
        summary: 'Update a task (admin only)',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  projectId: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated task', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'Task not found' },
        },
      },
      delete: {
        summary: 'Close a task (admin only)',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Task closed' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
          404: { description: 'Task not found' },
        },
      },
    },

    // ─── Assignments ─────────────────────────────────────────────────────────
    '/assignments': {
      get: {
        summary: 'List task assignments',
        description: 'Admin sees all. Users with canAssignProjectTasks flag see assignments scoped to their projects. Regular users see only their own.',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'project_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by project' },
          { name: 'user_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by user' },
        ],
        responses: {
          200: {
            description: 'Assignment list wrapped in { data: [...] }',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Assignment' } },
                  },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
          403: { description: 'Forbidden' },
        },
      },
      post: {
        summary: 'Assign a user to a task',
        description: 'Admin or user with canAssignProjectTasks flag. Non-admins may only assign within their scoped projects.',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user_id', 'task_id'],
                properties: {
                  user_id: { type: 'integer' },
                  task_id: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Assignment created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Assignment' } },
                },
              },
            },
          },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Forbidden — outside scope or missing flag' },
          409: { description: 'Assignment already exists' },
        },
      },
    },
    '/assignments/{id}': {
      get: {
        summary: 'Get an assignment by id',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'Assignment',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Assignment' } },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
          404: { description: 'Assignment not found' },
        },
      },
      put: {
        summary: 'Toggle an assignment active/inactive',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['is_active'],
                properties: {
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Assignment updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Assignment' } },
                },
              },
            },
          },
          400: { description: 'is_active must be a boolean' },
          401: { description: 'Not authenticated' },
          403: { description: 'Forbidden' },
          404: { description: 'Assignment not found' },
        },
      },
      delete: {
        summary: 'Deactivate an assignment',
        description: 'Sets is_active=false. Admin or scoped non-admin only.',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'Assignment deactivated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Assignment' } },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
          403: { description: 'Forbidden' },
          404: { description: 'Assignment not found' },
        },
      },
    },

    // ─── Time Entries ─────────────────────────────────────────────────────────
    '/time-entries': {
      get: {
        summary: 'List time entries',
        description: 'Regular users see only their own entries. Admins may filter by user_id.',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'user_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by user (admin: any user; regular user: own id only)' },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter by exact date (YYYY-MM-DD)' },
          { name: 'week', in: 'query', schema: { type: 'string' }, description: 'Filter by ISO week (YYYY-WNN, e.g. 2026-W19)' },
          { name: 'month', in: 'query', schema: { type: 'string' }, description: 'Filter by month — either YYYY-MM string or integer 1–12 (requires year param)' },
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Required when month is provided as an integer' },
        ],
        responses: {
          200: { description: 'Time entry list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TimeEntry' } } } } },
          400: { description: 'Invalid filter parameter' },
          401: { description: 'Not authenticated' },
          403: { description: 'User attempted to view another user\'s entries' },
        },
      },
      post: {
        summary: 'Create a time entry',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['date', 'start_time', 'end_time', 'client_id', 'project_id', 'task_id', 'location'],
                properties: {
                  date: { type: 'string', format: 'date', example: '2026-05-13', description: 'YYYY-MM-DD' },
                  start_time: { type: 'string', example: '09:00', description: 'HH:MM or HH:MM:SS' },
                  end_time: { type: 'string', example: '17:00', description: 'HH:MM or HH:MM:SS. Omit when using duration_override_minutes.' },
                  duration_override_minutes: { type: 'integer', description: 'Derive end_time from start_time + this many minutes. Ignored if end_time is supplied.' },
                  client_id: { type: 'integer' },
                  project_id: { type: 'integer' },
                  task_id: { type: 'integer' },
                  location: { type: 'string', enum: ['office', 'home', 'client'] },
                  description: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Time entry created', content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntry' } } } },
          400: { description: 'Validation error — missing or invalid field' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked' },
          422: { description: 'start_time equals end_time (zero duration)' },
        },
      },
    },
    '/time-entries/dropdown-data': {
      get: {
        summary: 'Get clients/projects/tasks for the time entry form dropdowns (user role only)',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Dropdown data grouped by client → project → task' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin users cannot call this endpoint' },
        },
      },
    },
    '/time-entries/daily-summary': {
      get: {
        summary: 'Get daily hours summary for a user',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' }, description: 'YYYY-MM-DD (required)' },
          { name: 'user_id', in: 'query', schema: { type: 'integer' }, description: 'Target user (admin: any; regular user: own id only)' },
        ],
        responses: {
          200: { description: 'Daily summary' },
          400: { description: 'Missing or invalid date / user_id' },
          401: { description: 'Not authenticated' },
          403: { description: 'User attempted to view another user\'s summary' },
        },
      },
    },
    '/time-entries/{id}': {
      get: {
        summary: 'Get a time entry by id',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Time entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntry' } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Time entry not found or not accessible' },
        },
      },
      put: {
        summary: 'Update a time entry',
        description: 'All fields are optional (partial update). version is required for optimistic locking.',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['version'],
                properties: {
                  version: { type: 'integer', description: 'Optimistic lock version — must match current DB value' },
                  start_time: { type: 'string', example: '09:00', description: 'HH:MM or HH:MM:SS' },
                  end_time: { type: 'string', example: '17:00', description: 'HH:MM or HH:MM:SS' },
                  duration_override_minutes: { type: 'integer', description: 'Derive end_time; ignored if end_time is also provided' },
                  client_id: { type: 'integer' },
                  project_id: { type: 'integer' },
                  task_id: { type: 'integer' },
                  location: { type: 'string', enum: ['office', 'home', 'client'] },
                  description: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated time entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntry' } } } },
          400: { description: 'Validation error or missing version' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked or not owner' },
          404: { description: 'Time entry not found' },
          409: { description: 'Optimistic lock conflict — version mismatch' },
          422: { description: 'start_time equals end_time (zero duration)' },
        },
      },
      delete: {
        summary: 'Delete a time entry',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          204: { description: 'Time entry deleted' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked or not owner' },
          404: { description: 'Time entry not found' },
        },
      },
    },

    // ─── Timer ────────────────────────────────────────────────────────────────
    '/timer/start': {
      post: {
        summary: 'Start a timer for a task',
        tags: ['Timer'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['taskId'],
                properties: { taskId: { type: 'integer' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Timer started' },
          400: { description: 'Timer already running' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/timer/stop': {
      post: {
        summary: 'Stop the running timer and create a time entry',
        tags: ['Timer'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Timer stopped and time entry created', content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntry' } } } },
          400: { description: 'No timer running' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/timer/status': {
      get: {
        summary: 'Get the current timer status',
        tags: ['Timer'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Timer status (running or idle)' },
          401: { description: 'Not authenticated' },
        },
      },
    },

    // ─── Absences ────────────────────────────────────────────────────────────
    '/absences': {
      get: {
        summary: 'List absences',
        description: 'Admin may filter by any user. Regular users see only their own.',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'user_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by user (admin: any; regular user: own id only)' },
          { name: 'month', in: 'query', schema: { type: 'string' }, description: 'Filter by month in YYYY-MM format' },
          { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Range start (YYYY-MM-DD)' },
          { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Range end (YYYY-MM-DD)' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['sick', 'vacation_full', 'vacation_half', 'reserve'] }, description: 'Filter by absence type' },
        ],
        responses: {
          200: { description: 'Absence list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Absence' } } } } },
          400: { description: 'Invalid filter parameter' },
          401: { description: 'Not authenticated' },
          403: { description: 'User attempted to view another user\'s absences' },
        },
      },
      post: {
        summary: 'Create an absence',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'start_date', 'end_date'],
                properties: {
                  type: { type: 'string', enum: ['sick', 'vacation_full', 'vacation_half', 'reserve'] },
                  start_date: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
                  end_date: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
                  is_partial: { type: 'boolean', default: false, description: 'Half-day indicator' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Absence created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Absence' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked' },
        },
      },
    },
    '/absences/{id}': {
      put: {
        summary: 'Update an absence',
        description: 'Partial update — only provided fields are changed. version is required for optimistic locking.',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['version'],
                properties: {
                  version: { type: 'integer', description: 'Optimistic lock version' },
                  type: { type: 'string', enum: ['sick', 'vacation_full', 'vacation_half', 'reserve'] },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                  is_partial: { type: 'boolean' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated absence', content: { 'application/json': { schema: { $ref: '#/components/schemas/Absence' } } } },
          400: { description: 'Validation error or missing version' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked or not owner' },
          404: { description: 'Absence not found' },
          409: { description: 'Optimistic lock conflict' },
        },
      },
      delete: {
        summary: 'Delete an absence',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          204: { description: 'Absence deleted' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked or not owner' },
          404: { description: 'Absence not found' },
        },
      },
    },
    '/absences/{id}/documents': {
      post: {
        summary: 'Upload a document for an absence',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary', description: 'Max 10 MB; allowed types: PDF, JPG, PNG' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Document uploaded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    file_name: { type: 'string' },
                    mime_type: { type: 'string' },
                    size_bytes: { type: 'integer' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          400: { description: 'Missing file, invalid type, or size exceeds 10 MB' },
          401: { description: 'Not authenticated' },
          404: { description: 'Absence not found' },
        },
      },
    },
    '/absences/{id}/documents/{docId}': {
      delete: {
        summary: 'Delete an absence document',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'docId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          204: { description: 'Document deleted' },
          401: { description: 'Not authenticated' },
          403: { description: 'Not owner or month locked' },
          404: { description: 'Document not found' },
        },
      },
    },

    // ─── Monthly Summary ──────────────────────────────────────────────────────
    '/monthly-summary': {
      get: {
        summary: 'Get the monthly hours summary for a user',
        tags: ['MonthlySummary'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'year', in: 'query', required: true, schema: { type: 'integer' }, example: 2026 },
          { name: 'month', in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 }, example: 5 },
          { name: 'userId', in: 'query', schema: { type: 'integer' }, description: 'Target user (admin: any; regular user: own id only)' },
        ],
        responses: {
          200: { description: 'Monthly summary' },
          400: { description: 'Missing or invalid year / month' },
          401: { description: 'Not authenticated' },
          403: { description: 'User attempted to view another user\'s summary' },
        },
      },
    },

    // ─── Month Locks ─────────────────────────────────────────────────────────
    '/admin/months': {
      get: {
        summary: 'List all months and their lock status (admin only)',
        tags: ['MonthLocks'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Month list with lock status' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/admin/months/{year}/{month}/status': {
      get: {
        summary: 'Get lock status for a specific month',
        tags: ['MonthLocks'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'year', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'month', in: 'path', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 } },
        ],
        responses: {
          200: { description: 'Month status' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/admin/months/{year}/{month}/lock': {
      post: {
        summary: 'Lock a month (admin only)',
        tags: ['MonthLocks'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'year', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'month', in: 'path', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 } },
        ],
        responses: {
          200: { description: 'Month locked' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },
    '/admin/months/{year}/{month}/unlock': {
      post: {
        summary: 'Unlock a month (admin only)',
        tags: ['MonthLocks'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'year', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'month', in: 'path', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 } },
        ],
        responses: {
          200: { description: 'Month unlocked' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },

    // ─── Admin ────────────────────────────────────────────────────────────────
    '/admin/dashboard': {
      get: {
        summary: 'Get the admin dashboard summary',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Dashboard data' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },

    // ─── Audit Logs ───────────────────────────────────────────────────────────
    '/audit-logs': {
      get: {
        summary: 'List audit log entries (admin only)',
        tags: ['AuditLogs'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
          {
            name: 'entity_type', in: 'query',
            schema: {
              type: 'string',
              enum: ['USER', 'CLIENT', 'PROJECT', 'TASK', 'ASSIGNMENT', 'TIME_ENTRY', 'ABSENCE', 'WEEKLY_SUBMISSION', 'MONTH_LOCK', 'SETTING', 'HOLIDAY', 'TIMER'],
            },
          },
          {
            name: 'action', in: 'query',
            schema: {
              type: 'string',
              enum: ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT', 'LOCK', 'UNLOCK', 'ADMIN_EDIT', 'WEEK_RESUBMITTED', 'EXPORT', 'PASSWORD_RESET', 'DEACTIVATE', 'ENTRY_CORRECTED'],
            },
          },
          { name: 'entity_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by entity id' },
          { name: 'user_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by actor user id' },
          { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'YYYY-MM-DD' },
          { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'YYYY-MM-DD' },
        ],
        responses: {
          200: { description: 'Paginated audit log entries' },
          400: { description: 'Invalid filter value' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },
  },
};
