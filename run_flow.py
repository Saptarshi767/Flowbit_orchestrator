import sys
import json
import requests
import time
import os
from datetime import datetime, timezone
from uuid import uuid4

print("--- run_flow.py started (absolute top) ---", file=sys.stderr) # Added for debugging

# Ensure logs directory exists and is writable
LOGS_DIR = "/app/logs"
os.makedirs(LOGS_DIR, exist_ok=True)
os.chmod(LOGS_DIR, 0o777)  # Make sure it's writable

# Emergency logging to capture sys.argv at the very start (explicit file write)
try:
    with open(os.path.join(LOGS_DIR, 'argv_debug.log'), 'w') as f:
        f.write(f'sys.argv (emergency): {sys.argv}\n')
        f.flush()
except Exception as e:
    # Fallback print if file write fails
    print(f'Emergency log file write failed: {e}', file=sys.stderr)

# Function to write debug information to a log file
def write_debug_log(message):
    try:
        with open(os.path.join(LOGS_DIR, 'debug.log'), 'a') as f:
            f.write(f'{datetime.now(timezone.utc).isoformat()} - {message}\n')
            f.flush()
    except Exception as e:
        # Fallback to printing if writing to file fails
        print(f'Failed to write debug log file: {e}', file=sys.stderr)
        print(f'DEBUG (fallback): {message}', file=sys.stderr)

def load_workflow(path):
    write_debug_log(f"Attempting to load workflow from path: {path}")
    try:
        with open(path, 'r') as f:
            flow = json.load(f)
            write_debug_log(f"Successfully loaded workflow JSON.")
            write_debug_log(f"Type of loaded workflow: {type(flow).__name__}")
            if isinstance(flow, dict):
                 write_debug_log(f"Top-level keys present: {list(flow.keys())}")
                 # Handle both old and new workflow formats
                 if 'data' in flow:
                     write_debug_log("Found 'data' key in workflow.")
                     if isinstance(flow['data'], dict):
                         write_debug_log(f"Content of 'data' is a dictionary. Keys present: {list(flow['data'].keys())}")
                         if 'nodes' in flow['data'] and 'edges' in flow['data']:
                             write_debug_log("Found 'nodes' and 'edges' under 'data'.")
                             if isinstance(flow['data']['nodes'], list) and isinstance(flow['data']['edges'], list):
                                  write_debug_log("'data.nodes' and 'data.edges' are lists.")
                                  return {
                                      'nodes': flow['data']['nodes'],
                                      'edges': flow['data']['edges']
                                  }
                             else:
                                 nodes_type = type(flow['data']['nodes']).__name__
                                 edges_type = type(flow['data']['edges']).__name__
                                 write_debug_log(f"Error: 'data.nodes' or 'data.edges' are not lists. Nodes type: {nodes_type}, Edges type: {edges_type}")
                                 raise ValueError(f"Workflow data has nodes/edges but they are not lists. Nodes type: {nodes_type}, Edges type: {edges_type}")
                         else:
                              write_debug_log(f"Error: Missing 'nodes' or 'edges' under 'data' key. Found keys under data: {list(flow['data'].keys())}")
                              raise ValueError(f"Workflow data missing required keys ('nodes' or 'edges') under 'data'. Found keys: {list(flow['data'].keys())}")
                     else:
                         write_debug_log(f"Error: Content of 'data' is not a dictionary. Type: {type(flow['data']).__name__}")
                         raise ValueError(f"Workflow has 'data' key, but its content is not a dictionary. Type: {type(flow['data']).__name__}")

                 write_debug_log("No 'data' key found, attempting to use root level nodes and edges.")
                 if 'nodes' in flow and 'edges' in flow:
                     write_debug_log("Found 'nodes' and 'edges' at root level.")
                     if isinstance(flow['nodes'], list) and isinstance(flow['edges'], list):
                         write_debug_log("Root level 'nodes' and 'edges' are lists.")
                         return flow
                     else:
                         nodes_type = type(flow['nodes']).__name__
                         edges_type = type(flow['edges']).__name__
                         write_debug_log(f"Error: Root level 'nodes' or 'edges' are not lists. Nodes type: {nodes_type}, Edges type: {edges_type}")
                         raise ValueError(f"Workflow has root level nodes/edges but they are not lists. Nodes type: {nodes_type}, Edges type: {edges_type}")

            # If neither format worked or not a dictionary
            write_debug_log("Error: Workflow does not contain expected keys or is not a dictionary.")
            raise ValueError("Workflow must be a dictionary containing 'data.nodes'/'data.edges' or root level 'nodes'/'edges' as lists.")

    except FileNotFoundError:
        write_debug_log(f"Error: Workflow file not found at path: {path}")
        raise
    except json.JSONDecodeError as e:
        write_debug_log(f"Error: Failed to parse workflow JSON: {e}")
        raise
    except Exception as e:
        write_debug_log(f"Unexpected error loading workflow: {e}")
        raise

def extract_prompt(flow, input_data):
    # Add robust check for 'nodes' key and list type
    if not isinstance(flow, dict) or 'nodes' not in flow or not isinstance(flow['nodes'], list):
        error_msg = f"Error in extract_prompt: Expected flow to be a dictionary with a list 'nodes' key. Got type: {type(flow).__name__}, Keys: {list(flow.keys()) if isinstance(flow, dict) else 'N/A'}"
        print(error_msg, file=sys.stderr)
        write_debug_log(error_msg)
        raise ValueError("Invalid flow structure passed to extract_prompt: Missing or invalid 'nodes' key.")

    write_debug_log(f"extract_prompt received flow keys: {list(flow.keys())}")
    write_debug_log(f"extract_prompt received input_data: {input_data}")

    # 1. Try simple InputNode (legacy/simple flows)
    for node in flow['nodes']:
        if not isinstance(node, dict):
            continue
        if node.get('type') == 'InputNode' and 'data' in node and 'input' in node['data']:
            template = node['data']['input']
            write_debug_log(f"Found simple InputNode with template: {template}")
            processed_template = template
            if isinstance(input_data, dict):
                for key, value in input_data.items():
                    placeholder = '{' + key + '}'
                    processed_template = processed_template.replace(placeholder, str(value))
            return processed_template

    # 2. Try LangFlow (ChatInput + Prompt node)
    # Find ChatInput node (by id or type)
    chat_input_id = None
    for node in flow['nodes']:
        node_id = node.get('id') or node.get('data', {}).get('id')
        node_type = node.get('type') or node.get('data', {}).get('type')
        if (node_id and str(node_id).startswith('ChatInput')) or (node_type and 'ChatInput' in str(node_type)):
            chat_input_id = node_id
            write_debug_log(f"Found ChatInput node with id: {chat_input_id}")
            break
    if chat_input_id:
        # Find Prompt node connected to ChatInput
        prompt_node = None
        for node in flow['nodes']:
            node_id = node.get('id') or node.get('data', {}).get('id')
            node_type = node.get('type') or node.get('data', {}).get('type')
            if (node_id and str(node_id).startswith('Prompt')) or (node_type and 'Prompt' in str(node_type)):
                prompt_node = node
                break
        if prompt_node:
            # Try to get template from Prompt node
            template = None
            # LangFlow 1.4+ style: node['data']['node']['template']['value']
            try:
                template = prompt_node['data']['node']['template']['value']
            except Exception:
                # Fallback: node['data']['template']['value']
                template = prompt_node.get('data', {}).get('template', {}).get('value')
            if template:
                write_debug_log(f"Found LangFlow Prompt node with template: {template}")
                processed_template = template
                if isinstance(input_data, dict):
                    for key, value in input_data.items():
                        placeholder = '{' + key + '}'
                        processed_template = processed_template.replace(placeholder, str(value))
                return processed_template
            else:
                write_debug_log("Prompt node found but no template value present.")

    # 3. Fallback: Error
    write_debug_log("Error: Input node with 'input' or Prompt template not found in flow nodes, or node structure is unexpected.")
    raise ValueError("Input node with expected structure not found in flow nodes.")

def run_ollama(prompt, log_file):
    ollama_host = os.getenv('OLLAMA_HOST', 'http://ollama:11434')
    url = f"{ollama_host}/api/generate"
    data = {
        "model": "tinyllama",
        "prompt": prompt,
        "stream": False
    }
    
    with open(log_file, 'a') as log:
        log.write(f"Sending request to Ollama: {prompt}\n")
    
    try:
        response = requests.post(url, json=data, timeout=60)
        if response.status_code == 200:
            result = response.json().get('response', '')
            with open(log_file, 'a') as log:
                log.write(f"Ollama response: {result}\n")
            return result
        else:
            error_msg = f"Ollama request failed: {response.status_code} - {response.text}"
            with open(log_file, 'a') as log:
                log.write(f"Error: {error_msg}\n")
            raise Exception(error_msg)
    except requests.exceptions.RequestException as e:
        error_msg = f"Ollama connection error: {str(e)}"
        with open(log_file, 'a') as log:
            log.write(f"Error: {error_msg}\n")
        raise Exception(error_msg)

def append_execution_log(entry, path='executions.json'):
    if not os.path.exists(path):
        with open(path, 'w') as f:
            json.dump([], f)
    with open(path, 'r+') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            data = []
        data.append(entry)
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

def main():
    try:
        # Write initial debug info to both file and stdout
        debug_info = {
            "script_started": datetime.now(timezone.utc).isoformat(),
            "sys_argv": sys.argv,
            "python_version": sys.version,
            "current_directory": os.getcwd(),
            "directory_contents": os.listdir(".")
        }
        write_debug_log(f"Initial debug info: {json.dumps(debug_info, indent=2)}")
        print(f"DEBUG_INFO: {json.dumps(debug_info, indent=2)}")

        if len(sys.argv) != 3:
            error_msg = f"Incorrect number of arguments. Received: {sys.argv}"
            write_debug_log(error_msg)
            print(f"ERROR: {error_msg}")
            sys.exit(1)

        flow_path = sys.argv[1]
        input_arg = sys.argv[2]
        input_arg_stripped = input_arg.strip('\'"')
        input_debug = {
            "flow_path": flow_path,
            "input_arg": input_arg,
            "input_arg_type": type(input_arg).__name__,
            "input_arg_stripped": input_arg_stripped
        }
        write_debug_log(f"Input debug info: {json.dumps(input_debug, indent=2)}")
        print(f"INPUT_DEBUG: {json.dumps(input_debug, indent=2)}")

        input_data = None
        # Attempt to load input from file if it exists and ends with .json
        if os.path.exists(input_arg_stripped) and input_arg_stripped.endswith('.json'):
            write_debug_log(f"Attempting to load input from file: {input_arg_stripped}")
            try:
                with open(input_arg_stripped, 'r') as f:
                    input_data = json.load(f)
                    write_debug_log(f"Successfully loaded input data from file: {input_data}")
            except Exception as e:
                write_debug_log(f"Error loading input file: {e}")
                print(f"ERROR: Failed to load input file: {e}")
                sys.exit(1)
        else:
            try:
                input_data = json.loads(input_arg_stripped)
                write_debug_log(f"Successfully parsed input data from JSON string: {input_data}")
            except json.JSONDecodeError as e:
                write_debug_log(f"Error parsing input JSON: {e}")
                print(f"ERROR: Failed to parse input JSON: {e}")
                sys.exit(1)

        flow_name = os.path.basename(flow_path).replace(".json", "")
        execution_id = str(uuid4())
        start_time = datetime.now(timezone.utc)
        log_file = os.path.join(LOGS_DIR, f"{execution_id}.log")

        try:
            # Log start of execution
            with open(log_file, 'a') as log:
                log.write(f"[START] Execution {execution_id} for flow '{flow_name}' at {start_time.isoformat()}\n")
                log.write(f"Input: {json.dumps(input_data)}\n")
            write_debug_log(f"[START] Execution {execution_id} for flow '{flow_name}' at {start_time.isoformat()}")

            # Load workflow
            write_debug_log(f"Attempting to load workflow from path: {flow_path}")
            with open(log_file, 'a') as log:
                log.write(f"Loading workflow from: {flow_path}\n")
            flow = load_workflow(flow_path)
            with open(log_file, 'a') as log:
                log.write(f"Workflow loaded. Node count: {len(flow['nodes']) if 'nodes' in flow else 'N/A'}\n")
            write_debug_log(f"Successfully loaded flow with {len(flow['nodes'])} nodes")
            print(f"DEBUG: Successfully loaded flow with {len(flow['nodes'])} nodes")

            # Extract prompt
            with open(log_file, 'a') as log:
                log.write(f"Extracting prompt from flow and input...\n")
            prompt = extract_prompt(flow, input_data)
            with open(log_file, 'a') as log:
                log.write(f"Prompt extracted: {prompt}\n")

            # Run the flow (Ollama)
            with open(log_file, 'a') as log:
                log.write(f"Calling Ollama with prompt...\n")
            output = run_ollama(prompt, log_file)
            with open(log_file, 'a') as log:
                log.write(f"Ollama output: {output}\n")

            # Calculate duration
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            with open(log_file, 'a') as log:
                log.write(f"[END] Execution completed in {duration:.2f} seconds.\n")
            write_debug_log(f"[END] Execution {execution_id} completed in {duration:.2f} seconds.")

            # Create execution log entry
            execution_log = {
                "id": execution_id,
                "flow": flow_name,
                "status": "Success",
                "input": input_data,
                "output": output,
                "error": "",
                "startTime": start_time.isoformat(),
                "duration": duration
            }
            append_execution_log(execution_log)
            print(json.dumps(execution_log))
        except Exception as e:
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            error_log = {
                "id": execution_id,
                "flow": flow_name,
                "status": "Error",
                "input": input_data,
                "output": "",
                "error": str(e),
                "startTime": start_time.isoformat(),
                "duration": duration
            }
            with open(log_file, 'a') as log:
                log.write(f"[ERROR] {str(e)}\n")
                log.write(f"[END] Execution failed after {duration:.2f} seconds.\n")
            write_debug_log(f"Error during flow execution: {str(e)}")
            print(f"ERROR: {str(e)}")
            append_execution_log(error_log)
            print(json.dumps(error_log))
            sys.exit(1)
    except Exception as e:
        error_msg = f"Unexpected error in main: {str(e)}"
        write_debug_log(error_msg)
        print(f"ERROR: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()