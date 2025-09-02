/**
 * Lazy Loading and Pagination Utilities
 * Optimizes data loading with intelligent pagination and lazy loading
 */

export interface PaginationOptions {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  filters?: Record<string, any>
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface LazyLoadOptions {
  threshold?: number // Distance from bottom to trigger load
  batchSize?: number
  maxItems?: number
  cacheKey?: string
}

export class LazyLoader<T> {
  private items: T[] = []
  private loading: boolean = false
  private hasMore: boolean = true
  private currentPage: number = 1
  private totalLoaded: number = 0

  constructor(
    private fetchFunction: (page: number, limit: number) => Promise<PaginatedResult<T>>,
    private options: LazyLoadOptions = {}
  ) {
    this.options = {
      threshold: 100,
      batchSize: 20,
      maxItems: 1000,
      ...options
    }
  }

  /**
   * Load initial batch of items
   */
  async initialize(): Promise<T[]> {
    if (this.items.length > 0) return this.items

    const result = await this.loadMore()
    return result
  }

  /**
   * Load more items
   */
  async loadMore(): Promise<T[]> {
    if (this.loading || !this.hasMore) return this.items

    this.loading = true

    try {
      const result = await this.fetchFunction(this.currentPage, this.options.batchSize!)
      
      this.items.push(...result.data)
      this.totalLoaded += result.data.length
      this.currentPage++
      this.hasMore = result.pagination.hasNext && 
                    this.totalLoaded < (this.options.maxItems || Infinity)

      return this.items
    } catch (error) {
      console.error('Lazy loading error:', error)
      throw error
    } finally {
      this.loading = false
    }
  }

  /**
   * Check if should load more based on scroll position
   */
  shouldLoadMore(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
    if (this.loading || !this.hasMore) return false

    const threshold = this.options.threshold || 100
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    
    return distanceFromBottom <= threshold
  }

  /**
   * Get current items
   */
  getItems(): T[] {
    return this.items
  }

  /**
   * Get loading state
   */
  isLoading(): boolean {
    return this.loading
  }

  /**
   * Check if has more items
   */
  getHasMore(): boolean {
    return this.hasMore
  }

  /**
   * Reset loader
   */
  reset(): void {
    this.items = []
    this.loading = false
    this.hasMore = true
    this.currentPage = 1
    this.totalLoaded = 0
  }

  /**
   * Search within loaded items
   */
  search(query: string, searchFields: (keyof T)[]): T[] {
    const lowercaseQuery = query.toLowerCase()
    
    return this.items.filter(item => {
      return searchFields.some(field => {
        const value = item[field]
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowercaseQuery)
        }
        return false
      })
    })
  }

  /**
   * Filter loaded items
   */
  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate)
  }

  /**
   * Sort loaded items
   */
  sort(compareFn: (a: T, b: T) => number): T[] {
    return [...this.items].sort(compareFn)
  }
}

/**
 * Pagination utility class
 */
export class Paginator {
  /**
   * Create pagination metadata
   */
  static createPagination(
    page: number,
    limit: number,
    total: number
  ): PaginatedResult<any>['pagination'] {
    const totalPages = Math.ceil(total / limit)
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  }

  /**
   * Calculate offset for database queries
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(page: number, limit: number): {
    page: number
    limit: number
    errors: string[]
  } {
    const errors: string[] = []
    let validPage = page
    let validLimit = limit

    if (page < 1) {
      validPage = 1
      errors.push('Page must be greater than 0')
    }

    if (limit < 1) {
      validLimit = 10
      errors.push('Limit must be greater than 0')
    }

    if (limit > 100) {
      validLimit = 100
      errors.push('Limit cannot exceed 100')
    }

    return { page: validPage, limit: validLimit, errors }
  }

  /**
   * Create pagination links
   */
  static createLinks(
    baseUrl: string,
    page: number,
    limit: number,
    total: number,
    additionalParams: Record<string, any> = {}
  ): {
    first?: string
    prev?: string
    next?: string
    last?: string
  } {
    const totalPages = Math.ceil(total / limit)
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...additionalParams
    })

    const links: any = {}

    // First page
    if (page > 1) {
      params.set('page', '1')
      links.first = `${baseUrl}?${params.toString()}`
    }

    // Previous page
    if (page > 1) {
      params.set('page', (page - 1).toString())
      links.prev = `${baseUrl}?${params.toString()}`
    }

    // Next page
    if (page < totalPages) {
      params.set('page', (page + 1).toString())
      links.next = `${baseUrl}?${params.toString()}`
    }

    // Last page
    if (page < totalPages) {
      params.set('page', totalPages.toString())
      links.last = `${baseUrl}?${params.toString()}`
    }

    return links
  }
}

/**
 * Virtual scrolling utility for large datasets
 */
export class VirtualScroller<T> {
  private visibleItems: T[] = []
  private startIndex: number = 0
  private endIndex: number = 0

  constructor(
    private allItems: T[],
    private itemHeight: number,
    private containerHeight: number,
    private buffer: number = 5
  ) {}

  /**
   * Calculate visible items based on scroll position
   */
  calculateVisibleItems(scrollTop: number): {
    items: T[]
    startIndex: number
    endIndex: number
    totalHeight: number
    offsetY: number
  } {
    const visibleStart = Math.floor(scrollTop / this.itemHeight)
    const visibleEnd = Math.min(
      visibleStart + Math.ceil(this.containerHeight / this.itemHeight),
      this.allItems.length - 1
    )

    // Add buffer items
    this.startIndex = Math.max(0, visibleStart - this.buffer)
    this.endIndex = Math.min(this.allItems.length - 1, visibleEnd + this.buffer)

    this.visibleItems = this.allItems.slice(this.startIndex, this.endIndex + 1)

    return {
      items: this.visibleItems,
      startIndex: this.startIndex,
      endIndex: this.endIndex,
      totalHeight: this.allItems.length * this.itemHeight,
      offsetY: this.startIndex * this.itemHeight
    }
  }

  /**
   * Update items and recalculate
   */
  updateItems(newItems: T[]): void {
    this.allItems = newItems
  }

  /**
   * Get current visible items
   */
  getVisibleItems(): T[] {
    return this.visibleItems
  }
}

/**
 * Infinite scroll hook for React components
 */
export class InfiniteScrollManager {
  private observer?: IntersectionObserver
  private loading: boolean = false

  constructor(
    private loadMore: () => Promise<void>,
    private hasMore: boolean = true
  ) {}

  /**
   * Initialize intersection observer
   */
  initialize(targetElement: Element): void {
    if (this.observer) {
      this.observer.disconnect()
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && this.hasMore && !this.loading) {
          this.handleLoadMore()
        }
      },
      {
        rootMargin: '100px' // Load when 100px away from target
      }
    )

    this.observer.observe(targetElement)
  }

  /**
   * Handle load more with loading state
   */
  private async handleLoadMore(): Promise<void> {
    if (this.loading) return

    this.loading = true
    try {
      await this.loadMore()
    } catch (error) {
      console.error('Load more error:', error)
    } finally {
      this.loading = false
    }
  }

  /**
   * Update has more state
   */
  setHasMore(hasMore: boolean): void {
    this.hasMore = hasMore
  }

  /**
   * Cleanup observer
   */
  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect()
    }
  }
}

/**
 * Data prefetching utility
 */
export class DataPrefetcher<T> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map()
  private prefetchQueue: Set<string> = new Set()

  constructor(
    private fetchFunction: (key: string) => Promise<T>,
    private ttl: number = 300000 // 5 minutes
  ) {}

  /**
   * Prefetch data for given keys
   */
  async prefetch(keys: string[]): Promise<void> {
    const prefetchPromises = keys
      .filter(key => !this.cache.has(key) && !this.prefetchQueue.has(key))
      .map(async (key) => {
        this.prefetchQueue.add(key)
        try {
          const data = await this.fetchFunction(key)
          this.cache.set(key, { data, timestamp: Date.now() })
        } catch (error) {
          console.error(`Prefetch error for key ${key}:`, error)
        } finally {
          this.prefetchQueue.delete(key)
        }
      })

    await Promise.all(prefetchPromises)
  }

  /**
   * Get data from cache or fetch if not available
   */
  async get(key: string): Promise<T> {
    const cached = this.cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data
    }

    // Remove expired cache
    if (cached) {
      this.cache.delete(key)
    }

    const data = await this.fetchFunction(key)
    this.cache.set(key, { data, timestamp: Date.now() })
    
    return data
  }

  /**
   * Clear expired cache entries
   */
  clearExpired(): void {
    const now = Date.now()
    this.cache.forEach((value, key) => {
      if (now - value.timestamp >= this.ttl) {
        this.cache.delete(key)
      }
    })
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.prefetchQueue.clear()
  }
}

// Utility functions
export const paginationUtils = {
  /**
   * Create cursor-based pagination
   */
  createCursorPagination<T>(
    items: T[],
    getCursor: (item: T) => string,
    limit: number,
    cursor?: string
  ): {
    data: T[]
    nextCursor?: string
    hasMore: boolean
  } {
    let startIndex = 0
    
    if (cursor) {
      startIndex = items.findIndex(item => getCursor(item) === cursor) + 1
    }

    const data = items.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < items.length
    const nextCursor = hasMore ? getCursor(data[data.length - 1]) : undefined

    return { data, nextCursor, hasMore }
  },

  /**
   * Optimize pagination for large datasets
   */
  optimizeLargePagination(page: number, limit: number, total: number): {
    optimizedPage: number
    optimizedLimit: number
    useSeekPagination: boolean
  } {
    const offset = (page - 1) * limit
    const useSeekPagination = offset > 10000 // Use seek pagination for large offsets

    let optimizedPage = page
    let optimizedLimit = limit

    // Reduce limit for very large pages to improve performance
    if (page > 100) {
      optimizedLimit = Math.min(limit, 50)
    }

    return { optimizedPage, optimizedLimit, useSeekPagination }
  }
}