#!/usr/bin/env python3
"""
Chaos engineering script to exhaust database connection pool
"""

import asyncio
import asyncpg
import os
import sys
import time
from typing import List

class DatabaseConnectionExhauster:
    def __init__(self):
        self.db_url = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost:5432/orchestrator')
        self.connections: List[asyncpg.Connection] = []
        self.max_connections = int(os.getenv('MAX_CONNECTIONS', '100'))
        
    async def exhaust_connections(self):
        """Create connections until pool is exhausted"""
        print(f"Starting connection exhaustion attack...")
        print(f"Target: {self.db_url}")
        print(f"Max connections to create: {self.max_connections}")
        
        try:
            for i in range(self.max_connections):
                try:
                    conn = await asyncpg.connect(self.db_url)
                    self.connections.append(conn)
                    print(f"Created connection {i+1}/{self.max_connections}")
                    
                    # Small delay to avoid overwhelming the database
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    print(f"Failed to create connection {i+1}: {e}")
                    break
            
            print(f"Successfully created {len(self.connections)} connections")
            print("Connection pool should now be exhausted")
            
            # Keep connections alive for specified duration
            duration = int(os.getenv('CHAOS_DURATION', '300'))  # 5 minutes default
            print(f"Holding connections for {duration} seconds...")
            
            start_time = time.time()
            while time.time() - start_time < duration:
                # Periodically execute a simple query to keep connections alive
                for i, conn in enumerate(self.connections[:10]):  # Test first 10 connections
                    try:
                        await conn.fetchval('SELECT 1')
                    except Exception as e:
                        print(f"Connection {i} failed health check: {e}")
                
                await asyncio.sleep(10)  # Check every 10 seconds
                
        except KeyboardInterrupt:
            print("Chaos experiment interrupted by user")
        except Exception as e:
            print(f"Unexpected error during chaos experiment: {e}")
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """Close all connections"""
        print("Cleaning up connections...")
        for i, conn in enumerate(self.connections):
            try:
                await conn.close()
                print(f"Closed connection {i+1}")
            except Exception as e:
                print(f"Error closing connection {i+1}: {e}")
        
        self.connections.clear()
        print("Cleanup completed")

    async def verify_exhaustion(self):
        """Verify that new connections fail"""
        print("Verifying connection pool exhaustion...")
        try:
            test_conn = await asyncpg.connect(self.db_url)
            await test_conn.close()
            print("WARNING: New connection succeeded - pool may not be exhausted")
            return False
        except Exception as e:
            print(f"New connection failed as expected: {e}")
            return True

async def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--verify':
        # Just verify current state
        exhauster = DatabaseConnectionExhauster()
        await exhauster.verify_exhaustion()
        return
    
    exhauster = DatabaseConnectionExhauster()
    
    try:
        await exhauster.exhaust_connections()
    except Exception as e:
        print(f"Chaos experiment failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())