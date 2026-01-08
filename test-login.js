const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function testLogin() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'AdminRootDBAli',
    database: 'eob_extraction'
  });

  // Get user
  const [users] = await connection.execute(
    'SELECT * FROM user_profile WHERE email = ?',
    ['admin@eobsystem.com']
  );

  if (users.length === 0) {
    console.log('❌ User not found');
    return;
  }

  const user = users[0];
  console.log('User found:', user.email);
  console.log('Stored hash:', user.password);

  // Test password
  const testPassword = 'Admin@123';
  console.log('\nTesting password:', testPassword);
  
  const isValid = await bcrypt.compare(testPassword, user.password);
  console.log('Password valid:', isValid ? '✅ YES' : '❌ NO');

  await connection.end();
}

testLogin().catch(console.error);
