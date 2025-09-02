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
import { Logger } from './logger';

/**
 * N8N workflow format converter
 * Handles conversion between different workflow formats and N8N format
 */
export class N8NConverter {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('n8n-converter');
  }

  /**
   * Converts a generic workflow definition to N8N format
   */
  async convertToN8N(
    workflow: WorkflowDefinition,
    sourceEngine: EngineType
  ): Promise<WorkflowDefinition> {
    this.logger.info('Converting workflow to N8N format', {
      workflowName: workflow.name,
      sourceEngine,
      targetEngine: EngineType.N8N
    });

    switch (sourceEngine) {
      case EngineType.LANGFLOW:
        return this.convertFromLangflow(workflow);
      case EngineType.LANGSMITH:
        return this.convertFromLangSmith(workflow);
      case EngineType.N8N:
        return workflow; // Already in N8N format
      default:
        throw new Error(`Conversion from ${sourceEngine} to N8N is not supported`);
    }
  }

  /**
   * Converts from N8N format to another engine format
   */
  async convertFromN8N(
    workflow: WorkflowDefinition,
    targetEngine: EngineType
  ): Promise<WorkflowDefinition> {
    this.logger.info('Converting workflow from N8N format', {
      workflowName: workflow.name,
      sourceEngine: EngineType.N8N,
      targetEngine
    });

    switch (targetEngine) {
      case EngineType.LANGFLOW:
        return this.convertToLangflow(workflow);
      case EngineType.LANGSMITH:
        return this.convertToLangSmith(workflow);
      case EngineType.N8N:
        return workflow; // Already in N8N format
      default:
        throw new Error(`Conversion from N8N to ${targetEngine} is not supported`);
    }
  }

  /**
   * Converts Langflow workflow to N8N format
   */
  private async convertFromLangflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langflowDef = workflow.definition;
    
    if (!langflowDef.data?.nodes || !langflowDef.data?.edges) {
      throw new Error('Invalid Langflow workflow structure');
    }

    // Map Langflow nodes to N8N nodes
    const n8nNodes = langflowDef.data.nodes.map((node: any, index: number) => {
      const n8nNodeType = this.mapLangflowNodeToN8N(node.data.type);
      
      return {
        id: node.id,
        name: node.data.node.display_name || node.data.node.name || `Node_${index}`,
        type: n8nNodeType,
        typeVersion: 1,
        position: [node.position.x, node.position.y],
        parameters: this.convertLangflowParametersToN8N(node.data.node.template, n8nNodeType),
        credentials: this.extractCredentialsFromLangflow(node.data.node.template)
      };
    });

    // Map Langflow edges to N8N connections
    const n8nConnections = this.convertLangflowEdgesToN8NConnections(
      langflowDef.data.edges,
      n8nNodes
    );

    const n8nDefinition = {
      name: workflow.name,
      active: false,
      nodes: n8nNodes,
      connections: n8nConnections,
      settings: {
        executionOrder: 'v1' as const,
        saveManualExecutions: true
      },
      staticData: {},
      tags: workflow.metadata?.tags || [],
      pinData: {}
    };

    return {
      ...workflow,
      engineType: EngineType.N8N,
      definition: n8nDefinition
    };
  }

  /**
   * Converts LangSmith workflow to N8N format
   */
  private async convertFromLangSmith(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langsmithDef = workflow.definition;
    
    // LangSmith typically uses chain-based structures
    // This is a simplified conversion - real implementation would be more complex
    const n8nNodes = [];
    const n8nConnections: any = {};

    // Create a start node
    n8nNodes.push({
      id: 'start',
      name: 'Start',
      type: 'n8n-nodes-base.start',
      typeVersion: 1,
      position: [100, 100],
      parameters: {}
    });

    // Convert LangSmith chain to N8N nodes
    if (langsmithDef.chain) {
      let yPosition = 200;
      let previousNodeName = 'Start';

      langsmithDef.chain.forEach((step: any, index: number) => {
        const nodeName = `Step_${index + 1}`;
        const nodeType = this.mapLangSmithStepToN8N(step.type);

        n8nNodes.push({
          id: `step_${index}`,
          name: nodeName,
          type: nodeType,
          typeVersion: 1,
          position: [300, yPosition],
          parameters: this.convertLangSmithParametersToN8N(step.parameters, nodeType)
        });

        // Create connection from previous node
        if (!n8nConnections[previousNodeName]) {
          n8nConnections[previousNodeName] = {};
        }
        if (!n8nConnections[previousNodeName].main) {
          n8nConnections[previousNodeName].main = [];
        }
        n8nConnections[previousNodeName].main.push([{
          node: nodeName,
          type: 'main',
          index: 0
        }]);

        previousNodeName = nodeName;
        yPosition += 100;
      });
    }

    const n8nDefinition = {
      name: workflow.name,
      active: false,
      nodes: n8nNodes,
      connections: n8nConnections,
      settings: {
        executionOrder: 'v1' as const,
        saveManualExecutions: true
      },
      staticData: {},
      tags: workflow.metadata?.tags || [],
      pinData: {}
    };

    return {
      ...workflow,
      engineType: EngineType.N8N,
      definition: n8nDefinition
    };
  }

  /**
   * Converts N8N workflow to Langflow format
   */
  private async convertToLangflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const n8nDef = workflow.definition;
    
    // Map N8N nodes to Langflow nodes
    const langflowNodes = n8nDef.nodes.map((node: any) => {
      const langflowNodeType = this.mapN8NNodeToLangflow(node.type);
      
      return {
        id: node.id,
        type: 'genericNode',
        position: { x: node.position[0], y: node.position[1] },
        data: {
          type: langflowNodeType,
          node: {
            template: this.convertN8NParametersToLangflow(node.parameters, langflowNodeType),
            description: `Converted from N8N ${node.type}`,
            base_classes: ['Component'],
            name: node.name,
            display_name: node.name
          }
        }
      };
    });

    // Map N8N connections to Langflow edges
    const langflowEdges = this.convertN8NConnectionsToLangflowEdges(n8nDef.connections);

    const langflowDefinition = {
      name: workflow.name,
      data: {
        nodes: langflowNodes,
        edges: langflowEdges,
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      tweaks: {}
    };

    return {
      ...workflow,
      engineType: EngineType.LANGFLOW,
      definition: langflowDefinition
    };
  }

  /**
   * Converts N8N workflow to LangSmith format
   */
  private async convertToLangSmith(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const n8nDef = workflow.definition;
    
    // Build chain from N8N workflow
    const chain = [];
    const processedNodes = new Set<string>();
    
    // Find start node
    const startNode = n8nDef.nodes.find((node: any) => 
      node.type === 'n8n-nodes-base.start' || 
      node.type === 'n8n-nodes-base.manualTrigger'
    );

    if (startNode) {
      this.buildLangSmithChain(startNode, n8nDef.nodes, n8nDef.connections, chain, processedNodes);
    }

    const langsmithDefinition = {
      name: workflow.name,
      chain: chain,
      metadata: {
        convertedFrom: 'n8n',
        originalNodeCount: n8nDef.nodes.length
      }
    };

    return {
      ...workflow,
      engineType: EngineType.LANGSMITH,
      definition: langsmithDefinition
    };
  }

  /**
   * Maps Langflow node types to N8N node types
   */
  private mapLangflowNodeToN8N(langflowType: string): string {
    const typeMapping: Record<string, string> = {
      'TextInput': 'n8n-nodes-base.set',
      'LLMChain': 'n8n-nodes-base.httpRequest',
      'PromptTemplate': 'n8n-nodes-base.set',
      'OpenAI': 'n8n-nodes-base.openAi',
      'ChatOpenAI': 'n8n-nodes-base.openAi',
      'ConversationChain': 'n8n-nodes-base.httpRequest',
      'Memory': 'n8n-nodes-base.set',
      'VectorStore': 'n8n-nodes-base.pinecone',
      'Embeddings': 'n8n-nodes-base.openAi',
      'Document': 'n8n-nodes-base.set',
      'TextSplitter': 'n8n-nodes-base.code',
      'OutputParser': 'n8n-nodes-base.code'
    };

    return typeMapping[langflowType] || 'n8n-nodes-base.function';
  }

  /**
   * Maps N8N node types to Langflow node types
   */
  private mapN8NNodeToLangflow(n8nType: string): string {
    const typeMapping: Record<string, string> = {
      'n8n-nodes-base.openAi': 'ChatOpenAI',
      'n8n-nodes-base.httpRequest': 'LLMChain',
      'n8n-nodes-base.set': 'TextInput',
      'n8n-nodes-base.code': 'CustomComponent',
      'n8n-nodes-base.function': 'CustomComponent',
      'n8n-nodes-base.pinecone': 'VectorStore',
      'n8n-nodes-base.start': 'TextInput',
      'n8n-nodes-base.manualTrigger': 'TextInput'
    };

    return typeMapping[n8nType] || 'CustomComponent';
  }

  /**
   * Maps LangSmith step types to N8N node types
   */
  private mapLangSmithStepToN8N(stepType: string): string {
    const typeMapping: Record<string, string> = {
      'llm': 'n8n-nodes-base.openAi',
      'prompt': 'n8n-nodes-base.set',
      'chain': 'n8n-nodes-base.httpRequest',
      'retriever': 'n8n-nodes-base.pinecone',
      'memory': 'n8n-nodes-base.set',
      'parser': 'n8n-nodes-base.code',
      'tool': 'n8n-nodes-base.function'
    };

    return typeMapping[stepType] || 'n8n-nodes-base.function';
  }

  /**
   * Converts Langflow parameters to N8N parameters
   */
  private convertLangflowParametersToN8N(template: any, n8nNodeType: string): any {
    const parameters: any = {};

    // Basic parameter mapping based on node type
    switch (n8nNodeType) {
      case 'n8n-nodes-base.openAi':
        if (template.model) {
          parameters.model = template.model.value || 'gpt-3.5-turbo';
        }
        if (template.temperature) {
          parameters.temperature = template.temperature.value || 0.7;
        }
        if (template.max_tokens) {
          parameters.maxTokens = template.max_tokens.value || 1000;
        }
        break;
      
      case 'n8n-nodes-base.httpRequest':
        parameters.method = 'POST';
        parameters.url = template.url?.value || 'https://api.openai.com/v1/chat/completions';
        if (template.headers) {
          parameters.headers = template.headers.value || {};
        }
        break;
      
      case 'n8n-nodes-base.set':
        if (template.value) {
          parameters.values = {
            string: [
              {
                name: 'data',
                value: template.value.value || ''
              }
            ]
          };
        }
        break;
    }

    return parameters;
  }

  /**
   * Converts N8N parameters to Langflow parameters
   */
  private convertN8NParametersToLangflow(parameters: any, langflowType: string): any {
    const template: any = {};

    // Basic parameter mapping based on Langflow type
    switch (langflowType) {
      case 'ChatOpenAI':
        if (parameters.model) {
          template.model = { value: parameters.model };
        }
        if (parameters.temperature) {
          template.temperature = { value: parameters.temperature };
        }
        if (parameters.maxTokens) {
          template.max_tokens = { value: parameters.maxTokens };
        }
        break;
      
      case 'TextInput':
        if (parameters.values?.string?.[0]?.value) {
          template.value = { value: parameters.values.string[0].value };
        }
        break;
      
      case 'LLMChain':
        if (parameters.url) {
          template.url = { value: parameters.url };
        }
        if (parameters.headers) {
          template.headers = { value: parameters.headers };
        }
        break;
    }

    return template;
  }

  /**
   * Converts LangSmith parameters to N8N parameters
   */
  private convertLangSmithParametersToN8N(parameters: any, n8nNodeType: string): any {
    // Similar to Langflow conversion but adapted for LangSmith structure
    const n8nParams: any = {};

    switch (n8nNodeType) {
      case 'n8n-nodes-base.openAi':
        n8nParams.model = parameters.model || 'gpt-3.5-turbo';
        n8nParams.temperature = parameters.temperature || 0.7;
        n8nParams.maxTokens = parameters.max_tokens || 1000;
        break;
      
      case 'n8n-nodes-base.set':
        n8nParams.values = {
          string: [
            {
              name: 'data',
              value: parameters.input || parameters.value || ''
            }
          ]
        };
        break;
    }

    return n8nParams;
  }

  /**
   * Extracts credentials from Langflow node template
   */
  private extractCredentialsFromLangflow(template: any): Record<string, string> | undefined {
    const credentials: Record<string, string> = {};
    
    if (template.api_key) {
      credentials.openAiApi = 'openai_credentials';
    }
    
    if (template.credentials) {
      Object.assign(credentials, template.credentials.value || {});
    }

    return Object.keys(credentials).length > 0 ? credentials : undefined;
  }

  /**
   * Converts Langflow edges to N8N connections
   */
  private convertLangflowEdgesToN8NConnections(edges: any[], nodes: any[]): any {
    const connections: any = {};

    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        if (!connections[sourceNode.name]) {
          connections[sourceNode.name] = {};
        }
        if (!connections[sourceNode.name].main) {
          connections[sourceNode.name].main = [];
        }

        connections[sourceNode.name].main.push([{
          node: targetNode.name,
          type: 'main',
          index: 0
        }]);
      }
    });

    return connections;
  }

  /**
   * Converts N8N connections to Langflow edges
   */
  private convertN8NConnectionsToLangflowEdges(connections: any): any[] {
    const edges: any[] = [];
    let edgeId = 0;

    Object.entries(connections).forEach(([sourceNodeName, nodeConnections]: [string, any]) => {
      if (nodeConnections.main) {
        nodeConnections.main.forEach((outputConnections: any[]) => {
          outputConnections.forEach((connection: any) => {
            edges.push({
              id: `edge_${edgeId++}`,
              source: sourceNodeName,
              target: connection.node,
              sourceHandle: 'main',
              targetHandle: 'main'
            });
          });
        });
      }
    });

    return edges;
  }

  /**
   * Builds LangSmith chain from N8N workflow
   */
  private buildLangSmithChain(
    currentNode: any,
    allNodes: any[],
    connections: any,
    chain: any[],
    processedNodes: Set<string>
  ): void {
    if (processedNodes.has(currentNode.name)) {
      return;
    }

    processedNodes.add(currentNode.name);

    // Add current node to chain (skip start nodes)
    if (currentNode.type !== 'n8n-nodes-base.start' && 
        currentNode.type !== 'n8n-nodes-base.manualTrigger') {
      chain.push({
        type: this.mapN8NNodeToLangSmithStep(currentNode.type),
        name: currentNode.name,
        parameters: this.convertN8NParametersToLangSmith(currentNode.parameters, currentNode.type)
      });
    }

    // Process connected nodes
    const nodeConnections = connections[currentNode.name];
    if (nodeConnections?.main) {
      nodeConnections.main.forEach((outputConnections: any[]) => {
        outputConnections.forEach((connection: any) => {
          const nextNode = allNodes.find(n => n.name === connection.node);
          if (nextNode) {
            this.buildLangSmithChain(nextNode, allNodes, connections, chain, processedNodes);
          }
        });
      });
    }
  }

  /**
   * Maps N8N node types to LangSmith step types
   */
  private mapN8NNodeToLangSmithStep(n8nType: string): string {
    const typeMapping: Record<string, string> = {
      'n8n-nodes-base.openAi': 'llm',
      'n8n-nodes-base.httpRequest': 'chain',
      'n8n-nodes-base.set': 'prompt',
      'n8n-nodes-base.code': 'tool',
      'n8n-nodes-base.function': 'tool',
      'n8n-nodes-base.pinecone': 'retriever'
    };

    return typeMapping[n8nType] || 'tool';
  }

  /**
   * Converts N8N parameters to LangSmith parameters
   */
  private convertN8NParametersToLangSmith(parameters: any, n8nType: string): any {
    const langsmithParams: any = {};

    switch (n8nType) {
      case 'n8n-nodes-base.openAi':
        langsmithParams.model = parameters.model || 'gpt-3.5-turbo';
        langsmithParams.temperature = parameters.temperature || 0.7;
        langsmithParams.max_tokens = parameters.maxTokens || 1000;
        break;
      
      case 'n8n-nodes-base.set':
        if (parameters.values?.string?.[0]?.value) {
          langsmithParams.value = parameters.values.string[0].value;
        }
        break;
      
      case 'n8n-nodes-base.httpRequest':
        langsmithParams.url = parameters.url;
        langsmithParams.method = parameters.method;
        langsmithParams.headers = parameters.headers;
        break;
    }

    return langsmithParams;
  }
}