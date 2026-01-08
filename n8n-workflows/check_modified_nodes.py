import json

with open('EOB_Processing_Webhook_v3_FIXED.json', 'r', encoding='utf-8') as f:
    workflow = json.load(f)

print("=" * 80)
print("CHECKING THE 3 MODIFIED CODE NODES")
print("=" * 80)

# The 3 nodes I modified
modified_indices = [2, 3, 20]
modified_names = ["Get Model Pricing", "Get Document AI Cost Config", "Send Results to Upload Service"]

for idx, name in zip(modified_indices, modified_names):
    node = workflow['nodes'][idx]
    print(f"\n{'='*80}")
    print(f"Node {idx+1}: {name}")
    print(f"{'='*80}")
    print(f"Type: {node['type']}")
    print(f"TypeVersion: {node['typeVersion']}")
    print(f"ID: {node['id']}")
    print(f"Position: {node['position']}")
    
    # Check if it has all required fields
    required_fields = ['parameters', 'id', 'name', 'type', 'typeVersion', 'position']
    missing = [f for f in required_fields if f not in node]
    if missing:
        print(f"MISSING FIELDS: {missing}")
    else:
        print("Has all required fields: OK")
    
    # Check parameters
    if 'parameters' in node:
        if 'jsCode' in node['parameters']:
            code_length = len(node['parameters']['jsCode'])
            print(f"Has jsCode parameter: {code_length} characters")
        else:
            print("ERROR: Missing jsCode parameter!")
    
    # Print the full node structure
    print(f"\nFull node structure:")
    print(json.dumps(node, indent=2)[:500] + "...")

