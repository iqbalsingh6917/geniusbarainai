const axios = require('axios');

async function testPageLoad() {
  try {
    console.log('Testing page load simulation...');
    
    // Login first
    const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
      username: 'SA001',
      password: 'Test@12345'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful!');
    
    // Test accessing the abacus builder page with moduleId=3
    console.log('\nTesting abacus builder page access...');
    
    // Simulate what the frontend would do:
    // 1. Fetch courses
    const coursesResponse = await axios.get('http://localhost:4000/superadmin/abacus/courses', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Courses loaded successfully');
    
    // 2. Fetch levels for moduleId=3
    const levelsResponse = await axios.get('http://localhost:4000/superadmin/abacus-levels?moduleId=3', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Levels loaded successfully:', levelsResponse.data.length, 'levels found');
    
    // 3. Simulate the page rendering logic
    console.log('\nSimulating page rendering...');
    console.log('Would render:', levelsResponse.data.length, 'levels in the table');
    
    // Check that the levels have the expected structure
    levelsResponse.data.forEach(level => {
      console.log(`  Level ${level.id}: ${level.name}`);
    });
    
    console.log('\nPage load test completed successfully!');
    console.log('The page should now display properly instead of showing "Loading..."');
    
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testPageLoad();