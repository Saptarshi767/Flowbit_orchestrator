// Local type definitions - normally would import from shared package
enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
}

interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  engineType: EngineType;
  definition: any;
  version?: number;
  metadata?: Record<string, any>;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}
import { Logger } from './logger';

/**
 * Langflow workflow structure
 */
export interface LangflowWorkflow {
  id?: string;
  name: string;
  description?: string;
  data: {
    nodes: LangflowNode[];
    edges: LangflowEdge[];
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  tweaks?: Record<string, any>;
  is_component?: boolean;
  updated_at?: string;
  folder?: string;
  endpoint_name?: string;
}

export interface LangflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    type: string;
    node: {
      template: Record<string, any>;
      description: string;
      base_classes: string[];
      name: string;
      display_name: string;
      custom_fields?: Record<string, any>;
      output_types?: string[];
      documentation?: string;
      beta?: boolean;
    };
    value?: any;
  };
  width?: number;
  height?: number;
  selected?: boolean;
  dragging?: boolean;
}

export interface LangflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, any>;
  data?: any;
}

/**
 * Import/Export options
 */
export interface ImportOptions {
  validateStructure?: boolean;
  preserveIds?: boolean;
  generateMissingIds?: boolean;
  defaultTweaks?: Record<string, any>;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  minify?: boolean;
  includePrivateFields?: boolean;
  format?: 'json' | 'yaml';
}

/**
 * Utility class for converting workflows to/from Langflow format
 */
export class LangflowConverter {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('langflow-converter');
  }

  /**
   * Imports a Langflow workflow and converts it to our standard format
   */
  async importWorkflow(
    langflowData: any,
    options: ImportOptions = {}
  ): Promise<WorkflowDefinition> {
    const {
      validateStructure = true,
      preserveIds = true,
      generateMissingIds = true,
      defaultTweaks = {}
    } = options;

    try {
      // Normalize the Langflow data first (this handles missing IDs)
      const normalizedData = this.normalizeLangflowData(langflowData, {
        preserveIds,
        generateMissingIds
      });

      // Validate input structure if requested (after normalization)
      if (validateStructure) {
        const validation = this.validateLangflowStructure(normalizedData);
        if (!validation.isValid) {
          throw new Error(`Invalid Langflow structure: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // Create our standard workflow definition
      const workflowDefinition: WorkflowDefinition = {
        id: preserveIds ? normalizedData.id : undefined,
        name: normalizedData.name || 'Imported Langflow Workflow',
        description: normalizedData.description || 'Workflow imported from Langflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          ...normalizedData,
          tweaks: {
            ...defaultTweaks,
            ...normalizedData.tweaks
          }
        },
        metadata: {
          importedAt: new Date().toISOString(),
          originalFormat: 'langflow',
          nodeCount: normalizedData.data?.nodes?.length || 0,
          edgeCount: normalizedData.data?.edges?.length || 0,
          hasCustomComponents: this.hasCustomComponents(normalizedData),
          langflowVersion: this.detectLangflowVersion(normalizedData)
        }
      };

      this.logger.info('Successfully imported Langflow workflow', {
        name: workflowDefinition.name,
        nodeCount: workflowDefinition.metadata?.nodeCount,
        edgeCount: workflowDefinition.metadata?.edgeCount
      });

      return workflowDefinition;

    } catch (error) {
      this.logger.error('Failed to import Langflow workflow', { error });
      throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Exports our workflow definition to Langflow format
   */
  async exportWorkflow(
    workflow: WorkflowDefinition,
    options: ExportOptions = {}
  ): Promise<any> {
    const {
      includeMetadata = true,
      minify = false,
      includePrivateFields = false,
      format = 'json'
    } = options;

    try {
      if (workflow.engineType !== EngineType.LANGFLOW) {
        throw new Error(`Cannot export ${workflow.engineType} workflow as Langflow format`);
      }

      const langflowData = workflow.definition as LangflowWorkflow;

      // Create export data
      const exportData: any = {
        name: workflow.name,
        description: workflow.description,
        data: langflowData.data,
        tweaks: langflowData.tweaks || {}
      };

      // Include optional fields
      if (langflowData.id) {
        exportData.id = langflowData.id;
      }

      if (langflowData.is_component !== undefined) {
        exportData.is_component = langflowData.is_component;
      }

      if (langflowData.folder) {
        exportData.folder = langflowData.folder;
      }

      if (langflowData.endpoint_name) {
        exportData.endpoint_name = langflowData.endpoint_name;
      }

      // Include metadata if requested
      if (includeMetadata && workflow.metadata) {
        exportData._metadata = {
          exportedAt: new Date().toISOString(),
          exportedBy: 'RobustAI-Orchestrator',
          originalMetadata: workflow.metadata
        };
      }

      // Remove private fields if not requested
      if (!includePrivateFields) {
        this.removePrivateFields(exportData);
      }

      // Format output
      if (format === 'yaml') {
        // Note: Would need yaml library for this
        throw new Error('YAML export not implemented yet');
      }

      const result = minify ? JSON.stringify(exportData) : exportData;

      this.logger.info('Successfully exported workflow to Langflow format', {
        name: workflow.name,
        format,
        minified: minify
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to export workflow to Langflow format', { error });
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates Langflow workflow structure
   */
  validateLangflowStructure(data: any): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Check required fields
    if (!data.name || typeof data.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Workflow name is required and must be a string',
        code: 'MISSING_NAME'
      });
    }

    if (!data.data) {
      errors.push({
        field: 'data',
        message: 'Workflow data is required',
        code: 'MISSING_DATA'
      });
    } else {
      // Validate nodes
      if (!Array.isArray(data.data.nodes)) {
        errors.push({
          field: 'data.nodes',
          message: 'Nodes must be an array',
          code: 'INVALID_NODES'
        });
      } else {
        data.data.nodes.forEach((node: any, index: number) => {
          if (!node.id) {
            errors.push({
              field: `data.nodes[${index}].id`,
              message: 'Node ID is required',
              code: 'MISSING_NODE_ID'
            });
          }
          if (!node.type) {
            errors.push({
              field: `data.nodes[${index}].type`,
              message: 'Node type is required',
              code: 'MISSING_NODE_TYPE'
            });
          }
          if (!node.data?.type) {
            errors.push({
              field: `data.nodes[${index}].data.type`,
              message: 'Node data type is required',
              code: 'MISSING_NODE_DATA_TYPE'
            });
          }
        });
      }

      // Validate edges
      if (!Array.isArray(data.data.edges)) {
        errors.push({
          field: 'data.edges',
          message: 'Edges must be an array',
          code: 'INVALID_EDGES'
        });
      } else {
        data.data.edges.forEach((edge: any, index: number) => {
          if (!edge.id) {
            errors.push({
              field: `data.edges[${index}].id`,
              message: 'Edge ID is required',
              code: 'MISSING_EDGE_ID'
            });
          }
          if (!edge.source) {
            errors.push({
              field: `data.edges[${index}].source`,
              message: 'Edge source is required',
              code: 'MISSING_EDGE_SOURCE'
            });
          }
          if (!edge.target) {
            errors.push({
              field: `data.edges[${index}].target`,
              message: 'Edge target is required',
              code: 'MISSING_EDGE_TARGET'
            });
          }
        });
      }
    }

    // Check for potential issues
    if (data.data?.nodes?.length === 0) {
      warnings.push({
        field: 'data.nodes',
        message: 'Workflow has no nodes',
        code: 'EMPTY_WORKFLOW'
      });
    }

    if (data.data?.edges?.length === 0 && data.data?.nodes?.length > 1) {
      warnings.push({
        field: 'data.edges',
        message: 'Workflow has multiple nodes but no edges',
        code: 'DISCONNECTED_NODES'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Normalizes Langflow data structure
   */
  private normalizeLangflowData(
    data: any,
    options: { preserveIds: boolean; generateMissingIds: boolean }
  ): LangflowWorkflow {
    const normalized: LangflowWorkflow = {
      name: data.name || 'Untitled Workflow',
      description: data.description || '',
      data: {
        nodes: [],
        edges: [],
        viewport: data.data?.viewport || { x: 0, y: 0, zoom: 1 }
      },
      tweaks: data.tweaks || {}
    };

    // Preserve or generate ID
    if (options.preserveIds && data.id) {
      normalized.id = data.id;
    } else if (options.generateMissingIds && !data.id) {
      normalized.id = this.generateId();
    }

    // Copy optional fields
    if (data.is_component !== undefined) {
      normalized.is_component = data.is_component;
    }
    if (data.folder) {
      normalized.folder = data.folder;
    }
    if (data.endpoint_name) {
      normalized.endpoint_name = data.endpoint_name;
    }
    if (data.updated_at) {
      normalized.updated_at = data.updated_at;
    }

    // Normalize nodes
    if (data.data?.nodes) {
      normalized.data.nodes = data.data.nodes.map((node: any) => ({
        id: node.id || (options.generateMissingIds ? this.generateId() : ''),
        type: node.type || 'default',
        position: node.position || { x: 0, y: 0 },
        data: {
          type: node.data?.type || node.type || 'default',
          node: {
            template: node.data?.node?.template || {},
            description: node.data?.node?.description || '',
            base_classes: node.data?.node?.base_classes || [],
            name: node.data?.node?.name || node.type || 'unknown',
            display_name: node.data?.node?.display_name || node.data?.node?.name || node.type || 'Unknown',
            ...node.data?.node
          },
          value: node.data?.value
        },
        width: node.width,
        height: node.height,
        selected: node.selected,
        dragging: node.dragging
      }));
    }

    // Normalize edges
    if (data.data?.edges) {
      normalized.data.edges = data.data.edges.map((edge: any) => ({
        id: edge.id || (options.generateMissingIds ? this.generateId() : ''),
        source: edge.source || '',
        target: edge.target || '',
        sourceHandle: edge.sourceHandle || '',
        targetHandle: edge.targetHandle || '',
        type: edge.type,
        animated: edge.animated,
        style: edge.style,
        data: edge.data
      }));
    }

    return normalized;
  }

  /**
   * Detects if workflow has custom components
   */
  private hasCustomComponents(data: LangflowWorkflow): boolean {
    return data.data.nodes.some(node => 
      node.data.node.custom_fields || 
      node.data.node.beta ||
      node.type.startsWith('custom_')
    );
  }

  /**
   * Attempts to detect Langflow version from workflow structure
   */
  private detectLangflowVersion(data: LangflowWorkflow): string {
    // This is a heuristic approach based on known structure changes
    if (data.data.nodes.some(node => node.data.node.output_types)) {
      return '>=1.0.0';
    }
    if (data.data.nodes.some(node => node.data.node.custom_fields)) {
      return '>=0.6.0';
    }
    return 'unknown';
  }

  /**
   * Removes private/internal fields from export data
   */
  private removePrivateFields(data: any): void {
    const privateFields = ['_id', '_rev', '_internal', 'password', 'secret', 'token'];
    
    const removeFromObject = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const key of Object.keys(obj)) {
        if (privateFields.some(field => key.toLowerCase().includes(field))) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          removeFromObject(obj[key]);
        }
      }
    };

    removeFromObject(data);
  }

  /**
   * Generates a unique ID
   */
  private generateId(): string {
    return `lf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Converts workflow between different Langflow versions
   */
  async migrateWorkflow(
    workflow: LangflowWorkflow,
    fromVersion: string,
    toVersion: string
  ): Promise<LangflowWorkflow> {
    // This would contain version-specific migration logic
    // For now, return as-is
    this.logger.info('Workflow migration requested', { fromVersion, toVersion });
    return workflow;
  }

  /**
   * Validates workflow connectivity (all nodes are reachable)
   */
  validateConnectivity(workflow: LangflowWorkflow): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    const nodeIds = new Set(workflow.data.nodes.map(node => node.id));
    const connectedNodes = new Set<string>();

    // Check if all edge references exist
    workflow.data.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          field: `edges[${index}].source`,
          message: `Edge references non-existent source node: ${edge.source}`,
          code: 'INVALID_EDGE_SOURCE'
        });
      } else {
        connectedNodes.add(edge.source);
      }

      if (!nodeIds.has(edge.target)) {
        errors.push({
          field: `edges[${index}].target`,
          message: `Edge references non-existent target node: ${edge.target}`,
          code: 'INVALID_EDGE_TARGET'
        });
      } else {
        connectedNodes.add(edge.target);
      }
    });

    // Check for isolated nodes
    const isolatedNodes = workflow.data.nodes.filter(node => !connectedNodes.has(node.id));
    if (isolatedNodes.length > 0) {
      warnings.push({
        field: 'nodes',
        message: `Found ${isolatedNodes.length} isolated nodes: ${isolatedNodes.map(n => n.id).join(', ')}`,
        code: 'ISOLATED_NODES'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}