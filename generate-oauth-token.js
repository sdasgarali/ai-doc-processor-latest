const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Dynamic import for open (ES module)
let open;
(async () => {
  open = (await import('open')).default;
})();

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(__dirname, '.env');

async function generateToken() {
  console.log('\n🔐 OAuth2 Token Generator for Google Drive\n');
  
  // Check if credentials exist
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ Missing Google OAuth credentials in .env file');
    console.error('   Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set');
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
  );

  // Generate the auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to get refresh token
  });

  console.log('📝 Steps:');
  console.log('   1. Your browser will open automatically');
  console.log('   2. Sign in with your Google account');
  console.log('   3. Click "Allow" to grant access');
  console.log('   4. The page will redirect back automatically');
  console.log('\n⏳ Starting local server on port 3000...\n');

  // Create a simple HTTP server to handle the callback
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/oauth2callback')) {
        const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
        const code = qs.get('code');

        if (!code) {
          res.end('❌ Authorization failed - no code received');
          server.close();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Authorization Successful</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 10px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  text-align: center;
                  max-width: 500px;
                }
                .checkmark {
                  width: 80px;
                  height: 80px;
                  border-radius: 50%;
                  display: block;
                  stroke-width: 3;
                  stroke: #4CAF50;
                  stroke-miterlimit: 10;
                  margin: 0 auto 20px;
                  box-shadow: inset 0px 0px 0px #4CAF50;
                  animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
                }
                .checkmark__circle {
                  stroke-dasharray: 166;
                  stroke-dashoffset: 166;
                  stroke-width: 3;
                  stroke-miterlimit: 10;
                  stroke: #4CAF50;
                  fill: none;
                  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
                }
                .checkmark__check {
                  transform-origin: 50% 50%;
                  stroke-dasharray: 48;
                  stroke-dashoffset: 48;
                  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
                }
                @keyframes stroke {
                  100% {
                    stroke-dashoffset: 0;
                  }
                }
                @keyframes scale {
                  0%, 100% {
                    transform: none;
                  }
                  50% {
                    transform: scale3d(1.1, 1.1, 1);
                  }
                }
                @keyframes fill {
                  100% {
                    box-shadow: inset 0px 0px 0px 30px #4CAF50;
                  }
                }
                h1 {
                  color: #333;
                  margin-bottom: 10px;
                }
                p {
                  color: #666;
                  line-height: 1.6;
                }
                .code {
                  background: #f5f5f5;
                  padding: 3px 6px;
                  border-radius: 3px;
                  font-family: monospace;
                  color: #e83e8c;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                  <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                  <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
                <h1>✅ Authorization Successful!</h1>
                <p>Your Google Drive integration is now configured.</p>
                <p>The refresh token has been saved to your <span class="code">.env</span> file.</p>
                <p><strong>You can close this window and return to your terminal.</strong></p>
              </div>
            </body>
          </html>
        `);

        console.log('✅ Authorization code received!');
        console.log('⏳ Exchanging code for refresh token...');

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
          console.error('❌ No refresh token received. This might happen if you already authorized this app.');
          console.error('   Try revoking access at https://myaccount.google.com/permissions and run this script again.');
          server.close();
          return;
        }

        console.log('✅ Refresh token received!');
        console.log('💾 Saving to .env file...');

        // Read existing .env file
        let envContent = '';
        if (fs.existsSync(TOKEN_PATH)) {
          envContent = fs.readFileSync(TOKEN_PATH, 'utf-8');
        }

        // Check if GOOGLE_REFRESH_TOKEN already exists
        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
          // Replace existing token
          envContent = envContent.replace(
            /GOOGLE_REFRESH_TOKEN=.*/,
            `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
          );
        } else {
          // Add new token
          if (!envContent.endsWith('\n') && envContent.length > 0) {
            envContent += '\n';
          }
          envContent += `\n# Google Drive OAuth2 Refresh Token\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
        }

        // Write back to .env
        fs.writeFileSync(TOKEN_PATH, envContent);

        console.log('\n✅ Setup complete!');
        console.log('\n📌 Next steps:');
        console.log('   1. Restart your application if it\'s running');
        console.log('   2. Run: node test-google-drive.js');
        console.log('   3. Your files will now upload to Google Drive!\n');

        // Close server after a short delay
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      res.end('❌ Error during authorization. Check the terminal for details.');
      server.close();
    }
  });

  server.listen(3000, () => {
    console.log('✅ Server started on http://localhost:3000');
    console.log('🌐 Opening browser...\n');
    
    // Open browser after a short delay
    setTimeout(async () => {
      if (!open) {
        open = (await import('open')).default;
      }
      await open(authUrl);
    }, 1500);
  });

  // Handle server errors
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('❌ Port 3000 is already in use.');
      console.error('   Please close any applications using port 3000 and try again.');
    } else {
      console.error('❌ Server error:', err.message);
    }
    process.exit(1);
  });
}

// Run the token generator
generateToken().catch(console.error);
