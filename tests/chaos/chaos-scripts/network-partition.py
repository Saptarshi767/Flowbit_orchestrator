#!/usr/bin/env python3
"""
Chaos engineering script to create network partitions between services
"""

import subprocess
import sys
import time
import argparse
import json
import os

class NetworkPartitionChaos:
    def __init__(self):
        self.namespace = os.getenv('KUBERNETES_NAMESPACE', 'ai-orchestrator')
        self.partitioned_services = []
        
    def get_service_pods(self, service_name):
        """Get pods for a specific service"""
        try:
            cmd = [
                'kubectl', 'get', 'pods',
                '-n', self.namespace,
                '-l', f'app={service_name}',
                '-o', 'json'
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            pods_data = json.loads(result.stdout)
            return [pod['metadata']['name'] for pod in pods_data['items']]
        except subprocess.CalledProcessError as e:
            print(f"Error getting pods for service {service_name}: {e}")
            return []
    
    def create_network_policy(self, isolated_service):
        """Create network policy to isolate a service"""
        policy_yaml = f"""
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: chaos-isolate-{isolated_service}
  namespace: {self.namespace}
spec:
  podSelector:
    matchLabels:
      app: {isolated_service}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: {isolated_service}
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: {isolated_service}
  - to: []
    ports:
    - protocol: UDP
      port: 53
"""
        
        # Write policy to temporary file
        policy_file = f'/tmp/chaos-policy-{isolated_service}.yaml'
        with open(policy_file, 'w') as f:
            f.write(policy_yaml)
        
        # Apply the policy
        try:
            subprocess.run(['kubectl', 'apply', '-f', policy_file], check=True)
            print(f"Network policy applied to isolate {isolated_service}")
            self.partitioned_services.append(isolated_service)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error applying network policy: {e}")
            return False
        finally:
            os.remove(policy_file)
    
    def create_traffic_control_partition(self, service_name, delay_ms=1000, loss_percent=50):
        """Use traffic control to simulate network issues"""
        pods = self.get_service_pods(service_name)
        
        for pod in pods:
            try:
                # Add network delay and packet loss
                cmd = [
                    'kubectl', 'exec', '-n', self.namespace, pod, '--',
                    'tc', 'qdisc', 'add', 'dev', 'eth0', 'root', 'netem',
                    'delay', f'{delay_ms}ms', 'loss', f'{loss_percent}%'
                ]
                subprocess.run(cmd, check=True)
                print(f"Applied network chaos to pod {pod}: {delay_ms}ms delay, {loss_percent}% loss")
            except subprocess.CalledProcessError as e:
                print(f"Error applying traffic control to {pod}: {e}")
    
    def isolate_service(self, service_name):
        """Completely isolate a service from network communication"""
        print(f"Isolating service: {service_name}")
        
        # Method 1: Network Policy (preferred for Kubernetes)
        if self.create_network_policy(service_name):
            print(f"Service {service_name} isolated using NetworkPolicy")
        else:
            # Method 2: Traffic Control as fallback
            print(f"Falling back to traffic control for {service_name}")
            self.create_traffic_control_partition(service_name, delay_ms=10000, loss_percent=99)
    
    def create_partial_partition(self, service_name, target_services):
        """Create partial network partition between specific services"""
        print(f"Creating partial partition: {service_name} -> {target_services}")
        
        for target in target_services:
            policy_yaml = f"""
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: chaos-partition-{service_name}-{target}
  namespace: {self.namespace}
spec:
  podSelector:
    matchLabels:
      app: {service_name}
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: {target}
    ports: []
"""
            
            policy_file = f'/tmp/chaos-partition-{service_name}-{target}.yaml'
            with open(policy_file, 'w') as f:
                f.write(policy_yaml)
            
            try:
                subprocess.run(['kubectl', 'apply', '-f', policy_file], check=True)
                print(f"Blocked communication from {service_name} to {target}")
            except subprocess.CalledProcessError as e:
                print(f"Error creating partition policy: {e}")
            finally:
                os.remove(policy_file)
    
    def simulate_slow_network(self, service_name, delay_ms=500, jitter_ms=100):
        """Simulate slow network conditions"""
        print(f"Simulating slow network for {service_name}: {delay_ms}ms ± {jitter_ms}ms")
        pods = self.get_service_pods(service_name)
        
        for pod in pods:
            try:
                cmd = [
                    'kubectl', 'exec', '-n', self.namespace, pod, '--',
                    'tc', 'qdisc', 'add', 'dev', 'eth0', 'root', 'netem',
                    'delay', f'{delay_ms}ms', f'{jitter_ms}ms'
                ]
                subprocess.run(cmd, check=True)
                print(f"Applied network delay to pod {pod}")
            except subprocess.CalledProcessError as e:
                print(f"Error applying network delay to {pod}: {e}")
    
    def restore_network(self):
        """Restore normal network conditions"""
        print("Restoring network connectivity...")
        
        # Remove network policies
        try:
            cmd = [
                'kubectl', 'delete', 'networkpolicy',
                '-n', self.namespace,
                '-l', 'chaos=true'
            ]
            subprocess.run(cmd, check=True)
            print("Removed chaos network policies")
        except subprocess.CalledProcessError:
            pass
        
        # Remove all chaos-related network policies
        for service in self.partitioned_services:
            try:
                subprocess.run([
                    'kubectl', 'delete', 'networkpolicy',
                    f'chaos-isolate-{service}',
                    '-n', self.namespace
                ], check=True)
            except subprocess.CalledProcessError:
                pass
        
        # Remove traffic control rules from all pods
        all_services = ['api-gateway', 'orchestration-service', 'workflow-service', 
                       'execution-service', 'monitoring-service']
        
        for service in all_services:
            pods = self.get_service_pods(service)
            for pod in pods:
                try:
                    subprocess.run([
                        'kubectl', 'exec', '-n', self.namespace, pod, '--',
                        'tc', 'qdisc', 'del', 'dev', 'eth0', 'root'
                    ], check=True)
                    print(f"Removed traffic control from pod {pod}")
                except subprocess.CalledProcessError:
                    pass  # Ignore errors if no tc rules exist
        
        self.partitioned_services.clear()
        print("Network restoration completed")

def main():
    parser = argparse.ArgumentParser(description='Network partition chaos engineering')
    parser.add_argument('--isolate', help='Service to completely isolate')
    parser.add_argument('--partition', help='Create partial partition (service1,service2)')
    parser.add_argument('--slow', help='Simulate slow network for service')
    parser.add_argument('--delay', type=int, default=500, help='Network delay in ms')
    parser.add_argument('--loss', type=int, default=0, help='Packet loss percentage')
    parser.add_argument('--duration', type=int, default=300, help='Duration in seconds')
    parser.add_argument('--restore', action='store_true', help='Restore network connectivity')
    
    args = parser.parse_args()
    
    chaos = NetworkPartitionChaos()
    
    try:
        if args.restore:
            chaos.restore_network()
        elif args.isolate:
            chaos.isolate_service(args.isolate)
            print(f"Maintaining isolation for {args.duration} seconds...")
            time.sleep(args.duration)
            chaos.restore_network()
        elif args.partition:
            services = args.partition.split(',')
            if len(services) >= 2:
                chaos.create_partial_partition(services[0], services[1:])
                print(f"Maintaining partition for {args.duration} seconds...")
                time.sleep(args.duration)
                chaos.restore_network()
        elif args.slow:
            chaos.simulate_slow_network(args.slow, args.delay, args.delay // 5)
            print(f"Maintaining slow network for {args.duration} seconds...")
            time.sleep(args.duration)
            chaos.restore_network()
        else:
            print("No chaos action specified. Use --help for options.")
            
    except KeyboardInterrupt:
        print("\nChaos experiment interrupted. Restoring network...")
        chaos.restore_network()
    except Exception as e:
        print(f"Error during chaos experiment: {e}")
        chaos.restore_network()
        sys.exit(1)

if __name__ == '__main__':
    main()