import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { DatabaseConnection } from '../../lib/database/connection'
import { RedisClient } from '../../lib/cache/redis-client'

describe('System Integration Tests', () => {
  let dbConnection: DatabaseConnection
  let redisClient: RedisClient
  let authToken: string

  beforeAll(async () => {
    // Initialize test environment
    dbConnection = new DatabaseConnection()
    await dbConnection.connect()
    
    redisClient = new RedisClient()
    await redisClient.connect()
    
    // Create test user and get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      })
    
    authToken = loginResponse.body.token
  })

  afterAll(async () => {
    await dbConnection.disconnect()
    await redisClient.disconnect()
  })

  describe('End-to-End Workflow Execution', () => {
    it('should create, execute, and monitor a Langflow workflow', async () => {
      // Create workflow
      const workflowResponse = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Langflow Workflow',
          engineType: 'langflow',
          definition: {
            nodes: [
              { id: 'input', type: 'input', data: {} },
              { id: 'output', type: 'output', data: {} }
            ],
            edges: [{ source: 'input', target: 'output' }]
          }
        })
      
      expect(workflowResponse.status).toBe(201)
      const workflowId = workflowResponse.body.id

      // Execute workflow
      const executionResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ parameters: { input: 'test data' } })
      
      expect(executionResponse.status).toBe(200)
      const executionId = executionResponse.body.executionId

      // Monitor execution status
      let status = 'pending'
      let attempts = 0
      while (status !== 'completed' && attempts < 30) {
        const statusResponse = await request(app)
          .get(`/api/executions/${executionId}`)
          .set('Authorization', `Bearer ${authToken}`)
        
        status = statusResponse.body.status
        attempts++
        
        if (status !== 'completed') {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      expect(status).toBe('completed')
    })

    it('should handle multi-engine workflow orchestration', async () => {
      // Test orchestration across multiple engines
      const workflows = [
        { name: 'Langflow Test', engineType: 'langflow' },
        { name: 'N8N Test', engineType: 'n8n' },
        { name: 'LangSmith Test', engineType: 'langsmith' }
      ]

      const createdWorkflows = []
      for (const workflow of workflows) {
        const response = await request(app)
          .post('/api/workflows')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...workflow,
            definition: { nodes: [], edges: [] }
          })
        
        expect(response.status).toBe(201)
        createdWorkflows.push(response.body)
      }

      // Execute all workflows concurrently
      const executions = await Promise.all(
        createdWorkflows.map(workflow =>
          request(app)
            .post(`/api/workflows/${workflow.id}/execute`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ parameters: {} })
        )
      )

      executions.forEach(execution => {
        expect(execution.status).toBe(200)
      })
    })
  })

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency across services', async () => {
      // Test database transactions
      const workflowData = {
        name: 'Consistency Test Workflow',
        engineType: 'langflow',
        definition: { nodes: [], edges: [] }
      }

      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflowData)
      
      expect(response.status).toBe(201)
      
      // Verify data exists in database
      const dbWorkflow = await dbConnection.query(
        'SELECT * FROM workflows WHERE id = $1',
        [response.body.id]
      )
      
      expect(dbWorkflow.rows).toHaveLength(1)
      expect(dbWorkflow.rows[0].name).toBe(workflowData.name)
    })

    it('should handle concurrent operations safely', async () => {
      const workflowId = 'test-workflow-id'
      
      // Simulate concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .put(`/api/workflows/${workflowId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `Updated Name ${i}` })
      )

      const results = await Promise.allSettled(updates)
      
      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled')
      expect(successful.length).toBeGreaterThan(0)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle high concurrent load', async () => {
      const concurrentRequests = 50
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/workflows')
          .set('Authorization', `Bearer ${authToken}`)
      )

      const startTime = Date.now()
      const responses = await Promise.all(requests)
      const endTime = Date.now()

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      const avgResponseTime = (endTime - startTime) / concurrentRequests
      expect(avgResponseTime).toBeLessThan(1000) // Less than 1 second average
    })
  })
})