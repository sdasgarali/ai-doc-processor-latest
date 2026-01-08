import json

with open('EOB_Processing_Webhook_v3_FIXED.json', 'r', encoding='utf-8') as f:
    workflow = json.load(f)

print("=" * 80)
print("ACTUAL CONNECTIVITY ANALYSIS")
print("=" * 80)

# Build a map of which nodes receive input
nodes_receiving_input = set()
for source, targets in workflow['connections'].items():
    for target_list in targets['main']:
        for target in target_list:
            nodes_receiving_input.add(target['node'])

# Check each node
all_nodes = [node['name'] for node in workflow['nodes']]

print("\nNode Connectivity Status:")
print("-" * 80)

disconnected = []
for i, node in enumerate(workflow['nodes']):
    name = node['name']
    has_outgoing = name in workflow['connections']
    has_incoming = name in nodes_receiving_input or name == 'Webhook Trigger'
    
    status = ""
    if has_incoming and has_outgoing:
        status = "CONNECTED (in + out)"
    elif has_incoming and not has_outgoing:
        status = "TERMINAL (in only)"
    elif not has_incoming and has_outgoing:
        status = "START (out only)"
    else:
        status = "DISCONNECTED"
        disconnected.append(name)
    
    symbol = "OK" if status != "DISCONNECTED" else "XX"
    print(f"  [{symbol}] {i+1:2d}. {name:40s} {status}")

if disconnected:
    print("\n" + "!" * 80)
    print("DISCONNECTED NODES FOUND:")
    print("!" * 80)
    for name in disconnected:
        print(f"  - {name}")
    print("\nTHESE NODES ARE NOT CONNECTED TO THE WORKFLOW!")
else:
    print("\nAll nodes are connected.")

# Show the actual connection flow
print("\n" + "=" * 80)
print("CONNECTION FLOW")
print("=" * 80)
for source, targets in sorted(workflow['connections'].items()):
    print(f"\n{source} -->")
    for target_list in targets['main']:
        for target in target_list:
            print(f"  └─> {target['node']}")

