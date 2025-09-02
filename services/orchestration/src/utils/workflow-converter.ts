import { EngineType, WorkflowDefinition } from '@robust-ai-orchestrator/shared';
import { Logger } from './logger';

/**
 * Utility class for converting workflows between different engine formats
 */
export class WorkflowConverter {
  private static readonly logger = new Logger('workflow-converter');

  /**
   * Converts a workflow from one engine format to another
   * @param workflow - The source workflow
   * @param targetEngine - The target engine type
   * @returns Promise resolving to converted workflow
   */
  static async convertWorkflow(
    workflow: WorkflowDefinition, 
    targetEngine: EngineType
  ): Promise<WorkflowDefinition> {
    const sourceEngine = workflow.engineType;
    
    if (sourceEngine === targetEngine) {
      return { ...workflow };
    }

    this.logger.info('Converting workflow', {
      from: sourceEngine,
      to: targetEngine,
      workflowName: workflow.name
    });

    try {
      switch (`${sourceEngine}->${targetEngine}`) {
        case `${EngineType.LANGFLOW}->${EngineType.N8N}`:
          return await this.convertLangflowToN8N(workflow);
        case `${EngineType.LANGFLOW}->${EngineType.LANGSMITH}`:
          return await this.convertLangflowToLangSmith(workflow);
        case `${EngineType.N8N}->${EngineType.LANGFLOW}`:
          return await this.convertN8NToLangflow(workflow);
        case `${EngineType.N8N}->${EngineType.LANGSMITH}`:
          return await this.convertN8NToLangSmith(workflow);
        case `${EngineType.LANGSMITH}->${EngineType.LANGFLOW}`:
          return await this.convertLangSmithToLangflow(workflow);
        case `${EngineType.LANGSMITH}->${EngineType.N8N}`:
          return await this.convertLangSmithToN8N(workflow);
        default:
          throw new Error(`Conversion from ${sourceEngine} to ${targetEngine} is not supported`);
      }
    } catch (error) {
      this.logger.error('Workflow conversion failed', {
        from: sourceEngine,
        to: targetEngine,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Converts Langflow workflow to N8N format
   */
  private static async convertLangflowToN8N(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langflowDef = workflow.definition;
    const n8nNodes: any[] = [];
    const n8nConnections: any = {};

    // Convert Langflow nodes to N8N nodes
    if (langflowDef.nodes && Array.isArray(langflowDef.nodes)) {
      for (let i = 0; i < langflowDef.nodes.length; i++) {
        const langflowNode = langflowDef.nodes[i];
        const n8nNode = await this.convertLangflowNodeToN8N(langflowNode, i);
        n8nNodes.push(n8nNode);
      }
    }

    // Convert Langflow edges to N8N connections
    if (langflowDef.edges && Array.isArray(langflowDef.edges)) {
      this.convertLangflowEdgesToN8NConnections(langflowDef.edges, n8nConnections);
    }

    return {
      ...workflow,
      engineType: EngineType.N8N,
      definition: {
        nodes: n8nNodes,
        connections: n8nConnections,
        active: true,
        settings: {},
        staticData: null
      }
    };
  }

  /**
   * Converts Langflow workflow to LangSmith format
   */
  private static async convertLangflowToLangSmith(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langflowDef = workflow.definition;
    const components: any[] = [];
    const steps: any[] = [];

    // Convert Langflow nodes to LangSmith components
    if (langflowDef.nodes && Array.isArray(langflowDef.nodes)) {
      for (const node of langflowDef.nodes) {
        const component = await this.convertLangflowNodeToLangSmith(node);
        if (component) {
          components.push(component);
          steps.push({
            name: node.data?.display_name || node.id,
            component: component._type,
            config: component.config
          });
        }
      }
    }

    return {
      ...workflow,
      engineType: EngineType.LANGSMITH,
      definition: {
        components,
        steps,
        chain_type: 'sequential'
      }
    };
  }

  /**
   * Converts N8N workflow to Langflow format
   */
  private static async convertN8NToLangflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const n8nDef = workflow.definition;
    const langflowNodes: any[] = [];
    const langflowEdges: any[] = [];

    // Convert N8N nodes to Langflow nodes
    if (n8nDef.nodes && Array.isArray(n8nDef.nodes)) {
      for (let i = 0; i < n8nDef.nodes.length; i++) {
        const n8nNode = n8nDef.nodes[i];
        const langflowNode = await this.convertN8NNodeToLangflow(n8nNode, i);
        langflowNodes.push(langflowNode);
      }
    }

    // Convert N8N connections to Langflow edges
    if (n8nDef.connections) {
      this.convertN8NConnectionsToLangflowEdges(n8nDef.connections, langflowEdges);
    }

    return {
      ...workflow,
      engineType: EngineType.LANGFLOW,
      definition: {
        nodes: langflowNodes,
        edges: langflowEdges,
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    };
  }

  /**
   * Converts N8N workflow to LangSmith format
   */
  private static async convertN8NToLangSmith(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    // This is a complex conversion that would require mapping N8N node types
    // to LangSmith components. For now, we'll create a basic structure.
    const n8nDef = workflow.definition;
    const steps: any[] = [];

    if (n8nDef.nodes && Array.isArray(n8nDef.nodes)) {
      for (const node of n8nDef.nodes) {
        const step = await this.convertN8NNodeToLangSmithStep(node);
        if (step) {
          steps.push(step);
        }
      }
    }

    return {
      ...workflow,
      engineType: EngineType.LANGSMITH,
      definition: {
        steps,
        chain_type: 'sequential'
      }
    };
  }

  /**
   * Converts LangSmith workflow to Langflow format
   */
  private static async convertLangSmithToLangflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langsmithDef = workflow.definition;
    const langflowNodes: any[] = [];
    const langflowEdges: any[] = [];

    // Convert LangSmith steps to Langflow nodes
    if (langsmithDef.steps && Array.isArray(langsmithDef.steps)) {
      for (let i = 0; i < langsmithDef.steps.length; i++) {
        const step = langsmithDef.steps[i];
        const langflowNode = await this.convertLangSmithStepToLangflow(step, i);
        langflowNodes.push(langflowNode);

        // Create sequential edges
        if (i > 0) {
          langflowEdges.push({
            id: `edge-${i-1}-${i}`,
            source: `node-${i-1}`,
            target: `node-${i}`,
            sourceHandle: 'output',
            targetHandle: 'input'
          });
        }
      }
    }

    return {
      ...workflow,
      engineType: EngineType.LANGFLOW,
      definition: {
        nodes: langflowNodes,
        edges: langflowEdges,
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    };
  }

  /**
   * Converts LangSmith workflow to N8N format
   */
  private static async convertLangSmithToN8N(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langsmithDef = workflow.definition;
    const n8nNodes: any[] = [];
    const n8nConnections: any = {};

    // Convert LangSmith steps to N8N nodes
    if (langsmithDef.steps && Array.isArray(langsmithDef.steps)) {
      for (let i = 0; i < langsmithDef.steps.length; i++) {
        const step = langsmithDef.steps[i];
        const n8nNode = await this.convertLangSmithStepToN8N(step, i);
        n8nNodes.push(n8nNode);

        // Create sequential connections
        if (i > 0) {
          const sourceNodeName = `node-${i-1}`;
          const targetNodeName = `node-${i}`;
          
          if (!n8nConnections[sourceNodeName]) {
            n8nConnections[sourceNodeName] = { main: [[]] };
          }
          n8nConnections[sourceNodeName].main[0].push({
            node: targetNodeName,
            type: 'main',
            index: 0
          });
        }
      }
    }

    return {
      ...workflow,
      engineType: EngineType.N8N,
      definition: {
        nodes: n8nNodes,
        connections: n8nConnections,
        active: true,
        settings: {},
        staticData: null
      }
    };
  }

  // Helper methods for node conversions
  private static async convertLangflowNodeToN8N(langflowNode: any, index: number): Promise<any> {
    return {
      id: langflowNode.id || `node-${index}`,
      name: langflowNode.data?.display_name || `Node ${index}`,
      type: 'n8n-nodes-base.function', // Default to function node
      typeVersion: 1,
      position: [
        langflowNode.position?.x || index * 200,
        langflowNode.position?.y || 0
      ],
      parameters: {
        functionCode: `// Converted from Langflow node: ${langflowNode.data?.type || 'unknown'}\nreturn items;`
      }
    };
  }

  private static async convertLangflowNodeToLangSmith(langflowNode: any): Promise<any> {
    const nodeType = langflowNode.data?.type;
    
    switch (nodeType) {
      case 'ChatInput':
        return {
          _type: 'ChatPromptTemplate',
          config: {
            template: langflowNode.data?.node?.template?.input_value?.value || '{input}'
          }
        };
      case 'LLMChain':
        return {
          _type: 'LLMChain',
          config: {
            llm: langflowNode.data?.node?.template?.llm || {},
            prompt: langflowNode.data?.node?.template?.prompt || {}
          }
        };
      default:
        return {
          _type: 'CustomComponent',
          config: {
            original_type: nodeType,
            parameters: langflowNode.data?.node?.template || {}
          }
        };
    }
  }

  private static async convertN8NNodeToLangflow(n8nNode: any, index: number): Promise<any> {
    return {
      id: n8nNode.id || `node-${index}`,
      type: 'customNode',
      position: {
        x: n8nNode.position?.[0] || index * 200,
        y: n8nNode.position?.[1] || 0
      },
      data: {
        type: 'CustomNode',
        display_name: n8nNode.name || `Node ${index}`,
        node: {
          template: {
            original_type: { value: n8nNode.type },
            parameters: { value: n8nNode.parameters || {} }
          }
        }
      }
    };
  }

  private static async convertN8NNodeToLangSmithStep(n8nNode: any): Promise<any> {
    return {
      name: n8nNode.name || n8nNode.id,
      component: 'CustomComponent',
      config: {
        original_type: n8nNode.type,
        parameters: n8nNode.parameters || {}
      }
    };
  }

  private static async convertLangSmithStepToLangflow(step: any, index: number): Promise<any> {
    return {
      id: `node-${index}`,
      type: 'customNode',
      position: {
        x: index * 200,
        y: 0
      },
      data: {
        type: 'CustomNode',
        display_name: step.name || `Step ${index}`,
        node: {
          template: {
            component_type: { value: step.component },
            config: { value: step.config || {} }
          }
        }
      }
    };
  }

  private static async convertLangSmithStepToN8N(step: any, index: number): Promise<any> {
    return {
      id: `node-${index}`,
      name: step.name || `Step ${index}`,
      type: 'n8n-nodes-base.function',
      typeVersion: 1,
      position: [index * 200, 0],
      parameters: {
        functionCode: `// Converted from LangSmith step: ${step.component}\nreturn items;`
      }
    };
  }

  private static convertLangflowEdgesToN8NConnections(edges: any[], connections: any): void {
    for (const edge of edges) {
      const sourceNode = edge.source;
      const targetNode = edge.target;
      
      if (!connections[sourceNode]) {
        connections[sourceNode] = { main: [[]] };
      }
      
      connections[sourceNode].main[0].push({
        node: targetNode,
        type: 'main',
        index: 0
      });
    }
  }

  private static convertN8NConnectionsToLangflowEdges(connections: any, edges: any[]): void {
    for (const [sourceNode, nodeConnections] of Object.entries(connections)) {
      if (nodeConnections && (nodeConnections as any).main) {
        const mainConnections = (nodeConnections as any).main[0] || [];
        for (let i = 0; i < mainConnections.length; i++) {
          const connection = mainConnections[i];
          edges.push({
            id: `edge-${sourceNode}-${connection.node}-${i}`,
            source: sourceNode,
            target: connection.node,
            sourceHandle: 'output',
            targetHandle: 'input'
          });
        }
      }
    }
  }

  /**
   * Gets conversion compatibility matrix
   */
  static getConversionMatrix(): Record<string, EngineType[]> {
    return {
      [EngineType.LANGFLOW]: [EngineType.N8N, EngineType.LANGSMITH],
      [EngineType.N8N]: [EngineType.LANGFLOW, EngineType.LANGSMITH],
      [EngineType.LANGSMITH]: [EngineType.LANGFLOW, EngineType.N8N]
    };
  }

  /**
   * Checks if conversion between two engine types is supported
   */
  static isConversionSupported(from: EngineType, to: EngineType): boolean {
    const supportedTargets = this.getConversionMatrix()[from];
    return supportedTargets ? supportedTargets.includes(to) : false;
  }
}