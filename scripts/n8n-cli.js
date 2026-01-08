#!/usr/bin/env node
/**
 * n8n CLI Helper for Claude Code
 *
 * Supports multiple n8n environments via profiles.
 *
 * Usage:
 *   node scripts/n8n-cli.js [-e <env>] <command> [arguments]
 *
 * Environments:
 *   -e local     Use N8N_LOCAL_URL and N8N_LOCAL_API_KEY
 *   -e prod      Use N8N_PROD_URL and N8N_PROD_API_KEY
 *   -e staging   Use N8N_STAGING_URL and N8N_STAGING_API_KEY
 *   -e <name>    Use N8N_<NAME>_URL and N8N_<NAME>_API_KEY
 *   (default)    Use N8N_BASE_URL and N8N_API_KEY
 *
 * Commands:
 *   envs                         - List configured environments
 *   workflows                    - List all workflows
 *   workflow <id>                - Get workflow details and nodes
 *   executions [workflowId]      - List recent executions
 *   execution <id>               - Get execution with node outputs
 *   nodes <executionId>          - Get detailed node-by-node output
 *   node <executionId> <name>    - Get specific node output
 *   errors <executionId>         - Show only errors from execution
 *   trigger <workflowId> [json]  - Trigger workflow via webhook
 *   active                       - List active workflows
 *   search <term>                - Search workflows by name
 *   credentials                  - List configured credentials
 */

require('dotenv').config();
const axios = require('axios');

// ============ ENVIRONMENT HANDLING ============

function parseArgs() {
  const args = process.argv.slice(2);
  let env = null;
  let command = null;
  let commandArgs = [];

  let i = 0;
  while (i < args.length) {
    if (args[i] === '-e' || args[i] === '--env') {
      env = args[i + 1];
      i += 2;
    } else if (!command) {
      command = args[i];
      i++;
    } else {
      commandArgs.push(args[i]);
      i++;
    }
  }

  return { env, command, args: commandArgs };
}

function getEnvConfig(envName) {
  if (envName) {
    const prefix = envName.toUpperCase();
    const url = process.env[`N8N_${prefix}_URL`];
    const key = process.env[`N8N_${prefix}_API_KEY`];

    if (!url || !key) {
      console.error(`\n╔════════════════════════════════════════════════════════════╗`);
      console.error(`║  ERROR: Environment "${envName}" not configured              `);
      console.error(`╠════════════════════════════════════════════════════════════╣`);
      console.error(`║  Add to .env file:                                          `);
      console.error(`║    N8N_${prefix}_URL=https://your-n8n-url.com           `);
      console.error(`║    N8N_${prefix}_API_KEY=your_api_key                   `);
      console.error(`╚════════════════════════════════════════════════════════════╝`);
      process.exit(1);
    }

    return { url, key, name: envName };
  }

  // Default environment
  const url = process.env.N8N_BASE_URL || 'http://localhost:5678';
  const key = process.env.N8N_API_KEY;

  return { url, key, name: 'default' };
}

function listConfiguredEnvs() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                 CONFIGURED ENVIRONMENTS                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const envs = [];

  // Check default
  if (process.env.N8N_BASE_URL || process.env.N8N_API_KEY) {
    const hasKey = !!process.env.N8N_API_KEY;
    envs.push({
      name: 'default',
      url: process.env.N8N_BASE_URL || 'http://localhost:5678',
      configured: hasKey
    });
  }

  // Check for named environments
  const envPatterns = ['LOCAL', 'PROD', 'PRODUCTION', 'STAGING', 'DEV', 'DEVELOPMENT', 'TEST'];

  // Also scan all env vars for N8N_*_URL pattern
  Object.keys(process.env).forEach(key => {
    const match = key.match(/^N8N_(.+)_URL$/);
    if (match && match[1] !== 'BASE') {
      const name = match[1].toLowerCase();
      const apiKeyVar = `N8N_${match[1]}_API_KEY`;
      envs.push({
        name,
        url: process.env[key],
        configured: !!process.env[apiKeyVar]
      });
    }
  });

  if (envs.length === 0) {
    console.log('No environments configured.\n');
    console.log('Add to your .env file:\n');
    console.log('  # Default environment');
    console.log('  N8N_BASE_URL=http://localhost:5678');
    console.log('  N8N_API_KEY=your_api_key\n');
    console.log('  # Named environments (optional)');
    console.log('  N8N_PROD_URL=https://n8n.yourcompany.com');
    console.log('  N8N_PROD_API_KEY=your_prod_key\n');
    return;
  }

  envs.forEach(env => {
    const status = env.configured ? '🟢 Ready' : '⚪ Missing API Key';
    console.log(`${status}  ${env.name}`);
    console.log(`        URL: ${env.url}`);
    console.log(`        Use: node scripts/n8n-cli.js ${env.name === 'default' ? '' : '-e ' + env.name}<command>`);
    console.log('');
  });

  console.log('─'.repeat(60));
  console.log(`Total: ${envs.length} environment(s)\n`);
}

// ============ PARSE ARGS AND SETUP ============

const { env: selectedEnv, command, args: cmdArgs } = parseArgs();

// Handle envs command before setting up API
if (command === 'envs' || command === 'environments') {
  listConfiguredEnvs();
  process.exit(0);
}

const { url: N8N_BASE_URL, key: N8N_API_KEY, name: ENV_NAME } = getEnvConfig(selectedEnv);

if (!N8N_API_KEY || N8N_API_KEY === 'YOUR_API_KEY_HERE') {
  console.error('╔════════════════════════════════════════════════════════════╗');
  console.error('║  ERROR: N8N_API_KEY not configured                         ║');
  console.error('╠════════════════════════════════════════════════════════════╣');
  console.error(`║  Environment: ${ENV_NAME.padEnd(44)} ║`);
  console.error(`║  URL: ${N8N_BASE_URL.padEnd(52)} ║`);
  console.error('╠════════════════════════════════════════════════════════════╣');
  console.error('║  1. Open n8n and go to Settings → API                      ║');
  console.error('║  2. Create an API Key                                      ║');
  console.error('║  3. Add to .env file                                       ║');
  console.error('╚════════════════════════════════════════════════════════════╝');
  process.exit(1);
}

const api = axios.create({
  baseURL: N8N_BASE_URL + '/api/v1',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Show which environment is being used
function showEnvBanner() {
  if (selectedEnv) {
    console.log(`\n🔗 Environment: ${ENV_NAME} (${N8N_BASE_URL})`);
  }
}

// ============ COMMANDS ============

async function listWorkflows() {
  showEnvBanner();
  const { data } = await api.get('/workflows');
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        WORKFLOWS                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  data.data.forEach(wf => {
    const status = wf.active ? '🟢 Active' : '⚪ Inactive';
    console.log(`ID: ${wf.id}`);
    console.log(`Name: ${wf.name}`);
    console.log(`Status: ${status}`);
    console.log('─'.repeat(50));
  });

  console.log(`\nTotal: ${data.data.length} workflows`);
  return data;
}

async function listActiveWorkflows() {
  showEnvBanner();
  const { data } = await api.get('/workflows');
  const active = data.data.filter(wf => wf.active);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    ACTIVE WORKFLOWS                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (active.length === 0) {
    console.log('No active workflows found.');
    return;
  }

  active.forEach(wf => {
    console.log(`🟢 ${wf.id} - ${wf.name}`);
  });

  console.log(`\nTotal: ${active.length} active workflows`);
  return active;
}

async function searchWorkflows(term) {
  showEnvBanner();
  const { data } = await api.get('/workflows');
  const matches = data.data.filter(wf =>
    wf.name.toLowerCase().includes(term.toLowerCase())
  );

  console.log(`\n🔍 Search results for "${term}":\n`);

  if (matches.length === 0) {
    console.log('No workflows found matching that term.');
    return;
  }

  matches.forEach(wf => {
    const status = wf.active ? '🟢' : '⚪';
    console.log(`${status} ${wf.id} - ${wf.name}`);
  });

  console.log(`\nFound: ${matches.length} workflows`);
  return matches;
}

async function getWorkflow(id) {
  showEnvBanner();
  const { data } = await api.get(`/workflows/${id}`);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    WORKFLOW DETAILS                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`ID: ${data.id}`);
  console.log(`Name: ${data.name}`);
  console.log(`Active: ${data.active ? '🟢 Yes' : '⚪ No'}`);
  console.log(`Created: ${data.createdAt}`);
  console.log(`Updated: ${data.updatedAt}`);

  console.log(`\n📦 Nodes (${data.nodes.length}):`);
  data.nodes.forEach((node, i) => {
    const type = node.type.replace('n8n-nodes-base.', '').replace('@n8n/', '');
    console.log(`  ${i + 1}. ${node.name} (${type})`);
  });

  return data;
}

async function listExecutions(workflowId, limit = 10) {
  showEnvBanner();
  const params = { limit };
  if (workflowId) params.workflowId = workflowId;

  const { data } = await api.get('/executions', { params });

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      EXECUTIONS                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  data.data.forEach(exec => {
    const statusIcon = exec.status === 'success' ? '✅' : exec.status === 'error' ? '❌' : '⏳';
    const duration = exec.stoppedAt && exec.startedAt
      ? Math.round((new Date(exec.stoppedAt) - new Date(exec.startedAt)) / 1000) + 's'
      : 'running';

    console.log(`${statusIcon} ID: ${exec.id} | Workflow: ${exec.workflowId} | ${duration}`);
    console.log(`   Started: ${exec.startedAt}`);
    console.log('─'.repeat(60));
  });

  return data;
}

async function getExecution(id) {
  showEnvBanner();
  const { data } = await api.get(`/executions/${id}`, { params: { includeData: true } });

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   EXECUTION DETAILS                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const statusIcon = data.status === 'success' ? '✅' : data.status === 'error' ? '❌' : '⏳';
  console.log(`${statusIcon} Execution ID: ${data.id}`);
  console.log(`Workflow: ${data.workflowId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Started: ${data.startedAt}`);
  console.log(`Finished: ${data.stoppedAt || 'Still running'}`);

  if (data.data?.resultData?.runData) {
    const runData = data.data.resultData.runData;
    const nodeNames = Object.keys(runData);

    console.log(`\n📦 Nodes Executed: ${nodeNames.length}`);

    nodeNames.forEach(nodeName => {
      const nodeRuns = runData[nodeName];
      const run = nodeRuns[0];
      const hasError = run?.error;
      const icon = hasError ? '❌' : '✅';
      const items = run?.data?.main?.[0]?.length || 0;
      const time = run?.executionTime || 0;

      console.log(`  ${icon} ${nodeName} (${items} items, ${time}ms)`);
    });
  }

  return data;
}

async function getNodeOutputs(executionId) {
  showEnvBanner();
  const { data } = await api.get(`/executions/${executionId}`, { params: { includeData: true } });

  if (!data.data?.resultData?.runData) {
    console.log('No run data found for this execution.');
    return null;
  }

  const runData = data.data.resultData.runData;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   ALL NODE OUTPUTS                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  for (const [nodeName, nodeRuns] of Object.entries(runData)) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📦 NODE: ${nodeName}`);
    console.log(`${'═'.repeat(60)}`);

    nodeRuns.forEach((run, runIndex) => {
      console.log(`\n⏱️  Execution Time: ${run.executionTime}ms`);

      if (run.error) {
        console.log(`❌ ERROR: ${run.error.message}`);
        if (run.error.description) {
          console.log(`   Description: ${run.error.description}`);
        }
      }

      if (run.data?.main) {
        run.data.main.forEach((branch, branchIndex) => {
          if (branch && branch.length > 0) {
            console.log(`\n📤 Output (${branch.length} items):`);
            branch.slice(0, 3).forEach((item, itemIndex) => {
              console.log(`\n--- Item ${itemIndex + 1} ---`);
              if (item.json) {
                const jsonStr = JSON.stringify(item.json, null, 2);
                const truncated = jsonStr.length > 2000
                  ? jsonStr.substring(0, 2000) + '\n... (truncated)'
                  : jsonStr;
                console.log(truncated);
              }
              if (item.binary) {
                console.log('Binary data:', Object.keys(item.binary).join(', '));
              }
            });
            if (branch.length > 3) {
              console.log(`\n... and ${branch.length - 3} more items`);
            }
          }
        });
      }
    });
  }

  return runData;
}

async function getSpecificNode(executionId, nodeName) {
  showEnvBanner();
  const { data } = await api.get(`/executions/${executionId}`, { params: { includeData: true } });

  if (!data.data?.resultData?.runData) {
    console.log('No run data found.');
    return null;
  }

  const runData = data.data.resultData.runData;

  // Find node (case-insensitive partial match)
  const matchedNode = Object.keys(runData).find(n =>
    n.toLowerCase().includes(nodeName.toLowerCase())
  );

  if (!matchedNode) {
    console.log(`Node "${nodeName}" not found. Available nodes:`);
    Object.keys(runData).forEach(n => console.log(`  - ${n}`));
    return null;
  }

  const nodeRuns = runData[matchedNode];

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  NODE: ${matchedNode.substring(0, 54).padEnd(54)} ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  nodeRuns.forEach((run, i) => {
    console.log(`Execution Time: ${run.executionTime}ms`);

    if (run.error) {
      console.log(`\n❌ ERROR: ${run.error.message}`);
    }

    if (run.data?.main?.[0]) {
      console.log(`\nOutput (${run.data.main[0].length} items):\n`);
      run.data.main[0].forEach((item, j) => {
        console.log(`--- Item ${j + 1} ---`);
        console.log(JSON.stringify(item.json, null, 2));
      });
    }
  });

  return nodeRuns;
}

async function getErrors(executionId) {
  showEnvBanner();
  const { data } = await api.get(`/executions/${executionId}`, { params: { includeData: true } });

  if (!data.data?.resultData?.runData) {
    console.log('No run data found.');
    return null;
  }

  const runData = data.data.resultData.runData;
  const errors = [];

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      EXECUTION ERRORS                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const [nodeName, nodeRuns] of Object.entries(runData)) {
    nodeRuns.forEach(run => {
      if (run.error) {
        errors.push({ node: nodeName, error: run.error });
        console.log(`❌ ${nodeName}`);
        console.log(`   Message: ${run.error.message}`);
        if (run.error.description) {
          console.log(`   Details: ${run.error.description}`);
        }
        console.log('');
      }
    });
  }

  if (errors.length === 0) {
    console.log('✅ No errors found in this execution.');
  } else {
    console.log(`\nTotal: ${errors.length} error(s)`);
  }

  return errors;
}

async function triggerWorkflow(workflowId, jsonData) {
  showEnvBanner();
  // First get the workflow to find webhook path
  const { data: workflow } = await api.get(`/workflows/${workflowId}`);

  const webhookNode = workflow.nodes.find(n =>
    n.type.includes('webhook')
  );

  if (!webhookNode) {
    console.log('This workflow does not have a webhook trigger.');
    return null;
  }

  const webhookPath = webhookNode.parameters?.path || workflowId;
  const webhookUrl = `${N8N_BASE_URL}/webhook/${webhookPath}`;

  console.log(`\n🚀 Triggering workflow via: ${webhookUrl}\n`);

  const payload = jsonData ? JSON.parse(jsonData) : { test: true, timestamp: new Date().toISOString() };

  const response = await axios.post(webhookUrl, payload);

  console.log('Response:', JSON.stringify(response.data, null, 2));
  return response.data;
}

async function listCredentials() {
  showEnvBanner();
  try {
    const { data } = await api.get('/credentials');

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      CREDENTIALS                             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    data.data.forEach(cred => {
      console.log(`🔑 ${cred.name} (${cred.type})`);
      console.log(`   ID: ${cred.id}`);
      console.log(`   Created: ${cred.createdAt}`);
      console.log('');
    });

    console.log(`Total: ${data.data.length} credentials`);
    return data;
  } catch (error) {
    console.log('Unable to list credentials (may require additional permissions)');
    return null;
  }
}

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           n8n CLI Helper for Claude Code                     ║
║                 (Multi-Environment Support)                  ║
╚══════════════════════════════════════════════════════════════╝

Usage: node scripts/n8n-cli.js [-e <env>] <command> [arguments]

ENVIRONMENT OPTIONS:

  -e local       Use N8N_LOCAL_URL and N8N_LOCAL_API_KEY
  -e prod        Use N8N_PROD_URL and N8N_PROD_API_KEY
  -e staging     Use N8N_STAGING_URL and N8N_STAGING_API_KEY
  -e <name>      Use N8N_<NAME>_URL and N8N_<NAME>_API_KEY
  (no -e flag)   Use N8N_BASE_URL and N8N_API_KEY (default)

COMMANDS:

  Environment:
    envs                         List all configured environments

  Workflows:
    workflows                    List all workflows
    workflow <id>                Get workflow details and nodes
    active                       List only active workflows
    search <term>                Search workflows by name

  Executions:
    executions [workflowId]      List recent executions
    execution <id>               Get execution summary with nodes
    nodes <executionId>          Get all node outputs (detailed)
    node <execId> <nodeName>     Get specific node output
    errors <executionId>         Show only errors from execution

  Actions:
    trigger <workflowId> [json]  Trigger workflow webhook
    credentials                  List configured credentials

EXAMPLES:

  # Using default environment
  node scripts/n8n-cli.js workflows
  node scripts/n8n-cli.js execution 920

  # Using specific environments
  node scripts/n8n-cli.js -e local workflows
  node scripts/n8n-cli.js -e prod executions
  node scripts/n8n-cli.js -e staging errors 123

  # List configured environments
  node scripts/n8n-cli.js envs

.ENV FILE SETUP:

  # Default environment
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
  `);
}

// ============ MAIN ============

const arg1 = cmdArgs[0];
const arg2 = cmdArgs[1];

(async () => {
  try {
    switch (command) {
      case 'workflows':
        await listWorkflows();
        break;
      case 'workflow':
        if (!arg1) { console.error('Usage: n8n-cli.js workflow <id>'); process.exit(1); }
        await getWorkflow(arg1);
        break;
      case 'active':
        await listActiveWorkflows();
        break;
      case 'search':
        if (!arg1) { console.error('Usage: n8n-cli.js search <term>'); process.exit(1); }
        await searchWorkflows(arg1);
        break;
      case 'executions':
        await listExecutions(arg1);
        break;
      case 'execution':
        if (!arg1) { console.error('Usage: n8n-cli.js execution <id>'); process.exit(1); }
        await getExecution(arg1);
        break;
      case 'nodes':
        if (!arg1) { console.error('Usage: n8n-cli.js nodes <executionId>'); process.exit(1); }
        await getNodeOutputs(arg1);
        break;
      case 'node':
        if (!arg1 || !arg2) { console.error('Usage: n8n-cli.js node <execId> <nodeName>'); process.exit(1); }
        await getSpecificNode(arg1, arg2);
        break;
      case 'errors':
        if (!arg1) { console.error('Usage: n8n-cli.js errors <executionId>'); process.exit(1); }
        await getErrors(arg1);
        break;
      case 'trigger':
        if (!arg1) { console.error('Usage: n8n-cli.js trigger <workflowId> [json]'); process.exit(1); }
        await triggerWorkflow(arg1, arg2);
        break;
      case 'credentials':
        await listCredentials();
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        showHelp();
    }
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
})();
