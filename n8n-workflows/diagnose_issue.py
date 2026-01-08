import json

with open('EOB_Processing_Webhook_v3_FIXED.json', 'r', encoding='utf-8') as f:
    workflow = json.load(f)

print("=" * 80)
print("DIAGNOSING DISCONNECTED NODES")
print("=" * 80)

disconnected_nodes = [
    "OpenAI - Extract EOB Data",
    "Parse Python Output",
    "Calculate Total Cost & Time",
    "Prepare JSON"
]

print("\nChecking connections for reported disconnected nodes:\n")

for node_name in disconnected_nodes:
    print(f"\n{'='*80}")
    print(f"NODE: {node_name}")
    print(f"{'='*80}")
    
    # Find incoming connections
    incoming = []
    for source, targets in workflow['connections'].items():
        for target_list in targets.get('main', []):
            for target in target_list:
                if target['node'] == node_name:
                    incoming.append(source)
    
    # Find outgoing connections
    outgoing = []
    if node_name in workflow['connections']:
        for target_list in workflow['connections'][node_name].get('main', []):
            for target in target_list:
                outgoing.append(target['node'])
    
    print(f"\nINCOMING connections (nodes that connect TO this node):")
    if incoming:
        for src in incoming:
            print(f"  <- {src}")
    else:
        print(f"  NONE - THIS IS THE PROBLEM!")
    
    print(f"\nOUTGOING connections (nodes this connects TO):")
    if outgoing:
        for tgt in outgoing:
            print(f"  -> {tgt}")
    else:
        print(f"  None (this is a terminal node)" if not incoming else "  NONE - DISCONNECTED!")

# Now let's trace the expected flow
print("\n\n" + "=" * 80)
print("EXPECTED FLOW (from original workflow)")
print("=" * 80)

with open('EOB_Processing_Webhook_v3_Dynamic_Pricing.json', 'r', encoding='utf-8') as f:
    original = json.load(f)

print("\nOriginal connections for these nodes:\n")
for node_name in disconnected_nodes:
    incoming = []
    for source, targets in original['connections'].items():
        for target_list in targets.get('main', []):
            for target in target_list:
                if target['node'] == node_name:
                    incoming.append(source)
    
    outgoing = []
    if node_name in original['connections']:
        for target_list in original['connections'][node_name].get('main', []):
            for target in target_list:
                outgoing.append(target['node'])
    
    print(f"\n{node_name}:")
    print(f"  Incoming: {incoming}")
    print(f"  Outgoing: {outgoing}")

