/**
 * Basic Performance Tests
 * Simple tests for performance utilities without external dependencies
 */

import { describe, it, expect } from 'vitest'
import { Paginator } from '../../lib/performance/lazy-loading'

describe('Performance Utilities', () => {
  describe('Paginator', () => {
    it('should create correct pagination metadata', () => {
      const pagination = Paginator.createPagination(2, 10, 45)

      expect(pagination.page).toBe(2)
      expect(pagination.limit).toBe(10)
      expect(pagination.total).toBe(45)
      expect(pagination.totalPages).toBe(5)
      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrev).toBe(true)
    })

    it('should handle first page correctly', () => {
      const pagination = Paginator.createPagination(1, 10, 45)

      expect(pagination.page).toBe(1)
      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrev).toBe(false)
    })

    it('should handle last page correctly', () => {
      const pagination = Paginator.createPagination(5, 10, 45)

      expect(pagination.page).toBe(5)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrev).toBe(true)
    })

    it('should calculate correct offset', () => {
      expect(Paginator.getOffset(1, 10)).toBe(0)
      expect(Paginator.getOffset(2, 10)).toBe(10)
      expect(Paginator.getOffset(3, 20)).toBe(40)
    })

    it('should validate pagination parameters', () => {
      const result1 = Paginator.validatePagination(0, 10)
      expect(result1.page).toBe(1)
      expect(result1.errors.length).toBeGreaterThan(0)

      const result2 = Paginator.validatePagination(1, 0)
      expect(result2.limit).toBe(10)
      expect(result2.errors.length).toBeGreaterThan(0)

      const result3 = Paginator.validatePagination(1, 150)
      expect(result3.limit).toBe(100)
      expect(result3.errors.length).toBeGreaterThan(0)

      const result4 = Paginator.validatePagination(2, 20)
      expect(result4.page).toBe(2)
      expect(result4.limit).toBe(20)
      expect(result4.errors.length).toBe(0)
    })

    it('should create pagination links', () => {
      const links = Paginator.createLinks(
        '/api/workflows',
        3,
        10,
        100,
        { status: 'active' }
      )

      expect(links.first).toContain('page=1')
      expect(links.prev).toContain('page=2')
      expect(links.next).toContain('page=4')
      expect(links.last).toContain('page=10')
      expect(links.first).toContain('status=active')
    })

    it('should handle edge cases for pagination links', () => {
      // First page
      const firstPageLinks = Paginator.createLinks('/api/test', 1, 10, 50)
      expect(firstPageLinks.first).toBeUndefined()
      expect(firstPageLinks.prev).toBeUndefined()
      expect(firstPageLinks.next).toBeDefined()
      expect(firstPageLinks.last).toBeDefined()

      // Last page
      const lastPageLinks = Paginator.createLinks('/api/test', 5, 10, 50)
      expect(lastPageLinks.first).toBeDefined()
      expect(lastPageLinks.prev).toBeDefined()
      expect(lastPageLinks.next).toBeUndefined()
      expect(lastPageLinks.last).toBeUndefined()

      // Single page
      const singlePageLinks = Paginator.createLinks('/api/test', 1, 10, 5)
      expect(singlePageLinks.first).toBeUndefined()
      expect(singlePageLinks.prev).toBeUndefined()
      expect(singlePageLinks.next).toBeUndefined()
      expect(singlePageLinks.last).toBeUndefined()
    })
  })

  describe('Performance Benchmarks', () => {
    it('should benchmark pagination calculations', () => {
      const iterations = 10000
      const startTime = Date.now()

      for (let i = 1; i <= iterations; i++) {
        Paginator.createPagination(i % 100 + 1, 20, 2000)
        Paginator.getOffset(i % 100 + 1, 20)
        Paginator.validatePagination(i % 100 + 1, 20)
      }

      const endTime = Date.now()
      const duration = endTime - startTime
      const opsPerSecond = (iterations * 3) / (duration / 1000) // 3 ops per iteration

      console.log(`Pagination benchmark: ${opsPerSecond.toFixed(2)} ops/second`)
      expect(opsPerSecond).toBeGreaterThan(1000) // Should handle at least 1000 ops/second
    })

    it('should handle large pagination efficiently', () => {
      const startTime = Date.now()

      // Test with large numbers
      for (let i = 0; i < 1000; i++) {
        const page = Math.floor(Math.random() * 10000) + 1
        const limit = Math.floor(Math.random() * 100) + 1
        const total = Math.floor(Math.random() * 1000000) + 1

        const pagination = Paginator.createPagination(page, limit, total)
        expect(pagination.page).toBe(page)
        expect(pagination.limit).toBe(limit)
        expect(pagination.total).toBe(total)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(`Large pagination test completed in ${duration}ms`)
      expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
    })
  })

  describe('Utility Functions', () => {
    it('should handle empty datasets', () => {
      const pagination = Paginator.createPagination(1, 10, 0)

      expect(pagination.total).toBe(0)
      expect(pagination.totalPages).toBe(0)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrev).toBe(false)
    })

    it('should handle single item datasets', () => {
      const pagination = Paginator.createPagination(1, 10, 1)

      expect(pagination.total).toBe(1)
      expect(pagination.totalPages).toBe(1)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrev).toBe(false)
    })

    it('should handle exact page boundaries', () => {
      // Exactly 2 pages
      const pagination = Paginator.createPagination(2, 10, 20)

      expect(pagination.totalPages).toBe(2)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrev).toBe(true)
    })
  })
})