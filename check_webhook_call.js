const fs = require('fs');

// Read the routes/documents.js to see how webhook is being called
const routesFile = fs.readFileSync('./routes/documents.js', 'utf8');

// Find the webhook trigger section
const lines = routesFile.split('\n');
let webhookSection = [];
let inWebhookSection = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('n8n') || lines[i].includes('webhook') || lines[i].includes('N8N')) {
        inWebhookSection = true;
    }
    
    if (inWebhookSection) {
        webhookSection.push(`${i+1}: ${lines[i]}`);
        
        if (lines[i].includes(';') && webhookSection.length > 5) {
            inWebhookSection = false;
        }
    }
}

console.log("Webhook trigger code in routes/documents.js:");
console.log("=".repeat(80));
console.log(webhookSection.join('\n'));

