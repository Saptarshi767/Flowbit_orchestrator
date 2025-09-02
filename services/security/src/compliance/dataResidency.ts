import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

export interface DataResidencyRule {
  id: string;
  name: string;
  description: string;
  regions: string[];
  dataTypes: string[];
  restrictions: DataRestriction[];
  priority: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataRestriction {
  type: 'storage' | 'processing' | 'transit' | 'backup';
  allowedRegions: string[];
  prohibitedRegions: string[];
  exceptions?: string[];
  requiresEncryption: boolean;
}

export interface DataClassification {
  id: string;
  name: string;
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  description: string;
  residencyRequirements: string[];
  retentionPeriod: number; // days
  encryptionRequired: boolean;
}

export interface RegionInfo {
  code: string;
  name: string;
  country: string;
  continent: string;
  dataCenter: string;
  regulations: string[];
  certifications: string[];
  active: boolean;
}

export interface DataLocation {
  dataId: string;
  dataType: string;
  classification: string;
  currentRegion: string;
  allowedRegions: string[];
  lastMoved?: Date;
  movementHistory: DataMovement[];
}

export interface DataMovement {
  id: string;
  dataId: string;
  fromRegion: string;
  toRegion: string;
  reason: string;
  requestedBy: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
}

export class DataResidencyService extends EventEmitter {
  private logger: Logger;
  private residencyRules: Map<string, DataResidencyRule>;
  private dataClassifications: Map<string, DataClassification>;
  private regions: Map<string, RegionInfo>;
  private dataLocations: Map<string, DataLocation>;

  constructor() {
    super();
    this.logger = new Logger('DataResidencyService');
    this.residencyRules = new Map();
    this.dataClassifications = new Map();
    this.regions = new Map();
    this.dataLocations = new Map();
    this.initializeRegions();
    this.initializeDataClassifications();
    this.initializeResidencyRules();
  }

  private initializeRegions(): void {
    const regions: RegionInfo[] = [
      {
        code: 'us-east-1',
        name: 'US East (N. Virginia)',
        country: 'United States',
        continent: 'North America',
        dataCenter: 'AWS US East',
        regulations: ['SOX', 'HIPAA', 'CCPA'],
        certifications: ['SOC2', 'ISO27001', 'FedRAMP'],
        active: true
      },
      {
        code: 'eu-west-1',
        name: 'EU West (Ireland)',
        country: 'Ireland',
        continent: 'Europe',
        dataCenter: 'AWS EU West',
        regulations: ['GDPR', 'DPA'],
        certifications: ['SOC2', 'ISO27001', 'C5'],
        active: true
      },
      {
        code: 'ap-southeast-1',
        name: 'Asia Pacific (Singapore)',
        country: 'Singapore',
        continent: 'Asia',
        dataCenter: 'AWS AP Southeast',
        regulations: ['PDPA'],
        certifications: ['SOC2', 'ISO27001', 'MTCS'],
        active: true
      },
      {
        code: 'ca-central-1',
        name: 'Canada (Central)',
        country: 'Canada',
        continent: 'North America',
        dataCenter: 'AWS Canada Central',
        regulations: ['PIPEDA'],
        certifications: ['SOC2', 'ISO27001'],
        active: true
      }
    ];

    regions.forEach(region => {
      this.regions.set(region.code, region);
    });
  }

  private initializeDataClassifications(): void {
    const classifications: DataClassification[] = [
      {
        id: 'public',
        name: 'Public Data',
        level: 'public',
        description: 'Data that can be freely shared and accessed',
        residencyRequirements: [],
        retentionPeriod: 365,
        encryptionRequired: false
      },
      {
        id: 'internal',
        name: 'Internal Data',
        level: 'internal',
        description: 'Data for internal use only',
        residencyRequirements: ['same-continent'],
        retentionPeriod: 1095,
        encryptionRequired: true
      },
      {
        id: 'confidential',
        name: 'Confidential Data',
        level: 'confidential',
        description: 'Sensitive business data requiring protection',
        residencyRequirements: ['same-country'],
        retentionPeriod: 2555,
        encryptionRequired: true
      },
      {
        id: 'restricted',
        name: 'Restricted Data',
        level: 'restricted',
        description: 'Highly sensitive data with strict access controls',
        residencyRequirements: ['specific-region'],
        retentionPeriod: 2555,
        encryptionRequired: true
      }
    ];

    classifications.forEach(classification => {
      this.dataClassifications.set(classification.id, classification);
    });
  }

  private initializeResidencyRules(): void {
    const rules: DataResidencyRule[] = [
      {
        id: 'gdpr-eu-data',
        name: 'GDPR EU Data Residency',
        description: 'EU personal data must remain within EU/EEA',
        regions: ['eu-west-1', 'eu-central-1', 'eu-north-1'],
        dataTypes: ['personal_data', 'user_profiles'],
        restrictions: [
          {
            type: 'storage',
            allowedRegions: ['eu-west-1', 'eu-central-1'],
            prohibitedRegions: ['us-east-1', 'ap-southeast-1'],
            requiresEncryption: true
          },
          {
            type: 'processing',
            allowedRegions: ['eu-west-1', 'eu-central-1'],
            prohibitedRegions: ['us-east-1', 'ap-southeast-1'],
            requiresEncryption: true
          }
        ],
        priority: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'canada-pipeda',
        name: 'Canada PIPEDA Compliance',
        description: 'Canadian personal data residency requirements',
        regions: ['ca-central-1'],
        dataTypes: ['personal_data', 'financial_data'],
        restrictions: [
          {
            type: 'storage',
            allowedRegions: ['ca-central-1'],
            prohibitedRegions: [],
            requiresEncryption: true
          }
        ],
        priority: 2,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'apac-data-localization',
        name: 'APAC Data Localization',
        description: 'Asia-Pacific data localization requirements',
        regions: ['ap-southeast-1', 'ap-northeast-1'],
        dataTypes: ['user_data', 'transaction_data'],
        restrictions: [
          {
            type: 'storage',
            allowedRegions: ['ap-southeast-1', 'ap-northeast-1'],
            prohibitedRegions: ['us-east-1', 'eu-west-1'],
            requiresEncryption: true
          }
        ],
        priority: 3,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    rules.forEach(rule => {
      this.residencyRules.set(rule.id, rule);
    });
  }

  /**
   * Validate data placement against residency rules
   */
  async validateDataPlacement(
    dataType: string,
    classification: string,
    targetRegion: string,
    userLocation?: string
  ): Promise<{
    allowed: boolean;
    violations: string[];
    recommendations: string[];
    applicableRules: string[];
  }> {
    try {
      const violations: string[] = [];
      const recommendations: string[] = [];
      const applicableRules: string[] = [];

      // Find applicable residency rules
      const rules = Array.from(this.residencyRules.values())
        .filter(rule => rule.active && rule.dataTypes.includes(dataType))
        .sort((a, b) => a.priority - b.priority);

      for (const rule of rules) {
        applicableRules.push(rule.id);

        for (const restriction of rule.restrictions) {
          // Check if target region is prohibited
          if (restriction.prohibitedRegions.includes(targetRegion)) {
            violations.push(`Rule ${rule.id}: Region ${targetRegion} is prohibited for ${dataType}`);
          }

          // Check if target region is in allowed list (if specified)
          if (restriction.allowedRegions.length > 0 && 
              !restriction.allowedRegions.includes(targetRegion)) {
            violations.push(`Rule ${rule.id}: Region ${targetRegion} is not in allowed regions for ${dataType}`);
          }
        }
      }

      // Check data classification requirements
      const classificationInfo = this.dataClassifications.get(classification);
      if (classificationInfo) {
        const region = this.regions.get(targetRegion);
        if (region) {
          if (classificationInfo.residencyRequirements.includes('same-country') && userLocation) {
            const userRegion = this.findRegionByLocation(userLocation);
            if (userRegion && userRegion.country !== region.country) {
              violations.push(`Classification ${classification} requires same-country storage`);
              recommendations.push(`Consider using region in ${userRegion.country}`);
            }
          }
        }
      }

      return {
        allowed: violations.length === 0,
        violations,
        recommendations,
        applicableRules
      };
    } catch (error) {
      this.logger.error('Failed to validate data placement', { dataType, classification, targetRegion, error });
      throw error;
    }
  }

  /**
   * Request data movement between regions
   */
  async requestDataMovement(
    dataId: string,
    fromRegion: string,
    toRegion: string,
    reason: string,
    requestedBy: string
  ): Promise<DataMovement> {
    try {
      const dataLocation = this.dataLocations.get(dataId);
      if (!dataLocation) {
        throw new Error(`Data location not found for ID: ${dataId}`);
      }

      // Validate the movement
      const validation = await this.validateDataPlacement(
        dataLocation.dataType,
        dataLocation.classification,
        toRegion
      );

      const movement: DataMovement = {
        id: this.generateMovementId(),
        dataId,
        fromRegion,
        toRegion,
        reason,
        requestedBy,
        status: validation.allowed ? 'approved' : 'pending',
        requestedAt: new Date()
      };

      if (!validation.allowed) {
        this.logger.warn('Data movement requires approval due to violations', {
          dataId,
          violations: validation.violations
        });
        this.emit('dataMovementRequiresApproval', { movement, violations: validation.violations });
      } else {
        this.emit('dataMovementApproved', movement);
        // Auto-approve if no violations
        await this.processDataMovement(movement);
      }

      return movement;
    } catch (error) {
      this.logger.error('Failed to request data movement', { dataId, fromRegion, toRegion, error });
      throw error;
    }
  }

  /**
   * Get compliance status for all data locations
   */
  async getComplianceStatus(): Promise<{
    overallCompliance: number;
    violations: Array<{
      dataId: string;
      violation: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    recommendations: string[];
    regionSummary: Array<{
      region: string;
      dataCount: number;
      complianceRate: number;
    }>;
  }> {
    try {
      const violations: Array<{
        dataId: string;
        violation: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
      }> = [];

      const regionSummary = new Map<string, { dataCount: number; violations: number }>();

      // Check each data location for compliance
      for (const [dataId, location] of this.dataLocations) {
        const validation = await this.validateDataPlacement(
          location.dataType,
          location.classification,
          location.currentRegion
        );

        // Update region summary
        const regionStats = regionSummary.get(location.currentRegion) || { dataCount: 0, violations: 0 };
        regionStats.dataCount++;
        if (!validation.allowed) {
          regionStats.violations++;
        }
        regionSummary.set(location.currentRegion, regionStats);

        // Add violations
        validation.violations.forEach(violation => {
          violations.push({
            dataId,
            violation,
            severity: this.assessViolationSeverity(violation)
          });
        });
      }

      const totalDataItems = this.dataLocations.size;
      const compliantItems = totalDataItems - violations.length;
      const overallCompliance = totalDataItems > 0 ? (compliantItems / totalDataItems) * 100 : 100;

      const regionSummaryArray = Array.from(regionSummary.entries()).map(([region, stats]) => ({
        region,
        dataCount: stats.dataCount,
        complianceRate: stats.dataCount > 0 ? ((stats.dataCount - stats.violations) / stats.dataCount) * 100 : 100
      }));

      const recommendations = this.generateComplianceRecommendations(violations);

      return {
        overallCompliance,
        violations,
        recommendations,
        regionSummary: regionSummaryArray
      };
    } catch (error) {
      this.logger.error('Failed to get compliance status', { error });
      throw error;
    }
  }

  /**
   * Create or update data residency rule
   */
  async createResidencyRule(rule: Omit<DataResidencyRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataResidencyRule> {
    try {
      const newRule: DataResidencyRule = {
        id: this.generateRuleId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...rule
      };

      this.residencyRules.set(newRule.id, newRule);
      this.emit('residencyRuleCreated', newRule);

      this.logger.info('Data residency rule created', { ruleId: newRule.id });
      return newRule;
    } catch (error) {
      this.logger.error('Failed to create residency rule', { error });
      throw error;
    }
  }

  /**
   * Get available regions for data type and classification
   */
  async getAvailableRegions(dataType: string, classification: string): Promise<{
    allowedRegions: RegionInfo[];
    prohibitedRegions: RegionInfo[];
    recommendations: string[];
  }> {
    try {
      const allRegions = Array.from(this.regions.values()).filter(r => r.active);
      const allowedRegions: RegionInfo[] = [];
      const prohibitedRegions: RegionInfo[] = [];
      const recommendations: string[] = [];

      for (const region of allRegions) {
        const validation = await this.validateDataPlacement(dataType, classification, region.code);
        
        if (validation.allowed) {
          allowedRegions.push(region);
        } else {
          prohibitedRegions.push(region);
        }

        recommendations.push(...validation.recommendations);
      }

      return {
        allowedRegions,
        prohibitedRegions,
        recommendations: [...new Set(recommendations)] // Remove duplicates
      };
    } catch (error) {
      this.logger.error('Failed to get available regions', { dataType, classification, error });
      throw error;
    }
  }

  private async processDataMovement(movement: DataMovement): Promise<void> {
    try {
      movement.status = 'completed';
      movement.completedAt = new Date();

      // Update data location
      const dataLocation = this.dataLocations.get(movement.dataId);
      if (dataLocation) {
        dataLocation.currentRegion = movement.toRegion;
        dataLocation.lastMoved = new Date();
        dataLocation.movementHistory.push(movement);
      }

      this.emit('dataMovementCompleted', movement);
      this.logger.info('Data movement completed', { movementId: movement.id });
    } catch (error) {
      movement.status = 'failed';
      this.emit('dataMovementFailed', movement);
      this.logger.error('Data movement failed', { movementId: movement.id, error });
    }
  }

  private findRegionByLocation(location: string): RegionInfo | undefined {
    // Simple location to region mapping - in practice this would be more sophisticated
    const locationMappings: Record<string, string> = {
      'US': 'us-east-1',
      'Canada': 'ca-central-1',
      'EU': 'eu-west-1',
      'Singapore': 'ap-southeast-1'
    };

    const regionCode = locationMappings[location];
    return regionCode ? this.regions.get(regionCode) : undefined;
  }

  private assessViolationSeverity(violation: string): 'low' | 'medium' | 'high' | 'critical' {
    if (violation.includes('prohibited')) return 'critical';
    if (violation.includes('GDPR') || violation.includes('PIPEDA')) return 'high';
    if (violation.includes('same-country')) return 'medium';
    return 'low';
  }

  private generateComplianceRecommendations(violations: Array<{ violation: string }>): string[] {
    const recommendations: string[] = [];
    
    if (violations.some(v => v.violation.includes('GDPR'))) {
      recommendations.push('Consider migrating EU personal data to EU regions');
    }
    
    if (violations.some(v => v.violation.includes('prohibited'))) {
      recommendations.push('Review data placement policies and migrate prohibited data');
    }

    return recommendations;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMovementId(): string {
    return `movement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}