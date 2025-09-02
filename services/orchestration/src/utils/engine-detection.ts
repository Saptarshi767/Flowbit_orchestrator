import { EngineType, WorkflowDefinition } from '@robust-ai-orchestrator/shared';

/**
 * Utility class for detecting and validating engine types
 */
export class EngineDetection {
  /**
   * Detects the engine type from a workflow definition
   * @param workflow - The workflow definition or raw workflow data
   * @returns The detected engine type or null if unable to detect
   */
  static detectEngineType(workflow: any): EngineType | null {
    if (!workflow || typeof workflow !== 'object') {
      return null;
    }

    // Check if engineType is explicitly set
    if (workflow.engineType && Object.values(EngineType).includes(workflow.engineType)) {
      return workflow.engineType as EngineType;
    }

    // Try to detect from workflow structure
    return this.detectFromStructure(workflow);
  }

  /**
   * Detects engine type from workflow structure patterns
   */
  private static detectFromStructure(workflow: any): EngineType | null {
    // Langflow detection patterns
    if (this.isLangflowWorkflow(workflow)) {
      return EngineType.LANGFLOW;
    }

    // N8N detection patterns
    if (this.isN8NWorkflow(workflow)) {
      return EngineType.N8N;
    }

    // LangSmith detection patterns
    if (this.isLangSmithWorkflow(workflow)) {
      return EngineType.LANGSMITH;
    }

    return null;
  }

  /**
   * Checks if workflow structure matches Langflow patterns
   */
  private static isLangflowWorkflow(workflow: any): boolean {
    // Langflow workflows typically have:
    // - nodes array with specific structure
    // - edges array connecting nodes
    // - specific node types like "ChatInput", "ChatOutput", etc.
    
    if (workflow.nodes && Array.isArray(workflow.nodes) && 
        workflow.edges && Array.isArray(workflow.edges)) {
      
      // Check for Langflow-specific node types
      const langflowNodeTypes = [
        'ChatInput', 'ChatOutput', 'LLMChain', 'PromptTemplate',
        'TextInput', 'TextOutput', 'ConversationChain'
      ];
      
      const hasLangflowNodes = workflow.nodes.some((node: any) => 
        node.data?.type && langflowNodeTypes.includes(node.data.type)
      );
      
      if (hasLangflowNodes) {
        return true;
      }

      // Check for Langflow-specific structure patterns
      const hasLangflowStructure = workflow.nodes.some((node: any) => 
        node.data?.node?.template || node.data?.node?.base_classes
      );
      
      return hasLangflowStructure;
    }

    return false;
  }

  /**
   * Checks if workflow structure matches N8N patterns
   */
  private static isN8NWorkflow(workflow: any): boolean {
    // N8N workflows typically have:
    // - nodes array with specific structure
    // - connections object
    // - specific node types and parameters structure
    
    if (workflow.nodes && Array.isArray(workflow.nodes) && workflow.connections) {
      
      // Check for N8N-specific node types
      const n8nNodeTypes = [
        'n8n-nodes-base.start', 'n8n-nodes-base.httpRequest',
        'n8n-nodes-base.webhook', 'n8n-nodes-base.function',
        'n8n-nodes-base.set', 'n8n-nodes-base.if'
      ];
      
      const hasN8NNodes = workflow.nodes.some((node: any) => 
        node.type && n8nNodeTypes.some(type => node.type.includes(type))
      );
      
      if (hasN8NNodes) {
        return true;
      }

      // Check for N8N-specific structure patterns
      const hasN8NStructure = workflow.nodes.some((node: any) => 
        node.parameters && node.typeVersion !== undefined
      );
      
      return hasN8NStructure;
    }

    return false;
  }

  /**
   * Checks if workflow structure matches LangSmith patterns
   */
  private static isLangSmithWorkflow(workflow: any): boolean {
    // LangSmith workflows typically have:
    // - chain definitions
    // - specific LangChain component structures
    // - runnable sequences or parallel chains
    
    if (workflow.chain || workflow.runnable || workflow.steps) {
      return true;
    }

    // Check for LangChain/LangSmith specific patterns
    if (workflow.components && Array.isArray(workflow.components)) {
      const langsmithComponents = [
        'ChatPromptTemplate', 'LLMChain', 'SequentialChain',
        'SimpleSequentialChain', 'RouterChain', 'MultiPromptChain'
      ];
      
      const hasLangSmithComponents = workflow.components.some((component: any) => 
        component._type && langsmithComponents.includes(component._type)
      );
      
      return hasLangSmithComponents;
    }

    // Check for runnable interface patterns
    if (workflow.invoke || workflow.stream || workflow.batch) {
      return true;
    }

    return false;
  }

  /**
   * Validates that a workflow is compatible with a specific engine type
   * @param workflow - The workflow definition
   * @param engineType - The target engine type
   * @returns Validation result with compatibility information
   */
  static validateEngineCompatibility(workflow: WorkflowDefinition, engineType: EngineType): {
    isCompatible: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
  } {
    const detectedType = this.detectEngineType(workflow);
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 0;

    if (detectedType === engineType) {
      confidence = 0.9;
    } else if (detectedType && detectedType !== engineType) {
      confidence = 0.1;
      issues.push(`Workflow appears to be designed for ${detectedType}, not ${engineType}`);
      suggestions.push(`Consider using the ${detectedType} adapter instead`);
    } else {
      confidence = 0.5;
      issues.push('Unable to definitively detect workflow engine type');
      suggestions.push('Ensure workflow definition follows the expected format');
    }

    // Additional validation based on engine type
    switch (engineType) {
      case EngineType.LANGFLOW:
        this.validateLangflowCompatibility(workflow, issues, suggestions);
        break;
      case EngineType.N8N:
        this.validateN8NCompatibility(workflow, issues, suggestions);
        break;
      case EngineType.LANGSMITH:
        this.validateLangSmithCompatibility(workflow, issues, suggestions);
        break;
    }

    return {
      isCompatible: issues.length === 0 && confidence > 0.7,
      confidence,
      issues,
      suggestions
    };
  }

  private static validateLangflowCompatibility(
    workflow: WorkflowDefinition, 
    issues: string[], 
    suggestions: string[]
  ): void {
    const definition = workflow.definition;
    
    if (!definition.nodes || !Array.isArray(definition.nodes)) {
      issues.push('Langflow workflows must have a nodes array');
      suggestions.push('Add nodes array to workflow definition');
    }
    
    if (!definition.edges || !Array.isArray(definition.edges)) {
      issues.push('Langflow workflows must have an edges array');
      suggestions.push('Add edges array to workflow definition');
    }
  }

  private static validateN8NCompatibility(
    workflow: WorkflowDefinition, 
    issues: string[], 
    suggestions: string[]
  ): void {
    const definition = workflow.definition;
    
    if (!definition.nodes || !Array.isArray(definition.nodes)) {
      issues.push('N8N workflows must have a nodes array');
      suggestions.push('Add nodes array to workflow definition');
    }
    
    if (!definition.connections) {
      issues.push('N8N workflows must have a connections object');
      suggestions.push('Add connections object to workflow definition');
    }
  }

  private static validateLangSmithCompatibility(
    workflow: WorkflowDefinition, 
    issues: string[], 
    suggestions: string[]
  ): void {
    const definition = workflow.definition;
    
    if (!definition.chain && !definition.runnable && !definition.steps && !definition.components) {
      issues.push('LangSmith workflows must have chain, runnable, steps, or components definition');
      suggestions.push('Add chain definition or runnable sequence to workflow');
    }
  }

  /**
   * Gets supported engine types
   */
  static getSupportedEngineTypes(): EngineType[] {
    return Object.values(EngineType);
  }

  /**
   * Checks if an engine type is supported
   */
  static isEngineTypeSupported(engineType: string): boolean {
    return Object.values(EngineType).includes(engineType as EngineType);
  }
}