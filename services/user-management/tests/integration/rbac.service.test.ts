import { describe, it, expect, beforeEach } from 'vitest'
import { UserRole, SubscriptionPlan } from '@prisma/client'
import { RBACService } from '../../src/services/rbac.service'
import { AccessContext, AccessRequest } from '../../src/types/rbac.types'
import { testPrisma, testRedis } from '../setup'

describe('RBACService Integr