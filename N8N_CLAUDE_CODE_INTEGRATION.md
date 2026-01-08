# n8n + Claude Code Integration Guide

A comprehensive guide to enable Claude Code to access, analyze, debug, and modify n8n workflows programmatically. This setup allows AI-assisted workflow development and troubleshooting across multiple n8n environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Multi-Environment Configuration](#multi-environment-configuration)
4. [CLI Helper Setup](#cli-helper-setup)
5. [Usage Examples](#usage-examples)
6. [Workflow Modification Patterns](#workflow-modification-patterns)
7. [Debugging Workflows](#debugging-workflows)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js v16 or higher
- n8n instance running (self-hosted or cloud)
- npm packages: `axios`, `dotenv`
- API access enabled in n8n

## Initial Setup

### Step 1: Enable n8n API

1. Open your n8n instance (e.g., `http://localhost:5678`)
2. Go to **Settings** → **API**
3. Enable API access
4. Click **Create API Key**
5. Copy the generated API key (save it securely - it won't be shown again)

### Step 2: Configure Environment Variables

Add these to your project's `.env` file:

```bash
# n8n API Configuration
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
```

For remote n8n instances:
```bash
N8N_BASE_URL=https://your-n8n-domain.com
N8N_API_KEY=your_api_key_here
```

### Step 3: Install Dependencies

```bash
npm install axios dotenv
```

---

## Multi-Environment Configuration

To work with multiple n8n instances (local, staging, production, client-specific), configure named environments:

### Environment Variables Pattern

```bash
# Default environment (used when no -e flag specified)
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_default_key

# Local development
N8N_LOCAL_URL=http://localhost:5678
N8N_LOCAL_API_KEY=your_local_key

# Production
N8N_PROD_URL=https://n8n.yourcompany.com
N8N_PROD_API_KEY=your_prod_key

# Staging
N8N_STAGING_URL=https://staging-n8n.yourcompany.com
N8N_STAGING_API_KEY=your_staging_key

# Client-specific (any name works)
N8N_CLIENT1_URL=https://client1-n8n.example.com
N8N_CLIENT1_API_KEY=your_client1_key
```

### Usage with Environment Flag

```bash
# Default environment
node scripts/n8n-cli.js workflows

# Specific environments
node scripts/n8n-cli.js -e local workflows
node scripts/n8n-cli.js -e prod executions
node scripts/n8n-cli.js -e staging errors 123
node scripts/n8n-cli.js -e client1 active

# List all configured environments
node scripts/n8n-cli.js envs
```

### Naming Convention

The `-e <name>` flag looks for these environment variables:
- `N8N_<NAME>_URL` - The n8n instance URL
- `N8N_<NAME>_API_KEY` - The API key for that instance

Examples:
| Flag | URL Variable | API Key Variable |
|------|--------------|------------------|
| `-e local` | `N8N_LOCAL_URL` | `N8N_LOCAL_API_KEY` |
| `-e prod` | `N8N_PROD_URL` | `N8N_PROD_API_KEY` |
| `-e myserver` | `N8N_MYSERVER_URL` | `N8N_MYSERVER_API_KEY` |

---

## CLI Helper Setup

Create `scripts/n8n-cli.js` in your project:

```javascript
#!/usr/bin/env node
/**
 * n8n CLI Helper for Claude Code
 *
 * Enables programmatic access to n8n workflows and executions.
 *
 * Commands:
 *   workflows              - List all workflows
 *   workflow <id>          - Get workflow details
 *   executions [workflowId]- List recent executions
 *   execution <id>         - Get execution details
 *   nodes <executionId>    - Get detailed node outputs
 *   node <execId> <name>   - Get specific node output
 *   errors <executionId>   - Show only failed nodes
 *   trigger <path> [data]  - Trigger webhook workflow
 *   active                 - List active workflows
 *   search <wfId> <pattern>- Search node code
 *   credentials            - List credentials
 */

require('dotenv').config();
const axios = require('axios');

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('Error: N8N_API_KEY not set in .env file');
  console.error('Generate one at: ' + N8N_BASE_URL + '/settings/api');
  process.exit(1);
}

const api = axios.create({
  baseURL: N8N_BASE_URL + '/api/v1',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

async function listWorkflows() {
  const { data } = await api.get('/workflows');
  console.log('\n=== WORKFLOWS ===\n');
  data.data.forEach(wf => {
    const status = wf.active ? '[ACTIVE]' : '[inactive]';
    console.log(`${status} ${wf.id}: ${wf.name}`);
    console.log(`   Created: ${wf.createdAt}`);
    console.log(`   Updated: ${wf.updatedAt}\n`);
  });
  console.log(`Total: ${data.data.length} workflows`);
}

async function getWorkflow(workflowId) {
  const { data } = await api.get(`/workflows/${workflowId}`);
  console.log('\n=== WORKFLOW DETAILS ===\n');
  console.log(`Name: ${data.name}`);
  console.log(`ID: ${data.id}`);
  console.log(`Active: ${data.active}`);
  console.log(`\nNodes (${data.nodes.length}):`);

  data.nodes.forEach(node => {
    console.log(`  - ${node.name} (${node.type})`);
    if (node.parameters?.jsCode) {
      const lines = node.parameters.jsCode.split('\n').length;
      console.log(`    [Code node: ${lines} lines]`);
    }
  });

  console.log('\nConnections:');
  Object.entries(data.connections).forEach(([from, conns]) => {
    if (conns.main) {
      conns.main.forEach((outputs, idx) => {
        outputs.forEach(conn => {
          console.log(`  ${from} -> ${conn.node}`);
        });
      });
    }
  });
}

async function listExecutions(workflowId) {
  let url = '/executions?limit=20';
  if (workflowId) url += `&workflowId=${workflowId}`;

  const { data } = await api.get(url);
  console.log('\n=== RECENT EXECUTIONS ===\n');

  data.data.forEach(exec => {
    const status = exec.finished
      ? (exec.status === 'success' ? 'SUCCESS' : 'FAILED')
      : 'RUNNING';
    const statusIcon = status === 'SUCCESS' ? '+' : status === 'FAILED' ? 'X' : '~';

    console.log(`[${statusIcon}] Execution ${exec.id}`);
    console.log(`    Workflow: ${exec.workflowId}`);
    console.log(`    Status: ${status}`);
    console.log(`    Started: ${exec.startedAt}`);
    if (exec.stoppedAt) {
      console.log(`    Stopped: ${exec.stoppedAt}`);
    }
    console.log('');
  });
}

async function getExecution(executionId) {
  const { data } = await api.get(`/executions/${executionId}`);
  console.log('\n=== EXECUTION DETAILS ===\n');
  console.log(`ID: ${data.id}`);
  console.log(`Workflow: ${data.workflowId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Started: ${data.startedAt}`);
  console.log(`Stopped: ${data.stoppedAt || 'N/A'}`);

  if (data.data?.resultData?.runData) {
    console.log('\n--- Node Results ---\n');
    Object.entries(data.data.resultData.runData).forEach(([nodeName, runs]) => {
      console.log(`\n[${nodeName}]`);
      runs.forEach((run, idx) => {
        if (run.error) {
          console.log(`  Run ${idx + 1}: ERROR - ${run.error.message}`);
        } else if (run.data?.main) {
          const items = run.data.main[0] || [];
          console.log(`  Run ${idx + 1}: ${items.length} items output`);
          if (items.length > 0 && items.length <= 3) {
            items.forEach((item, i) => {
              const preview = JSON.stringify(item.json).substring(0, 200);
              console.log(`    Item ${i + 1}: ${preview}${preview.length >= 200 ? '...' : ''}`);
            });
          }
        }
      });
    });
  }
}

async function getNodeOutputs(executionId) {
  const { data } = await api.get(`/executions/${executionId}`);
  console.log('\n=== DETAILED NODE OUTPUTS ===\n');

  if (data.data?.resultData?.runData) {
    Object.entries(data.data.resultData.runData).forEach(([nodeName, runs]) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`NODE: ${nodeName}`);
      console.log('='.repeat(60));

      runs.forEach((run, idx) => {
        console.log(`\n--- Run ${idx + 1} ---`);
        if (run.error) {
          console.log('STATUS: ERROR');
          console.log('Message:', run.error.message);
          if (run.error.stack) {
            console.log('Stack:', run.error.stack.split('\n').slice(0, 5).join('\n'));
          }
        } else if (run.data?.main) {
          console.log('STATUS: Success');
          const items = run.data.main[0] || [];
          console.log(`Items: ${items.length}`);

          items.slice(0, 5).forEach((item, i) => {
            console.log(`\nItem ${i + 1}:`);
            console.log(JSON.stringify(item.json, null, 2).substring(0, 1000));
          });

          if (items.length > 5) {
            console.log(`\n... and ${items.length - 5} more items`);
          }
        }
      });
    });
  }
}

async function getSpecificNode(executionId, nodeName) {
  const { data } = await api.get(`/executions/${executionId}`);

  if (data.data?.resultData?.runData) {
    const nodeData = data.data.resultData.runData[nodeName];
    if (nodeData) {
      console.log(`\n=== NODE OUTPUT: ${nodeName} ===\n`);
      console.log(JSON.stringify(nodeData, null, 2));
    } else {
      console.log(`Node "${nodeName}" not found in execution.`);
      console.log('Available nodes:', Object.keys(data.data.resultData.runData).join(', '));
    }
  }
}

async function getErrors(executionId) {
  const { data } = await api.get(`/executions/${executionId}`);
  console.log('\n=== EXECUTION ERRORS ===\n');

  let hasErrors = false;
  if (data.data?.resultData?.runData) {
    Object.entries(data.data.resultData.runData).forEach(([nodeName, runs]) => {
      runs.forEach((run, idx) => {
        if (run.error) {
          hasErrors = true;
          console.log(`\n[ERROR] ${nodeName}`);
          console.log(`  Message: ${run.error.message}`);
          console.log(`  Description: ${run.error.description || 'N/A'}`);
          if (run.error.stack) {
            console.log(`  Stack:\n    ${run.error.stack.split('\n').slice(0, 10).join('\n    ')}`);
          }
        }
      });
    });
  }

  if (!hasErrors) {
    console.log('No errors found in this execution.');
    console.log(`Execution status: ${data.status}`);
  }
}

async function triggerWebhook(webhookPath, jsonData) {
  const url = N8N_BASE_URL + '/webhook/' + webhookPath;
  console.log(`Triggering webhook: ${url}`);

  const payload = jsonData ? JSON.parse(jsonData) : {};
  const { data } = await axios.post(url, payload);

  console.log('\n=== WEBHOOK RESPONSE ===\n');
  console.log(JSON.stringify(data, null, 2));
}

async function listActiveWorkflows() {
  const { data } = await api.get('/workflows');
  console.log('\n=== ACTIVE WORKFLOWS ===\n');

  const active = data.data.filter(wf => wf.active);
  active.forEach(wf => {
    console.log(`${wf.id}: ${wf.name}`);
  });

  console.log(`\nTotal: ${active.length} active workflows`);
}

async function searchWorkflow(workflowId, pattern) {
  const { data } = await api.get(`/workflows/${workflowId}`);
  console.log(`\n=== SEARCHING FOR: ${pattern} ===\n`);

  const regex = new RegExp(pattern, 'gi');

  data.nodes.forEach(node => {
    if (node.parameters?.jsCode && regex.test(node.parameters.jsCode)) {
      console.log(`\nFound in: ${node.name}`);
      const lines = node.parameters.jsCode.split('\n');
      lines.forEach((line, idx) => {
        if (regex.test(line)) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  });
}

async function listCredentials() {
  try {
    const { data } = await api.get('/credentials');
    console.log('\n=== CREDENTIALS ===\n');

    data.data.forEach(cred => {
      console.log(`${cred.id}: ${cred.name} (${cred.type})`);
    });

    console.log(`\nTotal: ${data.data.length} credentials`);
  } catch (err) {
    console.log('Could not list credentials (may require owner permission)');
  }
}

// Main command router
const [,, command, ...args] = process.argv;

const commands = {
  workflows: listWorkflows,
  workflow: () => getWorkflow(args[0]),
  executions: () => listExecutions(args[0]),
  execution: () => getExecution(args[0]),
  nodes: () => getNodeOutputs(args[0]),
  node: () => getSpecificNode(args[0], args[1]),
  errors: () => getErrors(args[0]),
  trigger: () => triggerWebhook(args[0], args[1]),
  active: listActiveWorkflows,
  search: () => searchWorkflow(args[0], args[1]),
  credentials: listCredentials
};

if (!command || !commands[command]) {
  console.log('n8n CLI Helper for Claude Code\n');
  console.log('Usage: node scripts/n8n-cli.js <command> [args]\n');
  console.log('Commands:');
  console.log('  workflows              - List all workflows');
  console.log('  workflow <id>          - Get workflow details');
  console.log('  executions [wfId]      - List recent executions');
  console.log('  execution <id>         - Get execution details');
  console.log('  nodes <execId>         - Get detailed node outputs');
  console.log('  node <execId> <name>   - Get specific node output');
  console.log('  errors <execId>        - Show only failed nodes');
  console.log('  trigger <path> [data]  - Trigger webhook workflow');
  console.log('  active                 - List active workflows');
  console.log('  search <wfId> <pattern>- Search node code');
  console.log('  credentials            - List credentials');
  process.exit(1);
}

commands[command]().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
```

Make the script executable:
```bash
chmod +x scripts/n8n-cli.js
```

---

## Usage Examples

### List All Workflows

```bash
node scripts/n8n-cli.js workflows
```

Output:
```
=== WORKFLOWS ===

[ACTIVE] Y6eWdKJoHaeWZgMX: EOB Processing Pipeline
   Created: 2024-01-15T10:30:00.000Z
   Updated: 2024-03-20T14:25:00.000Z

[inactive] abc123: Test Workflow
   Created: 2024-02-01T09:00:00.000Z
   Updated: 2024-02-01T09:00:00.000Z

Total: 2 workflows
```

### Debug an Execution

```bash
# Get overview
node scripts/n8n-cli.js execution 915

# Get detailed node outputs
node scripts/n8n-cli.js nodes 915

# Get specific node output
node scripts/n8n-cli.js node 915 "OpenAI - Extract EOB Data"

# Check for errors
node scripts/n8n-cli.js errors 915
```

### Trigger a Webhook

```bash
# Simple trigger
node scripts/n8n-cli.js trigger process-document

# With JSON payload
node scripts/n8n-cli.js trigger process-document '{"fileId": "abc123"}'
```

### Search Workflow Code

```bash
# Find all nodes that reference 'patient_acct'
node scripts/n8n-cli.js search Y6eWdKJoHaeWZgMX patient_acct
```

---

## Workflow Modification Patterns

### Basic Pattern: Update a Code Node

Create a script file (e.g., `scripts/fix-my-node.js`):

```javascript
#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'YOUR_WORKFLOW_ID';

const api = axios.create({
  baseURL: N8N_BASE_URL + '/api/v1',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

// New code for the node
const NEW_CODE = `// Your new JavaScript code here
const input = $input.first().json;
// ... process data ...
return [{ json: { result: 'success' } }];
`;

async function updateWorkflow() {
  console.log('Fetching workflow...');
  const { data: workflow } = await api.get(`/workflows/${WORKFLOW_ID}`);

  console.log('Updating nodes...');

  workflow.nodes = workflow.nodes.map(node => {
    if (node.name === 'Your Node Name') {
      console.log('  Found and updating:', node.name);
      node.parameters.jsCode = NEW_CODE;
    }
    return node;
  });

  console.log('Saving workflow...');

  await api.put(`/workflows/${WORKFLOW_ID}`, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  });

  console.log('Workflow updated successfully!');
}

updateWorkflow().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
```

### Update OpenAI/LLM Prompts

```javascript
// Update system and user prompts
workflow.nodes = workflow.nodes.map(node => {
  if (node.name === 'OpenAI - Extract Data') {
    node.parameters.messages = {
      values: [
        {
          role: 'system',
          content: 'You are an expert data extractor...'
        },
        {
          role: 'user',
          content: '={{ $json.prompt }}' // Expression reference
        }
      ]
    };
    node.parameters.options = {
      ...node.parameters.options,
      maxTokens: 16384,
      temperature: 0
    };
  }
  return node;
});
```

### Add a New Node

```javascript
// Create new node
const newNode = {
  id: 'my-new-node-' + Date.now(),
  name: 'Process Results',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [800, 400], // X, Y coordinates
  parameters: {
    jsCode: `// Process the results
const data = $input.all();
// ... your code ...
return data;`
  }
};

// Add to workflow
workflow.nodes.push(newNode);

// Add connection from previous node
workflow.connections['Previous Node Name'] = {
  main: [[{ node: 'Process Results', type: 'main', index: 0 }]]
};

// Connect to next node
workflow.connections['Process Results'] = {
  main: [[{ node: 'Next Node Name', type: 'main', index: 0 }]]
};
```

---

## Debugging Workflows

### Common Debugging Steps

1. **Check execution status**
   ```bash
   node scripts/n8n-cli.js execution <id>
   ```

2. **Find failing nodes**
   ```bash
   node scripts/n8n-cli.js errors <id>
   ```

3. **Examine node outputs**
   ```bash
   node scripts/n8n-cli.js nodes <id>
   ```

4. **Check specific node data**
   ```bash
   node scripts/n8n-cli.js node <id> "Node Name"
   ```

### Debug Code in Nodes

Add console.log statements to workflow code nodes:

```javascript
// In your n8n Code node
console.log('=== DEBUG INFO ===');
console.log('Input data:', JSON.stringify($input.first().json, null, 2));
console.log('Keys:', Object.keys($input.first().json));

// Process your data...
const result = processData($input.first().json);

console.log('Output:', JSON.stringify(result, null, 2));
return [{ json: result }];
```

Then check the execution logs:
```bash
node scripts/n8n-cli.js nodes <executionId>
```

---

## Best Practices

### 1. Add to CLAUDE.md

Add the n8n integration section to your project's CLAUDE.md:

```markdown
## n8n Integration (for Claude Code)

Direct access to n8n workflows via CLI helper.

### Setup
1. Generate API key at: http://localhost:5678/settings/api
2. Add to .env:
   ```
   N8N_BASE_URL=http://localhost:5678
   N8N_API_KEY=your_key_here
   ```

### Commands
```bash
node scripts/n8n-cli.js workflows          # List all
node scripts/n8n-cli.js execution <id>      # Debug execution
node scripts/n8n-cli.js errors <id>         # Find errors
node scripts/n8n-cli.js nodes <id>          # All outputs
```

### Main Workflow ID
`YOUR_WORKFLOW_ID`: Description of workflow
```

### 2. Use Environment Variables

Never hardcode API keys or URLs. Always use `.env`:

```bash
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_key_here
```

And reference in code:
```javascript
require('dotenv').config();
const N8N_BASE_URL = process.env.N8N_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
```

### 3. Create Focused Update Scripts

Create individual scripts for specific fixes:
- `scripts/fix-validation.js` - Fix validation node
- `scripts/fix-prompts.js` - Update LLM prompts
- `scripts/fix-output-format.js` - Fix output formatting

### 4. Test Changes

After modifying workflows:
1. Trigger a test execution
2. Check for errors
3. Verify output data

```bash
# Trigger
node scripts/n8n-cli.js trigger your-webhook

# Check latest execution
node scripts/n8n-cli.js executions

# Debug if needed
node scripts/n8n-cli.js errors <new-execution-id>
```

---

## Troubleshooting

### "N8N_API_KEY not set"

Generate an API key:
1. Go to n8n Settings → API
2. Enable API access
3. Create new API key
4. Add to `.env` file

### "Request failed with status code 401"

API key is invalid or expired. Generate a new one.

### "Request failed with status code 404"

- Check N8N_BASE_URL is correct
- Verify workflow/execution ID exists
- Ensure n8n is running

### "ECONNREFUSED"

n8n is not running. Start it with:
```bash
n8n start
```

### Node Not Found in Execution

The node may not have run (due to branching logic). Check workflow execution path.

### Cannot Modify Active Workflow

Some n8n configurations require deactivating workflows before modification:

```javascript
// Deactivate first
await api.patch(`/workflows/${WORKFLOW_ID}`, { active: false });

// Make changes...

// Reactivate
await api.patch(`/workflows/${WORKFLOW_ID}`, { active: true });
```

---

## Quick Reference Card

| Command | Description |
|---------|-------------|
| `workflows` | List all workflows |
| `workflow <id>` | Get workflow details |
| `executions [wfId]` | List recent executions |
| `execution <id>` | Get execution details |
| `nodes <id>` | All node outputs |
| `node <id> <name>` | Specific node output |
| `errors <id>` | Only failed nodes |
| `trigger <path> [json]` | Trigger webhook |
| `active` | List active workflows |
| `search <wfId> <pat>` | Search node code |
| `credentials` | List credentials |

---

## Version History

- **v1.0** (2024-12) - Initial release with core CLI commands and workflow modification patterns
