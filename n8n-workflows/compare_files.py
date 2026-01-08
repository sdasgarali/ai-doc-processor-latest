import json

with open('EOB_Processing_Webhook_v3_Dynamic_Pricing.json', 'r', encoding='utf-8') as f:
    original = json.load(f)

with open('EOB_Processing_Webhook_v3_FIXED.json', 'r', encoding='utf-8') as f:
    fixed = json.load(f)

print("Comparing original vs fixed workflow...\n")

# Compare top-level keys
print("Top-level keys comparison:")
orig_keys = set(original.keys())
fixed_keys = set(fixed.keys())

if orig_keys == fixed_keys:
    print("  OK: Same top-level keys")
else:
    print(f"  Missing in fixed: {orig_keys - fixed_keys}")
    print(f"  Extra in fixed: {fixed_keys - orig_keys}")

# Compare settings
print("\nSettings comparison:")
if original.get('settings') == fixed.get('settings'):
    print("  OK: Settings match")
else:
    print(f"  Original settings: {original.get('settings')}")
    print(f"  Fixed settings: {fixed.get('settings')}")

# Check if connections are identical
print("\nConnections comparison:")
if original['connections'] == fixed['connections']:
    print("  OK: All connections match exactly")
else:
    print("  WARNING: Connections differ!")
    
    # Find differences
    orig_conn_keys = set(original['connections'].keys())
    fixed_conn_keys = set(fixed['connections'].keys())
    
    if orig_conn_keys != fixed_conn_keys:
        print(f"  Missing in fixed: {orig_conn_keys - fixed_conn_keys}")
        print(f"  Extra in fixed: {fixed_conn_keys - orig_conn_keys}")

# Check node count
print(f"\nNode count:")
print(f"  Original: {len(original['nodes'])}")
print(f"  Fixed: {len(fixed['nodes'])}")

# Compare each node except the 3 we modified
print("\nNode-by-node comparison (excluding the 3 modified nodes):")
modified_indices = {2, 3, 20}
differences = []

for i in range(len(original['nodes'])):
    if i in modified_indices:
        continue
    
    if original['nodes'][i] != fixed['nodes'][i]:
        differences.append(i)
        print(f"  Node {i+1} ({original['nodes'][i]['name']}): DIFFERENT")

if not differences:
    print("  All non-modified nodes are identical")
else:
    print(f"\nFound {len(differences)} unexpected differences in unchanged nodes!")

