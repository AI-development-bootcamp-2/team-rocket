import type { OpenAPIV3 } from 'openapi-types';

export const openapiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Time Reporting API',
    version: '1.0.0',
    description: 'Backend API for the time-reporting system (F01–F19).',
  },
  servers: [{ url: 'http://localhost:3001', description: 'Local dev server' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { message: { type: 'string' } },
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
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          email: { type: 'string', example: 'user@example.com' },
          name: { type: 'string', example: 'Jane Doe' },
          role: { type: 'string', enum: ['admin', 'user'] },
          isActive: { type: 'boolean', example: true },
          weeklyQuota: { type: 'number', example: 40 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TimeEntry: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'integer', example: 1 },
          taskId: { type: 'integer', example: 1 },
          date: { type: 'string', format: 'date', example: '2026-05-13' },
          hours: { type: 'number', example: 8 },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Absence: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'integer', example: 1 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          type: { type: 'string', example: 'vacation' },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
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
                  rememberMe: { type: 'boolean', example: false },
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
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Log out and invalidate the refresh token cookie',
        tags: ['Auth'],
        security: [],
        responses: {
          200: { description: 'Logged out' },
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
          401: { description: 'Missing or invalid refresh token' },
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
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password changed' },
          400: { description: 'Validation error' },
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
          200: { description: 'Current user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
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
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
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
                  sortKey: { type: 'string' },
                  sortDirection: { type: 'string', enum: ['asc', 'desc'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Preference saved' },
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
          200: { description: 'Permission flags' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/users': {
      get: {
        summary: 'List all users (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
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
                required: ['email', 'name', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'user'] },
                  weeklyQuota: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
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
          200: { description: 'User', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
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
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'user'] },
                  weeklyQuota: { type: 'number' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
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
          200: { description: 'User deactivated' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
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
          200: { description: 'Permission flags' },
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
                  flag: { type: 'string' },
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
    '/users/{id}/reset-password': {
      post: {
        summary: 'Reset a user\'s password (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newPassword'],
                properties: { newPassword: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset' },
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
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Assignment list' },
          401: { description: 'Not authenticated' },
        },
      },
      post: {
        summary: 'Assign a user to a task',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'taskId'],
                properties: {
                  userId: { type: 'integer' },
                  taskId: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Assignment created' },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
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
          200: { description: 'Assignment' },
          401: { description: 'Not authenticated' },
          404: { description: 'Assignment not found' },
        },
      },
      put: {
        summary: 'Toggle an assignment active/inactive',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Assignment toggled' },
          401: { description: 'Not authenticated' },
          404: { description: 'Assignment not found' },
        },
      },
      delete: {
        summary: 'Delete an assignment',
        tags: ['Assignments'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Assignment deleted' },
          401: { description: 'Not authenticated' },
          404: { description: 'Assignment not found' },
        },
      },
    },

    // ─── Time Entries ─────────────────────────────────────────────────────────
    '/time-entries': {
      get: {
        summary: 'List time entries for the authenticated user',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'week', in: 'query', schema: { type: 'string' }, description: 'ISO week string (YYYY-Www)' },
        ],
        responses: {
          200: { description: 'Time entry list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TimeEntry' } } } } },
          401: { description: 'Not authenticated' },
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
                required: ['taskId', 'date', 'hours'],
                properties: {
                  taskId: { type: 'integer' },
                  date: { type: 'string', format: 'date' },
                  hours: { type: 'number' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Time entry created', content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntry' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked' },
          409: { description: 'Quota exceeded' },
        },
      },
    },
    '/time-entries/dropdown-data': {
      get: {
        summary: 'Get clients/projects/tasks for the time entry form dropdowns',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Dropdown data' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/time-entries/daily-summary': {
      get: {
        summary: 'Get daily hours summary for the authenticated user',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Daily summary' },
          401: { description: 'Not authenticated' },
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
          404: { description: 'Time entry not found' },
        },
      },
      put: {
        summary: 'Update a time entry',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  taskId: { type: 'integer' },
                  date: { type: 'string', format: 'date' },
                  hours: { type: 'number' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated time entry', content: { 'application/json': { schema: { $ref: '#/components/schemas/TimeEntry' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked' },
          404: { description: 'Time entry not found' },
        },
      },
      delete: {
        summary: 'Delete a time entry',
        tags: ['TimeEntries'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Time entry deleted' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked' },
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
        summary: 'List absences for the authenticated user',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Absence list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Absence' } } } } },
          401: { description: 'Not authenticated' },
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
                required: ['startDate', 'endDate', 'type'],
                properties: {
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                  type: { type: 'string' },
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
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                  type: { type: 'string' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated absence', content: { 'application/json': { schema: { $ref: '#/components/schemas/Absence' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked' },
          404: { description: 'Absence not found' },
        },
      },
      delete: {
        summary: 'Delete an absence',
        tags: ['Absences'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Absence deleted' },
          401: { description: 'Not authenticated' },
          403: { description: 'Month is locked' },
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
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'Document uploaded' },
          400: { description: 'Invalid file type or size exceeds 10 MB' },
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
          200: { description: 'Document deleted' },
          401: { description: 'Not authenticated' },
          404: { description: 'Document not found' },
        },
      },
    },

    // ─── Monthly Summary ──────────────────────────────────────────────────────
    '/monthly-summary': {
      get: {
        summary: 'Get the monthly hours summary for the authenticated user',
        tags: ['MonthlySummary'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer' }, example: 2026 },
          { name: 'month', in: 'query', schema: { type: 'integer' }, example: 5 },
        ],
        responses: {
          200: { description: 'Monthly summary' },
          401: { description: 'Not authenticated' },
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
          { name: 'month', in: 'path', required: true, schema: { type: 'integer' } },
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
          { name: 'month', in: 'path', required: true, schema: { type: 'integer' } },
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
          { name: 'month', in: 'path', required: true, schema: { type: 'integer' } },
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
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Audit log entries' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin only' },
        },
      },
    },
  },
};
