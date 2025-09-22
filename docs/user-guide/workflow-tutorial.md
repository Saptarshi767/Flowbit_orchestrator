# Workflow Creation Tutorial

This comprehensive tutorial will guide you through creating workflows for each supported engine: Langflow, N8N, and LangSmith.

## Tutorial 1: Creating a Langflow AI Agent Workflow

### Objective
Create an AI customer support agent that can answer questions using a knowledge base.

### Prerequisites
- Access to the Robust AI Orchestrator platform
- Basic understanding of AI agents and LLMs

### Step-by-Step Instructions

#### 1. Create a New Langflow Workflow
1. Click "Create Workflow" from the dashboard
2. Select "Langflow" as the engine type
3. Choose "AI Agent Template" or "Start from Scratch"
4. Name your workflow: "Customer Support Agent"

#### 2. Add Core Components
1. **Input Component**:
   - Drag "Text Input" from the sidebar
   - Configure: Name = "customer_question", Type = "text"
   - Add description: "Customer question or inquiry"

2. **Knowledge Base Component**:
   - Add "Vector Store" component
   - Configure your knowledge base source (documents, URLs, etc.)
   - Set embedding model (e.g., OpenAI embeddings)

3. **LLM Component**:
   - Add "OpenAI" or your preferred LLM component
   - Configure API key in settings
   - Set model parameters (temperature, max_tokens)

4. **Prompt Template**:
   - Add "Prompt Template" component
   - Create template:
   ```
   You are a helpful customer support agent. Use the following context to answer the customer's question.
   
   Context: {context}
   Question: {question}
   
   Provide a helpful, accurate response. If you don't know the answer, say so politely.
   ```

#### 3. Connect Components
1. Connect Text Input → Prompt Template (question input)
2. Connect Vector Store → Prompt Template (context input)
3. Connect Prompt Template → LLM
4. Connect LLM → Output component

#### 4. Configure and Test
1. Set up your knowledge base with sample documents
2. Test with sample questions:
   - "What are your business hours?"
   - "How do I return a product?"
3. Adjust prompt and parameters based on results

#### 5. Deploy and Monitor
1. Save your workflow
2. Execute with test data
3. Monitor performance in the execution dashboard
4. Set up alerts for failures or performance issues

## Tutorial 2: Creating an N8N Automation Workflow

### Objective
Create an automated workflow that monitors social media mentions and sends notifications.

### Step-by-Step Instructions

#### 1. Create N8N Workflow
1. Select "N8N" as engine type
2. Choose "Automation Template"
3. Name: "Social Media Monitor"

#### 2. Set Up Trigger
1. Add "Webhook" trigger node
2. Configure webhook URL for external services
3. Or use "Cron" trigger for scheduled monitoring

#### 3. Add Social Media Monitoring
1. **Twitter API Node**:
   - Add Twitter node
   - Configure API credentials
   - Set search parameters for mentions
   - Filter by keywords, hashtags, or mentions

2. **Data Processing**:
   - Add "Function" node for data transformation
   - Process tweet data to extract relevant information
   ```javascript
   // Sample processing function
   const tweets = items.map(item => ({
     id: item.json.id,
     text: item.json.text,
     user: item.json.user.screen_name,
     created_at: item.json.created_at,
     sentiment: analyzeSentiment(item.json.text)
   }));
   return tweets;
   ```

#### 4. Add Notification Logic
1. **Condition Node**:
   - Add IF node to filter important mentions
   - Set conditions (sentiment, follower count, keywords)

2. **Slack Notification**:
   - Add Slack node
   - Configure webhook or bot token
   - Format notification message
   ```
   🚨 New mention detected!
   User: {{$json["user"]}}
   Message: {{$json["text"]}}
   Sentiment: {{$json["sentiment"]}}
   ```

3. **Email Notification**:
   - Add Email node for critical mentions
   - Configure SMTP settings
   - Create email template

#### 5. Error Handling
1. Add error handling nodes
2. Configure retry logic
3. Set up fallback notifications

## Tutorial 3: Creating a LangSmith Chain Workflow

### Objective
Build a document analysis chain that extracts insights and generates summaries.

### Step-by-Step Instructions

#### 1. Create LangSmith Workflow
1. Select "LangSmith" as engine type
2. Choose "Chain Template"
3. Name: "Document Analyzer"

#### 2. Define Chain Structure
1. **Document Input Chain**:
   ```python
   from langchain.chains import LLMChain
   from langchain.prompts import PromptTemplate
   
   # Document processing prompt
   doc_prompt = PromptTemplate(
       input_variables=["document"],
       template="Analyze the following document and extract key insights:\n\n{document}"
   )
   ```

2. **Analysis Chain**:
   ```python
   analysis_prompt = PromptTemplate(
       input_variables=["insights"],
       template="""
       Based on these insights: {insights}
       
       Provide:
       1. Executive Summary (2-3 sentences)
       2. Key Points (bullet list)
       3. Recommendations (if applicable)
       4. Risk Assessment (if applicable)
       """
   )
   ```

#### 3. Configure LLM Provider
1. Set up OpenAI or other LLM provider
2. Configure model parameters
3. Set up evaluation criteria

#### 4. Add Evaluation
1. **Custom Evaluator**:
   ```python
   def evaluate_analysis(inputs, outputs):
       # Check for completeness
       required_sections = ["summary", "key_points", "recommendations"]
       score = 0
       for section in required_sections:
           if section.lower() in outputs["text"].lower():
               score += 1
       return {"completeness_score": score / len(required_sections)}
   ```

2. **Built-in Evaluators**:
   - Add relevance evaluator
   - Add factual accuracy evaluator
   - Add coherence evaluator

#### 5. Test and Optimize
1. Run with sample documents
2. Review evaluation results
3. Adjust prompts and parameters
4. Set up A/B testing for different approaches

## Best Practices for All Engines

### 1. Workflow Design
- **Modular Design**: Break complex workflows into smaller, reusable components
- **Error Handling**: Always include error handling and fallback mechanisms
- **Documentation**: Add clear descriptions and comments
- **Testing**: Test with various input scenarios

### 2. Performance Optimization
- **Caching**: Use caching for expensive operations
- **Parallel Processing**: Utilize parallel execution where possible
- **Resource Management**: Monitor and optimize resource usage
- **Batch Processing**: Process multiple items together when efficient

### 3. Security Considerations
- **Credential Management**: Use secure credential storage
- **Input Validation**: Validate all inputs
- **Access Control**: Set appropriate permissions
- **Audit Logging**: Enable comprehensive logging

### 4. Monitoring and Maintenance
- **Health Checks**: Implement workflow health monitoring
- **Performance Metrics**: Track execution time and success rates
- **Alerting**: Set up alerts for failures and performance issues
- **Regular Updates**: Keep workflows updated with latest best practices

## Advanced Features

### Workflow Versioning
- Enable automatic versioning for all changes
- Use semantic versioning for major updates
- Maintain rollback capabilities

### Collaboration Features
- Use real-time collaborative editing
- Implement code review processes
- Share workflows with appropriate permissions

### Integration Patterns
- **API Integration**: Connect with external APIs
- **Database Integration**: Read/write to databases
- **File Processing**: Handle various file formats
- **Real-time Processing**: Implement streaming workflows

## Troubleshooting Common Issues

### Langflow Issues
- **Component Connection Errors**: Check data type compatibility
- **API Rate Limits**: Implement proper rate limiting
- **Memory Issues**: Optimize large document processing

### N8N Issues
- **Webhook Timeouts**: Increase timeout settings
- **Credential Errors**: Verify API keys and permissions
- **Data Transformation**: Debug function nodes step by step

### LangSmith Issues
- **Chain Execution Errors**: Check prompt formatting
- **Evaluation Failures**: Verify evaluator configuration
- **Performance Issues**: Optimize chain structure

## Next Steps

1. **Explore Advanced Features**: Learn about custom components and advanced configurations
2. **Join Community**: Share your workflows and learn from others
3. **Contribute**: Help improve the platform by contributing workflows and feedback
4. **Scale Up**: Move from development to production deployment

For more detailed information, see our [Complete User Manual](./user-manual.md) and [API Documentation](../api/api-reference.md).