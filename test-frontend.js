const axios = require('axios');

async function testFrontend() {
  try {
    console.log('Testing frontend simulation...');
    
    // Login first
    const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
      username: 'SA001',
      password: 'Test@12345'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful!');
    
    // Test 1: Access courses data (similar to what the frontend does)
    console.log('\n1. Testing courses data access...');
    const coursesResponse = await axios.get('http://localhost:4000/superadmin/abacus/courses', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Courses found:', coursesResponse.data.length);
    const course = coursesResponse.data.find(c => c.code === 'ABACUS_L1_REGULAR');
    console.log('ABACUS_L1_REGULAR course modules:', course.modules.length);
    
    // Test 2: Access levels for moduleId=3 (similar to what the frontend does when accessing with ?moduleId=3)
    console.log('\n2. Testing levels access for moduleId=3...');
    const levelsResponse = await axios.get('http://localhost:4000/superadmin/abacus-levels?moduleId=3', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Levels found for moduleId=3:', levelsResponse.data.length);
    
    // Show details of the levels
    levelsResponse.data.forEach(level => {
      console.log(`  Level ${level.id}: ${level.name} (Order: ${level.order}, Difficulty: ${level.difficulty})`);
    });
    
    // Test 3: Test the URL pattern that the frontend would use
    console.log('\n3. Testing URL pattern simulation...');
    console.log('If accessing http://localhost:3003/superadmin/abacus-builder?moduleId=3');
    console.log('The frontend should:');
    console.log('  1. Parse moduleId=3 from URL parameters');
    console.log('  2. Set selectedModuleId to 3');
    console.log('  3. Fetch levels with moduleId=3');
    console.log('  4. Display the 3 levels we just retrieved');
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testFrontend();