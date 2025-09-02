import { Logger } from './logger';
import {
  WorkflowDefinition,
  EngineType
} from '@robust-ai-orchestrator/shared';

/**
 * LangSmith workflow format converter
 * Handles conversion between different workflow formats and LangSmith format
 */
export class LangSmithConverter {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('langsmith-converter');
  }

  /**
   * Converts a generic workflow definition to LangSmith format
   */
  async convertToLangSmith(
    workflow: WorkflowDefinition,
    sourceEngine: EngineType
  ): Promise<WorkflowDefinition> {
    this.logger.info('Converting workflow to LangSmith format', {
      workflowName: workflow.name,
      sourceEngine,
      targetEngine: EngineType.LANGSMITH
    });

    switch (sourceEngine) {
      case EngineType.LANGFLOW:
        return this.convertFromLangflow(workflow);
      case EngineType.N8N:
        return this.convertFromN8N(workflow);
      case EngineType.LANGSMITH:
        return workflow; // Already in LangSmith format
      default:
        throw new Error(`Conversion from ${sourceEngine} to LangSmith is not supported`);
    }
  }

  /**
   * Converts from LangSmith format to another engine format
   */
  async convertFromLangSmith(
    workflow: WorkflowDefinition,
    targetEngine: EngineType
  ): Promise<WorkflowDefinition> {
    this.logger.info('Converting workflow from LangSmith format', {
      workflowName: workflow.name,
      sourceEngine: EngineType.LANGSMITH,
      targetEngine
    });

    switch (targetEngine) {
      case EngineType.LANGFLOW:
        return this.convertToLangflow(workflow);
      case EngineType.N8N:
        return this.convertToN8N(workflow);
      case EngineType.LANGSMITH:
        return workflow; // Already in LangSmith format
      default:
        throw new Error(`Conversion from LangSmith to ${targetEngine} is not supported`);
    }
  }

  /**
   * Converts Langflow workflow to LangSmith format
   */
  private async convertFromLangflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langflowDef = workflow.definition;
    
    if (!langflowDef.data?.nodes || !langflowDef.data?.edges) {
      throw new Error('Invalid Langflow workflow structure');
    }

    // Build chain from Langflow nodes and edges
    const chain = [];
    const processedNodes = new Set<string>();
    
    // Find start nodes (nodes with no incoming edges)
    const incomingEdges = new Set(langflowDef.data.edges.map((edge: any) => edge.target));
    const startNodes = langflowDef.data.nodes.filter((node: any) => !incomingEdges.has(node.id));

    // Process nodes in topological order
    for (const startNode of startNodes) {
      this.buildLangSmithChainFromLangflow(
        startNode,
        langflowDef.data.nodes,
        langflowDef.data.edges,
        chain,
        processedNodes
      );
    }

    const langsmithDefinition = {
      name: workflow.name,
      description: workflow.description,
      chain: chain,
      metadata: {
        convertedFrom: 'langflow',
        originalNodeCount: langflowDef.data.nodes.length,
        tags: workflow.metadata?.tags || []
      },
      config: {
        tracing: true,
        evaluation: false,
        monitoring: true
      }
    };

    return {
      ...workflow,
      engineType: EngineType.LANGSMITH,
      definition: langsmithDefinition
    };
  }

  /**
   * Converts N8N workflow to LangSmith format
   */
  private async convertFromN8N(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const n8nDef = workflow.definition;
    
    if (!n8nDef.nodes || !n8nDef.connections) {
      throw new Error('Invalid N8N workflow structure');
    }

    // Build chain from N8N workflow
    const chain = [];
    const processedNodes = new Set<string>();
    
    // Find start node
    const startNode = n8nDef.nodes.find((node: any) => 
      node.type === 'n8n-nodes-base.start' || 
      node.type === 'n8n-nodes-base.manualTrigger'
    );

    if (startNode) {
      this.buildLangSmithChainFromN8N(
        startNode,
        n8nDef.nodes,
        n8nDef.connections,
        chain,
        processedNodes
      );
    }

    const langsmithDefinition = {
      name: workflow.name,
      description: workflow.description,
      chain: chain,
      metadata: {
        convertedFrom: 'n8n',
        originalNodeCount: n8nDef.nodes.length,
        tags: n8nDef.tags || []
      },
      config: {
        tracing: true,
        evaluation: false,
        monitoring: true
      }
    };

    return {
      ...workflow,
      engineType: EngineType.LANGSMITH,
      definition: langsmithDefinition
    };
  }

  /**
   * Converts LangSmith workflow to Langflow format
   */
  private async convertToLangflow(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langsmithDef = workflow.definition;
    
    if (!langsmithDef.chain) {
      throw new Error('Invalid LangSmith workflow structure');
    }

    // Map LangSmith chain to Langflow nodes
    const langflowNodes = langsmithDef.chain.map((step: any, index: number) => {
      const langflowNodeType = this.mapLangSmithStepToLangflow(step.type);
      
      return {
        id: step.id,
        type: 'genericNode',
        position: { x: 100 + (index * 200), y: 100 + (index * 100) },
        data: {
          type: langflowNodeType,
          node: {
            template: this.convertLangSmithParametersToLangflow(step.parameters, langflowNodeType),
            description: `Converted from LangSmith ${step.type}`,
            base_classes: ['Component'],
            name: step.name,
            display_name: step.name
          }
        }
      };
    });

    // Create edges based on dependencies
    const langflowEdges = [];
    let edgeId = 0;

    langsmithDef.chain.forEach((step: any) => {
      if (step.dependencies) {
        step.dependencies.forEach((depId: string) => {
          langflowEdges.push({
            id: `edge_${edgeId++}`,
            source: depId,
            target: step.id,
            sourceHandle: 'output',
            targetHandle: 'input'
          });
        });
      }
    });

    const langflowDefinition = {
      name: workflow.name,
      description: workflow.description,
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
   * Converts LangSmith workflow to N8N format
   */
  private async convertToN8N(workflow: WorkflowDefinition): Promise<WorkflowDefinition> {
    const langsmithDef = workflow.definition;
    
    if (!langsmithDef.chain) {
      throw new Error('Invalid LangSmith workflow structure');
    }

    // Create N8N nodes from LangSmith chain
    const n8nNodes = [];
    const n8nConnections: any = {};

    // Add start node
    n8nNodes.push({
      id: 'start',
      name: 'Start',
      type: 'n8n-nodes-base.start',
      typeVersion: 1,
      position: [100, 100],
      parameters: {}
    });

    // Convert LangSmith chain steps to N8N nodes
    langsmithDef.chain.forEach((step: any, index: number) => {
      const n8nNodeType = this.mapLangSmithStepToN8N(step.type);
      
      n8nNodes.push({
        id: step.id,
        name: step.name,
        type: n8nNodeType,
        typeVersion: 1,
        position: [300 + (index * 200), 100 + (index * 100)],
        parameters: this.convertLangSmithParametersToN8N(step.parameters, n8nNodeType)
      });
    });

    // Create connections based on dependencies
    let previousNodeName = 'Start';
    
    langsmithDef.chain.forEach((step: any) => {
      if (step.dependencies && step.dependencies.length > 0) {
        // Connect from dependencies
        step.dependencies.forEach((depId: string) => {
          const depStep = langsmithDef.chain.find((s: any) => s.id === depId);
          if (depStep) {
            if (!n8nConnections[depStep.name]) {
              n8nConnections[depStep.name] = {};
            }
            if (!n8nConnections[depStep.name].main) {
              n8nConnections[depStep.name].main = [];
            }
            n8nConnections[depStep.name].main.push([{
              node: step.name,
              type: 'main',
              index: 0
            }]);
          }
        });
      } else {
        // Connect from previous node
        if (!n8nConnections[previousNodeName]) {
          n8nConnections[previousNodeName] = {};
        }
        if (!n8nConnections[previousNodeName].main) {
          n8nConnections[previousNodeName].main = [];
        }
        n8nConnections[previousNodeName].main.push([{
          node: step.name,
          type: 'main',
          index: 0
        }]);
      }
      
      previousNodeName = step.name;
    });

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
      tags: langsmithDef.metadata?.tags || [],
      pinData: {}
    };

    return {
      ...workflow,
      engineType: EngineType.N8N,
      definition: n8nDefinition
    };
  }

  /**
   * Maps LangSmith step types to Langflow node types
   */
  private mapLangSmithStepToLangflow(stepType: string): string {
    const typeMapping: Record<string, string> = {
      'llm': 'ChatOpenAI',
      'prompt': 'PromptTemplate',
      'chain': 'LLMChain',
      'retriever': 'VectorStoreRetriever',
      'memory': 'ConversationBufferMemory',
      'parser': 'OutputParser',
      'tool': 'Tool',
      'custom': 'CustomComponent'
    };

    return typeMapping[stepType] || 'CustomComponent';
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
      'tool': 'n8n-nodes-base.function',
      'custom': 'n8n-nodes-base.function'
    };

    return typeMapping[stepType] || 'n8n-nodes-base.function';
  }

  /**
   * Converts LangSmith parameters to Langflow parameters
   */
  private convertLangSmithParametersToLangflow(parameters: any, langflowType: string): any {
    const template: any = {};

    switch (langflowType) {
      case 'ChatOpenAI':
        if (parameters.model) {
          template.model = { value: parameters.model };
        }
        if (parameters.temperature) {
          template.temperature = { value: parameters.temperature };
        }
        if (parameters.max_tokens) {
          template.max_tokens = { value: parameters.max_tokens };
        }
        if (parameters.api_key) {
          template.openai_api_key = { value: parameters.api_key };
        }
        break;
      
      case 'PromptTemplate':
        if (parameters.template) {
          template.template = { value: parameters.template };
        }
        if (parameters.input_variables) {
          template.input_variables = { value: parameters.input_variables };
        }
        break;
      
      case 'VectorStoreRetriever':
        if (parameters.vectorstore) {
          template.vectorstore = { value: parameters.vectorstore };
        }
        if (parameters.search_kwargs) {
          template.search_kwargs = { value: parameters.search_kwargs };
        }
        break;
      
      case 'ConversationBufferMemory':
        if (parameters.memory_key) {
          template.memory_key = { value: parameters.memory_key };
        }
        if (parameters.return_messages) {
          template.return_messages = { value: parameters.return_messages };
        }
        break;
    }

    return template;
  }

  /**
   * Converts LangSmith parameters to N8N parameters
   */
  private convertLangSmithParametersToN8N(parameters: any, n8nNodeType: string): any {
    const n8nParams: any = {};

    switch (n8nNodeType) {
      case 'n8n-nodes-base.openAi':
        n8nParams.model = parameters.model || 'gpt-3.5-turbo';
        n8nParams.temperature = parameters.temperature || 0.7;
        n8nParams.maxTokens = parameters.max_tokens || 1000;
        if (parameters.messages) {
          n8nParams.messages = parameters.messages;
        }
        break;
      
      case 'n8n-nodes-base.set':
        n8nParams.values = {
          string: [
            {
              name: 'data',
              value: parameters.template || parameters.value || ''
            }
          ]
        };
        break;
      
      case 'n8n-nodes-base.httpRequest':
        n8nParams.method = 'POST';
        n8nParams.url = parameters.url || 'https://api.openai.com/v1/chat/completions';
        n8nParams.headers = parameters.headers || {};
        break;
      
      case 'n8n-nodes-base.pinecone':
        if (parameters.index) {
          n8nParams.index = parameters.index;
        }
        if (parameters.namespace) {
          n8nParams.namespace = parameters.namespace;
        }
        break;
      
      case 'n8n-nodes-base.code':
        n8nParams.jsCode = parameters.code || `
          // Converted from LangSmith parser
          return items.map(item => ({
            json: item.json
          }));
        `;
        break;
      
      case 'n8n-nodes-base.function':
        n8nParams.functionCode = parameters.code || parameters.function || `
          // Converted from LangSmith tool/custom step
          return items;
        `;
        break;
    }

    return n8nParams;
  }

  /**
   * Builds LangSmith chain from Langflow workflow
   */
  private buildLangSmithChainFromLangflow(
    currentNode: any,
    allNodes: any[],
    edges: any[],
    chain: any[],
    processedNodes: Set<string>
  ): void {
    if (processedNodes.has(currentNode.id)) {
      return;
    }

    processedNodes.add(currentNode.id);

    // Convert node to LangSmith step
    const stepType = this.mapLangflowNodeToLangSmithStep(currentNode.data.type);
    const dependencies = edges
      .filter((edge: any) => edge.target === currentNode.id)
      .map((edge: any) => edge.source);

    chain.push({
      id: currentNode.id,
      type: stepType,
      name: currentNode.data.node.display_name || currentNode.data.node.name,
      parameters: this.convertLangflowParametersToLangSmith(
        currentNode.data.node.template,
        stepType
      ),
      dependencies: dependencies.length > 0 ? dependencies : undefined
    });

    // Process connected nodes
    const outgoingEdges = edges.filter((edge: any) => edge.source === currentNode.id);
    outgoingEdges.forEach((edge: any) => {
      const nextNode = allNodes.find((node: any) => node.id === edge.target);
      if (nextNode) {
        this.buildLangSmithChainFromLangflow(nextNode, allNodes, edges, chain, processedNodes);
      }
    });
  }

  /**
   * Builds LangSmith chain from N8N workflow
   */
  private buildLangSmithChainFromN8N(
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

    // Convert node to LangSmith step (skip start nodes)
    if (currentNode.type !== 'n8n-nodes-base.start' && 
        currentNode.type !== 'n8n-nodes-base.manualTrigger') {
      
      const stepType = this.mapN8NNodeToLangSmithStep(currentNode.type);
      
      chain.push({
        id: currentNode.name.replace(/\s+/g, '_').toLowerCase(),
        type: stepType,
        name: currentNode.name,
        parameters: this.convertN8NParametersToLangSmith(currentNode.parameters, stepType)
      });
    }

    // Process connected nodes
    const nodeConnections = connections[currentNode.name];
    if (nodeConnections?.main) {
      nodeConnections.main.forEach((outputConnections: any[]) => {
        outputConnections.forEach((connection: any) => {
          const nextNode = allNodes.find((n: any) => n.name === connection.node);
          if (nextNode) {
            this.buildLangSmithChainFromN8N(nextNode, allNodes, connections, chain, processedNodes);
          }
        });
      });
    }
  }

  /**
   * Maps Langflow node types to LangSmith step types
   */
  private mapLangflowNodeToLangSmithStep(langflowType: string): string {
    const typeMapping: Record<string, string> = {
      'ChatOpenAI': 'llm',
      'OpenAI': 'llm',
      'PromptTemplate': 'prompt',
      'LLMChain': 'chain',
      'ConversationChain': 'chain',
      'VectorStoreRetriever': 'retriever',
      'ConversationBufferMemory': 'memory',
      'OutputParser': 'parser',
      'Tool': 'tool',
      'CustomComponent': 'custom'
    };

    return typeMapping[langflowType] || 'custom';
  }

  /**
   * Maps N8N node types to LangSmith step types
   */
  private mapN8NNodeToLangSmithStep(n8nType: string): string {
    const typeMapping: Record<string, string> = {
      'n8n-nodes-base.openAi': 'llm',
      'n8n-nodes-base.set': 'prompt',
      'n8n-nodes-base.httpRequest': 'chain',
      'n8n-nodes-base.pinecone': 'retriever',
      'n8n-nodes-base.code': 'parser',
      'n8n-nodes-base.function': 'tool'
    };

    return typeMapping[n8nType] || 'custom';
  }

  /**
   * Converts Langflow parameters to LangSmith parameters
   */
  private convertLangflowParametersToLangSmith(template: any, stepType: string): any {
    const langsmithParams: any = {};

    switch (stepType) {
      case 'llm':
        if (template.model) {
          langsmithParams.model = template.model.value || 'gpt-3.5-turbo';
        }
        if (template.temperature) {
          langsmithParams.temperature = template.temperature.value || 0.7;
        }
        if (template.max_tokens) {
          langsmithParams.max_tokens = template.max_tokens.value || 1000;
        }
        if (template.openai_api_key) {
          langsmithParams.api_key = template.openai_api_key.value;
        }
        break;
      
      case 'prompt':
        if (template.template) {
          langsmithParams.template = template.template.value;
        }
        if (template.input_variables) {
          langsmithParams.input_variables = template.input_variables.value;
        }
        break;
      
      case 'retriever':
        if (template.vectorstore) {
          langsmithParams.vectorstore = template.vectorstore.value;
        }
        if (template.search_kwargs) {
          langsmithParams.search_kwargs = template.search_kwargs.value;
        }
        break;
      
      case 'memory':
        if (template.memory_key) {
          langsmithParams.memory_key = template.memory_key.value;
        }
        if (template.return_messages) {
          langsmithParams.return_messages = template.return_messages.value;
        }
        break;
    }

    return langsmithParams;
  }

  /**
   * Converts N8N parameters to LangSmith parameters
   */
  private convertN8NParametersToLangSmith(parameters: any, stepType: string): any {
    const langsmithParams: any = {};

    switch (stepType) {
      case 'llm':
        langsmithParams.model = parameters.model || 'gpt-3.5-turbo';
        langsmithParams.temperature = parameters.temperature || 0.7;
        langsmithParams.max_tokens = parameters.maxTokens || 1000;
        if (parameters.messages) {
          langsmithParams.messages = parameters.messages;
        }
        break;
      
      case 'prompt':
        if (parameters.values?.string?.[0]?.value) {
          langsmithParams.template = parameters.values.string[0].value;
        }
        break;
      
      case 'chain':
        langsmithParams.url = parameters.url;
        langsmithParams.method = parameters.method;
        langsmithParams.headers = parameters.headers;
        break;
      
      case 'retriever':
        if (parameters.index) {
          langsmithParams.index = parameters.index;
        }
        if (parameters.namespace) {
          langsmithParams.namespace = parameters.namespace;
        }
        break;
      
      case 'parser':
        if (parameters.jsCode) {
          langsmithParams.code = parameters.jsCode;
        }
        break;
      
      case 'tool':
        if (parameters.functionCode) {
          langsmithParams.function = parameters.functionCode;
        }
        break;
    }

    return langsmithParams;
  }
}