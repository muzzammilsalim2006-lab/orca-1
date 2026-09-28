/**
 * OpenAPI 3.0.3 Specification for ORCA Marine Safety & Coastal Advisory Backend
 */

export const ORCA_OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'ORCA Marine Safety & Coastal Intelligence API',
    version: '0.2.0',
    description:
      'Deterministic Coastal Marine Safety & Advisory Intelligence API integrating Open-Meteo, IMD, INCOIS, and MOSDAC/ISRO with zero generative hallucination risk.',
    contact: {
      name: 'ORCA Intelligence Architecture',
      url: 'https://github.com/google/orca-marine-safety',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current AI Studio development / production instance',
    },
  ],
  paths: {
    '/api/info': {
      get: {
        summary: 'System & Provider Status Info',
        description:
          'Returns runtime service metadata, provider statuses (LIVE, CONFIG_REQUIRED, UNAVAILABLE), capabilities, and failure semantics without exposing sensitive credentials.',
        operationId: 'getSystemInfo',
        responses: {
          '200': {
            description: 'Operational metadata and provider health overview',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SystemInfoResponse' },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Application Health Check',
        description:
          'Reports process uptime, memory usage, cache statistics, and service health independently of external provider status.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Application process status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/meta': {
      get: {
        summary: 'Metadata & Configuration Limits',
        description: 'Exposes physical factor thresholds, risk bands, guardrails, and supported coastal regions.',
        operationId: 'getMeta',
        responses: {
          '200': {
            description: 'Configuration metadata',
          },
        },
      },
    },
    '/api/demo/locations': {
      get: {
        summary: 'Preconfigured Testbed Coastal Locations',
        description: 'Returns list of supported coastal regions (Mumbai, Chennai, Kochi, Goa, Ratnagiri) for demo verification.',
        operationId: 'getDemoLocations',
        responses: {
          '200': {
            description: 'Array of demo location items',
          },
        },
      },
    },
    '/api/assess': {
      post: {
        summary: 'Run Deterministic Marine Risk Assessment',
        description:
          'Collects multi-source meteorological, oceanographic, and satellite data, validates physical limits, evaluates deterministic safety vetoes, calculates surface drift vectors and predicted positions, and returns structured evidence.',
        operationId: 'assessMarineRisk',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AssessmentRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Comprehensive marine assessment and deterministic decision',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssessmentResponse' },
              },
            },
          },
          '422': {
            description: 'Validation error (e.g. invalid latitude/longitude or negative vessel beam)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      SystemInfoResponse: {
        type: 'object',
        properties: {
          service_name: { type: 'string', example: 'orca-marine-safety' },
          version: { type: 'string', example: '0.2.0' },
          api_version: { type: 'string', example: '0.2.0' },
          status: { type: 'string', example: 'OPERATIONAL' },
          deterministic_engine: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ONLINE' },
              rule_governance: { type: 'string', example: 'DETERMINISTIC' },
            },
          },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
          },
          providers: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                status: { type: 'string', enum: ['LIVE', 'CACHED', 'CONFIG_REQUIRED', 'UNAVAILABLE', 'ERROR', 'DEMO'] },
                endpoint: { type: 'string' },
                configured: { type: 'boolean' },
                last_retrieval: { type: 'string', nullable: true },
                freshness: { type: 'string', nullable: true },
                error: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'UP' },
          version: { type: 'string', example: '0.2.0' },
          uptime_seconds: { type: 'number', example: 124.5 },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      AssessmentRequest: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: { type: 'number', minimum: -90, maximum: 90, example: 18.9438 },
          longitude: { type: 'number', minimum: -180, maximum: 180, example: 72.836 },
          label: { type: 'string', example: 'Mumbai Harbor' },
          demo: { type: 'boolean', default: false },
          include_explanation: { type: 'boolean', default: true },
          language: { type: 'string', enum: ['auto', 'mr', 'en'], default: 'auto' },
          vessel_class: {
            type: 'string',
            enum: [
              'traditional_non_motorized',
              'traditional_motorized',
              'mechanized_trawler',
              'multiday_gillnetter',
              'coastal_cargo',
              'patrol_craft',
              'recreational',
            ],
            example: 'traditional_motorized',
          },
          vessel_beam_m: { type: 'number', minimum: 0, example: 2.2 },
          fuel_endurance_h: { type: 'number', minimum: 0, example: 12.0 },
          last_known_latitude: { type: 'number', example: 18.94 },
          last_known_longitude: { type: 'number', example: 72.83 },
          forecast_horizon_h: { type: 'number', minimum: 1, maximum: 72, default: 3.0 },
          enable_geofencing: { type: 'boolean', default: false },
        },
      },
      AssessmentResponse: {
        type: 'object',
        required: ['request_id', 'decision', 'veto', 'risk', 'confidence', 'data_quality'],
        properties: {
          request_id: { type: 'string', example: 'req_8f1b2c3d' },
          assessed_at: { type: 'string', format: 'date-time' },
          mode: { type: 'string', enum: ['live', 'cached', 'demo', 'config_required'] },
          is_demo: { type: 'boolean' },
          decision: { type: 'string', enum: ['GO', 'CAUTION', 'NO-GO'] },
          deterministic_decision: { type: 'string', enum: ['GO', 'CAUTION', 'NO-GO'] },
          veto: {
            type: 'object',
            properties: {
              is_veto: { type: 'boolean' },
              triggered: { type: 'boolean' },
              decision: { type: 'string', enum: ['GO', 'CAUTION', 'NO-GO'] },
              reasons: { type: 'array', items: { type: 'string' } },
              reason_codes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: [
                    'OFFICIAL_WARNING',
                    'WAVE_LIMIT_EXCEEDED',
                    'WIND_LIMIT_EXCEEDED',
                    'BOUNDARY_PROXIMITY_VIOLATION',
                    'RESTRICTED_MARINE_SANCTUARY',
                    'CRITICAL_IMBL_PROXIMITY',
                  ],
                },
              },
            },
          },
          risk: {
            type: 'object',
            properties: {
              score: { type: 'number', minimum: 0, maximum: 100 },
              level: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH'] },
              risk_index: { type: 'number', minimum: 0, maximum: 1 },
              warning_override: { type: 'boolean' },
              recommendation: { type: 'string' },
            },
          },
          confidence: {
            type: 'object',
            properties: {
              score: { type: 'number', minimum: 0, maximum: 1 },
              is_high_confidence: { type: 'boolean' },
            },
          },
          data_quality: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['NORMAL', 'DEGRADED', 'INCOMPLETE', 'UNAVAILABLE'] },
              is_degraded: { type: 'boolean' },
              completeness_ratio: { type: 'number' },
              degradation_notes: { type: 'array', items: { type: 'string' } },
            },
          },
          drift: { type: 'object' },
          geofencing: { type: 'object' },
          evidence: { type: 'object' },
          explanation: { type: 'object', nullable: true },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Valid latitude is required.' },
              field: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  },
};
