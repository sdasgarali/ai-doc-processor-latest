import json

with open('EOB_Processing_Webhook_v3_FIXED.json', 'r', encoding='utf-8') as f:
    workflow = json.load(f)

print("Checking if connections reference correct node IDs vs names...")
print()

# Build map of node names to IDs
name_to_id = {}
id_to_name = {}
for node in workflow['nodes']:
    name_to_id[node['name']] = node['id']
    id_to_name[node['id']] = node['name']

print("Node Name -> Node ID mapping:")
for name, node_id in name_to_id.items():
    print(f"  {name:40s} -> {node_id}")

print("\n" + "=" * 80)
print("Checking if connections use node NAMEs (correct) or IDs (incorrect)...")
print("=" * 80)

# Check connections
issues = []
for source_name, targets in workflow['connections'].items():
    for target_list in targets['main']:
        for target in target_list:
            target_node = target['node']
            # Check if it's a name or ID
            if target_node in name_to_id:
                print(f"OK: {source_name} -> {target_node} (using name)")
            elif target_node in id_to_name:
                print(f"ERROR: {source_name} -> {target_node} (using ID instead of name!)")
                issues.append(f"{source_name} -> {target_node}")
            else:
                print(f"ERROR: {source_name} -> {target_node} (NOT FOUND!)")
                issues.append(f"{source_name} -> {target_node}")

if issues:
    print("\nISSUES FOUND:")
    for issue in issues:
        print(f"  - {issue}")
else:
    print("\nNo issues found - all connections use node names correctly")
